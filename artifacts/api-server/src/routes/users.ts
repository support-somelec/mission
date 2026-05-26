import { Router, type IRouter } from "express";
import { eq, ilike, sql, and, inArray } from "drizzle-orm";
import { db, usersTable, departmentsTable } from "@workspace/db";
import {
  CreateUserBody,
  UpdateUserBody,
  GetUserParams,
  UpdateUserParams,
  DeleteUserParams,
  ListUsersQueryParams,
  ResetUserPasswordParams,
} from "@workspace/api-zod";
import { requireAuth, requireAdmin } from "../middlewares/session";
import { hashPassword } from "../lib/auth";
import { DEFAULT_PASSWORD } from "./auth";

const router: IRouter = Router();

async function enrichUser(user: typeof usersTable.$inferSelect) {
  let departmentName: string | null = null;
  if (user.departmentId) {
    const [dept] = await db
      .select({ name: departmentsTable.name })
      .from(departmentsTable)
      .where(eq(departmentsTable.id, user.departmentId));
    departmentName = dept?.name ?? null;
  }
  const { passwordHash: _ph, ...safeUser } = user;
  return { ...safeUser, departmentName };
}

router.get("/users", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const parsed = ListUsersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { page = 1, limit = 20, search, departmentId, role } = parsed.data;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (search) {
    conditions.push(
      sql`(${ilike(usersTable.fullName, `%${search}%`)} OR ${ilike(usersTable.username, `%${search}%`)})`
    );
  }
  if (departmentId) {
    conditions.push(eq(usersTable.departmentId, departmentId));
  }
  if (role) {
    conditions.push(eq(usersTable.role, role as "admin" | "employee" | "director" | "central_director" | "technical_control" | "dga" | "dmg" | "cad_edition" | "cad_payment" | "financial_control"));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(usersTable)
    .where(whereClause);

  const users = await db
    .select()
    .from(usersTable)
    .where(whereClause)
    .limit(limit)
    .offset(offset)
    .orderBy(usersTable.fullName);

  const deptIds = [...new Set(users.filter(u => u.departmentId).map(u => u.departmentId!))];
  const depts = deptIds.length > 0
    ? await db.select({ id: departmentsTable.id, name: departmentsTable.name })
        .from(departmentsTable)
        .where(inArray(departmentsTable.id, deptIds))
    : [];
  const deptMap = new Map(depts.map(d => [d.id, d.name]));

  const total = countResult?.count ?? 0;
  const totalPages = Math.ceil(total / limit);

  res.json({
    data: users.map(u => {
      const { passwordHash: _ph, ...safeUser } = u;
      return {
        ...safeUser,
        departmentName: u.departmentId ? (deptMap.get(u.departmentId) ?? null) : null,
      };
    }),
    total,
    page,
    limit,
    totalPages,
  });
});

router.post("/users", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { password, ...rest } = parsed.data;
  const passwordHash = hashPassword(password);

  const [user] = await db
    .insert(usersTable)
    .values({ ...rest, passwordHash } as typeof usersTable.$inferInsert)
    .returning();

  const enriched = await enrichUser(user);
  res.status(201).json(enriched);
});

router.get("/users/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const params = GetUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, params.data.id));

  if (!user) {
    res.status(404).json({ error: "Utilisateur non trouvé" });
    return;
  }

  const enriched = await enrichUser(user);
  res.json(enriched);
});

router.patch("/users/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.fullName != null) updateData.fullName = parsed.data.fullName;
  if ("email" in parsed.data) updateData.email = parsed.data.email;
  if (parsed.data.role != null) updateData.role = parsed.data.role;
  if (parsed.data.status != null) updateData.status = parsed.data.status;
  if ("departmentId" in parsed.data) updateData.departmentId = parsed.data.departmentId;
  if ("employeeId" in parsed.data) updateData.employeeId = parsed.data.employeeId;
  if (parsed.data.password != null) updateData.passwordHash = hashPassword(parsed.data.password);

  const [user] = await db
    .update(usersTable)
    .set(updateData)
    .where(eq(usersTable.id, params.data.id))
    .returning();

  if (!user) {
    res.status(404).json({ error: "Utilisateur non trouvé" });
    return;
  }

  const enriched = await enrichUser(user);
  res.json(enriched);
});

router.delete("/users/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [user] = await db
    .delete(usersTable)
    .where(eq(usersTable.id, params.data.id))
    .returning();

  if (!user) {
    res.status(404).json({ error: "Utilisateur non trouvé" });
    return;
  }

  res.sendStatus(204);
});

router.post("/users/:id/reset-password", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const params = ResetUserPasswordParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [user] = await db
    .update(usersTable)
    .set({ passwordHash: hashPassword(DEFAULT_PASSWORD), mustChangePassword: true })
    .where(eq(usersTable.id, params.data.id))
    .returning({ id: usersTable.id });

  if (!user) {
    res.status(404).json({ error: "Utilisateur non trouvé" });
    return;
  }

  res.json({ success: true, message: `Mot de passe réinitialisé à la valeur par défaut (${DEFAULT_PASSWORD})` });
});

export default router;
