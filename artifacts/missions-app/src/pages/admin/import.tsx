import { useState, useRef } from "react";
import { Upload, Download, CheckCircle2, XCircle, Loader2, FileSpreadsheet, AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

// ─── Types ───────────────────────────────────────────────────────────────────

const VALID_STATUSES = [
  "pending_central_director",
  "pending_technical_control",
  "pending_dga",
  "pending_dmg",
  "en_vigueur",
  "pending_cad_payment",
  "pending_financial_control",
] as const;

const STATUS_LABELS: Record<string, string> = {
  pending_central_director:  "En attente Dir. Central",
  pending_technical_control: "Contrôle Technique",
  pending_dga:               "En attente DGA",
  pending_dmg:               "En attente DMG",
  en_vigueur:                "En Vigueur",
  pending_cad_payment:       "En attente CAD Paiement",
  pending_financial_control: "Contrôle Financier",
};

const CSV_COLUMNS = [
  "titre",
  "expression_besoins",
  "plan_action",
  "date_debut",
  "date_fin",
  "destination",
  "statut",
  "vehicule",
  "carburant",
  "nb_vehicules",
  "matricules_employes",
];

interface ParsedRow {
  rowNum: number;
  data: Record<string, string>;
  errors: string[];
}

interface ImportResult {
  row: number;
  status: "success" | "error";
  missionId?: number;
  error?: string;
}

// ─── CSV Parsing ──────────────────────────────────────────────────────────────

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function validateRow(data: Record<string, string>, rowNum: number): string[] {
  const errors: string[] = [];
  if (!data.titre?.trim()) errors.push("titre manquant");
  if (!data.expression_besoins?.trim()) errors.push("expression_besoins manquant");
  if (!data.plan_action?.trim()) errors.push("plan_action manquant");
  if (!data.date_debut?.match(/^\d{4}-\d{2}-\d{2}$/)) errors.push("date_debut invalide (AAAA-MM-JJ attendu)");
  if (!data.date_fin?.match(/^\d{4}-\d{2}-\d{2}$/)) errors.push("date_fin invalide (AAAA-MM-JJ attendu)");
  if (data.date_debut && data.date_fin && data.date_fin < data.date_debut)
    errors.push("date_fin antérieure à date_debut");
  if (!data.destination?.trim()) errors.push("destination manquante");
  if (!VALID_STATUSES.includes(data.statut as typeof VALID_STATUSES[number]))
    errors.push(`statut invalide : "${data.statut}"`);
  if (!data.matricules_employes?.trim()) errors.push("matricules_employes manquant");
  return errors;
}

function parseCsv(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const data: Record<string, string> = {};
    headers.forEach((h, idx) => { data[h] = values[idx] ?? ""; });
    const errors = validateRow(data, i + 1);
    rows.push({ rowNum: i + 1, data, errors });
  }
  return rows;
}

// ─── Template CSV ─────────────────────────────────────────────────────────────

