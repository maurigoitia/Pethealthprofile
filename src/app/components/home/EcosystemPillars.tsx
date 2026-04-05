import { useNavigate } from "react-router";
import { MaterialIcon } from "../shared/MaterialIcon";
import { toast } from "sonner";

interface EcosystemPillar {
  id: string;
  label: string;
  icon: string;
  status: "active" | "new" | "upcoming";
  statusLabel: string;
  action: () => void;
}

export function EcosystemPillars() {
  const navigate = useNavigate();

  const handleComingSoon = () => {
    toast.success("Próximamente en Pessy 🐾");
  };

  const pillars: EcosystemPillar[] = [
    {
      id: "rutinas",
      label: "Rutinas",
      icon: "activity",
      status: "active",
      statusLabel: "Activo",
      action: () => {
        // Already on home, no-op
      },
    },
    {
      id: "paseos",
      label: "Paseos",
      icon: "footprints",
      status: "new",
      statusLabel: "Nuevo",
      action: () => {
        handleComingSoon();
      },
    },
    {
      id: "comprar",
      label: "Comprar",
      icon: "shopping_cart",
      status: "upcoming",
      statusLabel: "Próximo",
      action: handleComingSoon,
    },
    {
      id: "salud",
      label: "Salud",
      icon: "favorite",
      status: "active",
      statusLabel: "Beta",
      action: () => {
        // Navigate to health/appointments
        navigate("/?review=appointments");
      },
    },
    {
      id: "tarjeta",
      label: "Tarjeta",
      icon: "credit_card",
      status: "upcoming",
      statusLabel: "Pronto",
      action: handleComingSoon,
    },
  ];

  return (
    <div className="mx-3 mt-3 overflow-x-auto pb-2 scrollbar-hide">
      <div className="flex gap-2 pb-1">
        {pillars.map((pillar) => {
          const isActive = pillar.status === "active";
          const isNew = pillar.status === "new";
          const isUpcoming = pillar.status === "upcoming";

          return (
            <button
              key={pillar.id}
              onClick={pillar.action}
              className={`shrink-0 flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-2xl transition-all active:scale-95 ${
                isActive
                  ? "bg-[#074738] text-white shadow-md"
                  : isNew
                    ? "bg-green-50 border border-green-200 text-green-900"
                    : "bg-white border border-slate-200 text-slate-500"
              }`}
              style={isActive ? { boxShadow: "0 4px 12px rgba(7,71,56,0.15)" } : {}}
            >
              <MaterialIcon
                name={pillar.icon}
                className={`!text-base ${
                  isActive ? "text-white" : isNew ? "text-green-700" : "text-slate-400"
                }`}
              />
              <div className="flex flex-col items-center gap-0.5">
                <p className={`text-[9px] font-bold uppercase tracking-widest ${
                  isActive ? "text-white" : isNew ? "text-green-900" : "text-slate-500"
                }`}>
                  {pillar.label}
                </p>
                <p className={`text-[7px] font-semibold ${
                  isActive ? "text-white/70" : isNew ? "text-green-600" : "text-slate-400"
                }`}>
                  {pillar.statusLabel}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
