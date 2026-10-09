import type { RegulationStatus } from "../api/checkin";

/**
 * Indicateur « Règlement intérieur à consulter » — affiché quand l'employé
 * n'a pas encore pris connaissance de la version en vigueur.
 */
export function RegulationNotice({
  regulation,
  email,
}: {
  regulation: RegulationStatus | null | undefined;
  email: string;
}) {
  if (!regulation || !regulation.to_read) return null;
  const href = `${regulation.url}?email=${encodeURIComponent(email)}`;
  return (
    <div
      className="w-full rounded-xl border border-blue-200/80 bg-blue-50/90 p-3 text-left text-sm"
      data-testid="regulation-notice"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-blue-900/70">
        Règlement intérieur
      </p>
      <p className="mt-1 text-ink">
        Nouveau règlement intérieur ({regulation.version_label}) à consulter.
      </p>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="mt-1 inline-block font-semibold text-primary underline"
        data-testid="regulation-notice-link"
      >
        Lire maintenant
      </a>
    </div>
  );
}
