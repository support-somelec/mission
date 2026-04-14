import { useGetDashboardStats, useGetPendingValidations, useGetRecentMissions } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Map, Clock, CheckCircle, XCircle, Users, Building, Activity } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";

export default function Dashboard() {
  const { user } = useAuth();
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: pending, isLoading: pendingLoading } = useGetPendingValidations({ page: 1, limit: 5 });
  const { data: recent, isLoading: recentLoading } = useGetRecentMissions({ page: 1, limit: 5 });

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd MMM yyyy", { locale: fr });
    } catch (e) {
      return dateString;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tableau de Bord</h1>
        <p className="text-muted-foreground">Bienvenue, {user?.fullName}. Voici l'état actuel des missions.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Missions Totales</CardTitle>
            <Map className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? <Skeleton className="h-7 w-20" /> : (
              <div className="text-2xl font-bold">{stats?.totalMissions || 0}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En Attente de Validation</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            {statsLoading ? <Skeleton className="h-7 w-20" /> : (
              <div className="text-2xl font-bold">{stats?.pendingValidations || 0}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Missions Approuvées</CardTitle>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            {statsLoading ? <Skeleton className="h-7 w-20" /> : (
              <div className="text-2xl font-bold">{stats?.approvedMissions || 0}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Missions Rejetées</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            {statsLoading ? <Skeleton className="h-7 w-20" /> : (
              <div className="text-2xl font-bold">{stats?.rejectedMissions || 0}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Missions Récentes</CardTitle>
            <CardDescription>
              Les dernières missions créées dans le système.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : recent?.data && recent.data.length > 0 ? (
              <div className="space-y-4">
                {recent.data.map(mission => (
                  <div key={mission.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">{mission.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {mission.destination} • Du {formatDate(mission.startDate)} au {formatDate(mission.endDate)}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <StatusBadge status={mission.status} />
                      <Link href={`/missions/${mission.id}`}>
                        <Button variant="ghost" size="sm">Voir</Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                Aucune mission récente
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>À Valider</CardTitle>
            <CardDescription>
              Missions nécessitant votre attention.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pendingLoading ? (
              <div className="space-y-4">
                {[1, 2].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : pending?.data && pending.data.length > 0 ? (
              <div className="space-y-4">
                {pending.data.map(mission => (
                  <div key={mission.id} className="flex flex-col gap-2 p-4 border rounded-lg">
                    <div className="flex justify-between items-start">
                      <p className="text-sm font-medium">{mission.title}</p>
                      <StatusBadge status={mission.status} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Par {mission.createdByName} • {mission.departmentName}
                    </p>
                    <Link href={`/missions/${mission.id}`} className="mt-2">
                      <Button variant="outline" size="sm" className="w-full">Examiner</Button>
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                Aucune mission à valider
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
