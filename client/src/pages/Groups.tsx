/**
 * Groups Page
 * Display groups (filtered by agency for agency admins)
 * Agencies and super admins can add new WhatsApp groups
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getGroups, createGroup, updateGroup, deleteGroup, hardDeleteGroup, type Group, type CreateGroupRequest } from "@/services/groups";
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
import { Badge } from "@/components/ui/badge";
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
import { Users, Building2, Plus, Loader2, Copy, Check, Trash2, Edit } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export default function Groups() {
  const { user, isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isHardDeleteDialogOpen, setIsHardDeleteDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [editFormData, setEditFormData] = useState({ name: "" });
  const [formData, setFormData] = useState<CreateGroupRequest>({
    name: "",
    whatsapp_group_id: "",
    agency_id: undefined,
    is_active: true,
  });
  const [copiedId, setCopiedId] = useState(false);

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: getGroups,
  });

  // Fetch agencies for super admin dropdown
  const { data: agencies = [] } = useQuery({
    queryKey: ["agencies"],
    queryFn: getAgencies,
    enabled: isSuperAdmin,
  });

  const createMutation = useMutation({
    mutationFn: createGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      setIsCreateDialogOpen(false);
      setFormData({
        name: "",
        whatsapp_group_id: "",
        agency_id: undefined,
        is_active: true,
      });
      toast.success("Groupe créé avec succès");
    },
    onError: (error: any) => {
      const errorMessage = error?.data?.message || error?.message || "Erreur lors de la création du groupe";
      toast.error(errorMessage);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name?: string; is_active?: boolean } }) =>
      updateGroup(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      setIsEditDialogOpen(false);
      setSelectedGroup(null);
      setEditFormData({ name: "" });
      toast.success("Groupe modifié avec succès");
    },
    onError: (error: any) => {
      const errorMessage = error?.data?.message || error?.message || "Erreur lors de la modification du groupe";
      toast.error(errorMessage);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      updateGroup(id, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      toast.success("Statut du groupe mis à jour");
    },
    onError: (error: any) => {
      const errorMessage = error?.data?.message || error?.message || "Erreur lors de la mise à jour du statut";
      toast.error(errorMessage);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      setIsDeleteDialogOpen(false);
      setSelectedGroup(null);
      toast.success("Groupe désactivé avec succès");
    },
    onError: (error: any) => {
      const errorMessage = error?.data?.message || error?.message || "Erreur lors de la désactivation du groupe";
      toast.error(errorMessage);
    },
  });

  const hardDeleteMutation = useMutation({
    mutationFn: hardDeleteGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      setIsHardDeleteDialogOpen(false);
      setSelectedGroup(null);
      toast.success("Groupe supprimé définitivement");
    },
    onError: (error: any) => {
      const errorMessage = error?.data?.message || error?.message || "Erreur lors de la suppression définitive";
      toast.error(errorMessage);
    },
  });

  const handleEditClick = (group: Group) => {
    setSelectedGroup(group);
    setEditFormData({ name: group.name });
    setIsEditDialogOpen(true);
  };

  const handleEdit = () => {
    if (!selectedGroup || !editFormData.name.trim()) {
      toast.error("Le nom du groupe est requis");
      return;
    }
    updateMutation.mutate({ id: selectedGroup.id, data: { name: editFormData.name.trim() } });
  };

  const handleToggleActive = (group: Group, newStatus: boolean) => {
    console.log('[Toggle] handleToggleActive called:', { groupId: group.id, newStatus, group });
    console.log('[Toggle] Calling toggleActiveMutation with:', { id: group.id, is_active: newStatus });
    toggleActiveMutation.mutate({ id: group.id, is_active: newStatus });
  };

  const handleDeleteClick = (group: Group) => {
    setSelectedGroup(group);
    setIsDeleteDialogOpen(true);
  };

  const handleHardDeleteClick = (group: Group) => {
    setSelectedGroup(group);
    setIsHardDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (selectedGroup) {
      deleteMutation.mutate(selectedGroup.id);
    }
  };

  const confirmHardDelete = () => {
    if (selectedGroup) {
      hardDeleteMutation.mutate(selectedGroup.id);
    }
  };

  const handleCreate = () => {
    if (!formData.name || !formData.whatsapp_group_id) {
      toast.error("Veuillez remplir tous les champs requis");
      return;
    }

    if (isSuperAdmin && !formData.agency_id) {
      toast.error("Veuillez sélectionner une agence");
      return;
    }

    // Validate WhatsApp Group ID format
    const whatsappIdPattern = /^\d+@g\.us$/;
    if (!whatsappIdPattern.test(formData.whatsapp_group_id.trim())) {
      toast.error("Format d'ID WhatsApp invalide. Format attendu: nombres@g.us");
      return;
    }

    // For agency admins, agency_id is set automatically by backend
    const createData: CreateGroupRequest = {
      name: formData.name.trim(),
      whatsapp_group_id: formData.whatsapp_group_id.trim(),
      is_active: formData.is_active,
    };

    // Only include agency_id for super admin
    if (isSuperAdmin && formData.agency_id) {
      createData.agency_id = formData.agency_id;
    }

    createMutation.mutate(createData);
  };

  const handleCopyId = (groupId: string) => {
    navigator.clipboard.writeText(groupId);
    setCopiedId(true);
    toast.success("ID copié dans le presse-papiers");
    setTimeout(() => setCopiedId(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Groupes</h1>
          <p className="text-muted-foreground">
            {isSuperAdmin
              ? "Tous les groupes de toutes les agences"
              : "Groupes de votre agence"}
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter un groupe
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajouter un groupe WhatsApp</DialogTitle>
              <DialogDescription>
                Ajoutez un groupe WhatsApp pour commencer à recevoir des messages.
                Utilisez la commande #link dans le groupe pour obtenir l'ID.
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreate();
              }}
            >
              <div className="space-y-4 py-4">
                {isSuperAdmin && (
                  <div className="space-y-2">
                    <Label htmlFor="agency">Agence *</Label>
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
                  <Label htmlFor="name">Nom du groupe *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="Ex: Groupe de livraison"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whatsapp_group_id">ID du groupe WhatsApp *</Label>
                  <Input
                    id="whatsapp_group_id"
                    value={formData.whatsapp_group_id}
                    onChange={(e) =>
                      setFormData({ ...formData, whatsapp_group_id: e.target.value })
                    }
                    placeholder="Ex: 120363424120563204@g.us"
                    className="font-mono"
                    required
                  />
                  <p className="text-sm text-muted-foreground">
                    Utilisez la commande <code className="bg-muted px-1 rounded">#link</code> dans
                    le groupe WhatsApp pour obtenir cet ID.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Annuler
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Créer
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Aucun groupe
            </CardTitle>
            <CardDescription>
              Ajoutez un groupe WhatsApp pour commencer à recevoir des messages.
              <br />
              <span className="mt-2 block">
                💡 Utilisez la commande <code className="bg-muted px-1 rounded">#link</code> dans
                le groupe WhatsApp pour obtenir l'ID du groupe.
              </span>
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom du groupe</TableHead>
                {isSuperAdmin && <TableHead>Agence</TableHead>}
                <TableHead>Statut</TableHead>
                <TableHead>Date de création</TableHead>
                <TableHead>ID WhatsApp</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group) => (
                <TableRow 
                  key={group.id}
                  className={group.is_active ? "" : "opacity-60"}
                >
                  <TableCell className="font-medium">{group.name}</TableCell>
                  {isSuperAdmin && (
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {group.agency_name || `Agence #${group.agency_id}`}
                      </div>
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={group.is_active}
                        onCheckedChange={(checked) => handleToggleActive(group, checked)}
                        disabled={toggleActiveMutation.isPending}
                      />
                      <Badge variant={group.is_active ? "default" : "secondary"}>
                        {group.is_active ? "Actif" : "Inactif"}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    {new Date(group.created_at).toLocaleDateString("fr-FR")}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {group.whatsapp_group_id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">
                          {group.whatsapp_group_id.length > 25
                            ? group.whatsapp_group_id.substring(0, 25) + "..."
                            : group.whatsapp_group_id}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleCopyId(group.whatsapp_group_id!)}
                          title="Copier l'ID"
                        >
                          {copiedId ? (
                            <Check className="h-3 w-3 text-green-600" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">N/A</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEditClick(group)}
                        title="Modifier le nom du groupe"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleHardDeleteClick(group)}
                        title="Supprimer définitivement"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le groupe</DialogTitle>
            <DialogDescription>
              Modifiez le nom du groupe "{selectedGroup?.name}".
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nom du groupe *</Label>
              <Input
                id="edit-name"
                value={editFormData.name}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, name: e.target.value })
                }
                placeholder="Ex: Groupe de livraison"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
            >
              Annuler
            </Button>
            <Button
              onClick={handleEdit}
              disabled={updateMutation.isPending || !editFormData.name.trim()}
            >
              {updateMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hard Delete Confirmation Dialog */}
      <AlertDialog open={isHardDeleteDialogOpen} onOpenChange={setIsHardDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suppression définitive</AlertDialogTitle>
            <AlertDialogDescription>
              ⚠️ Cette action supprimera définitivement le groupe "{selectedGroup?.name}" de la base de données.
              <br />
              <span className="font-semibold mt-2 block text-destructive">
                Cette action est irréversible et supprimera toutes les données associées.
              </span>
              <br />
              Êtes-vous absolument sûr de vouloir continuer ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmHardDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={hardDeleteMutation.isPending}
            >
              {hardDeleteMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}



