/**
 * RH — Règlement intérieur : versions (brouillon → publication) + suivi de
 * prise de connaissance des employés (super_admin).
 */

import { useEffect, useMemo, useState } from "react";
import {
  BookOpenCheck,
  Plus,
  Pencil,
  Eye,
  Send,
  Users,
  CheckCircle2,
  CircleAlert,
} from "lucide-react";
import {
  useHrRegulations,
  useHrRegulation,
  useHrRegulationVersion,
  useHrRegulationAcks,
  useCreateHrRegulation,
  useCreateHrRegulationVersion,
  useUpdateHrRegulationVersion,
  usePublishHrRegulationVersion,
} from "@/hooks/useHr";
import { getRegulationVersion } from "@/services/hr";
import type { HrRegulationVersion } from "@/services/hr";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function versionStatusBadge(status: HrRegulationVersion["status"]) {
  switch (status) {
    case "draft":
      return <Badge className="bg-blue-600 hover:bg-blue-600">Brouillon</Badge>;
    case "published":
      return <Badge className="bg-green-600 hover:bg-green-600">Publié</Badge>;
    case "archived":
      return <Badge variant="secondary">Archivé</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}

function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString("fr-FR")} ${d.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export default function ReglementPage() {
  const { data: regulations = [], isLoading: loadingList } = useHrRegulations();
  const regulation = regulations[0] ?? null;
  const { data: detail, isLoading: loadingDetail } = useHrRegulation(
    regulation?.id ?? null
  );
  const [ackFilter, setAckFilter] = useState<"all" | "read" | "not_read">(
    "all"
  );
  const { data: acks, isLoading: loadingAcks } = useHrRegulationAcks(
    regulation?.id ?? null,
    ackFilter
  );

  const createRegulationMutation = useCreateHrRegulation();
  const createVersionMutation = useCreateHrRegulationVersion();
  const updateVersionMutation = useUpdateHrRegulationVersion();
  const publishMutation = usePublishHrRegulationVersion();

  const [newTitle, setNewTitle] = useState("Règlement intérieur LivSight");
  const [editTarget, setEditTarget] = useState<HrRegulationVersion | null>(
    null
  );
  const [editContent, setEditContent] = useState("");
  const { data: editVersionDetail } = useHrRegulationVersion(
    editTarget?.id ?? null
  );
  const [preview, setPreview] = useState<{
    label: string;
    html: string;
  } | null>(null);
  const [publishTarget, setPublishTarget] = useState<HrRegulationVersion | null>(
    null
  );

  useEffect(() => {
    if (editVersionDetail?.content_md != null) {
      setEditContent(editVersionDetail.content_md);
    }
  }, [editVersionDetail?.id, editVersionDetail?.content_md]);

  const draftVersion = useMemo(
    () => detail?.versions.find((v) => v.status === "draft") ?? null,
    [detail]
  );

  async function openPreview(version: HrRegulationVersion) {
    try {
      const full = await getRegulationVersion(version.id);
      setPreview({
        label: full.version_label,
        html: full.content_html ?? "",
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Impossible de charger l'aperçu"
      );
    }
  }

  if (loadingList) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BookOpenCheck className="h-8 w-8 text-muted-foreground" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Règlement intérieur
          </h1>
          <p className="text-muted-foreground">
            Versions, publication et suivi de prise de connaissance
          </p>
        </div>
      </div>

      {!regulation ? (
        <div className="stat-card space-y-3 p-5 max-w-xl">
          <p className="text-sm text-muted-foreground">
            Aucun règlement intérieur pour le moment. Créez-le, rédigez la
            première version en brouillon, puis publiez-la pour que les
            employés en prennent connaissance.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="reg-title">Titre</Label>
            <Input
              id="reg-title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
          </div>
          <Button
            disabled={!newTitle.trim() || createRegulationMutation.isPending}
            onClick={() =>
              createRegulationMutation.mutate({ title: newTitle.trim() })
            }
          >
            <Plus className="mr-1.5 h-4 w-4" />
            {createRegulationMutation.isPending
              ? "Création…"
              : "Créer le règlement"}
          </Button>
        </div>
      ) : (
        <>
          {/* Current version + read tracking stats */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              size="sm"
              title="Version en vigueur"
              value={regulation.current_version_label ?? "Aucune"}
              icon={BookOpenCheck}
              variant="info"
              iconTooltip={
                regulation.current_version_published_at
                  ? `Publié le ${fmtDate(regulation.current_version_published_at)}`
                  : "Aucune version publiée"
              }
            />
            <StatCard
              size="sm"
              title="Employés actifs"
              value={acks?.stats?.total_active_employees ?? "—"}
              icon={Users}
              variant="default"
            />
            <StatCard
              size="sm"
              title="Pris connaissance"
              value={acks?.stats?.read ?? "—"}
              icon={CheckCircle2}
              variant="success"
            />
            <StatCard
              size="sm"
              title="À lire"
              value={acks?.stats?.not_read ?? "—"}
              icon={CircleAlert}
              variant={
                (acks?.stats?.not_read ?? 0) > 0 ? "warning" : "default"
              }
              iconTooltip={
                acks?.stats
                  ? `Taux de lecture : ${acks.stats.completion_pct}%`
                  : undefined
              }
            />
          </div>

          {/* Versions */}
          <div className="stat-card overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
              <div>
                <h2 className="font-semibold">Versions</h2>
                <p className="text-sm text-muted-foreground">
                  Les versions publiées sont immuables — créez une nouvelle
                  version pour modifier le règlement.
                </p>
              </div>
              <Button
                size="sm"
                disabled={createVersionMutation.isPending || !!draftVersion}
                title={
                  draftVersion
                    ? "Un brouillon existe déjà — modifiez-le ou publiez-le"
                    : undefined
                }
                onClick={() =>
                  createVersionMutation.mutate(regulation.id)
                }
              >
                <Plus className="mr-1.5 h-4 w-4" />
                {createVersionMutation.isPending
                  ? "Création…"
                  : "Nouvelle version"}
              </Button>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Version</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Publiée le</TableHead>
                    <TableHead>Prises de connaissance</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingDetail ? (
                    <TableRow>
                      <TableCell colSpan={5} className="p-6">
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ) : (detail?.versions.length ?? 0) === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="p-8 text-center text-muted-foreground"
                      >
                        Aucune version — créez la première version en
                        brouillon.
                      </TableCell>
                    </TableRow>
                  ) : (
                    detail?.versions.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-medium">
                          {v.version_label}
                        </TableCell>
                        <TableCell>{versionStatusBadge(v.status)}</TableCell>
                        <TableCell>{fmtDate(v.published_at)}</TableCell>
                        <TableCell>
                          {v.acknowledgement_count ?? 0}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Aperçu"
                              onClick={() => void openPreview(v)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {v.status === "draft" ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  title="Modifier le brouillon"
                                  onClick={() => setEditTarget(v)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setPublishTarget(v)}
                                >
                                  <Send className="mr-1.5 h-4 w-4" />
                                  Publier
                                </Button>
                              </>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Read tracking */}
          <div className="stat-card overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
              <div>
                <h2 className="font-semibold">
                  Suivi de lecture
                  {acks?.version
                    ? ` — ${acks.version.version_label}`
                    : ""}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Statut de chaque employé actif pour la version en vigueur.
                </p>
              </div>
              <Tabs
                value={ackFilter}
                onValueChange={(v) =>
                  setAckFilter(v as "all" | "read" | "not_read")
                }
              >
                <TabsList>
                  <TabsTrigger value="all">Tous</TabsTrigger>
                  <TabsTrigger value="read">Pris connaissance</TabsTrigger>
                  <TabsTrigger value="not_read">À lire</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Employé</TableHead>
                    <TableHead>Poste</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Pris connaissance le</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingAcks ? (
                    <TableRow>
                      <TableCell colSpan={4} className="p-6">
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ) : !acks?.version ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="p-8 text-center text-muted-foreground"
                      >
                        Publiez une version pour suivre les prises de
                        connaissance.
                      </TableCell>
                    </TableRow>
                  ) : acks.employees.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="p-8 text-center text-muted-foreground"
                      >
                        Aucun employé dans cette catégorie.
                      </TableCell>
                    </TableRow>
                  ) : (
                    acks.employees.map((row) => (
                      <TableRow key={row.employee_id}>
                        <TableCell className="font-medium">
                          {row.full_name}
                        </TableCell>
                        <TableCell>{row.poste ?? "—"}</TableCell>
                        <TableCell>
                          {row.status === "read" ? (
                            <Badge className="bg-green-600 hover:bg-green-600">
                              Pris connaissance
                            </Badge>
                          ) : (
                            <Badge className="bg-orange-500 hover:bg-orange-500">
                              À lire
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {fmtDateTime(row.acknowledged_at)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}

      {/* Draft editor */}
      <Dialog
        open={editTarget != null}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
      >
        <DialogContent className="flex h-[88vh] max-h-[88vh] w-[min(980px,95vw)] max-w-[95vw] flex-col gap-3 overflow-hidden p-4 sm:rounded-lg">
          <DialogHeader className="shrink-0 pr-8">
            <DialogTitle>
              Modifier le brouillon {editTarget?.version_label}
            </DialogTitle>
            <DialogDescription>
              Mise en forme : # Titre, ## Section, ### Article, **gras**,
              *italique*, listes avec - ou 1.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="min-h-0 flex-1 resize-none font-mono text-sm"
            placeholder={"# Règlement intérieur\n\n## Article 1 — Objet\n\nTexte…"}
          />
          <div className="flex shrink-0 justify-end gap-2">
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              Fermer
            </Button>
            <Button
              variant="outline"
              disabled={updateVersionMutation.isPending || !editTarget}
              onClick={async () => {
                if (!editTarget) return;
                await updateVersionMutation.mutateAsync({
                  versionId: editTarget.id,
                  content_md: editContent,
                });
                void openPreview(editTarget);
              }}
            >
              <Eye className="mr-1.5 h-4 w-4" />
              Enregistrer et prévisualiser
            </Button>
            <Button
              disabled={updateVersionMutation.isPending || !editTarget}
              onClick={() => {
                if (!editTarget) return;
                updateVersionMutation.mutate({
                  versionId: editTarget.id,
                  content_md: editContent,
                });
              }}
            >
              {updateVersionMutation.isPending
                ? "Enregistrement…"
                : "Enregistrer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview (server-sanitised HTML) */}
      <Dialog
        open={preview != null}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
      >
        <DialogContent className="flex h-[88vh] max-h-[88vh] w-[min(860px,95vw)] max-w-[95vw] flex-col gap-3 overflow-hidden p-5 sm:rounded-lg">
          <DialogHeader className="shrink-0 pr-8">
            <DialogTitle>Aperçu — {preview?.label}</DialogTitle>
          </DialogHeader>
          <div
            className="prose prose-sm min-h-0 max-w-none flex-1 overflow-y-auto rounded-md border bg-muted/20 p-5 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:font-semibold [&_li]:ml-4 [&_ol]:list-decimal [&_p]:my-2 [&_ul]:list-disc"
            // Server-rendered from Markdown with full HTML escaping (XSS-safe).
            dangerouslySetInnerHTML={{ __html: preview?.html ?? "" }}
          />
        </DialogContent>
      </Dialog>

      {/* Publish confirmation */}
      <AlertDialog
        open={publishTarget != null}
        onOpenChange={(open) => {
          if (!open) setPublishTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Publier la version {publishTarget?.version_label} ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Cette version deviendra la version en vigueur du règlement
              intérieur. Tous les employés actifs devront en prendre
              connaissance (leur statut repassera à « À lire »). La version
              publiée ne pourra plus être modifiée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={publishMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (!publishTarget) return;
                publishMutation.mutate(publishTarget.id, {
                  onSuccess: () => setPublishTarget(null),
                });
              }}
            >
              {publishMutation.isPending ? "Publication…" : "Publier"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
