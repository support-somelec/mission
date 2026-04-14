import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, departmentsTable } from "@workspace/db";
import { LoginBody } from "@workspace/api-zod";
import { hashPassword, verifyPassword } from "../lib/auth";
import { requireAuth } from "../middlewares/session";

const router: IRouter = Router();

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { username, password } = parsed.data;

  const [user] = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      passwordHash: usersTable.passwordHash,
      fullName: usersTable.fullName,
      email: usersTable.email,
      role: usersTable.role,
      departmentId: usersTable.departmentId,
      employeeId: usersTable.employeeId,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(eq(usersTable.username, username));

  if (!user || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: "Identifiants incorrects" });
    return;
  }

  let departmentName: string | null = null;
  if (user.departmentId) {
    const [dept] = await db
      .select({ name: departmentsTable.name })
      .from(departmentsTable)
      .where(eq(departmentsTable.id, user.departmentId));
    departmentName = dept?.name ?? null;
  }

  (req.session as { userId?: number }).userId = user.id;

  const { passwordHash: _ph, ...safeUser } = user;
  res.json({
    user: { ...safeUser, departmentName },
    message: "Connexion réussie",
  });
});

router.post("/auth/logout", (req, res): void => {
  req.session.destroy(() => {
    res.json({ success: true, message: "Déconnexion réussie" });
  });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      fullName: usersTable.fullName,
      email: usersTable.email,
      role: usersTable.role,
      departmentId: usersTable.departmentId,
      employeeId: usersTable.employeeId,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(eq(usersTable.id, req.userId!));

  if (!user) {
    res.status(404).json({ error: "Utilisateur non trouvé" });
    return;
  }

  let departmentName: string | null = null;
  if (user.departmentId) {
    const [dept] = await db
      .select({ name: departmentsTable.name })
      .from(departmentsTable)
      .where(eq(departmentsTable.id, user.departmentId));
    departmentName = dept?.name ?? null;
  }

  res.json({ ...user, departmentName });
});

export default router;
