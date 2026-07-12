/**
 * Recrutement — formulaire public de candidature (tous champs obligatoires)
 */

import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, CheckCircle2 } from "lucide-react";
import {
  getPublicJob,
  getPublicJobQuestions,
  submitApplication,
  getApplyValidationFields,
  SPOKEN_LANGUAGE_OPTIONS,
  YES_NO_OPTIONS,
  type AvailabilityOption,
  type EducationLevelOption,
  type SpokenLanguageOption,
  type YesNoOption,
  type TransportOption,
} from "@/services/recruitmentPublic";
import { ApiError } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingSpinner } from "@/components/loading/LoadingSpinner";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const TRANSPORT_OPTIONS: { value: TransportOption; label: string }[] = [
  { value: "scooter", label: "Scooter" },
  { value: "velo", label: "Vélo" },
  { value: "voiture", label: "Voiture" },
  { value: "apied", label: "À pied" },
];

const EDUCATION_OPTIONS: { value: EducationLevelOption; label: string }[] = [
  { value: "bac", label: "Bac" },
  { value: "licence", label: "Licence" },
  { value: "master", label: "Master" },
  { value: "doctorat", label: "Doctorat" },
];

const AVAILABILITY_OPTIONS: { value: AvailabilityOption; label: string }[] = [
  { value: "plein", label: "Temps plein" },
  { value: "partiel", label: "Temps partiel" },
  { value: "weekend", label: "Week-end" },
];

type AnswerMap = Record<number, string>;

