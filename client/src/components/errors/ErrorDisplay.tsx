import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { ApiError } from '@/services/api';

interface ErrorDisplayProps {
  error: Error | unknown;
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
  showDetails?: boolean;
}

/**
 * Reusable error display component for API errors and other errors
 */
export function ErrorDisplay({
  error,
  title,
  description,
  onRetry,
  retryLabel = 'Réessayer',
  className = '',
  showDetails = false,
}: ErrorDisplayProps) {
  // Extract error message
  let errorMessage = 'Une erreur est survenue';
  let statusCode: number | undefined;

  if (error instanceof ApiError) {
    errorMessage = error.message;
    statusCode = error.statusCode;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === 'string') {
    errorMessage = error;
  }

  // Generate user-friendly messages based on status code
  const getStatusMessage = (code: number): string => {
    switch (code) {
      case 400:
        return 'Requête invalide. Veuillez vérifier les données saisies.';
      case 401:
        return 'Non autorisé. Veuillez vous connecter.';
      case 403:
        return 'Accès refusé. Vous n\'avez pas les permissions nécessaires.';
      case 404:
        return 'Ressource introuvable.';
      case 409:
        return 'Conflit. Cette ressource existe déjà.';
      case 422:
        return 'Données invalides. Veuillez vérifier les champs du formulaire.';
      case 429:
        return 'Trop de requêtes. Veuillez patienter avant de réessayer.';
      case 500:
        return 'Erreur serveur. Veuillez réessayer plus tard.';
      case 502:
      case 503:
        return 'Service indisponible. Le serveur est temporairement indisponible.';
      case 504:
        return 'Délai d\'attente dépassé. Veuillez réessayer.';
      default:
        return errorMessage;
    }
  };

  const displayMessage = statusCode ? getStatusMessage(statusCode) : errorMessage;
  const displayTitle = title || (statusCode ? `Erreur ${statusCode}` : 'Erreur de chargement');

  return (
    <Alert variant="destructive" className={className}>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{displayTitle}</AlertTitle>
      <AlertDescription className="mt-2">
        <p className="mb-3">
          {description || displayMessage}
        </p>

        {showDetails && error instanceof Error && error.stack && (
          <details className="mt-2">
            <summary className="text-xs font-medium cursor-pointer mb-1">
              Détails techniques
            </summary>
            <pre className="text-xs bg-destructive/10 p-2 rounded mt-1 overflow-auto max-h-32">
              {error.stack}
            </pre>
          </details>
        )}

        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="gap-2 mt-3"
          >
            <RefreshCw className="w-4 h-4" />
            {retryLabel}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}







