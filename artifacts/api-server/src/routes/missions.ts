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
  GetMissionPaymentReceiptParams,
  GetMissionEmployeesParams,
  GetMissionValidationsParams,
  AddMissionEmployeeParams,
  AddMissionEmployeeBody,
  RemoveMissionEmployeeParams,
} from "@workspace/api-zod";
import { requireAuth, requireAdmin } from "../middlewares/session";
import {
  canUserValidate,
  getInitialStatus,
  getNextStatus,
  type MissionStatus,
  type UserRole,
} from "../lib/mission-workflow";
import { calculateFees, calcDurationDays, type EmployeeCategory } from "../lib/fees";

const router: IRouter = Router();

// Transversal roles see ALL missions across departments
const TRANSVERSAL_ROLES = [
  "technical_control",
  "dga",
  "dmg",
  "cad_edition",
  "cad_payment",
  "financial_control",
  "admin",
];

/** Renvoie true si l'utilisateur est autorisé à consulter cette mission */
async function canUserSeeMission(
  mission: { departmentId: number | null; createdByUserId: number },
  userId: number,
  userRole: string,
  userDepartmentId: number | null | undefined,
): Promise<boolean> {
  if (TRANSVERSAL_ROLES.includes(userRole)) return true;

  if (userRole === "central_director" && userDepartmentId) {
    if (mission.departmentId === userDepartmentId) return true;
    if (!mission.departmentId) return false;
    // Vérifie que le département de la mission est un enfant direct du département du directeur central
    const [child] = await db
      .select({ id: departmentsTable.id })
      .from(departmentsTable)
      .where(
        sql`${departmentsTable.id} = ${mission.departmentId} AND ${departmentsTable.parentId} = ${userDepartmentId}`
      );
    return !!child;
  }

  if (userRole === "director" && userDepartmentId) {
    return mission.departmentId === userDepartmentId;
  }

  // employee ou directeur sans département : uniquement ses propres missions
  return mission.createdByUserId === userId;
}

