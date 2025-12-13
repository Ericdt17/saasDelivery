/**
 * Groups Page
 * Display groups (filtered by agency for agency admins)
 */

import { useQuery } from "@tanstack/react-query";
import { getGroups, type Group } from "@/services/groups";
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
import { Users, Building2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Groups() {
  const { user, isSuperAdmin } = useAuth();

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: getGroups,
  });

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
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Groupes</h1>
        <p className="text-muted-foreground">
          {isSuperAdmin
            ? "Tous les groupes de toutes les agences"
            : "Groupes de votre agence"}
        </p>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Aucun groupe
            </CardTitle>
            <CardDescription>
              Les groupes seront automatiquement créés lorsqu'ils enverront des messages sur WhatsApp
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
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {group.whatsapp_group_id ? (
                      group.whatsapp_group_id.substring(0, 20) + "..."
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



