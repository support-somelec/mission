import { Router, type IRouter } from "express";
import { eq, ilike, sql, and, inArray } from "drizzle-orm";
import { db, missionsTable, missionEmployeesTable, missionValidationsTable, usersTable, departmentsTable, employeesTable } from "@workspace/db";
import {
  CreateMissionBody,
  UpdateMissionBody,
  GetMissionParams,
  UpdateMissionParams,
  DeleteMissionParams,
  ListMissionsQueryParams,
  ValidateMissionParams,
  ValidateMissionBody,
  AssignVehiclesParams,
  AssignVehiclesBody,
  GenerateMissionOrderParams,
  GetMissionOrderParams,
  GetMissionEmployeesParams,
  GetMissionValidationsParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/session";
import {
  canUserValidate,
  getInitialStatus,
  getNextStatus,
  type MissionStatus,
  type UserRole,
} from "../lib/mission-workflow";
import { calculateFees, calcDurationDays, type EmployeeCategory } from "../lib/fees";

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

async function getMissionWithDetails(id: number, userId: number, userRole: string, userDepartmentId: number | null | undefined) {
  const [mission] = await db.select().from(missionsTable).where(eq(missionsTable.id, id));
  if (!mission) return null;

  const [creator] = await db.select({ fullName: usersTable.fullName }).from(usersTable).where(eq(usersTable.id, mission.createdByUserId));
  const [dept] = mission.departmentId
    ? await db.select({ name: departmentsTable.name }).from(departmentsTable).where(eq(departmentsTable.id, mission.departmentId))
    : [null];

  const missionEmps = await db
    .select()
    .from(missionEmployeesTable)
    .where(eq(missionEmployeesTable.missionId, id));

  const empIds = missionEmps.map(me => me.employeeId);
  const employees = empIds.length > 0
    ? await db.select().from(employeesTable).where(inArray(employeesTable.id, empIds))
    : [];

  const start = mission.startDate;
  const end = mission.endDate;
  const durationDays = calcDurationDays(start, end);

  let totalFees = 0;
  for (const emp of employees) {
    const fees = calculateFees(emp.category as EmployeeCategory, durationDays);
    totalFees += fees.totalFee;
  }
  const paidAmount = Math.round(totalFees * 0.70 * 100) / 100;
  const remainingAmount = Math.round((totalFees - paidAmount) * 100) / 100;

  return {
    ...mission,
    createdByName: creator?.fullName ?? "Inconnu",
    departmentName: dept?.name ?? null,
    durationDays,
    employeeCount: employees.length,
    totalFees: totalFees || null,
    paidAmount: paidAmount || null,
    remainingAmount: remainingAmount || null,
    employees: employees.map(e => ({
      employeeId: e.id,
      fullName: `${e.firstName} ${e.lastName}`,
      matricule: e.matricule,
      position: e.position,
      category: e.category,
    })),
  };
}

router.get("/missions", requireAuth, async (req, res): Promise<void> => {
  const parsed = ListMissionsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { page = 1, limit = 20, search, status, departmentId, startDateFrom, startDateTo } = parsed.data;
  const offset = (page - 1) * limit;
  const userRole = req.userRole!;
  const userId = req.userId!;
  const userDeptId = req.userDepartmentId;

  const conditions = [];

  // Scope: validators see all, regular employees see only their dept
  if (!VALIDATOR_ROLES.includes(userRole)) {
    if (userDeptId) {
      conditions.push(eq(missionsTable.departmentId, userDeptId));
    } else {
      conditions.push(eq(missionsTable.createdByUserId, userId));
    }
  }

  if (search) {
    conditions.push(ilike(missionsTable.title, `%${search}%`));
  }
  if (status) {
    conditions.push(eq(missionsTable.status, status as MissionStatus));
  }
  if (departmentId) {
    conditions.push(eq(missionsTable.departmentId, departmentId));
  }
  if (startDateFrom) {
    conditions.push(sql`${missionsTable.startDate} >= ${startDateFrom}`);
  }
  if (startDateTo) {
    conditions.push(sql`${missionsTable.startDate} <= ${startDateTo}`);
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(missionsTable)
    .where(whereClause);

  const missions = await db
    .select()
    .from(missionsTable)
    .where(whereClause)
    .limit(limit)
    .offset(offset)
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

  const missionIds = missions.map(m => m.id);
  const missionEmpsAll = missionIds.length > 0
    ? await db.select().from(missionEmployeesTable).where(inArray(missionEmployeesTable.missionId, missionIds))
    : [];

  const empIds = [...new Set(missionEmpsAll.map(me => me.employeeId))];
  const allEmployees = empIds.length > 0
    ? await db.select().from(employeesTable).where(inArray(employeesTable.id, empIds))
    : [];
  const empMap = new Map(allEmployees.map(e => [e.id, e]));

  const empsByMission = new Map<number, typeof allEmployees>();
  for (const me of missionEmpsAll) {
    if (!empsByMission.has(me.missionId)) empsByMission.set(me.missionId, []);
    const emp = empMap.get(me.employeeId);
    if (emp) empsByMission.get(me.missionId)!.push(emp);
  }

  const total = countResult?.count ?? 0;
  const totalPages = Math.ceil(total / limit);

  res.json({
    data: missions.map(m => {
      const emps = empsByMission.get(m.id) ?? [];
      const durationDays = calcDurationDays(m.startDate, m.endDate);
      let totalFees = 0;
      for (const emp of emps) {
        totalFees += calculateFees(emp.category as EmployeeCategory, durationDays).totalFee;
      }
      const paidAmount = Math.round(totalFees * 0.70 * 100) / 100;
      const remainingAmount = Math.round((totalFees - paidAmount) * 100) / 100;
      return {
        ...m,
        createdByName: creatorMap.get(m.createdByUserId) ?? "Inconnu",
        departmentName: m.departmentId ? (deptMap.get(m.departmentId) ?? null) : null,
        durationDays,
        employeeCount: emps.length,
        totalFees: totalFees || null,
        paidAmount: paidAmount || null,
        remainingAmount: remainingAmount || null,
        employees: emps.map(e => ({
          employeeId: e.id,
          fullName: `${e.firstName} ${e.lastName}`,
          matricule: e.matricule,
          position: e.position,
          category: e.category,
        })),
      };
    }),
    total,
    page,
    limit,
    totalPages,
  });
});

router.post("/missions", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateMissionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = req.userId!;
  const userRole = req.userRole! as UserRole;
  const userDeptId = req.userDepartmentId;

  const { employeeIds, ...missionData } = parsed.data;
  const initialStatus = getInitialStatus(userRole);

  const [mission] = await db
    .insert(missionsTable)
    .values({
      ...missionData,
      status: initialStatus,
      createdByUserId: userId,
      departmentId: userDeptId ?? null,
      currentValidationRole: initialStatus !== "draft" ? initialStatus.replace("pending_", "") : null,
    })
    .returning();

  if (employeeIds && employeeIds.length > 0) {
    await db.insert(missionEmployeesTable).values(
      employeeIds.map(empId => ({ missionId: mission.id, employeeId: empId }))
    );
  }

  const detail = await getMissionWithDetails(mission.id, userId, userRole, userDeptId);
  res.status(201).json(detail);
});

router.get("/missions/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetMissionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const detail = await getMissionWithDetails(params.data.id, req.userId!, req.userRole!, req.userDepartmentId);
  if (!detail) {
    res.status(404).json({ error: "Mission non trouvée" });
    return;
  }

  res.json(detail);
});

