import { useMemo } from "react";
import { CalendarCheck, Pill, Bell, Syringe, ChevronRight } from "lucide-react";
import { MedicalDisclaimer } from "../shared/MedicalDisclaimer";
import { usePet } from "../../contexts/PetContext";
import { useMedical } from "../../contexts/MedicalContext";
import { useReminders } from "../../contexts/RemindersContext";

interface RutinasHubProps {
  onNavigate: (screen: "appointments" | "medications" | "reminders" | "feed") => void;
}

export function RutinasHub({ onNavigate }: RutinasHubProps) {
  const { activePetId, activePet } = usePet();
  const { getAppointmentsByPetId, getActiveMedicationsByPetId, getEventsByPetId } = useMedical();
  const { getPendingCount } = useReminders();

  const petName = activePet?.name || "tu mascota";

  // ── Data ──
  const appointments = useMemo(() => {
    if (!activePetId) return [];
    return getAppointmentsByPetId(activePetId)
      .filter((a) => {
        const d = new Date(a.date);
        return d >= new Date(new Date().toDateString());
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 3);
  }, [activePetId, getAppointmentsByPetId]);

  const activeMeds = useMemo(() => {
    if (!activePetId) return [];
    return getActiveMedicationsByPetId(activePetId);
  }, [activePetId, getActiveMedicationsByPetId]);

  const pendingReminders = useMemo(() => {
    if (!activePetId) return 0;
    return getPendingCount(activePetId);
  }, [activePetId, getPendingCount]);

  const vaccineEvents = useMemo(() => {
    if (!activePetId) return { total: 0, upcoming: 0 };
    const events = getEventsByPetId(activePetId);
    const vaccines = events.filter((e) => e.documentType === "vaccine" || e.documentType === "vaccination");
    const now = new Date();
    const upcoming = vaccines.filter((v) => {
      if (!v.extractedData?.nextDoseDate) return false;
      const next = new Date(v.extractedData.nextDoseDate as string);
      const diff = (next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return diff >= 0 && diff <= 30;
    });
    return { total: vaccines.length, upcoming: upcoming.length };
  }, [activePetId, getEventsByPetId]);

  // ── Section config ──
  const sections = [
    {
      id: "appointments" as const,
      icon: CalendarCheck,
      label: "Citas",
      color: "#1A9B7D",
      bgColor: "#E0F2F1",
      count: appointments.length,
      countLabel: appointments.length === 1 ? "próxima" : "próximas",
      detail: appointments.length > 0
        ? appointments.map((a) => {
            const d = new Date(a.date);
            const day = d.toLocaleDateString("es", { day: "numeric", month: "short" });
            return `${day} — ${a.title || a.reason || "Cita"}`;
          })
        : ["Sin citas programadas"],
      empty: appointments.length === 0,
    },
    {
      id: "medications" as const,
      icon: Pill,
      label: "Medicamentos",
      color: "#3B82F6",
      bgColor: "#EFF6FF",
      count: activeMeds.length,
      countLabel: activeMeds.length === 1 ? "activo" : "activos",
      detail: activeMeds.length > 0
        ? activeMeds.slice(0, 3).map((m) => m.name || "Medicamento")
        : ["Sin medicamentos activos"],
      empty: activeMeds.length === 0,
    },
    {
      id: "reminders" as const,
      icon: Bell,
      label: "Recordatorios",
      color: "#F59E0B",
      bgColor: "#FFFBEB",
      count: pendingReminders,
      countLabel: pendingReminders === 1 ? "pendiente" : "pendientes",
      detail: pendingReminders > 0
        ? [`${pendingReminders} recordatorio${pendingReminders > 1 ? "s" : ""} por completar`]
        : ["Todo al día"],
      empty: pendingReminders === 0,
    },
    {
      id: "feed" as const,
      icon: Syringe,
      label: "Vacunas",
      color: "#8B5CF6",
      bgColor: "#F5F3FF",
      count: vaccineEvents.total,
      countLabel: "registradas",
      detail: vaccineEvents.upcoming > 0
        ? [`${vaccineEvents.upcoming} vacuna${vaccineEvents.upcoming > 1 ? "s" : ""} próxima${vaccineEvents.upcoming > 1 ? "s" : ""}`]
        : vaccineEvents.total > 0
          ? ["Vacunas al día"]
          : ["Sin vacunas registradas"],
      empty: vaccineEvents.total === 0,
    },
  ];

  return (
    <div className="min-h-screen pb-28" style={{ background: "#F0FAF9", fontFamily: "'Manrope', sans-serif" }}>
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="px-5 pt-14 pb-6 rounded-b-[28px] relative overflow-hidden" style={{ background: "linear-gradient(135deg, #074738 0%, #0a6b54 100%)" }}>
          <div className="absolute -right-16 -top-16 w-[200px] h-[200px] rounded-[42%_58%_65%_35%/52%_45%_55%_48%] bg-white/5 blur-xl pointer-events-none" />
          <div className="absolute -left-12 bottom-0 w-[160px] h-[160px] rounded-[58%_42%_35%_65%/45%_52%_48%_55%] bg-white/5 blur-xl pointer-events-none" />
          <div className="relative z-10">
            <p className="text-white/70 text-sm">Rutinas de</p>
            <h1 className="text-2xl font-black text-white" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{petName}</h1>
            <p className="text-white/50 text-xs mt-1">Medicamentos, citas, vacunas y recordatorios</p>
          </div>
          {/* Quick stats */}
          <div className="relative z-10 grid grid-cols-3 gap-3 mt-5">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 text-center border border-white/5">
              <p className="text-2xl font-black text-white">{activeMeds.length}</p>
              <p className="text-white/60 text-[10px] font-semibold">Medicamentos</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 text-center border border-white/5">
              <p className="text-2xl font-black text-[#1A9B7D]">{appointments.length}</p>
              <p className="text-white/60 text-[10px] font-semibold">Citas</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 text-center border border-white/5">
              <p className="text-2xl font-black text-white">{pendingReminders}</p>
              <p className="text-white/60 text-[10px] font-semibold">Pendientes</p>
            </div>
          </div>
        </div>

        {/* Section cards */}
        <div className="px-5 mt-5 space-y-3">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => onNavigate(s.id)}
              aria-label={s.label}
              className="w-full bg-white rounded-2xl p-4 border border-[rgba(0,0,0,0.04)] shadow-[0_2px_8px_rgba(0,0,0,0.04)] text-left active:translate-y-[-1px] transition-all duration-150"
            >
              <div className="flex items-start gap-3.5">
                <div className="size-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: s.bgColor }}>
                  <s.icon size={20} strokeWidth={1.8} color={s.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-bold text-sm text-slate-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{s.label}</h3>
                    {!s.empty && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${s.color}15`, color: s.color }}>
                        {s.count} {s.countLabel}
                      </span>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    {s.detail.map((line, i) => (
                      <p key={i} className={`text-xs leading-relaxed ${s.empty ? "text-slate-400 italic" : "text-slate-600"}`}>{line}</p>
                    ))}
                  </div>
                </div>
                <ChevronRight size={18} className="text-slate-300 shrink-0 mt-1" />
              </div>
            </button>
          ))}
        </div>

        {/* Timeline link */}
        <div className="px-5 mt-4">
          <button
            onClick={() => onNavigate("feed")}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#E0F2F1] text-[#074738] text-sm font-bold transition-all active:scale-[0.98]"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Ver timeline clínico completo
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Medical disclaimer — required for Google Play / App Store */}
        <div className="mt-6">
          <MedicalDisclaimer compact />
        </div>
      </div>
    </div>
  );
}
