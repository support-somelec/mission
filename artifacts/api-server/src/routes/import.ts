import { Router, type IRouter } from "express";
import { db, missionsTable, missionEmployeesTable, employeesTable } from "@workspace/db";
import { inArray, or } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/session";

const router: IRouter = Router();

const VALID_IMPORT_STATUSES = [
  "pending_central_director",
  "pending_technical_control",
  "pending_dga",
  "pending_dmg",
  "en_vigueur",
  "pending_cad_payment",
  "pending_financial_control",
] as const;

type ImportStatus = (typeof VALID_IMPORT_STATUSES)[number];

const STATUS_TO_ROLE: Record<ImportStatus, string> = {
  pending_central_director:   "central_director",
  pending_technical_control:  "technical_control",
  pending_dga:                "dga",
  pending_dmg:                "dmg",
  en_vigueur:                 "cad_edition",
  pending_cad_payment:        "cad_payment",
  pending_financial_control:  "financial_control",
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseBool(v: unknown): boolean {
  return v === true || v === "oui" || v === "true";
}

function parseNum(v: unknown): number {
  return Number(v) || 0;
}

function parseMatricules(v: unknown): string[] {
  if (Array.isArray(v)) return (v as string[]).map((s) => s.trim()).filter(Boolean);
  if (typeof v === "string") return v.split(";").map((s) => s.trim()).filter(Boolean);
  return [];
}

function validateRow(row: Record<string, unknown>): string[] {
  const errors: string[] = [];
  if (!row.titre || typeof row.titre !== "string" || !row.titre.trim()) errors.push("titre manquant");
  if (!row.expression_besoins || typeof row.expression_besoins !== "string" || !row.expression_besoins.trim())
    errors.push("expression_besoins manquant");
  if (!row.plan_action || typeof row.plan_action !== "string" || !row.plan_action.trim())
    errors.push("plan_action manquant");
  if (!row.date_debut || !DATE_RE.test(String(row.date_debut)))
    errors.push("date_debut invalide (AAAA-MM-JJ attendu)");
  if (!row.date_fin || !DATE_RE.test(String(row.date_fin)))
    errors.push("date_fin invalide (AAAA-MM-JJ attendu)");
  if (DATE_RE.test(String(row.date_debut)) && DATE_RE.test(String(row.date_fin)) && String(row.date_fin) < String(row.date_debut))
    errors.push("date_fin antérieure à date_debut");
  if (!row.destination || typeof row.destination !== "string" || !row.destination.trim())
    errors.push("destination manquante");
  if (!VALID_IMPORT_STATUSES.includes(String(row.statut) as ImportStatus))
    errors.push(`statut invalide : "${row.statut}"`);
  const mats = parseMatricules(row.matricules_employes);
  if (mats.length === 0) errors.push("matricules_employes manquant");
  return errors;
}

router.post("/admin/import/missions", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const rows: unknown[] = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: "Le corps de la requête doit être un tableau non vide" });
    return;
  }
  if (rows.length > 500) {
    res.status(400).json({ error: "Maximum 500 missions par import" });
    return;
  }

  const results: { row: number; status: "success" | "error"; missionId?: number; error?: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as Record<string, unknown>;
    const errors = validateRow(row);
    if (errors.length > 0) {
      results.push({ row: i + 1, status: "error", error: errors.join("; ") });
      continue;
    }

    const statut = String(row.statut) as ImportStatus;
    const matricules = parseMatricules(row.matricules_employes);

    try {
      // Look up employees by matricule OR NNI (each identifier tried against both fields)
      const employees = await db
        .select({ id: employeesTable.id, matricule: employeesTable.matricule, nni: employeesTable.nni })
        .from(employeesTable)
        .where(
          or(
            inArray(employeesTable.matricule, matricules),
            inArray(employeesTable.nni, matricules)
          )
        );

      // Match each identifier to a found employee (by matricule or NNI)
      const resolvedIds: number[] = [];
      const missing: string[] = [];
      for (const ident of matricules) {
        const found = employees.find((e) => e.matricule === ident || e.nni === ident);
        if (!found) {
          missing.push(ident);
        } else if (!resolvedIds.includes(found.id)) {
          resolvedIds.push(found.id);
        }
      }

      if (missing.length > 0) {
        results.push({ row: i + 1, status: "error", error: `Identifiant(s) introuvable(s) : ${missing.join(", ")}` });
        continue;
      }

      const employeeIds = resolvedIds;

      // Insert mission (bypass date & overlap validation — migration historique)
      const [mission] = await db.insert(missionsTable).values({
        title:                String(row.titre).trim(),
        needsExpression:      String(row.expression_besoins).trim(),
        actionPlan:           String(row.plan_action).trim(),
        startDate:            String(row.date_debut),
        endDate:              String(row.date_fin),
        destination:          String(row.destination).trim(),
        status:               statut,
        currentValidationRole: STATUS_TO_ROLE[statut],
        requiresFuel:         parseBool(row.carburant),
        requiresVehicle:      parseBool(row.vehicule),
        vehicleCount:         parseNum(row.nb_vehicules),
        createdByUserId:      req.userId!,
        departmentId:         null,
      }).returning({ id: missionsTable.id });

      // Insert employees
      await db.insert(missionEmployeesTable).values(
        employeeIds.map((eid) => ({ missionId: mission.id, employeeId: eid }))
      );

      results.push({ row: i + 1, status: "success", missionId: mission.id });
    } catch (err) {
      results.push({ row: i + 1, status: "error", error: String(err) });
    }
  }

  const successCount = results.filter((r) => r.status === "success").length;
  const errorCount   = results.filter((r) => r.status === "error").length;
  res.status(200).json({ successCount, errorCount, results });
});

export default router;
