import { useState, useRef } from "react";
import { useListEmployees, useCreateEmployee, useUpdateEmployee, useDeleteEmployee, useListDepartments } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Search, Filter, Plus, Edit, Trash2, Upload, FileSpreadsheet, CheckCircle, XCircle, Loader2, Download } from "lucide-react";

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

const CATEGORY_KEYS = Object.keys(EMPLOYEE_CATEGORY_LABELS);

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

type ImportRow = {
  line: number;
  matricule: string;
  firstName: string;
  lastName: string;
  nni: string;
  position: string;
  category: string;
  departmentId: string;
  error?: string;
  status?: "pending" | "success" | "error";
  statusMessage?: string;
};

function parseCsv(text: string): ImportRow[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const rows: ImportRow[] = [];
  const sep = text.includes(";") ? ";" : ",";

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw) continue;

    const cols = raw.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));

    if (i === 0) {
      const first = cols[0].toLowerCase();
      if (first === "matricule" || first === "mat" || first === "#") continue;
    }

    if (cols.length < 5) {
      rows.push({
        line: i + 1, matricule: cols[0] ?? "", firstName: cols[1] ?? "",
        lastName: cols[2] ?? "", nni: cols[3] ?? "", position: cols[4] ?? "",
        category: cols[5] ?? "agent", departmentId: cols[6] ?? "",
        error: "Ligne incomplète (min 5 colonnes requises)",
        status: "pending",
      });
      continue;
    }

    const cat = cols[5]?.toLowerCase() ?? "agent";
    const resolvedCat = CATEGORY_KEYS.includes(cat) ? cat : "agent";

    rows.push({
      line: i + 1,
      matricule: cols[0] ?? "",
      firstName: cols[1] ?? "",
      lastName: cols[2] ?? "",
      nni: cols[3] ?? "",
      position: cols[4] ?? "",
      category: resolvedCat,
      departmentId: cols[6] ?? "",
      error: !cols[0] || !cols[1] || !cols[2] || !cols[4]
        ? "Matricule, Prénom, Nom et Poste sont obligatoires"
        : undefined,
      status: "pending",
    });
  }

  return rows;
}

