import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListRemainingPaymentEligible,
  useListRemainingPaymentExports,
  useCreateRemainingPaymentExport,
  getListRemainingPaymentEligibleQueryKey,
  getListRemainingPaymentExportsQueryKey,
} from "@workspace/api-client-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { AlertTriangle, Download, FileSpreadsheet, RefreshCw, Wallet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const MONTHS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const nf = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const mru = (n: number) => `${nf.format(n)} MRU`;
const fmtDT = (s: string) => { try { return format(new Date(s), "dd MMM yyyy à HH:mm", { locale: fr }); } catch { return s; } };
const fmtD = (s: string) => { try { return format(new Date(s), "dd MMM yyyy", { locale: fr }); } catch { return s; } };

async function downloadExport(id: number) {
  const res = await fetch(`/api/admin/remaining-payments/exports/${id}/download`, { credentials: "include" });
  if (!res.ok) throw new Error(`Erreur HTTP ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `reste-30-pourcent-${id}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export default function AdminRemainingPayments() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [month, setMonth] = useState("all");
  const [year, setYear] = useState("all");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const requestRef = useRef<{ key: string; id: string } | null>(null);

  const eligibleQ = useListRemainingPaymentEligible({ query: { queryKey: getListRemainingPaymentEligibleQueryKey(), refetchInterval: 30000 } });
  const exportsQ = useListRemainingPaymentExports({ query: { queryKey: getListRemainingPaymentExportsQueryKey(), refetchInterval: 30000 } });
  const missions = eligibleQ.data ?? [];

  const years = useMemo(() => Array.from(new Set(missions.map((m) => m.year))).sort((a, b) => b - a), [missions]);
  const filtered = useMemo(
    () => missions.filter((m) => (month === "all" || m.month === Number(month)) && (year === "all" || m.year === Number(year))),
    [missions, month, year],
  );
  const filteredEligible = filtered.filter((m) => m.eligible);
  const allChecked = filteredEligible.length > 0 && filteredEligible.every((m) => selected.has(m.id));

  const selectedMissions = missions.filter((m) => selected.has(m.id) && m.eligible);
  const rows = selectedMissions.flatMap((m) => m.rows);
  const total = selectedMissions.reduce((s, m) => s + m.totalRemaining, 0);
  const agentCount = new Set(rows.map((r) => r.employeeId)).size;

  const perAgent = useMemo(() => {
    const map = new Map<number, { employeeId: number; matricule: string | null; nni: string | null; firstName: string; lastName: string; amount: number; missions: number }>();
    for (const r of rows) {
      const e = map.get(r.employeeId);
      if (e) { e.amount += r.amount; e.missions += 1; }
      else map.set(r.employeeId, { ...r, missions: 1 });
    }
    return Array.from(map.values());
  }, [rows]);

  const toggle = (id: number) =>
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () =>
    setSelected((s) => {
      const n = new Set(s);
      if (allChecked) filteredEligible.forEach((m) => n.delete(m.id));
      else filteredEligible.forEach((m) => n.add(m.id));
      return n;
    });

  const create = useCreateRemainingPaymentExport();

  const doDownload = async (id: number) => {
    setDownloadingId(id);
    try { await downloadExport(id); }
    catch (e) {
      toast({ title: "Téléchargement impossible", description: `${(e as Error).message}. Réessayez depuis l'historique ; aucun paiement n'est refait.`, variant: "destructive" });
    } finally { setDownloadingId(null); }
  };

  const submit = () => {
    if (create.isPending) return;
    const ids = selectedMissions.map((m) => m.id).sort((a, b) => a - b);
    const key = ids.join(",");
    if (!requestRef.current || requestRef.current.key !== key) requestRef.current = { key, id: crypto.randomUUID() };
    create.mutate({ data: { missionIds: ids, requestId: requestRef.current.id } }, {
      onSuccess: (exp) => {
        setConfirmOpen(false);
        setSelected(new Set());
        requestRef.current = null;
        qc.invalidateQueries({ queryKey: getListRemainingPaymentEligibleQueryKey() });
        qc.invalidateQueries({ queryKey: getListRemainingPaymentExportsQueryKey() });
        qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0].startsWith("/api/missions") || q.queryKey[0].startsWith("/api/dashboard") || q.queryKey[0].startsWith("/api/reporting")) });
        toast({ title: "Missions marquées totalement payées", description: `Export n° ${exp.id} : ${exp.missionCount} mission(s), ${mru(exp.totalAmount)}.` });
        doDownload(exp.id);
      },
      onError: (err: unknown) => {
        const msg = (err as { data?: { error?: string } })?.data?.error ?? "Erreur lors de la création de l'export. Vous pouvez réessayer avec la même sélection.";
        setConfirmOpen(false);
        qc.invalidateQueries({ queryKey: getListRemainingPaymentEligibleQueryKey() });
        qc.invalidateQueries({ queryKey: getListRemainingPaymentExportsQueryKey() });
        toast({ title: "Erreur", description: msg, variant: "destructive" });
      },
    });
  };

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Wallet className="w-6 h-6 text-primary" /> Règlement du solde 30 %
        </h1>
        <p className="text-muted-foreground">Missions approuvées dont le solde de 30 % reste à régler. Génération du fichier XLSX pour la SOMELEC.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <CardTitle className="text-base">Missions en attente de règlement</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="w-[150px]" data-testid="select-month"><SelectValue placeholder="Mois" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les mois</SelectItem>
                  {MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger className="w-[130px]" data-testid="select-year"><SelectValue placeholder="Année" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les années</SelectItem>
                  {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {eligibleQ.isLoading ? (
            <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : eligibleQ.isError ? (
            <div className="text-center py-8 space-y-3">
              <p className="text-destructive text-sm">Impossible de charger les missions.</p>
              <Button variant="outline" size="sm" onClick={() => eligibleQ.refetch()}><RefreshCw className="w-4 h-4 mr-2" />Réessayer</Button>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox checked={allChecked} disabled={filteredEligible.length === 0} onCheckedChange={toggleAll} aria-label="Tout sélectionner" data-testid="checkbox-select-all" />
                    </TableHead>
                    <TableHead>Mission</TableHead>
                    <TableHead>Départ</TableHead>
                    <TableHead>Période</TableHead>
                    <TableHead className="text-right">Agents</TableHead>
                    <TableHead className="text-right">Solde 30 %</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Aucune mission en attente de règlement pour ce filtre.</TableCell></TableRow>
                  ) : filtered.map((m) => (
                    <TableRow key={m.id} className={!m.eligible ? "bg-muted/30" : undefined} data-testid={`row-mission-${m.id}`}>
                      <TableCell><Checkbox checked={selected.has(m.id)} disabled={!m.eligible} onCheckedChange={() => toggle(m.id)} data-testid={`checkbox-mission-${m.id}`} /></TableCell>
                      <TableCell>
                        <div className="font-medium font-mono text-sm">{m.missionNumber}</div>
                        <div className="text-xs text-muted-foreground max-w-[280px] truncate">{m.title}</div>
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{fmtD(m.startDate)}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{MONTHS[m.month - 1]} {m.year}</TableCell>
                      <TableCell className="text-right text-sm">{m.rows.length}</TableCell>
                      <TableCell className="text-right font-mono text-sm whitespace-nowrap">{mru(m.totalRemaining)}</TableCell>
                      <TableCell>
                        {m.eligible ? (
                          <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50">Éligible</Badge>
                        ) : (
                          <div className="flex items-start gap-1.5 text-xs text-amber-700 max-w-[260px]">
                            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                            <span>{m.ineligibilityReason ?? "Données manquantes (agents ou identifiants)."}</span>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <CardTitle className="text-base">Aperçu par agent</CardTitle>
            <div className="flex items-center gap-4 flex-wrap text-sm" data-testid="text-selection-totals">
              <span><span className="text-muted-foreground">Missions :</span> <strong>{selectedMissions.length}</strong></span>
              <span><span className="text-muted-foreground">Agents :</span> <strong>{agentCount}</strong></span>
              <span><span className="text-muted-foreground">Total :</span> <strong className="font-mono text-primary">{mru(total)}</strong></span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedMissions.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8 border rounded-md border-dashed">Sélectionnez des missions éligibles pour afficher l'aperçu.</div>
          ) : (
            <>
              <div className="rounded-md border overflow-x-auto max-h-[420px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mission</TableHead>
                      <TableHead>Matricule</TableHead>
                      <TableHead>NNI</TableHead>
                      <TableHead>Nom</TableHead>
                      <TableHead>Prénom</TableHead>
                      <TableHead>Mois</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={`${r.missionId}-${r.employeeId}`}>
                        <TableCell className="font-mono text-xs">{r.missionNumber}</TableCell>
                        <TableCell className="font-mono text-xs">{r.matricule ?? "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{r.nni ?? "—"}</TableCell>
                        <TableCell className="text-sm font-medium">{r.lastName}</TableCell>
                        <TableCell className="text-sm">{r.firstName}</TableCell>
                        <TableCell className="text-sm whitespace-nowrap">{MONTHS[r.month - 1]} {r.year}</TableCell>
                        <TableCell className="text-right font-mono text-sm whitespace-nowrap">{mru(r.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground">
                Cumul par agent : {perAgent.map((a) => `${a.lastName} ${a.firstName} (${mru(a.amount)}${a.missions > 1 ? `, ${a.missions} missions` : ""})`).join(" · ")}
              </p>
            </>
          )}
          <div className="flex justify-end">
            <Button disabled={selectedMissions.length === 0 || create.isPending} onClick={() => setConfirmOpen(true)} data-testid="button-generate">
              <FileSpreadsheet className="w-4 h-4 mr-2" /> Générer le fichier et marquer payées
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Historique des exports</CardTitle></CardHeader>
        <CardContent>
          {exportsQ.isLoading ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : exportsQ.isError ? (
            <div className="text-center py-6 space-y-3">
              <p className="text-destructive text-sm">Impossible de charger l'historique.</p>
              <Button variant="outline" size="sm" onClick={() => exportsQ.refetch()}><RefreshCw className="w-4 h-4 mr-2" />Réessayer</Button>
            </div>
          ) : (exportsQ.data ?? []).length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8 border rounded-md border-dashed">Aucun export généré pour le moment.</div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N°</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Créé par</TableHead>
                    <TableHead className="text-right">Missions</TableHead>
                    <TableHead className="text-right">Agents</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exportsQ.data!.map((e) => (
                    <TableRow key={e.id} data-testid={`row-export-${e.id}`}>
                      <TableCell className="font-mono text-sm">{e.id}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{fmtDT(e.createdAt)}</TableCell>
                      <TableCell className="text-sm">{e.createdByName}</TableCell>
                      <TableCell className="text-right text-sm">{e.missionCount}</TableCell>
                      <TableCell className="text-right text-sm">{e.employeeCount}</TableCell>
                      <TableCell className="text-right font-mono text-sm whitespace-nowrap">{mru(e.totalAmount)}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" disabled={downloadingId === e.id} onClick={() => doDownload(e.id)} data-testid={`button-download-${e.id}`}>
                          <Download className="w-4 h-4 mr-1.5" />{downloadingId === e.id ? "..." : "XLSX"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={(o) => { if (!create.isPending) setConfirmOpen(o); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="w-5 h-5" /> Confirmer le règlement</DialogTitle>
            <DialogDescription>
              Les <strong>{selectedMissions.length} mission(s)</strong> sélectionnée(s) seront marquées <strong>totalement payées</strong> de façon <strong>irréversible</strong>. Cette action ne constitue pas un virement bancaire : elle génère uniquement le fichier à transmettre à la SOMELEC.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted/50 rounded-lg p-4 space-y-1 text-sm">
            <div className="flex justify-between"><span>Agents</span><span className="font-mono">{agentCount}</span></div>
            <div className="flex justify-between font-semibold"><span>Total à régler</span><span className="font-mono">{mru(total)}</span></div>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={create.isPending} onClick={() => setConfirmOpen(false)}>Annuler</Button>
            <Button variant="destructive" disabled={create.isPending} onClick={submit} data-testid="button-confirm-payment">
              {create.isPending ? "Traitement..." : "Confirmer, marquer payées"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
