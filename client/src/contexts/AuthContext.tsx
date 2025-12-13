import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  login as loginService,
  logout as logoutService,
  getCurrentUser,
  getUser,
  getToken,
  type UserInfo,
} from "@/services/auth";

interface AuthContextType {
  user: UserInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isSuperAdmin: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      const token = getToken();
      if (token) {
        try {
          // Add timeout to prevent hanging (30s for Render cold starts)
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Auth check timed out")), 30000)
          );
          const currentUser = await Promise.race([getCurrentUser(), timeoutPromise]);
          if (currentUser) {
            setUser(currentUser as UserInfo);
          } else {
            logoutService();
          }
        } catch (error: any) {
          console.error("Initial auth check failed or timed out:", error);
          // Only logout if it's a real auth error (401), not a timeout
          // Timeout (408) might be due to Render cold start - keep token for retry
          if (error?.statusCode === 401 || (error instanceof Error && error.message.includes("401"))) {
            logoutService();
          }
          // For timeout errors, keep the token - user can retry manually
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const response = await loginService(email, password);
      if (response.success && response.data) {
        setUser(response.data.user);
        navigate("/");
        return true;
      }
      return false;
    } catch (error) {
      console.error("Login error:", error);
      return false;
    }
  };

  const logout = () => {
    logoutService();
    setUser(null);
    navigate("/login");
  };

  const isAuthenticated = !!user;
  const isSuperAdmin = user?.role === "super_admin";

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        isSuperAdmin,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
