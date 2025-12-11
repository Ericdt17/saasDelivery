/**
 * Agencies Page
 * Super admin only - manage agencies
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { getAgencies, createAgency, updateAgency, deleteAgency, type Agency, type CreateAgencyRequest } from "@/services/agencies";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Badge } from "@/components/ui/badge";
import { Building2, Plus, Edit, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

function AgenciesPage() {
  const { isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedAgency, setSelectedAgency] = useState<Agency | null>(null);
  const [formData, setFormData] = useState<CreateAgencyRequest>({
    name: "",
    email: "",
    password: "",
    role: "agency",
    is_active: true,
  });

  const { data: agencies = [], isLoading } = useQuery({
    queryKey: ["agencies"],
    queryFn: getAgencies,
    enabled: isSuperAdmin,
  });

  const createMutation = useMutation({
    mutationFn: createAgency,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agencies"] });
      setIsCreateDialogOpen(false);
      setFormData({ name: "", email: "", password: "", role: "agency", is_active: true });
      toast.success("Agence créée avec succès");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erreur lors de la création de l'agence");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateAgencyRequest> }) =>
      updateAgency(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agencies"] });
      setIsEditDialogOpen(false);
      setSelectedAgency(null);
      toast.success("Agence mise à jour avec succès");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erreur lors de la mise à jour");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAgency,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agencies"] });
      setIsDeleteDialogOpen(false);
      setSelectedAgency(null);
      toast.success("Agence supprimée avec succès");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erreur lors de la suppression");
    },
  });

  const handleCreate = () => {
    if (!formData.name || !formData.email || !formData.password) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }
    createMutation.mutate(formData);
  };

  const handleEdit = (agency: Agency) => {
    setSelectedAgency(agency);
    setFormData({
      name: agency.name,
      email: agency.email,
      password: "", // Don't pre-fill password
      role: agency.role,
      is_active: agency.is_active,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = () => {
    if (!selectedAgency || !formData.name || !formData.email) {
      toast.error("Veuillez remplir tous les champs requis");
      return;
    }
    const updateData: any = {
      name: formData.name,
      email: formData.email,
      role: formData.role,
      is_active: formData.is_active,
    };
    if (formData.password) {
      updateData.password = formData.password;
    }
    updateMutation.mutate({ id: selectedAgency.id, data: updateData });
  };

  const handleDelete = (agency: Agency) => {
    setSelectedAgency(agency);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (selectedAgency) {
      deleteMutation.mutate(selectedAgency.id);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Accès refusé. Super administrateur requis.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agences</h1>
          <p className="text-muted-foreground">
            Gérez les agences et leurs comptes
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle agence
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Créer une nouvelle agence</DialogTitle>
              <DialogDescription>
                Créez un compte pour une nouvelle agence
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); handleCreate(); }}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nom de l'agence</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Nom de l'agence"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Mot de passe</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Rôle</Label>
                <select
                  id="role"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      role: e.target.value as "agency" | "super_admin",
                    })
                  }
                >
                    <option value="agency">Agence</option>
                    <option value="super_admin">Super Administrateur</option>
                  </select>
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
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Créer
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-8">Chargement...</div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Date de création</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agencies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Aucune agence trouvée
                  </TableCell>
                </TableRow>
              ) : (
                agencies.map((agency) => (
                  <TableRow key={agency.id}>
                    <TableCell className="font-medium">{agency.name}</TableCell>
                    <TableCell>{agency.email}</TableCell>
                    <TableCell>
                      <Badge variant={agency.role === "super_admin" ? "default" : "secondary"}>
                        {agency.role === "super_admin" ? "Super Admin" : "Agence"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={agency.is_active ? "default" : "destructive"}>
                        {agency.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(agency.created_at).toLocaleDateString("fr-FR")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(agency)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(agency)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier l'agence</DialogTitle>
            <DialogDescription>
              Modifiez les informations de l'agence
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nom de l'agence</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">Nouveau mot de passe (laisser vide pour ne pas changer)</Label>
              <Input
                id="edit-password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-active">Actif</Label>
              <Switch
                id="edit-active"
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_active: checked })
                }
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
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action désactivera l'agence "{selectedAgency?.name}". 
              L'agence ne pourra plus se connecter, mais les données seront conservées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function Agencies() {
  return (
    <ProtectedRoute requireSuperAdmin>
      <AgenciesPage />
    </ProtectedRoute>
  );
}

