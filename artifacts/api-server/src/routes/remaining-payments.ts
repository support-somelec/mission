import { Router, type IRouter } from "express";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  db, missionsTable, employeesTable, missionEmployeesTable, usersTable,
  remainingPaymentExportsTable, remainingPaymentMissionsTable, type RemainingPaymentRow,
} from "@workspace/db";
import { CreateRemainingPaymentExportBody } from "@workspace/api-zod";
import { requireAuth, requireAdmin } from "../middlewares/session";
import { calcDurationDays, calculateFees } from "../lib/fees";
import { buildRemainingPaymentWorkbook, excelMime, summarizeRemainingPaymentExport } from "../lib/remaining-payments";

const router: IRouter = Router();
const base = "/admin/remaining-payments";
const approvedUnpaid = and(eq(missionsTable.status, "approved"), isNull(missionsTable.fullyPaidAt));

class SettlementConflict extends Error {}

type Mission = typeof missionsTable.$inferSelect;
type Employee = typeof employeesTable.$inferSelect;

function describeMission(mission: Mission, employees: Employee[]) {
  const [year, month] = mission.startDate.split("-").map(Number);
  const missionNumber = mission.orderNumber ?? String(mission.id);
  const rows: RemainingPaymentRow[] = employees.map(employee => {
    const fees = calculateFees(employee.category, calcDurationDays(mission.startDate, mission.endDate));
    return {
      missionId: mission.id, missionNumber, employeeId: employee.id,
      matricule: employee.matricule?.trim() || null, nni: employee.nni?.trim() || null,
      firstName: employee.firstName ?? "", lastName: employee.lastName,
      amount: fees.remainingAmount, totalFee: fees.totalFee, month, year,
    };
  });
  const ineligibilityReason = rows.length === 0
    ? "Aucun agent affecté à cette mission."
    : rows.some(row => !row.matricule && !row.nni)
      ? "Un agent ne possède ni matricule ni NNI. Complétez sa fiche avant l'extraction."
      : null;
  return {
    id: mission.id, missionNumber, title: mission.title, startDate: mission.startDate,
    month, year, rows, eligible: ineligibilityReason === null, ineligibilityReason,
    totalRemaining: Math.round(rows.reduce((sum, row) => sum + row.amount, 0) * 100) / 100,
  };
}

router.get(`${base}/eligible`, requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const missions = await db.select().from(missionsTable).where(approvedUnpaid).orderBy(asc(missionsTable.startDate), asc(missionsTable.id));
  if (!missions.length) { res.json([]); return; }
  const assignments = await db.select({ missionId: missionEmployeesTable.missionId, employee: employeesTable })
    .from(missionEmployeesTable)
    .innerJoin(employeesTable, eq(employeesTable.id, missionEmployeesTable.employeeId))
    .where(inArray(missionEmployeesTable.missionId, missions.map(mission => mission.id)));
  res.json(missions.map(mission => describeMission(mission,
    [...new Map(assignments.filter(a => a.missionId === mission.id).map(a => [a.employee.id, a.employee])).values()],
  )));
});

router.get(`${base}/exports`, requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const batches = await db.select({ batch: remainingPaymentExportsTable, name: usersTable.fullName })
    .from(remainingPaymentExportsTable)
    .leftJoin(usersTable, eq(usersTable.id, remainingPaymentExportsTable.createdByUserId))
    .orderBy(desc(remainingPaymentExportsTable.createdAt));
  res.json(batches.map(({ batch, name }) => summarizeRemainingPaymentExport(batch, name ?? "Administrateur")));
});

