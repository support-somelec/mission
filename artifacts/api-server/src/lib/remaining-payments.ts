import ExcelJS from "exceljs";
import type { RemainingPaymentRow } from "@workspace/db";

export const excelMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function buildRemainingPaymentWorkbook(rows: RemainingPaymentRow[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SOMELEC";
  const sheet = workbook.addWorksheet("Solde 30%");
  sheet.columns = [
    { header: "Numéro de mission", key: "missionNumber", width: 25 },
    { header: "Matricule", key: "matricule", width: 20 },
    { header: "NNI", key: "nni", width: 22 },
    { header: "Nom", key: "lastName", width: 28 },
    { header: "Prénom", key: "firstName", width: 28 },
    { header: "Montant 30% restant (MRU)", key: "amount", width: 28 },
    { header: "Mois de la mission", key: "month", width: 22 },
    { header: "Année", key: "year", width: 14 },
  ];
  // Identifiers and names stay strings (including leading zeros); no formulas.
  for (const row of rows) sheet.addRow({ ...row, matricule: row.matricule ?? "", nni: row.nni ?? "" });
  sheet.getColumn("amount").numFmt = "#,##0.00";
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF14532D" } };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: "A1", to: `H${rows.length + 1}` };
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export function summarizeRemainingPaymentExport(
  batch: { id: number; createdAt: Date; rows: RemainingPaymentRow[] },
  createdByName: string,
) {
  return {
    id: batch.id,
    createdAt: batch.createdAt.toISOString(),
    createdByName,
    missionCount: new Set(batch.rows.map(row => row.missionId)).size,
    employeeCount: batch.rows.length,
    totalAmount: Math.round(batch.rows.reduce((sum, row) => sum + row.amount, 0) * 100) / 100,
  };
}
