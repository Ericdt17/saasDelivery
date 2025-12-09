import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { 
  FileText, 
  Download, 
  Calendar, 
  Package, 
  CheckCircle, 
  XCircle, 
  ShoppingBag, 
  Truck,
  Wallet,
  ArrowDownRight,
  AlertCircle,
  RefreshCw
} from "lucide-react";
import { getDailyStats } from "@/services/stats";
import { getDeliveries } from "@/services/deliveries";
import { toast } from "sonner";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('fr-FR').format(value) + " FCFA";
};

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
  const total = deliveries.length;
  const livrees = deliveries.filter(d => d.statut === "livré").length;
  const echecs = deliveries.filter(d => d.statut === "échec").length;
  const pickups = deliveries.filter(d => d.statut === "pickup").length;
  const expeditions = deliveries.filter(d => d.statut === "expedition").length;
  const encaisse = deliveries.reduce((sum, d) => sum + d.montant_encaisse, 0);
  const restant = deliveries.reduce((sum, d) => sum + d.restant, 0);
  
  return {
    livraisons: total,
    livrees,
    echecs,
    pickups,
    expeditions,
    encaisse,
    restant,
  };
};

const Rapports = () => {
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

  // Fetch deliveries for week/month periods
  const { 
    data: deliveriesData, 
    isLoading: isLoadingDeliveries,
    isError: isErrorDeliveries,
    error: deliveriesError,
    refetch: refetchDeliveries 
  } = useQuery({
    queryKey: ['deliveries', 'reports', dateRange.startDate, dateRange.endDate],
    queryFn: () => getDeliveries({ 
      page: 1, 
      limit: 1000, 
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      sortBy: 'created_at', 
      sortOrder: 'DESC' 
    }),
    enabled: period !== "jour",
    retry: 2,
    refetchOnWindowFocus: false,
    onError: (error) => {
      toast.error('Erreur lors du chargement des livraisons', {
        description: error instanceof Error ? error.message : 'Une erreur est survenue'
      });
    }
  });

  // Calculate current data based on period
  const currentData = useMemo(() => {
    if (period === "jour" && dailyStats) {
      return {
        livraisons: dailyStats.totalLivraisons,
        livrees: dailyStats.livreesReussies,
        echecs: dailyStats.echecs,
        pickups: dailyStats.pickups,
        expeditions: dailyStats.expeditions,
        encaisse: dailyStats.montantEncaisse,
        restant: dailyStats.montantRestant,
      };
    } else if (period !== "jour" && deliveriesData) {
      return calculateStatsFromDeliveries(deliveriesData.deliveries);
    }
    return {
      livraisons: 0,
      livrees: 0,
      echecs: 0,
      pickups: 0,
      expeditions: 0,
      encaisse: 0,
      restant: 0,
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

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Rapports</h1>
          <p className="text-muted-foreground">Analysez les performances de votre agence</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
          <Button className="gap-2">
            <FileText className="w-4 h-4" />
            Export PDF
          </Button>
        </div>
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
              <Skeleton className="h-24 w-full" />
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
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
          {!isLoading && !isError && (
            <>
              {/* Summary Card */}
              <div className="stat-card bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/20">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-semibold">Rapport — {periodLabels[period]}</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Résumé complet des activités pour la période sélectionnée
                  {period !== "jour" && (
                    <span className="ml-2">
                      ({dateRange.startDate} au {dateRange.endDate})
                    </span>
                  )}
                </p>
              </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total livraisons"
              value={currentData.livraisons}
              icon={Package}
            />
            <StatCard
              title="Livrées"
              value={currentData.livrees}
              icon={CheckCircle}
              variant="success"
            />
            <StatCard
              title="Échecs"
              value={currentData.echecs}
              icon={XCircle}
              variant="destructive"
            />
            <StatCard
              title="Pickups"
              value={currentData.pickups}
              icon={ShoppingBag}
              variant="info"
            />
            <StatCard
              title="Expéditions"
              value={currentData.expeditions}
              icon={Truck}
              variant="expedition"
            />
            <StatCard
              title="Taux de réussite"
              value={currentData.livraisons > 0 
                ? `${Math.round((currentData.livrees / currentData.livraisons) * 100)}%`
                : "0%"}
              icon={CheckCircle}
              variant="success"
            />
            <StatCard
              title="Total encaissé"
              value={formatCurrency(currentData.encaisse)}
              icon={Wallet}
              variant="success"
            />
            <StatCard
              title="Reste à encaisser"
              value={formatCurrency(currentData.restant)}
              icon={ArrowDownRight}
              variant="warning"
            />
          </div>

              {/* Chart - Only show for week/month with data */}
              {period !== "jour" && deliveriesData && deliveriesData.deliveries.length > 0 && (
                <div className="stat-card">
                  <h3 className="text-lg font-semibold mb-4">Répartition par statut</h3>
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart 
                        data={[
                          {
                            statut: "Livrées",
                            value: currentData.livrees,
                          },
                          {
                            statut: "Échecs",
                            value: currentData.echecs,
                          },
                          {
                            statut: "Pickups",
                            value: currentData.pickups,
                          },
                          {
                            statut: "Expéditions",
                            value: currentData.expeditions,
                          },
                        ]} 
                        margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis 
                          dataKey="statut" 
                          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                          axisLine={{ stroke: "hsl(var(--border))" }}
                        />
                        <YAxis 
                          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                          axisLine={{ stroke: "hsl(var(--border))" }}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: "hsl(var(--card))", 
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px"
                          }}
                        />
                        <Bar 
                          dataKey="value" 
                          fill="hsl(var(--primary))" 
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

          {/* Financial Summary */}
          <div className="stat-card">
            <h3 className="text-lg font-semibold mb-4">Résumé financier</h3>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-success/10 border border-success/20">
                <p className="text-sm text-muted-foreground mb-1">Chiffre d'affaires</p>
                <p className="text-2xl font-bold text-success">
                  {formatCurrency(currentData.encaisse + currentData.restant)}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
                <p className="text-sm text-muted-foreground mb-1">Encaissé</p>
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(currentData.encaisse)}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-warning/10 border border-warning/20">
                <p className="text-sm text-muted-foreground mb-1">À encaisser</p>
                <p className="text-2xl font-bold text-warning">
                  {formatCurrency(currentData.restant)}
                </p>
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

export default Rapports;
