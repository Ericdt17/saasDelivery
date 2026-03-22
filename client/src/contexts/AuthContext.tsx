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
        // Cookies are sent automatically, no need to check for token
        // Add timeout to prevent hanging (30s for Render cold starts)
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Auth check timed out")), 30000)
        );
        const currentUser = await Promise.race([getCurrentUser(), timeoutPromise]);
        if (currentUser) {
          setUser(currentUser as UserInfo);
        } else {
          // getCurrentUser() returned null - could be network error or no session
          // Don't logout immediately - check if we have cached user first
          const cachedUser = getUser();
          if (cachedUser) {
            // Use cached user for now, verify in background
            setUser(cachedUser);
            // Try to verify session in background
            getCurrentUser()
              .then((user) => {
                if (user) {
                  setUser(user);
                }
              })
              .catch((error) => {
                // Network error or other error - keep cached user
                // Only logout on confirmed 401 errors
                if (error?.statusCode === 401 || error?.status === 401) {
                  logoutService();
                  setUser(null);
                }
                // Otherwise, keep cached user (might be temporary network issue)
              });
          } else {
            // No cached user and no valid session - user is not logged in
            setUser(null);
          }
        }
      } catch (error) {
        console.error("Initial auth check failed or timed out:", error);
        // On error, use cached user info if available
        const cachedUser = getUser();
        const apiError = error as { statusCode?: number; status?: number };
        if (cachedUser) {
          setUser(cachedUser);
          // Try to verify in background (don't logout on network errors)
          getCurrentUser()
            .then((user) => {
              if (user) {
                setUser(user);
              } else {
                // Only logout if we get a clear 401 (invalid session)
                // Don't logout on network errors or timeouts
                if (apiError?.statusCode === 401 || apiError?.status === 401) {
                  logoutService();
                  setUser(null);
                }
              }
            })
            .catch(() => {
              // Network error - keep cached user, don't logout
            });
        } else {
          // No cached user - user is not logged in
          setUser(null);
        }
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      // #region agent log
      fetch("http://127.0.0.1:7588/ingest/6825cdfb-0c66-4b26-9ab0-cf89f3b6ed2d", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "c77180",
        },
        body: JSON.stringify({
          sessionId: "c77180",
          runId: "pre-crash-1",
          hypothesisId: "H6",
          location: "client/src/contexts/AuthContext.tsx:login:beforeService",
          message: "AuthContext login called",
          data: {
            emailLen: email?.length ?? 0,
            emailDomain: (email?.split("@")[1] ?? "").toLowerCase(),
            passwordLen: password?.length ?? 0,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion

      const response = await loginService(email, password);
      // #region agent log
      fetch("http://127.0.0.1:7588/ingest/6825cdfb-0c66-4b26-9ab0-cf89f3b6ed2d", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "c77180",
        },
        body: JSON.stringify({
          sessionId: "c77180",
          runId: "pre-crash-1",
          hypothesisId: "H6",
          location: "client/src/contexts/AuthContext.tsx:login:afterService",
          message: "AuthContext login service returned",
          data: {
            success: !!response?.success,
            hasData: !!response?.data,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      if (response.success && response.data) {
        setUser(response.data.user);
        // #region agent log
        fetch("http://127.0.0.1:7588/ingest/6825cdfb-0c66-4b26-9ab0-cf89f3b6ed2d", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Debug-Session-Id": "c77180",
          },
          body: JSON.stringify({
            sessionId: "c77180",
            runId: "pre-crash-1",
            hypothesisId: "H6",
            location: "client/src/contexts/AuthContext.tsx:login:beforeNavigate",
            message: "AuthContext navigating after successful login",
            data: {
              userRole: response.data.user?.role ?? null,
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion
        navigate("/");
        return true;
      }
      return false;
    } catch (error) {
      // #region agent log
      fetch("http://127.0.0.1:7588/ingest/6825cdfb-0c66-4b26-9ab0-cf89f3b6ed2d", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "c77180",
        },
        body: JSON.stringify({
          sessionId: "c77180",
          runId: "pre-crash-1",
          hypothesisId: "H6",
          location: "client/src/contexts/AuthContext.tsx:login:catch",
          message: "AuthContext login caught error",
          data: {
            errType: error instanceof Error ? error.name : typeof error,
            errMessage: error instanceof Error ? error.message : String(error),
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
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
