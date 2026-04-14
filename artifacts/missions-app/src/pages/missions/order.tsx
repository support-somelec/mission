import { useRoute, Link } from "wouter";
import { useGetMissionOrder } from "@workspace/api-client-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowLeft, Printer, Map } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function MissionOrderPrint() {
  const [, params] = useRoute("/missions/:id/order");
  const id = parseInt(params?.id || "0", 10);

  const { data: order, isLoading } = useGetMissionOrder(id, {
    query: { enabled: !!id }
  });

  const handlePrint = () => {
    window.print();
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd MMMM yyyy", { locale: fr });
    } catch (e) {
      return dateString;
    }
  };

  if (isLoading) {
    return <div className="p-12 text-center">Chargement...</div>;
  }

  if (!order) {
    return (
      <div className="p-12 text-center space-y-4">
        <p>Ordre de mission non trouvé ou non généré.</p>
        <Link href={`/missions/${id}`}>
          <Button>Retour à la mission</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto mb-6 flex justify-between items-center print:hidden">
        <Link href={`/missions/${id}`}>
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" /> Retour
          </Button>
        </Link>
        <Button onClick={handlePrint} className="bg-primary">
          <Printer className="w-4 h-4 mr-2" /> Imprimer
        </Button>
      </div>

      <div className="max-w-4xl mx-auto bg-white border shadow-sm print:shadow-none print:border-none p-12 print:p-0">
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-black pb-6 mb-8">
          <div className="flex items-center gap-3">
            <Map className="w-12 h-12 text-black" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight uppercase">SOMELEC</h1>
              <p className="text-sm font-medium">Société Mauritanienne d'Electricité</p>
              <p className="text-xs">{order.departmentName}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold border border-black p-2 mb-2 inline-block">
              N° {order.orderNumber}
            </div>
            <p className="text-sm">
              Nouakchott, le {formatDate(order.generatedAt)}
            </p>
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold uppercase underline underline-offset-4">Ordre de Mission</h2>
        </div>

        {/* Content */}
        <div className="space-y-6 text-sm leading-relaxed">
          <p>
            Il est ordonné aux personnes désignées ci-dessous de se rendre à <strong className="uppercase">{order.destination}</strong> pour motif de mission de service.
          </p>
          
          <div className="my-6">
            <table className="w-full border-collapse border border-black text-sm">
              <thead>
                <tr className="bg-gray-100 print:bg-gray-100">
                  <th className="border border-black p-2 text-left">N° Matricule</th>
                  <th className="border border-black p-2 text-left">Nom & Prénom</th>
                  <th className="border border-black p-2 text-left">Fonction</th>
                </tr>
              </thead>
              <tbody>
                {order.employees.map((emp) => (
                  <tr key={emp.employeeId}>
                    <td className="border border-black p-2">{emp.matricule}</td>
                    <td className="border border-black p-2 font-medium">{emp.fullName}</td>
                    <td className="border border-black p-2">{emp.position}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-2">
            <p><strong>Motif de la mission :</strong> {order.missionTitle}</p>
            <p><strong>Période :</strong> Du {formatDate(order.startDate)} au {formatDate(order.endDate)} (soit {order.durationDays} jours)</p>
          </div>

          <div className="space-y-2 mt-6">
            <p className="font-bold underline">Moyens logistiques :</p>
            <ul className="list-disc pl-6">
              <li>Véhicule SOMELEC : {order.requiresVehicle ? `Oui (${order.vehicleDetails || `${order.vehicleCount} véhicule(s)`})` : 'Non'}</li>
              <li>Dotation Carburant : {order.requiresFuel ? 'Oui' : 'Non'}</li>
            </ul>
          </div>

          <div className="mt-8 border border-black p-4 bg-gray-50 print:bg-gray-50">
            <p className="font-bold underline mb-2">Imputation Budgétaire (Frais de mission) :</p>
            <p>Montant total : <strong>{order.totalFees} MRU</strong></p>
            <ul className="list-none mt-2 space-y-1">
              <li>- Avance CAD (70%) : <strong>{order.paidAmount} MRU</strong></li>
              <li>- Reste DRH (30%) : <strong>{order.remainingAmount} MRU</strong></li>
            </ul>
          </div>
        </div>

        {/* Signatures */}
        <div className="mt-16 flex justify-between">
          <div className="text-center w-64">
            <p className="font-bold mb-16">Le Directeur / Chef de Département</p>
          </div>
          <div className="text-center w-64">
            <p className="font-bold mb-16">Le Directeur Général (ou délégataire)</p>
          </div>
        </div>

        <div className="mt-24 border-t border-gray-300 pt-4 text-xs text-center text-gray-500 print:text-black">
          Généré par {order.generatedByName} le {format(new Date(order.generatedAt), "dd/MM/yyyy HH:mm")} - Système de Gestion des Missions SOMELEC
        </div>
      </div>
    </div>
  );
}
