import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Phone, MapPin } from "lucide-react";
import { getDeliveries } from "@/services/deliveries";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('fr-FR').format(value) + " FCFA";
};

export function RecentDeliveries() {
  const navigate = useNavigate();
  
  const { data, isLoading } = useQuery({
    queryKey: ['recentDeliveries'],
    queryFn: () => getDeliveries({ page: 1, limit: 5, sortBy: 'created_at', sortOrder: 'DESC' }),
    refetchOnWindowFocus: false,
  });

  const recentLivraisons = data?.deliveries || [];

  return (
    <div className="stat-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Livraisons récentes</h3>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate("/livraisons")}
          className="text-primary hover:text-primary/80"
        >
          Voir tout <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex-1 min-w-0 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-6 w-16" />
            </div>
          ))
        ) : recentLivraisons.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Aucune livraison récente</p>
          </div>
        ) : (
          recentLivraisons.map((livraison) => (
            <div 
              key={livraison.id}
              onClick={() => navigate(`/livraisons/${livraison.id}`)}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
            >
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="font-medium truncate">{livraison.telephone}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <MapPin className="w-3.5 h-3.5" />
                  <span className="truncate">{livraison.quartier}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 ml-4">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-semibold">{formatCurrency(livraison.montant_total)}</p>
                  {livraison.restant > 0 && (
                    <p className="text-xs text-warning">Reste: {formatCurrency(livraison.restant)}</p>
                  )}
                </div>
                <StatusBadge statut={livraison.statut} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
