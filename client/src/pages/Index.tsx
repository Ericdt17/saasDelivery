import { useState, useMemo } from "react";
import {
  Package,
  CheckCircle,
  XCircle,
  Clock,
  ShoppingBag,
  Truck,
  Wallet,
  TrendingUp,
  ArrowDownRight,
  ArrowUpRight,
  AlertCircle,
  RefreshCw,
  Calendar,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { StatCard } from "@/components/ui/stat-card";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import { EncaissementsChart } from "@/components/dashboard/EncaissementsChart";
import { RecentDeliveries } from "@/components/dashboard/RecentDeliveries";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getDailyStats } from "@/services/stats";
import { getDeliveries } from "@/services/deliveries";
import { toast } from "sonner";
import { getDateRangeLocal } from "@/lib/date-utils";
import { calculateStatsFromDeliveries } from "@/lib/stats-utils";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("fr-FR").format(value) + " F";
};

const Index = () => {
  const [period, setPeriod] = useState<"jour" | "semaine" | "mois">("jour");

  const dateRange = useMemo(() => getDateRangeLocal(period), [period]);

  // Fetch stats for today (for day view)
  const {
    data: dailyStats,
    isLoading: isLoadingDailyStats,
    isError: isErrorDailyStats,
    error: dailyStatsError,
    refetch: refetchDailyStats,
  } = useQuery({
    queryKey: ["dailyStats", dateRange.startDate],
    queryFn: () => getDailyStats(dateRange.startDate),
    enabled: period === "jour",
    retry: 2,
    refetchOnWindowFocus: false,
    onError: (error) => {
      toast.error("Erreur lors du chargement des statistiques", {
        description:
          error instanceof Error ? error.message : "Une erreur est survenue",
      });
    },
  });

  // Fetch deliveries for week/month periods
  const {
    data: deliveriesData,
    isLoading: isLoadingDeliveries,
    isError: isErrorDeliveries,
    error: deliveriesError,
    refetch: refetchDeliveries,
  } = useQuery({
    queryKey: [
      "deliveries",
      "dashboard",
      dateRange.startDate,
      dateRange.endDate,
    ],
    queryFn: () =>
      getDeliveries({
        page: 1,
        limit: 1000,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        sortBy: "created_at",
        sortOrder: "DESC",
      }),
    enabled: period !== "jour",
    retry: 2,
    refetchOnWindowFocus: false,
    onError: (error) => {
      toast.error("Erreur lors du chargement des livraisons", {
        description:
          error instanceof Error ? error.message : "Une erreur est survenue",
      });
    },
  });

  // Calculate current data based on period
  const stats = useMemo(() => {
    if (period === "jour") {
      if (dailyStats) {
        return {
          totalLivraisons: dailyStats.totalLivraisons,
          livreesReussies: dailyStats.livreesReussies,
          echecs: dailyStats.echecs,
          enCours: dailyStats.enCours,
          pickups: dailyStats.pickups,
          expeditions: dailyStats.expeditions,
          montantEncaisse: dailyStats.montantEncaisse,
          montantRestant: dailyStats.montantRestant,
          chiffreAffaires: dailyStats.chiffreAffaires,
        };
      }
      // Jour sans dailyStats -> valeurs neutres (pas de fallback livraisons)
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
    }

    if (period !== "jour" && deliveriesData) {
      return calculateStatsFromDeliveries(deliveriesData.deliveries);
    }

    // Semaine/Mois sans données -> valeurs neutres
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

  const isLoading =
    period === "jour" ? isLoadingDailyStats : isLoadingDeliveries;
  const isError = period === "jour" ? isErrorDailyStats : isErrorDeliveries;
  const error = period === "jour" ? dailyStatsError : deliveriesError;
  const refetch = period === "jour" ? refetchDailyStats : refetchDeliveries;

  const periodLabels = {
    jour: "Aujourd'hui",
    semaine: "Cette semaine",
    mois: "Ce mois",
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6 pb-8">
        {/* Header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl md:text-3xl font-bold">Tableau de bord</h1>
          <p className="text-muted-foreground">
            Vue d'ensemble des livraisons du jour —{" "}
            {new Date().toLocaleDateString("fr-FR", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        {/* Loading Skeletons */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="stat-card">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-32" />
            </div>
          ))}
        </div>
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  // Error state
  if (isError || !stats) {
    return (
      <div className="space-y-6 pb-8">
        {/* Header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl md:text-3xl font-bold">Tableau de bord</h1>
          <p className="text-muted-foreground">
            Vue d'ensemble des livraisons du jour —{" "}
            {new Date().toLocaleDateString("fr-FR", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erreur de chargement</AlertTitle>
          <AlertDescription className="mt-2">
            <p className="mb-3">
              {error instanceof Error
                ? error.message
                : "Impossible de charger les statistiques"}
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
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl md:text-3xl font-bold">Tableau de bord</h1>
        <p className="text-muted-foreground">
          Vue d'ensemble des livraisons — {periodLabels[period]}
        </p>
      </div>

      {/* Period Tabs */}
      <Tabs
        value={period}
        onValueChange={(v) => setPeriod(v as typeof period)}
        className="w-full"
      >
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
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="stat-card">
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-8 w-32" />
                  </div>
                ))}
              </div>
              <Skeleton className="h-32 w-full" />
            </div>
          )}

          {/* Error State */}
          {isError && !isLoading && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Erreur de chargement</AlertTitle>
              <AlertDescription className="mt-2">
                <p className="mb-3">
                  {error instanceof Error
                    ? error.message
                    : "Impossible de charger les données"}
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
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Total livraisons"
                  value={stats.totalLivraisons}
                  icon={Package}
                />
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
                <StatCard
                  title="En cours"
                  value={stats.enCours}
                  icon={Clock}
                  variant="warning"
                />
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
              </div>

              {/* Chiffre d'affaires highlight */}
              <div className="stat-card bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Chiffre d'affaires — {periodLabels[period]}
                    </p>
                    <p className="text-3xl font-bold text-primary mt-1">
                      {formatCurrency(stats.chiffreAffaires)}
                    </p>
                    {period === "jour" && (
                      <div className="flex items-center gap-1 mt-2 text-sm text-success">
                        <ArrowUpRight className="w-4 h-4" />
                        <span>+15% vs moyenne</span>
                      </div>
                    )}
                  </div>
                  <div className="hidden sm:flex p-4 rounded-2xl bg-primary/10">
                    <TrendingUp className="w-8 h-8 text-primary" />
                  </div>
                </div>
              </div>

              {/* Charts - Only show for day view */}
              {period === "jour" && (
                <div className="grid lg:grid-cols-2 gap-6">
                  <PerformanceChart />
                  <EncaissementsChart />
                </div>
              )}

              {/* Recent Deliveries */}
              <RecentDeliveries />
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Index;
