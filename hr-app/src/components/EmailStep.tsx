import { BrandHeader } from "./BrandHeader";

type Props = {
  email: string;
  error: string | null;
  loading: boolean;
  onEmailChange: (value: string) => void;
  onSubmit: () => void;
};

export function EmailStep({ email, error, loading, onEmailChange, onSubmit }: Props) {
  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-6">
      <BrandHeader subtitle="Enregistrer ma présence" />
      <p className="-mt-2 text-center text-sm leading-relaxed text-ink-muted">
        Pour confirmer que vous êtes au bureau aujourd&apos;hui, commencez par votre e-mail
        professionnel. Ensuite, la caméra et la localisation seront demandées.
      </p>

      <label className="w-full space-y-2 text-left">
        <span className="text-sm font-medium text-ink">E-mail</span>
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus
          data-testid="email-input"
          className="w-full rounded-md border-0 bg-muted px-4 py-3 text-base text-ink outline-none transition focus:bg-white focus:ring-2 focus:ring-ring"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSubmit();
          }}
          placeholder="prenom.nom@linsight.com"
        />
      </label>

      {error ? (
        <p className="w-full text-center text-sm leading-relaxed text-red-600" data-testid="email-error" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        data-testid="email-continue"
        disabled={loading || !email.trim()}
        onClick={onSubmit}
        className="btn-primary"
      >
        {loading ? "Vérification…" : "Continuer"}
      </button>
    </div>
  );
}
