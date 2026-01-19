/**
 * Delivery Form Component
 * Form for creating and editing deliveries with validation
 */

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type FrontendDelivery } from "@/lib/data-transform";
import { mapStatusToBackend, mapStatusToFrontend } from "@/lib/data-transform";
import { useCreateDelivery, useUpdateDelivery } from "@/hooks/useDeliveries";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getGroups, getGroupById } from "@/services/groups";

// Form validation schema
const deliveryFormSchema = z.object({
  telephone: z.string()
    .min(1, "Le numéro de téléphone est requis")
    .regex(/^[\d\s\+\-]+$/, "Format de téléphone invalide"),
  quartier: z.string().optional(),
  produits: z.string()
    .min(1, "Les produits sont requis"),
  montant_total: z.union([
    z.number().min(0, "Le montant doit être positif"),
    z.string().transform((val) => {
      const num = parseFloat(val);
      if (isNaN(num) || num < 0) throw new Error("Montant invalide");
      return num;
    })
  ]),
  montant_encaisse: z.union([
    z.number().min(0, "Le montant encaissé doit être positif"),
    z.string().transform((val) => {
      if (!val || val === "") return 0;
      const num = parseFloat(val);
      if (isNaN(num) || num < 0) throw new Error("Montant invalide");
      return num;
    })
  ]).optional().default(0),
  frais_livraison: z.union([
    z.number().min(0, "Le frais de livraison doit être positif"),
    z.string().transform((val) => {
      if (!val || val === "") return undefined;
      const num = parseFloat(val);
      if (isNaN(num) || num < 0) throw new Error("Montant invalide");
      return num;
    })
  ]).optional(),
  statut: z.enum(["en_cours", "livré", "annulé", "renvoyé", "pickup", "expedition", "client_absent", "injoignable", "ne_decroche_pas", "present_ne_decroche_zone1", "present_ne_decroche_zone2"]).optional(),
  instructions: z.string().optional(),
  carrier: z.string().optional(),
  groupe: z.union([
    z.number().int().positive(),
    z.string().transform((val) => {
      if (val === "none" || !val) return undefined;
      const num = parseInt(val);
      return isNaN(num) ? undefined : num;
    })
  ]).optional(),
});

type DeliveryFormValues = z.infer<typeof deliveryFormSchema>;

