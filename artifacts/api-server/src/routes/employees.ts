import { Router, type IRouter } from "express";
import { eq, ilike, sql, and, inArray } from "drizzle-orm";
import { db, employeesTable, departmentsTable } from "@workspace/db";
import {
  CreateEmployeeBody,
  UpdateEmployeeBody,
  GetEmployeeParams,
  UpdateEmployeeParams,
  DeleteEmployeeParams,
  ListEmployeesQueryParams,
} from "@workspace/api-zod";
import { requireAuth, requireAdmin } from "../middlewares/session";

const router: IRouter = Router();

async function enrichEmployee(emp: typeof employeesTable.$inferSelect) {
  let departmentName: string | null = null;
  if (emp.departmentId) {
    const [dept] = await db
      .select({ name: departmentsTable.name })
      .from(departmentsTable)
      .where(eq(departmentsTable.id, emp.departmentId));
    departmentName = dept?.name ?? null;
  }
  return {
    ...emp,
    fullName: `${emp.firstName} ${emp.lastName}`,
    departmentName,
  };
}

router.get("/employees", requireAuth, async (req, res): Promise<void> => {
  const parsed = ListEmployeesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { page = 1, limit = 20, search, departmentId, category } = parsed.data;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (search) {
    conditions.push(
      sql`(${ilike(employeesTable.firstName, `%${search}%`)} OR ${ilike(employeesTable.lastName, `%${search}%`)} OR ${ilike(employeesTable.matricule, `%${search}%`)})`
    );
  }
  if (departmentId) {
    conditions.push(eq(employeesTable.departmentId, departmentId));
  }
  if (category) {
    conditions.push(eq(employeesTable.category, category as "dg_dga" | "director" | "chef_department" | "other_cadre" | "agent"));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(employeesTable)
    .where(whereClause);

  const employees = await db
    .select()
    .from(employeesTable)
    .where(whereClause)
    .limit(limit)
    .offset(offset)
    .orderBy(employeesTable.lastName);

  const deptIds = [...new Set(employees.filter(e => e.departmentId).map(e => e.departmentId!))];
  const depts = deptIds.length > 0
    ? await db.select({ id: departmentsTable.id, name: departmentsTable.name })
        .from(departmentsTable)
        .where(inArray(departmentsTable.id, deptIds))
    : [];
  const deptMap = new Map(depts.map(d => [d.id, d.name]));

  const total = countResult?.count ?? 0;
  const totalPages = Math.ceil(total / limit);

  res.json({
    data: employees.map(e => ({
      ...e,
      fullName: `${e.firstName} ${e.lastName}`,
      departmentName: e.departmentId ? (deptMap.get(e.departmentId) ?? null) : null,
    })),
    total,
    page,
    limit,
    totalPages,
  });
});

router.post("/employees", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateEmployeeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [emp] = await db
    .insert(employeesTable)
    .values(parsed.data as { firstName: string; lastName: string; matricule: string; nni?: string | null; position: string; category: "dg_dga" | "director" | "chef_department" | "other_cadre" | "agent"; departmentId?: number | null })
    .returning();

  const enriched = await enrichEmployee(emp);
  res.status(201).json(enriched);
});

router.get("/employees/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetEmployeeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [emp] = await db
    .select()
    .from(employeesTable)
    .where(eq(employeesTable.id, params.data.id));

  if (!emp) {
    res.status(404).json({ error: "Employé non trouvé" });
    return;
  }

  const enriched = await enrichEmployee(emp);
  res.json(enriched);
});

router.patch("/employees/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateEmployeeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateEmployeeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.firstName != null) updateData.firstName = parsed.data.firstName;
  if (parsed.data.lastName != null) updateData.lastName = parsed.data.lastName;
  if (parsed.data.matricule != null) updateData.matricule = parsed.data.matricule;
  if ("nni" in parsed.data) updateData.nni = parsed.data.nni;
  if (parsed.data.position != null) updateData.position = parsed.data.position;
  if (parsed.data.category != null) updateData.category = parsed.data.category;
  if ("departmentId" in parsed.data) updateData.departmentId = parsed.data.departmentId;

  const [emp] = await db
    .update(employeesTable)
    .set(updateData)
    .where(eq(employeesTable.id, params.data.id))
    .returning();

  if (!emp) {
    res.status(404).json({ error: "Employé non trouvé" });
    return;
  }

  const enriched = await enrichEmployee(emp);
  res.json(enriched);
});

router.delete("/employees/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteEmployeeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [emp] = await db
    .delete(employeesTable)
    .where(eq(employeesTable.id, params.data.id))
    .returning();

  if (!emp) {
    res.status(404).json({ error: "Employé non trouvé" });
    return;
  }

  res.sendStatus(204);
});

export default router;