router.post(`${base}/exports`, requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateRemainingPaymentExportBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const ids = [...new Set(parsed.data.missionIds)].sort((a, b) => a - b);
  if (ids.length !== parsed.data.missionIds.length || ids.some(id => !Number.isInteger(id) || id <= 0)) {
    res.status(400).json({ error: "La sélection des missions est invalide." }); return;
  }
  try {
    const batch = await db.transaction(async tx => {
      // Serialize retries sharing an idempotency key, then lock missions in ID order.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${parsed.data.requestId}))`);
      const [previous] = await tx.select().from(remainingPaymentExportsTable)
        .where(eq(remainingPaymentExportsTable.requestId, parsed.data.requestId));
      if (previous) {
        const previousIds = [...new Set(previous.rows.map(row => row.missionId))].sort((a, b) => a - b);
        if (JSON.stringify(previousIds) !== JSON.stringify(ids)) throw new SettlementConflict("Cette demande a déjà été utilisée pour une autre sélection.");
        return previous;
      }
      const missions = await tx.select().from(missionsTable)
        .where(inArray(missionsTable.id, ids)).orderBy(asc(missionsTable.id)).for("update");
      if (missions.length !== ids.length || missions.some(mission => mission.status !== "approved" || mission.fullyPaidAt)) {
        throw new SettlementConflict("Une mission est déjà payée, supprimée ou pas totalement validée. Actualisez la liste.");
      }
      const alreadyPaid = await tx.select().from(remainingPaymentMissionsTable)
        .where(inArray(remainingPaymentMissionsTable.missionId, ids));
      if (alreadyPaid.length) throw new SettlementConflict("Une mission a déjà fait l'objet d'un règlement des 30 %.");
      const assignments = await tx.select({ missionId: missionEmployeesTable.missionId, employee: employeesTable })
        .from(missionEmployeesTable)
        .innerJoin(employeesTable, eq(employeesTable.id, missionEmployeesTable.employeeId))
        .where(inArray(missionEmployeesTable.missionId, ids));
      const rows: RemainingPaymentRow[] = [];
      for (const mission of missions) {
        const detail = describeMission(mission,
          [...new Map(assignments.filter(a => a.missionId === mission.id).map(a => [a.employee.id, a.employee])).values()]);
        if (!detail.eligible) throw new SettlementConflict(`Mission ${detail.missionNumber} : ${detail.ineligibilityReason}`);
        rows.push(...detail.rows);
      }
      // Check the Excel can be built BEFORE committing any payment.
      await buildRemainingPaymentWorkbook(rows);
      const [created] = await tx.insert(remainingPaymentExportsTable).values({
        requestId: parsed.data.requestId, createdByUserId: req.userId!, rows,
      }).returning();
      await tx.insert(remainingPaymentMissionsTable).values(ids.map(missionId => ({ missionId, exportId: created.id })));
      await tx.update(missionsTable).set({ fullyPaidAt: created.createdAt }).where(inArray(missionsTable.id, ids));
      return created;
    });
    const [user] = await db.select({ fullName: usersTable.fullName }).from(usersTable).where(eq(usersTable.id, batch.createdByUserId));
    res.status(201).json(summarizeRemainingPaymentExport(batch, user?.fullName ?? "Administrateur"));
  } catch (error) {
    if (error instanceof SettlementConflict) { res.status(409).json({ error: error.message }); return; }
    req.log.error({ err: error }, "Remaining payment export failed");
    res.status(500).json({ error: "L'extraction n'a pas pu être enregistrée. Réessayez avec la même sélection." });
  }
});

router.get(`${base}/exports/:id/download`, requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) { res.status(400).json({ error: "Identifiant invalide." }); return; }
  const [batch] = await db.select().from(remainingPaymentExportsTable).where(eq(remainingPaymentExportsTable.id, id));
  if (!batch) { res.status(404).json({ error: "Extraction introuvable." }); return; }
  const buffer = await buildRemainingPaymentWorkbook(batch.rows);
  res.setHeader("Content-Type", excelMime);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Disposition", `attachment; filename="SOMELEC-solde-30-extraction-${batch.id}.xlsx"`);
  res.send(buffer);
});

export default router;
