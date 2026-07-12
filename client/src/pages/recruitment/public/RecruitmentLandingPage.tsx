/**
 * Recrutement — page publique listant les offres ouvertes
 */

import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, MapPin, Users, ArrowRight } from "lucide-react";
import { getPublicJobs } from "@/services/recruitmentPublic";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function RecruitmentLandingPage() {
  const { data: jobs, isLoading, isError } = useQuery({
    queryKey: ["recruitment", "public", "jobs"],
    queryFn: getPublicJobs,
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/80 bg-card">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-5 md:px-6">
          <div>
            <p className="text-sm font-medium text-primary">LivSight</p>
            <h1 className="text-2xl font-bold tracking-tight">Recrutement</h1>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/login">Espace agence</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 md:px-6 md:py-12">
        <section className="mb-8 space-y-2">
          <h2 className="text-xl font-semibold">Offres disponibles</h2>
          <p className="text-muted-foreground">
            Postulez en ligne. Tous les champs du formulaire sont obligatoires
            (coordonnées, quartier, transport, disponibilité, photo, CV, lettre
            de motivation et questions spécifiques).
          </p>
        </section>

        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-36 w-full rounded-2xl" />
            <Skeleton className="h-36 w-full rounded-2xl" />
          </div>
        )}

        {isError && (
          <Alert variant="destructive">
            <AlertDescription>
              Impossible de charger les offres. Réessayez plus tard.
            </AlertDescription>
          </Alert>
        )}

        {!isLoading && !isError && jobs?.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
            Aucune offre ouverte pour le moment.
          </div>
        )}

        <div className="space-y-4">
          {jobs?.map((job) => (
            <article
              key={job.id}
              className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold">{job.title}</h3>
                    <Badge variant="secondary">{job.type}</Badge>
                  </div>
                  {job.description && (
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {job.description}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-4 w-4" aria-hidden />
                      {job.location}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="h-4 w-4" aria-hidden />
                      {job.slots} place{job.slots > 1 ? "s" : ""}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Briefcase className="h-4 w-4" aria-hidden />
                      Réf. #{job.id}
                    </span>
                  </div>
                </div>
                <Button asChild className="shrink-0">
                  <Link to={`/recrutement/${job.id}/postuler`}>
                    Postuler
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
