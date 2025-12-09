/**
 * Delivery Form Component
 * Form for creating and editing deliveries with validation
 */

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
  statut: z.enum(["en_cours", "livré", "échec", "pickup", "expedition"]).optional(),
  instructions: z.string().optional(),
  carrier: z.string().optional(),
});

type DeliveryFormValues = z.infer<typeof deliveryFormSchema>;

interface DeliveryFormProps {
  delivery?: FrontendDelivery;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function DeliveryForm({ delivery, onSuccess, onCancel }: DeliveryFormProps) {
  const isEditMode = !!delivery;
  const createMutation = useCreateDelivery();
  const updateMutation = useUpdateDelivery();

  const form = useForm<DeliveryFormValues>({
    resolver: zodResolver(deliveryFormSchema),
    defaultValues: delivery ? {
      telephone: delivery.telephone,
      quartier: delivery.quartier,
      produits: delivery.produits,
      montant_total: delivery.montant_total,
      montant_encaisse: delivery.montant_encaisse,
      statut: delivery.statut,
      instructions: delivery.instructions,
      carrier: delivery.carrier || undefined,
    } : {
      telephone: "",
      quartier: "",
      produits: "",
      montant_total: 0,
      montant_encaisse: 0,
      statut: "en_cours",
      instructions: "",
      carrier: undefined,
    },
  });

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
                    <SelectItem value="échec">Échec</SelectItem>
                    <SelectItem value="pickup">Pickup</SelectItem>
                    <SelectItem value="expedition">Expédition</SelectItem>
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

