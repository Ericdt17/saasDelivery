import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { type StatutLivraison, type TypeLivraison } from "@/lib/data-transform";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { Search, Eye, Edit, CreditCard, Plus, AlertCircle, RefreshCw, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { getDeliveries, type GetDeliveriesParams } from "@/services/deliveries";
import { searchDeliveries } from "@/services/search";
import { getGroups } from "@/services/groups";
import { mapStatusToBackend } from "@/lib/data-transform";
import { toast } from "sonner";
import { getDateRangeForPreset, type DateRange } from "@/lib/date-utils";
import { DateRangePicker } from "@/components/ui/date-range-picker";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('fr-FR').format(value) + " F";
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const typeLabels: Record<TypeLivraison, string> = {
  livraison: "Livraison",
  pickup: "Pickup",
  expedition: "Expédition"
};

// Map frontend status to backend status
const mapStatusFilter = (frontendStatus: string): string | undefined => {
  if (frontendStatus === "all") return undefined;
  const statusMap: Record<string, string> = {
    "en_cours": "pending",
    "livré": "delivered",
    "échec": "failed",
    "pickup": "pickup",
    "expedition": "expedition",
  };
  return statusMap[frontendStatus];
};

const Livraisons = () => {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState<DateRange>(() => getDateRangeForPreset("today"));
  const [search, setSearch] = useState("");
  const [statutFilter, setStatutFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [quartierFilter, setQuartierFilter] = useState<string>("all");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const limit = 20;

  // Fetch groups for filter dropdown
  const { data: groups = [] } = useQuery({
    queryKey: ["groups"],
    queryFn: getGroups,
  });

  // Create a map of group_id to group_name for quick lookup
  const groupMap = useMemo(() => {
    const map = new Map<number, string>();
    groups.forEach((group) => {
      if (group.id) {
        map.set(group.id, group.name);
      }
    });
    return map;
  }, [groups]);

  // Build API params
  const apiParams: GetDeliveriesParams = useMemo(() => {
    const params: GetDeliveriesParams = {
      page,
      limit,
      sortBy: 'created_at',
      sortOrder: 'DESC',
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    };

    // Map status filter
    const backendStatus = mapStatusFilter(statutFilter);
    if (backendStatus) {
      params.status = backendStatus;
    }

    // Group filter
    if (groupFilter !== "all") {
      params.group_id = parseInt(groupFilter);
    }

    // If search is provided and it looks like a phone number, use phone filter
    // Otherwise, we'll use search API
    if (search && /^[\d\s\+\-]+$/.test(search.trim())) {
      params.phone = search.trim();
    }

    return params;
  }, [page, statutFilter, search, groupFilter, dateRange.startDate, dateRange.endDate]);

  // Fetch deliveries
  const { 
    data: deliveriesData, 
    isLoading, 
    isError, 
    error,
    refetch 
  } = useQuery({
    queryKey: ['deliveries', apiParams, dateRange.startDate, dateRange.endDate],
    queryFn: () => {
      // If search is provided and not a phone number, use search API
      if (search && search.trim() && !/^[\d\s\+\-]+$/.test(search.trim())) {
        return searchDeliveries(search.trim()).then(results => ({
          deliveries: results,
          pagination: {
            page: 1,
            limit: results.length,
            total: results.length,
            totalPages: 1,
          },
        }));
      }
      return getDeliveries(apiParams);
    },
    retry: 2,
    refetchOnWindowFocus: false,
    onError: (error) => {
      toast.error('Erreur lors du chargement des livraisons', {
        description: error instanceof Error ? error.message : 'Une erreur est survenue'
      });
    }
  });

  // Get unique quartiers from deliveries for filter dropdown
  const availableQuartiers = useMemo(() => {
    if (!deliveriesData?.deliveries) return [];
    const quartiersSet = new Set<string>();
    deliveriesData.deliveries.forEach(d => {
      if (d.quartier) quartiersSet.add(d.quartier);
    });
    return Array.from(quartiersSet).sort();
  }, [deliveriesData]);

  // Filter deliveries client-side for type and quartier (since backend doesn't support these)
  const filteredLivraisons = useMemo(() => {
    if (!deliveriesData?.deliveries) return [];
    
    return deliveriesData.deliveries.filter((l) => {
      const matchType = typeFilter === "all" || l.type === typeFilter;
      const matchQuartier = quartierFilter === "all" || l.quartier === quartierFilter;
      return matchType && matchQuartier;
    });
  }, [deliveriesData, typeFilter, quartierFilter]);

  // Reset to page 1 when filters change
  const handleFilterChange = () => {
    setPage(1);
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Livraisons</h1>
          <p className="text-muted-foreground">Gérez toutes vos livraisons</p>
        </div>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Nouvelle livraison
        </Button>
      </div>

      {/* Date Range Picker */}
      <div className="flex flex-col gap-4">
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* Filters */}
      <div className="stat-card">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par téléphone, produit ou quartier..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                handleFilterChange();
              }}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <Select 
              value={statutFilter} 
              onValueChange={(value) => {
                setStatutFilter(value);
                handleFilterChange();
              }}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                <SelectItem value="en_cours">En cours</SelectItem>
                <SelectItem value="livré">Livré</SelectItem>
                <SelectItem value="échec">Échec</SelectItem>
                <SelectItem value="pickup">Pickup</SelectItem>
                <SelectItem value="expedition">Expédition</SelectItem>
              </SelectContent>
            </Select>

            <Select 
              value={typeFilter} 
              onValueChange={(value) => {
                setTypeFilter(value);
                handleFilterChange();
              }}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous types</SelectItem>
                <SelectItem value="livraison">Livraison</SelectItem>
                <SelectItem value="pickup">Pickup</SelectItem>
                <SelectItem value="expedition">Expédition</SelectItem>
              </SelectContent>
            </Select>

            <Select 
              value={quartierFilter} 
              onValueChange={(value) => {
                setQuartierFilter(value);
                handleFilterChange();
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Quartier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous quartiers</SelectItem>
                {availableQuartiers.map((q) => (
                  <SelectItem key={q} value={q}>{q}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select 
              value={groupFilter} 
              onValueChange={(value) => {
                setGroupFilter(value);
                handleFilterChange();
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Groupe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les groupes</SelectItem>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id.toString()}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Error State */}
      {isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erreur de chargement</AlertTitle>
          <AlertDescription className="mt-2">
            <p className="mb-3">
              {error instanceof Error ? error.message : 'Impossible de charger les livraisons'}
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => refetch()}
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Réessayer
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Table */}
      <div className="stat-card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Téléphone</TableHead>
                <TableHead className="font-semibold hidden md:table-cell">Produits</TableHead>
                <TableHead className="font-semibold hidden lg:table-cell">Quartier</TableHead>
                <TableHead className="font-semibold hidden xl:table-cell">Groupe</TableHead>
                <TableHead className="font-semibold text-right">Montant</TableHead>
                <TableHead className="font-semibold text-right hidden sm:table-cell">Encaissé</TableHead>
                <TableHead className="font-semibold text-right hidden sm:table-cell">Reste</TableHead>
                <TableHead className="font-semibold">Statut</TableHead>
                <TableHead className="font-semibold hidden lg:table-cell">Type</TableHead>
                <TableHead className="font-semibold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell className="hidden xl:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    <TableCell className="text-right hidden sm:table-cell"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    <TableCell className="text-right hidden sm:table-cell"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                    <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filteredLivraisons.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="p-8 text-center text-muted-foreground">
                    Aucune livraison trouvée
                  </TableCell>
                </TableRow>
              ) : (
                filteredLivraisons.map((livraison) => (
                  <TableRow 
                    key={livraison.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => navigate(`/livraisons/${livraison.id}`)}
                  >
                    <TableCell className="font-medium">{livraison.telephone}</TableCell>
                    <TableCell className="max-w-[200px] truncate hidden md:table-cell">
                      {livraison.produits}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">{livraison.quartier}</TableCell>
                    <TableCell className="hidden xl:table-cell">
                      {livraison.group_id && groupMap.has(livraison.group_id) ? (
                        <Badge variant="outline" className="gap-1">
                          <Users className="h-3 w-3" />
                          {groupMap.get(livraison.group_id)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(livraison.montant_total)}
                    </TableCell>
                    <TableCell className="text-right text-success hidden sm:table-cell">
                      {formatCurrency(livraison.montant_encaisse)}
                    </TableCell>
                    <TableCell className="text-right hidden sm:table-cell">
                      {livraison.restant > 0 ? (
                        <span className="text-warning font-medium">{formatCurrency(livraison.restant)}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge statut={livraison.statut} />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span className="text-sm text-muted-foreground">
                        {typeLabels[livraison.type]}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => navigate(`/livraisons/${livraison.id}`)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 hidden sm:flex">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 hidden md:flex">
                          <CreditCard className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {!isLoading && deliveriesData && deliveriesData.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Affichage de {(page - 1) * limit + 1} à {Math.min(page * limit, deliveriesData.pagination.total)} sur {deliveriesData.pagination.total} livraison(s)
          </div>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>Précédent</span>
                </Button>
              </PaginationItem>
              
              {Array.from({ length: Math.min(5, deliveriesData.pagination.totalPages) }, (_, i) => {
                let pageNum: number;
                if (deliveriesData.pagination.totalPages <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= deliveriesData.pagination.totalPages - 2) {
                  pageNum = deliveriesData.pagination.totalPages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }
                
                return (
                  <PaginationItem key={pageNum}>
                    <Button
                      variant={page === pageNum ? "outline" : "ghost"}
                      size="sm"
                      onClick={() => setPage(pageNum)}
                      className="w-9"
                    >
                      {pageNum}
                    </Button>
                  </PaginationItem>
                );
              })}
              
              <PaginationItem>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage(p => Math.min(deliveriesData.pagination.totalPages, p + 1))}
                  disabled={page >= deliveriesData.pagination.totalPages}
                  className="gap-1"
                >
                  <span>Suivant</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* Pagination info (when no pagination controls) */}
      {!isLoading && deliveriesData && deliveriesData.pagination.totalPages <= 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <p>{filteredLivraisons.length} livraison(s) trouvée(s)</p>
        </div>
      )}
    </div>
  );
};

export default Livraisons;
