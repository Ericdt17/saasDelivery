import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary component to catch React component errors
 * and display a user-friendly error message.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console in development
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    // Call optional error handler
    this.props.onError?.(error, errorInfo);

    // Update state with error info
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <ErrorBoundaryFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onReset={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Fallback UI component for ErrorBoundary
 */
interface ErrorBoundaryFallbackProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  onReset: () => void;
}

function ErrorBoundaryFallback({ error, errorInfo, onReset }: ErrorBoundaryFallbackProps) {
  const handleGoHome = () => {
    window.location.href = '/';
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <div className="w-full max-w-2xl">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="text-lg">Une erreur inattendue s'est produite</AlertTitle>
          <AlertDescription className="mt-4 space-y-4">
            <p>
              Désolé, une erreur s'est produite lors du chargement de l'application.
              Veuillez réessayer ou contacter le support si le problème persiste.
            </p>

            {error && (
              <div className="mt-4 rounded-md bg-destructive/10 p-3">
                <p className="text-sm font-medium mb-1">Détails de l'erreur :</p>
                <p className="text-xs font-mono text-destructive/80 break-all">
                  {error.message || 'Erreur inconnue'}
                </p>
              </div>
            )}

            {import.meta.env.DEV && errorInfo && (
              <details className="mt-4">
                <summary className="text-sm font-medium cursor-pointer mb-2">
                  Détails techniques (mode développement)
                </summary>
                <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-64">
                  {errorInfo.componentStack}
                </pre>
              </details>
            )}

            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={onReset}
                className="gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Réessayer
              </Button>
              <Button
                variant="outline"
                onClick={handleGoHome}
                className="gap-2"
              >
                <Home className="w-4 h-4" />
                Retour à l'accueil
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}

