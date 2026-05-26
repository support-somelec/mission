import { useState } from "react";
import { useGetReporting, useListDepartments } from "@workspace/api-client-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, CheckCircle, XCircle, Clock, Users, Building2, BarChart3 } from "lucide-react";

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

function StatCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
          </div>
          <div className={`p-3 rounded-full ${color}`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Reporting() {
  const [year, setYear] = useState<number>(CURRENT_YEAR);
  const [departmentId, setDepartmentId] = useState<string>("all");

  const { data: depts } = useListDepartments({ limit: 100 });
  const { data, isLoading } = useGetReporting({
    year,
    ...(departmentId !== "all" ? { departmentId: Number(departmentId) } : {}),
  });

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
        <div className="flex gap-3 flex-wrap">
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
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
                <SelectItem key={d.id} value={String(d.id)}>
                  {d.name}
                </SelectItem>
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
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total missions"
              value={data.totalMissions}
              icon={TrendingUp}
              color="bg-blue-500"
            />
            <StatCard
              title="Approuvées"
              value={data.totalApproved}
              icon={CheckCircle}
              color="bg-green-500"
            />
            <StatCard
              title="Rejetées"
              value={data.totalRejected}
              icon={XCircle}
              color="bg-red-500"
            />
            <StatCard
              title="En cours"
              value={data.totalInProgress}
              icon={Clock}
              color="bg-amber-500"
            />
          </div>

          {/* Graphique par mois */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="w-4 h-4 text-primary" />
                Évolution mensuelle — {year}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
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
                  <Line
                    type="monotone"
                    dataKey="total"
                    name="Total"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="approved"
                    name="Approuvées"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="rejected"
                    name="Rejetées"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Graphique par direction */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="w-4 h-4 text-primary" />
                Missions par direction
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.byDepartment.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-10">
                  Aucune donnée pour cette période
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(260, data.byDepartment.length * 44)}>
                  <BarChart
                    layout="vertical"
                    data={data.byDepartment}
                    margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="departmentName"
                      tick={{ fontSize: 11 }}
                      width={160}
                    />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="approved" name="Approuvées" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="rejected" name="Rejetées" stackId="a" fill="#ef4444" />
                    <Bar dataKey="inProgress" name="En cours" stackId="a" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Tableau par agent */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="w-4 h-4 text-primary" />
                Top 20 agents — nombre de missions
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.byEmployee.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-10">
                  Aucune donnée pour cette période
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground w-8">#</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Agent</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Matricule</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Direction</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">Missions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.byEmployee.map((emp, idx) => (
                        <tr key={emp.employeeId} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 text-muted-foreground">{idx + 1}</td>
                          <td className="px-4 py-3 font-medium">
                            {emp.firstName} {emp.lastName}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                            {emp.matricule}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{emp.departmentName}</td>
                          <td className="px-4 py-3 text-right">
                            <Badge variant={idx === 0 ? "default" : "secondary"}>
                              {emp.missionCount}
                            </Badge>
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
