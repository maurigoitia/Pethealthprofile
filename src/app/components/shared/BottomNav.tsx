import { Home, MapPin, Plus, Fingerprint, Users2 } from "lucide-react";
import { isFocusExperienceHost } from "../../utils/runtimeFlags";

export type PillarTab = "inicio" | "explorar" | "comunidad" | "mi-pessy";

interface BottomNavProps {
  currentTab: PillarTab;
  onTabChange: (tab: PillarTab) => void;
  onAddDocument?: () => void;
  /** @deprecated Use onTabChange("comunidad") instead */
  onNavigate?: (screen: "lost-pets" | "explore") => void;
}

export function BottomNav({ currentTab, onTabChange, onAddDocument }: BottomNavProps) {
  const focusExperienceEnabled = isFocusExperienceHost();

  const iconSize = 22;
  const strokeWidth = 1.8;

  const TABS: { id: PillarTab; label: string; Icon: typeof Sun }[] = [
    { id: "inicio",     label: "Inicio",     Icon: Home },
    { id: "explorar",   label: "Explorar",   Icon: MapPin },
    { id: "comunidad",  label: "Comunidad",  Icon: Users2 },
    { id: "mi-pessy",   label: "Mi Pessy",   Icon: Fingerprint },
  ];

  if (focusExperienceEnabled) {
    return (
      <nav className="fixed inset-x-0 bottom-4 z-40 pessy-fade-up" style={{ animationDelay: '200ms' }}>
        <div className="max-w-md mx-auto px-4">
          <div className="rounded-full bg-[#074738] px-4 py-3 shadow-[0_8px_32px_rgba(7,71,56,0.25)]">
            <div className="grid grid-cols-5 items-center">
              {/* Inicio */}
              <button onClick={() => onTabChange("inicio")} className="flex items-center justify-center" aria-label="Inicio" aria-current={currentTab === "inicio" ? "page" : undefined}>
                <div className={`size-11 rounded-full flex items-center justify-center transition-all duration-150 ${currentTab === "inicio" ? "bg-white/18 text-white" : "text-white/70"}`}>
                  <Home size={iconSize} strokeWidth={strokeWidth} />
                </div>
              </button>

              {/* Explorar */}
              <button onClick={() => onTabChange("explorar")} className="flex items-center justify-center" aria-label="Explorar" aria-current={currentTab === "explorar" ? "page" : undefined}>
                <div className={`size-11 rounded-full flex items-center justify-center transition-all duration-150 ${currentTab === "explorar" ? "bg-white/18 text-white" : "text-white/70"}`}>
                  <MapPin size={iconSize} strokeWidth={strokeWidth} />
                </div>
              </button>

              {/* Agregar (center) */}
              {onAddDocument ? (
                <button onClick={onAddDocument} className="flex items-center justify-center" aria-label="Agregar documento">
                  <div className="size-12 rounded-[14px] bg-white text-[#074738] flex items-center justify-center shadow-[0_4px_16px_rgba(26,155,125,0.3)] hover:shadow-[0_4px_24px_rgba(26,155,125,0.45)] transition-shadow duration-150">
                    <Plus size={24} strokeWidth={2.2} />
                  </div>
                </button>
              ) : (
                <div />
              )}

              {/* Comunidad */}
              <button onClick={() => onTabChange("comunidad")} className="flex items-center justify-center" aria-label="Comunidad" aria-current={currentTab === "comunidad" ? "page" : undefined}>
                <div className={`size-11 rounded-full flex items-center justify-center transition-all duration-150 ${currentTab === "comunidad" ? "bg-white/18 text-white" : "text-white/70"}`}>
                  <Users2 size={iconSize} strokeWidth={strokeWidth} />
                </div>
              </button>

              {/* Mi Pessy */}
              <button onClick={() => onTabChange("mi-pessy")} className="flex items-center justify-center" aria-label="Mi Pessy" aria-current={currentTab === "mi-pessy" ? "page" : undefined}>
                <div className={`size-11 rounded-full flex items-center justify-center transition-all duration-150 ${currentTab === "mi-pessy" ? "bg-white/18 text-white" : "text-white/70"}`}>
                  <Fingerprint size={iconSize} strokeWidth={strokeWidth} />
                </div>
              </button>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  // Standard (non-focus) bottom nav — 4 Pillars
  const renderTab = (tab: typeof TABS[number]) => {
    const isActive = currentTab === tab.id;
    return (
      <button
        key={tab.id}
        onClick={() => onTabChange(tab.id)}
        className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all duration-150"
        aria-label={tab.label}
        aria-current={isActive ? "page" : undefined}
      >
        <div className={`size-10 rounded-xl flex items-center justify-center transition-all duration-150 ${
          isActive
            ? "bg-[#074738] text-white shadow-[0_2px_8px_rgba(7,71,56,0.25)]"
            : "text-[#9CA3AF]"
        }`}>
          <tab.Icon size={20} strokeWidth={isActive ? 2 : 1.5} />
        </div>
        <span className={`text-[10px] font-bold tracking-wider ${
          isActive ? "text-[#074738]" : "text-[#9CA3AF]"
        }`}>{tab.label}</span>
      </button>
    );
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 pessy-fade-up" style={{ animationDelay: '200ms' }}>
      <div className="max-w-md mx-auto px-3 pb-[env(safe-area-inset-bottom,8px)]">
        <div className="pessy-glass rounded-2xl border border-white/40 shadow-[0_-2px_20px_rgba(7,71,56,0.08)] px-1 py-2">
          <div className="flex items-center justify-around">
            {/* Día a Día */}
            {renderTab(TABS[0])}

            {/* Rutinas */}
            {renderTab(TABS[1])}

            {/* Agregar (center) */}
            {onAddDocument ? (
              <button
                onClick={onAddDocument}
                className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all duration-150"
                aria-label="Agregar documento"
              >
                <div className="size-12 rounded-[14px] bg-[#074738] text-white flex items-center justify-center shadow-[0_2px_12px_rgba(7,71,56,0.3)]">
                  <Plus size={24} strokeWidth={2.2} />
                </div>
                <span className="text-[10px] font-bold tracking-wider text-[#074738]">Agregar</span>
              </button>
            ) : (
              <div className="px-2" />
            )}

            {/* Servicios */}
            {renderTab(TABS[2])}

            {/* Mi Pessy */}
            {renderTab(TABS[3])}
          </div>
        </div>
      </div>
    </nav>
  );
}
