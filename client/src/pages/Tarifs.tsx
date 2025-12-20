/**
 * Tarifs Page
 * Display and manage delivery tariffs (pricing per quartier/neighborhood)
 * Each agency manages their own tariffs
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getTariffs, createTariff, updateTariff, deleteTariff, type Tariff, type CreateTariffRequest, formatTariffAmount } from "@/services/tariffs";
import { getAgencies, type Agency } from "@/services/agencies";
import { useAuth } from "@/contexts/AuthContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Receipt, Plus, Loader2, Trash2, Edit } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function Tarifs() {
  const { user, isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedTariff, setSelectedTariff] = useState<Tariff | null>(null);
  const [formData, setFormData] = useState<CreateTariffRequest>({
    quartier: "",
    tarif_amount: 0,
    agency_id: undefined,
  });

  const { data: tariffs = [], isLoading } = useQuery({
    queryKey: ["tariffs"],
    queryFn: getTariffs,
  });

  // Fetch agencies for super admin dropdown
  const { data: agencies = [] } = useQuery({
    queryKey: ["agencies"],
    queryFn: getAgencies,
    enabled: isSuperAdmin,
  });

  const createMutation = useMutation({
    mutationFn: createTariff,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tariffs"] });
      setIsCreateDialogOpen(false);
      setFormData({
        quartier: "",
        tarif_amount: 0,
        agency_id: undefined,
      });
      toast.success("Tarif créé avec succès");
    },
    onError: (error: any) => {
      const errorMessage = error?.data?.message || error?.message || "Erreur lors de la création du tarif";
      toast.error(errorMessage);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { quartier?: string; tarif_amount?: number } }) =>
      updateTariff(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tariffs"] });
      setIsEditDialogOpen(false);
      setSelectedTariff(null);
      toast.success("Tarif mis à jour avec succès");
    },
    onError: (error: any) => {
      const errorMessage = error?.data?.message || error?.message || "Erreur lors de la mise à jour";
      toast.error(errorMessage);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTariff,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tariffs"] });
      setIsDeleteDialogOpen(false);
      setSelectedTariff(null);
      toast.success("Tarif supprimé avec succès");
    },
    onError: (error: any) => {
      const errorMessage = error?.data?.message || error?.message || "Erreur lors de la suppression";
      toast.error(errorMessage);
    },
  });

  const handleCreate = () => {
    if (!formData.quartier || !formData.quartier.trim()) {
      toast.error("Veuillez saisir un quartier");
      return;
    }
    if (!formData.tarif_amount || formData.tarif_amount <= 0) {
      toast.error("Veuillez saisir un montant valide");
      return;
    }
    if (isSuperAdmin && !formData.agency_id) {
      toast.error("Veuillez sélectionner une agence");
      return;
    }
    createMutation.mutate(formData);
  };

  const handleEdit = (tariff: Tariff) => {
    setSelectedTariff(tariff);
    setFormData({
      quartier: tariff.quartier,
      tarif_amount: tariff.tarif_amount,
      agency_id: tariff.agency_id,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = () => {
    if (!selectedTariff) return;
    if (!formData.quartier || !formData.quartier.trim()) {
      toast.error("Veuillez saisir un quartier");
      return;
    }
    if (!formData.tarif_amount || formData.tarif_amount <= 0) {
      toast.error("Veuillez saisir un montant valide");
      return;
    }
    updateMutation.mutate({
      id: selectedTariff.id,
      data: {
        quartier: formData.quartier,
        tarif_amount: formData.tarif_amount,
      },
    });
  };

  const handleDelete = (tariff: Tariff) => {
    setSelectedTariff(tariff);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (!selectedTariff) return;
    deleteMutation.mutate(selectedTariff.id);
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Tarifs de livraison</h1>
          <p className="text-muted-foreground">
            Gérez les tarifs de livraison par quartier
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setFormData({ quartier: "", tarif_amount: 0, agency_id: undefined })}>
              <Plus className="w-4 h-4 mr-2" />
              Ajouter un tarif
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouveau tarif</DialogTitle>
              <DialogDescription>
                Définissez un tarif de livraison pour un quartier
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {isSuperAdmin && (
                <div className="space-y-2">
                  <Label htmlFor="agency_id">Agence</Label>
                  <Select
                    value={formData.agency_id?.toString() || ""}
                    onValueChange={(value) =>
                      setFormData({ ...formData, agency_id: parseInt(value) })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une agence" />
                    </SelectTrigger>
                    <SelectContent>
                      {agencies.map((agency) => (
                        <SelectItem key={agency.id} value={agency.id.toString()}>
                          {agency.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="quartier">Quartier *</Label>
                <Input
                  id="quartier"
                  placeholder="Ex: Bonanjo, Akwa, Makepe..."
                  value={formData.quartier}
                  onChange={(e) =>
                    setFormData({ ...formData, quartier: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tarif_amount">Montant (FCFA) *</Label>
                <Input
                  id="tarif_amount"
                  type="number"
                  min="0"
                  step="100"
                  placeholder="Ex: 2000"
                  value={formData.tarif_amount || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      tarif_amount: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
                disabled={createMutation.isPending}
              >
                Annuler
              </Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Créer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tariffs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Liste des tarifs
          </CardTitle>
          <CardDescription>
            {tariffs.length} tarif{tariffs.length > 1 ? "s" : ""} enregistré{tariffs.length > 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : tariffs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Receipt className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Aucun tarif enregistré</p>
              <p className="text-sm mt-2">Créez votre premier tarif pour commencer</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {isSuperAdmin && <TableHead>Agence</TableHead>}
                    <TableHead>Quartier</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tariffs.map((tariff, index) => (
                    <TableRow key={tariff.id ?? `tariff-${index}`}>
                      {isSuperAdmin && (
                        <TableCell className="font-medium">
                          {tariff.agency_name || `Agence #${tariff.agency_id}`}
                        </TableCell>
                      )}
                      <TableCell className="font-medium">{tariff.quartier}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatTariffAmount(tariff.tarif_amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(tariff)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(tariff)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le tarif</DialogTitle>
            <DialogDescription>
              Modifiez les informations du tarif
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-quartier">Quartier *</Label>
              <Input
                id="edit-quartier"
                placeholder="Ex: Bonanjo, Akwa, Makepe..."
                value={formData.quartier}
                onChange={(e) =>
                  setFormData({ ...formData, quartier: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-tarif_amount">Montant (FCFA) *</Label>
              <Input
                id="edit-tarif_amount"
                type="number"
                min="0"
                step="100"
                placeholder="Ex: 2000"
                value={formData.tarif_amount || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    tarif_amount: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              disabled={updateMutation.isPending}
            >
              Annuler
            </Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le tarif</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer le tarif pour le quartier "{selectedTariff?.quartier}" ?
              Cette action est irréversible.
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
}

