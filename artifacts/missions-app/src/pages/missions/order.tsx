import { useRoute, Link } from "wouter";
import { useGetMissionOrder } from "@workspace/api-client-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { QRCodeSVG } from "qrcode.react";

export default function MissionOrderPrint() {
  const [, params] = useRoute("/missions/:id/order");
  const id = parseInt(params?.id || "0", 10);

  const { data: order, isLoading } = useGetMissionOrder(id, {
    query: { queryKey: [`/api/missions/${id}/order`], enabled: !!id },
  });

  const formatDate = (d: string) => {
    try { return format(new Date(d), "dd MMMM yyyy", { locale: fr }); }
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

  if (!order) {
    return (
      <div className="p-12 text-center space-y-4">
        <p>Ordre de mission non trouvé ou non encore généré.</p>
        <Link href={`/missions/${id}`}>
          <Button>Retour à la mission</Button>
        </Link>
      </div>
    );
  }

  const qrContent = [
    `N°: ${order.orderNumber}`,
    `Mission: ${order.missionTitle}`,
    `Destination: ${order.destination}`,
    `Du: ${order.startDate} au: ${order.endDate}`,
    `Émis par: ${order.generatedByName}`,
    `Département: ${order.departmentName ?? "SOMELEC"}`,
  ].join("\n");

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      {/* Toolbar — hidden when printing */}
      <div className="print:hidden max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href={`/missions/${id}`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" /> Retour
          </Button>
        </Link>
        <Button onClick={() => window.print()}>
          <Printer className="w-4 h-4 mr-2" /> Imprimer
        </Button>
      </div>

      {/* Document */}
      <div id="om-document" className="max-w-4xl mx-auto print:max-w-none print:shadow-none bg-white border border-gray-200 shadow print:border-0 p-12 print:p-6 text-gray-800 print:text-black text-sm print:text-xs">

        {/* Header */}
        <div className="flex justify-between items-start mb-6 print:mb-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-widest text-gray-400">République Islamique de Mauritanie</p>
            <p className="text-xs text-gray-400">Honneur — Fraternité — Justice</p>
            <div className="mt-3 print:mt-2">
              <p className="om-header-title text-xl print:text-lg font-bold tracking-tight">Groupe Somelec</p>
              <p className="text-xs text-gray-600">Société Mauritanienne d'Électricité</p>
              {order.departmentName && (
                <p className="text-sm print:text-xs font-medium text-gray-700 mt-1">{order.departmentName}</p>
              )}
            </div>
          </div>

          <div className="text-right space-y-2">
            <div className="border-2 border-gray-800 px-5 py-2 print:px-3 print:py-1.5 inline-block rounded">
              <p className="text-xs text-gray-500 mb-1">Numéro d'Ordre</p>
              <p className="font-mono font-bold text-lg print:text-base tracking-wider">{order.orderNumber}</p>
            </div>
            <div className="flex justify-end mt-1">
              <div className="border border-gray-200 p-1 rounded">
                <QRCodeSVG value={qrContent} size={72} level="M" includeMargin={false} />
              </div>
            </div>
            <p className="text-xs text-gray-400">Scanner pour vérifier</p>
          </div>
        </div>

        {/* Title */}
        <div className="text-center my-5 print:my-3">
          <h1 className="text-2xl print:text-xl font-bold uppercase tracking-widest">Ordre de Mission</h1>
          <div className="w-32 h-0.5 bg-gray-800 mx-auto mt-2" />
        </div>

        {/* Mission details */}
        <div className="mb-4 print:mb-3 space-y-2">
          <p className="leading-relaxed">
            Il est ordonné aux agents désignés ci-dessous de se rendre à{" "}
            <strong className="uppercase">{order.destination}</strong>{" "}
            dans le cadre de : <em>{order.missionTitle}</em>.
          </p>

          <div className="grid grid-cols-2 gap-3 print:gap-2 mt-3 text-sm print:text-xs">
            <div>
              <span className="text-gray-500 font-medium">Date de départ :</span>{" "}
              <strong>{formatDate(order.startDate)}</strong>
            </div>
            <div>
              <span className="text-gray-500 font-medium">Date de retour :</span>{" "}
              <strong>{formatDate(order.endDate)}</strong>
            </div>
            <div>
              <span className="text-gray-500 font-medium">Durée :</span>{" "}
              <strong>{order.durationDays} jour{order.durationDays > 1 ? "s" : ""}</strong>
            </div>
            <div>
              <span className="text-gray-500 font-medium">Date d'émission :</span>{" "}
              <strong>{order.generatedAt ? formatDate(order.generatedAt) : "-"}</strong>
            </div>
          </div>
        </div>

        <Separator className="my-4 print:my-2" />

        {/* Missionnaires */}
        <div className="mb-4 print:mb-3">
          <h2 className="font-bold text-sm print:text-xs uppercase tracking-widest mb-3 print:mb-2 text-gray-700">
            Liste des Missionnaires
          </h2>
          <table className="w-full border-collapse text-sm print:text-xs">
            <thead>
              <tr className="bg-gray-100 print:bg-gray-100">
                <th className="border border-gray-300 px-3 py-2 print:px-2 print:py-1.5 text-left font-semibold w-8">N°</th>
                <th className="border border-gray-300 px-3 py-2 print:px-2 print:py-1.5 text-left font-semibold">Nom Complet</th>
                <th className="border border-gray-300 px-3 py-2 print:px-2 print:py-1.5 text-left font-semibold">Matricule</th>
                <th className="border border-gray-300 px-3 py-2 print:px-2 print:py-1.5 text-left font-semibold">Poste / Fonction</th>
              </tr>
            </thead>
            <tbody>
              {order.employees.map((emp, i) => (
                <tr key={emp.employeeId} className={i % 2 === 0 ? "" : "bg-gray-50 print:bg-gray-50"}>
                  <td className="border border-gray-300 px-3 py-2 print:px-2 print:py-1 text-center text-gray-500">{i + 1}</td>
                  <td className="border border-gray-300 px-3 py-2 print:px-2 print:py-1 font-medium">{emp.fullName}</td>
                  <td className="border border-gray-300 px-3 py-2 print:px-2 print:py-1 font-mono text-xs">{emp.matricule}</td>
                  <td className="border border-gray-300 px-3 py-2 print:px-2 print:py-1">{emp.position}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Logistics */}
        <div className="mb-4 print:mb-3 text-sm print:text-xs">
          <h2 className="font-bold text-sm print:text-xs uppercase tracking-widest mb-2 text-gray-700">Moyens Logistiques</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              Véhicule SOMELEC :{" "}
              {order.requiresVehicle
                ? <strong>{order.vehicleCount} véhicule(s){order.vehicleDetails ? ` — ${order.vehicleDetails}` : ""}</strong>
                : <span className="text-gray-500">Non</span>}
            </li>
            <li>
              Dotation Carburant :{" "}
              {order.requiresFuel
                ? <strong>Accordé</strong>
                : <span className="text-gray-500">Non</span>}
            </li>
          </ul>
        </div>

        <Separator className="my-4 print:my-3" />

        {/* Signatures */}
        <div className="grid grid-cols-3 gap-6 print:gap-4 text-center text-sm print:text-xs mt-4 print:mt-3">
          <div>
            <p className="om-sig-gap font-semibold text-xs uppercase tracking-wide text-gray-600 mb-10 print:mb-8">
              CAD Édition
            </p>
            <div className="border-t border-gray-400 pt-2">
              <p className="text-xs text-gray-500">{order.generatedByName}</p>
              <p className="text-xs text-gray-400">
                {order.generatedAt ? formatDate(order.generatedAt) : ""}
              </p>
            </div>
          </div>

          <div>
            <p className="om-sig-gap font-semibold text-xs uppercase tracking-wide text-gray-600 mb-10 print:mb-8">
              Directeur / Chef Dépt.
            </p>
            <div className="border-t border-gray-400 pt-2">
              <p className="text-xs text-gray-400">Cachet &amp; Signature</p>
            </div>
          </div>

          <div>
            <p className="om-sig-gap font-semibold text-xs uppercase tracking-wide text-gray-600 mb-10 print:mb-8">
              Directeur Général
            </p>
            <div className="border-t border-gray-400 pt-2">
              <p className="text-xs text-gray-400">Cachet &amp; Signature</p>
            </div>
          </div>
        </div>

        <div className="mt-6 print:mt-4 border-t border-gray-200 pt-3 text-center text-xs text-gray-400 print:text-gray-500">
          Document officiel généré électroniquement — Système de Gestion des Missions SOMELEC — {order.orderNumber}
        </div>
      </div>

      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0.8cm;
          }
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          #om-document {
            font-size: 10px !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            max-width: 100% !important;
            width: 100% !important;
          }
          #om-document h1 {
            font-size: 16px !important;
          }
          #om-document h2 {
            font-size: 11px !important;
          }
          #om-document .om-header-title {
            font-size: 15px !important;
          }
          #om-document .om-sig-gap {
            margin-bottom: 2rem !important;
          }
        }
      `}</style>
    </div>
  );
}
