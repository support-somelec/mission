import { useState, ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useChangePassword } from "@workspace/api-client-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, User as UserIcon, LayoutDashboard, Map, Users, Settings, Building, Building2, KeyRound, AlertTriangle, BarChart3, FileUp } from "lucide-react";
import { ROLE_LABELS } from "@/lib/constants";
import logoSomelec from "/logo-somelec.png";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

function ChangePasswordDialog({
  open,
  onOpenChange,
  forced = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  forced?: boolean;
}) {
  const { toast } = useToast();
  const { refreshUser } = useAuth();
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [error, setError] = useState("");

  const mutation = useChangePassword({
    mutation: {
      onSuccess: () => {
        toast({ title: "Mot de passe modifié avec succès" });
        refreshUser();
        onOpenChange(false);
        setForm({ current: "", next: "", confirm: "" });
        setError("");
      },
      onError: (err: unknown) => {
        const msg =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          "Une erreur est survenue";
        setError(msg);
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (form.next !== form.confirm) {
      setError("Les deux nouveaux mots de passe ne correspondent pas");
      return;
    }
    if (form.next.length < 6) {
      setError("Le nouveau mot de passe doit contenir au moins 6 caractères");
      return;
    }
    mutation.mutate({ data: { currentPassword: form.current, newPassword: form.next } });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!forced) onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-md" onInteractOutside={forced ? (e) => e.preventDefault() : undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5" />
            {forced ? "Changement de mot de passe obligatoire" : "Changer le mot de passe"}
          </DialogTitle>
          {forced && (
            <DialogDescription className="flex items-start gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3 mt-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              Vous devez changer votre mot de passe avant de continuer. Votre mot de passe actuel est le mot de passe par défaut.
            </DialogDescription>
          )}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="cp-current">Mot de passe actuel</Label>
            <Input
              id="cp-current"
              type="password"
              placeholder="••••••••"
              value={form.current}
              onChange={(e) => setForm((f) => ({ ...f, current: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp-next">Nouveau mot de passe</Label>
            <Input
              id="cp-next"
              type="password"
              placeholder="Minimum 6 caractères"
              value={form.next}
              onChange={(e) => setForm((f) => ({ ...f, next: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp-confirm">Confirmer le nouveau mot de passe</Label>
            <Input
              id="cp-confirm"
              type="password"
              placeholder="••••••••"
              value={form.confirm}
              onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            {!forced && (
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
            )}
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Modification..." : "Changer le mot de passe"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [changePwdOpen, setChangePwdOpen] = useState(false);

  if (!user) return <>{children}</>;

  const isAdmin = user.role === "admin";
  const isDga = user.role === "dga";
  const canReport = isAdmin || isDga;
  const mustChangePwd = user.mustChangePassword === true;

  const navigation = [
    { name: "Tableau de Bord", href: "/dashboard", icon: LayoutDashboard },
    { name: "Missions", href: "/missions", icon: Map },
    ...(isAdmin ? [{ name: "Employés", href: "/employees", icon: Users }] : []),
    ...(canReport ? [{ name: "Reporting", href: "/reporting", icon: BarChart3 }] : []),
  ];

  const adminNavigation = isAdmin ? [
    { name: "Utilisateurs", href: "/admin/users", icon: Settings },
    { name: "Départements", href: "/admin/departments", icon: Building },
    { name: "Gestion Employés", href: "/admin/employees", icon: Building2 },
    { name: "Import Missions", href: "/admin/import", icon: FileUp },
  ] : [];

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-gray-50 dark:bg-gray-900 overflow-hidden">
        <Sidebar className="border-r border-gray-200 dark:border-gray-800">
          <SidebarHeader className="border-b border-gray-200 dark:border-gray-800 p-4">
            <div className="flex items-center gap-2 font-bold text-primary">
              <img src={logoSomelec} alt="Logo Groupe Somelec" className="w-7 h-7 object-contain" />
              <span className="text-lg tracking-tight">Groupe Somelec</span>
            </div>
            <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-1">
              Gestion des Missions
            </div>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Menu Principal</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navigation.map((item) => {
                    const isActive = location === item.href || location.startsWith(`${item.href}/`);
                    return (
                      <SidebarMenuItem key={item.name}>
                        <SidebarMenuButton asChild isActive={isActive} tooltip={item.name}>
                          <Link href={item.href} className="flex items-center gap-2 w-full">
                            <item.icon className="w-4 h-4" />
                            <span>{item.name}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {isAdmin && (
              <SidebarGroup>
                <SidebarGroupLabel>Administration</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {adminNavigation.map((item) => {
                      const isActive = location === item.href || location.startsWith(`${item.href}/`);
                      return (
                        <SidebarMenuItem key={item.name}>
                          <SidebarMenuButton asChild isActive={isActive} tooltip={item.name}>
                            <Link href={item.href} className="flex items-center gap-2 w-full">
                              <item.icon className="w-4 h-4" />
                              <span>{item.name}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </SidebarContent>

          <SidebarFooter className="border-t border-gray-200 dark:border-gray-800 p-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start gap-2 px-2 h-auto py-2">
                  <Avatar className="w-8 h-8 rounded-md bg-primary/10 text-primary">
                    <AvatarFallback className="rounded-md uppercase">{user.username.substring(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start text-sm text-left truncate flex-1">
                    <span className="font-medium truncate w-full">{user.fullName}</span>
                    <span className="text-xs text-muted-foreground truncate w-full">{ROLE_LABELS[user.role] || user.role}</span>
                  </div>
                  {mustChangePwd && <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex flex-col space-y-1 leading-none">
                    {user.fullName && <p className="font-medium">{user.fullName}</p>}
                    {user.email && <p className="w-[200px] truncate text-sm text-muted-foreground">{user.email}</p>}
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setChangePwdOpen(true)}
                  className="cursor-pointer"
                >
                  <KeyRound className="mr-2 h-4 w-4" />
                  <span>Changer le mot de passe</span>
                  {mustChangePwd && <AlertTriangle className="ml-auto w-3.5 h-3.5 text-amber-500" />}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => logout()} className="text-red-600 focus:bg-red-50 focus:text-red-600 cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Déconnexion</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="h-14 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center px-4 lg:hidden shrink-0">
            <SidebarTrigger />
            <div className="ml-4 font-semibold text-primary">Groupe Somelec</div>
          </header>
          <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
            <div className="mx-auto max-w-6xl w-full">
              {children}
            </div>
          </div>
        </main>
      </div>

      <ChangePasswordDialog
        open={changePwdOpen || mustChangePwd}
        onOpenChange={setChangePwdOpen}
        forced={mustChangePwd}
      />
    </SidebarProvider>
  );
}