async function getMissionWithDetails(id: number, userId: number, userRole: string, userDepartmentId: number | null | undefined) {
  const [mission] = await db.select().from(missionsTable).where(eq(missionsTable.id, id));
  if (!mission) return null;

  const allowed = await canUserSeeMission(mission, userId, userRole, userDepartmentId);
  if (!allowed) return "forbidden" as const;

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
      fullName: [e.firstName, e.lastName].filter(Boolean).join(" "),
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

  // Visibility rules by role:
  // - transversal roles (dmg, cad, etc.): see all missions
  // - central_director: sees missions from their dept + all child depts
  // - director: sees all missions where departmentId = their dept
  // - employee: sees only their own missions
  if (!TRANSVERSAL_ROLES.includes(userRole)) {
    if (userRole === "central_director" && userDeptId) {
      const childDepts = await db
        .select({ id: departmentsTable.id })
        .from(departmentsTable)
        .where(eq(departmentsTable.parentId, userDeptId));
      const visibleDeptIds = [userDeptId, ...childDepts.map(d => d.id)];
      conditions.push(inArray(missionsTable.departmentId, visibleDeptIds));
    } else if (userRole === "director" && userDeptId) {
      conditions.push(eq(missionsTable.departmentId, userDeptId));
    } else {
      // employee or no dept: only own missions
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
          fullName: [e.firstName, e.lastName].filter(Boolean).join(" "),
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

// Vérifie si un ou plusieurs employés ont déjà une mission chevauchante (hors draft/rejected)
async function checkEmployeeOverlap(
  employeeIds: number[],
  startDate: string,
  endDate: string,
  excludeMissionId?: number
): Promise<{ conflicting: { employeeId: number; fullName: string; missionId: number; missionTitle: string }[] }> {
  if (employeeIds.length === 0) return { conflicting: [] };

  // Trouver toutes les missions actives auxquelles ces employés participent
  const assignments = await db
    .select({
      employeeId: missionEmployeesTable.employeeId,
      missionId: missionEmployeesTable.missionId,
    })
    .from(missionEmployeesTable)
    .where(inArray(missionEmployeesTable.employeeId, employeeIds));

  const missionIds = [...new Set(assignments.map((a) => a.missionId))].filter(
    (mid) => mid !== excludeMissionId
  );
  if (missionIds.length === 0) return { conflicting: [] };

  // Filtrer les missions qui chevauchent la période et ne sont pas draft/rejected
  const overlapping = await db
    .select({
      id: missionsTable.id,
      title: missionsTable.title,
      startDate: missionsTable.startDate,
      endDate: missionsTable.endDate,
      status: missionsTable.status,
    })
    .from(missionsTable)
    .where(
      and(
        inArray(missionsTable.id, missionIds),
        sql`${missionsTable.status} NOT IN ('draft', 'rejected')`,
        sql`${missionsTable.startDate} <= ${endDate}`,
        sql`${missionsTable.endDate} >= ${startDate}`
      )
    );

  if (overlapping.length === 0) return { conflicting: [] };

  const overlappingIds = new Set(overlapping.map((m) => m.id));
  const overlappingMissionMap = new Map(overlapping.map((m) => [m.id, m]));

  // Associer les employés aux missions en conflit
  const conflictingAssignments = assignments.filter(
    (a) => overlappingIds.has(a.missionId)
  );

  const conflictEmpIds = [...new Set(conflictingAssignments.map((a) => a.employeeId))];
  const conflictEmployees =
    conflictEmpIds.length > 0
      ? await db
          .select({ id: employeesTable.id, firstName: employeesTable.firstName, lastName: employeesTable.lastName })
          .from(employeesTable)
          .where(inArray(employeesTable.id, conflictEmpIds))
      : [];
  const empMap = new Map(conflictEmployees.map((e) => [e.id, [e.firstName, e.lastName].filter(Boolean).join(" ")]));

  const conflicting = conflictingAssignments.map((a) => ({
    employeeId: a.employeeId,
    fullName: empMap.get(a.employeeId) ?? `ID ${a.employeeId}`,
    missionId: a.missionId,
    missionTitle: overlappingMissionMap.get(a.missionId)?.title ?? "",
  }));

  return { conflicting };
}

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

  // Règle 1 : la date de début ne peut pas être dans le passé
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(missionData.startDate);
  if (start < today) {
    res.status(400).json({ error: "La date de début ne peut pas être dans le passé. Veuillez choisir une date à partir d'aujourd'hui." });
    return;
  }

  // Règle 2 : aucun missionnaire ne peut être en mission sur le même intervalle
  if (employeeIds && employeeIds.length > 0) {
    const { conflicting } = await checkEmployeeOverlap(employeeIds, missionData.startDate, missionData.endDate);
    if (conflicting.length > 0) {
      const lines = conflicting.map(
        (c) => `${c.fullName} (Mission #${c.missionId} — ${c.missionTitle})`
      );
      const unique = [...new Set(lines)];
      res.status(400).json({
        error: `Conflit de mission détecté :\n${unique.join("\n")}\n\nCes missionnaires sont déjà affectés à une mission sur la même période. Veuillez modifier les dates ou retirer ces employés.`,
      });
      return;
    }
  }

  let initialStatus = getInitialStatus(userRole);

  // Si le créateur est directeur d'une direction simple (sans parent direction centrale),
  // on saute l'étape pending_central_director.
  if (userRole === "director" && initialStatus === "pending_central_director") {
    const hasCentral = await hasCentralDirectionParent(userDeptId ?? null);
    if (!hasCentral) {
      initialStatus = "pending_technical_control";
    }
  }

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
  if (!detail || detail === "forbidden") {
    res.status(500).json({ error: "Erreur lors de la récupération de la mission créée" });
    return;
  }
  res.status(201).json(detail);
});

router.get("/missions/export", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const STATUS_FR: Record<string, string> = {
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
  const CATEGORY_FR: Record<string, string> = {
    dg_dga: "DG/DGA",
    director: "Directeur",
    chef_department: "Chef Dépt/Service",
    other_cadre: "Autre Cadre",
    agent: "Agent",
  };

  const missions = await db
    .select({
      id: missionsTable.id,
      orderNumber: missionsTable.orderNumber,
      title: missionsTable.title,
      status: missionsTable.status,
      startDate: missionsTable.startDate,
      endDate: missionsTable.endDate,
      destination: missionsTable.destination,
      requiresVehicle: missionsTable.requiresVehicle,
      vehicleCount: missionsTable.vehicleCount,
      vehicleDetails: missionsTable.vehicleDetails,
      requiresFuel: missionsTable.requiresFuel,
      createdAt: missionsTable.createdAt,
      departmentId: missionsTable.departmentId,
      createdByUserId: missionsTable.createdByUserId,
    })
    .from(missionsTable)
    .orderBy(missionsTable.createdAt);

  const deptIds = [...new Set(missions.map((m) => m.departmentId).filter((x): x is number => x != null))];
  const deptMap = new Map<number, string>();
  if (deptIds.length > 0) {
    const depts = await db.select({ id: departmentsTable.id, name: departmentsTable.name }).from(departmentsTable).where(inArray(departmentsTable.id, deptIds));
    for (const d of depts) deptMap.set(d.id, d.name);
  }

  const creatorIds = [...new Set(missions.map((m) => m.createdByUserId).filter((x): x is number => x != null))];
  const creatorMap = new Map<number, string>();
  if (creatorIds.length > 0) {
    const users = await db.select({ id: usersTable.id, fullName: usersTable.fullName }).from(usersTable).where(inArray(usersTable.id, creatorIds));
    for (const u of users) creatorMap.set(u.id, u.fullName);
  }

  const missionIds = missions.map((m) => m.id);
  const allEmps = missionIds.length > 0
    ? await db
        .select({
          missionId: missionEmployeesTable.missionId,
          matricule: employeesTable.matricule,
          firstName: employeesTable.firstName,
          lastName: employeesTable.lastName,
          position: employeesTable.position,
          category: employeesTable.category,
        })
        .from(missionEmployeesTable)
        .innerJoin(employeesTable, eq(missionEmployeesTable.employeeId, employeesTable.id))
        .where(inArray(missionEmployeesTable.missionId, missionIds))
    : [];

  const empsByMission = new Map<number, typeof allEmps>();
  for (const emp of allEmps) {
    if (!empsByMission.has(emp.missionId)) empsByMission.set(emp.missionId, []);
    empsByMission.get(emp.missionId)!.push(emp);
  }

  const esc = (v: unknown): string => {
    const s = v == null ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const headers = [
    "ID Mission", "N° Ordre de Mission", "Titre", "Statut",
    "Département", "Créé par", "Date Début", "Date Fin", "Durée (jours)", "Destination",
    "Véhicule requis", "Nb Véhicules", "Détails véhicules", "Carburant requis",
    "Frais total mission (MRU)",
    "Employé - Matricule", "Employé - Nom", "Employé - Poste", "Employé - Catégorie",
    "Taux journalier (MRU)", "Frais employé (MRU)", "Part CAD 70% (MRU)", "Part DRH 30% (MRU)",
    "Date de création",
  ];

  const rows: string[] = [headers.map(esc).join(",")];

  for (const m of missions) {
    const duration = calcDurationDays(m.startDate, m.endDate);
    const dept = deptMap.get(m.departmentId ?? 0) ?? "";
    const creator = creatorMap.get(m.createdByUserId ?? 0) ?? "";
    const emps = empsByMission.get(m.id) ?? [];
    const totalFees = emps.reduce((sum, e) => sum + calculateFees(e.category as EmployeeCategory, duration).totalFee, 0);
    const createdDate = m.createdAt ? new Date(m.createdAt).toISOString().split("T")[0] : "";

    const base = [
      m.id, m.orderNumber ?? "", m.title,
      STATUS_FR[m.status] ?? m.status,
      dept, creator,
      m.startDate, m.endDate, duration, m.destination,
      m.requiresVehicle ? "Oui" : "Non",
      m.vehicleCount ?? 0,
      m.vehicleDetails ?? "",
      m.requiresFuel ? "Oui" : "Non",
      totalFees,
    ];

    if (emps.length === 0) {
      rows.push([...base, "", "", "", "", "", "", "", "", createdDate].map(esc).join(","));
    } else {
      for (const emp of emps) {
        const fees = calculateFees(emp.category as EmployeeCategory, duration);
        rows.push([
          ...base,
          emp.matricule,
          [emp.firstName, emp.lastName].filter(Boolean).join(" "),
          emp.position,
          CATEGORY_FR[emp.category] ?? emp.category,
          fees.dailyRate, fees.totalFee, fees.paidAmount, fees.remainingAmount,
          createdDate,
        ].map(esc).join(","));
      }
    }
  }

  const csv = "\uFEFF" + rows.join("\r\n");
  const filename = `missions-somelec-${new Date().toISOString().split("T")[0]}.csv`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
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
  if (detail === "forbidden") {
    res.status(403).json({ error: "Accès refusé à cette mission" });
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

  const EDITABLE_STATUSES = ["draft", "pending_director", "pending_central_director"];
  if (!EDITABLE_STATUSES.includes(existing.status) && req.userRole !== "admin") {
    res.status(403).json({ error: "La mission ne peut plus être modifiée après validation du Directeur Central" });
    return;
  }

  {
    const userId = req.userId!;
    const userRole = req.userRole!;
    const userDeptId = req.userDepartmentId;
    let canEdit = userRole === "admin" || existing.createdByUserId === userId;

    if (!canEdit && userRole === "director" && existing.departmentId === userDeptId) {
      canEdit = true;
    }
    if (!canEdit && userRole === "central_director" && userDeptId) {
      if (existing.departmentId === userDeptId) {
        canEdit = true;
      } else if (existing.departmentId) {
        const [missionDept] = await db
          .select({ parentId: departmentsTable.parentId })
          .from(departmentsTable)
          .where(eq(departmentsTable.id, existing.departmentId));
        if (missionDept?.parentId === userDeptId) canEdit = true;
      }
    }

    if (!canEdit) {
      res.status(403).json({ error: "Vous n'êtes pas autorisé à modifier cette mission" });
      return;
    }
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
  if (!detail || detail === "forbidden") {
    res.status(detail === "forbidden" ? 403 : 404).json({ error: detail === "forbidden" ? "Accès refusé" : "Mission non trouvée" });
    return;
  }
  res.json(detail);
});

router.delete("/missions/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteMissionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  if (req.userRole !== "admin") {
    res.status(403).json({ error: "Seul l'administrateur peut supprimer une mission" });
    return;
  }

  const [existing] = await db.select().from(missionsTable).where(eq(missionsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Mission non trouvée" });
    return;
  }

  await db.delete(missionEmployeesTable).where(eq(missionEmployeesTable.missionId, params.data.id));
  await db.delete(missionValidationsTable).where(eq(missionValidationsTable.missionId, params.data.id));
  await db.delete(missionsTable).where(eq(missionsTable.id, params.data.id));

  res.sendStatus(204);
});

/**
 * Vérifie si un département a un parent de type "central_direction".
 * Utilisé pour décider si on passe par pending_central_director ou pas.
 */
async function hasCentralDirectionParent(departmentId: number | null | undefined): Promise<boolean> {
  if (!departmentId) return false;
  const [dept] = await db
    .select({ parentId: departmentsTable.parentId })
    .from(departmentsTable)
    .where(eq(departmentsTable.id, departmentId));
  if (!dept?.parentId) return false;
  const [parent] = await db
    .select({ type: departmentsTable.type })
    .from(departmentsTable)
    .where(eq(departmentsTable.id, dept.parentId));
  return parent?.type === "central_direction";
}

router.post("/missions/:id/force-advance", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const params = GetMissionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [mission] = await db.select().from(missionsTable).where(eq(missionsTable.id, params.data.id));
  if (!mission) {
    res.status(404).json({ error: "Mission non trouvée" });
    return;
  }

  const terminal: MissionStatus[] = ["approved", "rejected"];
  if (terminal.includes(mission.status as MissionStatus)) {
    res.status(400).json({ error: "Cette mission est déjà dans un état terminal." });
    return;
  }

  const fromStatus = mission.status;
  const toStatus = getNextStatus(mission.status as MissionStatus);

  await db.insert(missionValidationsTable).values({
    missionId: mission.id,
    validatorUserId: req.userId!,
    validatorRole: "admin" as UserRole,
    action: "approve",
    comment: "Avancement forcé par l'administrateur",
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

  const detail = await getMissionWithDetails(mission.id, req.userId!, "admin", req.userDepartmentId);
  if (!detail || detail === "forbidden") {
    res.status(500).json({ error: "Erreur lors de la récupération de la mission" });
    return;
  }
  res.json(detail);
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

  const fromStatus = mission.status;
  let toStatus: MissionStatus = parsed.data.action === "approve"
    ? getNextStatus(mission.status as MissionStatus)
    : "rejected";

  // Si le directeur approuve et que le département de la mission n'a pas de
  // direction centrale parente, on saute l'étape pending_central_director.
  if (
    parsed.data.action === "approve" &&
    fromStatus === "pending_director" &&
    toStatus === "pending_central_director"
  ) {
    const hasCentral = await hasCentralDirectionParent(mission.departmentId);
    if (!hasCentral) {
      toStatus = "pending_technical_control";
    }
  }

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
  if (!detail || detail === "forbidden") {
    res.status(detail === "forbidden" ? 403 : 404).json({ error: detail === "forbidden" ? "Accès refusé" : "Mission non trouvée" });
    return;
  }
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
  const toStatus: MissionStatus = mission.status === "pending_dmg"
    ? getNextStatus("pending_dmg")
    : (mission.status as MissionStatus);

  await db.update(missionsTable)
    .set({
      vehicleDetails: parsed.data.vehicleDetails ?? null,
      vehicleCount: parsed.data.vehicleCount,
      status: toStatus,
      currentValidationRole: toStatus === "en_vigueur" ? "cad_edition" : null,
    })
    .where(eq(missionsTable.id, params.data.id));

  if (mission.status === "pending_dmg") {
    await db.insert(missionValidationsTable).values({
      missionId: mission.id,
      validatorUserId: req.userId!,
      validatorRole: "dmg",
      action: "approve",
      comment: parsed.data.vehicleDetails
        ? `Véhicules affectés : ${parsed.data.vehicleDetails}`
        : "Mission validée sans véhicule",
      fromStatus,
      toStatus,
    });
  }

  const detail = await getMissionWithDetails(params.data.id, req.userId!, req.userRole!, req.userDepartmentId);
  if (!detail || detail === "forbidden") {
    res.status(detail === "forbidden" ? 403 : 404).json({ error: detail === "forbidden" ? "Accès refusé" : "Mission non trouvée" });
    return;
  }
  res.json(detail);
});

router.post("/missions/:id/generate-order", requireAuth, async (req, res): Promise<void> => {
  const params = GenerateMissionOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  if (req.userRole !== "cad_edition" && req.userRole !== "admin") {
    res.status(403).json({ error: "Seul le CAD Édition peut générer l'ordre de mission" });
    return;
  }

  const [mission] = await db.select().from(missionsTable).where(eq(missionsTable.id, params.data.id));
  if (!mission) {
    res.status(404).json({ error: "Mission non trouvée" });
    return;
  }

  if (mission.status !== "en_vigueur" && mission.status !== "pending_cad_payment" && mission.status !== "pending_financial_control" && mission.status !== "approved") {
    res.status(400).json({ error: "La mission doit être en vigueur (validée par le DMG) avant de générer l'ordre" });
    return;
  }

  const orderNumber = `OM-${new Date().getFullYear()}-${String(mission.id).padStart(4, "0")}`;
  const fromStatus = mission.status as MissionStatus;
  const toStatus: MissionStatus = mission.status === "en_vigueur" ? "pending_cad_payment" : (mission.status as MissionStatus);

  await db.update(missionsTable)
    .set({
      orderNumber,
      orderGeneratedAt: new Date(),
      orderGeneratedByUserId: req.userId,
      status: toStatus,
      currentValidationRole: toStatus === "pending_cad_payment" ? "cad_payment" : mission.currentValidationRole,
    })
    .where(eq(missionsTable.id, params.data.id));

  if (mission.status === "en_vigueur") {
    await db.insert(missionValidationsTable).values({
      missionId: mission.id,
      validatorUserId: req.userId!,
      validatorRole: "cad_edition",
      action: "approve",
      comment: `Ordre de mission généré : ${orderNumber}`,
      fromStatus,
      toStatus,
    });
  }

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
      fullName: [e.firstName, e.lastName].filter(Boolean).join(" "),
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

router.get("/missions/:id/payment-receipt", requireAuth, async (req, res): Promise<void> => {
  const params = GetMissionPaymentReceiptParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [mission] = await db.select().from(missionsTable).where(eq(missionsTable.id, params.data.id));
  if (!mission || !mission.orderNumber) {
    res.status(404).json({ error: "Ordre de mission non trouvé — le paiement n'a pas encore été effectué" });
    return;
  }

  // Get the cad_payment validation record (payment confirmation)
  const paymentValidations = await db
    .select()
    .from(missionValidationsTable)
    .where(
      and(
        eq(missionValidationsTable.missionId, params.data.id),
        eq(missionValidationsTable.validatorRole, "cad_payment"),
        eq(missionValidationsTable.action, "approve")
      )
    )
    .orderBy(missionValidationsTable.createdAt)
    .limit(1);

  if (paymentValidations.length === 0) {
    res.status(404).json({ error: "Aucune confirmation de paiement trouvée pour cette mission" });
    return;
  }

  const paymentValidation = paymentValidations[0];
  const [paymentUser] = await db
    .select({ fullName: usersTable.fullName })
    .from(usersTable)
    .where(eq(usersTable.id, paymentValidation.validatorUserId));

  const [dept] = mission.departmentId
    ? await db.select({ name: departmentsTable.name }).from(departmentsTable).where(eq(departmentsTable.id, mission.departmentId))
    : [null];

  const missionEmps = await db.select().from(missionEmployeesTable).where(eq(missionEmployeesTable.missionId, params.data.id));
  const empIds = missionEmps.map(me => me.employeeId);
  const employees = empIds.length > 0 ? await db.select().from(employeesTable).where(inArray(employeesTable.id, empIds)) : [];

  const durationDays = calcDurationDays(mission.startDate, mission.endDate);
  let totalFees = 0;
  const employeesWithFees = employees.map(e => {
    const fees = calculateFees(e.category as EmployeeCategory, durationDays);
    totalFees += fees.totalFee;
    return {
      employeeId: e.id,
      fullName: [e.firstName, e.lastName].filter(Boolean).join(" "),
      matricule: e.matricule,
      nni: e.nni ?? null,
      position: e.position,
      category: e.category,
      ...fees,
      durationDays,
    };
  });

  const paidAmount = Math.round(totalFees * 0.70 * 100) / 100;
  const remainingAmount = Math.round((totalFees - paidAmount) * 100) / 100;

  const receiptNumber = `REC-${new Date(paymentValidation.createdAt).getFullYear()}-${String(mission.id).padStart(4, "0")}`;

  res.json({
    missionId: mission.id,
    orderNumber: mission.orderNumber,
    receiptNumber,
    missionTitle: mission.title,
    departmentName: dept?.name ?? null,
    destination: mission.destination,
    startDate: mission.startDate,
    endDate: mission.endDate,
    durationDays,
    employees: employeesWithFees,
    totalFees,
    paidAmount,
    remainingAmount,
    paymentDate: paymentValidation.createdAt.toISOString(),
    paymentConfirmedByName: paymentUser?.fullName ?? "Inconnu",
    missionStatus: mission.status,
  });
});

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
      fullName: [e.firstName, e.lastName].filter(Boolean).join(" "),
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

router.post("/missions/:id/employees", requireAuth, async (req, res): Promise<void> => {
  const params = AddMissionEmployeeParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  if (req.userRole !== "dmg" && req.userRole !== "admin") {
    res.status(403).json({ error: "Seul le DMG peut modifier les employés d'une mission" });
    return;
  }

  const parsed = AddMissionEmployeeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [mission] = await db.select().from(missionsTable).where(eq(missionsTable.id, params.data.id));
  if (!mission) { res.status(404).json({ error: "Mission non trouvée" }); return; }

  if (mission.status !== "pending_dmg") {
    res.status(400).json({ error: "Les employés ne peuvent être modifiés qu'à l'étape DMG" });
    return;
  }

  const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, parsed.data.employeeId));
  if (!emp) { res.status(404).json({ error: "Employé non trouvé" }); return; }

  const existing = await db.select()
    .from(missionEmployeesTable)
    .where(and(eq(missionEmployeesTable.missionId, params.data.id), eq(missionEmployeesTable.employeeId, parsed.data.employeeId)));
  if (existing.length > 0) {
    res.status(400).json({ error: "Cet employé est déjà assigné à cette mission" });
    return;
  }

  // Règle : vérifier qu'il n'est pas déjà en mission sur le même intervalle
  const { conflicting } = await checkEmployeeOverlap(
    [parsed.data.employeeId],
    mission.startDate,
    mission.endDate,
    params.data.id  // exclure la mission courante
  );
  if (conflicting.length > 0) {
    res.status(400).json({
      error: [emp.firstName, emp.lastName].filter(Boolean).join(" ") + ` est déjà missionnaire sur cette période (Mission #${conflicting[0].missionId} — ${conflicting[0].missionTitle}).`,
    });
    return;
  }

  await db.insert(missionEmployeesTable).values({ missionId: params.data.id, employeeId: parsed.data.employeeId });

  const missionEmps = await db.select().from(missionEmployeesTable).where(eq(missionEmployeesTable.missionId, params.data.id));
  const empIds = missionEmps.map(me => me.employeeId);
  const employees = empIds.length > 0 ? await db.select().from(employeesTable).where(inArray(employeesTable.id, empIds)) : [];
  const durationDays = calcDurationDays(mission.startDate, mission.endDate);
  const result = employees.map(e => {
    const fees = calculateFees(e.category as EmployeeCategory, durationDays);
    return { employeeId: e.id, fullName: [e.firstName, e.lastName].filter(Boolean).join(" "), matricule: e.matricule, nni: e.nni ?? null, position: e.position, category: e.category, ...fees, durationDays };
  });

  res.json(result);
});

router.delete("/missions/:id/employees/:employeeId", requireAuth, async (req, res): Promise<void> => {
  const params = RemoveMissionEmployeeParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  if (req.userRole !== "dmg" && req.userRole !== "admin") {
    res.status(403).json({ error: "Seul le DMG peut modifier les employés d'une mission" });
    return;
  }

  const [mission] = await db.select().from(missionsTable).where(eq(missionsTable.id, params.data.id));
  if (!mission) { res.status(404).json({ error: "Mission non trouvée" }); return; }

  if (mission.status !== "pending_dmg") {
    res.status(400).json({ error: "Les employés ne peuvent être modifiés qu'à l'étape DMG" });
    return;
  }

  await db.delete(missionEmployeesTable)
    .where(and(eq(missionEmployeesTable.missionId, params.data.id), eq(missionEmployeesTable.employeeId, params.data.employeeId)));

  const missionEmps = await db.select().from(missionEmployeesTable).where(eq(missionEmployeesTable.missionId, params.data.id));
  const empIds = missionEmps.map(me => me.employeeId);
  const employees = empIds.length > 0 ? await db.select().from(employeesTable).where(inArray(employeesTable.id, empIds)) : [];
  const durationDays = calcDurationDays(mission.startDate, mission.endDate);
  const result = employees.map(e => {
    const fees = calculateFees(e.category as EmployeeCategory, durationDays);
    return { employeeId: e.id, fullName: [e.firstName, e.lastName].filter(Boolean).join(" "), matricule: e.matricule, nni: e.nni ?? null, position: e.position, category: e.category, ...fees, durationDays };
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
