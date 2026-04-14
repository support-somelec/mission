import { useState, ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, User as UserIcon, LayoutDashboard, Map, Users, Settings, Building, Building2 } from "lucide-react";
import { ROLE_LABELS } from "@/lib/constants";

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  if (!user) return <>{children}</>;

  const isAdmin = user.role === "admin";

  const navigation = [
    { name: "Tableau de Bord", href: "/dashboard", icon: LayoutDashboard },
    { name: "Missions", href: "/missions", icon: Map },
    { name: "Employés", href: "/employees", icon: Users },
  ];

  const adminNavigation = isAdmin ? [
    { name: "Utilisateurs", href: "/admin/users", icon: Settings },
    { name: "Départements", href: "/admin/departments", icon: Building },
    { name: "Gestion Employés", href: "/admin/employees", icon: Building2 },
  ] : [];

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-gray-50 dark:bg-gray-900 overflow-hidden">
        <Sidebar className="border-r border-gray-200 dark:border-gray-800">
          <SidebarHeader className="border-b border-gray-200 dark:border-gray-800 p-4">
            <div className="flex items-center gap-2 font-bold text-primary">
              <Map className="w-6 h-6" />
              <span className="text-lg tracking-tight">SOMELEC</span>
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
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex flex-col space-y-1 leading-none">
                    {user.fullName && <p className="font-medium">{user.fullName}</p>}
                    {user.email && <p className="w-[200px] truncate text-sm text-muted-foreground">{user.email}</p>}
                  </div>
                </div>
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
            <div className="ml-4 font-semibold text-primary">SOMELEC</div>
          </header>
          <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
            <div className="mx-auto max-w-6xl w-full">
              {children}
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
