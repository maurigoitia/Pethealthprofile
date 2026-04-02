/**
 * MedicalDisclaimer — Required disclaimer for Google Play health app compliance.
 * Must appear on all screens that show medical/health information.
 */
import { ShieldAlert } from "lucide-react";
import { Link } from "react-router";

interface MedicalDisclaimerProps {
  compact?: boolean;
}

export function MedicalDisclaimer({ compact = false }: MedicalDisclaimerProps) {
  if (compact) {
    return (
      <p className="text-[11px] text-slate-400 text-center leading-relaxed px-4 py-2">
        Pessy brinda orientación general. No reemplaza un veterinario.{" "}
        <Link to="/legal#terminos" className="underline text-[#1A9B7D]">
          Ver términos
        </Link>
      </p>
    );
  }

  return (
    <div className="mx-4 mb-4 rounded-2xl border border-amber-100 bg-amber-50/50 px-4 py-3 flex items-start gap-3">
      <ShieldAlert size={18} className="text-amber-600 shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-xs font-bold text-amber-800 leading-relaxed">
          Pessy brinda orientación general sobre el cuidado de tu mascota. No diagnostica, no receta y no reemplaza la consulta con un veterinario profesional.
        </p>
        <Link
          to="/legal#terminos"
          className="text-[11px] font-semibold text-[#1A9B7D] underline underline-offset-2 mt-1 inline-block"
        >
          Ver términos y condiciones
        </Link>
      </div>
    </div>
  );
}
