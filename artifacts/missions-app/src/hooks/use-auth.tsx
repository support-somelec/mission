import React, { createContext, useContext, useEffect, useState } from "react";
import type { User } from "@workspace/api-client-react";
import { useGetCurrentUser, useLogin, useLogout, getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: ReturnType<typeof useLogin>["mutateAsync"];
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useGetCurrentUser({
    query: {
      queryKey: getGetCurrentUserQueryKey(),
      retry: false,
      refetchOnWindowFocus: false,
    }
  });

  useEffect(() => {
    if (data) {
      setUser(data);
    } else if (error) {
      setUser(null);
    }
  }, [data, error]);

  const loginMutation = useLogin({
    mutation: {
      onSuccess: (res) => {
        setUser(res.user);
        queryClient.setQueryData(getGetCurrentUserQueryKey(), res.user);
        setLocation("/");
      },
      onError: (err: unknown) => {
        const msg = (err as { error?: string })?.error || "Nom d'utilisateur ou mot de passe incorrect.";
        toast({
          title: "Erreur de connexion",
          description: msg,
          variant: "destructive",
        });
      }
    }
  });

  const logoutMutation = useLogout({
    mutation: {
      onSuccess: () => {
        setUser(null);
        queryClient.setQueryData(getGetCurrentUserQueryKey(), null);
        setLocation("/login");
      }
    }
  });

  const logout = () => logoutMutation.mutate();

  return (
    <AuthContext.Provider value={{ user, isLoading, login: loginMutation.mutateAsync, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
