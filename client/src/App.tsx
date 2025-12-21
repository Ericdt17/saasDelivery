import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route } from "react-router-dom";
import { ErrorBoundary } from "@/components/errors/ErrorBoundary";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AgencyProvider } from "@/contexts/AgencyContext";
import { handleError } from "@/lib/error-handler";
import Login from "./pages/Login";
import Index from "./pages/Index";
import Livraisons from "./pages/Livraisons";
import LivraisonDetails from "./pages/LivraisonDetails";
import Paiements from "./pages/Paiements";
import Rapports from "./pages/Rapports";
import Expeditions from "./pages/Expeditions";
import Modifications from "./pages/Modifications";
import Parametres from "./pages/Parametres";
import Agencies from "./pages/Agencies";
import Groups from "./pages/Groups";
import GroupDetail from "./pages/GroupDetail";
import Tarifs from "./pages/Tarifs";
import NotFound from "./pages/NotFound";

// Configure QueryClient with better error handling
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors (client errors)
        if (error && typeof error === "object" && "statusCode" in error) {
          const statusCode = (error as { statusCode: number }).statusCode;
          if (statusCode >= 400 && statusCode < 500) {
            return false;
          }
        }
        // Retry up to 2 times for other errors
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 1000 * 30, // 30 seconds
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false, // Don't retry mutations by default
    },
  },
});

const App = () => (
  <ErrorBoundary
    onError={(error, errorInfo) => {
      // Log error to console in development
      if (import.meta.env.DEV) {
        console.error("ErrorBoundary caught error:", error, errorInfo);
      }
      // You could also send to error tracking service here (e.g., Sentry)
    }}
  >
    <QueryClientProvider client={queryClient}>
      <AgencyProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
        <Routes>
          {/* Public route */}
          <Route path="/login" element={<Login />} />

          {/* Protected routes */}
          <Route
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Index />} />
            <Route path="/livraisons" element={<Livraisons />} />
            <Route path="/livraisons/:id" element={<LivraisonDetails />} />
            <Route path="/groupes" element={<Groups />} />
            <Route path="/groupes/:id" element={<GroupDetail />} />
            <Route path="/tarifs" element={<Tarifs />} />
            <Route
              path="/agences"
              element={
                <ProtectedRoute requireSuperAdmin>
                  <Agencies />
                </ProtectedRoute>
              }
            />
            <Route path="/paiements" element={<Paiements />} />
            <Route path="/rapports" element={<Rapports />} />
            <Route path="/expeditions" element={<Expeditions />} />
            <Route path="/modifications" element={<Modifications />} />
            <Route path="/parametres" element={<Parametres />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
        </TooltipProvider>
      </AgencyProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