const CSV_TEMPLATE = [
  "matricule;prenom;nom;nni;poste;categorie;departement_id",
  "EMP-001;Ahmed;Ould Mohamed;2312345678;Ingénieur réseau;other_cadre;",
  "EMP-002;Fatima;Mint Saleck;;Comptable;agent;3",
].join("\n");

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

  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importRunning, setImportRunning] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useListEmployees({
    page,
    limit,
    search: search || undefined,
    category: categoryFilter !== "all" ? categoryFilter : undefined,
  });

  const { data: deptsData } = useListDepartments({ limit: 100 });

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCsv(text);
      setImportRows(rows.map((r) => ({ ...r, status: "pending" as const })));
      setImportDone(false);
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  };

  const handleImport = async () => {
    setImportRunning(true);
    const updated = [...importRows];

    for (let i = 0; i < updated.length; i++) {
      const row = updated[i];
      if (row.error) {
        updated[i] = { ...row, status: "error", statusMessage: row.error };
        setImportRows([...updated]);
        continue;
      }
      try {
        await new Promise<void>((resolve, reject) => {
          createMutation.mutateAsync({
            data: {
              matricule: row.matricule,
              firstName: row.firstName,
              lastName: row.lastName,
              nni: row.nni || undefined,
              position: row.position,
              category: row.category as "dg_dga" | "director" | "chef_department" | "other_cadre" | "agent",
              departmentId: row.departmentId ? parseInt(row.departmentId) : undefined,
            },
          }).then(() => resolve()).catch(reject);
        });
        updated[i] = { ...row, status: "success", statusMessage: "Importé" };
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Erreur";
        updated[i] = { ...row, status: "error", statusMessage: msg };
      }
      setImportRows([...updated]);
    }

    setImportRunning(false);
    setImportDone(true);
    queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
  };

  const closeImport = () => {
    setImportOpen(false);
    setImportRows([]);
    setImportDone(false);
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modele_employes.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const validRows = importRows.filter((r) => !r.error);
  const invalidRows = importRows.filter((r) => r.error);
  const successCount = importRows.filter((r) => r.status === "success").length;
  const errorCount = importRows.filter((r) => r.status === "error").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestion des Employés</h1>
          <p className="text-muted-foreground">Gérez la base de données du personnel (catégories de frais, etc).</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="w-4 h-4 mr-2" /> Importer CSV
          </Button>
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" /> Nouvel Employé
          </Button>
        </div>
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

      {/* Import CSV Dialog */}
      <Dialog open={importOpen} onOpenChange={(open) => { if (!open && !importRunning) closeImport(); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              Importer des employés depuis un fichier CSV
            </DialogTitle>
            <DialogDescription>
              Chargez un fichier CSV avec les colonnes :{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">
                matricule ; prenom ; nom ; nni ; poste ; categorie ; departement_id
              </code>
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 min-h-0">
            {!importDone && (
              <div className="flex flex-col sm:flex-row gap-3">
                <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2">
                  <Download className="w-4 h-4" />
                  Télécharger le modèle CSV
                </Button>
                <div className="flex-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.txt"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full gap-2"
                    disabled={importRunning}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-4 h-4" />
                    {importRows.length > 0 ? "Changer de fichier" : "Choisir un fichier CSV"}
                  </Button>
                </div>
              </div>
            )}

            {importRows.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-muted-foreground">{importRows.length} ligne{importRows.length > 1 ? "s" : ""} détectée{importRows.length > 1 ? "s" : ""}</span>
                  {validRows.length > 0 && <Badge variant="secondary" className="gap-1"><CheckCircle className="w-3 h-3 text-emerald-500" />{validRows.length} valide{validRows.length > 1 ? "s" : ""}</Badge>}
                  {invalidRows.length > 0 && <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />{invalidRows.length} erreur{invalidRows.length > 1 ? "s" : ""}</Badge>}
                  {importDone && <><Badge className="gap-1 bg-emerald-500"><CheckCircle className="w-3 h-3" />{successCount} importé{successCount > 1 ? "s" : ""}</Badge>{errorCount > 0 && <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />{errorCount} échoué{errorCount > 1 ? "s" : ""}</Badge>}</>}
                </div>

                <div className="rounded-md border text-sm overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-xs">
                        <TableHead className="w-8">#</TableHead>
                        <TableHead>Matricule</TableHead>
                        <TableHead>Prénom Nom</TableHead>
                        <TableHead>Poste</TableHead>
                        <TableHead>Catégorie</TableHead>
                        <TableHead className="w-32">Statut</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importRows.map((row, idx) => (
                        <TableRow key={idx} className={row.error && !importDone ? "bg-red-50 dark:bg-red-950/20" : ""}>
                          <TableCell className="text-muted-foreground text-xs">{row.line}</TableCell>
                          <TableCell className="font-mono text-xs">{row.matricule || "—"}</TableCell>
                          <TableCell>{row.firstName} {row.lastName}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">{row.position || "—"}</TableCell>
                          <TableCell className="text-xs">{EMPLOYEE_CATEGORY_LABELS[row.category] ?? row.category}</TableCell>
                          <TableCell>
                            {row.status === "success" && (
                              <span className="flex items-center gap-1 text-emerald-600 text-xs"><CheckCircle className="w-3.5 h-3.5" /> Importé</span>
                            )}
                            {row.status === "error" && (
                              <span className="flex items-center gap-1 text-destructive text-xs" title={row.statusMessage}><XCircle className="w-3.5 h-3.5" /> {row.statusMessage?.slice(0, 20)}…</span>
                            )}
                            {row.status === "pending" && row.error && (
                              <span className="flex items-center gap-1 text-destructive text-xs" title={row.error}><XCircle className="w-3.5 h-3.5" /> {row.error.slice(0, 20)}…</span>
                            )}
                            {row.status === "pending" && !row.error && importRunning && (
                              <span className="flex items-center gap-1 text-muted-foreground text-xs"><Loader2 className="w-3.5 h-3.5 animate-spin" /> En cours…</span>
                            )}
                            {row.status === "pending" && !row.error && !importRunning && (
                              <span className="text-xs text-muted-foreground">En attente</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {importRows.length === 0 && (
              <div className="border-2 border-dashed rounded-lg p-10 text-center text-muted-foreground space-y-2">
                <FileSpreadsheet className="w-10 h-10 mx-auto opacity-30" />
                <p className="text-sm">Choisissez un fichier CSV pour commencer</p>
                <p className="text-xs">Séparateur : point-virgule (;) ou virgule (,) — Encodage UTF-8</p>
              </div>
            )}
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={closeImport} disabled={importRunning}>
              {importDone ? "Fermer" : "Annuler"}
            </Button>
            {!importDone && (
              <Button
                onClick={handleImport}
                disabled={validRows.length === 0 || importRunning}
                className="gap-2"
              >
                {importRunning ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Import en cours…</>
                ) : (
                  <><Upload className="w-4 h-4" /> Importer {validRows.length} employé{validRows.length > 1 ? "s" : ""}</>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create / Edit Dialog */}
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
