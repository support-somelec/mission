import { useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { 
  useGetMission, 
  getGetMissionQueryKey,
  useGetMissionValidations,
  useGetMissionEmployees,
  useValidateMission,
  useAssignVehicles,
  useGenerateMissionOrder
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { 
  ArrowLeft, Printer, CheckCircle, XCircle, CarFront, FileText, 
  User, Map, Calendar, Settings, Fuel
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
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
import { ROLE_LABELS } from "@/lib/constants";

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

  const { data: mission, isLoading: isMissionLoading } = useGetMission(id, { 
    query: { enabled: !!id } 
  });
  
  const { data: validations } = useGetMissionValidations(id, {
    query: { enabled: !!id }
  });

  const { data: employees } = useGetMissionEmployees(id, {
    query: { enabled: !!id }
  });

  const validateMutation = useValidateMission({
    mutation: {
      onSuccess: () => {
        toast({ title: "Succès", description: "La mission a été validée." });
        queryClient.invalidateQueries({ queryKey: getGetMissionQueryKey(id) });
        setIsValidateDialogOpen(false);
        setComment("");
      },
      onError: (err: any) => {
        toast({ title: "Erreur", description: err?.error || "Une erreur est survenue.", variant: "destructive" });
      }
    }
  });

  const rejectMutation = useValidateMission({
    mutation: {
      onSuccess: () => {
        toast({ title: "Succès", description: "La mission a été rejetée." });
        queryClient.invalidateQueries({ queryKey: getGetMissionQueryKey(id) });
        setIsRejectDialogOpen(false);
        setComment("");
      },
      onError: (err: any) => {
        toast({ title: "Erreur", description: err?.error || "Une erreur est survenue.", variant: "destructive" });
      }
    }
  });

  const assignVehiclesMutation = useAssignVehicles({
    mutation: {
      onSuccess: () => {
        toast({ title: "Succès", description: "Véhicules assignés." });
        queryClient.invalidateQueries({ queryKey: getGetMissionQueryKey(id) });
        setIsAssignVehicleDialogOpen(false);
      },
      onError: (err: any) => {
        toast({ title: "Erreur", description: err?.error || "Une erreur est survenue.", variant: "destructive" });
      }
    }
  });

  const generateOrderMutation = useGenerateMissionOrder({
    mutation: {
      onSuccess: () => {
        toast({ title: "Succès", description: "Ordre de mission généré." });
        queryClient.invalidateQueries({ queryKey: getGetMissionQueryKey(id) });
      },
      onError: (err: any) => {
        toast({ title: "Erreur", description: err?.error || "Une erreur est survenue.", variant: "destructive" });
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
    try {
      return format(new Date(dateString), "dd MMM yyyy", { locale: fr });
    } catch (e) {
      return dateString;
    }
  };

  const formatDateTime = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd MMM yyyy à HH:mm", { locale: fr });
    } catch (e) {
      return dateString;
    }
  };

  const isCurrentValidator = user?.role && mission.currentValidationRole === user.role;
  const isDMG = user?.role === "dmg";
  const isCAD = user?.role === "cad";
  
  const canAssignVehicles = isCurrentValidator && isDMG && mission.requiresVehicle;
  const canGenerateOrder = isCurrentValidator && isCAD && !mission.orderNumber;

  const handleValidate = () => {
    validateMutation.mutate({ id, data: { action: "approve", comment: comment || undefined } });
  };

  const handleReject = () => {
    rejectMutation.mutate({ id, data: { action: "reject", comment: comment || undefined } });
  };

  const handleAssignVehicles = () => {
    assignVehiclesMutation.mutate({ 
      id, 
      data: { vehicleDetails, vehicleCount: Number(vehicleCount) } 
    });
  };

  const handleGenerateOrder = () => {
    generateOrderMutation.mutate({ id });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/missions">
            <Button variant="outline" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">Mission #{mission.id}</h1>
              <StatusBadge status={mission.status} />
              {mission.orderNumber && (
                <Badge variant="outline" className="bg-primary/5 text-primary">OM: {mission.orderNumber}</Badge>
              )}
            </div>
            <p className="text-muted-foreground">{mission.title}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {mission.orderNumber && (
            <Link href={`/missions/${mission.id}/order`}>
              <Button variant="outline">
                <Printer className="w-4 h-4 mr-2" /> Imprimer OM
              </Button>
            </Link>
          )}

          {canGenerateOrder && (
            <Button 
              onClick={handleGenerateOrder} 
              disabled={generateOrderMutation.isPending}
              className="bg-primary"
            >
              <FileText className="w-4 h-4 mr-2" /> Générer l'OM
            </Button>
          )}

          {isCurrentValidator && !canGenerateOrder && !canAssignVehicles && (
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
                    <DialogDescription>
                      Veuillez fournir un motif pour le rejet de cette mission.
                    </DialogDescription>
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
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    <CheckCircle className="w-4 h-4 mr-2" /> Valider
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Valider la mission</DialogTitle>
                    <DialogDescription>
                      Êtes-vous sûr de vouloir valider cette mission pour l'étape suivante ?
                    </DialogDescription>
                  </DialogHeader>
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
                      Confirmer la validation
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}

          {canAssignVehicles && (
            <Dialog open={isAssignVehicleDialogOpen} onOpenChange={setIsAssignVehicleDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <CarFront className="w-4 h-4 mr-2" /> Assigner Véhicules & Valider
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Assignation des véhicules (DMG)</DialogTitle>
                  <DialogDescription>
                    La mission demande {mission.vehicleCount} véhicule(s). Précisez les détails.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Nombre de véhicules accordés</label>
                    <Input 
                      type="number" 
                      min="1" 
                      value={vehicleCount}
                      onChange={(e) => setVehicleCount(parseInt(e.target.value, 10))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Détails (Plaques, chauffeurs...)</label>
                    <Textarea 
                      placeholder="Ex: SG 1234, SG 5678 avec chauffeurs..." 
                      value={vehicleDetails}
                      onChange={(e) => setVehicleDetails(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAssignVehicleDialogOpen(false)}>Annuler</Button>
                  <Button 
                    className="bg-emerald-600 hover:bg-emerald-700 text-white" 
                    onClick={handleAssignVehicles}
                    disabled={assignVehiclesMutation.isPending || !vehicleDetails.trim()}
                  >
                    Confirmer
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Détails de la mission</CardTitle>
            </CardHeader>
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
                <div className="bg-muted/30 p-4 rounded-md text-sm whitespace-pre-wrap">
                  {mission.needsExpression}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-2">Plan d'action</h4>
                <div className="bg-muted/30 p-4 rounded-md text-sm whitespace-pre-wrap">
                  {mission.actionPlan}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Employés participants ({mission.employeeCount})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employé</TableHead>
                      <TableHead>Poste</TableHead>
                      {employees && <TableHead className="text-right">Frais / Jour</TableHead>}
                      {employees && <TableHead className="text-right">Total</TableHead>}
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
                          <TableCell>
                            <div className="text-sm">{emp.position}</div>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">{emp.dailyRate} MRU</TableCell>
                          <TableCell className="text-right font-mono font-medium">{emp.totalFee} MRU</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      mission.employees.map((emp) => (
                        <TableRow key={emp.employeeId}>
                          <TableCell>
                            <div className="font-medium">{emp.fullName}</div>
                            <div className="text-xs text-muted-foreground">{emp.matricule}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{emp.position}</div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              {employees && mission.totalFees && (
                <div className="mt-4 flex justify-end">
                  <div className="bg-muted/50 rounded-lg p-4 w-64 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Total Frais:</span>
                      <span className="font-mono font-medium">{mission.totalFees} MRU</span>
                    </div>
                    {mission.paidAmount ? (
                      <>
                        <div className="flex justify-between text-sm text-emerald-600">
                          <span>Payé (CAD 70%):</span>
                          <span className="font-mono">{mission.paidAmount} MRU</span>
                        </div>
                        <div className="flex justify-between text-sm text-amber-600">
                          <span>Reste (DRH 30%):</span>
                          <span className="font-mono">{mission.remainingAmount} MRU</span>
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Méta-données</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Créée par:</span>
                <span className="font-medium">{mission.createdByName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Département:</span>
                <span className="font-medium">{mission.departmentName || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Créée le:</span>
                <span>{formatDateTime(mission.createdAt)}</span>
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <div className="font-medium flex items-center gap-2">
                  <Settings className="w-4 h-4" /> Logistique
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1"><CarFront className="w-3 h-3"/> Véhicule:</span>
                  <span>{mission.requiresVehicle ? `Oui (${mission.vehicleCount})` : "Non"}</span>
                </div>
                {mission.vehicleDetails && (
                  <div className="text-xs bg-muted p-2 rounded">
                    {mission.vehicleDetails}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1"><Fuel className="w-3 h-3"/> Carburant:</span>
                  <span>{mission.requiresFuel ? "Oui" : "Non"}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Historique de validation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {validations && validations.length > 0 ? (
                  validations.map((val, i) => (
                    <div key={val.id} className="relative pl-6 pb-4 border-l-2 border-muted last:border-0 last:pb-0">
                      <div className="absolute left-[-9px] top-0 w-4 h-4 rounded-full bg-background border-2 border-primary flex items-center justify-center">
                        {val.action === 'approve' ? 
                          <div className="w-2 h-2 rounded-full bg-emerald-500" /> : 
                          <div className="w-2 h-2 rounded-full bg-destructive" />
                        }
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{val.validatorName}</span>
                          <span className="text-xs text-muted-foreground">{formatDateTime(val.createdAt)}</span>
                        </div>
                        <div className="text-xs font-medium text-primary">
                          {ROLE_LABELS[val.validatorRole] || val.validatorRole}
                        </div>
                        {val.comment && (
                          <div className="text-xs bg-muted/50 p-2 rounded mt-2 text-muted-foreground">
                            "{val.comment}"
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground text-center">Aucune validation pour le moment.</div>
                )}

                {mission.status !== 'approved' && mission.status !== 'rejected' && (
                  <div className="relative pl-6 mt-4">
                    <div className="absolute left-[-9px] top-0 w-4 h-4 rounded-full bg-background border-2 border-amber-400 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    </div>
                    <div className="text-sm text-muted-foreground italic">
                      En attente: <span className="font-medium">{ROLE_LABELS[mission.currentValidationRole || ""] || mission.currentValidationRole}</span>
                    </div>
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
