import { useState, useEffect } from "react";
import {
  Sparkles,
  ArrowLeft,
  AlertCircle,
  Search,
  FileSearch,
  Zap,
  CheckCircle2,
  ShieldAlert,
  Pill,
  QrCode,
} from "lucide-react";
import { usePet } from "../../contexts/PetContext";
import { useMedical } from "../../contexts/MedicalContext";

interface IdentidadScreenProps {
  onBack: () => void;
}

const GENERATION_STEPS = [
  { icon: Search, label: "Analizando historial completo..." },
  { icon: FileSearch, label: "Cruzando estudios médicos (OCR)" },
  { icon: Zap, label: "Simplificando términos técnicos" },
  { icon: CheckCircle2, label: "Estructurando resumen ejecutivo" },
];

export function IdentidadScreen({ onBack }: IdentidadScreenProps) {
  const [state, setState] = useState<"intro" | "generating" | "report">("intro");
  const [generationStep, setGenerationStep] = useState(0);

  const { activePet } = usePet();
  const { events } = useMedical();

  const petName = activePet?.name || "tu mascota";
  const eventCount = events.filter((e) => !(e as { deletedAt?: unknown }).deletedAt).length;

  useEffect(() => {
    if (state !== "generating") return;

    setGenerationStep(0);

    const interval = setInterval(() => {
      setGenerationStep((prev) => {
        if (prev < GENERATION_STEPS.length - 1) return prev + 1;
        clearInterval(interval);
        return prev;
      });
    }, 900);

    const timer = setTimeout(() => {
      setState("report");
    }, 900 * GENERATION_STEPS.length + 500);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [state]);

  return (
    <div
      className="min-h-screen bg-[#F0FAF9] flex flex-col max-w-md mx-auto"
      style={{ fontFamily: "'Manrope', sans-serif" }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-12 pb-4">
        <button
          type="button"
          onClick={onBack}
          className="size-10 rounded-full bg-white border border-slate-200 shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex items-center justify-center text-slate-700 active:scale-95 transition-transform"
          aria-label="Volver"
        >
          <ArrowLeft size={18} />
        </button>
        <h1
          className="flex-1 text-lg font-bold text-[#074738]"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          Identidad Digital
        </h1>
        <span className="flex items-center gap-1 bg-[#1A9B7D] text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
          <Sparkles size={10} />
          IA
        </span>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* STATE: intro                                                        */}
      {/* ------------------------------------------------------------------ */}
      {state === "intro" && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6 pb-8">
          {/* Icon square */}
          <div
            className="size-24 rounded-[24px] flex items-center justify-center shadow-[0_8px_24px_rgba(7,71,56,0.25)]"
            style={{ background: "linear-gradient(135deg, #074738, #1A9B7D)" }}
          >
            <Sparkles size={48} color="white" />
          </div>

          {/* Heading */}
          <div className="text-center space-y-2">
            <h2
              className="text-2xl font-bold text-[#074738]"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              ¿Actualizamos la ficha de {petName}?
            </h2>
            <p className="text-sm text-slate-500 max-w-xs mx-auto leading-relaxed">
              Analizamos el historial para consolidar un resumen médico claro.
            </p>
          </div>

          {/* Warning card */}
          <div className="w-full rounded-[12px] bg-amber-50 border border-amber-200 p-4 flex gap-3">
            <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Este resumen usa solo datos confirmados. Pessy organiza, no reemplaza al veterinario.
            </p>
          </div>

          {/* CTA */}
          <button
            type="button"
            onClick={() => setState("generating")}
            className="w-full bg-[#074738] text-white rounded-[14px] py-4 font-bold text-base shadow-[0_4px_12px_rgba(26,155,125,0.3)] active:scale-[0.97] transition-transform"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Generar Perfil Médico ✦
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* STATE: generating                                                   */}
      {/* ------------------------------------------------------------------ */}
      {state === "generating" && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-8 pb-8">
          {/* Spinner */}
          <div className="size-16 rounded-full border-4 border-[#074738]/20 border-t-[#074738] animate-spin" />

          {/* Steps */}
          <div className="w-full space-y-3">
            {GENERATION_STEPS.map((step, index) => {
              const Icon = step.icon;
              const isActive = index === generationStep;
              const isDone = index < generationStep;
              const isPending = index > generationStep;

              return (
                <div
                  key={step.label}
                  className="flex items-center gap-3 transition-opacity duration-500"
                  style={{
                    opacity: isPending ? 0 : 1,
                    transitionDelay: `${index * 400}ms`,
                  }}
                >
                  <div
                    className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isActive
                        ? "bg-[#074738]/10 text-[#074738]"
                        : isDone
                        ? "bg-[#074738]/10 text-[#074738]"
                        : "bg-slate-100 text-slate-300"
                    }`}
                  >
                    <Icon size={16} />
                  </div>
                  <span
                    className={`text-[13px] font-bold ${
                      isActive
                        ? "text-[#074738]"
                        : isDone
                        ? "text-slate-400"
                        : "text-slate-300"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* STATE: report                                                       */}
      {/* ------------------------------------------------------------------ */}
      {state === "report" && (
        <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-4 pt-2">
          {/* Hero card */}
          <div
            className="rounded-[16px] p-6 text-white relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, #074738, #1A9B7D)" }}
          >
            {/* Decorative circle */}
            <div className="absolute -top-8 -right-8 size-32 rounded-full bg-white/5" />
            <div className="absolute -bottom-6 -left-4 size-24 rounded-full bg-white/5" />

            <p className="text-[10px] text-white/60 uppercase font-bold tracking-wider mb-3">
              ✦ Resumen generado
            </p>
            <h3
              className="text-xl font-bold leading-snug mb-4 relative z-10"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              {petName} presenta condiciones crónicas estables bajo tratamiento activo.
            </h3>
            <div className="flex items-center justify-between relative z-10">
              <span className="text-[11px] text-white/60">
                Basado en {eventCount} eventos · Actualizado hoy
              </span>
              <button
                type="button"
                className="bg-white/20 rounded-[10px] px-3 py-1.5 text-[10px] font-bold flex items-center gap-1.5 active:scale-95 transition-transform"
              >
                <QrCode size={12} />
                Compartir con vet
              </button>
            </div>
          </div>

          {/* Condiciones card */}
          <div className="bg-white rounded-[16px] p-5 border border-slate-200 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-2 mb-4">
              <ShieldAlert size={16} className="text-red-500" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Condiciones registradas
              </span>
            </div>
            <div className="space-y-3">
              {[
                {
                  label: "Cardiomiopatía dilatada fase oculta",
                  sub: "En tratamiento",
                  dot: "bg-red-400",
                },
                {
                  label: "Displasia articular",
                  sub: "Manejo del dolor",
                  dot: "bg-red-400",
                },
                {
                  label: "Alergia a proteína animal",
                  sub: "",
                  dot: "bg-amber-400",
                },
              ].map((item) => (
                <div key={item.label} className="flex gap-3">
                  <div className={`size-2 rounded-full mt-1.5 shrink-0 ${item.dot}`} />
                  <div>
                    <p className="text-sm font-bold text-slate-800">{item.label}</p>
                    {item.sub && (
                      <p className="text-[11px] text-slate-400 mt-0.5">{item.sub}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pautas card */}
          <div className="bg-white rounded-[16px] p-5 border border-slate-200 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-2 mb-4">
              <Pill size={16} className="text-[#1A9B7D]" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Pautas de cuidado
              </span>
            </div>
            <div className="space-y-3">
              {[
                {
                  label: "Pimobendan 5mg · cada 12hs",
                  sub: "Ayuda a la fuerza del corazón.",
                },
                {
                  label: "Evitar ejercicio de alto impacto",
                  sub: "Por condición articular y cardíaca.",
                },
              ].map((item) => (
                <div key={item.label} className="flex gap-3">
                  <div className="size-8 rounded-xl bg-[#E0F2F1] flex items-center justify-center shrink-0">
                    <CheckCircle2 size={16} className="text-[#1A9B7D]" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{item.label}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{item.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Reset button */}
          <button
            type="button"
            onClick={() => {
              setGenerationStep(0);
              setState("intro");
            }}
            className="text-[10px] font-bold text-slate-400 uppercase w-full text-center py-4 active:text-slate-600 transition-colors"
          >
            Volver a generar
          </button>
        </div>
      )}
    </div>
  );
}
