import { useRoute, Link } from "wouter";
import { useGetMissionPaymentReceipt } from "@workspace/api-client-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowLeft, Printer, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { QRCodeSVG } from "qrcode.react";

export default function MissionPaymentReceipt() {
  const [, params] = useRoute("/missions/:id/payment-receipt");
  const id = parseInt(params?.id || "0", 10);

  const { data: receipt, isLoading } = useGetMissionPaymentReceipt(id, {
    query: { queryKey: [`/api/missions/${id}/payment-receipt`], enabled: !!id },
  });

  const formatDate = (d: string) => {
    try { return format(new Date(d), "dd MMMM yyyy", { locale: fr }); }
    catch { return d; }
  };

  const formatDateTime = (d: string) => {
    try { return format(new Date(d), "dd MMMM yyyy 'à' HH:mm", { locale: fr }); }
    catch { return d; }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="p-12 text-center space-y-4">
        <p>Reçu de paiement non disponible. Le paiement doit être confirmé par le CAD Paiement d'abord.</p>
        <Link href={`/missions/${id}`}>
          <Button>Retour à la mission</Button>
        </Link>
      </div>
    );
  }

  const qrContent = [
    `REÇU: ${receipt.receiptNumber}`,
    `OM: ${receipt.orderNumber}`,
    `Mission: ${receipt.missionTitle}`,
    `Direction: ${receipt.departmentName ?? "SOMELEC"}`,
    `Montant CAD (70%): ${receipt.paidAmount.toLocaleString("fr-FR")} MRU`,
    `Date: ${receipt.paymentDate}`,
    `Validé par: ${receipt.paymentConfirmedByName}`,
  ].join("\n");

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      {/* Toolbar */}
      <div className="print:hidden max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href={`/missions/${id}`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" /> Retour à la mission
          </Button>
        </Link>
        <Button onClick={() => window.print()}>
          <Printer className="w-4 h-4 mr-2" /> Imprimer / Télécharger PDF
        </Button>
      </div>

      {/* Document */}
      <div className="max-w-4xl mx-auto print:max-w-none print:shadow-none bg-white border border-gray-200 shadow print:border-0 p-12 print:p-8 text-gray-800 print:text-black text-sm">

        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-widest text-gray-400">République Islamique de Mauritanie</p>
            <p className="text-xs text-gray-400">Honneur — Fraternité — Justice</p>
            <div className="mt-4">
              <p className="text-xl font-bold tracking-tight">Groupe Somelec</p>
              <p className="text-xs text-gray-600">Société Mauritanienne d'Électricité</p>
              {receipt.departmentName && (
                <p className="text-sm font-medium text-gray-700 mt-1">{receipt.departmentName}</p>
              )}
            </div>
          </div>
          <div className="text-right space-y-1">
            <QRCodeSVG value={qrContent} size={80} />
          </div>
        </div>

        <Separator className="my-6" />

        {/* Title */}
        <div className="text-center mb-8 space-y-2">
          <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-full px-4 py-1 print:bg-white">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-semibold uppercase tracking-widest text-emerald-700">Preuve de Paiement — CAD</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-3">REÇU DE PAIEMENT DE MISSION</h1>
          <div className="flex justify-center gap-8 text-xs text-gray-500 mt-2">
            <span>Réf. reçu : <strong className="font-mono text-gray-800">{receipt.receiptNumber}</strong></span>
            <span>N° OM : <strong className="font-mono text-gray-800">{receipt.orderNumber}</strong></span>
          </div>
        </div>

        {/* Mission Info */}
        <div className="grid grid-cols-2 gap-6 mb-6 text-sm">
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Mission</p>
              <p className="font-semibold mt-0.5">{receipt.missionTitle}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Direction / Département</p>
              <p className="font-medium mt-0.5">{receipt.departmentName ?? "SOMELEC (Direction Générale)"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Destination</p>
              <p className="font-medium mt-0.5">{receipt.destination}</p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Période</p>
              <p className="font-medium mt-0.5">Du {formatDate(receipt.startDate)} au {formatDate(receipt.endDate)}</p>
              <p className="text-xs text-gray-500">({receipt.durationDays} jour{receipt.durationDays > 1 ? "s" : ""})</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Date et heure de paiement</p>
              <p className="font-semibold text-emerald-700 mt-0.5">{formatDateTime(receipt.paymentDate)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Validé par (CAD)</p>
              <p className="font-medium mt-0.5">{receipt.paymentConfirmedByName}</p>
            </div>
          </div>
        </div>

        <Separator className="my-6" />

        {/* Beneficiaries Table */}
        <div className="mb-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-600 mb-3">Bénéficiaires et Montants</h2>
          {receipt.employees.length > 0 ? (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 border border-gray-200">
                  <th className="text-left px-3 py-2 font-semibold">Nom complet</th>
                  <th className="text-left px-3 py-2 font-semibold">Matricule</th>
                  <th className="text-left px-3 py-2 font-semibold">Poste</th>
                  <th className="text-left px-3 py-2 font-semibold">Catégorie</th>
                  <th className="text-right px-3 py-2 font-semibold">Taux/j</th>
                  <th className="text-right px-3 py-2 font-semibold">Total</th>
                  <th className="text-right px-3 py-2 font-semibold text-emerald-700">CAD (70%)</th>
                  <th className="text-right px-3 py-2 font-semibold text-blue-700">DRH (30%)</th>
                </tr>
              </thead>
              <tbody>
                {receipt.employees.map((emp, idx) => (
                  <tr key={emp.employeeId} className={`border border-gray-200 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                    <td className="px-3 py-2 font-medium">{emp.fullName}</td>
                    <td className="px-3 py-2 font-mono text-gray-600">{emp.matricule}</td>
                    <td className="px-3 py-2 text-gray-600">{emp.position}</td>
                    <td className="px-3 py-2 text-gray-600 capitalize">{emp.category}</td>
                    <td className="px-3 py-2 text-right font-mono">{emp.dailyRate.toLocaleString("fr-FR")}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold">{emp.totalFee.toLocaleString("fr-FR")}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-emerald-700">{emp.paidAmount.toLocaleString("fr-FR")}</td>
                    <td className="px-3 py-2 text-right font-mono text-blue-700">{emp.remainingAmount.toLocaleString("fr-FR")}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 border border-gray-300 font-bold">
                  <td colSpan={5} className="px-3 py-2">TOTAL GÉNÉRAL</td>
                  <td className="px-3 py-2 text-right font-mono">{receipt.totalFees.toLocaleString("fr-FR")} MRU</td>
                  <td className="px-3 py-2 text-right font-mono text-emerald-700">{receipt.paidAmount.toLocaleString("fr-FR")} MRU</td>
                  <td className="px-3 py-2 text-right font-mono text-blue-700">{receipt.remainingAmount.toLocaleString("fr-FR")} MRU</td>
                </tr>
              </tfoot>
            </table>
          ) : (
            <div className="border border-gray-200 rounded p-4 text-center text-gray-500">
              Aucun bénéficiaire enregistré pour cette mission.
            </div>
          )}
        </div>

        {/* Summary Boxes */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="border border-gray-200 rounded p-4 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Montant Total</p>
            <p className="text-xl font-bold font-mono">{receipt.totalFees.toLocaleString("fr-FR")}</p>
            <p className="text-xs text-gray-400">MRU</p>
          </div>
          <div className="border border-emerald-200 bg-emerald-50 rounded p-4 text-center">
            <p className="text-xs text-emerald-600 uppercase tracking-wide font-semibold mb-1">Payé CAD (70%)</p>
            <p className="text-xl font-bold font-mono text-emerald-700">{receipt.paidAmount.toLocaleString("fr-FR")}</p>
            <p className="text-xs text-emerald-500">MRU — CONFIRMÉ</p>
          </div>
          <div className="border border-blue-200 bg-blue-50 rounded p-4 text-center">
            <p className="text-xs text-blue-600 uppercase tracking-wide font-semibold mb-1">Solde DRH (30%)</p>
            <p className="text-xl font-bold font-mono text-blue-700">{receipt.remainingAmount.toLocaleString("fr-FR")}</p>
            <p className="text-xs text-blue-500">MRU — EN ATTENTE</p>
          </div>
        </div>

        <Separator className="my-6" />

        {/* Signatures */}
        <div className="grid grid-cols-2 gap-12 mt-8">
          <div className="text-center space-y-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">Signature CAD Paiement</p>
              <p className="text-sm font-medium">{receipt.paymentConfirmedByName}</p>
              <p className="text-xs text-gray-400">Caissier / CAD Paiement</p>
            </div>
            <div className="border-t border-gray-300 pt-4">
              <div className="w-32 h-16 mx-auto border border-dashed border-gray-300 rounded flex items-center justify-center">
                <div className="text-center">
                  <p className="text-xs font-bold text-gray-600">CACHET</p>
                  <p className="text-[10px] text-gray-400">SOMELEC — CAD</p>
                </div>
              </div>
            </div>
          </div>
          <div className="text-center space-y-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">Visa Contrôle Financier</p>
              <p className="text-sm text-gray-400 italic">En attente de validation</p>
            </div>
            <div className="border-t border-gray-300 pt-4">
              <div className="w-32 h-16 mx-auto border border-dashed border-gray-300 rounded flex items-center justify-center">
                <p className="text-xs text-gray-300">Signature</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-4 border-t border-gray-200 text-center text-xs text-gray-400">
          <p>Document généré automatiquement par le Système de Gestion des Missions SOMELEC</p>
          <p className="mt-1">Reçu N° {receipt.receiptNumber} — {formatDateTime(receipt.paymentDate)}</p>
        </div>
      </div>
    </div>
  );
}
