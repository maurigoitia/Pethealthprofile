import { useNavigate } from "react-router";
import { ChevronLeft, Star, Stethoscope, Syringe, Pill, Scissors } from "lucide-react";

interface Props {
  onBack: () => void;
}

interface HealthDimension {
  icon: React.ReactNode;
  label: string;
  status: "ok" | "warning" | "alert";
  detail: string;
}

interface MockVet {
  id: string;
  name: string;
  specialty: string;
  rating: number;
}

const PET_NAME = "Luna";

const MOCK_VETS: MockVet[] = [
  { id: "v1", name: "Dra. Laura Méndez", specialty: "Medicina General", rating: 4.9 },
  { id: "v2", name: "Dr. Carlos Ibáñez", specialty: "Dermatología", rating: 4.7 },
];

const STATUS_CONFIG = {
  ok:      { bg: "#ECFDF5", text: "#065F46", dot: "#10B981", label: "Al día" },
  warning: { bg: "#FFFBEB", text: "#92400E", dot: "#F59E0B", label: "Próximo" },
  alert:   { bg: "#FEF2F2", text: "#991B1B", dot: "#EF4444", label: "Atención" },
};

export function CuidadosScreen({ onBack }: Props) {
  const navigate = useNavigate();

  const dimensions: HealthDimension[] = [
    {
      icon: <Syringe size={18} strokeWidth={1.8} />,
      label: "Vacunas",
      status: "ok",
      detail: "Todas al día",
    },
    {
      icon: <Stethoscope size={18} strokeWidth={1.8} />,
      label: "Control médico",
      status: "warning",
      detail: "Chequeo en 30 días",
    },
    {
      icon: <Pill size={18} strokeWidth={1.8} />,
      label: "Medicamentos",
      status: "ok",
      detail: "Rimadyl activo",
    },
    {
      icon: <Scissors size={18} strokeWidth={1.8} />,
      label: "Grooming",
      status: "alert",
      detail: "Hace 6 semanas",
    },
  ];

  // Derive overall state from dimensions
  const hasAlert   = dimensions.some((d) => d.status === "alert");
  const hasWarning = dimensions.some((d) => d.status === "warning");
  const overall    = hasAlert ? "alert" : hasWarning ? "warning" : "ok";

  const overallConfig = {
    ok:      { emoji: "😊", headline: `${PET_NAME} está muy bien`, sub: "Todo en orden. Seguí así.", color: "#10B981", bg: "#ECFDF5" },
    warning: { emoji: "🙂", headline: `${PET_NAME} está bien`, sub: "Hay un par de cosas a tener en cuenta.", color: "#F59E0B", bg: "#FFFBEB" },
    alert:   { emoji: "😟", headline: `${PET_NAME} necesita atención`, sub: "Hay items que requieren acción.", color: "#EF4444", bg: "#FEF2F2" },
  }[overall];

  return (
    <div
      className="min-h-screen pb-24"
      style={{ backgroundColor: "#F0FAF9", fontFamily: "'Manrope', sans-serif" }}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-10 flex items-center gap-3 px-4 border-b border-slate-100"
        style={{ backgroundColor: "#ffffff", height: 56 }}
      >
        <button
          type="button"
          onClick={onBack}
          aria-label="Volver"
          style={{ width: 44, height: 44, minWidth: 44, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", color: "#074738" }}
        >
          <ChevronLeft size={22} />
        </button>
        <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 18, fontWeight: 700, color: "#074738" }}>
          Bienestar
        </h1>
      </header>

      <div className="px-4" style={{ display: "flex", flexDirection: "column", gap: 20, paddingTop: 16 }}>

        {/* ── Estado general ── */}
        <div
          style={{
            borderRadius: 20,
            padding: "24px 20px",
            backgroundColor: overallConfig.bg,
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <span style={{ fontSize: 52, lineHeight: 1 }}>{overallConfig.emoji}</span>
          <div>
            <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 17, fontWeight: 800, color: "#0F172A", lineHeight: 1.2 }}>
              {overallConfig.headline}
            </p>
            <p style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>{overallConfig.sub}</p>
          </div>
        </div>

        {/* ── Dimensiones de salud ── */}
        <div>
          <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 10, fontWeight: 800, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 10 }}>
            Áreas de salud
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {dimensions.map((dim) => {
              const cfg = STATUS_CONFIG[dim.status];
              return (
                <div
                  key={dim.label}
                  style={{
                    backgroundColor: cfg.bg,
                    borderRadius: 16,
                    padding: "14px 14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
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

        {/* ── Veterinarios cerca ── */}
        <div>
          <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 10, fontWeight: 800, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 10 }}>
            Veterinarios cerca
          </p>
          {MOCK_VETS.map((vet) => (
            <div
              key={vet.id}
              style={{ backgroundColor: "#fff", borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, marginBottom: 10, boxShadow: "0 2px 8px rgba(0,0,0,.04)" }}
            >
              <div style={{ width: 40, height: 40, minWidth: 40, borderRadius: "50%", backgroundColor: "#E0F2F1", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, color: "#1A9B7D" }}>
                {vet.name[0]}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#1E293B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{vet.name}</p>
                <p style={{ fontSize: 11, color: "#94A3B8" }}>{vet.specialty}</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                <Star size={12} className="text-amber-500 fill-amber-500" />
                <span style={{ fontSize: 11, fontWeight: 600, color: "#F59E0B" }}>{vet.rating}</span>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => navigate("/buscar-vet")}
            style={{ width: "100%", border: "2px solid #074738", background: "none", color: "#074738", borderRadius: 12, padding: "12px", fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 600, cursor: "pointer", minHeight: 44 }}
          >
            Ver más veterinarios
          </button>
        </div>

      </div>
    </div>
  );
}
