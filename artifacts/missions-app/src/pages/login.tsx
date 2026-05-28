import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { useRegister } from "@workspace/api-client-react";
import { Loader2, ArrowRight, UserPlus, ChevronLeft } from "lucide-react";

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
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  username: z.string().min(1, "Le nom d'utilisateur est requis"),
  password: z.string().min(1, "Le mot de passe est requis"),
});

const registerSchema = z.object({
  username: z.string().min(3, "Au moins 3 caractères"),
  fullName: z.string().min(2, "Le nom complet est requis"),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
});

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;


export default function Login() {
  const { login } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "register" | "registered">("login");

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { username: "", fullName: "", email: "" },
  });

  const registerMutation = useRegister({
    mutation: {
      onSuccess: () => {
        setMode("registered");
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Une erreur est survenue";
        toast({ title: "Erreur", description: msg, variant: "destructive" });
      },
    },
  });

  const onLoginSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    try {
      await login({ data });
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const onRegisterSubmit = (data: RegisterFormValues) => {
    registerMutation.mutate({
      data: {
        username: data.username,
        fullName: data.fullName,
        email: data.email || null,
      },
    });
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
        </div>

        <div className="relative z-10 text-sm text-primary-foreground/60">
          &copy; {new Date().getFullYear()} Groupe Somelec Mauritanie. Tous droits réservés.
        </div>
      </div>

      {/* Right pane */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12 overflow-y-auto">
        <div className="absolute top-8 left-8 lg:hidden flex items-center gap-2 text-primary font-bold">
          <img src={logoSomelec} alt="Logo Groupe Somelec" className="w-7 h-7 object-contain" />
          <span className="text-xl tracking-tight">Groupe Somelec</span>
        </div>

        <div className="w-full max-w-md space-y-4">
          {/* ── LOGIN FORM ── */}
          {mode === "login" && (
            <>
              <Card className="border-0 shadow-xl sm:border sm:shadow-lg">
                <CardHeader className="space-y-3 pb-6">
                  <CardTitle className="text-2xl font-bold tracking-tight">Connexion</CardTitle>
                  <CardDescription className="text-base">
                    Veuillez entrer vos identifiants pour accéder à votre espace.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...loginForm}>
                    <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-5">
                      <FormField
                        control={loginForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nom d'utilisateur</FormLabel>
                            <FormControl>
                              <Input placeholder="Votre nom d'utilisateur" {...field} className="h-12" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={loginForm.control}
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
                      <Button type="submit" className="w-full h-12 text-base font-medium" disabled={isLoading}>
                        {isLoading ? (
                          <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Connexion en cours...</>
                        ) : (
                          <><span className="flex-1 text-center">Se connecter</span><ArrowRight className="w-5 h-5 ml-2" /></>
                        )}
                      </Button>
                    </form>
                  </Form>
                  <div className="mt-4 text-center">
                    <button
                      type="button"
                      onClick={() => setMode("register")}
                      className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                    >
                      <UserPlus className="w-4 h-4" />
                      Créer un compte
                    </button>
                  </div>
                </CardContent>
              </Card>

            </>
          )}

          {/* ── REGISTER FORM ── */}
          {mode === "register" && (
            <Card className="border-0 shadow-xl sm:border sm:shadow-lg">
              <CardHeader className="space-y-3 pb-6">
                <CardTitle className="text-2xl font-bold tracking-tight flex items-center gap-2">
                  <UserPlus className="w-6 h-6" />
                  Créer un compte
                </CardTitle>
                <CardDescription className="text-base">
                  Votre compte sera activé une fois qu'un administrateur vous aura affecté à votre direction.
                  Le mot de passe par défaut vous sera communiqué.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...registerForm}>
                  <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-5">
                    <FormField
                      control={registerForm.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nom complet *</FormLabel>
                          <FormControl>
                            <Input placeholder="Prénom et Nom" {...field} className="h-12" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nom d'utilisateur *</FormLabel>
                          <FormControl>
                            <Input placeholder="ex: ahmed.ould" {...field} className="h-12" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email (optionnel)</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="email@somelec.mr" {...field} className="h-12" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      className="w-full h-12 text-base font-medium"
                      disabled={registerMutation.isPending}
                    >
                      {registerMutation.isPending ? (
                        <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Création en cours...</>
                      ) : (
                        "Créer mon compte"
                      )}
                    </Button>
                  </form>
                </Form>
                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={() => setMode("login")}
                    className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Retour à la connexion
                  </button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── SUCCESS MESSAGE ── */}
          {mode === "registered" && (
            <Card className="border-0 shadow-xl sm:border sm:shadow-lg">
              <CardHeader className="space-y-3 pb-6">
                <CardTitle className="text-2xl font-bold tracking-tight text-green-700">
                  Compte créé !
                </CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  Votre demande a été enregistrée. Un administrateur va vérifier votre compte et vous affecter
                  à votre direction. Vous recevrez un mot de passe temporaire (<strong>Somelec@2024</strong>)
                  pour votre première connexion.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => { setMode("login"); registerForm.reset(); }}
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Retour à la connexion
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