export default function ApplyPage() {
  const { jobId: jobIdParam } = useParams<{ jobId: string }>();
  const jobId = Number(jobIdParam);
  const navigate = useNavigate();
  const validJobId = Number.isFinite(jobId) && jobId > 0;

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [quartier, setQuartier] = useState("");
  const [educationLevel, setEducationLevel] = useState<EducationLevelOption | "">("");
  const [fieldOfStudy, setFieldOfStudy] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [selectedLanguages, setSelectedLanguages] = useState<SpokenLanguageOption[]>(
    []
  );
  const [currentlyEmployed, setCurrentlyEmployed] = useState<YesNoOption | "">("");
  const [inOtherCompany, setInOtherCompany] = useState<YesNoOption | "">("");
  const [transport, setTransport] = useState<TransportOption | "">("");
  const [availability, setAvailability] = useState<AvailabilityOption | "">("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [cv, setCv] = useState<File | null>(null);
  const [coverLetter, setCoverLetter] = useState<File | null>(null);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<number | null>(null);

  const jobQuery = useQuery({
    queryKey: ["recruitment", "public", "job", jobId],
    queryFn: () => getPublicJob(jobId),
    enabled: validJobId,
  });

  const questionsQuery = useQuery({
    queryKey: ["recruitment", "public", "questions", jobId],
    queryFn: () => getPublicJobQuestions(jobId),
    enabled: validJobId,
  });

  const questions = useMemo(
    () =>
      [...(questionsQuery.data ?? [])].sort(
        (a, b) => a.order_index - b.order_index
      ),
    [questionsQuery.data]
  );

  const setAnswer = (questionId: number, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[`question_${questionId}`];
      return next;
    });
  };

  const toggleLanguage = (lang: SpokenLanguageOption, checked: boolean) => {
    setSelectedLanguages((prev) =>
      checked ? [...prev, lang] : prev.filter((l) => l !== lang)
    );
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.languages;
      return next;
    });
  };

  const validateClient = (): boolean => {
    const errors: Record<string, string> = {};
    if (!fullName.trim()) errors.full_name = "Nom complet requis";
    if (!phone.trim()) errors.phone = "Téléphone requis";
    if (!email.trim()) errors.email = "Email requis";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = "Email invalide";
    }
    if (!quartier.trim()) errors.quartier = "Quartier de résidence requis";
    if (!educationLevel) errors.education_level = "Niveau d'études requis";
    if (!fieldOfStudy.trim()) errors.field_of_study = "Filière requise";
    if (!schoolName.trim()) errors.school_name = "École ou université requise";
    if (selectedLanguages.length === 0) {
      errors.languages = "Sélectionnez au moins une langue";
    }
    if (!currentlyEmployed) {
      errors.currently_employed = "Réponse requise";
    }
    if (!inOtherCompany) {
      errors.in_other_company = "Réponse requise";
    }
    if (!transport) errors.transport = "Moyen de transport requis";
    if (!availability) errors.availability = "Disponibilité requise";
    if (!photo) errors.photo = "Photo requise";
    if (!cv) errors.cv = "CV requis (PDF)";
    if (!coverLetter) errors.cover_letter = "Lettre de motivation requise (PDF)";

    for (const q of questions) {
      const value = (answers[q.id] ?? "").trim();
      if (!value) {
        errors[`question_${q.id}`] = "Réponse requise";
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (
      !validJobId ||
      !photo ||
      !cv ||
      !coverLetter ||
      !transport ||
      !availability ||
      !educationLevel
    ) {
      validateClient();
      return;
    }
    if (!validateClient()) return;

    setIsSubmitting(true);
    try {
      const result = await submitApplication({
        job_offer_id: jobId,
        full_name: fullName,
        phone,
        email,
        quartier,
        education_level: educationLevel,
        field_of_study: fieldOfStudy,
        school_name: schoolName,
        languages: selectedLanguages,
        currently_employed: currentlyEmployed as YesNoOption,
        in_other_company: inOtherCompany as YesNoOption,
        transport,
        availability,
        photo,
        cv,
        cover_letter: coverLetter,
        answers: questions.map((q) => ({
          question_id: q.id,
          answer_text: answers[q.id]?.trim() ?? "",
        })),
      });
      setSubmittedId(result.id);
    } catch (err) {
      const serverFields = getApplyValidationFields(err);
      if (serverFields.length > 0) {
        const mapped: Record<string, string> = {};
        for (const item of serverFields) {
          mapped[item.field] = item.messages[0] ?? "Champ invalide";
        }
        setFieldErrors(mapped);
      }
      if (err instanceof ApiError) {
        setFormError(err.message);
      } else {
        setFormError("Une erreur est survenue lors de l'envoi.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!validJobId) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-muted-foreground">Offre invalide.</p>
        <Button variant="link" asChild className="mt-4">
          <Link to="/recrutement">Retour aux offres</Link>
        </Button>
      </div>
    );
  }

  if (jobQuery.isLoading || questionsQuery.isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-10">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (jobQuery.isError || !jobQuery.data) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center space-y-4">
        <Alert variant="destructive">
          <AlertDescription>
            Cette offre n&apos;est plus disponible ou n&apos;existe pas.
          </AlertDescription>
        </Alert>
        <Button asChild>
          <Link to="/recrutement">Voir les autres offres</Link>
        </Button>
      </div>
    );
  }

  const job = jobQuery.data;

  if (submittedId != null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-border/80 bg-card p-8 text-center shadow-sm">
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
          <h1 className="mt-4 text-xl font-semibold">Candidature envoyée</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Merci {fullName.trim()}. Votre dossier pour « {job.title} » a bien
            été enregistré (réf. #{submittedId}).
          </p>
          <Button className="mt-6" onClick={() => navigate("/recrutement")}>
            Retour aux offres
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/80 bg-card">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4 md:px-6">
          <Button variant="ghost" size="icon" asChild aria-label="Retour">
            <Link to="/recrutement">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <p className="text-xs text-muted-foreground">Candidature</p>
            <h1 className="text-lg font-semibold">{job.title}</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 md:px-6">
        <p className="mb-6 text-sm text-muted-foreground">
          {job.location} · {job.type} · Tous les champs marqués * sont
          obligatoires.
        </p>

        <form
          onSubmit={handleSubmit}
          className="space-y-8 rounded-2xl border border-border/80 bg-card p-6 shadow-sm md:p-8"
          noValidate
        >
          {formError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold">Identité & contact</legend>
            <div className="space-y-2">
              <Label htmlFor="full_name">Nom complet *</Label>
              <Input
                id="full_name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoComplete="name"
              />
              {fieldErrors.full_name && (
                <p className="text-xs text-destructive">{fieldErrors.full_name}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Téléphone *</Label>
              <Input
                id="phone"
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="699000001"
                required
                autoComplete="tel"
              />
              {fieldErrors.phone && (
                <p className="text-xs text-destructive">{fieldErrors.phone}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="exemple@email.com"
                required
                autoComplete="email"
              />
              {fieldErrors.email && (
                <p className="text-xs text-destructive">{fieldErrors.email}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="quartier">Quartier de résidence *</Label>
              <Input
                id="quartier"
                value={quartier}
                onChange={(e) => setQuartier(e.target.value)}
                placeholder="Ex. Makepe, Bonamoussadi"
                required
              />
              {fieldErrors.quartier && (
                <p className="text-xs text-destructive">{fieldErrors.quartier}</p>
              )}
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold">Formation</legend>
            <div className="space-y-2">
              <Label htmlFor="education_level">Niveau d&apos;études *</Label>
              <Select
                value={educationLevel}
                onValueChange={(v) => setEducationLevel(v as EducationLevelOption)}
                required
              >
                <SelectTrigger id="education_level">
                  <SelectValue placeholder="Choisir…" />
                </SelectTrigger>
                <SelectContent>
                  {EDUCATION_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.education_level && (
                <p className="text-xs text-destructive">{fieldErrors.education_level}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="field_of_study">Filière / domaine d&apos;études *</Label>
              <Input
                id="field_of_study"
                value={fieldOfStudy}
                onChange={(e) => setFieldOfStudy(e.target.value)}
                placeholder="Ex. Logistique, Commerce, Droit"
                required
              />
              {fieldErrors.field_of_study && (
                <p className="text-xs text-destructive">{fieldErrors.field_of_study}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="school_name">École ou université *</Label>
              <Input
                id="school_name"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder="Ex. Université de Douala"
                required
              />
              {fieldErrors.school_name && (
                <p className="text-xs text-destructive">{fieldErrors.school_name}</p>
              )}
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold">Langues parlées</legend>
            <p className="text-xs text-muted-foreground">
              Cochez au moins une langue.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {SPOKEN_LANGUAGE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  htmlFor={`lang-${opt.value}`}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-border/80 px-3 py-2 text-sm"
                >
                  <Checkbox
                    id={`lang-${opt.value}`}
                    checked={selectedLanguages.includes(opt.value)}
                    onCheckedChange={(checked) =>
                      toggleLanguage(opt.value, checked === true)
                    }
                  />
                  {opt.label}
                </label>
              ))}
            </div>
            {fieldErrors.languages && (
              <p className="text-xs text-destructive">{fieldErrors.languages}</p>
            )}
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold">Situation professionnelle</legend>
            <div className="space-y-2">
              <Label>Êtes-vous actuellement en poste ? *</Label>
              <RadioGroup
                value={currentlyEmployed}
                onValueChange={(v) => {
                  setCurrentlyEmployed(v as YesNoOption);
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.currently_employed;
                    return next;
                  });
                }}
                className="flex gap-4"
              >
                {YES_NO_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    htmlFor={`employed-${opt.value}`}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <RadioGroupItem
                      value={opt.value}
                      id={`employed-${opt.value}`}
                    />
                    {opt.label}
                  </label>
                ))}
              </RadioGroup>
              {fieldErrors.currently_employed && (
                <p className="text-xs text-destructive">
                  {fieldErrors.currently_employed}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Êtes-vous actuellement dans une autre boîte ? *</Label>
              <RadioGroup
                value={inOtherCompany}
                onValueChange={(v) => {
                  setInOtherCompany(v as YesNoOption);
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.in_other_company;
                    return next;
                  });
                }}
                className="flex gap-4"
              >
                {YES_NO_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    htmlFor={`other-co-${opt.value}`}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <RadioGroupItem
                      value={opt.value}
                      id={`other-co-${opt.value}`}
                    />
                    {opt.label}
                  </label>
                ))}
              </RadioGroup>
              {fieldErrors.in_other_company && (
                <p className="text-xs text-destructive">
                  {fieldErrors.in_other_company}
                </p>
              )}
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold">Mobilité & disponibilité</legend>
            <div className="space-y-2">
              <Label htmlFor="transport">Moyen de transport *</Label>
              <Select
                value={transport}
                onValueChange={(v) => setTransport(v as TransportOption)}
                required
              >
                <SelectTrigger id="transport">
                  <SelectValue placeholder="Choisir…" />
                </SelectTrigger>
                <SelectContent>
                  {TRANSPORT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.transport && (
                <p className="text-xs text-destructive">{fieldErrors.transport}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="availability">Disponibilité *</Label>
              <Select
                value={availability}
                onValueChange={(v) => setAvailability(v as AvailabilityOption)}
                required
              >
                <SelectTrigger id="availability">
                  <SelectValue placeholder="Choisir…" />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABILITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.availability && (
                <p className="text-xs text-destructive">{fieldErrors.availability}</p>
              )}
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold">Documents</legend>
            <p className="text-xs text-muted-foreground">
              Photo (JPEG, PNG ou WebP) puis CV et lettre de motivation en PDF
              (max 10 Mo chacun).
            </p>
            <div className="space-y-2">
              <Label htmlFor="photo">Photo de profil *</Label>
              <Input
                id="photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required
                onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
              />
              {fieldErrors.photo && (
                <p className="text-xs text-destructive">{fieldErrors.photo}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="cv">CV (PDF) *</Label>
              <Input
                id="cv"
                type="file"
                accept="application/pdf,.pdf"
                required
                onChange={(e) => setCv(e.target.files?.[0] ?? null)}
              />
              {fieldErrors.cv && (
                <p className="text-xs text-destructive">{fieldErrors.cv}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="cover_letter">Lettre de motivation (PDF) *</Label>
              <Input
                id="cover_letter"
                type="file"
                accept="application/pdf,.pdf"
                required
                onChange={(e) => setCoverLetter(e.target.files?.[0] ?? null)}
              />
              {fieldErrors.cover_letter && (
                <p className="text-xs text-destructive">{fieldErrors.cover_letter}</p>
              )}
            </div>
          </fieldset>

          {questions.length > 0 && (
            <fieldset className="space-y-4">
              <legend className="text-sm font-semibold">
                Questions spécifiques à l&apos;offre
              </legend>
              {questions.map((q) => (
                <div key={q.id} className="space-y-2">
                  <Label htmlFor={`q-${q.id}`}>{q.question_text} *</Label>
                  {q.question_type === "mcq" && q.options?.length ? (
                    <Select
                      value={answers[q.id] ?? ""}
                      onValueChange={(v) => setAnswer(q.id, v)}
                      required
                    >
                      <SelectTrigger id={`q-${q.id}`}>
                        <SelectValue placeholder="Choisir…" />
                      </SelectTrigger>
                      <SelectContent>
                        {q.options.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id={`q-${q.id}`}
                      value={answers[q.id] ?? ""}
                      onChange={(e) => setAnswer(q.id, e.target.value)}
                      required
                    />
                  )}
                  {fieldErrors[`question_${q.id}`] && (
                    <p className="text-xs text-destructive">
                      {fieldErrors[`question_${q.id}`]}
                    </p>
                  )}
                </div>
              ))}
            </fieldset>
          )}

          <Button type="submit" className="w-full h-11" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <LoadingSpinner className="mr-2 h-4 w-4" />
                Envoi en cours…
              </>
            ) : (
              "Envoyer ma candidature"
            )}
          </Button>
        </form>
      </main>
    </div>
  );
}
