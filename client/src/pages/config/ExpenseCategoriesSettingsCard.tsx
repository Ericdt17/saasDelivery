/**
 * CRUD catégories de dépenses générales — Paramètres (super_admin).
 * « Note obligatoire » force une note à la saisie des dépenses de cette
 * catégorie (ex. « Autre »). Désactivation douce : l'historique est gardé.
 */

import { useState } from "react";
import { Receipt, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useExpenseCategories,
  useCreateExpenseCategory,
  useUpdateExpenseCategory,
  useDeleteExpenseCategory,
} from "@/hooks/useExpenses";

export function ExpenseCategoriesSettingsCard() {
  const { data: categories = [], isLoading } = useExpenseCategories();
  const createCategory = useCreateExpenseCategory();
  const updateCategory = useUpdateExpenseCategory();
  const deleteCategory = useDeleteExpenseCategory();
  const [name, setName] = useState("");
  const [requiresNote, setRequiresNote] = useState(false);

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    await createCategory.mutateAsync({
      name: trimmed,
      requires_note: requiresNote,
    });
    setName("");
    setRequiresNote(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          Catégories de dépenses
        </CardTitle>
        <CardDescription>
          Liste proposée à la saisie des dépenses générales. Les catégories
          désactivées restent en historique mais ne sont plus proposées.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex. Carburant générateur"
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
              disabled={!name.trim() || createCategory.isPending}
            >
              <Plus className="h-4 w-4 mr-1" />
              Ajouter
            </Button>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={requiresNote}
              onCheckedChange={(v) => setRequiresNote(v === true)}
            />
            <span className="text-muted-foreground">
              Note obligatoire à la saisie pour cette catégorie
            </span>
          </label>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune catégorie pour le moment.
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {categories.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <div className="min-w-0">
                  <p
                    className={
                      c.is_active
                        ? "font-medium truncate"
                        : "font-medium truncate text-muted-foreground line-through"
                    }
                  >
                    {c.name}
                    {c.requires_note ? (
                      <Badge
                        variant="secondary"
                        className="ml-2 align-middle font-normal"
                      >
                        note obligatoire
                      </Badge>
                    ) : null}
                  </p>
                  {!c.is_active ? (
                    <p className="text-xs text-muted-foreground">Désactivée</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {c.is_active ? (
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                      <Checkbox
                        checked={c.requires_note}
                        disabled={updateCategory.isPending}
                        onCheckedChange={(v) =>
                          void updateCategory.mutateAsync({
                            id: c.id,
                            data: { requires_note: v === true },
                          })
                        }
                      />
                      <Label className="cursor-pointer text-xs font-normal">
                        Note oblig.
                      </Label>
                    </label>
                  ) : null}
                  {!c.is_active ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={updateCategory.isPending}
                      onClick={() =>
                        void updateCategory.mutateAsync({
                          id: c.id,
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
                      disabled={deleteCategory.isPending}
                      onClick={() => void deleteCategory.mutateAsync(c.id)}
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
