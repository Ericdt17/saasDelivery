import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Building2,
  Upload,
  Clock,
  Download,
  Key,
  Bell,
  Shield,
  Save,
  Truck,
} from "lucide-react";
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
  const [reportTime, setReportTime] = useState("18:00");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Load agency data - only for agency admins (super admins don't have an agency)
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
    enabled: !isSuperAdmin && user?.role === "agency", // Only enable for agency role users
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

  // Handle logo upload
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Veuillez sélectionner un fichier image");
      return;
    }

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Le fichier est trop volumineux (max 2MB)");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setLogoBase64(base64String);
    };
    reader.onerror = () => {
      toast.error("Erreur lors de la lecture du fichier");
    };
    reader.readAsDataURL(file);
  };

  // Get agency ID: use agency.id if loaded, otherwise use user.agencyId or user.id
  // For agency admins, userId and agencyId are the same (the agency is the user)
  const agencyId = agency?.id || user?.agencyId || (user?.id ? Number(user.id) : null);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: (data: { name: string; address?: string; phone?: string; logo_base64?: string | null }) => {
      if (!agencyId) {
        throw new Error("Impossible de déterminer l'ID de l'agence. Veuillez vous reconnecter.");
      }
      return updateAgency(agencyId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agency", "me"] });
      toast.success("Paramètres enregistrés avec succès");
    },
    onError: (error: Error) => {
      toast.error(error?.message || "Erreur lors de la sauvegarde");
    },
  });

  if (!isSuperAdmin && user?.role === "agency" && !isLoadingAgency && isErrorAgency) {
    return <AppErrorExperience error={agencyError} onRetry={() => void refetchAgency()} />;
  }

  const handleSave = () => {
    if (!agencyId) {
      toast.error("Impossible de déterminer l'ID de l'agence. Veuillez vous reconnecter.");
      return;
    }

    if (!agencyName.trim()) {
      toast.error("Le nom de l'agence est obligatoire");
      return;
    }

    saveMutation.mutate({
      name: agencyName.trim(),
      address: address?.trim() || null,
      phone: phone?.trim() || null,
      logo_base64: logoBase64 || null,
    });
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Paramètres</h1>
        <p className="text-muted-foreground">
          Configurez les paramètres de votre agence
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Settings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Agency Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                Informations de l'agence
              </CardTitle>
              <CardDescription>
                Informations générales de votre agence de livraison
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isSuperAdmin ? (
                <div className="text-center py-8 text-muted-foreground border border-muted rounded-lg p-4">
                  <p className="font-medium">Super administrateur</p>
                  <p className="text-sm mt-2">Les super administrateurs n'ont pas d'agence associée.</p>
                  <p className="text-sm mt-1">Veuillez utiliser la page "Agences" pour modifier les paramètres d'une agence spécifique.</p>
                </div>
              ) : isLoadingAgency ? (
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner size="md" />
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
                      disabled={isSuperAdmin}
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
                          <Truck className="w-10 h-10 text-primary-foreground" />
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
                          disabled={isSuperAdmin}
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
                      disabled={isSuperAdmin}
                    />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Téléphone</label>
                      <Input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+225 07 00 00 00 00"
                        className="mt-1"
                        disabled={isSuperAdmin}
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


          {/* Reports */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Rapport automatique
              </CardTitle>
              <CardDescription>
                Configurez l'envoi automatique des rapports quotidiens
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Activer l'envoi automatique</p>
                  <p className="text-sm text-muted-foreground">
                    Recevez un rapport quotidien par email
                  </p>
                </div>
                <Switch
                  checked={notificationsEnabled}
                  onCheckedChange={setNotificationsEnabled}
                />
              </div>
              <Separator />
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Heure d'envoi</label>
                  <Select value={reportTime} onValueChange={setReportTime}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="06:00">06:00</SelectItem>
                      <SelectItem value="08:00">08:00</SelectItem>
                      <SelectItem value="12:00">12:00</SelectItem>
                      <SelectItem value="18:00">18:00</SelectItem>
                      <SelectItem value="20:00">20:00</SelectItem>
                      <SelectItem value="22:00">22:00</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Destinataires</label>
                  <Input value={email} disabled className="mt-1 bg-muted" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="w-5 h-5 text-primary" />
                Export des données
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start gap-2">
                <Download className="w-4 h-4" />
                Exporter toutes les livraisons
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2">
                <Download className="w-4 h-4" />
                Exporter les paiements
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2">
                <Download className="w-4 h-4" />
                Exporter les rapports
              </Button>
            </CardContent>
          </Card>

          {/* Security */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Sécurité
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start gap-2">
                <Key className="w-4 h-4" />
                Changer le mot de passe
              </Button>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary" />
                Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Nouvelles livraisons</span>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Paiements reçus</span>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Échecs de livraison</span>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Expéditions</span>
                <Switch />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

             {/* Save Button */}
             {!isSuperAdmin && (
               <div className="flex justify-end">
                 <Button
                   onClick={handleSave}
                   size="lg"
                   className="gap-2"
                   disabled={saveMutation.isPending || (isLoadingAgency && !agencyId)}
                 >
                   {saveMutation.isPending ? (
                     <LoadingSpinner size="sm" className="gap-0" />
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
