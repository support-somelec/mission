import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, ArrowRight } from "lucide-react";
import logoSomelec from "/logo-somelec.png";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const loginSchema = z.object({
  username: z.string().min(1, "Le nom d'utilisateur est requis"),
  password: z.string().min(1, "Le mot de passe est requis"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const TEST_USERS = [
  { username: "admin",             password: "admin123",   label: "Administrateur",        color: "bg-slate-700" },
  { username: "ahmed.dg",          password: "admin123",   label: "Employé",               color: "bg-blue-600" },
  { username: "fatima.drh",        password: "password123",label: "Directeur",             color: "bg-indigo-600" },
  { username: "directeur.central", password: "password123",label: "Dir. Central",          color: "bg-violet-600" },
  { username: "controle.tech",     password: "password123",label: "Ctrl. Technique",       color: "bg-purple-600" },
  { username: "dga.somelec",       password: "password123",label: "DGA",                   color: "bg-fuchsia-600" },
  { username: "dmg.somelec",       password: "password123",label: "DMG",                   color: "bg-rose-600" },
  { username: "cad.edition",       password: "password123",label: "CAD Édition",           color: "bg-orange-600" },
  { username: "cad.paiement",      password: "password123",label: "CAD Paiement",          color: "bg-amber-600" },
  { username: "ctrl.financier",    password: "password123",label: "Ctrl. Financier",       color: "bg-emerald-600" },
];

export default function Login() {
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    try {
      await login({ data });
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const fillAndLogin = (username: string, password: string) => {
    form.setValue("username", username);
    form.setValue("password", password);
    form.handleSubmit(onSubmit)();
  };

  return (
    <div className="min-h-screen w-full flex bg-gray-50">
      {/* Left pane */}
      <div className="hidden lg:flex flex-1 flex-col bg-primary text-primary-foreground p-12 justify-between relative overflow-hidden">
        <div className="absolute inset-0 opacity-20 bg-[url('/bg-somelec.jpg')] bg-cover bg-center" />
        <div className="relative z-10 flex items-center gap-3">
          <img src={logoSomelec} alt="Logo Groupe Somelec" className="w-12 h-12 object-contain invert" />
          <h1 className="text-3xl font-bold tracking-tight">Groupe Somelec</h1>
        </div>

        <div className="relative z-10 max-w-lg">
          <h2 className="text-4xl font-bold mb-6">Système de Gestion des Missions</h2>
          <p className="text-lg text-primary-foreground/80 leading-relaxed">
            Portail interne pour la création, le suivi et la validation des missions professionnelles.
          </p>

          {/* Test accounts on left pane (desktop) */}
          <div className="mt-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary-foreground/50 mb-3">
              Comptes de démonstration
            </p>
            <div className="grid grid-cols-2 gap-2">
              {TEST_USERS.map((u) => (
                <button
                  key={u.username}
                  onClick={() => fillAndLogin(u.username, u.password)}
                  className="flex items-center gap-2 px-3 py-2 rounded-md bg-white/10 hover:bg-white/20 transition-colors text-left"
                >
                  <span className={`w-2 h-2 rounded-full ${u.color} flex-shrink-0`} />
                  <span className="text-xs font-medium truncate">{u.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="relative z-10 text-sm text-primary-foreground/60">
          &copy; {new Date().getFullYear()} Groupe Somelec Mauritanie. Tous droits réservés.
        </div>
      </div>

      {/* Right pane - Login Form */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12 overflow-y-auto">
        <div className="absolute top-8 left-8 lg:hidden flex items-center gap-2 text-primary font-bold">
          <img src={logoSomelec} alt="Logo Groupe Somelec" className="w-7 h-7 object-contain" />
          <span className="text-xl tracking-tight">Groupe Somelec</span>
        </div>

        <div className="w-full max-w-md space-y-4">
          <Card className="border-0 shadow-xl sm:border sm:shadow-lg">
            <CardHeader className="space-y-3 pb-6">
              <CardTitle className="text-2xl font-bold tracking-tight">Connexion</CardTitle>
              <CardDescription className="text-base">
                Veuillez entrer vos identifiants pour accéder à votre espace.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom d'utilisateur</FormLabel>
                        <FormControl>
                          <Input placeholder="admin, cad.edition..." {...field} className="h-12" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mot de passe</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="••••••••" {...field} className="h-12" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full h-12 text-base font-medium"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Connexion en cours...</>
                    ) : (
                      <><span className="flex-1 text-center">Se connecter</span><ArrowRight className="w-5 h-5 ml-2" /></>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Test accounts card (mobile / right pane) */}
          <Card className="border border-dashed shadow-none">
            <CardHeader className="pb-3 pt-4 px-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Comptes de démonstration — cliquer pour se connecter
              </p>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-2 gap-2">
                {TEST_USERS.map((u) => (
                  <button
                    key={u.username}
                    onClick={() => fillAndLogin(u.username, u.password)}
                    disabled={isLoading}
                    className="flex items-start gap-2 px-3 py-2 rounded-md border bg-white hover:bg-gray-50 transition-colors text-left disabled:opacity-50"
                  >
                    <span className={`mt-1 w-2 h-2 rounded-full ${u.color} flex-shrink-0`} />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-foreground truncate">{u.label}</div>
                      <div className="text-[11px] text-muted-foreground font-mono truncate">{u.username}</div>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
