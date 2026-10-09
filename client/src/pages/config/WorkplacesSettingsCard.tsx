/**
 * CRUD lieux de travail (HR settings) — used on Paramètres for super_admin.
 */

import { useState } from "react";
import { MapPin, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useHrWorkplaces,
  useCreateHrWorkplace,
  useUpdateHrWorkplace,
  useDeleteHrWorkplace,
} from "@/hooks/useHr";

export function WorkplacesSettingsCard() {
  const { data: workplaces = [], isLoading } = useHrWorkplaces();
  const createWorkplace = useCreateHrWorkplace();
  const updateWorkplace = useUpdateHrWorkplace();
  const deleteWorkplace = useDeleteHrWorkplace();
  const [name, setName] = useState("");

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    await createWorkplace.mutateAsync({ name: trimmed });
    setName("");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Lieux de travail
        </CardTitle>
        <CardDescription>
          Liste utilisée sur les fiches employés (contrat / mission). Les lieux
          désactivés restent en historique mais ne sont plus proposés.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ex. Entrepôt Makepe"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleCreate();
              }
            }}
          />
          <Button
            type="button"
            onClick={() => void handleCreate()}
            disabled={!name.trim() || createWorkplace.isPending}
          >
            <Plus className="h-4 w-4 mr-1" />
            Ajouter
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : workplaces.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun lieu pour le moment.
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {workplaces.map((w) => (
              <li
                key={w.id}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <div className="min-w-0">
                  <p
                    className={
                      w.is_active
                        ? "font-medium truncate"
                        : "font-medium truncate text-muted-foreground line-through"
                    }
                  >
                    {w.name}
                  </p>
                  {!w.is_active ? (
                    <p className="text-xs text-muted-foreground">Désactivé</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-2">
                  {!w.is_active ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={updateWorkplace.isPending}
                      onClick={() =>
                        void updateWorkplace.mutateAsync({
                          id: w.id,
                          data: { is_active: true },
                        })
                      }
                    >
                      Réactiver
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={deleteWorkplace.isPending}
                      onClick={() => void deleteWorkplace.mutateAsync(w.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