router.patch("/missions/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateMissionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db.select().from(missionsTable).where(eq(missionsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Mission non trouvée" });
    return;
  }

  if (existing.status !== "draft" && req.userRole !== "admin") {
    res.status(403).json({ error: "Impossible de modifier une mission en cours de validation" });
    return;
  }

  const parsed = UpdateMissionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { employeeIds, ...updateFields } = parsed.data;
  const updateData: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(updateFields)) {
    if (v !== null && v !== undefined) updateData[k] = v;
  }

  if (Object.keys(updateData).length > 0) {
    await db.update(missionsTable).set(updateData).where(eq(missionsTable.id, params.data.id));
  }

  if (employeeIds) {
    await db.delete(missionEmployeesTable).where(eq(missionEmployeesTable.missionId, params.data.id));
    if (employeeIds.length > 0) {
      await db.insert(missionEmployeesTable).values(
        employeeIds.map(empId => ({ missionId: params.data.id, employeeId: empId }))
      );
    }
  }

  const detail = await getMissionWithDetails(params.data.id, req.userId!, req.userRole!, req.userDepartmentId);
  res.json(detail);
});

router.delete("/missions/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteMissionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db.select().from(missionsTable).where(eq(missionsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Mission non trouvée" });
    return;
  }

  if (existing.status !== "draft" && req.userRole !== "admin") {
    res.status(403).json({ error: "Impossible de supprimer une mission en cours de validation" });
    return;
  }

  await db.delete(missionEmployeesTable).where(eq(missionEmployeesTable.missionId, params.data.id));
  await db.delete(missionValidationsTable).where(eq(missionValidationsTable.missionId, params.data.id));
  await db.delete(missionsTable).where(eq(missionsTable.id, params.data.id));

  res.sendStatus(204);
});

