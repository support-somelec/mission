import { useState } from "react";
import {
  useListUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  useListDepartments,
  useResetUserPassword,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Search, Filter, ShieldAlert, UserCog, Plus, Edit, Trash2, RotateCcw, Clock } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

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
import { ROLE_LABELS } from "@/lib/constants";

const ROLES = Object.entries(ROLE_LABELS);

type UserRow = {
  id: number;
  username: string;
  fullName: string;
  email: string | null;
  role: string;
  status: string;
  mustChangePassword: boolean;
  departmentId: number | null;
  departmentName: string | null;
  createdAt: string;
};

type FormData = {
  username: string;
  fullName: string;
  email: string;
  role: string;
  departmentId: string;
  password: string;
};

const emptyForm: FormData = {
  username: "",
  fullName: "",
  email: "",
  role: "employee",
  departmentId: "",
  password: "",
};

export default function AdminUsers() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const limit = 10;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [deleteUser, setDeleteUser] = useState<UserRow | null>(null);
  const [resetUser, setResetUser] = useState<UserRow | null>(null);

  const { data, isLoading } = useListUsers({
    page,
    limit,
    search: search || undefined,
    role: roleFilter !== "all" ? roleFilter : undefined,
  });

  const { data: deptsData } = useListDepartments({ limit: 100 });

  const invalidateUsers = () => queryClient.invalidateQueries({ queryKey: ["/api/users"] });

  const createMutation = useCreateUser({
    mutation: {
      onSuccess: () => {
        invalidateUsers();
        setDialogOpen(false);
        setForm(emptyForm);
        toast({ title: "Utilisateur créé avec succès" });
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Une erreur est survenue";
        toast({ title: "Erreur", description: msg, variant: "destructive" });
      },
    },
  });

  const updateMutation = useUpdateUser({
    mutation: {
      onSuccess: () => {
        invalidateUsers();
        setDialogOpen(false);
        setEditingUser(null);
        setForm(emptyForm);
        toast({ title: "Utilisateur mis à jour" });
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Une erreur est survenue";
        toast({ title: "Erreur", description: msg, variant: "destructive" });
      },
    },
  });

  const deleteMutation = useDeleteUser({
    mutation: {
      onSuccess: () => {
        invalidateUsers();
        setDeleteUser(null);
        toast({ title: "Utilisateur supprimé" });
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Une erreur est survenue";
        toast({ title: "Erreur", description: msg, variant: "destructive" });
      },
    },
  });

  const resetPasswordMutation = useResetUserPassword({
    mutation: {
      onSuccess: (res) => {
        invalidateUsers();
        setResetUser(null);
        toast({ title: res.message ?? "Mot de passe réinitialisé" });
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Une erreur est survenue";
        toast({ title: "Erreur", description: msg, variant: "destructive" });
      },
    },
  });

  const openCreate = () => {
    setEditingUser(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (user: UserRow) => {
    setEditingUser(user);
    setForm({
      username: user.username,
      fullName: user.fullName,
      email: user.email ?? "",
      role: user.role,
      departmentId: user.departmentId?.toString() ?? "",
      password: "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const deptId = form.departmentId ? parseInt(form.departmentId) : null;
    const payload = {
      username: form.username,
      fullName: form.fullName,
      email: form.email || undefined,
      role: form.role as "admin" | "employee" | "director" | "central_director" | "technical_control" | "dga" | "dmg" | "cad_edition" | "cad_payment" | "financial_control",
      departmentId: deptId ?? undefined,
      password: form.password || undefined,
    };

    if (editingUser) {
      const isPending = editingUser.status === "pending";
      const assigningDept = deptId !== null && deptId !== editingUser.departmentId;
      updateMutation.mutate({
        id: editingUser.id,
        data: {
          ...payload,
          status: isPending && assigningDept ? "active" : undefined,
        },
      });
    } else {
      if (!form.password) {
        toast({ title: "Erreur", description: "Le mot de passe est requis", variant: "destructive" });
        return;
      }
      createMutation.mutate({ data: { ...payload, password: form.password } });
    }
  };

  const handleDelete = () => {
    if (!deleteUser) return;
    deleteMutation.mutate({ id: deleteUser.id });
  };

  const handleResetPassword = () => {
    if (!resetUser) return;
    resetPasswordMutation.mutate({ id: resetUser.id });
  };

  const getRoleColor = (roleStr: string) => {
    if (roleStr === "admin") return "bg-destructive/10 text-destructive border-destructive/20";
    if (roleStr === "employee") return "bg-muted text-muted-foreground";
    return "bg-primary/10 text-primary border-primary/20";
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd MMM yyyy", { locale: fr });
    } catch {
      return dateString;
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const pendingCount = data?.data?.filter((u) => (u as UserRow).status === "pending").length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Utilisateurs du Système</h1>
          <p className="text-muted-foreground">
            Gérez les accès, les rôles de validation et les identifiants.
            {pendingCount > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-amber-700 font-medium">
                <Clock className="w-3.5 h-3.5" />
                {pendingCount} compte{pendingCount > 1 ? "s" : ""} en attente
              </span>
            )}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" /> Nouvel Utilisateur
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <CardTitle className="text-lg">Comptes d'accès</CardTitle>
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Username, nom..."
                  className="pl-8"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
              </div>
              <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Rôle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les rôles</SelectItem>
                  {ROLES.map(([key, label]) => (
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
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Rôle / Statut</TableHead>
                  <TableHead>Département</TableHead>
                  <TableHead>Créé le</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-10 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : data?.data && data.data.length > 0 ? (
                  data.data.map((user) => {
                    const u = user as UserRow;
                    const isPending = u.status === "pending";
                    return (
                      <TableRow key={u.id} className={isPending ? "bg-amber-50/50" : ""}>
                        <TableCell>
                          <div className="font-medium">{u.fullName}</div>
                          <div className="text-xs text-muted-foreground font-mono">@{u.username}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant="outline" className={`font-medium text-xs w-fit ${getRoleColor(u.role)}`}>
                              {u.role === "admin" && <ShieldAlert className="w-3 h-3 mr-1" />}
                              {ROLE_LABELS[u.role] || u.role}
                            </Badge>
                            {isPending && (
                              <Badge variant="outline" className="font-medium text-xs w-fit bg-amber-50 text-amber-700 border-amber-300">
                                <Clock className="w-3 h-3 mr-1" />
                                En attente
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{u.departmentName || "-"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(u.createdAt)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {isPending && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs text-amber-700 border-amber-300 hover:bg-amber-50"
                                onClick={() => openEdit(u)}
                              >
                                Affecter
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => openEdit(u)} title="Modifier">
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Réinitialiser mot de passe"
                              onClick={() => setResetUser(u)}
                            >
                              <RotateCcw className="w-4 h-4 text-muted-foreground" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => setDeleteUser(u)}
                              title="Supprimer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      Aucun utilisateur trouvé.
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

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); setEditingUser(null); setForm(emptyForm); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="w-5 h-5" />
              {editingUser ? "Modifier l'utilisateur" : "Nouvel utilisateur"}
            </DialogTitle>
            <DialogDescription>
              {editingUser?.status === "pending"
                ? "Ce compte est en attente. Affectez un département pour l'activer automatiquement."
                : editingUser
                ? "Modifiez les informations de l'utilisateur."
                : "Créez un nouveau compte d'accès au système."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Nom complet *</Label>
                <Input
                  id="fullName"
                  value={form.fullName}
                  onChange={(e) => setForm(f => ({ ...f, fullName: e.target.value }))}
                  placeholder="Prénom et Nom"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="username">Nom d'utilisateur *</Label>
                <Input
                  id="username"
                  value={form.username}
                  onChange={(e) => setForm(f => ({ ...f, username: e.target.value }))}
                  placeholder="ex: ahmed.dg"
                  required
                  disabled={!!editingUser}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="email@somelec.mr"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="role">Rôle *</Label>
                <Select value={form.role} onValueChange={(v) => setForm(f => ({ ...f, role: v }))}>
                  <SelectTrigger id="role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="department">
                  Département
                  {editingUser?.status === "pending" && (
                    <span className="ml-1 text-amber-600 font-medium">(requis pour activer)</span>
                  )}
                </Label>
                <Select value={form.departmentId} onValueChange={(v) => setForm(f => ({ ...f, departmentId: v === "none" ? "" : v }))}>
                  <SelectTrigger id="department">
                    <SelectValue placeholder="Aucun" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto">
                    <SelectItem value="none">Aucun département</SelectItem>
                    {deptsData?.data?.map((d) => (
                      <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">
                {editingUser ? "Nouveau mot de passe (laisser vide pour ne pas changer)" : "Mot de passe *"}
              </Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder={editingUser ? "••••••••" : "Minimum 6 caractères"}
                required={!editingUser}
                minLength={editingUser ? undefined : 6}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); setEditingUser(null); setForm(emptyForm); }}>
                Annuler
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving
                  ? "Enregistrement..."
                  : editingUser?.status === "pending"
                  ? "Activer & Enregistrer"
                  : editingUser
                  ? "Mettre à jour"
                  : "Créer l'utilisateur"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteUser} onOpenChange={(open) => { if (!open) setDeleteUser(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'utilisateur</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer <strong>{deleteUser?.fullName}</strong> (@{deleteUser?.username}) ?
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

      {/* Reset password confirmation */}
      <AlertDialog open={!!resetUser} onOpenChange={(open) => { if (!open) setResetUser(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Réinitialiser le mot de passe</AlertDialogTitle>
            <AlertDialogDescription>
              Le mot de passe de <strong>{resetUser?.fullName}</strong> sera réinitialisé au mot de passe
              par défaut (<strong>Somelec@2024</strong>). L'utilisateur devra le changer lors de sa prochaine connexion.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetPassword} disabled={resetPasswordMutation.isPending}>
              {resetPasswordMutation.isPending ? "Réinitialisation..." : "Réinitialiser"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
