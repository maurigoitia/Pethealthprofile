import React from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Stethoscope, Syringe, Pill, Scissors, HeartPulse } from "lucide-react";
import { usePet } from "../../contexts/PetContext";
import { useMedical } from "../../contexts/MedicalContext";
import { TreatingVetsList } from "../medical/TreatingVetsList";

interface Props {
  onBack: () => void;
}

interface HealthDimension {
  icon: React.ReactNode;
  label: string;
  status: "ok" | "warning" | "alert" | "unknown";
  detail: string;
}

const STATUS_CONFIG = {
  ok:      { bg: "#ECFDF5", text: "#065F46", dot: "#10B981", label: "Programado" },
  warning: { bg: "#FFFBEB", text: "#92400E", dot: "#F59E0B", label: "Próximo" },
  alert:   { bg: "#FEF2F2", text: "#991B1B", dot: "#EF4444", label: "Atención" },
  unknown: { bg: "#F1F5F9", text: "#475569", dot: "#94A3B8", label: "Sin datos" },
};

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function CuidadosScreen({ onBack }: Props) {
  const navigate = useNavigate();
  const { activePet } = usePet();
  const { activeMedications, appointments, getClinicalConditionsByPetId } = useMedical();

  // ── Condiciones clínicas reales del pet (del pipeline de diagnósticos) ──
  const petConditions = activePet?.id ? getClinicalConditionsByPetId(activePet.id) : [];
  const activeConditions = petConditions.filter(
    (c) => c.status === "active" || c.status === "monitoring"
  );

  const petName = activePet?.name ?? "Tu mascota";

  // ── Vacunas: buscar próxima cita tipo vaccine ──
  // No tenemos un registro real de vacunas aplicadas (solo appointments programados),
  // así que NO podemos afirmar "al día". Mostramos estado real o "sin datos".
  const nextVaccineAppt = appointments
    .filter((a) => a.status === "upcoming" && a.type === "vaccine" && a.date)
    .sort((a, b) => (a.date! > b.date! ? 1 : -1))[0];
  const vaccineStatus: HealthDimension["status"] = !nextVaccineAppt
    ? "unknown"
    : daysUntil(nextVaccineAppt.date)! <= 7
    ? "alert"
    : daysUntil(nextVaccineAppt.date)! <= 30
    ? "warning"
    : "ok";
  const vaccineDetail = nextVaccineAppt
    ? `Próxima en ${daysUntil(nextVaccineAppt.date)} días`
    : "Sin información de vacunas registrada";

  // ── Control médico: próxima cita general ──
  const nextAppt = appointments
    .filter((a) => a.status === "upcoming" && a.type !== "vaccine" && a.date)
    .sort((a, b) => (a.date! > b.date! ? 1 : -1))[0];
  const apptDays = nextAppt ? daysUntil(nextAppt.date) : null;
  const apptStatus: HealthDimension["status"] = apptDays == null
    ? "unknown"
    : apptDays <= 3
    ? "alert"
    : apptDays <= 14
    ? "warning"
    : "ok";
  const apptDetail = nextAppt
    ? apptDays === 0
      ? "¡Hoy!"
      : `En ${apptDays} días`
    : "Sin turnos programados";

  // ── Medicamentos activos ──
  const activeMeds = activeMedications.filter(
    (m) => !activePet?.id || m.petId === activePet.id
  );
  const medStatus: HealthDimension["status"] = activeMeds.length === 0 ? "ok" : "warning";
  const medDetail =
    activeMeds.length === 0
      ? "Sin medicación activa"
      : activeMeds.length === 1
      ? activeMeds[0].name
      : `${activeMeds.length} medicamentos activos`;

  // ── Grooming: aún no tenemos registro real, mostramos como sin datos ──
  const groomingStatus: HealthDimension["status"] = "unknown";
  const groomingDetail = "Sin registro de grooming";

  const dimensions: HealthDimension[] = [
    { icon: <Syringe size={18} strokeWidth={1.8} />,     label: "Vacunas",         status: vaccineStatus, detail: vaccineDetail },
    { icon: <Stethoscope size={18} strokeWidth={1.8} />, label: "Control médico",  status: apptStatus,    detail: apptDetail },
    { icon: <Pill size={18} strokeWidth={1.8} />,        label: "Medicamentos",    status: medStatus,     detail: medDetail },
    { icon: <Scissors size={18} strokeWidth={1.8} />,    label: "Grooming",        status: groomingStatus, detail: groomingDetail },
  ];

  const hasAlert    = dimensions.some((d) => d.status === "alert");
  const hasWarning  = dimensions.some((d) => d.status === "warning");
  const allUnknown  = dimensions.every((d) => d.status === "unknown");
  const overall: "alert" | "warning" | "ok" | "unknown" = hasAlert
    ? "alert"
    : hasWarning
    ? "warning"
    : allUnknown
    ? "unknown"
    : "ok";

  const overallConfig = {
    // "ok" solo cuando hay al menos un dato real y nada en alerta/warning.
    ok:      { emoji: "🙂", headline: `Cuidados de ${petName}`,           sub: "No vemos pendientes próximos en lo que tenemos cargado.",        bg: "#ECFDF5" },
    warning: { emoji: "🙂", headline: `Atendé estos puntos de ${petName}`, sub: "Hay un par de cosas a tener en cuenta.",                          bg: "#FFFBEB" },
    alert:   { emoji: "😟", headline: `${petName} necesita atención`,    sub: "Hay items que requieren acción pronto.",                          bg: "#FEF2F2" },
    unknown: { emoji: "📋", headline: `Empecemos con ${petName}`,         sub: "Sumá información para ver el estado real de sus cuidados.",       bg: "#F1F5F9" },
  }[overall];

  return (
    <div
      className="min-h-screen pb-24"
      style={{ backgroundColor: "#F0FAF9", fontFamily: "'Manrope', sans-serif" }}
    >
      {/* Header — Stitch sticky con título grande */}
      <div className="sticky top-0 z-40 bg-[#F0FAF9]/85 backdrop-blur-md px-4 pt-4 pb-3">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Volver"
            className="size-11 rounded-full bg-white flex items-center justify-center border border-[#E5E7EB] transition-all active:scale-[0.96] shrink-0"
            style={{ boxShadow: "0 1px 3px rgba(7,71,56,0.04)" }}
          >
            <ArrowLeft size={18} color="#074738" />
          </button>
          <h1
            className="flex-1 text-[22px] font-extrabold text-[#074738] leading-tight"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "-0.02em" }}
          >
            Bienestar
          </h1>
        </div>
      </div>

      <div className="px-4 max-w-md mx-auto" style={{ display: "flex", flexDirection: "column", gap: 20, paddingTop: 8 }}>

        {/* ── Estado general ── */}
        <div style={{ borderRadius: 20, padding: "24px 20px", backgroundColor: overallConfig.bg, display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 52, lineHeight: 1 }}>{overallConfig.emoji}</span>
          <div>
            <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 17, fontWeight: 800, color: "#0F172A", lineHeight: 1.2 }}>
              {overallConfig.headline}
            </p>
            <p style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>{overallConfig.sub}</p>
          </div>
        </div>

        {/* ── Empty state Stitch cuando no hay datos reales ── */}
        {allUnknown && activeConditions.length === 0 && appointments.filter((a) => a.status === "upcoming" && a.date).length === 0 && (
          <div className="bg-white rounded-[16px] border border-[rgba(7,71,56,0.08)] shadow-[0_2px_8px_rgba(0,0,0,0.04)] py-10 px-6 text-center">
            <div className="w-24 h-24 rounded-full bg-[#E0F2F1] flex items-center justify-center mx-auto mb-5">
              <HeartPulse size={40} color="#1A9B7D" strokeWidth={1.8} />
            </div>
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-[#1A9B7D]/10 border border-[#1A9B7D]/20 mb-4">
              <span
                className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#1A9B7D]"
                style={{ fontFamily: "Manrope, sans-serif" }}
              >
                Cuidados
              </span>
            </div>
            <h2
              className="text-2xl font-extrabold text-[#074738] mb-2 leading-tight"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Empecemos a cargar info
            </h2>
            <p
              className="text-sm text-[#6B7280] max-w-[280px] mx-auto leading-relaxed"
              style={{ fontFamily: "Manrope, sans-serif" }}
            >
              Sumá vacunas, turnos o medicación para ver el estado real de los cuidados de {petName}.
            </p>
          </div>
        )}

        {/* ── Dimensiones de salud ── */}
        <div>
          <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 10, fontWeight: 800, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 10 }}>
            Áreas de salud
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {dimensions.map((dim) => {
              const cfg = STATUS_CONFIG[dim.status];
              return (
                <div key={dim.label} style={{ backgroundColor: cfg.bg, borderRadius: 16, padding: "14px", display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,.7)", display: "flex", alignItems: "center", justifyContent: "center", color: cfg.text }}>
                      {dim.icon}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: cfg.text, backgroundColor: "rgba(255,255,255,.6)", padding: "3px 8px", borderRadius: 99 }}>
                      {cfg.label}
                    </span>
                  </div>
                  <div>
                    <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{dim.label}</p>
                    <p style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>{dim.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Próximos turnos ── */}
        {appointments.filter((a) => a.status === "upcoming" && a.date).length > 0 && (
          <div>
            <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 10, fontWeight: 800, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 10 }}>
              Próximos turnos
            </p>
            {appointments
              .filter((a) => a.status === "upcoming" && a.date)
              .sort((a, b) => (a.date! > b.date! ? 1 : -1))
              .slice(0, 3)
              .map((appt) => {
                const days = daysUntil(appt.date);
                return (
                  <div key={appt.id} style={{ backgroundColor: "#fff", borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, marginBottom: 10, boxShadow: "0 2px 8px rgba(0,0,0,.04)", border: "1px solid rgba(7,71,56,0.08)" }}>
                    <div style={{ width: 40, height: 40, minWidth: 40, borderRadius: "50%", backgroundColor: "#E0F2F1", display: "flex", alignItems: "center", justifyContent: "center", color: "#1A9B7D" }}>
                      <Stethoscope size={18} strokeWidth={1.8} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#1E293B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {appt.title || "Turno médico"}
                      </p>
                      <p style={{ fontSize: 11, color: "#94A3B8" }}>
                        {appt.date} {appt.time ? `· ${appt.time}` : ""}
                      </p>
                    </div>
                    {days != null && (
                      <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: days <= 3 ? "#EF4444" : days <= 14 ? "#F59E0B" : "#10B981", backgroundColor: days <= 3 ? "#FEF2F2" : days <= 14 ? "#FFFBEB" : "#ECFDF5", padding: "3px 8px", borderRadius: 99 }}>
                          {days === 0 ? "¡Hoy!" : `${days}d`}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}

        {/* ── Basado en la historia de {pet} — condiciones reales del pipeline ── */}
        {activeConditions.length > 0 && (
          <div>
            <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 10, fontWeight: 800, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 10 }}>
              Basado en la historia de {petName}
            </p>
            <div style={{ backgroundColor: "#fff", borderRadius: 16, padding: "14px 16px", boxShadow: "0 2px 8px rgba(0,0,0,.04)", border: "1px solid rgba(7,71,56,.06)" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                {activeConditions.map((c) => (
                  <span
                    key={c.id}
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#074738",
                      backgroundColor: "#E0F2F1",
                      padding: "5px 10px",
                      borderRadius: 99,
                      textTransform: "capitalize",
                    }}
                  >
                    {c.normalizedName}
                    {c.pattern === "recurrent" || c.pattern === "chronic"
                      ? ` · ${c.pattern === "recurrent" ? "recurrente" : "crónica"}`
                      : ""}
                  </span>
                ))}
              </div>
              <p style={{ fontSize: 12, color: "#64748B", lineHeight: 1.4 }}>
                Seguimiento recomendado: {activeConditions.map((c) => c.normalizedName).join(", ")}.
              </p>
            </div>
          </div>
        )}

        {/* ── Vets que trataron a esta mascota ── */}
        <TreatingVetsList />

        {/* ── Buscar vet — pill Stitch ── */}
        <button
          type="button"
          onClick={() => navigate("/buscar-vet")}
          className="w-full rounded-full bg-[#074738] hover:bg-[#0e5c49] text-white text-sm font-bold shadow-[0_4px_14px_rgba(7,71,56,0.18)] active:scale-[0.97] transition-transform"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", padding: "14px 24px", minHeight: 48 }}
        >
          Buscar veterinario
        </button>

      </div>
    </div>
  );
}
