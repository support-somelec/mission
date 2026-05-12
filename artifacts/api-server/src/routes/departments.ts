import { Router, type IRouter } from "express";
import { eq, ilike, sql, and, inArray } from "drizzle-orm";
import { db, departmentsTable, usersTable } from "@workspace/db";
import {
  CreateDepartmentBody,
  UpdateDepartmentBody,
  GetDepartmentParams,
  UpdateDepartmentParams,
  DeleteDepartmentParams,
  ListDepartmentsQueryParams,
} from "@workspace/api-zod";
import { requireAuth, requireAdmin } from "../middlewares/session";

const router: IRouter = Router();

router.get("/departments", requireAuth, async (req, res): Promise<void> => {
  const parsed = ListDepartmentsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { page = 1, limit = 20, search } = parsed.data;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (search) {
    conditions.push(ilike(departmentsTable.name, `%${search}%`));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(departmentsTable)
    .where(whereClause);

  const departments = await db
    .select()
    .from(departmentsTable)
    .where(whereClause)
    .limit(limit)
    .offset(offset)
    .orderBy(departmentsTable.name);

  const parentIds = departments.filter(d => d.parentId).map(d => d.parentId!);
  const parents = parentIds.length > 0
    ? await db.select({ id: departmentsTable.id, name: departmentsTable.name })
        .from(departmentsTable)
        .where(inArray(departmentsTable.id, parentIds))
    : [];

  const parentMap = new Map(parents.map(p => [p.id, p.name]));

  const userCounts = await db
    .select({ departmentId: usersTable.departmentId, count: sql<number>`count(*)::int` })
    .from(usersTable)
    .groupBy(usersTable.departmentId);

  const userCountMap = new Map(userCounts.map(u => [u.departmentId, u.count]));

  const total = countResult?.count ?? 0;
  const totalPages = Math.ceil(total / limit);

  res.json({
    data: departments.map(d => ({
      ...d,
      parentName: d.parentId ? (parentMap.get(d.parentId) ?? null) : null,
      userCount: userCountMap.get(d.id) ?? 0,
    })),
    total,
    page,
    limit,
    totalPages,
  });
});

router.post("/departments", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateDepartmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [dept] = await db
    .insert(departmentsTable)
    .values(parsed.data as { name: string; code: string; type: "direction" | "central_direction" | "service"; parentId?: number | null })
    .returning();

  res.status(201).json({ ...dept, parentName: null, userCount: 0 });
});

router.get("/departments/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetDepartmentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [dept] = await db
    .select()
    .from(departmentsTable)
    .where(eq(departmentsTable.id, params.data.id));

  if (!dept) {
    res.status(404).json({ error: "Direction non trouvée" });
    return;
  }

  let parentName: string | null = null;
  if (dept.parentId) {
    const [parent] = await db
      .select({ name: departmentsTable.name })
      .from(departmentsTable)
      .where(eq(departmentsTable.id, dept.parentId));
    parentName = parent?.name ?? null;
  }

  const [uc] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(usersTable)
    .where(eq(usersTable.departmentId, dept.id));

  res.json({ ...dept, parentName, userCount: uc?.count ?? 0 });
});

router.patch("/departments/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateDepartmentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateDepartmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.name != null) updateData.name = parsed.data.name;
  if (parsed.data.code != null) updateData.code = parsed.data.code;
  if (parsed.data.type != null) updateData.type = parsed.data.type;
  if ("parentId" in parsed.data) updateData.parentId = parsed.data.parentId;

  const [dept] = await db
    .update(departmentsTable)
    .set(updateData)
    .where(eq(departmentsTable.id, params.data.id))
    .returning();

  if (!dept) {
    res.status(404).json({ error: "Direction non trouvée" });
    return;
  }

  res.json({ ...dept, parentName: null, userCount: 0 });
});

router.delete("/departments/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteDepartmentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [dept] = await db
    .delete(departmentsTable)
    .where(eq(departmentsTable.id, params.data.id))
    .returning();

  if (!dept) {
    res.status(404).json({ error: "Direction non trouvée" });
    return;
  }

  res.sendStatus(204);
});

export default router;
