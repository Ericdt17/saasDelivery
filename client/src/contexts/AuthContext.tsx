/**
 * Authentication Context
 * Provides authentication state and methods throughout the app
 */

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { UserInfo, login as loginService, logout as logoutService, getToken, getUser, getCurrentUser } from "@/services/auth";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface AuthContextType {
  user: UserInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isSuperAdmin: boolean;
  isAgencyAdmin: boolean;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Check for existing session on mount
  useEffect(() => {
    const initAuth = async () => {
      const token = getToken();
      if (token) {
        // Try to get current user from API
        try {
          const currentUser = await getCurrentUser();
          if (currentUser) {
            setUser(currentUser);
          } else {
            // Token invalid, clear it
            logoutService();
          }
        } catch (error) {
          // Token invalid, clear it
          logoutService();
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response = await loginService(email, password);
      
      if (response.success && response.data) {
        setUser(response.data.user);
        toast.success("Connexion réussie");
        navigate("/");
        return true;
      } else {
        toast.error(response.error || "Email ou mot de passe incorrect");
        return false;
      }
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de la connexion");
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    logoutService();
    setUser(null);
    toast.success("Déconnexion réussie");
    navigate("/login");
  };

  const refreshUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
      }
    } catch (error) {
      // If refresh fails, user might be logged out
      logout();
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    isSuperAdmin: user?.role === "super_admin",
    isAgencyAdmin: user?.role === "agency",
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

