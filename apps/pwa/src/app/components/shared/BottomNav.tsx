import { Home, Users, Plus, Compass, User } from "lucide-react";
import { isFocusExperienceHost } from "../../utils/runtimeFlags";

interface BottomNavProps {
  currentTab: "home" | "settings";
  onTabChange: (tab: "home" | "settings") => void;
  onAddDocument?: () => void;
  onNavigate?: (screen: "lost-pets" | "explore") => void;
}

export function BottomNav({ currentTab, onTabChange, onAddDocument, onNavigate }: BottomNavProps) {
  const focusExperienceEnabled = isFocusExperienceHost();

  const iconSize = 22;
  const strokeWidth = 1.8;

  if (focusExperienceEnabled) {
    return (
      <nav className="fixed inset-x-0 bottom-4 z-40 pessy-fade-up" style={{ animationDelay: '200ms' }}>
        <div className="max-w-md mx-auto px-4">
          <div className="rounded-full bg-[#074738] px-5 py-3 shadow-[0_8px_32px_rgba(7,71,56,0.25)]">
            <div className="grid grid-cols-5 items-center">
              <button
                onClick={() => onTabChange("home")}
                aria-current={currentTab === "home" ? "page" : undefined}
                className="flex items-center justify-center"
                aria-label="Inicio"
              >
                <div className={`size-11 rounded-full flex items-center justify-center transition-all duration-150 ${
                  currentTab === "home" ? "bg-white/18 text-white" : "text-white/70"
                }`}>
                  <Home size={iconSize} strokeWidth={strokeWidth} />
                </div>
              </button>

              <button
                onClick={() => onNavigate?.("lost-pets")}
                className="flex items-center justify-center"
                aria-label="Comunidad"
              >
                <div className="size-11 rounded-full flex items-center justify-center transition-all duration-150 text-white/70">
                  <Users size={iconSize} strokeWidth={strokeWidth} />
                </div>
              </button>

              {onAddDocument ? (
                <button
                  onClick={onAddDocument}
                  className="flex items-center justify-center"
                  aria-label="Agregar documento"
                >
                  <div className="size-12 rounded-[14px] bg-white text-[#074738] flex items-center justify-center shadow-[0_4px_16px_rgba(26,155,125,0.3)] hover:shadow-[0_4px_24px_rgba(26,155,125,0.45)] transition-shadow duration-150">
                    <Plus size={24} strokeWidth={2.2} />
                  </div>
                </button>
              ) : (
                <div />
              )}

              <button
                onClick={() => onNavigate?.("explore")}
                className="flex items-center justify-center"
                aria-label="Explorar"
              >
                <div className="size-11 rounded-full flex items-center justify-center transition-all duration-150 text-white/70">
                  <Compass size={iconSize} strokeWidth={strokeWidth} />
                </div>
              </button>

              <button
                onClick={() => onTabChange("settings")}
                aria-current={currentTab === "settings" ? "page" : undefined}
                className="flex items-center justify-center"
                aria-label="Perfil"
              >
                <div className={`size-11 rounded-full flex items-center justify-center transition-all duration-150 ${
                  currentTab === "settings" ? "bg-white/18 text-white" : "text-white/70"
                }`}>
                  <User size={iconSize} strokeWidth={strokeWidth} />
                </div>
              </button>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  // Standard (non-focus) bottom nav — Figma Kit style
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 pessy-fade-up" style={{ animationDelay: '200ms' }}>
      <div className="max-w-md mx-auto px-3 pb-[env(safe-area-inset-bottom,8px)]">
        <div className="pessy-glass rounded-2xl border border-white/40 shadow-[0_-2px_20px_rgba(7,71,56,0.08)] px-2 py-2">
          <div className="flex items-center justify-around">
            {/* Inicio */}
            <button
              onClick={() => onTabChange("home")}
              aria-current={currentTab === "home" ? "page" : undefined}
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-150"
              aria-label="Inicio"
            >
              <div className={`size-10 rounded-xl flex items-center justify-center transition-all duration-150 ${
                currentTab === "home"
                  ? "bg-[#074738] text-white shadow-[0_2px_8px_rgba(7,71,56,0.25)]"
                  : "text-[#9CA3AF]"
              }`}>
                <Home size={20} strokeWidth={currentTab === "home" ? 2 : 1.5} />
              </div>
              <span className={`text-[10px] font-bold tracking-wider ${
                currentTab === "home" ? "text-[#074738]" : "text-[#9CA3AF]"
              }`}>Inicio</span>
            </button>

            {/* Comunidad */}
            <button
              onClick={() => onNavigate?.("lost-pets")}
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-150"
              aria-label="Comunidad"
            >
              <div className="size-10 rounded-xl flex items-center justify-center transition-all duration-150 text-[#9CA3AF]">
                <Users size={20} strokeWidth={1.5} />
              </div>
              <span className="text-[10px] font-bold tracking-wider text-[#9CA3AF]">Comunidad</span>
            </button>

            {/* Agregar (center) */}
            {onAddDocument ? (
              <button
                onClick={onAddDocument}
                className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-150"
                aria-label="Agregar documento"
              >
                <div className="size-12 rounded-[14px] bg-[#074738] text-white flex items-center justify-center shadow-[0_2px_12px_rgba(7,71,56,0.3)]">
                  <Plus size={24} strokeWidth={2.2} />
                </div>
                <span className="text-[10px] font-bold tracking-wider text-[#074738]">Agregar</span>
              </button>
            ) : (
              <div className="px-3" />
            )}

            {/* Explorar */}
            <button
              onClick={() => onNavigate?.("explore")}
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-150"
              aria-label="Explorar"
            >
              <div className="size-10 rounded-xl flex items-center justify-center transition-all duration-150 text-[#9CA3AF]">
                <Compass size={20} strokeWidth={1.5} />
              </div>
              <span className="text-[10px] font-bold tracking-wider text-[#9CA3AF]">Explorar</span>
            </button>

            {/* Perfil */}
            <button
              onClick={() => onTabChange("settings")}
              aria-current={currentTab === "settings" ? "page" : undefined}
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-150"
              aria-label="Perfil"
            >
              <div className={`size-10 rounded-xl flex items-center justify-center transition-all duration-150 ${
                currentTab === "settings"
                  ? "bg-[#074738] text-white shadow-[0_2px_8px_rgba(7,71,56,0.25)]"
                  : "text-[#9CA3AF]"
              }`}>
                <User size={20} strokeWidth={currentTab === "settings" ? 2 : 1.5} />
              </div>
              <span className={`text-[10px] font-bold tracking-wider ${
                currentTab === "settings" ? "text-[#074738]" : "text-[#9CA3AF]"
              }`}>Perfil</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
