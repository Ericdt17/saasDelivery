import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  login as loginService,
  logout as logoutService,
  getCurrentUser,
  getUser,
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
      try {
        // Always check authentication via API (cookie-based)
        // This works even after page refresh since cookie persists
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Auth check timed out")), 5000)
        );
        const currentUser = await Promise.race([getCurrentUser(), timeoutPromise]);
        if (currentUser) {
          setUser(currentUser as UserInfo);
        } else {
          // No valid session, clear any stale local storage
          logoutService();
        }
      } catch (error) {
        console.error("Initial auth check failed or timed out:", error);
        // On error, try to use cached user info for initial render
        // But still clear it since we can't verify the session
        const cachedUser = getUser();
        if (cachedUser) {
          setUser(cachedUser);
          // Try to verify in background
          getCurrentUser().then((user) => {
            if (user) {
              setUser(user);
            } else {
              logoutService();
              setUser(null);
            }
          });
        }
      } finally {
        setIsLoading(false);
      }
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

  const logout = async () => {
    await logoutService();
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
