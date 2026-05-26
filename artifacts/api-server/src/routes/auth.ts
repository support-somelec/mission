import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, departmentsTable } from "@workspace/db";
import { LoginBody, RegisterBody, ChangePasswordBody } from "@workspace/api-zod";
import { hashPassword, verifyPassword } from "../lib/auth";
import { requireAuth } from "../middlewares/session";

const router: IRouter = Router();

export const DEFAULT_PASSWORD = "Somelec@2024";

async function buildUserResponse(user: typeof usersTable.$inferSelect) {
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

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { username, password } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username));

  if (!user || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: "Identifiants incorrects" });
    return;
  }

  if (user.status === "pending") {
    res.status(403).json({
      error:
        "Votre compte est en attente d'activation. Un administrateur doit vous affecter à votre direction avant que vous puissiez vous connecter.",
    });
    return;
  }

  (req.session as { userId?: number }).userId = user.id;

  const safeUser = await buildUserResponse(user);
  res.json({
    user: safeUser,
    message: "Connexion réussie",
  });
});

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { username, fullName, email } = parsed.data;

  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.username, username));

  if (existing) {
    res.status(400).json({ error: "Ce nom d'utilisateur est déjà pris" });
    return;
  }

  await db.insert(usersTable).values({
    username,
    fullName,
    email: email ?? null,
    passwordHash: hashPassword(DEFAULT_PASSWORD),
    role: "employee",
    status: "pending",
    mustChangePassword: true,
  });

  res.status(201).json({
    success: true,
    message:
      "Compte créé avec succès. Veuillez patienter qu'un administrateur vous affecte à votre direction pour pouvoir vous connecter.",
  });
});

router.post(
  "/auth/change-password",
  requireAuth,
  async (req, res): Promise<void> => {
    const parsed = ChangePasswordBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { currentPassword, newPassword } = parsed.data;

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, req.userId!));

    if (!user || !verifyPassword(currentPassword, user.passwordHash)) {
      res.status(400).json({ error: "Mot de passe actuel incorrect" });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({
        error: "Le nouveau mot de passe doit contenir au moins 6 caractères",
      });
      return;
    }

    await db
      .update(usersTable)
      .set({ passwordHash: hashPassword(newPassword), mustChangePassword: false })
      .where(eq(usersTable.id, req.userId!));

    res.json({ success: true, message: "Mot de passe modifié avec succès" });
  }
);

router.post("/auth/logout", (req, res): void => {
  req.session.destroy(() => {
    res.json({ success: true, message: "Déconnexion réussie" });
  });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.userId!));

  if (!user) {
    res.status(404).json({ error: "Utilisateur non trouvé" });
    return;
  }

  const safeUser = await buildUserResponse(user);
  res.json(safeUser);
});

export default router;
