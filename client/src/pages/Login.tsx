import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";

function debugLog(hypothesisId: string, location: string, message: string, data: Record<string, unknown>) {
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
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
}

const Login = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    debugLog("H6", "client/src/pages/Login.tsx:handleSubmit:start", "Submit started", {
      emailLen: email.length,
      emailDomain: (email.split("@")[1] || "").toLowerCase(),
      passwordLen: password.length,
      hadError: !!error,
    });
    setError("");
    setIsLoading(true);

    try {
      const success = await login(email, password);
      debugLog("H6", "client/src/pages/Login.tsx:handleSubmit:afterLogin", "Login result returned", {
        success,
      });
      if (!success) {
        setError("Email ou mot de passe incorrect");
      }
    } catch (err) {
      debugLog("H6", "client/src/pages/Login.tsx:handleSubmit:catch", "Login threw exception", {
        errType: err instanceof Error ? err.name : typeof err,
        errMessage: err instanceof Error ? err.message : String(err),
      });
      setError("Une erreur est survenue lors de la connexion");
    } finally {
      debugLog("H6", "client/src/pages/Login.tsx:handleSubmit:finally", "Submit finished", {
        nextIsLoading: false,
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Connexion</CardTitle>
          <CardDescription>
            Entrez vos identifiants pour accéder à votre compte
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="votre@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connexion...
                </>
              ) : (
                "Se connecter"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
