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
import {
  getCompanySettings,
  updateCompanySettings,
} from "@/services/settings";
import { useAuth } from "@/contexts/AuthContext";
import { trimLogoWhitespace } from "@/lib/trimLogo";
import { WorkplacesSettingsCard } from "@/pages/config/WorkplacesSettingsCard";
import { ExpenseCategoriesSettingsCard } from "@/pages/config/ExpenseCategoriesSettingsCard";

const Parametres = () => {
  const { user, isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stampInputRef = useRef<HTMLInputElement>(null);

  const [agencyName, setAgencyName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [stampBase64, setStampBase64] = useState<string | null>(null);
  const [legalName, setLegalName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [tradeRegister, setTradeRegister] = useState("");
  const [accentColor, setAccentColor] = useState("#4A9FD4");

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

  const {
    data: company,
    isLoading: isLoadingCompany,
    isError: isErrorCompany,
    error: companyError,
    refetch: refetchCompany,
  } = useQuery({
    queryKey: ["settings", "company"],
    queryFn: getCompanySettings,
    retry: 1,
    enabled: Boolean(isSuperAdmin),
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

  useEffect(() => {
    if (company) {
      setAgencyName(company.company_name || "");
      setLegalName(company.legal_name || "");
      setTaxId(company.tax_id || "");
      setTradeRegister(company.trade_register || "");
      setAddress(company.address || "");
      setPhone(company.phone || "");
      setEmail(company.email || "");
      setAccentColor(company.accent_color || "#4A9FD4");
      setLogoBase64(company.logo_base64 || null);
      setStampBase64(company.stamp_base64 || null);
    }
  }, [company]);

  const agencyHasChanges = useMemo(() => {
    if (!agency) return false;
    return (
      agencyName.trim() !== (agency.name || "") ||
      address.trim() !== (agency.address || "") ||
      phone.trim() !== (agency.phone || "") ||
      logoBase64 !== (agency.logo_base64 || null)
    );
  }, [agency, agencyName, address, phone, logoBase64]);

  const companyHasChanges = useMemo(() => {
    if (!company) return false;
    return (
      agencyName.trim() !== (company.company_name || "") ||
      legalName.trim() !== (company.legal_name || "") ||
      taxId.trim() !== (company.tax_id || "") ||
      tradeRegister.trim() !== (company.trade_register || "") ||
      address.trim() !== (company.address || "") ||
      phone.trim() !== (company.phone || "") ||
      email.trim() !== (company.email || "") ||
      accentColor.trim() !== (company.accent_color || "#4A9FD4") ||
      logoBase64 !== (company.logo_base64 || null) ||
      stampBase64 !== (company.stamp_base64 || null)
    );
  }, [
    company,
    agencyName,
    legalName,
    taxId,
    tradeRegister,
    address,
    phone,
    email,
    accentColor,
    logoBase64,
    stampBase64,
  ]);

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
    reader.onloadend = async () => {
      const trimmed = await trimLogoWhitespace(reader.result as string);
      setLogoBase64(trimmed);
    };
    reader.onerror = () => toast.error("Erreur lors de la lecture du fichier");
    reader.readAsDataURL(file);
  };

  const handleStampUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      setStampBase64(trimmed);
    };
    reader.onerror = () => toast.error("Erreur lors de la lecture du fichier");
    reader.readAsDataURL(file);
  };

  const agencyId =
    agency?.id || user?.agencyId || (user?.id ? Number(user.id) : null);

  const saveAgencyMutation = useMutation({
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
        description:
          err instanceof Error ? err.message : "Enregistrement impossible",
      });
    },
  });

  const saveCompanyMutation = useMutation({
    mutationFn: updateCompanySettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "company"] });
      toast.success("Paramètres société enregistrés");
    },
    onError: (err: unknown) => {
      toast.error("Erreur", {
        description:
          err instanceof Error ? err.message : "Enregistrement impossible",
      });
    },
  });

  function handleSaveAgency() {
    if (!agencyName.trim()) {
      toast.error("Le nom de l'agence est obligatoire");
      return;
    }
    saveAgencyMutation.mutate({
      name: agencyName.trim(),
      address: address.trim() || null,
      phone: phone.trim() || null,
      logo_base64: logoBase64,
    });
  }

  function handleSaveCompany() {
    if (!agencyName.trim()) {
      toast.error("Le nom de la société est obligatoire");
      return;
    }
    if (!/^#[0-9A-Fa-f]{6}$/.test(accentColor.trim())) {
      toast.error("Couleur d’accent invalide (format #RRGGBB)");
      return;
    }
    saveCompanyMutation.mutate({
      company_name: agencyName.trim(),
      legal_name: legalName.trim() || agencyName.trim(),
      tax_id: taxId.trim() || null,
      trade_register: tradeRegister.trim() || null,
      address: address.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      accent_color: accentColor.trim(),
      logo_base64: logoBase64,
      stamp_base64: stampBase64,
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

  if (isSuperAdmin && !isLoadingCompany && isErrorCompany) {
    return (
      <AppErrorExperience
        error={companyError}
        onRetry={() => void refetchCompany()}
      />
    );
  }

  const isLoading = isSuperAdmin ? isLoadingCompany : isLoadingAgency;
  const isSaving = isSuperAdmin
    ? saveCompanyMutation.isPending
    : saveAgencyMutation.isPending;
  const hasChanges = isSuperAdmin ? companyHasChanges : agencyHasChanges;

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Paramètres</h1>
        <p className="text-muted-foreground">
          {isSuperAdmin
            ? "Informations société utilisées sur les bulletins de paie"
            : "Configurez les paramètres de votre agence"}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            {isSuperAdmin ? "Informations société" : "Informations de l'agence"}
          </CardTitle>
          <CardDescription>
            {isSuperAdmin
              ? "Nom, contact, logo et cachet affichés sur les PDF RH"
              : "Informations générales de votre compte agence"}
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
                <label className="text-sm font-medium">
                  {isSuperAdmin ? "Nom de la société" : "Nom de l'agence"}
                </label>
                <Input
                  value={agencyName}
                  onChange={(e) => setAgencyName(e.target.value)}
                  className="mt-1"
                  placeholder={
                    isSuperAdmin ? "LivSight" : "Nom de l'agence"
                  }
                />
              </div>
              {isSuperAdmin ? (
                <div>
                  <label className="text-sm font-medium">Raison sociale</label>
                  <Input
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    className="mt-1"
                    placeholder="Raison sociale (pied de page PDF)"
                  />
                </div>
              ) : null}
              {isSuperAdmin ? (
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">NUI</label>
                    <Input
                      value={taxId}
                      onChange={(e) => setTaxId(e.target.value)}
                      className="mt-1"
                      placeholder="Numéro d’identification unique"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">RCCM</label>
                    <Input
                      value={tradeRegister}
                      onChange={(e) => setTradeRegister(e.target.value)}
                      className="mt-1"
                      placeholder="Registre du commerce"
                    />
                  </div>
                </div>
              ) : null}
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
              {isSuperAdmin ? (
                <div>
                  <label className="text-sm font-medium">Cachet société</label>
                  <div className="mt-1 flex items-center gap-4">
                    <div className="w-20 h-20 rounded-xl border bg-muted/40 flex items-center justify-center overflow-hidden px-2">
                      {stampBase64 ? (
                        <img
                          src={stampBase64}
                          alt="Cachet"
                          className="max-h-16 max-w-full object-contain"
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Aucun
                        </span>
                      )}
                    </div>
                    <div className="space-y-2">
                      <input
                        ref={stampInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleStampUpload}
                        className="hidden"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => stampInputRef.current?.click()}
                      >
                        <Upload className="w-4 h-4" />
                        {stampBase64
                          ? "Changer le cachet"
                          : "Ajouter un cachet"}
                      </Button>
                      {stampBase64 ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground"
                          onClick={() => setStampBase64(null)}
                        >
                          Retirer
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Affiché à côté de la signature personnelle (Mon profil) sur
                    les bulletins
                  </p>
                </div>
              ) : null}
              <div>
                <label className="text-sm font-medium">Adresse</label>
                <Textarea
                  placeholder={
                    isSuperAdmin
                      ? "Adresse complète de la société"
                      : "Adresse complète de l'agence"
                  }
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
                    onChange={
                      isSuperAdmin
                        ? (e) => setEmail(e.target.value)
                        : undefined
                    }
                    disabled={!isSuperAdmin}
                    className={`mt-1 ${isSuperAdmin ? "" : "bg-muted"}`}
                    placeholder="contact@livsight.com"
                  />
                  {!isSuperAdmin ? (
                    <p className="text-xs text-muted-foreground mt-1">
                      L'email ne peut pas être modifié ici
                    </p>
                  ) : null}
                </div>
              </div>
              {isSuperAdmin ? (
                <div>
                  <label className="text-sm font-medium">
                    Couleur d’accent (PDF)
                  </label>
                  <div className="mt-1 flex items-center gap-3">
                    <Input
                      type="color"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="h-10 w-14 cursor-pointer p-1"
                      aria-label="Couleur d’accent"
                    />
                    <Input
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      placeholder="#4A9FD4"
                      className="font-mono uppercase"
                    />
                  </div>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      {isSuperAdmin ? <WorkplacesSettingsCard /> : null}
      {isSuperAdmin ? <ExpenseCategoriesSettingsCard /> : null}

      <div className="flex justify-end">
        <Button
          onClick={isSuperAdmin ? handleSaveCompany : handleSaveAgency}
          size="lg"
          className="gap-2"
          disabled={isSaving || isLoading || !hasChanges}
        >
          {isSaving ? (
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

export default Parametres;
