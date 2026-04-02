import { useState, useCallback } from "react";
import { Sun, CalendarCheck, Users, Fingerprint, ArrowRight, Check } from "lucide-react";

interface OnboardingSlidesProps {
  onComplete: () => void;
}

const SLIDES = [
  {
    icon: Sun,
    color: "#1A9B7D",
    bg: "#E0F2F1",
    title: "Día a Día",
    subtitle: "Todo lo de tu mascota, en un solo lugar",
    description: "Registrá síntomas, seguí el ánimo y recibí orientación personalizada. Pessy organiza la información para que vos solo te ocupes de querer.",
  },
  {
    icon: CalendarCheck,
    color: "#3B82F6",
    bg: "#EFF6FF",
    title: "Rutinas",
    subtitle: "Citas, medicamentos y recordatorios",
    description: "Nunca más un turno olvidado ni una dosis salteada. Pessy te avisa lo justo y lo importante.",
  },
  {
    icon: Users,
    color: "#F59E0B",
    bg: "#FFFBEB",
    title: "Comunidad",
    subtitle: "Perdidos, encontrados y adopción",
    description: "Una red de tutores que se ayudan. Publicá alertas, encontrá mascotas y conectá con otros dueños cerca tuyo.",
  },
  {
    icon: Fingerprint,
    color: "#8B5CF6",
    bg: "#F5F3FF",
    title: "Identidad Digital",
    subtitle: "El perfil único de tu mascota",
    description: "Historial clínico, vacunas, co-tutores y QR. Todo verificable, todo en un lugar seguro.",
  },
];

export function OnboardingSlides({ onComplete }: OnboardingSlidesProps) {
  const [current, setCurrent] = useState(0);
  const slide = SLIDES[current];
  const isLast = current === SLIDES.length - 1;

  const handleNext = useCallback(() => {
    if (isLast) {
      onComplete();
    } else {
      setCurrent((c) => c + 1);
    }
  }, [isLast, onComplete]);

  const handleSkip = useCallback(() => {
    onComplete();
  }, [onComplete]);

  return (
    <div
      className="fixed inset-0 z-[90] flex flex-col bg-white"
      style={{ fontFamily: "'Manrope', sans-serif" }}
    >
      {/* Skip button */}
      <div className="flex justify-end px-5 pt-5">
        <button
          onClick={handleSkip}
          className="text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors px-3 py-1.5 rounded-lg"
        >
          Saltar
        </button>
      </div>

      {/* Slide content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 max-w-md mx-auto w-full">
        {/* Icon */}
        <div
          className="size-28 rounded-[32px] flex items-center justify-center mb-8 shadow-[0_8px_32px_rgba(0,0,0,0.08)]"
          style={{ background: slide.bg }}
        >
          <slide.icon size={48} strokeWidth={1.5} color={slide.color} />
        </div>

        {/* Text */}
        <h2
          className="text-3xl font-black text-[#074738] text-center tracking-tight"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          {slide.title}
        </h2>
        <p className="text-base font-bold text-[#1A9B7D] text-center mt-2">
          {slide.subtitle}
        </p>
        <p className="text-sm text-slate-500 text-center mt-4 leading-relaxed max-w-xs">
          {slide.description}
        </p>
      </div>

      {/* Bottom controls */}
      <div className="px-8 pb-10 pt-4 max-w-md mx-auto w-full">
        {/* Dots */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {SLIDES.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === current
                  ? "w-8 bg-[#074738]"
                  : i < current
                    ? "w-3 bg-[#1A9B7D]"
                    : "w-3 bg-slate-200"
              }`}
            />
          ))}
        </div>

        {/* CTA button */}
        <button
          onClick={handleNext}
          className="w-full py-4 rounded-[14px] bg-[#074738] text-white font-bold text-base flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(26,155,125,0.3)] hover:bg-[#0a6b54] active:scale-[0.98] transition-all"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          {isLast ? (
            <>
              Empezar <Check size={18} strokeWidth={2.5} />
            </>
          ) : (
            <>
              Siguiente <ArrowRight size={18} strokeWidth={2.5} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
