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
  "pickup": "Au bureau",
  "expedition": "Expédition",
  "annulé": "Annulé",
  "renvoyé": "Renvoyé",
  "client_absent": "Client absent",
  "injoignable": "Injoignable",
  "ne_decroche_pas": "Ne décroche pas",
  "present_ne_decroche_zone1": "CPCNDP Z1",
  "present_ne_decroche_zone2": "CPCNDP Z2"
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
