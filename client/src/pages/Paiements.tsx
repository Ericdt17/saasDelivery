import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Search, Wallet, ArrowDownRight, CheckCircle, Clock, TrendingUp, AlertCircle, RefreshCw, Calendar } from "lucide-react";
import { getDeliveries } from "@/services/deliveries";
import { getDailyStats } from "@/services/stats";
import { toast } from "sonner";

// Helper to get date range for period
const getDateRange = (period: "jour" | "semaine" | "mois") => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  switch (period) {
    case "jour":
      return {
        startDate: today.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0],
      };
    case "semaine":
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
      return {
        startDate: weekStart.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0],
      };
    case "mois":
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      return {
        startDate: monthStart.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0],
      };
  }
};

// Calculate stats from deliveries
const calculateStatsFromDeliveries = (deliveries: any[]) => {
  const encaisse = deliveries.reduce((sum, d) => sum + (d.montant_encaisse || 0), 0);
  const restant = deliveries.reduce((sum, d) => sum + (d.restant || 0), 0);
  
  return {
    totalLivraisons: deliveries.length,
    livreesReussies: deliveries.filter(d => d.statut === "livré").length,
    echecs: deliveries.filter(d => d.statut === "échec").length,
    enCours: deliveries.filter(d => d.statut === "en_cours").length,
    pickups: deliveries.filter(d => d.statut === "pickup").length,
    expeditions: deliveries.filter(d => d.statut === "expedition").length,
    montantEncaisse: encaisse,
    montantRestant: restant,
    chiffreAffaires: encaisse + restant,
  };
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('fr-FR').format(value) + " FCFA";
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

const typeLabels = {
  partiel: "Partiel",
  complet: "Complet",
  en_attente: "En attente"
};

const typeBadgeStyles = {
  partiel: "bg-warning/15 text-warning",
  complet: "bg-success/15 text-success",
  en_attente: "bg-muted text-muted-foreground"
};

// Payment type derived from delivery payment status
type PaymentType = "partiel" | "complet" | "en_attente";

interface PaymentData {
  id: number;
  livraison_id: number;
  telephone: string;
  montant: number;
  type: PaymentType;
  date: string;
  mode_paiement: string;
  montant_total: number;
  montant_encaisse: number;
  restant: number;
}

const Paiements = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [period, setPeriod] = useState<"jour" | "semaine" | "mois">("jour");
  
  const dateRange = useMemo(() => getDateRange(period), [period]);

  // Fetch stats for today (for day view)
  const { 
    data: dailyStats, 
    isLoading: isLoadingDailyStats,
    isError: isErrorDailyStats,
    error: dailyStatsError,
    refetch: refetchDailyStats 
  } = useQuery({
    queryKey: ['dailyStats', dateRange.startDate],
    queryFn: () => getDailyStats(dateRange.startDate),
    enabled: period === "jour",
    retry: 2,
    refetchOnWindowFocus: false,
    onError: (error) => {
      toast.error('Erreur lors du chargement des statistiques', {
        description: error instanceof Error ? error.message : 'Une erreur est survenue'
      });
    }
  });

  // Fetch deliveries for all periods (needed for payments list)
  const { 
    data: deliveriesData, 
    isLoading: isLoadingDeliveries,
    isError: isErrorDeliveries,
    error: deliveriesError,
    refetch: refetchDeliveries 
  } = useQuery({
    queryKey: ['deliveries', 'payments', dateRange.startDate, dateRange.endDate],
    queryFn: () => getDeliveries({ 
      page: 1, 
      limit: 1000, 
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      sortBy: 'created_at', 
      sortOrder: 'DESC' 
    }),
    retry: 2,
    refetchOnWindowFocus: false,
    onError: (error) => {
      toast.error('Erreur lors du chargement des livraisons', {
        description: error instanceof Error ? error.message : 'Une erreur est survenue'
      });
    }
  });

  // Calculate current stats based on period
  const stats = useMemo(() => {
    if (period === "jour") {
      // For day view, always use dailyStats (even if it's zero/null)
      if (dailyStats) {
        return {
          totalLivraisons: dailyStats.totalLivraisons || 0,
          livreesReussies: dailyStats.livreesReussies || 0,
          echecs: dailyStats.echecs || 0,
          enCours: dailyStats.enCours || 0,
          pickups: dailyStats.pickups || 0,
          expeditions: dailyStats.expeditions || 0,
          montantEncaisse: dailyStats.montantEncaisse || 0,
          montantRestant: dailyStats.montantRestant || 0,
          chiffreAffaires: dailyStats.chiffreAffaires || 0,
        };
      }
      // If dailyStats is null/undefined, return zeros
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
      };
    } else if (period !== "jour" && deliveriesData) {
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
    };
  }, [period, dailyStats, deliveriesData]);

  const isLoading = (period === "jour" ? isLoadingDailyStats : isLoadingDeliveries);
  const isError = (period === "jour" ? isErrorDailyStats : isErrorDeliveries);
  const error = (period === "jour" ? dailyStatsError : deliveriesError);
  const refetch = (period === "jour" ? refetchDailyStats : refetchDeliveries);

  const periodLabels = {
    jour: "Aujourd'hui",
    semaine: "Cette semaine",
    mois: "Ce mois"
  };


  // Derive payment data from deliveries for current period
  const payments: PaymentData[] = useMemo(() => {
    // For day view, if dailyStats shows zero, return empty array immediately
    if (period === "jour") {
      if (!dailyStats || dailyStats.totalLivraisons === 0) {
        return [];
      }
    }
    
    if (!deliveriesData?.deliveries) return [];
    
    // Filter deliveries by the selected period date range (strictly)
    const deliveriesToUse = deliveriesData.deliveries.filter(d => {
      if (!d.date_creation) return false;
      
      // Parse date and normalize to YYYY-MM-DD
      let deliveryDate: Date;
      if (typeof d.date_creation === 'string') {
        deliveryDate = new Date(d.date_creation);
      } else {
        deliveryDate = d.date_creation;
      }
      
      if (isNaN(deliveryDate.getTime())) return false;
      
      deliveryDate.setHours(0, 0, 0, 0);
      const deliveryDateStr = deliveryDate.toISOString().split('T')[0];
      
      // For day view, must match exactly
      if (period === "jour") {
        return deliveryDateStr === dateRange.startDate;
      }
      
      // For week/month, use range
      return deliveryDateStr >= dateRange.startDate && deliveryDateStr <= dateRange.endDate;
    });
    
    if (!deliveriesToUse || deliveriesToUse.length === 0) return [];
    
    return deliveriesToUse
      .filter(d => (d.montant_encaisse || 0) > 0) // Only deliveries with payments
      .map(d => {
        const type: PaymentType = 
          (d.restant || 0) === 0 ? "complet" : 
          (d.montant_encaisse || 0) > 0 ? "partiel" : 
          "en_attente";
        
        return {
          id: d.id,
          livraison_id: d.id,
          telephone: d.telephone,
          montant: d.montant_encaisse || 0,
          type,
          date: d.date_mise_a_jour || d.date_creation,
          mode_paiement: "Non spécifié", // Backend doesn't store payment method separately
          montant_total: d.montant_total || 0,
          montant_encaisse: d.montant_encaisse || 0,
          restant: d.restant || 0,
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [period, deliveriesData, dateRange, dailyStats]);

  // Filter payments
  const filteredPaiements = useMemo(() => {
    return payments.filter((p) => {
      const matchSearch = 
        p.telephone.toLowerCase().includes(search.toLowerCase()) ||
        p.mode_paiement.toLowerCase().includes(search.toLowerCase());
      const matchType = typeFilter === "all" || p.type === typeFilter;
      return matchSearch && matchType;
    });
  }, [payments, search, typeFilter]);

  // Calculate totals - only from payments in the current period
  const totalPartiels = useMemo(() => {
    if (!payments || payments.length === 0) return 0;
    return payments
      .filter(p => p.type === "partiel")
      .reduce((acc, p) => acc + (p.montant || 0), 0);
  }, [payments, period, dateRange]);

  const totalComplets = useMemo(() => {
    if (!payments || payments.length === 0) return 0;
    return payments
      .filter(p => p.type === "complet")
      .reduce((acc, p) => acc + (p.montant || 0), 0);
  }, [payments, period, dateRange]);

  const pieData = useMemo(() => {
    if (!stats) return [];
    
    const encaisse = stats.montantEncaisse || 0;
    const restant = stats.montantRestant || 0;
    
    // Only show pie chart if there's data
    if (encaisse === 0 && restant === 0) return [];
    
    return [
      { name: "Encaissé", value: encaisse, color: "hsl(var(--success))" },
      { name: "Reste", value: restant, color: "hsl(var(--warning))" }
    ];
  }, [stats]);

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6 pb-8">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="stat-card">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-32" />
            </div>
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="space-y-6 pb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Paiements</h1>
          <p className="text-muted-foreground">Suivi des encaissements et paiements</p>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erreur de chargement</AlertTitle>
          <AlertDescription className="mt-2">
            <p className="mb-3">
              {statsError instanceof Error ? statsError.message : 
               deliveriesError instanceof Error ? deliveriesError.message :
               'Impossible de charger les données'}
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                refetchStats();
                refetchDeliveries();
              }}
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Réessayer
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Paiements</h1>
        <p className="text-muted-foreground">Suivi des encaissements et paiements — {periodLabels[period]}</p>
      </div>

      {/* Period Tabs */}
      <Tabs value={period} onValueChange={(v) => setPeriod(v as typeof period)} className="w-full">
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
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="stat-card">
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-8 w-32" />
                  </div>
                ))}
              </div>
              <Skeleton className="h-96 w-full" />
            </div>
          )}

          {/* Error State */}
          {isError && !isLoading && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Erreur de chargement</AlertTitle>
              <AlertDescription className="mt-2">
                <p className="mb-3">
                  {error instanceof Error ? error.message : 'Impossible de charger les données'}
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

          {/* Content */}
          {!isLoading && !isError && stats && (
            <>
              {/* Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Total encaissé"
                  value={formatCurrency(stats.montantEncaisse || 0)}
                  icon={Wallet}
                  variant="success"
                />
                <StatCard
                  title="Reste à encaisser"
                  value={formatCurrency(stats.montantRestant || 0)}
                  icon={ArrowDownRight}
                  variant="warning"
                />
                <StatCard
                  title="Paiements partiels"
                  value={formatCurrency(totalPartiels)}
                  icon={Clock}
                  variant="info"
                />
                <StatCard
                  title="Paiements complets"
                  value={formatCurrency(totalComplets)}
                  icon={CheckCircle}
                  variant="success"
                />
              </div>

              {/* Chart and Table Grid */}
              <div className="grid lg:grid-cols-3 gap-6">
                {/* Pie Chart */}
                <div className="stat-card">
                  <h3 className="text-lg font-semibold mb-4">Répartition — {periodLabels[period]}</h3>
                  {pieData.length > 0 && pieData.some(d => d.value > 0) ? (
                    <>
                      <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={pieData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={90}
                              paddingAngle={4}
                              dataKey="value"
                            >
                              {pieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip 
                              formatter={(value: number) => formatCurrency(value)}
                              contentStyle={{ 
                                backgroundColor: "hsl(var(--card))", 
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "8px"
                              }}
                            />
                            <Legend 
                              verticalAlign="bottom"
                              formatter={(value) => <span className="text-sm">{value}</span>}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      {stats && (
                        <div className="mt-4 p-3 rounded-lg bg-muted/50">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Taux d'encaissement</span>
                            <span className="font-bold text-primary">
                              {(stats.montantEncaisse || 0) + (stats.montantRestant || 0) > 0
                                ? Math.round(((stats.montantEncaisse || 0) / ((stats.montantEncaisse || 0) + (stats.montantRestant || 0))) * 100)
                                : 0}%
                            </span>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                      <p>Aucune donnée disponible</p>
                    </div>
                  )}
                </div>

                {/* Payments Table */}
                <div className="lg:col-span-2 stat-card overflow-hidden p-0">
                  <div className="p-4 border-b border-border">
                    <h3 className="text-lg font-semibold mb-4">Liste des paiements</h3>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Rechercher..."
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                      <Select value={typeFilter} onValueChange={setTypeFilter}>
                        <SelectTrigger className="w-[150px]">
                          <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tous types</SelectItem>
                          <SelectItem value="partiel">Partiels</SelectItem>
                          <SelectItem value="complet">Complets</SelectItem>
                          <SelectItem value="en_attente">En attente</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="font-semibold">Client</TableHead>
                          <TableHead className="font-semibold text-right">Montant</TableHead>
                          <TableHead className="font-semibold">Mode</TableHead>
                          <TableHead className="font-semibold">Type</TableHead>
                          <TableHead className="font-semibold">Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPaiements.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="p-8 text-center text-muted-foreground">
                              Aucun paiement trouvé
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredPaiements.map((paiement) => (
                            <TableRow 
                              key={paiement.id} 
                              className="hover:bg-muted/50 cursor-pointer"
                              onClick={() => navigate(`/livraisons/${paiement.livraison_id}`)}
                            >
                              <TableCell className="font-medium">
                                {paiement.telephone}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {formatCurrency(paiement.montant)}
                              </TableCell>
                              <TableCell>{paiement.mode_paiement}</TableCell>
                              <TableCell>
                                <span className={`status-badge ${typeBadgeStyles[paiement.type]}`}>
                                  {typeLabels[paiement.type]}
                                </span>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {formatDate(paiement.date)}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Paiements;
