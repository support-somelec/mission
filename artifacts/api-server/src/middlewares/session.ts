import { RequestHandler } from "express";
import { db, usersTable, departmentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

declare global {
  namespace Express {
    interface Request {
      userId?: number;
      userRole?: string;
      userDepartmentId?: number | null;
    }
  }
}

declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

export const requireAuth: RequestHandler = async (req, res, next): Promise<void> => {
  const sessionUserId = (req.session as { userId?: number }).userId;
  if (!sessionUserId) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, sessionUserId));

  if (!user) {
    res.status(401).json({ error: "Utilisateur non trouvé" });
    return;
  }

  req.userId = user.id;
  req.userRole = user.role;
  req.userDepartmentId = user.departmentId;
  next();
};

export const requireAdmin: RequestHandler = async (req, res, next): Promise<void> => {
  if (req.userRole !== "admin") {
    res.status(403).json({ error: "Accès refusé" });
    return;
  }
  next();
};
