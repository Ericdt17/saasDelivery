import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Search, Truck, Plus, Upload, Eye, MapPin, Phone, FileImage, AlertCircle, RefreshCw } from "lucide-react";
import { getDeliveries } from "@/services/deliveries";
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

const statutBadgeStyles = {
  en_attente: "bg-warning/15 text-warning",
  envoyé: "bg-info/15 text-info",
  livré: "bg-success/15 text-success"
};

const statutLabels = {
  en_attente: "En attente",
  envoyé: "Envoyé",
  livré: "Livré"
};

// Map delivery to expedition format
interface ExpeditionData {
  id: number;
  livraison_id: number;
  telephone: string;
  destination: string;
  transporteur: string;
  date_envoi: string;
  bordereau: string | null;
  statut: "en_attente" | "envoyé" | "livré";
  notes: string;
}

const Expeditions = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [transporteurFilter, setTransporteurFilter] = useState<string>("all");
  const [statutFilter, setStatutFilter] = useState<string>("all");
  const [showNewModal, setShowNewModal] = useState(false);

  // Fetch deliveries with carrier (expeditions)
  const { 
    data: deliveriesData, 
    isLoading, 
    isError, 
    error,
    refetch 
  } = useQuery({
    queryKey: ['deliveries', 'expeditions'],
    queryFn: () => getDeliveries({ page: 1, limit: 1000, sortBy: 'created_at', sortOrder: 'DESC' }),
    retry: 2,
    refetchOnWindowFocus: false,
    onError: (error) => {
      toast.error('Erreur lors du chargement des expéditions', {
        description: error instanceof Error ? error.message : 'Une erreur est survenue'
      });
    }
  });

  // Filter and transform deliveries to expeditions
  const expeditions: ExpeditionData[] = useMemo(() => {
    if (!deliveriesData?.deliveries) return [];
    
    return deliveriesData.deliveries
      .filter(d => d.type === "expedition" || d.carrier) // Filter expeditions
      .map(d => {
        // Map delivery status to expedition status
        let expeditionStatut: "en_attente" | "envoyé" | "livré" = "en_attente";
        if (d.statut === "livré") {
          expeditionStatut = "livré";
        } else if (d.statut === "en_cours" || d.statut === "pickup") {
          expeditionStatut = "envoyé";
        }
        
        return {
          id: d.id,
          livraison_id: d.id,
          telephone: d.telephone,
          destination: d.quartier || "Non spécifié",
          transporteur: d.carrier || "Non spécifié",
          date_envoi: d.date_creation,
          bordereau: null, // Backend doesn't store bordereau separately
          statut: expeditionStatut,
          notes: d.instructions || "",
        };
      });
  }, [deliveriesData]);

  // Get unique carriers for filter
  const availableCarriers = useMemo(() => {
    if (!deliveriesData?.deliveries) return [];
    const carriersSet = new Set<string>();
    deliveriesData.deliveries.forEach(d => {
      if (d.type === "expedition" && d.carrier) {
        carriersSet.add(d.carrier);
      }
    });
    return Array.from(carriersSet).sort();
  }, [deliveriesData]);

  // Filter expeditions
  const filteredExpeditions = useMemo(() => {
    return expeditions.filter((e) => {
      const matchSearch = 
        e.telephone.toLowerCase().includes(search.toLowerCase()) ||
        e.destination.toLowerCase().includes(search.toLowerCase()) ||
        e.transporteur.toLowerCase().includes(search.toLowerCase());
      const matchTransporteur = transporteurFilter === "all" || e.transporteur === transporteurFilter;
      const matchStatut = statutFilter === "all" || e.statut === statutFilter;
      return matchSearch && matchTransporteur && matchStatut;
    });
  }, [expeditions, search, transporteurFilter, statutFilter]);

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Expéditions</h1>
          <p className="text-muted-foreground">Gestion des envois vers d'autres villes</p>
        </div>
        <Dialog open={showNewModal} onOpenChange={setShowNewModal}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Nouvelle expédition
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Nouvelle expédition</DialogTitle>
              <DialogDescription>
                Créez une nouvelle expédition vers une autre ville
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Téléphone</label>
                  <Input placeholder="+225 XX XX XX XX XX" className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium">Destination</label>
                  <Input placeholder="Ville de destination" className="mt-1" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Transporteur</label>
                <Select>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCarriers.length > 0 ? (
                      availableCarriers.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))
                    ) : (
                      <>
                        <SelectItem value="Men Travel">Men Travel</SelectItem>
                        <SelectItem value="Finex">Finex</SelectItem>
                        <SelectItem value="General Voyage">General Voyage</SelectItem>
                        <SelectItem value="UTB">UTB</SelectItem>
                        <SelectItem value="STL">STL</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Notes</label>
                <Textarea placeholder="Instructions particulières..." className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Bordereau (image)</label>
                <div className="mt-1 border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer">
                  <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Cliquez pour télécharger ou glissez-déposez
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PNG, JPG jusqu'à 5MB
                  </p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewModal(false)}>Annuler</Button>
              <Button onClick={() => setShowNewModal(false)}>Créer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Error State */}
      {isError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erreur de chargement</AlertTitle>
          <AlertDescription className="mt-2">
            <p className="mb-3">
              {error instanceof Error ? error.message : 'Impossible de charger les expéditions'}
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

      {/* Stats */}
      {!isLoading && (
        <div className="grid grid-cols-3 gap-4">
          <div className="stat-card">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-expedition/15">
                <Truck className="w-5 h-5 text-expedition" />
              </div>
              <div>
                <p className="text-2xl font-bold">{expeditions.length}</p>
                <p className="text-sm text-muted-foreground">Total expéditions</p>
              </div>
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-info/15">
                <Truck className="w-5 h-5 text-info" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {expeditions.filter(e => e.statut === "envoyé").length}
                </p>
                <p className="text-sm text-muted-foreground">En transit</p>
              </div>
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-success/15">
                <Truck className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {expeditions.filter(e => e.statut === "livré").length}
                </p>
                <p className="text-sm text-muted-foreground">Livrées</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading Stats */}
      {isLoading && (
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="stat-card">
              <Skeleton className="h-16 w-full" />
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="stat-card">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par téléphone, destination..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <Select value={transporteurFilter} onValueChange={setTransporteurFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Transporteur" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous transporteurs</SelectItem>
                {availableCarriers.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statutFilter} onValueChange={setStatutFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                <SelectItem value="en_attente">En attente</SelectItem>
                <SelectItem value="envoyé">Envoyé</SelectItem>
                <SelectItem value="livré">Livré</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="stat-card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Téléphone</TableHead>
                <TableHead className="font-semibold">Destination</TableHead>
                <TableHead className="font-semibold">Transporteur</TableHead>
                <TableHead className="font-semibold hidden md:table-cell">Date d'envoi</TableHead>
                <TableHead className="font-semibold">Statut</TableHead>
                <TableHead className="font-semibold hidden lg:table-cell">Notes</TableHead>
                <TableHead className="font-semibold text-right">Bordereau</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                    <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filteredExpeditions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="p-8 text-center text-muted-foreground">
                    Aucune expédition trouvée
                  </TableCell>
                </TableRow>
              ) : (
                filteredExpeditions.map((expedition) => (
                  <TableRow 
                    key={expedition.id} 
                    className="hover:bg-muted/50 cursor-pointer"
                    onClick={() => navigate(`/livraisons/${expedition.livraison_id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{expedition.telephone}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <span>{expedition.destination}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="px-2 py-1 rounded-md bg-expedition/10 text-expedition text-sm font-medium">
                        {expedition.transporteur}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {formatDate(expedition.date_envoi)}
                    </TableCell>
                    <TableCell>
                      <span className={`status-badge ${statutBadgeStyles[expedition.statut]}`}>
                        {statutLabels[expedition.statut]}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate hidden lg:table-cell text-muted-foreground">
                      {expedition.notes || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="gap-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/livraisons/${expedition.livraison_id}`);
                        }}
                      >
                        <Eye className="w-4 h-4" />
                        <span className="hidden sm:inline">Voir</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default Expeditions;
