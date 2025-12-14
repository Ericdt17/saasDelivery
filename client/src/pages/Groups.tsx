/**
 * Groups Page
 * Display groups (filtered by agency for agency admins)
 * Agencies and super admins can add new WhatsApp groups
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getGroups, createGroup, type Group, type CreateGroupRequest } from "@/services/groups";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, Building2, Plus, Loader2, Copy, Check } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function Groups() {
  const { user, isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group) => (
                <TableRow key={group.id}>
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
                    <Badge variant={group.is_active ? "default" : "secondary"}>
                      {group.is_active ? "Actif" : "Inactif"}
                    </Badge>
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}



