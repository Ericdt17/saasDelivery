import { cn } from "@/lib/utils";
import type { StatutLivraison } from "@/types/delivery";

interface StatusBadgeProps {
  statut: StatutLivraison;
  className?: string;
}

const statutLabels: Record<StatutLivraison, string> = {
  "en_cours": "En cours",
  "livré": "Livré",
  "échec": "Échec",
  "pickup": "Pickup",
  "expedition": "Expédition",
  "annulé": "Annulé",
  "client_absent": "Client absent"
};

export function StatusBadge({ statut, className }: StatusBadgeProps) {
  return (
    <span className={cn(
      "status-badge",
      `status-${statut}`,
      className
    )}>
      {statutLabels[statut]}
    </span>
  );
}
