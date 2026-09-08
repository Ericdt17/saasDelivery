import { BrandHeader } from "./BrandHeader";
import { successGreeting } from "../lib/greeting";

type Props = {
  kind: "success" | "error";
  title: string;
  message?: string | null;
  employeeName?: string | null;
  checkInTime?: string | null;
  status?: "present" | "late" | null;
  canRetry?: boolean;
  retrying?: boolean;
  onRetry?: () => void;
  onReset?: () => void;
};

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function statusLabel(status: "present" | "late"): string {
  return status === "present" ? "Présent" : "En retard";
}

function CheckIcon() {
  return (
    <svg
      className="h-10 w-10 text-primary"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg
      className="h-10 w-10 text-red-500"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
      />
    </svg>
  );
}

export function ResultStep({
  kind,
  title,
  message,
  employeeName,
  checkInTime,
  status,
  canRetry = false,
  retrying = false,
  onRetry,
  onReset,
}: Props) {
  const greeting = employeeName ? successGreeting(employeeName) : null;

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-5 text-center" data-testid="result-step">
      <BrandHeader
        subtitle={kind === "success" ? greeting || title : title}
        compact
        titleTestId="result-title"
      />

      <div
        className={`flex h-20 w-20 items-center justify-center rounded-full ${
          kind === "success" ? "bg-primary/10" : "bg-red-50"
        }`}
      >
        {kind === "success" ? <CheckIcon /> : <AlertIcon />}
      </div>

      {kind === "success" && checkInTime ? (
        <p className="text-5xl font-semibold tracking-tight text-ink" data-testid="result-time">
          {formatTime(checkInTime)}
        </p>
      ) : null}

      {kind === "success" ? (
        <p className="text-base leading-relaxed text-ink-muted" data-testid="result-message">
          Votre présence est bien enregistrée.
        </p>
      ) : message ? (
        <p className="text-base leading-relaxed text-ink-muted" data-testid="result-message">
          {message}
        </p>
      ) : null}

      {kind === "success" && (employeeName || status) ? (
        <div className="w-full space-y-3 rounded-xl bg-slate-50 p-4 text-left text-sm">
          {employeeName ? (
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-muted">Employé</p>
              <p className="mt-0.5 font-semibold text-ink" data-testid="result-name">
                {employeeName}
              </p>
            </div>
          ) : null}
          {status ? (
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-muted">Statut</p>
              <p className="mt-0.5 font-semibold text-primary" data-testid="result-status">
                {statusLabel(status)}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {kind === "error" && canRetry && onRetry ? (
        <button
          type="button"
          data-testid="result-retry"
          onClick={onRetry}
          disabled={retrying}
          className="btn-primary"
        >
          {retrying ? "Nouvelle tentative…" : "Réessayer"}
        </button>
      ) : null}

      {onReset ? (
        <button
          type="button"
          data-testid="result-reset"
          onClick={onReset}
          disabled={retrying}
          className={
            canRetry
              ? "inline-flex h-10 w-full items-center justify-center rounded-md bg-muted px-4 text-sm font-medium text-ink disabled:opacity-50"
              : "btn-primary"
          }
        >
          Recommencer
        </button>
      ) : null}
    </div>
  );
}
