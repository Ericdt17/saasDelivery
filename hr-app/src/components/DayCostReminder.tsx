/** Compact map-style day cost reminder for the employee. */

type Props = {
  costLateDay: number | null;
  costAbsentDay: number | null;
};

function formatFrancs(amount: number): string {
  return `${new Intl.NumberFormat("fr-FR").format(amount)} F`;
}

export function DayCostReminder({ costLateDay, costAbsentDay }: Props) {
  if (costLateDay == null || costAbsentDay == null) return null;

  return (
    <div
      className="w-full rounded-xl border border-amber-200/80 bg-amber-50/90 p-3 text-left text-sm"
      data-testid="day-cost-reminder"
    >
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-amber-900/70">
        Si vous n’êtes pas assidu ce mois
      </p>
      <dl className="space-y-1.5">
        <div className="flex justify-between gap-3">
          <dt className="text-ink-muted">1 jour de retard</dt>
          <dd className="font-semibold tabular-nums text-ink" data-testid="cost-late-day">
            = {formatFrancs(costLateDay)}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink-muted">1 jour d’absence</dt>
          <dd className="font-semibold tabular-nums text-ink" data-testid="cost-absent-day">
            = {formatFrancs(costAbsentDay)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
