/**
 * Conditions générales marchands — super_admin (CRUD comme les offres d'emploi)
 */

import { useState } from "react";
import {
  useMerchantTermsList,
  useCreateMerchantTerms,
  useUpdateMerchantTerms,
  useDeleteMerchantTerms,
} from "@/hooks/useMerchantTerms";
import type { MerchantTerms } from "@/services/merchantTerms";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
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
import { ScrollText, Plus, Pencil, Trash2 } from "lucide-react";

function TermsFormFields({
  title,
  setTitle,
  content,
  setContent,
  isActive,
  setIsActive,
}: {
  title: string;
  setTitle: (v: string) => void;
  content: string;
  setContent: (v: string) => void;
  isActive: boolean;
  setIsActive: (v: boolean) => void;
}) {
  return (
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <Label htmlFor="terms-title">Titre *</Label>
        <Input
          id="terms-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex. Conditions partenaires marchands 2026"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="terms-content">Contenu</Label>
        <Textarea
          id="terms-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={12}
          placeholder="Rédigez ici les conditions que les marchands doivent respecter…"
          className="font-mono text-sm"
        />
      </div>
      <div className="flex items-center justify-between rounded-lg border p-3">
        <Label htmlFor="terms-active">Document actif</Label>
        <Switch id="terms-active" checked={isActive} onCheckedChange={setIsActive} />
      </div>
    </div>
  );
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      dateStyle: "medium",
    });
  } catch {
    return iso;
  }
}

export default function MerchantTermsPage() {
  const { data: terms = [], isLoading } = useMerchantTermsList();
  const createTerms = useCreateMerchantTerms();
  const updateTerms = useUpdateMerchantTerms();
  const deleteTerms = useDeleteMerchantTerms();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MerchantTerms | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<MerchantTerms | null>(null);

  function openCreate() {
    setEditing(null);
    setTitle("");
    setContent("");
    setIsActive(true);
    setDialogOpen(true);
  }

  function openEdit(row: MerchantTerms) {
    setEditing(row);
    setTitle(row.title);
    setContent(row.content ?? "");
    setIsActive(row.is_active);
    setDialogOpen(true);
  }

  async function handleSave() {
    const t = title.trim();
    if (!t) return;
    if (editing) {
      await updateTerms.mutateAsync({
        id: editing.id,
        data: {
          title: t,
          content: content || null,
          is_active: isActive,
        },
      });
    } else {
      await createTerms.mutateAsync({
        title: t,
        content: content || null,
        is_active: isActive,
      });
    }
    setDialogOpen(false);
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    await deleteTerms.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  }

  const saveDisabled =
    !title.trim() || createTerms.isPending || updateTerms.isPending;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <ScrollText className="h-8 w-8 text-muted-foreground" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Conditions marchands
            </h1>
            <p className="text-muted-foreground">
              Règles que les marchands partenaires doivent respecter pour
              travailler avec vous
            </p>
          </div>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Nouveau document
        </Button>
      </div>

      <div className="stat-card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="min-w-[12rem]">Titre</TableHead>
                <TableHead className="w-[100px]">Statut</TableHead>
                <TableHead className="w-[120px]">Créé le</TableHead>
                <TableHead className="text-right w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-48" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="ml-auto h-8 w-20" />
                    </TableCell>
                  </TableRow>
                ))
              ) : terms.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="p-8 text-center text-muted-foreground"
                  >
                    Aucun document pour le moment.
                  </TableCell>
                </TableRow>
              ) : (
                terms.map((row) => (
                  <TableRow key={row.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{row.title}</TableCell>
                    <TableCell>
                      {row.is_active ? (
                        <Badge className="bg-green-600 hover:bg-green-600">
                          Actif
                        </Badge>
                      ) : (
                        <Badge variant="outline">Inactif</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(row.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(row)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => setDeleteTarget(row)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Modifier le document" : "Nouveau document"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Modifiez le titre ou le contenu puis enregistrez."
                : "Créez un document de conditions pour vos marchands partenaires."}
            </DialogDescription>
          </DialogHeader>
          <TermsFormFields
            title={title}
            setTitle={setTitle}
            content={content}
            setContent={setContent}
            isActive={isActive}
            setIsActive={setIsActive}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={saveDisabled}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce document ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le texte « {deleteTarget?.title} »
              sera définitivement supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmDelete();
              }}
              disabled={deleteTerms.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
