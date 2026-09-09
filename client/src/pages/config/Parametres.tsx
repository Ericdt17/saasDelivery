import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Building2, Upload, Save } from "lucide-react";
import { LoadingSpinner } from "@/components/loading/LoadingSpinner";
import { toast } from "sonner";
import { AppErrorExperience } from "@/components/errors/AppErrorExperience";
import { getAgencyMe, updateAgency } from "@/services/agencies";
import { useAuth } from "@/contexts/AuthContext";

const Parametres = () => {
  const { user, isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [agencyName, setAgencyName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [logoBase64, setLogoBase64] = useState<string | null>(null);

  const {
    data: agency,
    isLoading: isLoadingAgency,
    isError: isErrorAgency,
    error: agencyError,
    refetch: refetchAgency,
  } = useQuery({
    queryKey: ["agency", "me"],
    queryFn: getAgencyMe,
    retry: 1,
    enabled: !isSuperAdmin && user?.role === "agency",
  });

  useEffect(() => {
    if (agency) {
      setAgencyName(agency.name || "");
      setAddress(agency.address || "");
      setPhone(agency.phone || "");
      setEmail(agency.email || "");
      setLogoBase64(agency.logo_base64 || null);
    }
  }, [agency]);

  const hasChanges = useMemo(() => {
    if (!agency) return false;
    return (
      agencyName.trim() !== (agency.name || "") ||
      address.trim() !== (agency.address || "") ||
      phone.trim() !== (agency.phone || "") ||
      logoBase64 !== (agency.logo_base64 || null)
    );
  }, [agency, agencyName, address, phone, logoBase64]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    reader.onloadend = () => setLogoBase64(reader.result as string);
    reader.onerror = () => toast.error("Erreur lors de la lecture du fichier");
    reader.readAsDataURL(file);
  };

  const agencyId =
    agency?.id || user?.agencyId || (user?.id ? Number(user.id) : null);

  const saveMutation = useMutation({
    mutationFn: (data: {
      name: string;
      address?: string | null;
      phone?: string | null;
      logo_base64?: string | null;
    }) => {
      if (!agencyId) {
        throw new Error(
          "Impossible de déterminer l'ID de l'agence. Veuillez vous reconnecter."
        );
      }
      return updateAgency(agencyId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agency", "me"] });
      toast.success("Paramètres enregistrés");
    },
    onError: (err: unknown) => {
      toast.error("Erreur", {
        description: err instanceof Error ? err.message : "Enregistrement impossible",
      });
    },
  });

  function handleSave() {
    if (!agencyName.trim()) {
      toast.error("Le nom de l'agence est obligatoire");
      return;
    }
    saveMutation.mutate({
      name: agencyName.trim(),
      address: address.trim() || null,
      phone: phone.trim() || null,
      logo_base64: logoBase64,
    });
  }

  if (
    !isSuperAdmin &&
    user?.role === "agency" &&
    !isLoadingAgency &&
    isErrorAgency
  ) {
    return (
      <AppErrorExperience
        error={agencyError}
        onRetry={() => void refetchAgency()}
      />
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Paramètres</h1>
        <p className="text-muted-foreground">
          Configurez les paramètres de votre agence
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            Informations de l'agence
          </CardTitle>
          <CardDescription>
            Informations générales de votre compte agence
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isSuperAdmin ? (
            <div className="text-center py-8 text-muted-foreground border border-muted rounded-lg p-4">
              <p className="font-medium">Super administrateur</p>
              <p className="text-sm mt-2">
                Les super administrateurs n'ont pas d'agence associée.
              </p>
              <p className="text-sm mt-1">
                Utilisez la page « Agences » pour modifier une agence
                spécifique.
              </p>
            </div>
          ) : isLoadingAgency ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size="md" variant="gif" />
            </div>
          ) : (
            <>
              <div>
                <label className="text-sm font-medium">Nom de l'agence</label>
                <Input
                  value={agencyName}
                  onChange={(e) => setAgencyName(e.target.value)}
                  className="mt-1"
                  placeholder="Nom de l'agence"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Logo</label>
                <div className="mt-1 flex items-center gap-4">
                  <div className="w-20 h-20 rounded-xl gradient-primary flex items-center justify-center overflow-hidden">
                    {logoBase64 ? (
                      <img
                        src={logoBase64}
                        alt="Logo"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Building2 className="w-10 h-10 text-primary-foreground" />
                    )}
                  </div>
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-4 h-4" />
                      {logoBase64 ? "Changer le logo" : "Ajouter un logo"}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">
                      PNG, JPG jusqu'à 2MB
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Adresse</label>
                <Textarea
                  placeholder="Adresse complète de l'agence"
                  className="mt-1"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Téléphone</label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+237 6 00 00 00 00"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <Input
                    value={email}
                    disabled
                    className="mt-1 bg-muted"
                    placeholder="Email de l'agence"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    L'email ne peut pas être modifié ici
                  </p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {!isSuperAdmin && (
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            size="lg"
            className="gap-2"
            disabled={saveMutation.isPending || isLoadingAgency || !hasChanges}
          >
            {saveMutation.isPending ? (
              <LoadingSpinner size="sm" variant="icon" className="gap-0" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Enregistrer les modifications
          </Button>
        </div>
      )}
    </div>
  );
};

export default Parametres;
