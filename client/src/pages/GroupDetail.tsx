/**
 * Group Detail Page
 * Display stats, deliveries, and CRUD operations for a specific group
 */

import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Package,
  CheckCircle,
  XCircle,
  Clock,
  ShoppingBag,
  Truck,
  Wallet,
  ArrowDownRight,
  Receipt,
  HandCoins,
  Calendar,
  AlertCircle,
  RefreshCw,
  Search,
  Plus,
  Edit,
  Trash2,
  Eye,
  Download,
  ArrowLeft,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { getGroupById } from "@/services/groups";
import { getDailyStats } from "@/services/stats";
import { getDeliveries, type GetDeliveriesParams, type CreateDeliveryRequest } from "@/services/deliveries";
import { apiDelete } from "@/services/api";
import { searchDeliveries } from "@/services/search";
import { DeliveryForm } from "@/components/deliveries/DeliveryForm";
import { calculateStatsFromDeliveries } from "@/lib/stats-utils";
import { getDateRangeLocal, getDateRangeForPreset, type DateRange } from "@/lib/date-utils";
import { type StatutLivraison, type TypeLivraison } from "@/lib/data-transform";
import { toast } from "sonner";
import type { FrontendDelivery } from "@/types/delivery";
import { DateRangePicker } from "@/components/ui/date-range-picker";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("fr-FR").format(value) + " F";
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const typeLabels: Record<TypeLivraison, string> = {
  livraison: "Livraison",
  pickup: "Pickup",
  expedition: "Expédition",
};

