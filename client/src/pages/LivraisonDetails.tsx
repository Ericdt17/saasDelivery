import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  ArrowLeft, 
  Phone, 
  MapPin, 
  Package, 
  Wallet, 
  Clock, 
  Edit, 
  CreditCard,
  RefreshCw,
  FileText,
  AlertCircle
} from "lucide-react";
import { getDeliveryById, getDeliveryHistory } from "@/services/deliveries";
import { toast } from "sonner";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('fr-FR').format(value) + " FCFA";
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatTime = (dateString: string) => {
  return new Date(dateString).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

const typeLabels = {
  livraison: "Livraison",
  pickup: "Pickup",
  expedition: "Expédition"
};

const LivraisonDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);

  // Fetch delivery data
  const { 
    data: livraison, 
    isLoading: isLoadingDelivery, 
    isError: isErrorDelivery, 
    error: deliveryError,
    refetch: refetchDelivery 
  } = useQuery({
    queryKey: ['delivery', id],
    queryFn: () => getDeliveryById(id!),
    enabled: !!id,
    retry: 2,
    refetchOnWindowFocus: false,
    onError: (error) => {
      toast.error('Erreur lors du chargement de la livraison', {
        description: error instanceof Error ? error.message : 'Une erreur est survenue'
      });
    }
  });

  // Fetch delivery history
  const { 
    data: livraisonHistorique = [], 
    isLoading: isLoadingHistory,
    isError: isErrorHistory,
    error: historyError
  } = useQuery({
    queryKey: ['deliveryHistory', id],
    queryFn: () => getDeliveryHistory(id!),
    enabled: !!id && !!livraison,
    retry: 2,
    refetchOnWindowFocus: false,
  });

  // Loading state
  if (isLoadingDelivery) {
    return (
      <div className="space-y-6 pb-8">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (isErrorDelivery || !livraison) {
    return (
      <div className="space-y-6 pb-8">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => navigate("/livraisons")}
          className="self-start"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erreur de chargement</AlertTitle>
          <AlertDescription className="mt-2">
            <p className="mb-3">
              {deliveryError instanceof Error 
                ? deliveryError.message 
                : 'Livraison introuvable ou erreur lors du chargement'}
            </p>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => refetchDelivery()}
                className="gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Réessayer
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigate("/livraisons")}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour aux livraisons
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const produitsList = livraison.produits.split(", ");

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => navigate("/livraisons")}
          className="self-start"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-bold">Livraison #{livraison.id}</h1>
            <StatusBadge statut={livraison.statut} />
          </div>
          <p className="text-muted-foreground mt-1">
            Créée le {formatDate(livraison.date_creation)}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Dialog open={showStatusModal} onOpenChange={setShowStatusModal}>
          <DialogTrigger asChild>
            <Button variant="outline" className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Changer statut
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Modifier le statut</DialogTitle>
              <DialogDescription>
                Sélectionnez le nouveau statut de la livraison
              </DialogDescription>
            </DialogHeader>
            <Select defaultValue={livraison.statut}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en_cours">En cours</SelectItem>
                <SelectItem value="livré">Livré</SelectItem>
                <SelectItem value="échec">Échec</SelectItem>
                <SelectItem value="pickup">Pickup</SelectItem>
                <SelectItem value="expedition">Expédition</SelectItem>
              </SelectContent>
            </Select>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowStatusModal(false)}>Annuler</Button>
              <Button onClick={() => setShowStatusModal(false)}>Enregistrer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
          <DialogTrigger asChild>
            <Button variant="outline" className="gap-2">
              <CreditCard className="w-4 h-4" />
              Ajouter paiement
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Enregistrer un paiement</DialogTitle>
              <DialogDescription>
                Reste à encaisser : {formatCurrency(livraison.restant)}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Montant</label>
                <Input type="number" placeholder="0" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Mode de paiement</label>
                <Select>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="especes">Espèces</SelectItem>
                    <SelectItem value="mobile_money">Mobile Money</SelectItem>
                    <SelectItem value="wave">Wave</SelectItem>
                    <SelectItem value="orange_money">Orange Money</SelectItem>
                    <SelectItem value="virement">Virement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPaymentModal(false)}>Annuler</Button>
              <Button onClick={() => setShowPaymentModal(false)}>Enregistrer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
          <DialogTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Edit className="w-4 h-4" />
              Modifier
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Modifier la livraison</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Téléphone</label>
                <Input defaultValue={livraison.telephone} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Quartier</label>
                <Input defaultValue={livraison.quartier} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Montant total</label>
                <Input type="number" defaultValue={livraison.montant_total} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Produits</label>
                <Textarea defaultValue={livraison.produits} className="mt-1" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditModal(false)}>Annuler</Button>
              <Button onClick={() => setShowEditModal(false)}>Enregistrer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showNoteModal} onOpenChange={setShowNoteModal}>
          <DialogTrigger asChild>
            <Button variant="outline" className="gap-2">
              <FileText className="w-4 h-4" />
              Ajouter note
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajouter une note</DialogTitle>
            </DialogHeader>
            <Textarea placeholder="Écrivez votre note ici..." rows={4} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNoteModal(false)}>Annuler</Button>
              <Button onClick={() => setShowNoteModal(false)}>Enregistrer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Client Info */}
          <div className="stat-card">
            <h3 className="text-lg font-semibold mb-4">Informations client</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-primary/10">
                  <Phone className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Téléphone</p>
                  <p className="font-medium">{livraison.telephone}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-primary/10">
                  <MapPin className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Quartier</p>
                  <p className="font-medium">{livraison.quartier}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Products */}
          <div className="stat-card">
            <h3 className="text-lg font-semibold mb-4">Produits ({produitsList.length})</h3>
            <div className="space-y-2">
              {produitsList.map((produit, index) => (
                <div 
                  key={index}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                >
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Package className="w-4 h-4 text-primary" />
                  </div>
                  <span className="font-medium">{produit}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Instructions */}
          {livraison.instructions && (
            <div className="stat-card">
              <h3 className="text-lg font-semibold mb-4">Instructions</h3>
              <p className="text-muted-foreground bg-muted/50 p-4 rounded-lg">
                {livraison.instructions}
              </p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Financial Summary */}
          <div className="stat-card">
            <h3 className="text-lg font-semibold mb-4">Résumé financier</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Montant total</span>
                <span className="font-bold text-lg">{formatCurrency(livraison.montant_total)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Encaissé</span>
                <span className="font-semibold text-success">{formatCurrency(livraison.montant_encaisse)}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-muted-foreground">Reste à payer</span>
                <span className={`font-semibold ${livraison.restant > 0 ? 'text-warning' : 'text-success'}`}>
                  {formatCurrency(livraison.restant)}
                </span>
              </div>
            </div>
            {livraison.restant > 0 && (
              <div className="mt-4 p-3 rounded-lg bg-warning/10 border border-warning/20">
                <p className="text-sm text-warning font-medium">
                  Paiement en attente : {formatCurrency(livraison.restant)}
                </p>
              </div>
            )}
          </div>

          {/* Type & Dates */}
          <div className="stat-card">
            <h3 className="text-lg font-semibold mb-4">Informations</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium">{typeLabels[livraison.type]}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Créée le</span>
                <span className="text-sm">{formatDate(livraison.date_creation)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Mise à jour</span>
                <span className="text-sm">{formatDate(livraison.date_mise_a_jour)}</span>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="stat-card">
            <h3 className="text-lg font-semibold mb-4">Historique</h3>
            <div className="space-y-0">
              {isLoadingHistory ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <Skeleton className="h-6 w-6 rounded-full" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-48" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : isErrorHistory ? (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Erreur lors du chargement de l'historique
                  </AlertDescription>
                </Alert>
              ) : livraisonHistorique.length > 0 ? (
                livraisonHistorique.map((event) => (
                  <div key={event.id} className="timeline-item">
                    <div className="timeline-dot">
                      <Clock className="w-3 h-3 text-primary-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{event.action}</p>
                      <p className="text-sm text-muted-foreground">{event.details}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatTime(event.date)}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucun historique disponible
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LivraisonDetails;
