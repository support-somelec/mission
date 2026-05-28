import { useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { 
  useGetMission, 
  getGetMissionQueryKey,
  useGetMissionValidations,
  useGetMissionEmployees,
  useValidateMission,
  useAssignVehicles,
  useGenerateMissionOrder,
  useAddMissionEmployee,
  useRemoveMissionEmployee,
  useListEmployees,
  useDeleteMission,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { 
  ArrowLeft, Printer, CheckCircle, XCircle, CarFront, FileText, 
  Map, Calendar, Settings, Fuel, CreditCard, Receipt, UserPlus, Trash2, Search, AlertTriangle
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROLE_LABELS, MISSION_STATUS_LABELS } from "@/lib/constants";
import { MissionWorkflowStepper } from "@/components/mission-workflow-stepper";

export default function MissionDetail() {
  const [, params] = useRoute("/missions/:id");
  const [, setLocation] = useLocation();
  const id = parseInt(params?.id || "0", 10);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [comment, setComment] = useState("");
  const [vehicleDetails, setVehicleDetails] = useState("");
  const [vehicleCount, setVehicleCount] = useState(1);
  const [isValidateDialogOpen, setIsValidateDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [isAssignVehicleDialogOpen, setIsAssignVehicleDialogOpen] = useState(false);
  const [isAddEmployeeDialogOpen, setIsAddEmployeeDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState("");

  const { data: mission, isLoading: isMissionLoading } = useGetMission(id, { 
    query: { queryKey: [`/api/missions/${id}`], enabled: !!id } 
  });
  
  const { data: validations } = useGetMissionValidations(id, {
    query: { queryKey: [`/api/missions/${id}/validations`], enabled: !!id }
  });

  const { data: employees } = useGetMissionEmployees(id, {
    query: { queryKey: [`/api/missions/${id}/employees`], enabled: !!id }
  });

  const isDMGPendingDMG = !!(user?.role === "dmg" && mission?.status === "pending_dmg");

  const { data: allEmployees } = useListEmployees(
    { search: employeeSearch || undefined, limit: 20 },
    { query: { queryKey: ["/api/employees", "dmg-search", employeeSearch], enabled: isAddEmployeeDialogOpen } }
  );

  const addEmployeeMutation = useAddMissionEmployee({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/missions/${id}/employees`] });
        toast({ title: "Employé ajouté à la mission" });
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Erreur";
        toast({ title: "Erreur", description: msg, variant: "destructive" });
      },
    },
  });

  const removeEmployeeMutation = useRemoveMissionEmployee({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/missions/${id}/employees`] });
        toast({ title: "Employé retiré de la mission" });
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Erreur";
        toast({ title: "Erreur", description: msg, variant: "destructive" });
      },
    },
  });

  const validateMutation = useValidateMission({
    mutation: {
      onSuccess: () => {
        toast({ title: "Mission validée et transmise à l'étape suivante." });
        queryClient.invalidateQueries({ queryKey: getGetMissionQueryKey(id) });
        setIsValidateDialogOpen(false);
        setComment("");
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Une erreur est survenue";
        toast({ title: "Erreur", description: msg, variant: "destructive" });
      }
    }
  });

  const rejectMutation = useValidateMission({
    mutation: {
      onSuccess: () => {
        toast({ title: "Mission rejetée." });
        queryClient.invalidateQueries({ queryKey: getGetMissionQueryKey(id) });
        setIsRejectDialogOpen(false);
        setComment("");
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Une erreur est survenue";
        toast({ title: "Erreur", description: msg, variant: "destructive" });
      }
    }
  });

  const assignVehiclesMutation = useAssignVehicles({
    mutation: {
      onSuccess: () => {
        toast({ title: "Mission validée par le DMG — maintenant En Vigueur." });
        queryClient.invalidateQueries({ queryKey: getGetMissionQueryKey(id) });
        setIsAssignVehicleDialogOpen(false);
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Une erreur est survenue";
        toast({ title: "Erreur", description: msg, variant: "destructive" });
      }
    }
  });

  const deleteMutation = useDeleteMission({
    mutation: {
      onSuccess: () => {
        toast({ title: "Mission supprimée." });
        setLocation("/missions");
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Erreur";
        toast({ title: "Erreur", description: msg, variant: "destructive" });
      },
    },
  });

  const generateOrderMutation = useGenerateMissionOrder({
    mutation: {
      onSuccess: () => {
        toast({ title: "Ordre de mission généré — transmis au CAD Paiement." });
        queryClient.invalidateQueries({ queryKey: getGetMissionQueryKey(id) });
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Une erreur est survenue";
        toast({ title: "Erreur", description: msg, variant: "destructive" });
      }
    }
  });

  if (isMissionLoading) {
    return <div className="space-y-6"><Skeleton className="h-12 w-1/3" /><Skeleton className="h-[400px] w-full" /></div>;
  }

  if (!mission) {
    return <div className="text-center py-12">Mission introuvable.</div>;
  }

  const formatDate = (dateString: string) => {
    try { return format(new Date(dateString), "dd MMM yyyy", { locale: fr }); }
    catch { return dateString; }
  };

  const formatDateTime = (dateString: string) => {
    try { return format(new Date(dateString), "dd MMM yyyy à HH:mm", { locale: fr }); }
    catch { return dateString; }
  };

  const role = user?.role ?? "";
  const isCurrentValidator = !!(role && mission.currentValidationRole === role);
  const isDMG = role === "dmg";
  const isCADEdition = role === "cad_edition";
  const isCADPayment = role === "cad_payment";

  const canAssignVehicles = isCurrentValidator && isDMG;
  const canGenerateOrder = isCurrentValidator && isCADEdition && mission.status === "en_vigueur" && !mission.orderNumber;
  const canPrintOrder = !!mission.orderNumber && (isCADEdition || role === "admin");
  const canViewReceipt = !!mission.orderNumber &&
    ["pending_financial_control", "approved"].includes(mission.status) &&
    ["admin", "cad_payment", "financial_control"].includes(role);

  // CAD Paiement validates via normal validate route
  const canValidateNormally = isCurrentValidator && !canAssignVehicles && !canGenerateOrder;

  const handleValidate = () => {
    validateMutation.mutate({ id, data: { action: "approve", comment: comment || undefined } });
  };

  const handleReject = () => {
    rejectMutation.mutate({ id, data: { action: "reject", comment: comment || undefined } });
  };

  const handleAssignVehicles = () => {
    assignVehiclesMutation.mutate({ 
      id, 
      data: { vehicleDetails: vehicleDetails || undefined, vehicleCount: Number(vehicleCount) } 
    });
  };

  const handleGenerateOrder = () => {
    generateOrderMutation.mutate({ id });
  };

  const getValidationButtonLabel = () => {
    if (isCADPayment) return "Confirmer le paiement";
    return "Valider";
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/missions">
            <Button variant="outline" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight">Mission #{mission.id}</h1>
              <StatusBadge status={mission.status} />
              {mission.orderNumber && (
                <Badge variant="outline" className="bg-primary/5 text-primary font-mono">N° {mission.orderNumber}</Badge>
              )}
            </div>
            <p className="text-muted-foreground">{mission.title}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Admin — Delete mission */}
          {role === "admin" && (
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="w-4 h-4 mr-2" /> Supprimer
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="w-5 h-5" /> Supprimer la mission
                  </DialogTitle>
                  <DialogDescription>
                    Cette action est irréversible. La mission <strong>#{mission.id} — {mission.title}</strong> et toutes ses données (validations, missionnaires) seront définitivement supprimées.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Annuler</Button>
                  <Button
                    variant="destructive"
                    onClick={() => deleteMutation.mutate({ id })}
                    disabled={deleteMutation.isPending}
                  >
                    {deleteMutation.isPending ? "Suppression..." : "Confirmer la suppression"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          {canPrintOrder && (
            <Link href={`/missions/${mission.id}/order`}>
              <Button variant="outline">
                <Printer className="w-4 h-4 mr-2" /> Imprimer OM
              </Button>
            </Link>
          )}

          {canViewReceipt && (
            <Link href={`/missions/${mission.id}/payment-receipt`}>
              <Button variant="outline" className="border-emerald-300 text-emerald-700 hover:bg-emerald-50">
                <Receipt className="w-4 h-4 mr-2" /> Reçu de Paiement
              </Button>
            </Link>
          )}

          {/* CAD Édition — Generate Order */}
          {canGenerateOrder && (
            <Button 
              onClick={handleGenerateOrder} 
              disabled={generateOrderMutation.isPending}
            >
              <FileText className="w-4 h-4 mr-2" />
              {generateOrderMutation.isPending ? "Génération..." : "Générer l'Ordre de Mission"}
            </Button>
          )}

          {/* Standard Validate/Reject (director, central_director, technical_control, dga, cad_payment, financial_control) */}
          {canValidateNormally && (
            <>
              <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="destructive">
                    <XCircle className="w-4 h-4 mr-2" /> Rejeter
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Rejeter la mission</DialogTitle>
                    <DialogDescription>Veuillez fournir un motif de rejet.</DialogDescription>
                  </DialogHeader>
                  <Textarea 
                    placeholder="Motif du rejet (obligatoire)" 
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>Annuler</Button>
                    <Button 
                      variant="destructive" 
                      onClick={handleReject}
                      disabled={rejectMutation.isPending || !comment.trim()}
                    >
                      Confirmer le rejet
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={isValidateDialogOpen} onOpenChange={setIsValidateDialogOpen}>
                <DialogTrigger asChild>
                  <Button className={isCADPayment ? "bg-emerald-700 hover:bg-emerald-800 text-white" : "bg-emerald-600 hover:bg-emerald-700 text-white"}>
                    {isCADPayment ? <CreditCard className="w-4 h-4 mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                    {getValidationButtonLabel()}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {isCADPayment ? "Confirmer le paiement des frais" : "Valider la mission"}
                    </DialogTitle>
                    <DialogDescription>
                      {isCADPayment 
                        ? "Confirmez que le paiement des frais de mission a été effectué."
                        : "Confirmez la validation pour transmettre à l'étape suivante."}
                    </DialogDescription>
                  </DialogHeader>
                  {mission.totalFees && isCADPayment && (
                    <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Total frais :</span>
                        <span className="font-mono font-semibold">{mission.totalFees} MRU</span>
                      </div>
                      <div className="flex justify-between text-emerald-600">
                        <span>CAD Paiement (70%) :</span>
                        <span className="font-mono">{mission.paidAmount} MRU</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Solde pour Contrôle Financier (30%) :</span>
                        <span className="font-mono">{mission.remainingAmount} MRU</span>
                      </div>
                    </div>
                  )}
                  <Textarea 
                    placeholder="Commentaire (optionnel)" 
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsValidateDialogOpen(false)}>Annuler</Button>
                    <Button 
                      className="bg-emerald-600 hover:bg-emerald-700 text-white" 
                      onClick={handleValidate}
                      disabled={validateMutation.isPending}
                    >
                      {validateMutation.isPending ? "Traitement..." : "Confirmer"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}

          {/* DMG — Assign Vehicles & Validate */}
          {canAssignVehicles && (
            <Dialog open={isAssignVehicleDialogOpen} onOpenChange={setIsAssignVehicleDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <CarFront className="w-4 h-4 mr-2" />
                  {mission.requiresVehicle ? "Affecter Véhicules & Valider" : "Valider (DMG)"}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Validation DMG</DialogTitle>
                  <DialogDescription>
                    {mission.requiresVehicle
                      ? `La mission demande ${mission.vehicleCount} véhicule(s). Précisez les détails avant de valider.`
                      : "Aucun véhicule demandé. Confirmez votre validation pour mettre la mission En Vigueur."}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  {mission.requiresVehicle && (
                    <>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Nombre de véhicules accordés</label>
                        <Input 
                          type="number" min="1" value={vehicleCount}
                          onChange={(e) => setVehicleCount(parseInt(e.target.value, 10))}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Détails véhicules (Plaques, chauffeurs...)</label>
                        <Textarea 
                          placeholder="Ex: SG 1234 avec chauffeur..." 
                          value={vehicleDetails}
                          onChange={(e) => setVehicleDetails(e.target.value)}
                        />
                      </div>
                    </>
                  )}
                  {!mission.requiresVehicle && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Commentaire (optionnel)</label>
                      <Textarea 
                        placeholder="Commentaire DMG..." 
                        value={vehicleDetails}
                        onChange={(e) => setVehicleDetails(e.target.value)}
                      />
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAssignVehicleDialogOpen(false)}>Annuler</Button>
                  <Button 
                    className="bg-emerald-600 hover:bg-emerald-700 text-white" 
                    onClick={handleAssignVehicles}
                    disabled={assignVehiclesMutation.isPending || (mission.requiresVehicle && !vehicleDetails.trim())}
                  >
                    {assignVehiclesMutation.isPending ? "Traitement..." : "Mettre En Vigueur"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Workflow Stepper */}
      <Card className="p-4">
        <MissionWorkflowStepper
          status={mission.status as Parameters<typeof MissionWorkflowStepper>[0]["status"]}
          validatedStatuses={validations?.map((v) => v.fromStatus) ?? []}
        />
      </Card>

      {/* En Vigueur Banner */}
      {mission.status === "en_vigueur" && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <div>
            <p className="font-semibold text-emerald-800">Mission En Vigueur</p>
            <p className="text-sm text-emerald-700">
              {isCADEdition
                ? "Cette mission est en vigueur. Vous pouvez maintenant générer l'Ordre de Mission."
                : "Cette mission a été validée par le DMG et est officiellement en vigueur. En attente du CAD Édition."}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Détails de la mission</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <Map className="w-4 h-4" /> Destination
                  </div>
                  <div className="font-medium">{mission.destination}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-4 h-4" /> Période
                  </div>
                  <div className="font-medium">
                    Du {formatDate(mission.startDate)} au {formatDate(mission.endDate)}
                    <span className="text-muted-foreground ml-2">({mission.durationDays} j)</span>
                  </div>
                </div>
              </div>
              
              <Separator />

              <div>
                <h4 className="text-sm font-medium mb-2">Expression des besoins</h4>
                <div className="bg-muted/30 p-4 rounded-md text-sm whitespace-pre-wrap">{mission.needsExpression}</div>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-2">Plan d'action</h4>
                <div className="bg-muted/30 p-4 rounded-md text-sm whitespace-pre-wrap">{mission.actionPlan}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Missionnaires ({employees ? employees.length : mission.employeeCount})</CardTitle>
                {isDMGPendingDMG && (
                  <Button size="sm" variant="outline" onClick={() => setIsAddEmployeeDialogOpen(true)}>
                    <UserPlus className="w-4 h-4 mr-1.5" /> Ajouter un employé
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Missionnaire</TableHead>
                      <TableHead>Poste</TableHead>
                      {employees && <TableHead className="text-right">Frais / Jour</TableHead>}
                      {employees && <TableHead className="text-right">Total</TableHead>}
                      {isDMGPendingDMG && <TableHead className="w-10" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees ? (
                      employees.map((emp) => (
                        <TableRow key={emp.employeeId}>
                          <TableCell>
                            <div className="font-medium">{emp.fullName}</div>
                            <div className="text-xs text-muted-foreground">{emp.matricule}</div>
                          </TableCell>
                          <TableCell><div className="text-sm">{emp.position}</div></TableCell>
                          <TableCell className="text-right font-mono text-sm">{emp.dailyRate} MRU</TableCell>
                          <TableCell className="text-right font-mono font-medium">{emp.totalFee} MRU</TableCell>
                          {isDMGPendingDMG && (
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                disabled={removeEmployeeMutation.isPending}
                                onClick={() => removeEmployeeMutation.mutate({ id, employeeId: emp.employeeId })}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    ) : (
                      mission.employees.map((emp) => (
                        <TableRow key={emp.employeeId}>
                          <TableCell>
                            <div className="font-medium">{emp.fullName}</div>
                            <div className="text-xs text-muted-foreground">{emp.matricule}</div>
                          </TableCell>
                          <TableCell><div className="text-sm">{emp.position}</div></TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              {employees && mission.totalFees && (
                <div className="mt-4 flex justify-end">
                  <div className="bg-muted/50 rounded-lg p-4 w-72 space-y-2">
                    <div className="flex justify-between text-sm font-semibold">
                      <span>Total Frais :</span>
                      <span className="font-mono">{mission.totalFees} MRU</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-sm text-emerald-600">
                      <span>CAD Paiement (70%) :</span>
                      <span className="font-mono">{mission.paidAmount} MRU</span>
                    </div>
                    <div className="flex justify-between text-sm text-amber-600">
                      <span>Contrôle Financier (30%) :</span>
                      <span className="font-mono">{mission.remainingAmount} MRU</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* DMG — Add Employee Dialog */}
          <Dialog open={isAddEmployeeDialogOpen} onOpenChange={(open) => { setIsAddEmployeeDialogOpen(open); if (!open) setEmployeeSearch(""); }}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5" /> Ajouter un employé à la mission
                </DialogTitle>
                <DialogDescription>
                  Recherchez et sélectionnez un employé à ajouter (ex : chauffeur).
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Nom, matricule..."
                    className="pl-8"
                    value={employeeSearch}
                    onChange={(e) => setEmployeeSearch(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="rounded-md border max-h-64 overflow-y-auto">
                  <Table>
                    <TableBody>
                      {allEmployees?.data && allEmployees.data.length > 0 ? (
                        allEmployees.data.map((emp) => {
                          const alreadyIn = employees?.some((e) => e.employeeId === emp.id);
                          return (
                            <TableRow key={emp.id} className={alreadyIn ? "opacity-50" : ""}>
                              <TableCell>
                                <div className="font-medium text-sm">{emp.fullName}</div>
                                <div className="text-xs text-muted-foreground">{emp.matricule} — {emp.position}</div>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  size="sm"
                                  variant={alreadyIn ? "secondary" : "outline"}
                                  disabled={alreadyIn || addEmployeeMutation.isPending}
                                  onClick={() => {
                                    if (!alreadyIn) addEmployeeMutation.mutate({ id, data: { employeeId: emp.id } });
                                  }}
                                >
                                  {alreadyIn ? "Déjà ajouté" : "Ajouter"}
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={2} className="h-20 text-center text-sm text-muted-foreground">
                            {employeeSearch ? "Aucun résultat" : "Tapez un nom ou matricule..."}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setIsAddEmployeeDialogOpen(false); setEmployeeSearch(""); }}>
                  Fermer
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Informations</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Créée par :</span>
                <span className="font-medium">{mission.createdByName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Département :</span>
                <span className="font-medium">{mission.departmentName || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Créée le :</span>
                <span>{formatDateTime(mission.createdAt)}</span>
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <div className="font-medium flex items-center gap-2">
                  <Settings className="w-4 h-4" /> Logistique
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1"><CarFront className="w-3 h-3"/> Véhicule :</span>
                  <span>{mission.requiresVehicle ? `Oui (${mission.vehicleCount})` : "Non"}</span>
                </div>
                {mission.vehicleDetails && (
                  <div className="text-xs bg-muted p-2 rounded">{mission.vehicleDetails}</div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1"><Fuel className="w-3 h-3"/> Carburant :</span>
                  <span>{mission.requiresFuel ? "Oui" : "Non"}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Circuit de validation</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                {validations && validations.length > 0 ? (
                  validations.map((val) => (
                    <div key={val.id} className="relative pl-6 pb-4 border-l-2 border-muted last:border-0 last:pb-0">
                      <div className="absolute left-[-9px] top-0 w-4 h-4 rounded-full bg-background border-2 border-primary flex items-center justify-center">
                        {val.action === "approve" ? 
                          <div className="w-2 h-2 rounded-full bg-emerald-500" /> : 
                          <div className="w-2 h-2 rounded-full bg-destructive" />
                        }
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">{val.validatorName}</span>
                          <span className="text-xs text-muted-foreground">{formatDateTime(val.createdAt)}</span>
                        </div>
                        <div className="text-xs font-medium text-primary">
                          {ROLE_LABELS[val.validatorRole] || val.validatorRole}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {MISSION_STATUS_LABELS[val.fromStatus] || val.fromStatus} → {MISSION_STATUS_LABELS[val.toStatus] || val.toStatus}
                        </div>
                        {val.comment && (
                          <div className="text-xs bg-muted/50 p-2 rounded mt-1 text-muted-foreground italic">
                            "{val.comment}"
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground text-center">Aucune validation pour le moment.</div>
                )}

                {mission.status !== "approved" && mission.status !== "rejected" && (
                  <div className="relative pl-6 mt-4">
                    <div className="absolute left-[-9px] top-0 w-4 h-4 rounded-full bg-background border-2 border-amber-400 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    </div>
                    <div className="text-sm text-muted-foreground italic">
                      En attente : <span className="font-medium text-foreground">
                        {ROLE_LABELS[mission.currentValidationRole || ""] || mission.currentValidationRole}
                      </span>
                    </div>
                  </div>
                )}

                {mission.status === "approved" && (
                  <div className="flex items-center gap-2 text-emerald-600 font-medium text-sm mt-2">
                    <CheckCircle className="w-4 h-4" /> Mission Validée
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
