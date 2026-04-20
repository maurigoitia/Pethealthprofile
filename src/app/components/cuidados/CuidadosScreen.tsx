import { useNavigate } from "react-router";
import { ChevronLeft, Stethoscope, Droplets, Activity, Star } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  onBack: () => void;
}

interface MockVet {
  id: string;
  name: string;
  specialty: string;
  rating: number;
}

interface Recommendation {
  icon: React.ReactNode;
  title: string;
  description: string;
  cta: string;
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const WELLBEING_SCORE = 72;
const PET_NAME = "Luna";

const MOCK_VETS: MockVet[] = [
  { id: "v1", name: "Dra. Laura Méndez", specialty: "Medicina General", rating: 4.9 },
  { id: "v2", name: "Dr. Carlos Ibáñez", specialty: "Dermatología", rating: 4.7 },
];

// ---------------------------------------------------------------------------
// Score helpers
// ---------------------------------------------------------------------------

function getScoreColor(score: number): string {
  if (score >= 70) return "#10B981";
  if (score >= 40) return "#F59E0B";
  return "#EF4444";
}

function getScoreLabel(score: number): string {
  if (score >= 70) return "Excelente";
  if (score >= 40) return "Regular";
  return "Necesita atención";
}

// ---------------------------------------------------------------------------
// CuidadosScreen
// ---------------------------------------------------------------------------

export function CuidadosScreen({ onBack }: Props) {
  const navigate = useNavigate();

  const scoreColor = getScoreColor(WELLBEING_SCORE);
  const scoreLabel = getScoreLabel(WELLBEING_SCORE);

  const recommendations: Recommendation[] = [
    {
      icon: <Stethoscope size={18} style={{ color: "#1A9B7D" }} />,
      title: "Vacunación al día",
      description: "Todas las vacunas de Luna están al día. ¡Excelente!",
      cta: "Ver más",
    },
    {
      icon: <Activity size={18} style={{ color: "#1A9B7D" }} />,
      title: "Turno de control recomendado",
      description: "Se recomienda un chequeo preventivo en los próximos 30 días.",
      cta: "Ver más",
    },
    {
      icon: <Droplets size={18} style={{ color: "#1A9B7D" }} />,
      title: "Hidratación y alimentación",
      description: "Asegurate de que tenga agua fresca disponible siempre.",
      cta: "Ver más",
    },
  ];

  return (
    <div
      className="min-h-screen pb-24 px-4"
      style={{ backgroundColor: "#F0FAF9", fontFamily: "'Manrope', sans-serif" }}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-10 flex items-center gap-3 py-3 -mx-4 px-4 border-b border-slate-100"
        style={{ backgroundColor: "#ffffff" }}
      >
        <button
          type="button"
          onClick={onBack}
          aria-label="Volver"
          className="flex items-center justify-center rounded-full hover:bg-slate-100 active:bg-slate-200 transition-colors"
          style={{ width: 44, height: 44, minWidth: 44 }}
        >
          <ChevronLeft size={22} style={{ color: "#074738" }} />
        </button>
        <h1
          className="text-lg font-bold"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#074738" }}
        >
          Bienestar
        </h1>
      </header>

      {/* Semáforo card */}
      <div
        className="mt-4 rounded-[16px] p-5"
        style={{ backgroundColor: "#ffffff", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
      >
        <p className="text-sm text-slate-500 mb-2">Estado general de {PET_NAME}</p>
        <div className="flex items-end gap-3 mb-1">
          <span
            className="text-5xl font-black leading-none"
            style={{ color: scoreColor }}
          >
            {WELLBEING_SCORE}
          </span>
          <span className="text-base text-slate-400 mb-1">/100</span>
        </div>
        <p className="text-sm font-semibold mb-3" style={{ color: scoreColor }}>
          {scoreLabel}
        </p>
        {/* Progress bar */}
        <div
          className="h-3 rounded-full overflow-hidden"
          style={{ backgroundColor: "#E0F2F1" }}
        >
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${WELLBEING_SCORE}%`, backgroundColor: scoreColor }}
          />
        </div>
      </div>

      {/* Recomendaciones */}
      <section className="mt-6">
        <p
          className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          Recomendaciones
        </p>
        {recommendations.map((rec) => (
          <div
            key={rec.title}
            className="rounded-[16px] p-4 mb-3 flex items-start gap-3"
            style={{ backgroundColor: "#ffffff", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
          >
            <div
              className="flex items-center justify-center rounded-[10px] shrink-0"
              style={{
                width: 40,
                height: 40,
                minWidth: 40,
                backgroundColor: "#E0F2F1",
              }}
            >
              {rec.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800">{rec.title}</p>
              <p className="text-xs text-slate-500 mt-0.5">{rec.description}</p>
            </div>
            <button
              type="button"
              className="shrink-0 text-xs font-semibold transition-colors"
              style={{ color: "#1A9B7D", minHeight: 44, paddingLeft: 8 }}
            >
              {rec.cta}
            </button>
          </div>
        ))}
      </section>

      {/* Veterinarios cerca */}
      <section className="mt-6">
        <p
          className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          Veterinarios cerca
        </p>
        {MOCK_VETS.map((vet) => (
          <div
            key={vet.id}
            className="rounded-[16px] p-4 mb-3 flex items-center gap-3"
            style={{ backgroundColor: "#ffffff", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
          >
            <div
              className="rounded-full shrink-0 flex items-center justify-center"
              style={{
                width: 40,
                height: 40,
                minWidth: 40,
                backgroundColor: "#E0F2F1",
              }}
            >
              <span className="text-lg font-bold" style={{ color: "#1A9B7D" }}>
                {vet.name[0]}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{vet.name}</p>
              <p className="text-xs text-slate-500">{vet.specialty}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Star size={12} className="text-amber-500 fill-amber-500" />
              <span className="text-xs font-semibold text-amber-500">{vet.rating}</span>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => navigate("/buscar-vet")}
          className="w-full py-3 rounded-[12px] text-sm font-semibold border transition-colors active:opacity-80"
          style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            color: "#074738",
            borderColor: "#074738",
            minHeight: 44,
          }}
        >
          Ver más veterinarios
        </button>
      </section>

      {/* Alertas */}
      <section className="mt-6">
        <p
          className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          Alertas
        </p>
        {/* Empty state */}
        <div
          className="rounded-[16px] p-6 flex flex-col items-center text-center"
          style={{ backgroundColor: "#ffffff", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
        >
          <span className="text-3xl mb-2">🎉</span>
          <p className="text-sm font-semibold text-slate-700">Todo en orden</p>
          <p className="text-xs text-slate-400 mt-1">No hay alertas pendientes para {PET_NAME}.</p>
        </div>
      </section>
    </div>
  );
}
