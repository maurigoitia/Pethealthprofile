import { useNavigate } from "react-router";
import { ChevronLeft, Stethoscope, Droplets, Activity, AlertTriangle, Star } from "lucide-react";
import { usePet } from "../../contexts/PetContext";
import { useMedical } from "../../contexts/MedicalContext";

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

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_VETS: MockVet[] = [
  { id: "v1", name: "Dra. Laura Méndez", specialty: "Medicina General", rating: 4.9 },
  { id: "v2", name: "Dr. Carlos Ibáñez", specialty: "Dermatología", rating: 4.7 },
];

// ---------------------------------------------------------------------------
// Score helpers
// ---------------------------------------------------------------------------

function getScoreColor(score: number): string {
  if (score >= 80) return "text-[#1A9B7D]";
  if (score >= 50) return "text-amber-500";
  return "text-red-500";
}

function getScoreBarColor(score: number): string {
  if (score >= 80) return "bg-[#1A9B7D]";
  if (score >= 50) return "bg-amber-500";
  return "bg-red-500";
}

function getScoreLabel(score: number): string {
  if (score >= 80) return "Excelente";
  if (score >= 50) return "Atención requerida";
  return "Crítico";
}

// ---------------------------------------------------------------------------
// CuidadosScreen
// ---------------------------------------------------------------------------

export function CuidadosScreen({ onBack }: Props) {
  const navigate = useNavigate();
  const { activePet } = usePet();
  const { activeMedications, getActiveMedicationsByPetId, events } = useMedical();

  const petId = activePet?.id ?? "";
  const petName = activePet?.name ?? "Tu mascota";
  const hasPhoto = Boolean(activePet?.photo);

  // ── Score calculation ──────────────────────────────────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const petMedications = petId ? getActiveMedicationsByPetId(petId) : activeMedications;

  const hasMedicationOverdue = petMedications.some((med) => {
    if (!med.endDate) return false;
    const end = new Date(med.endDate);
    end.setHours(0, 0, 0, 0);
    return end < today;
  });

  const hasVaccineOverdue = events
    .filter((e) => e.petId === petId && e.type === "vaccine")
    .some((e) => {
      const revac = e.vaccineRevaccinationDate ?? null;
      if (!revac) return false;
      const d = new Date(revac);
      d.setHours(0, 0, 0, 0);
      return d < today;
    });

  let score = 80;
  if (hasMedicationOverdue) score -= 10;
  if (hasVaccineOverdue) score -= 15;
  if (hasPhoto) score += 5;
  score = Math.min(100, Math.max(0, score));

  // ── Alerts ────────────────────────────────────────────────────────────
  const alerts: string[] = [];
  if (hasMedicationOverdue) alerts.push("Hay medicamentos con fecha de fin vencida.");
  if (hasVaccineOverdue) alerts.push("Hay vacunas con fecha de revacunación vencida.");

  // ── Recommendations (static + context-aware) ─────────────────────────
  const recommendations = [
    {
      icon: <Stethoscope size={18} className="text-[#1A9B7D]" />,
      title: "Chequeo preventivo",
      description: "Tu mascota no tiene consultas recientes.",
    },
    {
      icon: <Droplets size={18} className="text-[#1A9B7D]" />,
      title: "Hidratación diaria",
      description: "Asegurate de que tenga agua fresca siempre.",
    },
    {
      icon: <Activity size={18} className="text-[#1A9B7D]" />,
      title: "Actividad física",
      description: "30 min de ejercicio mejoran el bienestar.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#F0FAF9] pb-24" style={{ fontFamily: "'Manrope', sans-serif" }}>
      {/* Sticky header */}
      <header className="sticky top-0 z-10 bg-white border-b border-slate-100 flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="size-9 flex items-center justify-center rounded-full hover:bg-slate-100 active:bg-slate-200 transition-colors"
          aria-label="Volver"
        >
          <ChevronLeft size={22} className="text-[#074738]" />
        </button>
        <h1
          className="text-lg font-bold text-[#074738]"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          Bienestar
        </h1>
      </header>

      {/* Wellbeing Score card */}
      <div className="mx-4 mt-4 bg-white rounded-[20px] shadow-[0_2px_12px_rgba(0,0,0,0.06)] p-5">
        <p className="text-sm text-slate-500 mb-2">Estado general de {petName}</p>
        <div className="flex items-end gap-3 mb-1">
          <span className={`text-5xl font-black leading-none ${getScoreColor(score)}`}>{score}</span>
          <span className="text-base text-slate-400 mb-1">/100</span>
        </div>
        <p className={`text-sm font-semibold mb-3 ${getScoreColor(score)}`}>{getScoreLabel(score)}</p>
        <div className="h-3 rounded-full bg-[#E0F2F1] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${getScoreBarColor(score)}`}
            style={{ width: `${score}%` }}
          />
        </div>
      </div>

      {/* Recommendations */}
      <section className="mt-6 px-4">
        <p
          className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          Recomendaciones
        </p>
        {recommendations.map((rec) => (
          <div
            key={rec.title}
            className="bg-white rounded-[16px] p-4 mb-3 flex items-start gap-3 shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
          >
            <div className="size-10 rounded-[10px] bg-[#E0F2F1] flex items-center justify-center shrink-0">
              {rec.icon}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">{rec.title}</p>
              <p className="text-xs text-slate-500 mt-0.5">{rec.description}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Veterinarians nearby */}
      <section className="mt-6 px-4">
        <p
          className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          Veterinarios cerca
        </p>
        {MOCK_VETS.map((vet) => (
          <div
            key={vet.id}
            className="bg-white rounded-[16px] p-4 mb-3 flex items-center gap-3 shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
          >
            <div className="size-10 bg-[#E0F2F1] rounded-full shrink-0 flex items-center justify-center">
              <span className="text-lg font-bold text-[#1A9B7D]">{vet.name[0]}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{vet.name}</p>
              <p className="text-xs text-slate-500">{vet.specialty}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Star size={12} className="text-amber-500 fill-amber-500" />
              <span className="text-xs text-amber-500 font-semibold">{vet.rating}</span>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => navigate("/buscar-vet")}
          className="border border-[#074738] text-[#074738] rounded-[12px] py-2.5 w-full mt-3 text-sm font-semibold active:bg-[#E0F2F1] transition-colors"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          Ver más veterinarios
        </button>
      </section>

      {/* Alerts */}
      {alerts.length > 0 && (
        <section className="mt-6 px-4 pb-2">
          <p
            className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Alertas
          </p>
          {alerts.map((alert) => (
            <div
              key={alert}
              className="border-l-4 border-amber-400 bg-amber-50 rounded-r-[12px] p-3 mb-3 flex items-start gap-2"
            >
              <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">{alert}</p>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
