import { CheckCircle2, Circle, XCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type MissionStatus =
  | "draft"
  | "pending_director"
  | "pending_central_director"
  | "pending_technical_control"
  | "pending_dga"
  | "pending_dmg"
  | "en_vigueur"
  | "pending_cad_payment"
  | "pending_financial_control"
  | "approved"
  | "rejected";

interface Step {
  status: string;
  label: string;
  sublabel: string;
}

const ALL_STEPS: Step[] = [
  { status: "draft",                     label: "Création",        sublabel: "Brouillon" },
  { status: "pending_director",          label: "Directeur",       sublabel: "Validation" },
  { status: "pending_central_director",  label: "Dir. Central",    sublabel: "Validation" },
  { status: "pending_technical_control", label: "Ctrl. Tech.",     sublabel: "Validation" },
  { status: "pending_dga",               label: "DGA",             sublabel: "Validation" },
  { status: "pending_dmg",               label: "DMG",             sublabel: "Véhicules" },
  { status: "en_vigueur",                label: "CAD Édition",     sublabel: "Ordre de mission" },
  { status: "pending_cad_payment",       label: "CAD Paiement",    sublabel: "Avance 70%" },
  { status: "pending_financial_control", label: "Ctrl. Financier", sublabel: "Solde 30%" },
  { status: "approved",                  label: "Approuvée",       sublabel: "Mission validée" },
];

const STATUS_ORDER = ALL_STEPS.map((s) => s.status);

type StepState = "done" | "current" | "future" | "rejected";

interface Props {
  status: MissionStatus;
  validatedStatuses?: string[];
}

export function MissionWorkflowStepper({ status, validatedStatuses = [] }: Props) {
  const isRejected = status === "rejected";
  const currentIdx = STATUS_ORDER.indexOf(status);

  return (
    <div className="w-full overflow-x-auto pb-1">
      <div className="flex items-start min-w-max">
        {ALL_STEPS.map((step, idx) => {
          const isLast = idx === ALL_STEPS.length - 1;
          const stepIdx = STATUS_ORDER.indexOf(step.status);

          let state: StepState;
          if (isRejected) {
            if (validatedStatuses.includes(step.status)) {
              const lastValidated = validatedStatuses[validatedStatuses.length - 1];
              state = lastValidated === step.status ? "rejected" : "done";
            } else {
              state = "future";
            }
          } else {
            if (stepIdx < currentIdx) state = "done";
            else if (stepIdx === currentIdx) state = "current";
            else state = "future";
          }

          return (
            <div key={step.status} className="flex items-start">
              {/* Step */}
              <div className="flex flex-col items-center w-20 sm:w-24">
                {/* Icon */}
                <div className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all",
                  state === "done"     && "bg-emerald-500 border-emerald-500 text-white",
                  state === "current"  && "bg-white border-amber-500 text-amber-500",
                  state === "future"   && "bg-white border-muted-foreground/30 text-muted-foreground/40",
                  state === "rejected" && "bg-red-500 border-red-500 text-white",
                )}>
                  {state === "done"     && <CheckCircle2 className="w-5 h-5" />}
                  {state === "current"  && <Loader2 className="w-4 h-4 animate-spin" />}
                  {state === "future"   && <Circle className="w-4 h-4" />}
                  {state === "rejected" && <XCircle className="w-5 h-5" />}
                </div>

                {/* Labels */}
                <div className="mt-2 text-center">
                  <div className={cn(
                    "text-[11px] font-semibold leading-tight",
                    state === "done"     && "text-emerald-600",
                    state === "current"  && "text-amber-600",
                    state === "future"   && "text-muted-foreground/50",
                    state === "rejected" && "text-red-600",
                  )}>
                    {step.label}
                  </div>
                  <div className={cn(
                    "text-[10px] leading-tight mt-0.5",
                    state === "done"     && "text-emerald-500/80",
                    state === "current"  && "text-amber-500/80",
                    state === "future"   && "text-muted-foreground/40",
                    state === "rejected" && "text-red-500/80",
                  )}>
                    {step.sublabel}
                  </div>
                </div>
              </div>

              {/* Connector line */}
              {!isLast && (
                <div className="flex items-center mt-4 w-4 sm:w-6 flex-shrink-0">
                  <div className={cn(
                    "h-0.5 w-full transition-colors",
                    state === "done" ? "bg-emerald-400" : "bg-muted-foreground/20"
                  )} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
