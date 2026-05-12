import { useState } from "react";
import { useListDepartments, useCreateDepartment, useUpdateDepartment, useDeleteDepartment } from "@workspace/api-client-react";
import type { Department } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Building, Search, Plus, Edit, Trash2 } from "lucide-react";

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
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

type DeptType = "direction" | "central_direction" | "service";

type FormData = {
  name: string;
  code: string;
  type: DeptType;
  parentId: number | null;
};

const DEPT_TYPES: { value: DeptType; label: string }[] = [
  { value: "direction", label: "Direction" },
  { value: "central_direction", label: "Direction Centrale" },
  { value: "service", label: "Service" },
];

const getTypeBadge = (type: string) => {
  switch (type) {
    case "direction": return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Direction</Badge>;
    case "central_direction": return <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200">Direction Centrale</Badge>;
    case "service": return <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200">Service</Badge>;
    default: return <Badge variant="outline">{type}</Badge>;
  }
};

export default function AdminDepartments() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const limit = 15;

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteName, setDeleteName] = useState("");

  const emptyForm: FormData = { name: "", code: "", type: "direction", parentId: null };
  const [form, setForm] = useState<FormData>(emptyForm);

  const { data, isLoading } = useListDepartments({ page, limit, search: search || undefined });

  // All departments for parent selector (no pagination)
  const { data: allDepts } = useListDepartments({ page: 1, limit: 200 });

  const createMutation = useCreateDepartment({
    mutation: {
      onSuccess: () => {
        toast({ title: "Direction créée avec succès." });
        queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
        setIsFormOpen(false);
        setForm(emptyForm);
      },
      onError: () => toast({ title: "Erreur lors de la création.", variant: "destructive" }),
    },
  });

  const updateMutation = useUpdateDepartment({
    mutation: {
      onSuccess: () => {
        toast({ title: "Direction modifiée avec succès." });
        queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
        setIsFormOpen(false);
        setEditingId(null);
        setForm(emptyForm);
      },
      onError: () => toast({ title: "Erreur lors de la modification.", variant: "destructive" }),
    },
  });

  const deleteMutation = useDeleteDepartment({
    mutation: {
      onSuccess: () => {
        toast({ title: "Direction supprimée." });
        queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
        setDeleteId(null);
      },
      onError: () => toast({ title: "Impossible de supprimer (des utilisateurs y sont rattachés).", variant: "destructive" }),
    },
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setIsFormOpen(true);
  };

  const openEdit = (dept: Department) => {
    setEditingId(dept.id);
    setForm({ name: dept.name, code: dept.code, type: dept.type as DeptType, parentId: dept.parentId ?? null });
    setIsFormOpen(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim() || !form.code.trim()) {
      toast({ title: "Le nom et le code sont obligatoires.", variant: "destructive" });
      return;
    }
    const payload = { ...form, parentId: form.parentId ?? undefined };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate({ data: payload });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestion des Directions</h1>
          <p className="text-muted-foreground">Gérez la structure organisationnelle de SOMELEC.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" /> Nouvelle Direction
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <CardTitle className="text-lg">
              Directions & Départements
              {data && <span className="ml-2 text-sm font-normal text-muted-foreground">({data.total} au total)</span>}
            </CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Rechercher..."
                className="pl-8"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Direction parente</TableHead>
                  <TableHead className="text-center">Utilisateurs</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 6 }).map((__, j) => (
                        <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : data?.data && data.data.length > 0 ? (
                  data.data.map((dept) => (
                    <TableRow key={dept.id}>
                      <TableCell className="font-mono font-medium text-xs">{dept.code}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium">{dept.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{getTypeBadge(dept.type)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{dept.parentName ?? "—"}</TableCell>
                      <TableCell className="text-center font-medium">{dept.userCount ?? 0}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(dept)} title="Modifier">
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => { setDeleteId(dept.id); setDeleteName(dept.name); }}
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      Aucune direction trouvée.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Page {page} / {data.totalPages} — {data.total} résultat(s)
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Précédent</Button>
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(data.totalPages, p + 1))} disabled={page === data.totalPages}>Suivant</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={(open) => { if (!open) { setIsFormOpen(false); setEditingId(null); setForm(emptyForm); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Modifier la direction" : "Nouvelle direction"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Modifiez les informations de cette direction." : "Renseignez les informations de la nouvelle direction ou département."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="dept-name">Nom <span className="text-red-500">*</span></Label>
              <Input
                id="dept-name"
                placeholder="ex : Direction des Ressources Humaines"
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dept-code">Code <span className="text-red-500">*</span></Label>
              <Input
                id="dept-code"
                placeholder="ex : DRH"
                className="font-mono"
                value={form.code}
                onChange={(e) => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Type <span className="text-red-500">*</span></Label>
              <Select value={form.type} onValueChange={(v) => setForm(f => ({ ...f, type: v as DeptType }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEPT_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Direction parente (optionnel)</Label>
              <Select
                value={form.parentId ? String(form.parentId) : "none"}
                onValueChange={(v) => setForm(f => ({ ...f, parentId: v === "none" ? null : Number(v) }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Aucune (direction racine)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Aucune (direction racine)</SelectItem>
                  {allDepts?.data
                    .filter(d => d.id !== editingId)
                    .map(d => (
                      <SelectItem key={d.id} value={String(d.id)}>{d.name} ({d.code})</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsFormOpen(false); setEditingId(null); setForm(emptyForm); }}>
              Annuler
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? "Enregistrement..." : editingId ? "Modifier" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la direction ?</AlertDialogTitle>
            <AlertDialogDescription>
              Vous êtes sur le point de supprimer <strong>"{deleteName}"</strong>. Cette action est irréversible. Les utilisateurs rattachés à cette direction devront être réaffectés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