interface DeliveryFormProps {
  delivery?: FrontendDelivery;
  groupId?: number;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function DeliveryForm({ delivery, groupId, onSuccess, onCancel }: DeliveryFormProps) {
  const isEditMode = !!delivery;
  const createMutation = useCreateDelivery();
  const updateMutation = useUpdateDelivery();
  
  // State local pour permettre de vider complètement le champ frais_livraison
  const [feeInputValue, setFeeInputValue] = useState<string>('');

  // Determine if we need to show the group select (only in create mode without groupId)
  const isGroupSelectEnabled = !isEditMode && !groupId;

  // Fetch groups for select dropdown (only in create mode without groupId)
  const { data: groups = [] } = useQuery({
    queryKey: ["groups"],
    queryFn: getGroups,
    enabled: isGroupSelectEnabled,
  });

  // Fetch group info if groupId is provided OR if delivery has a group_id (for edit mode)
  const groupIdToFetch = groupId || delivery?.group_id;
  const shouldFetchGroup = !!groupIdToFetch;

  const { data: group } = useQuery({
    queryKey: ["group", groupIdToFetch],
    queryFn: () => getGroupById(groupIdToFetch!),
    enabled: shouldFetchGroup,
  });

  const form = useForm<DeliveryFormValues>({
    resolver: zodResolver(deliveryFormSchema),
    defaultValues: delivery ? {
      telephone: delivery.telephone,
      quartier: delivery.quartier,
      produits: delivery.produits,
      montant_total: delivery.montant_total,
      montant_encaisse: delivery.montant_encaisse,
      frais_livraison: delivery.frais_livraison,
      statut: delivery.statut,
      instructions: delivery.instructions,
      carrier: delivery.carrier || undefined,
      groupe: delivery.group_id || undefined,
    } : {
      telephone: "",
      quartier: "",
      produits: "",
      montant_total: 0,
      montant_encaisse: 0,
      frais_livraison: undefined,
      statut: "en_cours",
      instructions: "",
      carrier: undefined,
      groupe: groupId || undefined,
    },
  });

  // Synchroniser le state local avec la valeur du formulaire
  const feeValue = form.watch('frais_livraison');
  useEffect(() => {
    if (feeValue !== undefined && feeValue !== null) {
      setFeeInputValue(String(feeValue));
    } else {
      setFeeInputValue('');
    }
  }, [feeValue]);

  const onSubmit = async (values: DeliveryFormValues) => {
    try {
      // Transform frontend values to backend format
      const backendData = {
        phone: values.telephone,
        items: values.produits,
        amount_due: typeof values.montant_total === 'string' 
          ? parseFloat(values.montant_total) 
          : values.montant_total,
        amount_paid: typeof values.montant_encaisse === 'string'
          ? parseFloat(values.montant_encaisse) || 0
          : values.montant_encaisse || 0,
        status: values.statut ? mapStatusToBackend(values.statut) : 'pending',
        quartier: values.quartier || undefined,
        notes: values.instructions || undefined,
        carrier: values.carrier || undefined,
        delivery_fee: values.frais_livraison !== undefined && values.frais_livraison !== null
          ? (typeof values.frais_livraison === 'string'
              ? parseFloat(values.frais_livraison) || undefined
              : values.frais_livraison)
          : undefined,
        group_id: groupId || values.groupe || undefined,
      };

      if (isEditMode && delivery) {
        await updateMutation.mutateAsync({
          id: delivery.id,
          data: backendData,
        });
      } else {
        await createMutation.mutateAsync(backendData);
      }

      onSuccess?.();
    } catch (error) {
      // Error is handled by the mutation hooks
      console.error('Form submission error:', error);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Téléphone */}
          <FormField
            control={form.control}
            name="telephone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Téléphone *</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="+225 XX XX XX XX XX" 
                    {...field} 
                    disabled={isLoading}
                  />
                </FormControl>
                <FormDescription>
                  Numéro de téléphone du client
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Quartier */}
          <FormField
            control={form.control}
            name="quartier"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quartier</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="Nom du quartier" 
                    {...field} 
                    disabled={isLoading}
                  />
                </FormControl>
                <FormDescription>
                  Quartier de livraison
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Groupe */}
        {isEditMode || groupId ? (
          // En mode édition OU si groupId est fourni → lecture seule
          <FormField
            control={form.control}
            name="groupe"
            render={({ field }) => {
              // Déterminer le groupId à utiliser
              const currentGroupId = groupId || delivery?.group_id;
              // Récupérer le nom du groupe
              let groupName = "Aucun groupe";
              
              if (currentGroupId) {
                if (group?.name) {
                  groupName = group.name;
                } else if (delivery?.group_name) {
                  groupName = delivery.group_name;
                } else {
                  groupName = `Groupe #${currentGroupId}`;
                }
              }
              
              return (
                <FormItem>
                  <FormLabel>Groupe</FormLabel>
                  <FormControl>
                    <Input 
                      value={groupName}
                      disabled={true}
                      readOnly
                    />
                  </FormControl>
                  <FormDescription>
                    {isEditMode 
                      ? "Le groupe ne peut pas être modifié lors de l'édition"
                      : "Ce groupe est fixe pour cette page"
                    }
                  </FormDescription>
                </FormItem>
              );
            }}
          />
        ) : (
          // Création sans groupId → Select pour choisir
          <FormField
            control={form.control}
            name="groupe"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Groupe</FormLabel>
                <Select 
                  onValueChange={(value) => field.onChange(value === "none" ? undefined : parseInt(value))} 
                  value={field.value?.toString() || "none"}
                  disabled={isLoading}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un groupe" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">Aucun groupe</SelectItem>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={group.id.toString()}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Groupe WhatsApp associé à cette livraison
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Produits */}
        <FormField
          control={form.control}
          name="produits"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Produits *</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Description des produits à livrer" 
                  {...field} 
                  disabled={isLoading}
                  rows={3}
                />
              </FormControl>
              <FormDescription>
                Liste des produits ou articles à livrer
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Montant total */}
          <FormField
            control={form.control}
            name="montant_total"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Montant total (FCFA) *</FormLabel>
                <FormControl>
                  <Input 
                    type="number"
                    placeholder="0" 
                    {...field}
                    value={field.value || ''}
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    disabled={isLoading}
                  />
                </FormControl>
                <FormDescription>
                  Montant total de la livraison
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Montant encaissé */}
          <FormField
            control={form.control}
            name="montant_encaisse"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Montant encaissé (FCFA)</FormLabel>
                <FormControl>
                  <Input 
                    type="number"
                    placeholder="0" 
                    {...field}
                    value={field.value || ''}
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    disabled={isLoading}
                  />
                </FormControl>
                <FormDescription>
                  Montant déjà payé par le client
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Frais de livraison (optionnel) */}
        <FormField
          control={form.control}
          name="frais_livraison"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Frais de livraison (FCFA) - Optionnel</FormLabel>
              <FormControl>
                <Input 
                  type="text"
                  inputMode="numeric"
                  placeholder="Laissez vide pour tarif automatique" 
                  value={feeInputValue}
                  onChange={(e) => {
                    const val = e.target.value;
                    // Mettre à jour le state local immédiatement pour permettre de vider
                    setFeeInputValue(val);
                    
                    // Si le champ est vide, mettre undefined
                    if (val === '' || val.trim() === '') {
                      field.onChange(undefined);
                    } else {
                      // Essayer de convertir en nombre
                      const numValue = parseFloat(val);
                      // Si c'est un nombre valide et >= 0, mettre à jour le formulaire
                      if (!isNaN(numValue) && numValue >= 0) {
                        field.onChange(numValue);
                      }
                      // Si ce n'est pas un nombre valide, on ne met pas à jour le formulaire
                      // mais on garde la valeur dans le state local pour permettre de continuer à taper
                    }
                  }}
                  onBlur={(e) => {
                    const val = e.target.value.trim();
                    // Quand on quitte le champ, nettoyer la valeur
                    if (val === '') {
                      setFeeInputValue('');
                      field.onChange(undefined);
                    } else {
                      const numValue = parseFloat(val);
                      if (!isNaN(numValue) && numValue >= 0) {
                        setFeeInputValue(String(numValue));
                        field.onChange(numValue);
                      } else {
                        // Si la valeur n'est pas valide, réinitialiser
                        setFeeInputValue('');
                        field.onChange(undefined);
                      }
                    }
                    field.onBlur();
                  }}
                  disabled={isLoading}
                />
              </FormControl>
              <FormDescription>
                Si vide, le tarif standard du quartier sera appliqué automatiquement. Remplir uniquement pour tarif exceptionnel (Premium/Gold).
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Statut */}
          <FormField
            control={form.control}
            name="statut"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Statut</FormLabel>
                <Select 
                  onValueChange={field.onChange} 
                  defaultValue={field.value}
                  disabled={isLoading}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un statut" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="en_cours">En cours</SelectItem>
                    <SelectItem value="livré">Livré</SelectItem>
                    <SelectItem value="client_absent">Client absent</SelectItem>
                    <SelectItem value="annulé">Annulé</SelectItem>
                    <SelectItem value="renvoyé">Renvoyé</SelectItem>
                    <SelectItem value="pickup">Au bureau</SelectItem>
                    <SelectItem value="expedition">Expédition</SelectItem>
                    <SelectItem value="injoignable">Injoignable</SelectItem>
                    <SelectItem value="ne_decroche_pas">Ne décroche pas</SelectItem>
                    <SelectItem value="present_ne_decroche_zone1">CPCNDP Z1</SelectItem>
                    <SelectItem value="present_ne_decroche_zone2">CPCNDP Z2</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>
                  Statut actuel de la livraison
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Transporteur (for expeditions) */}
          <FormField
            control={form.control}
            name="carrier"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Transporteur</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="Nom du transporteur" 
                    {...field} 
                    disabled={isLoading}
                  />
                </FormControl>
                <FormDescription>
                  Transporteur (pour expéditions)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Instructions */}
        <FormField
          control={form.control}
          name="instructions"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Instructions</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Instructions spéciales pour la livraison" 
                  {...field} 
                  disabled={isLoading}
                  rows={2}
                />
              </FormControl>
              <FormDescription>
                Notes ou instructions particulières
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Form Actions */}
        <div className="flex justify-end gap-3 pt-4">
          {onCancel && (
            <Button 
              type="button" 
              variant="outline" 
              onClick={onCancel}
              disabled={isLoading}
            >
              Annuler
            </Button>
          )}
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isEditMode ? "Enregistrer" : "Créer la livraison"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

