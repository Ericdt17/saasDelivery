import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, History, ArrowRight, Phone, DollarSign, Package, MapPin, Plus, Minus, AlertCircle, RefreshCw } from "lucide-react";
import { getDeliveries } from "@/services/deliveries";
import { getDeliveryHistory } from "@/services/deliveries";
import { toast } from "sonner";

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const typeLabels = {
  numero: "Changement de numéro",
  montant: "Changement de montant",
  produits: "Modification produits",
  quartier: "Changement de quartier",
  ajout_produit: "Ajout de produit",
  suppression_produit: "Suppression de produit"
};

const typeIcons = {
  numero: Phone,
  montant: DollarSign,
  produits: Package,
  quartier: MapPin,
  ajout_produit: Plus,
  suppression_produit: Minus
};

const typeBadgeStyles = {
  numero: "bg-info/15 text-info",
  montant: "bg-warning/15 text-warning",
  produits: "bg-primary/15 text-primary",
  quartier: "bg-expedition/15 text-expedition",
  ajout_produit: "bg-success/15 text-success",
  suppression_produit: "bg-destructive/15 text-destructive"
};

// Modification data structure
interface ModificationData {
  id: number;
  livraison_id: number;
  type: string;
  ancienne_valeur: string;
  nouvelle_valeur: string;
  date: string;
  auteur: string;
  telephone?: string;
}

// Map history action to modification type
const mapActionToType = (action: string, details: string | null): string | null => {
  const actionLower = action.toLowerCase();
  
  // Try to parse details as JSON to extract field changes
  let parsedDetails: any = null;
  if (details) {
    try {
      parsedDetails = JSON.parse(details);
    } catch {
      // Not JSON, use as-is
    }
  }
  
  // Map common actions to modification types
  if (actionLower.includes('phone') || actionLower.includes('numero') || actionLower.includes('number')) {
    return 'numero';
  }
  if (actionLower.includes('amount') || actionLower.includes('montant') || actionLower.includes('payment')) {
    return 'montant';
  }
  if (actionLower.includes('items') || actionLower.includes('produits') || actionLower.includes('product')) {
    return 'produits';
  }
  if (actionLower.includes('quartier') || actionLower.includes('location') || actionLower.includes('address')) {
    return 'quartier';
  }
  
  // Default to a generic type
  return 'produits';
};

// Extract old/new values from history details
const extractModificationValues = (action: string, details: string | null, delivery: any): { old: string; new: string } => {
  let oldValue = '';
  let newValue = '';
  
  if (details) {
    try {
      const parsed = JSON.parse(details);
      // If details is JSON, try to extract meaningful values
      if (typeof parsed === 'object') {
        // For updates, details might contain the update data
        newValue = JSON.stringify(parsed);
        oldValue = 'Ancienne valeur';
      } else {
        newValue = String(parsed);
      }
    } catch {
      // Not JSON, use details as new value
      newValue = details;
      oldValue = 'Ancienne valeur';
    }
  } else {
    // Use action description
    newValue = action;
    oldValue = 'Avant';
  }
  
  return { old: oldValue, new: newValue };
};

