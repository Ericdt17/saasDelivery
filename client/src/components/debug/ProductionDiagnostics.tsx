/**
 * Production Diagnostics Component
 * Helps identify production configuration issues
 * 
 * Usage: Add to your app temporarily to debug production issues
 * Remove after fixing issues for security
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2, AlertCircle } from "lucide-react";
import { API_CONFIG, buildApiUrl } from "@/lib/api-config";
import { healthCheck } from "@/services/api";

interface DiagnosticResult {
  name: string;
  status: "checking" | "pass" | "fail";
  message: string;
  details?: string;
}

export function ProductionDiagnostics() {
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const runDiagnostics = async () => {
    setIsRunning(true);
    const newResults: DiagnosticResult[] = [];

    // 1. Check API Base URL
    newResults.push({
      name: "API Base URL Configuration",
      status: "checking",
      message: "Checking...",
    });
    setResults([...newResults]);

    const apiBaseUrl = API_CONFIG.BASE_URL;
    if (!apiBaseUrl || apiBaseUrl === "http://localhost:3000") {
      newResults[0] = {
        name: "API Base URL Configuration",
        status: "fail",
        message: "API Base URL not configured for production",
        details: `Current: ${apiBaseUrl || "undefined"}. Should be your production backend URL.`,
      };
    } else {
      newResults[0] = {
        name: "API Base URL Configuration",
        status: "pass",
        message: "API Base URL is configured",
        details: `Using: ${apiBaseUrl}`,
      };
    }
    setResults([...newResults]);

    // 2. Check API Health
    newResults.push({
      name: "Backend API Health",
      status: "checking",
      message: "Checking...",
    });
    setResults([...newResults]);

    try {
      const isHealthy = await healthCheck();
      if (isHealthy) {
        newResults[1] = {
          name: "Backend API Health",
          status: "pass",
          message: "Backend API is reachable",
          details: "Health check passed",
        };
      } else {
        newResults[1] = {
          name: "Backend API Health",
          status: "fail",
          message: "Backend API health check failed",
          details: "Unable to reach backend API",
        };
      }
    } catch (error: any) {
      newResults[1] = {
        name: "Backend API Health",
        status: "fail",
        message: "Backend API is not reachable",
        details: error.message || "Network error or CORS issue",
      };
    }
    setResults([...newResults]);

    // 3. Check Environment
    newResults.push({
      name: "Environment",
      status: "checking",
      message: "Checking...",
    });
    setResults([...newResults]);

    const isProduction = import.meta.env.PROD;
    const mode = import.meta.env.MODE;
    newResults[2] = {
      name: "Environment",
      status: isProduction ? "pass" : "fail",
      message: isProduction ? "Running in production mode" : "Not in production mode",
      details: `Mode: ${mode}, PROD: ${isProduction}`,
    };
    setResults([...newResults]);

    // 4. Check CORS (indirectly by testing API call)
    newResults.push({
      name: "CORS Configuration",
      status: "checking",
      message: "Checking...",
    });
    setResults([...newResults]);

    try {
      const response = await fetch(buildApiUrl("/api/v1/health"), {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        newResults[3] = {
          name: "CORS Configuration",
          status: "pass",
          message: "CORS appears to be configured correctly",
          details: "API request succeeded",
        };
      } else {
        newResults[3] = {
          name: "CORS Configuration",
          status: "fail",
          message: "CORS may be misconfigured",
          details: `API returned status ${response.status}`,
        };
      }
    } catch (error: any) {
      if (error.message.includes("CORS") || error.message.includes("fetch")) {
        newResults[3] = {
          name: "CORS Configuration",
          status: "fail",
          message: "CORS error detected",
          details: error.message,
        };
      } else {
        newResults[3] = {
          name: "CORS Configuration",
          status: "fail",
          message: "Unable to test CORS",
          details: error.message,
        };
      }
    }
    setResults([...newResults]);

    setIsRunning(false);
  };

  useEffect(() => {
    // Auto-run on mount
    runDiagnostics();
  }, []);

  const getStatusIcon = (status: DiagnosticResult["status"]) => {
    switch (status) {
      case "checking":
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
      case "pass":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "fail":
        return <XCircle className="h-5 w-5 text-red-500" />;
    }
  };

  const getStatusBadge = (status: DiagnosticResult["status"]) => {
    switch (status) {
      case "checking":
        return <Badge variant="secondary">Checking...</Badge>;
      case "pass":
        return <Badge variant="default" className="bg-green-500">Pass</Badge>;
      case "fail":
        return <Badge variant="destructive">Fail</Badge>;
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          Production Diagnostics
        </CardTitle>
        <CardDescription>
          Check production configuration and connectivity
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={runDiagnostics}
          disabled={isRunning}
          className="w-full"
        >
          {isRunning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running Diagnostics...
            </>
          ) : (
            "Run Diagnostics"
          )}
        </Button>

        <div className="space-y-3">
          {results.map((result, index) => (
            <Alert
              key={index}
              variant={result.status === "fail" ? "destructive" : "default"}
            >
              <div className="flex items-start gap-3">
                {getStatusIcon(result.status)}
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold">{result.name}</span>
                    {getStatusBadge(result.status)}
                  </div>
                  <AlertDescription>{result.message}</AlertDescription>
                  {result.details && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {result.details}
                    </p>
                  )}
                </div>
              </div>
            </Alert>
          ))}
        </div>

        {results.length > 0 && (
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <h4 className="font-semibold mb-2">Configuration Info:</h4>
            <div className="space-y-1 text-sm">
              <p>
                <strong>API Base URL:</strong> {API_CONFIG.BASE_URL || "Not set"}
              </p>
              <p>
                <strong>Environment:</strong> {import.meta.env.MODE}
              </p>
              <p>
                <strong>Production Mode:</strong> {import.meta.env.PROD ? "Yes" : "No"}
              </p>
            </div>
          </div>
        )}

        <Alert>
          <AlertDescription className="text-sm">
            <strong>Note:</strong> Remove this component from production after
            fixing issues for security reasons.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}



