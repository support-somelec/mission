import { Router, type IRouter } from "express";
import { eq, sql, and, inArray, gte, lte } from "drizzle-orm";
import { db, missionsTable, usersTable, departmentsTable, employeesTable } from "@workspace/db";
import { GetPendingValidationsQueryParams } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/session";
import { calcDurationDays } from "../lib/fees";
import { missionEmployeesTable } from "@workspace/db";
import { type MissionStatus, type UserRole } from "../lib/mission-workflow";

const router: IRouter = Router();

// Rôles qui voient TOUTES les missions sans restriction de département
const TRANSVERSAL_ROLES = [
  "technical_control",
  "dga",
  "dmg",
  "cad_edition",
  "cad_payment",
  "financial_control",
  "admin",
];

// Rôles qui peuvent valider des missions (utilisé pour l'onglet "À valider")
const VALIDATOR_ROLES = [
  "director",
  "central_director",
  "technical_control",
  "dga",
  "dmg",
  "cad_edition",
  "cad_payment",
  "financial_control",
  "admin",
];

/** Calcule la condition de périmètre de visibilité des missions pour un utilisateur */
async function buildMissionScope(userRole: string, userId: number, userDeptId: number | null | undefined) {
  if (TRANSVERSAL_ROLES.includes(userRole)) return undefined; // pas de filtre

  if (userRole === "central_director" && userDeptId) {
    const childDepts = await db
      .select({ id: departmentsTable.id })
      .from(departmentsTable)
      .where(eq(departmentsTable.parentId, userDeptId));
    const visibleDeptIds = [userDeptId, ...childDepts.map(d => d.id)];
    return inArray(missionsTable.departmentId, visibleDeptIds);
  }

  if (userRole === "director" && userDeptId) {
    return eq(missionsTable.departmentId, userDeptId);
  }

  // employee ou directeur sans département : ses propres missions uniquement
  return eq(missionsTable.createdByUserId, userId);
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  pending_director: "En attente Directeur",
  pending_central_director: "En attente Dir. Central",
  pending_technical_control: "En attente Contrôle Technique",
  pending_dga: "En attente DGA",
  pending_dmg: "En attente DMG",
  en_vigueur: "En Vigueur",
  pending_cad_payment: "En attente CAD Paiement",
  pending_financial_control: "En attente Contrôle Financier",
  approved: "Approuvée",
  rejected: "Rejetée",
};

const ROLE_TO_STATUS: Record<string, string> = {
  director: "pending_director",
  central_director: "pending_central_director",
  technical_control: "pending_technical_control",
  dga: "pending_dga",
  dmg: "pending_dmg",
  cad_edition: "en_vigueur",
  cad_payment: "pending_cad_payment",
  financial_control: "pending_financial_control",
};

