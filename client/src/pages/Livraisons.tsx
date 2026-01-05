import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Search, Eye, Edit, CreditCard, Plus, AlertCircle, RefreshCw, ChevronLeft, ChevronRight, Users, Trash2, Loader2 } from "lucide-react";
import { getDeliveries, type GetDeliveriesParams } from "@/services/deliveries";
import { searchDeliveries } from "@/services/search";
import { getGroups } from "@/services/groups";
import { mapStatusToBackend } from "@/lib/data-transform";
import { toast } from "sonner";
import { getDateRangeForPreset, type DateRange } from "@/lib/date-utils";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DeliveryForm } from "@/components/deliveries/DeliveryForm";
import { apiDelete } from "@/services/api";
import { API_ENDPOINTS } from "@/lib/api-config";
import type { FrontendDelivery } from "@/types/delivery";

const formatCurrency = (value: number | undefined | null) => {
  // Handle NaN, undefined, null, or invalid numbers
  const numValue = typeof value === 'number' && !isNaN(value) && isFinite(value) ? value : 0;
  return new Intl.NumberFormat('fr-FR').format(numValue) + " F";
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
    "client_absent": "client_absent",
    "échec": "failed",
    "pickup": "pickup",
    "expedition": "expedition",
  };
  return statusMap[frontendStatus];
};

const Livraisons = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dateRange, setDateRange] = useState<DateRange>(() => getDateRangeForPreset("today"));
  const [search, setSearch] = useState("");
  const [statutFilter, setStatutFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [quartierFilter, setQuartierFilter] = useState<string>("all");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<FrontendDelivery | null>(null);
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

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiDelete(API_ENDPOINTS.DELIVERY_BY_ID(id));
      if (!response.success) {
        throw new Error(response.message || response.error || "Erreur lors de la suppression");
      }
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveries"] });
      queryClient.invalidateQueries({ queryKey: ["delivery"] });
      queryClient.invalidateQueries({ queryKey: ["dailyStats"] });
      setIsDeleteDialogOpen(false);
      setSelectedDelivery(null);
      toast.success("Livraison supprimée avec succès");
    },
    onError: (error: any) => {
      toast.error(error?.data?.message || error?.message || "Erreur lors de la suppression");
    },
  });

  // Handlers
  const handleCreate = () => {
    setIsCreateDialogOpen(true);
  };

  const handleEdit = (delivery: FrontendDelivery) => {
    setSelectedDelivery(delivery);
    setIsEditDialogOpen(true);
  };

  const handleDelete = (delivery: FrontendDelivery) => {
    setSelectedDelivery(delivery);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (selectedDelivery) {
      deleteMutation.mutate(selectedDelivery.id);
    }
  };

  const refetchDeliveries = () => {
    queryClient.invalidateQueries({ queryKey: ["deliveries"] });
    queryClient.invalidateQueries({ queryKey: ["dailyStats"] });
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Livraisons</h1>
          <p className="text-muted-foreground">Gérez toutes vos livraisons</p>
        </div>
        <Button className="gap-2" onClick={handleCreate}>
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
                <SelectItem value="client_absent">Client absent</SelectItem>
                <SelectItem value="échec">Échec</SelectItem>
                <SelectItem value="pickup">Pickup</SelectItem>
                <SelectItem value="expedition">Expédition</SelectItem>
                <SelectItem value="injoignable">Injoignable</SelectItem>
                <SelectItem value="ne_decroche_pas">Ne décroche pas</SelectItem>
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
        <div>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold w-[130px]">Téléphone</TableHead>
                <TableHead className="font-semibold w-[200px]">Produits</TableHead>
                <TableHead className="font-semibold w-[130px]">Quartier</TableHead>
                <TableHead className="font-semibold w-[140px]">Groupe</TableHead>
                <TableHead className="font-semibold text-right w-[110px]">Montant</TableHead>
                <TableHead className="font-semibold text-right w-[110px]">Encaissé</TableHead>
                <TableHead className="font-semibold text-right w-[110px]">Reste</TableHead>
                <TableHead className="font-semibold w-[100px]">Statut</TableHead>
                <TableHead className="font-semibold w-[100px]">Type</TableHead>
                <TableHead className="font-semibold text-right w-[140px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
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
                    <TableCell className="max-w-[200px] truncate">
                      {livraison.produits}
                    </TableCell>
                    <TableCell>{livraison.quartier}</TableCell>
                    <TableCell>
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
                    <TableCell className="text-right text-success">
                      {formatCurrency(livraison.montant_encaisse)}
                    </TableCell>
                    <TableCell className="text-right">
                      {livraison.restant > 0 ? (
                        <span className="text-warning font-medium">{formatCurrency(livraison.restant)}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge statut={livraison.statut} />
                    </TableCell>
                    <TableCell>
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
                          title="Voir les détails"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => handleEdit(livraison)}
                          title="Modifier"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(livraison)}
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouvelle livraison</DialogTitle>
            <DialogDescription>
              Créez une nouvelle livraison
            </DialogDescription>
          </DialogHeader>
          <DeliveryForm
            delivery={undefined}
            onSuccess={() => {
              setIsCreateDialogOpen(false);
              refetchDeliveries();
            }}
            onCancel={() => setIsCreateDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier la livraison</DialogTitle>
            <DialogDescription>
              Modifiez les informations de la livraison
            </DialogDescription>
          </DialogHeader>
          {selectedDelivery && (
            <DeliveryForm
              delivery={selectedDelivery}
              onSuccess={() => {
                setIsEditDialogOpen(false);
                setSelectedDelivery(null);
                refetchDeliveries();
              }}
              onCancel={() => {
                setIsEditDialogOpen(false);
                setSelectedDelivery(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la livraison</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cette livraison ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Livraisons;
