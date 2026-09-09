import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route } from "react-router-dom";
import { ErrorBoundary } from "@/components/errors/ErrorBoundary";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AgencyProvider } from "@/contexts/AgencyContext";
import Login from "./pages/auth/Login";
import Index from "./pages/dashboard/Index";
import Parametres from "./pages/config/Parametres";
import Agencies from "./pages/admin/Agencies";
import Waitlist from "./pages/admin/Waitlist";
import MerchantTermsPage from "./pages/admin/MerchantTermsPage";
import JobsPage from "./pages/recruitment/JobsPage";
import ApplicationsPage from "./pages/recruitment/ApplicationsPage";
import EmployeesPage from "./pages/hr/EmployeesPage";
import EmployeeDetailPage from "./pages/hr/EmployeeDetailPage";
import AttendancesPage from "./pages/hr/AttendancesPage";
import RecruitmentLandingPage from "./pages/recruitment/public/RecruitmentLandingPage";
import ApplyPage from "./pages/recruitment/public/ApplyPage";
import NotFound from "./pages/NotFound";
import ServerError from "./pages/ServerError";
import ErrorNetworkPreview from "./pages/dev/ErrorNetworkPreview";
import LoadingDemo from "./pages/dev/LoadingDemo";
import { PostHogPageview } from "@/components/analytics/PostHogPageview";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error && typeof error === "object" && "statusCode" in error) {
          const statusCode = (error as { statusCode: number }).statusCode;
          if (statusCode >= 400 && statusCode < 500) {
            return false;
          }
        }
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 1000 * 30,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});

const App = () => (
  <ErrorBoundary
    onError={(error, errorInfo) => {
      if (import.meta.env.DEV) {
        console.error("ErrorBoundary caught error:", error, errorInfo);
      }
    }}
  >
    <QueryClientProvider client={queryClient}>
      <AgencyProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <PostHogPageview />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/recrutement" element={<RecruitmentLandingPage />} />
            <Route path="/recrutement/:jobId/postuler" element={<ApplyPage />} />
            <Route path="/erreur" element={<ServerError />} />
            {import.meta.env.DEV ? (
              <>
                <Route path="/dev/error-network" element={<ErrorNetworkPreview />} />
                <Route path="/dev/loading" element={<LoadingDemo />} />
              </>
            ) : null}

            <Route
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Index />} />
              <Route
                path="/agences"
                element={
                  <ProtectedRoute requireSuperAdmin>
                    <Agencies />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/liste-attente"
                element={
                  <ProtectedRoute requireSuperAdmin>
                    <Waitlist />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/conditions-marchands"
                element={
                  <ProtectedRoute requireSuperAdmin>
                    <MerchantTermsPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/parametres" element={<Parametres />} />
              <Route path="/recruitment/jobs" element={<JobsPage />} />
              <Route
                path="/recruitment/applications"
                element={<ApplicationsPage />}
              />
              <Route
                path="/hr/employees"
                element={
                  <ProtectedRoute requireSuperAdmin>
                    <EmployeesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hr/employees/:id"
                element={
                  <ProtectedRoute requireSuperAdmin>
                    <EmployeeDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hr/attendances"
                element={
                  <ProtectedRoute requireSuperAdmin>
                    <AttendancesPage />
                  </ProtectedRoute>
                }
              />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </TooltipProvider>
      </AgencyProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
