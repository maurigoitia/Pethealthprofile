import { MaterialIcon } from "./MaterialIcon";
import { isFocusExperienceHost } from "../../utils/runtimeFlags";

interface BottomNavProps {
  currentTab: "home" | "settings";
  onTabChange: (tab: "home" | "settings") => void;
  onAddDocument?: () => void;
  onNavigate?: (screen: "lost-pets" | "explore") => void;
}

export function BottomNav({ currentTab, onTabChange, onAddDocument, onNavigate }: BottomNavProps) {
  const focusExperienceEnabled = isFocusExperienceHost();
  const tabs = [
    { id: "home"      as const, icon: "home",             label: "Inicio"   },
    { id: "settings"  as const, icon: "person",           label: "Perfil"   },
  ];

  if (focusExperienceEnabled) {
    return (
      <nav className="fixed inset-x-0 bottom-4 z-40">
        <div className="max-w-md mx-auto px-4">
          <div className="rounded-full bg-[#074738] px-5 py-3 shadow-[0_4px_16px_rgba(7,71,56,0.15)]">
            <div className="grid grid-cols-5 items-center">
              <button
                onClick={() => onTabChange("home")}
                className="flex items-center justify-center"
                aria-label="Inicio"
              >
                <div className={`size-11 rounded-full flex items-center justify-center transition-all ${
                  currentTab === "home" ? "bg-white/18 text-white" : "text-white/80"
                }`}>
                  <MaterialIcon name="home" className="text-[26px]" />
                </div>
              </button>

              <button
                onClick={() => onNavigate?.("lost-pets")}
                className="flex items-center justify-center"
                aria-label="Comunidad"
              >
                <div className="size-11 rounded-full flex items-center justify-center transition-all text-white/80">
                  <MaterialIcon name="groups" className="text-[26px]" />
                </div>
              </button>

              {onAddDocument ? (
                <button
                  onClick={onAddDocument}
                  className="flex items-center justify-center"
                  aria-label="Agregar documento"
                >
                  <div className="size-12 rounded-[14px] bg-white text-[#074738] flex items-center justify-center shadow-[0_4px_12px_rgba(26,155,125,0.3)]">
                    <MaterialIcon name="add" className="text-[28px]" />
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
                <div className="size-11 rounded-full flex items-center justify-center transition-all text-white/80">
                  <MaterialIcon name="explore" className="text-[26px]" />
                </div>
              </button>

              <button
                onClick={() => onTabChange("settings")}
                className="flex items-center justify-center"
                aria-label="Perfil"
              >
                <div className={`size-11 rounded-full flex items-center justify-center transition-all ${
                  currentTab === "settings" ? "bg-white/18 text-white" : "text-white/80"
                }`}>
                  <MaterialIcon name="person" className="text-[26px]" />
                </div>
              </button>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-[#E5E7EB] dark:border-slate-800 z-40">
      <div className="max-w-md mx-auto flex items-center justify-around px-1 py-2">
        {/* Inicio */}
        <button
          onClick={() => onTabChange("home")}
          className={`flex flex-col items-center gap-1 px-2 py-2 rounded-[12px] transition-all ${
            currentTab === "home"
              ? "text-[#074738] bg-[#E0F2F1]"
              : "text-[#9CA3AF] hover:text-[#6B7280] dark:hover:text-slate-300"
          }`}
          style={{ fontFamily: "'Manrope', sans-serif" }}
        >
          <MaterialIcon name="home" className={`text-2xl ${currentTab === "home" ? "fill-current" : ""}`} />
          <span className="text-[10px] font-bold uppercase tracking-wider">Inicio</span>
        </button>

        {/* Comunidad */}
        <button
          onClick={() => onNavigate?.("lost-pets")}
          className="flex flex-col items-center gap-1 px-2 py-2 rounded-[12px] transition-all text-[#9CA3AF] hover:text-[#6B7280] dark:hover:text-slate-300"
          style={{ fontFamily: "'Manrope', sans-serif" }}
        >
          <MaterialIcon name="groups" className="text-2xl" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Comunidad</span>
        </button>

        {/* Agregar (central) */}
        {onAddDocument && (
          <button
            onClick={onAddDocument}
            className="flex flex-col items-center gap-1 px-2 py-2 rounded-[14px] transition-all text-[#074738] hover:bg-[#E0F2F1]"
            style={{ fontFamily: "'Manrope', sans-serif" }}
          >
            <div className="size-10 rounded-[12px] bg-[#074738] flex items-center justify-center -mt-3 shadow-[0_4px_12px_rgba(26,155,125,0.3)] hover:bg-[#1A9B7D] transition-colors">
              <MaterialIcon name="add" className="text-white text-2xl" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider">Agregar</span>
          </button>
        )}

        {/* Explorar */}
        <button
          onClick={() => onNavigate?.("explore")}
          className="flex flex-col items-center gap-1 px-2 py-2 rounded-[12px] transition-all text-[#9CA3AF] hover:text-[#6B7280] dark:hover:text-slate-300"
          style={{ fontFamily: "'Manrope', sans-serif" }}
        >
          <MaterialIcon name="explore" className="text-2xl" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Explorar</span>
        </button>

        {/* Perfil */}
        <button
          onClick={() => onTabChange("settings")}
          className={`flex flex-col items-center gap-1 px-2 py-2 rounded-[12px] transition-all ${
            currentTab === "settings"
              ? "text-[#074738] bg-[#E0F2F1]"
              : "text-[#9CA3AF] hover:text-[#6B7280] dark:hover:text-slate-300"
          }`}
          style={{ fontFamily: "'Manrope', sans-serif" }}
        >
          <MaterialIcon name="person" className={`text-2xl ${currentTab === "settings" ? "fill-current" : ""}`} />
          <span className="text-[10px] font-bold uppercase tracking-wider">Perfil</span>
        </button>
      </div>
    </nav>
  );
}
