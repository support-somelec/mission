import { useState, useMemo } from "react";
import { useGetReporting, useListDepartments } from "@workspace/api-client-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, CheckCircle, XCircle, Clock, BarChart3,
  ArrowUpDown, ArrowUp, ArrowDown, Banknote, Wallet, CreditCard,
} from "lucide-react";

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);
const MONTHS = [
  { value: "1", label: "Janvier" },
  { value: "2", label: "Février" },
  { value: "3", label: "Mars" },
  { value: "4", label: "Avril" },
  { value: "5", label: "Mai" },
  { value: "6", label: "Juin" },
  { value: "7", label: "Juillet" },
  { value: "8", label: "Août" },
  { value: "9", label: "Septembre" },
  { value: "10", label: "Octobre" },
  { value: "11", label: "Novembre" },
  { value: "12", label: "Décembre" },
];

type SortDir = "asc" | "desc";

function formatMRU(amount: number): string {
  return `${Math.round(amount).toLocaleString("fr-FR")} MRU`;
}

function StatCard({
  title,
  value,
  icon: Icon,
  color,
  sub,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground truncate">{title}</p>
            <p className="text-2xl font-bold mt-1 leading-tight">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={`p-2.5 rounded-full shrink-0 ${color}`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SortIcon({ col, sortCol, sortDir }: { col: string; sortCol: string; sortDir: SortDir }) {
  if (col !== sortCol) return <ArrowUpDown className="w-3.5 h-3.5 ml-1 text-muted-foreground/50" />;
  return sortDir === "desc"
    ? <ArrowDown className="w-3.5 h-3.5 ml-1 text-primary" />
    : <ArrowUp className="w-3.5 h-3.5 ml-1 text-primary" />;
}

function CostTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-semibold">{formatMRU(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

export default function Reporting() {
  const [year, setYear] = useState<number>(CURRENT_YEAR);
  const [month, setMonth] = useState<string>("all");
  const [departmentId, setDepartmentId] = useState<string>("all");
  const [sortCol, setSortCol] = useState<string>("missionCount");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const { data: depts } = useListDepartments({ limit: 100 });
  const { data, isLoading } = useGetReporting({
    year,
    ...(month !== "all" ? { month: Number(month) } : {}),
    ...(departmentId !== "all" ? { departmentId: Number(departmentId) } : {}),
  });

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
  };

  const sortedEmployees = useMemo(() => {
    if (!data?.byEmployee) return [];
    return [...data.byEmployee].sort((a, b) => {
      let av: string | number = 0;
      let bv: string | number = 0;
      if (sortCol === "missionCount") { av = a.missionCount; bv = b.missionCount; }
      else if (sortCol === "totalFees") { av = a.totalFees; bv = b.totalFees; }
      else if (sortCol === "name") { av = [a.firstName, a.lastName].filter(Boolean).join(" "); bv = [b.firstName, b.lastName].filter(Boolean).join(" "); }
      else if (sortCol === "matricule") { av = a.matricule ?? ""; bv = b.matricule ?? ""; }
      else if (sortCol === "department") { av = a.departmentName; bv = b.departmentName; }
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "desc" ? bv - av : av - bv;
      }
      return sortDir === "desc"
        ? String(bv).localeCompare(String(av), "fr")
        : String(av).localeCompare(String(bv), "fr");
    });
  }, [data?.byEmployee, sortCol, sortDir]);

  const showMonthChart = month === "all";
  const monthLabel = MONTHS.find((m) => m.value === month)?.label;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-primary" />
            Tableau de Reporting
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Analyse des missions par direction, par mois et par agent
          </p>
        </div>

        {/* Filtres */}
        <div className="flex gap-2 flex-wrap">
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Tous les mois" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les mois</SelectItem>
              {MONTHS.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={departmentId} onValueChange={setDepartmentId}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Toutes les directions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les directions</SelectItem>
              {depts?.data?.map((d) => (
                <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
        </div>
      ) : !data ? null : (
        <>
          {/* KPIs — Missions */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Total missions" value={data.totalMissions} icon={TrendingUp} color="bg-blue-500" />
            <StatCard title="Approuvées" value={data.totalApproved} icon={CheckCircle} color="bg-green-500" />
            <StatCard title="Rejetées" value={data.totalRejected} icon={XCircle} color="bg-red-500" />
            <StatCard title="En cours" value={data.totalInProgress} icon={Clock} color="bg-amber-500" />
          </div>

          {/* KPIs — Coûts */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="Coût Total Missions"
              value={formatMRU(data.totalCost)}
              icon={Banknote}
              color="bg-violet-600"
              sub="Frais journaliers de toutes les missions"
            />
            <StatCard
              title="Payé CAD (70%)"
              value={formatMRU(data.totalPaidCost)}
              icon={CreditCard}
              color="bg-teal-600"
              sub="Avance versée par la CAD"
            />
            <StatCard
              title="Solde DRH (30%)"
              value={formatMRU(data.totalRemainingCost)}
              icon={Wallet}
              color="bg-orange-500"
              sub="Complément versé par la DRH"
            />
          </div>

          {/* Graphique évolution mensuelle — missions */}
          {showMonthChart && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  Évolution mensuelle des missions — {year}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={data.byMonth} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="monthLabel"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v: string) => v.substring(0, 3)}
                    />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="total" name="Total" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="approved" name="Approuvées" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="rejected" name="Rejetées" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Graphique évolution mensuelle — coûts */}
          {showMonthChart && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Banknote className="w-4 h-4 text-violet-600" />
                  Évolution mensuelle des coûts (MRU) — {year}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={data.byMonth} margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="monthLabel"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v: string) => v.substring(0, 3)}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v: number) =>
                        v >= 1_000_000
                          ? `${(v / 1_000_000).toFixed(1)}M`
                          : v >= 1_000
                          ? `${(v / 1_000).toFixed(0)}k`
                          : String(v)
                      }
                    />
                    <Tooltip content={<CostTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line
                      type="monotone"
                      dataKey="totalCost"
                      name="Coût total (MRU)"
                      stroke="#7c3aed"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Graphique et tableau par direction */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="w-4 h-4 text-primary" />
                Missions par direction
                {monthLabel && (
                  <span className="text-xs font-normal text-muted-foreground ml-1">
                    — {monthLabel} {year}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.byDepartment.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-10">
                  Aucune donnée pour cette période
                </p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={Math.max(200, data.byDepartment.length * 40)}>
                    <BarChart layout="vertical" data={data.byDepartment} margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                      <YAxis type="category" dataKey="departmentName" tick={{ fontSize: 11 }} width={160} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="approved" name="Approuvées" stackId="a" fill="#22c55e" />
                      <Bar dataKey="rejected" name="Rejetées" stackId="a" fill="#ef4444" />
                      <Bar dataKey="inProgress" name="En cours" stackId="a" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>

                  {/* Tableau coûts par direction */}
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40">
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Direction</th>
                          <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Missions</th>
                          <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Coût Total</th>
                          <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">CAD (70%)</th>
                          <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">DRH (30%)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...data.byDepartment]
                          .sort((a, b) => b.totalCost - a.totalCost)
                          .map((d) => (
                            <tr key={d.departmentId} className="border-b last:border-0 hover:bg-muted/20">
                              <td className="px-4 py-2.5 font-medium">{d.departmentName}</td>
                              <td className="px-4 py-2.5 text-right">{d.total}</td>
                              <td className="px-4 py-2.5 text-right font-mono text-xs">{formatMRU(d.totalCost)}</td>
                              <td className="px-4 py-2.5 text-right font-mono text-xs text-teal-700">{formatMRU(Math.round(d.totalCost * 0.7))}</td>
                              <td className="px-4 py-2.5 text-right font-mono text-xs text-orange-600">{formatMRU(Math.round(d.totalCost * 0.3))}</td>
                            </tr>
                          ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-muted/40 font-semibold border-t-2">
                          <td className="px-4 py-2.5">Total</td>
                          <td className="px-4 py-2.5 text-right">{data.totalMissions}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-xs">{formatMRU(data.totalCost)}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-xs text-teal-700">{formatMRU(data.totalPaidCost)}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-xs text-orange-600">{formatMRU(data.totalRemainingCost)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Tableau par agent — triable */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="w-4 h-4 text-primary" />
                Top 20 agents
                {monthLabel && (
                  <span className="text-xs font-normal text-muted-foreground ml-1">
                    — {monthLabel} {year}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {sortedEmployees.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-10">
                  Aucune donnée pour cette période
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground w-8">#</th>
                        <th
                          className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none"
                          onClick={() => handleSort("name")}
                        >
                          <span className="flex items-center">
                            Agent <SortIcon col="name" sortCol={sortCol} sortDir={sortDir} />
                          </span>
                        </th>
                        <th
                          className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none"
                          onClick={() => handleSort("matricule")}
                        >
                          <span className="flex items-center">
                            Matricule <SortIcon col="matricule" sortCol={sortCol} sortDir={sortDir} />
                          </span>
                        </th>
                        <th
                          className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none"
                          onClick={() => handleSort("department")}
                        >
                          <span className="flex items-center">
                            Direction <SortIcon col="department" sortCol={sortCol} sortDir={sortDir} />
                          </span>
                        </th>
                        <th
                          className="text-right px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none"
                          onClick={() => handleSort("missionCount")}
                        >
                          <span className="flex items-center justify-end">
                            Missions <SortIcon col="missionCount" sortCol={sortCol} sortDir={sortDir} />
                          </span>
                        </th>
                        <th
                          className="text-right px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none"
                          onClick={() => handleSort("totalFees")}
                        >
                          <span className="flex items-center justify-end">
                            Frais Total <SortIcon col="totalFees" sortCol={sortCol} sortDir={sortDir} />
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedEmployees.map((emp, idx) => (
                        <tr key={emp.employeeId} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 text-muted-foreground">{idx + 1}</td>
                          <td className="px-4 py-3 font-medium">{[emp.firstName, emp.lastName].filter(Boolean).join(" ")}</td>
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{emp.matricule}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{emp.departmentName}</td>
                          <td className="px-4 py-3 text-right">
                            <Badge variant={sortCol === "missionCount" && sortDir === "desc" && idx === 0 ? "default" : "secondary"}>
                              {emp.missionCount}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs">
                            {emp.totalFees > 0
                              ? <span className="text-violet-700 font-semibold">{formatMRU(emp.totalFees)}</span>
                              : <span className="text-muted-foreground">—</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
