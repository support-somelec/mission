import React, { createContext, useContext } from "react";
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
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
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

  // Read the authenticated user synchronously from the query. An effect-backed
  // copy could briefly report null after loading and redirect a valid session.
  const user = error ? null : data ?? null;

  const loginMutation = useLogin({
    mutation: {
      onSuccess: (res) => {
        queryClient.removeQueries({ predicate: query => query.queryKey[0] !== getGetCurrentUserQueryKey()[0] });
        queryClient.setQueryData(getGetCurrentUserQueryKey(), res.user);
        setLocation("/");
      },
      onError: (err: unknown) => {
        const msg =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          (err as { error?: string })?.error ||
          "Nom d'utilisateur ou mot de passe incorrect.";
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
        queryClient.removeQueries({ predicate: query => query.queryKey[0] !== getGetCurrentUserQueryKey()[0] });
        queryClient.setQueryData(getGetCurrentUserQueryKey(), null);
        setLocation("/login");
      }
    }
  });

  const logout = () => logoutMutation.mutate();

  const refreshUser = () => {
    queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login: loginMutation.mutateAsync, logout, refreshUser }}>
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