export default function GroupDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const groupId = id ? parseInt(id) : null;

  const [period, setPeriod] = useState<"jour" | "semaine" | "mois">("jour");
  const [dateRange, setDateRange] = useState<DateRange>(() => getDateRangeForPreset("today"));
  const [search, setSearch] = useState("");
  const [statutFilter, setStatutFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [quartierFilter, setQuartierFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<FrontendDelivery | null>(null);

  const limit = 20;

  // Fetch group info
  const { data: group, isLoading: isLoadingGroup } = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => getGroupById(groupId!),
    enabled: !!groupId,
  });

  // Check if it's a single day (for daily stats)
  const isSingleDay = dateRange.startDate === dateRange.endDate;

  // Fetch stats for day view (with group_id filter)
  const {
    data: dailyStats,
    isLoading: isLoadingDailyStats,
    isError: isErrorDailyStats,
    error: dailyStatsError,
    refetch: refetchDailyStats,
  } = useQuery({
    queryKey: ["dailyStats", dateRange.startDate, groupId],
    queryFn: () => getDailyStats(dateRange.startDate, groupId),
    enabled: isSingleDay && !!groupId,
    retry: 2,
    refetchOnWindowFocus: false,
  });

  // Fetch deliveries for all periods
  const {
    data: deliveriesData,
    isLoading: isLoadingDeliveries,
    isError: isErrorDeliveries,
    error: deliveriesError,
    refetch: refetchDeliveries,
  } = useQuery({
    queryKey: ["deliveries", "group", groupId, dateRange.startDate, dateRange.endDate],
    queryFn: () =>
      getDeliveries({
        page: 1,
        limit: 1000,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        group_id: groupId!,
        sortBy: "created_at",
        sortOrder: "DESC",
      }),
    enabled: !!groupId,
    retry: 2,
    refetchOnWindowFocus: false,
  });

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

  // Fetch deliveries for search/table
  const apiParams: GetDeliveriesParams = useMemo(() => {
    const params: GetDeliveriesParams = {
      page,
      limit,
      sortBy: "created_at",
      sortOrder: "DESC",
      group_id: groupId!,
    };

    const backendStatus = mapStatusFilter(statutFilter);
    if (backendStatus) {
      params.status = backendStatus;
    }

    if (search && /^[\d\s\+\-]+$/.test(search.trim())) {
      params.phone = search.trim();
    }

    return params;
  }, [page, statutFilter, search, groupId]);

  const {
    data: tableDeliveriesData,
    isLoading: isLoadingTableDeliveries,
    refetch: refetchTableDeliveries,
  } = useQuery({
    queryKey: ["deliveries", "group-table", apiParams],
    queryFn: () => {
      if (search && search.trim() && !/^[\d\s\+\-]+$/.test(search.trim())) {
        return searchDeliveries(search.trim()).then((results) => {
          // Filter by group_id client-side
          const filtered = results.filter((d) => d.group_id === groupId);
          return {
            deliveries: filtered,
            pagination: {
              page: 1,
              limit: filtered.length,
              total: filtered.length,
              totalPages: 1,
            },
          };
        });
      }
      return getDeliveries(apiParams);
    },
    enabled: !!groupId,
    retry: 2,
    refetchOnWindowFocus: false,
  });

  // Calculate stats
  const stats = useMemo(() => {
    if (isSingleDay) {
      const dayDeliveries = deliveriesData?.deliveries || [];
      const dayStats = calculateStatsFromDeliveries(dayDeliveries);

      if (dailyStats) {
        const montantBrut = (dailyStats.montantEncaisse || 0) + (dayStats.totalTarifs || 0);
        return {
          totalLivraisons: dailyStats.totalLivraisons,
          livreesReussies: dailyStats.livreesReussies,
          echecs: dailyStats.echecs,
          enCours: dailyStats.enCours,
          pickups: dailyStats.pickups,
          expeditions: dailyStats.expeditions,
          montantEncaisse: montantBrut,
          montantRestant: dailyStats.montantRestant,
          chiffreAffaires: montantBrut + dailyStats.montantRestant,
          totalTarifs: dayStats.totalTarifs || 0,
          montantNetEncaisse: dailyStats.montantEncaisse || 0,
        };
      }
      return {
        ...dayStats,
        montantNetEncaisse: dayStats.montantEncaisse - (dayStats.totalTarifs || 0),
      };
    }

    if (deliveriesData) {
      return calculateStatsFromDeliveries(deliveriesData.deliveries);
    }

    return {
      totalLivraisons: 0,
      livreesReussies: 0,
      echecs: 0,
      enCours: 0,
      pickups: 0,
      expeditions: 0,
      montantEncaisse: 0,
      montantRestant: 0,
      chiffreAffaires: 0,
      totalTarifs: 0,
      montantNetEncaisse: 0,
    };
  }, [isSingleDay, dailyStats, deliveriesData]);

  // Get unique quartiers
  const availableQuartiers = useMemo(() => {
    if (!tableDeliveriesData?.deliveries) return [];
    const quartiersSet = new Set<string>();
    tableDeliveriesData.deliveries.forEach((d) => {
      if (d.quartier) quartiersSet.add(d.quartier);
    });
    return Array.from(quartiersSet).sort();
  }, [tableDeliveriesData]);

  // Filter deliveries client-side
  const filteredLivraisons = useMemo(() => {
    if (!tableDeliveriesData?.deliveries) return [];
    return tableDeliveriesData.deliveries.filter((l) => {
      const matchType = typeFilter === "all" || l.type === typeFilter;
      const matchQuartier = quartierFilter === "all" || l.quartier === quartierFilter;
      return matchType && matchQuartier;
    });
  }, [tableDeliveriesData, typeFilter, quartierFilter]);


  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateDeliveryRequest> }) =>
      updateDelivery(id, data),
    onSuccess: () => {
      // Invalidate all relevant queries to refresh stats everywhere
      queryClient.invalidateQueries({ queryKey: ["deliveries"] });
      queryClient.invalidateQueries({ queryKey: ["dailyStats"] });
      queryClient.invalidateQueries({ queryKey: ["deliveries", "group"] });
      queryClient.invalidateQueries({ queryKey: ["deliveries", "dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["deliveries", "reports"] });
      queryClient.invalidateQueries({ queryKey: ["deliveries", "group-table"] });
      setIsEditDialogOpen(false);
      setSelectedDelivery(null);
      toast.success("Livraison modifiée avec succès");
    },
    onError: (error: any) => {
      toast.error(error?.data?.message || error?.message || "Erreur lors de la modification");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiDelete(`/api/v1/deliveries/${id}`);
      if (!response.success) {
        throw new Error(response.error || "Erreur lors de la suppression");
      }
      return response;
    },
    onSuccess: () => {
      // Invalidate all relevant queries to refresh stats everywhere
      queryClient.invalidateQueries({ queryKey: ["deliveries"] });
      queryClient.invalidateQueries({ queryKey: ["dailyStats"] });
      queryClient.invalidateQueries({ queryKey: ["deliveries", "group"] });
      queryClient.invalidateQueries({ queryKey: ["deliveries", "dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["deliveries", "reports"] });
      queryClient.invalidateQueries({ queryKey: ["deliveries", "group-table"] });
      setIsDeleteDialogOpen(false);
      setSelectedDelivery(null);
      toast.success("Livraison supprimée avec succès");
    },
    onError: (error: any) => {
      toast.error(error?.data?.message || error?.message || "Erreur lors de la suppression");
    },
  });

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

  const isLoading =
    isSingleDay
      ? isLoadingDailyStats || isLoadingDeliveries
      : isLoadingDeliveries;
  const isError = isSingleDay ? isErrorDailyStats : isErrorDeliveries;
  const error = isSingleDay ? dailyStatsError : deliveriesError;
  const refetch = isSingleDay ? refetchDailyStats : refetchDeliveries;

  const periodLabels = {
    jour: "Aujourd'hui",
    semaine: "Cette semaine",
    mois: "Ce mois",
  };

  if (isLoadingGroup) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!group) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Groupe non trouvé</AlertTitle>
        <AlertDescription>
          <p className="mb-3">Le groupe demandé n'existe pas ou vous n'avez pas accès.</p>
          <Button variant="outline" onClick={() => navigate("/groupes")}>
            Retour aux groupes
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">{group.name}</h1>
            <p className="text-muted-foreground">
              Vue d'ensemble des livraisons du groupe
              {dateRange.startDate === dateRange.endDate ? (
                <span className="ml-2">— {dateRange.startDate}</span>
              ) : (
                <span className="ml-2">— {dateRange.startDate} au {dateRange.endDate}</span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/groupes")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour aux groupes
            </Button>
            <Button
              variant="default"
              onClick={() => {
                // Generate PDF with current date range
                const params = new URLSearchParams();
                if (dateRange.startDate) params.append("startDate", dateRange.startDate);
                if (dateRange.endDate) params.append("endDate", dateRange.endDate);
                
                const url = `/api/v1/reports/groups/${groupId}/pdf${params.toString() ? `?${params.toString()}` : ""}`;
                window.open(url, "_blank");
              }}
            >
              <Download className="w-4 h-4 mr-2" />
              Télécharger rapport
            </Button>
          </div>
        </div>
      </div>

      {/* Date Range Picker */}
      <div className="flex flex-col gap-4">
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* Period Tabs */}
      <Tabs value={period} onValueChange={(v) => {
        setPeriod(v as typeof period);
        // Update dateRange when period changes
        const newDateRange = getDateRangeLocal(v as typeof period);
        setDateRange(newDateRange);
      }} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="jour" className="gap-2">
            <Calendar className="w-4 h-4" />
            Jour
          </TabsTrigger>
          <TabsTrigger value="semaine" className="gap-2">
            <Calendar className="w-4 h-4" />
            Semaine
          </TabsTrigger>
          <TabsTrigger value="mois" className="gap-2">
            <Calendar className="w-4 h-4" />
            Mois
          </TabsTrigger>
        </TabsList>

        <TabsContent value={period} className="mt-6 space-y-6">
          {/* Loading State */}
          {isLoading && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="stat-card">
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-8 w-32" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error State */}
          {isError && !isLoading && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Erreur de chargement</AlertTitle>
              <AlertDescription className="mt-2">
                <p className="mb-3">
                  {error instanceof Error ? error.message : "Impossible de charger les données"}
                </p>
                <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Réessayer
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Content */}
          {!isLoading && !isError && stats && (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <StatCard title="Total livraisons" value={stats.totalLivraisons} icon={Package} />
                <StatCard
                  title="Livrées"
                  value={stats.livreesReussies}
                  icon={CheckCircle}
                  variant="success"
                />
                <StatCard
                  title="Échecs"
                  value={stats.echecs}
                  icon={XCircle}
                  variant="destructive"
                />
                <StatCard title="En cours" value={stats.enCours} icon={Clock} variant="warning" />
                <StatCard
                  title="Pickups"
                  value={stats.pickups}
                  icon={ShoppingBag}
                  variant="info"
                />
                <StatCard
                  title="Expéditions"
                  value={stats.expeditions}
                  icon={Truck}
                  variant="expedition"
                />
                <StatCard
                  title="Encaissé"
                  value={formatCurrency(stats.montantEncaisse)}
                  icon={Wallet}
                  variant="success"
                />
                <StatCard
                  title="Reste à encaisser"
                  value={formatCurrency(stats.montantRestant)}
                  icon={ArrowDownRight}
                  variant="warning"
                />
                <StatCard
                  title="Tarifs appliqués"
                  value={formatCurrency(stats.totalTarifs || 0)}
                  icon={Receipt}
                  variant="info"
                />
                <StatCard
                  title="À reverser aux groupes"
                  value={formatCurrency(stats.montantNetEncaisse || 0)}
                  icon={HandCoins}
                  variant="success"
                />
              </div>

              {/* Search and Filters */}
              <div className="stat-card">
                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher par téléphone, produit ou quartier..."
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(1);
                      }}
                      className="pl-9"
                    />
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Select
                      value={statutFilter}
                      onValueChange={(value) => {
                        setStatutFilter(value);
                        setPage(1);
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
                        setPage(1);
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
                        setPage(1);
                      }}
                    >
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Quartier" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tous quartiers</SelectItem>
                        {availableQuartiers.map((q) => (
                          <SelectItem key={q} value={q}>
                            {q}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Deliveries Table */}
              <div className="stat-card overflow-hidden p-0">
                <div className="p-4 border-b flex items-center justify-between">
                  <h3 className="font-semibold">Livraisons</h3>
                  <Button onClick={() => setIsCreateDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nouvelle livraison
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-semibold">Téléphone</TableHead>
                        <TableHead className="font-semibold hidden lg:table-cell">Quartier</TableHead>
                        <TableHead className="font-semibold text-right">Montant</TableHead>
                        <TableHead className="font-semibold text-right hidden sm:table-cell">
                          Encaissé
                        </TableHead>
                        <TableHead className="font-semibold text-right hidden sm:table-cell">
                          Reste
                        </TableHead>
                        <TableHead className="font-semibold">Statut</TableHead>
                        <TableHead className="font-semibold hidden lg:table-cell">Type</TableHead>
                        <TableHead className="font-semibold text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoadingTableDeliveries ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <TableRow key={i}>
                            <TableCell>
                              <Skeleton className="h-4 w-24" />
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              <Skeleton className="h-4 w-20" />
                            </TableCell>
                            <TableCell className="text-right">
                              <Skeleton className="h-4 w-16 ml-auto" />
                            </TableCell>
                            <TableCell className="text-right hidden sm:table-cell">
                              <Skeleton className="h-4 w-16 ml-auto" />
                            </TableCell>
                            <TableCell className="text-right hidden sm:table-cell">
                              <Skeleton className="h-4 w-16 ml-auto" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-6 w-20" />
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              <Skeleton className="h-4 w-16" />
                            </TableCell>
                            <TableCell className="text-right">
                              <Skeleton className="h-8 w-8 ml-auto" />
                            </TableCell>
                          </TableRow>
                        ))
                      ) : filteredLivraisons.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="p-8 text-center text-muted-foreground">
                            Aucune livraison trouvée
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredLivraisons.map((livraison) => (
                          <TableRow key={livraison.id}>
                            <TableCell className="font-medium">{livraison.telephone}</TableCell>
                            <TableCell className="hidden lg:table-cell">{livraison.quartier}</TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(livraison.montant_total)}
                            </TableCell>
                            <TableCell className="text-right text-success hidden sm:table-cell">
                              {formatCurrency(livraison.montant_encaisse)}
                            </TableCell>
                            <TableCell className="text-right hidden sm:table-cell">
                              {livraison.restant > 0 ? (
                                <span className="text-warning font-medium">
                                  {formatCurrency(livraison.restant)}
                                </span>
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
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => navigate(`/livraisons/${livraison.id}`)}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleEdit(livraison)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => handleDelete(livraison)}
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
              {!isLoadingTableDeliveries &&
                tableDeliveriesData &&
                tableDeliveriesData.pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Affichage de {(page - 1) * limit + 1} à{" "}
                      {Math.min(page * limit, tableDeliveriesData.pagination.total)} sur{" "}
                      {tableDeliveriesData.pagination.total} livraison(s)
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        Précédent
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setPage((p) =>
                            Math.min(tableDeliveriesData.pagination.totalPages, p + 1)
                          )
                        }
                        disabled={page >= tableDeliveriesData.pagination.totalPages}
                      >
                        Suivant
                      </Button>
                    </div>
                  </div>
                )}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouvelle livraison</DialogTitle>
            <DialogDescription>
              Créez une nouvelle livraison pour le groupe "{group.name}"
            </DialogDescription>
          </DialogHeader>
          <DeliveryForm
            delivery={undefined}
            groupId={groupId!}
            onSuccess={() => {
              setIsCreateDialogOpen(false);
              refetchTableDeliveries();
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
                refetchTableDeliveries();
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
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