router.post("/missions/:id/validate", requireAuth, async (req, res): Promise<void> => {
  const params = ValidateMissionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = ValidateMissionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [mission] = await db.select().from(missionsTable).where(eq(missionsTable.id, params.data.id));
  if (!mission) {
    res.status(404).json({ error: "Mission non trouvée" });
    return;
  }

  const userRole = req.userRole! as UserRole;
  if (!canUserValidate(userRole, mission.status as MissionStatus)) {
    res.status(403).json({ error: "Vous n'êtes pas autorisé à valider cette mission à cette étape" });
    return;
  }

  const [validator] = await db.select({ fullName: usersTable.fullName }).from(usersTable).where(eq(usersTable.id, req.userId!));

  const fromStatus = mission.status;
  const toStatus: MissionStatus = parsed.data.action === "approve"
    ? getNextStatus(mission.status as MissionStatus)
    : "rejected";

  await db.insert(missionValidationsTable).values({
    missionId: mission.id,
    validatorUserId: req.userId!,
    validatorRole: userRole,
    action: parsed.data.action,
    comment: parsed.data.comment ?? null,
    fromStatus,
    toStatus,
  });

  await db.update(missionsTable)
    .set({
      status: toStatus,
      currentValidationRole: toStatus !== "approved" && toStatus !== "rejected"
        ? toStatus.replace("pending_", "")
        : null,
    })
    .where(eq(missionsTable.id, mission.id));

  const detail = await getMissionWithDetails(mission.id, req.userId!, userRole, req.userDepartmentId);
  res.json(detail);
});

router.post("/missions/:id/assign-vehicles", requireAuth, async (req, res): Promise<void> => {
  const params = AssignVehiclesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  if (req.userRole !== "dmg" && req.userRole !== "admin") {
    res.status(403).json({ error: "Seul le DMG peut affecter des véhicules" });
    return;
  }

  const parsed = AssignVehiclesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [mission] = await db.select().from(missionsTable).where(eq(missionsTable.id, params.data.id));
  if (!mission) {
    res.status(404).json({ error: "Mission non trouvée" });
    return;
  }

  const fromStatus = mission.status as MissionStatus;

  // Advance the mission to the next stage after DMG assigns vehicles
  const toStatus: MissionStatus = mission.status === "pending_dmg"
    ? getNextStatus("pending_dmg")
    : (mission.status as MissionStatus);

  await db.update(missionsTable)
    .set({
      vehicleDetails: parsed.data.vehicleDetails,
      vehicleCount: parsed.data.vehicleCount,
      status: toStatus,
      currentValidationRole: toStatus !== "approved" && toStatus !== "rejected"
        ? toStatus.replace("pending_", "")
        : null,
    })
    .where(eq(missionsTable.id, params.data.id));

  // Record a validation entry for audit trail
  if (mission.status === "pending_dmg") {
    await db.insert(missionValidationsTable).values({
      missionId: mission.id,
      validatorUserId: req.userId!,
      validatorRole: "dmg",
      action: "approve",
      comment: parsed.data.vehicleDetails
        ? `Véhicules affectés : ${parsed.data.vehicleDetails}`
        : "Véhicules affectés",
      fromStatus,
      toStatus,
    });
  }

  const detail = await getMissionWithDetails(params.data.id, req.userId!, req.userRole!, req.userDepartmentId);
  res.json(detail);
});

router.post("/missions/:id/generate-order", requireAuth, async (req, res): Promise<void> => {
  const params = GenerateMissionOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  if (req.userRole !== "cad" && req.userRole !== "admin") {
    res.status(403).json({ error: "Seul le CAD peut générer l'ordre de mission" });
    return;
  }

  const [mission] = await db.select().from(missionsTable).where(eq(missionsTable.id, params.data.id));
  if (!mission) {
    res.status(404).json({ error: "Mission non trouvée" });
    return;
  }

  if (mission.status !== "pending_cad" && mission.status !== "pending_financial_control" && mission.status !== "pending_drh" && mission.status !== "approved") {
    res.status(400).json({ error: "La mission doit être validée par le DGA avant de générer l'ordre" });
    return;
  }

  const orderNumber = `OM-${new Date().getFullYear()}-${String(mission.id).padStart(4, "0")}`;

  await db.update(missionsTable)
    .set({
      orderNumber,
      orderGeneratedAt: new Date(),
      orderGeneratedByUserId: req.userId,
    })
    .where(eq(missionsTable.id, params.data.id));

  const result = await buildMissionOrder(params.data.id, req.userId!);
  res.json(result);
});

