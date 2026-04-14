import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Map, Loader2, ArrowRight } from "lucide-react";

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
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

const loginSchema = z.object({
  username: z.string().min(1, "Le nom d'utilisateur est requis"),
  password: z.string().min(1, "Le mot de passe est requis"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    try {
      await login({ data });
      // Redirect happens in useAuth on success
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-gray-50">
      {/* Left pane - Brand / Image */}
      <div className="hidden lg:flex flex-1 flex-col bg-primary text-primary-foreground p-12 justify-between relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center"></div>
        <div className="relative z-10 flex items-center gap-3">
          <Map className="w-10 h-10" />
          <h1 className="text-3xl font-bold tracking-tight">SOMELEC</h1>
        </div>
        
        <div className="relative z-10 max-w-lg">
          <h2 className="text-4xl font-bold mb-6">Système de Gestion des Missions</h2>
          <p className="text-lg text-primary-foreground/80 leading-relaxed">
            Portail interne pour la création, le suivi et la validation des missions professionnelles. Structuré, efficace et sécurisé.
          </p>
        </div>
        
        <div className="relative z-10 text-sm text-primary-foreground/60">
          &copy; {new Date().getFullYear()} SOMELEC Mauritanie. Tous droits réservés.
        </div>
      </div>

      {/* Right pane - Login Form */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12 relative">
        <div className="absolute top-8 left-8 lg:hidden flex items-center gap-2 text-primary font-bold">
          <Map className="w-6 h-6" />
          <span className="text-xl tracking-tight">SOMELEC</span>
        </div>

        <Card className="w-full max-w-md border-0 shadow-xl sm:border sm:shadow-lg">
          <CardHeader className="space-y-3 pb-8">
            <CardTitle className="text-2xl font-bold tracking-tight">Connexion</CardTitle>
            <CardDescription className="text-base">
              Veuillez entrer vos identifiants pour accéder à votre espace.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom d'utilisateur</FormLabel>
                      <FormControl>
                        <Input placeholder="admin, employe1..." {...field} className="h-12" />
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
                  className="w-full h-12 text-base font-medium mt-2" 
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Connexion en cours...</>
                  ) : (
                    <><span className="flex-1 text-center">Se connecter</span> <ArrowRight className="w-5 h-5 ml-2" /></>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
