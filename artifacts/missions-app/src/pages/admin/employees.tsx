import { useState } from "react";
import { useListEmployees, useCreateEmployee, useUpdateEmployee, useDeleteEmployee, useListDepartments } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Search, Filter, Plus, Edit, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { EMPLOYEE_CATEGORY_LABELS } from "@/lib/constants";

const CATEGORIES = Object.entries(EMPLOYEE_CATEGORY_LABELS);

type EmployeeRow = {
  id: number;
  matricule: string;
  nni: string | null;
  firstName: string;
  lastName: string;
  fullName: string;
  position: string;
  category: string;
  departmentId: number | null;
  departmentName: string | null;
};

type FormData = {
  firstName: string;
  lastName: string;
  matricule: string;
  nni: string;
  position: string;
  category: string;
  departmentId: string;
};

const emptyForm: FormData = {
  firstName: "",
  lastName: "",
  matricule: "",
  nni: "",
  position: "",
  category: "agent",
  departmentId: "",
};

export default function AdminEmployees() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const limit = 10;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeRow | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [deleteEmployee, setDeleteEmployee] = useState<EmployeeRow | null>(null);

  const { data, isLoading } = useListEmployees({
    page,
    limit,
    search: search || undefined,
    category: categoryFilter !== "all" ? categoryFilter : undefined,
  });

  const { data: deptsData } = useListDepartments({});

  const createMutation = useCreateEmployee({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
        setDialogOpen(false);
        setForm(emptyForm);
        toast({ title: "Employé créé avec succès" });
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Une erreur est survenue";
        toast({ title: "Erreur", description: msg, variant: "destructive" });
      },
    },
  });

  const updateMutation = useUpdateEmployee({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
        setDialogOpen(false);
        setEditingEmployee(null);
        setForm(emptyForm);
        toast({ title: "Employé mis à jour" });
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Une erreur est survenue";
        toast({ title: "Erreur", description: msg, variant: "destructive" });
      },
    },
  });

  const deleteMutation = useDeleteEmployee({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
        setDeleteEmployee(null);
        toast({ title: "Employé supprimé" });
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Une erreur est survenue";
        toast({ title: "Erreur", description: msg, variant: "destructive" });
      },
    },
  });

  const openCreate = () => {
    setEditingEmployee(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (emp: EmployeeRow) => {
    setEditingEmployee(emp);
    setForm({
      firstName: emp.firstName,
      lastName: emp.lastName,
      matricule: emp.matricule,
      nni: emp.nni ?? "",
      position: emp.position,
      category: emp.category,
      departmentId: emp.departmentId?.toString() ?? "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      firstName: form.firstName,
      lastName: form.lastName,
      matricule: form.matricule,
      nni: form.nni || undefined,
      position: form.position,
      category: form.category as "dg_dga" | "director" | "chef_department" | "other_cadre" | "agent",
      departmentId: form.departmentId ? parseInt(form.departmentId) : undefined,
    };

    if (editingEmployee) {
      updateMutation.mutate({ id: editingEmployee.id, data: payload });
    } else {
      createMutation.mutate({ data: payload });
    }
  };

  const handleDelete = () => {
    if (!deleteEmployee) return;
    deleteMutation.mutate({ id: deleteEmployee.id });
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestion des Employés</h1>
          <p className="text-muted-foreground">Gérez la base de données du personnel (catégories de frais, etc).</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" /> Nouvel Employé
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <CardTitle className="text-lg">Employés</CardTitle>
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Nom, matricule..."
                  className="pl-8"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
              </div>
              <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[200px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Catégorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes catégories</SelectItem>
                  {CATEGORIES.map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Matricule / NNI</TableHead>
                  <TableHead>Nom complet</TableHead>
                  <TableHead>Fonction & Dept</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-10 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-10 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : data?.data && data.data.length > 0 ? (
                  data.data.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell>
                        <div className="font-mono text-sm font-medium">{employee.matricule}</div>
                        <div className="font-mono text-xs text-muted-foreground">{employee.nni || "Sans NNI"}</div>
                      </TableCell>
                      <TableCell className="font-medium">{employee.fullName}</TableCell>
                      <TableCell>
                        <div className="text-sm">{employee.position}</div>
                        <div className="text-xs text-muted-foreground">{(employee as EmployeeRow).departmentName || "-"}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal text-xs bg-muted">
                          {EMPLOYEE_CATEGORY_LABELS[employee.category] || employee.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(employee as EmployeeRow)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setDeleteEmployee(employee as EmployeeRow)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      Aucun employé trouvé.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Affichage {((page - 1) * limit) + 1} - {Math.min(page * limit, data.total)} sur {data.total}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                  Précédent
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(data.totalPages, p + 1))} disabled={page === data.totalPages}>
                  Suivant
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); setEditingEmployee(null); setForm(emptyForm); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingEmployee ? "Modifier l'employé" : "Nouvel employé"}
            </DialogTitle>
            <DialogDescription>
              {editingEmployee ? "Modifiez les informations de l'employé." : "Ajoutez un nouvel employé à la base de données."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">Prénom *</Label>
                <Input
                  id="firstName"
                  value={form.firstName}
                  onChange={(e) => setForm(f => ({ ...f, firstName: e.target.value }))}
                  placeholder="Prénom"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">Nom *</Label>
                <Input
                  id="lastName"
                  value={form.lastName}
                  onChange={(e) => setForm(f => ({ ...f, lastName: e.target.value }))}
                  placeholder="Nom de famille"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="matricule">Matricule *</Label>
                <Input
                  id="matricule"
                  value={form.matricule}
                  onChange={(e) => setForm(f => ({ ...f, matricule: e.target.value }))}
                  placeholder="ex: EMP-001"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nni">NNI</Label>
                <Input
                  id="nni"
                  value={form.nni}
                  onChange={(e) => setForm(f => ({ ...f, nni: e.target.value }))}
                  placeholder="Numéro national"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="position">Fonction / Poste *</Label>
              <Input
                id="position"
                value={form.position}
                onChange={(e) => setForm(f => ({ ...f, position: e.target.value }))}
                placeholder="ex: Ingénieur réseau"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="category">Catégorie *</Label>
                <Select value={form.category} onValueChange={(v) => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="empDepartment">Département</Label>
                <Select value={form.departmentId} onValueChange={(v) => setForm(f => ({ ...f, departmentId: v === "none" ? "" : v }))}>
                  <SelectTrigger id="empDepartment">
                    <SelectValue placeholder="Aucun" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun département</SelectItem>
                    {deptsData?.data?.map((d) => (
                      <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); setEditingEmployee(null); setForm(emptyForm); }}>
                Annuler
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Enregistrement..." : editingEmployee ? "Mettre à jour" : "Créer l'employé"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteEmployee} onOpenChange={(open) => { if (!open) setDeleteEmployee(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'employé</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer <strong>{deleteEmployee?.fullName}</strong> (Matricule: {deleteEmployee?.matricule}) ?
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
