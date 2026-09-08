type Props = {
  subtitle?: string;
  compact?: boolean;
  titleTestId?: string;
};

function todayFr(): string {
  const raw = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function BrandHeader({
  subtitle = "Enregistrer ma présence",
  compact = false,
  titleTestId,
}: Props) {
  return (
    <header className="flex w-full flex-col items-center text-center">
      <img
        src="/logo.svg"
        alt="LivSight"
        data-testid="brand-logo"
        className={`object-contain ${compact ? "h-20 w-20" : "h-48 w-48 sm:h-56 sm:w-56"}`}
      />
      <h1
        data-testid={titleTestId}
        className={`mt-3 font-semibold tracking-tight text-ink ${
          compact ? "text-xl" : "text-2xl sm:text-3xl"
        }`}
      >
        {subtitle}
      </h1>
      {!compact && (
        <p className="mt-1 text-sm text-ink-muted">{todayFr()}</p>
      )}
    </header>
  );
}