router.get("/dashboard/stats", requireAuth, async (req, res): Promise<void> => {
  const userRole = req.userRole!;
  const userId = req.userId!;
  const userDeptId = req.userDepartmentId;

  const isValidator = VALIDATOR_ROLES.includes(userRole);
  const missionScope = await buildMissionScope(userRole, userId, userDeptId);

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

  let pendingCondition;
  if (userRole === "admin") {
    pendingCondition = sql`${missionsTable.status} NOT IN ('draft','approved','rejected')`;
  } else if (isValidator) {
    const myStatus = ROLE_TO_STATUS[userRole];
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

  let condition;
  if (userRole === "admin") {
    condition = sql`${missionsTable.status} NOT IN ('draft','approved','rejected')`;
  } else {
    const myStatus = ROLE_TO_STATUS[userRole];
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

  const condition = await buildMissionScope(userRole, userId, userDeptId);

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

const MONTH_LABELS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

router.get("/dashboard/reporting", requireAuth, async (req, res): Promise<void> => {
  const userRole = req.userRole!;
  if (userRole !== "admin" && userRole !== "dga") {
    res.status(403).json({ error: "Accès réservé aux administrateurs et DGA" });
    return;
  }

  const yearParam = req.query.year ? Number(req.query.year) : new Date().getFullYear();
  const monthParam = req.query.month ? Number(req.query.month) : undefined;
  const departmentIdParam = req.query.departmentId ? Number(req.query.departmentId) : undefined;

  const yearStart = new Date(`${yearParam}-01-01T00:00:00.000Z`);
  const yearEnd = new Date(`${yearParam}-12-31T23:59:59.999Z`);

  const baseConditions = [
    gte(missionsTable.createdAt, yearStart),
    lte(missionsTable.createdAt, yearEnd),
    ...(departmentIdParam ? [eq(missionsTable.departmentId, departmentIdParam)] : []),
  ];

  // Month filter applies to KPIs, byDepartment and byEmployee (not byMonth chart)
  const withMonthConditions = [
    ...baseConditions,
    ...(monthParam ? [sql`EXTRACT(MONTH FROM ${missionsTable.createdAt})::int = ${monthParam}`] : []),
  ];

  // ── Par direction ─────────────────────────────────────────────────────────
  const byDeptRaw = await db
    .select({
      departmentId: missionsTable.departmentId,
      status: missionsTable.status,
      count: sql<number>`count(*)::int`,
    })
    .from(missionsTable)
    .where(and(...withMonthConditions))
    .groupBy(missionsTable.departmentId, missionsTable.status);

  const deptIds = [...new Set(byDeptRaw.filter(r => r.departmentId).map(r => r.departmentId!))];
  const depts = deptIds.length > 0
    ? await db.select({ id: departmentsTable.id, name: departmentsTable.name }).from(departmentsTable).where(inArray(departmentsTable.id, deptIds))
    : [];
  const deptNameMap = new Map(depts.map(d => [d.id, d.name]));

  const deptAgg = new Map<number, { departmentId: number; departmentName: string; total: number; approved: number; rejected: number; inProgress: number }>();
  for (const row of byDeptRaw) {
    if (!row.departmentId) continue;
    if (!deptAgg.has(row.departmentId)) {
      deptAgg.set(row.departmentId, {
        departmentId: row.departmentId,
        departmentName: deptNameMap.get(row.departmentId) ?? "Inconnu",
        total: 0, approved: 0, rejected: 0, inProgress: 0,
      });
    }
    const entry = deptAgg.get(row.departmentId)!;
    entry.total += row.count;
    if (row.status === "approved") entry.approved += row.count;
    else if (row.status === "rejected") entry.rejected += row.count;
    else entry.inProgress += row.count;
  }
  const byDepartment = [...deptAgg.values()].sort((a, b) => b.total - a.total);

  // ── Par mois ──────────────────────────────────────────────────────────────
  const byMonthRaw = await db
    .select({
      month: sql<number>`EXTRACT(MONTH FROM ${missionsTable.createdAt})::int`,
      status: missionsTable.status,
      count: sql<number>`count(*)::int`,
    })
    .from(missionsTable)
    .where(and(...baseConditions))
    .groupBy(sql`EXTRACT(MONTH FROM ${missionsTable.createdAt})`, missionsTable.status);

  const monthAgg = new Map<number, { year: number; month: number; monthLabel: string; total: number; approved: number; rejected: number }>();
  for (let m = 1; m <= 12; m++) {
    monthAgg.set(m, { year: yearParam, month: m, monthLabel: MONTH_LABELS[m - 1], total: 0, approved: 0, rejected: 0 });
  }
  for (const row of byMonthRaw) {
    const entry = monthAgg.get(row.month);
    if (!entry) continue;
    entry.total += row.count;
    if (row.status === "approved") entry.approved += row.count;
    else if (row.status === "rejected") entry.rejected += row.count;
  }
  const byMonth = [...monthAgg.values()];

  // ── Par agent ─────────────────────────────────────────────────────────────
  const byEmployeeRaw = await db
    .select({
      employeeId: missionEmployeesTable.employeeId,
      count: sql<number>`count(distinct ${missionEmployeesTable.missionId})::int`,
    })
    .from(missionEmployeesTable)
    .innerJoin(missionsTable, eq(missionEmployeesTable.missionId, missionsTable.id))
    .where(and(...withMonthConditions))
    .groupBy(missionEmployeesTable.employeeId)
    .orderBy(sql`count(distinct ${missionEmployeesTable.missionId}) DESC`)
    .limit(20);

  const empIds = byEmployeeRaw.map(r => r.employeeId);
  const emps = empIds.length > 0
    ? await db
        .select({
          id: employeesTable.id,
          firstName: employeesTable.firstName,
          lastName: employeesTable.lastName,
          matricule: employeesTable.matricule,
          departmentId: employeesTable.departmentId,
        })
        .from(employeesTable)
        .where(inArray(employeesTable.id, empIds))
    : [];

  const empDeptIds = [...new Set(emps.filter(e => e.departmentId).map(e => e.departmentId!))];
  const empDepts = empDeptIds.length > 0
    ? await db.select({ id: departmentsTable.id, name: departmentsTable.name }).from(departmentsTable).where(inArray(departmentsTable.id, empDeptIds))
    : [];
  const empDeptMap = new Map(empDepts.map(d => [d.id, d.name]));
  const empMap = new Map(emps.map(e => [e.id, e]));

  const byEmployee = byEmployeeRaw.map(r => {
    const emp = empMap.get(r.employeeId);
    return {
      employeeId: r.employeeId,
      firstName: emp?.firstName ?? "",
      lastName: emp?.lastName ?? "",
      matricule: emp?.matricule ?? "",
      departmentName: emp?.departmentId ? (empDeptMap.get(emp.departmentId) ?? "—") : "—",
      missionCount: r.count,
    };
  });

  // ── Totaux (calculés depuis byDepartment pour respecter le filtre mois) ──
  const totalMissions = byDepartment.reduce((s, d) => s + d.total, 0);
  const totalApproved = byDepartment.reduce((s, d) => s + d.approved, 0);
  const totalRejected = byDepartment.reduce((s, d) => s + d.rejected, 0);
  const totalInProgress = byDepartment.reduce((s, d) => s + d.inProgress, 0);

  res.json({ byDepartment, byMonth, byEmployee, totalMissions, totalApproved, totalRejected, totalInProgress });
});

export default router;
