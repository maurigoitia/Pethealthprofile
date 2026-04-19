import { useNavigate } from "react-router";
import { ChevronLeft, MapPin, Tag, PlusCircle, Activity } from "lucide-react";
import { usePet } from "../../contexts/PetContext";
import { useMedical } from "../../contexts/MedicalContext";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAge(birthdate: string | undefined | null): string {
  if (!birthdate) return "";
  const birth = new Date(birthdate);
  const now = new Date();
  const months =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth());
  if (months < 1) return "Recién nacido";
  if (months < 12) return `${months} ${months === 1 ? "mes" : "meses"}`;
  const years = Math.floor(months / 12);
  return `${years} ${years === 1 ? "año" : "años"}`;
}

function todayLabel(): string {
  return new Date().toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="text-base font-bold text-[#074738] mb-3"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {children}
    </h2>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`bg-white rounded-[16px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-4 ${className}`}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RutinasHub
// ---------------------------------------------------------------------------

export function RutinasHub({ onBack }: Props) {
  const navigate = useNavigate();
  const { activePet } = usePet();
  const { activeMedications } = useMedical();

  const petName = activePet?.name ?? "tu mascota";
  const petMeds = activePet
    ? activeMedications.filter((m) => m.petId === activePet.id)
    : [];

  const ageLabel = formatAge(activePet?.birthdate);
  const tags = [
    ageLabel,
    activePet?.breed,
    activePet?.species === "dog" ? "Perro" : activePet?.species === "cat" ? "Gato" : activePet?.species,
  ].filter(Boolean) as string[];

  return (
    <div
      className="min-h-screen bg-[#F0FAF9] pb-28"
      style={{ fontFamily: "'Manrope', sans-serif" }}
    >
      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-20 bg-[#F0FAF9] border-b border-[#E0F2F1]">
        <div className="max-w-md mx-auto flex items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Volver"
            className="flex items-center justify-center w-11 h-11 rounded-full hover:bg-[#E0F2F1] transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-[#074738]" />
          </button>
          <h1
            className="text-lg font-bold text-[#074738]"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Rutinas
          </h1>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 pt-5 space-y-6">
        {/* ── Section 1: Hoy ── */}
        <section>
          <SectionTitle>Hoy</SectionTitle>
          <Card>
            <p
              className="text-sm font-semibold text-[#074738] capitalize"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              {todayLabel()}
            </p>
            <p className="text-sm text-slate-600 mt-1">
              Buen día, <span className="font-semibold text-[#1A9B7D]">{petName}</span>. Acá vas a ver las actividades y recomendaciones de hoy.
            </p>

            {/* Location signal */}
            <div className="mt-3 flex items-start gap-2 rounded-[12px] bg-[#F0FAF9] px-3 py-2">
              <MapPin className="w-4 h-4 text-[#1A9B7D] mt-0.5 shrink-0" />
              <p className="text-xs text-slate-500">
                Configurá tu ubicación para recomendaciones personalizadas
              </p>
            </div>
          </Card>
        </section>

        {/* ── Section 2: Hábitos y preferencias ── */}
        <section>
          <SectionTitle>Hábitos y preferencias</SectionTitle>
          <Card>
            {tags.length > 0 ? (
              <div className="flex flex-wrap gap-2 mb-3">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#E0F2F1] text-xs font-semibold text-[#074738]"
                  >
                    <Tag className="w-3 h-3" />
                    {tag}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 mb-3">Sin datos de perfil cargados.</p>
            )}

            <button
              type="button"
              onClick={() => navigate("/perfil")}
              className="text-sm font-semibold text-[#1A9B7D] hover:underline transition-all min-h-[44px] flex items-center"
            >
              Completar preferencias →
            </button>
          </Card>
        </section>

        {/* ── Section 3: Actividades de hoy (empty state) ── */}
        <section>
          <SectionTitle>Actividades de hoy</SectionTitle>
          <Card className="flex flex-col items-center text-center py-6 gap-3">
            <div className="w-12 h-12 rounded-full bg-[#E0F2F1] flex items-center justify-center">
              <Activity className="w-5 h-5 text-[#1A9B7D]" />
            </div>
            <p className="text-sm text-slate-500 max-w-[220px]">
              Las recomendaciones personalizadas se activan cuando tengamos más información sobre{" "}
              <span className="font-semibold text-[#074738]">{petName}</span>.
            </p>
            <button
              type="button"
              onClick={() => navigate("/perfil")}
              className="mt-1 inline-flex items-center gap-2 px-5 py-2.5 rounded-[12px] bg-[#074738] text-white text-sm font-bold min-h-[44px] shadow-[0_4px_12px_rgba(26,155,125,0.25)] active:scale-[0.97] transition-transform"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              <PlusCircle className="w-4 h-4" />
              Agregar información
            </button>
          </Card>
        </section>

        {/* ── Section 4: Rutinas activas (real data) ── */}
        <section>
          <SectionTitle>Rutinas activas</SectionTitle>
          {petMeds.length === 0 ? (
            <Card>
              <p className="text-sm text-slate-400">Sin rutinas activas.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {petMeds.map((med) => (
                <Card key={med.id}>
                  <p
                    className="text-sm font-bold text-[#074738]"
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                  >
                    {med.name}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {med.dosage} · {med.frequency}
                  </p>
                  {med.type && (
                    <span className="mt-2 inline-block px-2 py-0.5 rounded-full bg-[#E0F2F1] text-xs text-[#1A9B7D] font-semibold">
                      {med.type}
                    </span>
                  )}
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* ── Footer note ── */}
        <p className="text-xs text-slate-400 text-center pb-2">
          Rutinas aprende de los hábitos de tu mascota para darte sugerencias cada vez más útiles.
        </p>
      </div>
    </div>
  );
}