function downloadTemplate() {
  const headers = CSV_COLUMNS.join(",");
  const example = [
    '"Inspection technique à Nouadhibou"',
    '"Vérification des installations haute tension suite aux pannes récentes"',
    '"Inspection visuelle, tests de charge, rapport technique"',
    "2026-06-10",
    "2026-06-14",
    "Nouadhibou",
    "pending_dmg",
    "oui",
    "non",
    "2",
    '"MAT001;MAT002"',
  ].join(",");
  const csv = `${headers}\n${example}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "modele_import_missions.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminImport() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[] | null>(null);

  const validRows = rows.filter((r) => r.errors.length === 0);
  const invalidRows = rows.filter((r) => r.errors.length > 0);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResults(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCsv(text);
      setRows(parsed);
    };
    reader.readAsText(file, "UTF-8");
  };

  const handleImport = async () => {
    if (validRows.length === 0) return;
    setIsImporting(true);
    try {
      const payload = validRows.map((r) => ({
        titre:               r.data.titre,
        expression_besoins:  r.data.expression_besoins,
        plan_action:         r.data.plan_action,
        date_debut:          r.data.date_debut,
        date_fin:            r.data.date_fin,
        destination:         r.data.destination,
        statut:              r.data.statut,
        vehicule:            r.data.vehicule,
        carburant:           r.data.carburant,
        nb_vehicules:        r.data.nb_vehicules,
        matricules_employes: r.data.matricules_employes,
      }));

      const res = await fetch("/api/admin/import/missions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        toast({ title: "Erreur", description: json.error ?? "Import échoué", variant: "destructive" });
        return;
      }

      setResults(json.results);
      toast({
        title: `Import terminé`,
        description: `${json.successCount} mission(s) importée(s) avec succès, ${json.errorCount} erreur(s).`,
        variant: json.errorCount === 0 ? "default" : "destructive",
      });
    } catch {
      toast({ title: "Erreur réseau", description: "Impossible de contacter le serveur.", variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  };

  const reset = () => {
    setRows([]);
    setFileName("");
    setResults(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Import de missions</h1>
        <p className="text-muted-foreground">Migrez vos anciennes missions depuis un fichier CSV.</p>
      </div>

      {/* Aide format */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="w-4 h-4" /> Format du fichier CSV
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 text-xs">
            {CSV_COLUMNS.map((col) => (
              <code key={col} className="bg-muted px-2 py-1 rounded font-mono">{col}</code>
            ))}
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            <p><strong>date_debut / date_fin</strong> : format <code className="bg-muted px-1 rounded">AAAA-MM-JJ</code> (ex : 2026-06-10)</p>
            <p><strong>statut</strong> : une des valeurs suivantes :</p>
            <div className="flex flex-wrap gap-2 mt-1">
              {VALID_STATUSES.map((s) => (
                <span key={s} className="inline-flex items-center gap-1 text-xs border rounded px-2 py-0.5">
                  <code className="font-mono text-primary">{s}</code>
                  <span className="text-muted-foreground">→ {STATUS_LABELS[s]}</span>
                </span>
              ))}
            </div>
            <p><strong>vehicule / carburant</strong> : <code className="bg-muted px-1 rounded">oui</code> ou <code className="bg-muted px-1 rounded">non</code></p>
            <p><strong>matricules_employes</strong> : matricule <em>ou</em> NNI de chaque agent, séparés par <code className="bg-muted px-1 rounded">;</code> (ex : <code className="bg-muted px-1 rounded">MAT001;12345678901234</code>)</p>
          </div>
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="w-4 h-4 mr-2" /> Télécharger le modèle CSV
          </Button>
        </CardContent>
      </Card>

      {/* Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sélectionner le fichier</CardTitle>
          <CardDescription>Fichier CSV encodé en UTF-8, première ligne = en-têtes.</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/30 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <FileSpreadsheet className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            {fileName ? (
              <p className="font-medium">{fileName}</p>
            ) : (
              <p className="text-muted-foreground">Cliquez pour choisir un fichier CSV</p>
            )}
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
          </div>
        </CardContent>
      </Card>

      {/* Aperçu */}
      {rows.length > 0 && !results && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>Aperçu — {rows.length} ligne(s) détectée(s)</span>
              <div className="flex gap-2 text-sm font-normal">
                <Badge variant="secondary" className="bg-green-100 text-green-800">{validRows.length} valide(s)</Badge>
                {invalidRows.length > 0 && (
                  <Badge variant="destructive">{invalidRows.length} erreur(s)</Badge>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {invalidRows.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {invalidRows.length} ligne(s) contiennent des erreurs et seront ignorées. Seules les lignes valides seront importées.
                </AlertDescription>
              </Alert>
            )}

            <div className="overflow-x-auto rounded border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Titre</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Matricules</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.rowNum} className={row.errors.length > 0 ? "bg-red-50" : ""}>
                      <TableCell className="font-mono text-xs text-muted-foreground">{row.rowNum}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={row.data.titre}>{row.data.titre || "—"}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {row.data.date_debut || "?"} → {row.data.date_fin || "?"}
                      </TableCell>
                      <TableCell>{row.data.destination || "—"}</TableCell>
                      <TableCell>
                        {row.data.statut ? (
                          <Badge variant="outline" className="text-xs">{STATUS_LABELS[row.data.statut] ?? row.data.statut}</Badge>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-xs font-mono">{row.data.matricules_employes || "—"}</TableCell>
                      <TableCell>
                        {row.errors.length === 0 ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        ) : (
                          <span title={row.errors.join("\n")}>
                            <XCircle className="w-4 h-4 text-destructive cursor-help" />
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Détail des erreurs */}
            {invalidRows.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-destructive">Détail des erreurs :</p>
                {invalidRows.map((row) => (
                  <div key={row.rowNum} className="text-xs text-destructive bg-red-50 border border-red-200 rounded px-3 py-2">
                    <span className="font-semibold">Ligne {row.rowNum} :</span> {row.errors.join(" · ")}
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button onClick={handleImport} disabled={validRows.length === 0 || isImporting}>
                {isImporting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Import en cours...</>
                ) : (
                  <><Upload className="w-4 h-4 mr-2" /> Importer {validRows.length} mission(s)</>
                )}
              </Button>
              <Button variant="outline" onClick={reset}>Annuler</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Résultats */}
      {results && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              Résultats de l'import
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-semibold">{results.filter((r) => r.status === "success").length} importée(s)</span>
              </div>
              {results.filter((r) => r.status === "error").length > 0 && (
                <div className="flex items-center gap-2 text-destructive bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <XCircle className="w-5 h-5" />
                  <span className="font-semibold">{results.filter((r) => r.status === "error").length} échec(s)</span>
                </div>
              )}
            </div>

            {results.filter((r) => r.status === "error").length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-destructive">Erreurs :</p>
                {results.filter((r) => r.status === "error").map((r) => (
                  <div key={r.row} className="text-xs text-destructive bg-red-50 border border-red-200 rounded px-3 py-2">
                    <span className="font-semibold">Ligne {r.row} :</span> {r.error}
                  </div>
                ))}
              </div>
            )}

            <Button variant="outline" onClick={reset}>Nouvel import</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
