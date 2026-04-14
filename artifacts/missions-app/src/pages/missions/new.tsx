import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Save, Loader2, Users } from "lucide-react";
import { useCreateMission, useListEmployees } from "@workspace/api-client-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

const missionSchema = z.object({
  title: z.string().min(5, "Le titre doit faire au moins 5 caractères"),
  needsExpression: z.string().min(10, "Expression des besoins requise"),
  actionPlan: z.string().min(10, "Plan d'action requis"),
  startDate: z.string().min(1, "Date de début requise"),
  endDate: z.string().min(1, "Date de fin requise"),
  destination: z.string().min(2, "Destination requise"),
  requiresFuel: z.boolean().default(false),
  requiresVehicle: z.boolean().default(false),
  vehicleCount: z.coerce.number().min(0).default(0),
  employeeIds: z.array(z.number()).min(1, "Au moins un employé est requis"),
});

type MissionFormValues = z.infer<typeof missionSchema>;

export default function MissionNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [employeeSearch, setEmployeeSearch] = useState("");
  
  const createMission = useCreateMission({
    mutation: {
      onSuccess: (data) => {
        toast({
          title: "Mission créée",
          description: "La mission a été enregistrée avec succès.",
        });
        setLocation(`/missions/${data.id}`);
      },
      onError: (err: any) => {
        toast({
          title: "Erreur",
          description: err?.error || "Une erreur est survenue lors de la création.",
          variant: "destructive",
        });
      }
    }
  });

  const { data: employeesData, isLoading: employeesLoading } = useListEmployees({ 
    search: employeeSearch || undefined,
    limit: 20 
  });

  const form = useForm<MissionFormValues>({
    resolver: zodResolver(missionSchema),
    defaultValues: {
      title: "",
      needsExpression: "",
      actionPlan: "",
      startDate: "",
      endDate: "",
      destination: "",
      requiresFuel: false,
      requiresVehicle: false,
      vehicleCount: 0,
      employeeIds: [],
    },
  });

  const requiresVehicle = form.watch("requiresVehicle");
  const selectedEmployeeIds = form.watch("employeeIds");

  const onSubmit = (data: MissionFormValues) => {
    // Basic date validation
    if (new Date(data.endDate) < new Date(data.startDate)) {
      form.setError("endDate", { message: "La date de fin doit être après la date de début" });
      return;
    }
    
    createMission.mutate({ data });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/missions">
          <Button variant="outline" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nouvelle Mission</h1>
          <p className="text-muted-foreground">Remplissez les informations pour créer une nouvelle demande de mission.</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Informations Générales</CardTitle>
              <CardDescription>
                Détails de base concernant la mission et la destination.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Titre de la mission</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Inspection technique des installations à Nouadhibou" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="destination"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Destination</FormLabel>
                      <FormControl>
                        <Input placeholder="Ville, Wilaya..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date de début</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date de fin</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Justification et Objectifs</CardTitle>
              <CardDescription>
                Décrivez les raisons et le plan de cette mission.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="needsExpression"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expression des besoins</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Expliquez pourquoi cette mission est nécessaire..." 
                        className="min-h-[100px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="actionPlan"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Plan d'action</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Décrivez les actions qui seront entreprises lors de cette mission..." 
                        className="min-h-[100px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Employés Assignés</CardTitle>
              <CardDescription>
                Sélectionnez les personnes qui participeront à cette mission.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="employeeIds"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Employés</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="w-full justify-between"
                          >
                            {selectedEmployeeIds.length > 0
                              ? `${selectedEmployeeIds.length} employé(s) sélectionné(s)`
                              : "Sélectionner des employés..."}
                            <Users className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0" align="start">
                        <Command shouldFilter={false}>
                          <CommandInput 
                            placeholder="Rechercher un employé..." 
                            value={employeeSearch}
                            onValueChange={setEmployeeSearch}
                          />
                          <CommandList>
                            <CommandEmpty>
                              {employeesLoading ? "Chargement..." : "Aucun employé trouvé."}
                            </CommandEmpty>
                            <CommandGroup>
                              {employeesData?.data.map((employee) => (
                                <CommandItem
                                  key={employee.id}
                                  value={employee.id.toString()}
                                  onSelect={() => {
                                    const current = new Set(field.value);
                                    if (current.has(employee.id)) {
                                      current.delete(employee.id);
                                    } else {
                                      current.add(employee.id);
                                    }
                                    field.onChange(Array.from(current));
                                  }}
                                >
                                  <div className="flex items-center gap-2 flex-1">
                                    <Checkbox 
                                      checked={field.value?.includes(employee.id)}
                                      className="pointer-events-none"
                                    />
                                    <div className="flex flex-col">
                                      <span>{employee.fullName}</span>
                                      <span className="text-xs text-muted-foreground">{employee.position} ({employee.matricule})</span>
                                    </div>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                    {selectedEmployeeIds.length > 0 && (
                      <div className="mt-4 p-4 border rounded-md bg-muted/20">
                        <h4 className="text-sm font-medium mb-2">Sélection ({selectedEmployeeIds.length})</h4>
                        <div className="flex flex-wrap gap-2">
                          {selectedEmployeeIds.map(id => {
                            // Find employee details from available data or just show ID if not currently in view
                            const emp = employeesData?.data.find(e => e.id === id);
                            return (
                              <div key={id} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded flex items-center gap-1">
                                {emp ? emp.fullName : `ID: ${id}`}
                                <button 
                                  type="button"
                                  onClick={() => field.onChange(field.value.filter(v => v !== id))}
                                  className="text-primary hover:text-primary/70 font-bold ml-1"
                                >
                                  ×
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Logistique</CardTitle>
              <CardDescription>
                Besoins en véhicules et carburant.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="requiresVehicle"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        Nécessite un ou plusieurs véhicules SOMELEC
                      </FormLabel>
                      <FormDescription>
                        Cochez cette case si la mission requiert des véhicules de l'entreprise.
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              {requiresVehicle && (
                <div className="pl-7">
                  <FormField
                    control={form.control}
                    name="vehicleCount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre de véhicules requis</FormLabel>
                        <FormControl>
                          <Input type="number" min="1" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              <FormField
                control={form.control}
                name="requiresFuel"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        Nécessite une dotation en carburant
                      </FormLabel>
                      <FormDescription>
                        Cochez cette case si du carburant doit être fourni.
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Link href="/missions">
              <Button type="button" variant="outline">Annuler</Button>
            </Link>
            <Button type="submit" disabled={createMission.isPending}>
              {createMission.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Création en cours...</>
              ) : (
                <><Save className="w-4 h-4 mr-2" /> Créer la mission</>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
