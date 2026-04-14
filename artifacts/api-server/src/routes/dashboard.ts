import { Router, type IRouter } from "express";
import { eq, sql, and, inArray } from "drizzle-orm";
import { db, missionsTable, usersTable, departmentsTable, employeesTable } from "@workspace/db";
import { GetPendingValidationsQueryParams } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/session";
import { calcDurationDays, calculateFees, type EmployeeCategory } from "../lib/fees";
import { missionEmployeesTable } from "@workspace/db";
import { type MissionStatus, type UserRole, canUserValidate } from "../lib/mission-workflow";

const router: IRouter = Router();

const VALIDATOR_ROLES = [
  "director",
  "central_director",
  "technical_control",
  "dga",
  "dmg",
  "cad",
  "financial_control",
  "drh",
  "admin",
];

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  pending_director: "En attente Directeur",
  pending_central_director: "En attente Dir. Central",
  pending_technical_control: "En attente Contrôle Technique",
  pending_dga: "En attente DGA",
  pending_dmg: "En attente DMG",
  pending_cad: "En attente CAD",
  pending_financial_control: "En attente Contrôle Financier",
  pending_drh: "En attente DRH",
  approved: "Approuvée",
  rejected: "Rejetée",
};

router.get("/dashboard/stats", requireAuth, async (req, res): Promise<void> => {
  const userRole = req.userRole!;
  const userId = req.userId!;
  const userDeptId = req.userDepartmentId;

  const isValidator = VALIDATOR_ROLES.includes(userRole);

  let missionScope;
  if (!isValidator && userDeptId) {
    missionScope = eq(missionsTable.departmentId, userDeptId);
  } else if (!isValidator) {
    missionScope = eq(missionsTable.createdByUserId, userId);
  }

  const [totalResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(missionsTable)
    .where(missionScope);

  const [approvedResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(missionsTable)
    .where(missionScope ? and(missionScope, eq(missionsTable.status, "approved")) : eq(missionsTable.status, "approved"));

  const [rejectedResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(missionsTable)
    .where(missionScope ? and(missionScope, eq(missionsTable.status, "rejected")) : eq(missionsTable.status, "rejected"));

  // Pending for current user
  let pendingCondition;
  if (userRole === "admin") {
    pendingCondition = sql`${missionsTable.status} NOT IN ('draft','approved','rejected')`;
  } else if (isValidator) {
    const statusMap: Record<string, string> = {
      director: "pending_director",
      central_director: "pending_central_director",
      technical_control: "pending_technical_control",
      dga: "pending_dga",
      dmg: "pending_dmg",
      cad: "pending_cad",
      financial_control: "pending_financial_control",
      drh: "pending_drh",
    };
    const myStatus = statusMap[userRole];
    pendingCondition = myStatus ? eq(missionsTable.status, myStatus as MissionStatus) : sql`false`;
  } else {
    pendingCondition = sql`false`;
  }

  const [pendingResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(missionsTable)
    .where(pendingCondition);

  const [totalEmps] = await db.select({ count: sql<number>`count(*)::int` }).from(employeesTable);
  const [totalDepts] = await db.select({ count: sql<number>`count(*)::int` }).from(departmentsTable);

  const statusCounts = await db
    .select({
      status: missionsTable.status,
      count: sql<number>`count(*)::int`,
    })
    .from(missionsTable)
    .where(missionScope)
    .groupBy(missionsTable.status);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const [recentResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(missionsTable)
    .where(sql`${missionsTable.createdAt} >= ${sevenDaysAgo.toISOString()}`);

  res.json({
    totalMissions: totalResult?.count ?? 0,
    pendingValidations: pendingResult?.count ?? 0,
    approvedMissions: approvedResult?.count ?? 0,
    rejectedMissions: rejectedResult?.count ?? 0,
    totalEmployees: totalEmps?.count ?? 0,
    totalDepartments: totalDepts?.count ?? 0,
    missionsByStatus: statusCounts.map(s => ({
      status: s.status,
      count: s.count,
      label: STATUS_LABELS[s.status] ?? s.status,
    })),
    recentActivity: recentResult?.count ?? 0,
  });
});

router.get("/dashboard/pending-validations", requireAuth, async (req, res): Promise<void> => {
  const parsed = GetPendingValidationsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { page = 1, limit = 10 } = parsed.data;
  const offset = (page - 1) * limit;
  const userRole = req.userRole! as UserRole;

  const statusMap: Record<string, string> = {
    director: "pending_director",
    central_director: "pending_central_director",
    technical_control: "pending_technical_control",
    dga: "pending_dga",
    dmg: "pending_dmg",
    cad: "pending_cad",
    financial_control: "pending_financial_control",
    drh: "pending_drh",
  };

  let condition;
  if (userRole === "admin") {
    condition = sql`${missionsTable.status} NOT IN ('draft','approved','rejected')`;
  } else {
    const myStatus = statusMap[userRole];
    if (!myStatus) {
      res.json({ data: [], total: 0, page, limit, totalPages: 0 });
      return;
    }
    condition = eq(missionsTable.status, myStatus as MissionStatus);
  }

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(missionsTable)
    .where(condition);

  const missions = await db
    .select()
    .from(missionsTable)
    .where(condition)
    .limit(limit)
    .offset(offset)
    .orderBy(missionsTable.updatedAt);

  const creatorIds = [...new Set(missions.map(m => m.createdByUserId))];
  const creators = creatorIds.length > 0
    ? await db.select({ id: usersTable.id, fullName: usersTable.fullName }).from(usersTable).where(inArray(usersTable.id, creatorIds))
    : [];
  const creatorMap = new Map(creators.map(c => [c.id, c.fullName]));

  const deptIds = [...new Set(missions.filter(m => m.departmentId).map(m => m.departmentId!))];
  const depts = deptIds.length > 0
    ? await db.select({ id: departmentsTable.id, name: departmentsTable.name }).from(departmentsTable).where(inArray(departmentsTable.id, deptIds))
    : [];
  const deptMap = new Map(depts.map(d => [d.id, d.name]));

  const missionIds = missions.map(m => m.id);
  const empCounts = missionIds.length > 0
    ? await db
        .select({ missionId: missionEmployeesTable.missionId, count: sql<number>`count(*)::int` })
        .from(missionEmployeesTable)
        .where(inArray(missionEmployeesTable.missionId, missionIds))
        .groupBy(missionEmployeesTable.missionId)
    : [];
  const empCountMap = new Map(empCounts.map(e => [e.missionId, e.count]));

  const total = countResult?.count ?? 0;
  const totalPages = Math.ceil(total / limit);

  res.json({
    data: missions.map(m => ({
      ...m,
      createdByName: creatorMap.get(m.createdByUserId) ?? "Inconnu",
      departmentName: m.departmentId ? (deptMap.get(m.departmentId) ?? null) : null,
      durationDays: calcDurationDays(m.startDate, m.endDate),
      employeeCount: empCountMap.get(m.id) ?? 0,
      totalFees: null,
      paidAmount: null,
      remainingAmount: null,
      employees: [],
    })),
    total,
    page,
    limit,
    totalPages,
  });
});

router.get("/dashboard/recent-missions", requireAuth, async (req, res): Promise<void> => {
  const userId = req.userId!;
  const userRole = req.userRole!;
  const userDeptId = req.userDepartmentId;

  const isValidator = VALIDATOR_ROLES.includes(userRole);
  let condition;
  if (!isValidator && userDeptId) {
    condition = eq(missionsTable.departmentId, userDeptId);
  } else if (!isValidator) {
    condition = eq(missionsTable.createdByUserId, userId);
  }

  const missions = await db
    .select()
    .from(missionsTable)
    .where(condition)
    .limit(5)
    .orderBy(sql`${missionsTable.createdAt} DESC`);

  const creatorIds = [...new Set(missions.map(m => m.createdByUserId))];
  const creators = creatorIds.length > 0
    ? await db.select({ id: usersTable.id, fullName: usersTable.fullName }).from(usersTable).where(inArray(usersTable.id, creatorIds))
    : [];
  const creatorMap = new Map(creators.map(c => [c.id, c.fullName]));

  const deptIds = [...new Set(missions.filter(m => m.departmentId).map(m => m.departmentId!))];
  const depts = deptIds.length > 0
    ? await db.select({ id: departmentsTable.id, name: departmentsTable.name }).from(departmentsTable).where(inArray(departmentsTable.id, deptIds))
    : [];
  const deptMap = new Map(depts.map(d => [d.id, d.name]));

  res.json(
    missions.map(m => ({
      ...m,
      createdByName: creatorMap.get(m.createdByUserId) ?? "Inconnu",
      departmentName: m.departmentId ? (deptMap.get(m.departmentId) ?? null) : null,
      durationDays: calcDurationDays(m.startDate, m.endDate),
      employeeCount: 0,
      totalFees: null,
      paidAmount: null,
      remainingAmount: null,
      employees: [],
    }))
  );
});

export default router;