router.get("/missions/:id/order", requireAuth, async (req, res): Promise<void> => {
  const params = GetMissionOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [mission] = await db.select().from(missionsTable).where(eq(missionsTable.id, params.data.id));
  if (!mission || !mission.orderNumber) {
    res.status(404).json({ error: "Ordre de mission non trouvé" });
    return;
  }

  const result = await buildMissionOrder(params.data.id, mission.orderGeneratedByUserId ?? req.userId!);
  res.json(result);
});

async function buildMissionOrder(missionId: number, generatedByUserId: number) {
  const [mission] = await db.select().from(missionsTable).where(eq(missionsTable.id, missionId));
  const [dept] = mission.departmentId
    ? await db.select({ name: departmentsTable.name }).from(departmentsTable).where(eq(departmentsTable.id, mission.departmentId))
    : [null];
  const [generatorUser] = await db.select({ fullName: usersTable.fullName }).from(usersTable).where(eq(usersTable.id, generatedByUserId));

  const missionEmps = await db.select().from(missionEmployeesTable).where(eq(missionEmployeesTable.missionId, missionId));
  const empIds = missionEmps.map(me => me.employeeId);
  const employees = empIds.length > 0 ? await db.select().from(employeesTable).where(inArray(employeesTable.id, empIds)) : [];

  const durationDays = calcDurationDays(mission.startDate, mission.endDate);
  let totalFees = 0;
  const employeesWithFees = employees.map(e => {
    const fees = calculateFees(e.category as EmployeeCategory, durationDays);
    totalFees += fees.totalFee;
    return {
      employeeId: e.id,
      fullName: `${e.firstName} ${e.lastName}`,
      matricule: e.matricule,
      nni: e.nni,
      position: e.position,
      category: e.category,
      ...fees,
      durationDays,
    };
  });

  const paidAmount = Math.round(totalFees * 0.70 * 100) / 100;
  const remainingAmount = Math.round((totalFees - paidAmount) * 100) / 100;

  return {
    id: missionId,
    missionId,
    orderNumber: mission.orderNumber ?? `OM-${new Date().getFullYear()}-${String(missionId).padStart(4, "0")}`,
    missionTitle: mission.title,
    departmentName: dept?.name ?? null,
    destination: mission.destination,
    startDate: mission.startDate,
    endDate: mission.endDate,
    durationDays,
    requiresFuel: mission.requiresFuel,
    requiresVehicle: mission.requiresVehicle,
    vehicleCount: mission.vehicleCount,
    vehicleDetails: mission.vehicleDetails ?? null,
    employees: employeesWithFees,
    totalFees,
    paidAmount,
    remainingAmount,
    generatedAt: mission.orderGeneratedAt?.toISOString() ?? new Date().toISOString(),
    generatedByName: generatorUser?.fullName ?? "Inconnu",
  };
}

router.get("/missions/:id/employees", requireAuth, async (req, res): Promise<void> => {
  const params = GetMissionEmployeesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [mission] = await db.select().from(missionsTable).where(eq(missionsTable.id, params.data.id));
  if (!mission) {
    res.status(404).json({ error: "Mission non trouvée" });
    return;
  }

  const missionEmps = await db.select().from(missionEmployeesTable).where(eq(missionEmployeesTable.missionId, params.data.id));
  const empIds = missionEmps.map(me => me.employeeId);
  const employees = empIds.length > 0 ? await db.select().from(employeesTable).where(inArray(employeesTable.id, empIds)) : [];

  const durationDays = calcDurationDays(mission.startDate, mission.endDate);

  const result = employees.map(e => {
    const fees = calculateFees(e.category as EmployeeCategory, durationDays);
    return {
      employeeId: e.id,
      fullName: `${e.firstName} ${e.lastName}`,
      matricule: e.matricule,
      nni: e.nni ?? null,
      position: e.position,
      category: e.category,
      ...fees,
      durationDays,
    };
  });

  res.json(result);
});

router.get("/missions/:id/validations", requireAuth, async (req, res): Promise<void> => {
  const params = GetMissionValidationsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const validations = await db
    .select()
    .from(missionValidationsTable)
    .where(eq(missionValidationsTable.missionId, params.data.id))
    .orderBy(missionValidationsTable.createdAt);

  const userIds = [...new Set(validations.map(v => v.validatorUserId))];
  const users = userIds.length > 0
    ? await db.select({ id: usersTable.id, fullName: usersTable.fullName }).from(usersTable).where(inArray(usersTable.id, userIds))
    : [];
  const userMap = new Map(users.map(u => [u.id, u.fullName]));

  res.json(validations.map(v => ({
    ...v,
    validatorName: userMap.get(v.validatorUserId) ?? "Inconnu",
  })));
});

export default router;
