import { useState } from "react";
import {
  useGetDashboardStats,
  useGetPendingValidations,
  useListMissions,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Map,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from "lucide-react";

const PAGE_SIZE = 10;

function formatDate(d: string) {
  try {
    return format(new Date(d), "dd MMM yyyy", { locale: fr });
  } catch {
    return d;
  }
}

function MissionsTable({
  missions,
  isLoading,
  page,
  totalPages,
  total,
  onPage,
}: {
  missions: {
    id: number;
    title: string;
    destination: string;
    departmentName?: string | null;
    startDate: string;
    endDate: string;
    status: string;
    orderNumber?: string | null;
    createdByName?: string | null;
    employeeCount?: number;
    durationDays?: number;
  }[];
  isLoading: boolean;
  page: number;
  totalPages: number;
  total: number;
  onPage: (p: number) => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (missions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
        <Map className="w-8 h-8 opacity-40" />
        <p className="text-sm">Aucune mission trouvée</p>
      </div>
    );
  }

  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[130px]">N° / OM</TableHead>
              <TableHead>Titre</TableHead>
              <TableHead>Destination</TableHead>
              <TableHead>Direction</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead className="text-center">Durée</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {missions.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-mono text-xs">
                  {m.orderNumber ? (
                    <span className="text-primary font-semibold">{m.orderNumber}</span>
                  ) : (
                    <span className="text-muted-foreground">#{String(m.id).padStart(4, "0")}</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="font-medium text-sm leading-tight max-w-[220px] truncate">{m.title}</div>
                  {m.createdByName && (
                    <div className="text-xs text-muted-foreground truncate">{m.createdByName}</div>
                  )}
                </TableCell>
                <TableCell className="text-sm">{m.destination}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[140px] truncate">
                  {m.departmentName || "-"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatDate(m.startDate)}<br />→ {formatDate(m.endDate)}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary" className="text-xs">
                    {m.durationDays ?? "-"} j
                  </Badge>
                </TableCell>
                <TableCell>
                  <StatusBadge status={m.status} />
                </TableCell>
                <TableCell className="text-right">
                  <Link href={`/missions/${m.id}`}>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Eye className="w-4 h-4" />
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 px-1">
          <p className="text-sm text-muted-foreground">
            {from}–{to} sur {total} mission{total > 1 ? "s" : ""}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page === 1}
              onClick={() => onPage(page - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm px-2">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page === totalPages}
              onClick={() => onPage(page + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [allPage, setAllPage] = useState(1);
  const [pendingPage, setPendingPage] = useState(1);

  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();

  const { data: allMissions, isLoading: allLoading } = useListMissions({
    page: allPage,
    limit: PAGE_SIZE,
  });

  const { data: pendingData, isLoading: pendingLoading } = useGetPendingValidations({
    page: pendingPage,
    limit: PAGE_SIZE,
  });

  const pendingCount = pendingData?.total ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tableau de Bord</h1>
        <p className="text-muted-foreground">
          Bienvenue, {user?.fullName}. Voici l'état actuel des missions.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Missions Totales",
            value: stats?.totalMissions,
            icon: <Map className="h-4 w-4 text-muted-foreground" />,
          },
          {
            label: "En Attente de Validation",
            value: stats?.pendingValidations,
            icon: <Clock className="h-4 w-4 text-amber-500" />,
          },
          {
            label: "Missions Approuvées",
            value: stats?.approvedMissions,
            icon: <CheckCircle className="h-4 w-4 text-emerald-500" />,
          },
          {
            label: "Missions Rejetées",
            value: stats?.rejectedMissions,
            icon: <XCircle className="h-4 w-4 text-destructive" />,
          },
        ].map(({ label, value, icon }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{label}</CardTitle>
              {icon}
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-7 w-20" />
              ) : (
                <div className="text-2xl font-bold">{value ?? 0}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">
            Toutes les missions
            {allMissions?.total != null && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {allMissions.total}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="pending">
            <span className="flex items-center gap-1.5">
              {pendingCount > 0 && (
                <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
              )}
              À valider
              {pendingCount > 0 && (
                <Badge className="ml-1 text-xs bg-amber-500 text-white">
                  {pendingCount}
                </Badge>
              )}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <MissionsTable
            missions={(allMissions?.data ?? []) as Parameters<typeof MissionsTable>[0]["missions"]}
            isLoading={allLoading}
            page={allPage}
            totalPages={allMissions?.totalPages ?? 1}
            total={allMissions?.total ?? 0}
            onPage={setAllPage}
          />
        </TabsContent>

        <TabsContent value="pending" className="mt-4">
          <MissionsTable
            missions={(pendingData?.data ?? []) as Parameters<typeof MissionsTable>[0]["missions"]}
            isLoading={pendingLoading}
            page={pendingPage}
            totalPages={pendingData?.totalPages ?? 1}
            total={pendingData?.total ?? 0}
            onPage={setPendingPage}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
