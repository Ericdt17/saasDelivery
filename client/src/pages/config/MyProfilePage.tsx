import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UserCircle, Upload, Save } from "lucide-react";
import { LoadingSpinner } from "@/components/loading/LoadingSpinner";
import { toast } from "sonner";
import { AppErrorExperience } from "@/components/errors/AppErrorExperience";
import { getMyProfile, updateMyProfile } from "@/services/settings";
import { trimLogoWhitespace } from "@/lib/trimLogo";

const MyProfilePage = () => {
  const queryClient = useQueryClient();
  const signatureInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [fonction, setFonction] = useState("");
  const [signatureBase64, setSignatureBase64] = useState<string | null>(null);

  const {
    data: profile,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["settings", "me"],
    queryFn: getMyProfile,
    retry: 1,
  });

  useEffect(() => {
    if (profile) {
      setName(profile.name || "");
      setFonction(profile.fonction || "");
      setSignatureBase64(profile.signature_base64 || null);
    }
  }, [profile]);

  const hasChanges = useMemo(() => {
    if (!profile) return false;
    return (
      name.trim() !== (profile.name || "") ||
      fonction.trim() !== (profile.fonction || "") ||
      signatureBase64 !== (profile.signature_base64 || null)
    );
  }, [profile, name, fonction, signatureBase64]);

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Veuillez sélectionner un fichier image");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Le fichier est trop volumineux (max 2MB)");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = async () => {
      const trimmed = await trimLogoWhitespace(reader.result as string);
      setSignatureBase64(trimmed);
    };
    reader.onerror = () => toast.error("Erreur lors de la lecture du fichier");
    reader.readAsDataURL(file);
  };

  const saveMutation = useMutation({
    mutationFn: updateMyProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "me"] });
      toast.success("Profil enregistré");
    },
    onError: (err: unknown) => {
      toast.error("Erreur", {
        description:
          err instanceof Error ? err.message : "Enregistrement impossible",
      });
    },
  });

  function handleSave() {
    if (!name.trim()) {
      toast.error("Le nom est obligatoire");
      return;
    }
    saveMutation.mutate({
      name: name.trim(),
      fonction: fonction.trim() || null,
      signature_base64: signatureBase64,
    });
  }

  if (!isLoading && isError) {
    return (
      <AppErrorExperience error={error} onRetry={() => void refetch()} />
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Mon profil</h1>
        <p className="text-muted-foreground">
          Nom, fonction et signature affichés sur les bulletins de paie
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCircle className="w-5 h-5 text-primary" />
            Signataire
          </CardTitle>
          <CardDescription>
            Ces informations apparaissent sous le cachet société sur les PDF RH
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size="md" variant="gif" />
            </div>
          ) : (
            <>
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input
                  value={profile?.email || ""}
                  disabled
                  className="mt-1 bg-muted"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  L&apos;email ne peut pas être modifié ici
                </p>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Nom</label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1"
                    placeholder="Ex. Djou Tousse Eric"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Fonction</label>
                  <Input
                    value={fonction}
                    onChange={(e) => setFonction(e.target.value)}
                    className="mt-1"
                    placeholder="Ex. Directeur Général"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Signature</label>
                <div className="mt-1 flex items-center gap-4">
                  <div className="w-28 h-16 rounded-xl border bg-muted/40 flex items-center justify-center overflow-hidden px-2">
                    {signatureBase64 ? (
                      <img
                        src={signatureBase64}
                        alt="Signature"
                        className="max-h-14 max-w-full object-contain"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Aucune
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    <input
                      ref={signatureInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleSignatureUpload}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => signatureInputRef.current?.click()}
                    >
                      <Upload className="w-4 h-4" />
                      {signatureBase64
                        ? "Changer la signature"
                        : "Ajouter une signature"}
                    </Button>
                    {signatureBase64 ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground"
                        onClick={() => setSignatureBase64(null)}
                      >
                        Retirer
                      </Button>
                    ) : null}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  PNG, JPG jusqu&apos;à 2MB
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          size="lg"
          className="gap-2"
          disabled={saveMutation.isPending || isLoading || !hasChanges}
        >
          {saveMutation.isPending ? (
            <LoadingSpinner size="sm" variant="icon" className="gap-0" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Enregistrer les modifications
        </Button>
      </div>
    </div>
  );
};

export default MyProfilePage;
