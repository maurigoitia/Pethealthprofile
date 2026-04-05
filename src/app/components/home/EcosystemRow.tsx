import { useRef } from "react";
import { Home, Footprints, ShoppingCart, Heart, CreditCard } from "lucide-react";

export interface EcosystemRowProps {
  onRutinasClick?: () => void;
  onPaseosClick?: () => void;
  onComprarClick?: () => void;
  onSaludClick?: () => void;
  onTarjetaClick?: () => void;
}

export function EcosystemRow({
  onRutinasClick,
  onPaseosClick,
  onComprarClick,
  onSaludClick,
  onTarjetaClick,
}: EcosystemRowProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const pillars = [
    {
      id: "rutinas",
      label: "Rutinas",
      emoji: "🏠",
      icon: Home,
      status: "active",
      onClick: onRutinasClick,
      description: "Día a día",
    },
    {
      id: "paseos",
      label: "Paseos",
      emoji: "🐾",
      icon: Footprints,
      status: "beta",
      onClick: onPaseosClick,
      description: "En desarrollo",
    },
    {
      id: "comprar",
      label: "Comprar",
      emoji: "🛒",
      icon: ShoppingCart,
      status: "coming",
      onClick: onComprarClick,
      description: "Próximamente",
    },
    {
      id: "salud",
      label: "Salud",
      emoji: "❤️",
      icon: Heart,
      status: "active",
      onClick: onSaludClick,
      description: "Veterinarios",
    },
    {
      id: "tarjeta",
      label: "Tarjeta",
      emoji: "💳",
      icon: CreditCard,
      status: "future",
      onClick: onTarjetaClick,
      description: "Próximamente",
    },
  ];

  const getStatusStyles = (status: string) => {
    switch (status) {
      case "active":
        return "border-[#074738] text-[#074738]";
      case "beta":
        return "border-amber-400 text-amber-600";
      case "coming":
        return "border-gray-200 text-gray-400";
      case "future":
        return "border-gray-200 text-gray-400";
      default:
        return "border-slate-200 text-slate-600";
    }
  };

  const getBadgeStyles = (status: string) => {
    switch (status) {
      case "beta":
        return "bg-amber-100 text-amber-700";
      case "coming":
      case "future":
        return "bg-gray-100 text-gray-600";
      default:
        return "";
    }
  };

  const getBadgeText = (status: string) => {
    if (status === "beta") return "BETA";
    if (status === "coming" || status === "future") return "Pronto";
    return "";
  };

  return (
    <div className="px-4 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
        Ecosistema Pessy
      </h3>

      {/* Horizontal scrollable container */}
      <div
        ref={scrollContainerRef}
        className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide"
        style={{
          scrollBehavior: "smooth",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {pillars.map((pillar) => {
          const Icon = pillar.icon;
          const badge = getBadgeText(pillar.status);
          const isDisabled = pillar.status === "coming" || pillar.status === "future";

          return (
            <button
              key={pillar.id}
              onClick={pillar.onClick}
              disabled={isDisabled}
              className={`
                flex items-center gap-2 px-4 py-2.5 rounded-full border-2
                whitespace-nowrap font-semibold text-sm
                transition-all duration-200 flex-shrink-0
                ${getStatusStyles(pillar.status)}
                ${isDisabled ? "opacity-60 cursor-not-allowed" : "hover:scale-105"}
                bg-white dark:bg-slate-800
              `}
            >
              <Icon size={16} />
              <span>{pillar.label}</span>
              {badge && (
                <span
                  className={`
                    px-1.5 py-0.5 rounded text-xs font-bold
                    ${getBadgeStyles(pillar.status)}
                  `}
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