const Modifications = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Fetch recent deliveries (last 200 to get modifications)
  const { 
    data: deliveriesData, 
    isLoading: isLoadingDeliveries,
    isError: isErrorDeliveries,
    error: deliveriesError,
    refetch: refetchDeliveries 
  } = useQuery({
    queryKey: ['deliveries', 'modifications'],
    queryFn: () => getDeliveries({ page: 1, limit: 200, sortBy: 'updated_at', sortOrder: 'DESC' }),
    retry: 2,
    refetchOnWindowFocus: false,
    onError: (error) => {
      toast.error('Erreur lors du chargement des livraisons', {
        description: error instanceof Error ? error.message : 'Une erreur est survenue'
      });
    }
  });

  // Fetch history for all deliveries (in parallel, but limit to avoid too many requests)
  const deliveryIds = useMemo(() => {
    return deliveriesData?.deliveries?.slice(0, 100).map(d => d.id) || [];
  }, [deliveriesData]);

  // Fetch histories for deliveries (limit to first 50 to avoid too many API calls)
  const historyQueries = useQuery({
    queryKey: ['deliveryHistories', deliveryIds.slice(0, 50)],
    queryFn: async () => {
      const histories = await Promise.allSettled(
        deliveryIds.slice(0, 50).map(id => getDeliveryHistory(id))
      );
      
      // Combine all histories with their delivery IDs
      const results: Array<{ deliveryId: number; history: any[] }> = [];
      histories.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push({
            deliveryId: deliveryIds[index],
            history: result.value
          });
        }
      });
      return results;
    },
    enabled: deliveryIds.length > 0,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Transform history entries to modifications
  const modifications: ModificationData[] = useMemo(() => {
    if (!historyQueries.data || !deliveriesData?.deliveries) return [];
    
    const allModifications: ModificationData[] = [];
    const deliveryMap = new Map(deliveriesData.deliveries.map(d => [d.id, d]));
    
    historyQueries.data.forEach(({ deliveryId, history }) => {
      const delivery = deliveryMap.get(deliveryId);
      if (!delivery) return;
      
      history.forEach((entry: any) => {
        // Skip "created" actions as they're not modifications
        if (entry.action === 'created') return;
        
        const modType = mapActionToType(entry.action, entry.details);
        if (!modType) return;
        
        const { old, new: newVal } = extractModificationValues(entry.action, entry.details, delivery);
        
        allModifications.push({
          id: entry.id,
          livraison_id: deliveryId,
          type: modType,
          ancienne_valeur: old,
          nouvelle_valeur: newVal,
          date: entry.created_at || entry.date || new Date().toISOString(),
          auteur: entry.actor || 'bot',
          telephone: delivery.telephone,
        });
      });
    });
    
    // Sort by date (most recent first)
    return allModifications.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [historyQueries.data, deliveriesData]);

  // Filter modifications
  const filteredModifications = useMemo(() => {
    return modifications.filter((m) => {
      const matchSearch = 
        m.telephone?.toLowerCase().includes(search.toLowerCase()) ||
        m.ancienne_valeur.toLowerCase().includes(search.toLowerCase()) ||
        m.nouvelle_valeur.toLowerCase().includes(search.toLowerCase()) ||
        m.auteur.toLowerCase().includes(search.toLowerCase());
      const matchType = typeFilter === "all" || m.type === typeFilter;
      return matchSearch && matchType;
    });
  }, [modifications, search, typeFilter]);

  const isLoading = isLoadingDeliveries || historyQueries.isLoading;
  const isError = isErrorDeliveries || historyQueries.isError;
  const error = deliveriesError || historyQueries.error;

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Modifications</h1>
        <p className="text-muted-foreground">Historique des modifications apportées aux livraisons</p>
      </div>

      {/* Error State */}
      {isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erreur de chargement</AlertTitle>
          <AlertDescription className="mt-2">
            <p className="mb-3">
              {error instanceof Error ? error.message : 'Impossible de charger les modifications'}
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                refetchDeliveries();
                historyQueries.refetch();
              }}
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Réessayer
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      {!isLoading && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Object.entries(typeLabels).map(([type, label]) => {
            const Icon = typeIcons[type as keyof typeof typeIcons];
            const count = modifications.filter(m => m.type === type).length;
            return (
              <div key={type} className="stat-card">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${typeBadgeStyles[type as keyof typeof typeBadgeStyles]}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">{count}</p>
                    <p className="text-xs text-muted-foreground truncate">{label.split(' ')[0]}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Loading Stats */}
      {isLoading && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="stat-card">
              <Skeleton className="h-16 w-full" />
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="stat-card">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par téléphone, valeur, auteur..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Type de modification" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous types</SelectItem>
              {Object.entries(typeLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="stat-card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Livraison</TableHead>
                <TableHead className="font-semibold">Type</TableHead>
                <TableHead className="font-semibold hidden md:table-cell">Ancienne valeur</TableHead>
                <TableHead className="font-semibold hidden md:table-cell"></TableHead>
                <TableHead className="font-semibold hidden md:table-cell">Nouvelle valeur</TableHead>
                <TableHead className="font-semibold">Auteur</TableHead>
                <TableHead className="font-semibold hidden sm:table-cell">Date</TableHead>
                <TableHead className="font-semibold text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-4" /></TableCell>
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                    <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filteredModifications.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="p-8 text-center text-muted-foreground">
                    Aucune modification trouvée
                  </TableCell>
                </TableRow>
              ) : (
                filteredModifications.map((modification) => {
                  const Icon = (typeIcons[modification.type as keyof typeof typeIcons] || History) as React.ElementType;
                  const typeLabel = typeLabels[modification.type as keyof typeof typeLabels] || modification.type;
                  const badgeStyle = typeBadgeStyles[modification.type as keyof typeof typeBadgeStyles] || "bg-muted text-muted-foreground";
                  
                  return (
                    <TableRow 
                      key={modification.id} 
                      className="hover:bg-muted/50 cursor-pointer"
                      onClick={() => navigate(`/livraisons/${modification.livraison_id}`)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">#{modification.livraison_id}</span>
                          {modification.telephone && (
                            <span className="text-xs text-muted-foreground hidden lg:inline">
                              {modification.telephone}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`status-badge ${badgeStyle}`}>
                          <Icon className="w-3 h-3 mr-1" />
                          <span className="hidden sm:inline">{typeLabel}</span>
                          <span className="sm:hidden">{modification.type}</span>
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate hidden md:table-cell">
                        <span className="text-muted-foreground line-through">
                          {modification.ancienne_valeur}
                        </span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate hidden md:table-cell font-medium">
                        {modification.nouvelle_valeur}
                      </TableCell>
                      <TableCell>
                        <span className="px-2 py-1 rounded-md bg-muted text-sm">
                          {modification.auteur}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm hidden sm:table-cell">
                        {formatDate(modification.date)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/livraisons/${modification.livraison_id}`);
                          }}
                        >
                          Voir
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Info */}
      <div className="stat-card bg-muted/50">
        <div className="flex items-start gap-3">
          <History className="w-5 h-5 text-muted-foreground mt-0.5" />
          <div>
            <p className="font-medium">À propos des modifications</p>
            <p className="text-sm text-muted-foreground mt-1">
              Toutes les modifications apportées aux livraisons sont automatiquement enregistrées ici. 
              Cet historique permet de suivre les changements et d'assurer la traçabilité des opérations.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Modifications;
