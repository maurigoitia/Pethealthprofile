import { MaterialIcon } from "./MaterialIcon";
import { isFocusExperienceHost } from "../../utils/runtimeFlags";

interface BottomNavProps {
  currentTab: "home" | "settings";
  onTabChange: (tab: "home" | "settings") => void;
  onAddDocument?: () => void;
}

export function BottomNav({ currentTab, onTabChange, onAddDocument }: BottomNavProps) {
  const focusExperienceEnabled = isFocusExperienceHost();
  const tabs = [
    { id: "home"      as const, icon: "home",             label: "Inicio"   },
    { id: "settings"  as const, icon: "person",           label: "Perfil"   },
  ];

  if (focusExperienceEnabled) {
    return (
      <nav className="fixed inset-x-0 bottom-4 z-40">
        <div className="max-w-md mx-auto px-4">
          <div className="rounded-full bg-[#074738] px-5 py-3 shadow-[0_18px_40px_rgba(7,71,56,0.28)]">
            <div className="grid grid-cols-3 items-center">
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

              {onAddDocument ? (
                <button
                  onClick={onAddDocument}
                  className="flex items-center justify-center"
                  aria-label="Agregar documento"
                >
                  <div className="size-12 rounded-full bg-white text-[#074738] flex items-center justify-center shadow-sm">
                    <MaterialIcon name="add" className="text-[28px]" />
                  </div>
                </button>
              ) : (
                <div />
              )}

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
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 z-40">
      <div className="max-w-md mx-auto flex items-center justify-around px-1 py-2">
        {tabs.map((tab, idx) => (
          <div key={tab.id} className="contents">
            <button
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all relative ${
                currentTab === tab.id
                  ? "text-[#074738] bg-[#074738]/10"
                  : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              }`}
            >
              <MaterialIcon
                name={tab.icon}
                className={`text-2xl ${currentTab === tab.id ? "fill-current" : ""}`}
              />
              <span className="text-[9px] font-bold uppercase tracking-wider">
                {tab.label}
              </span>
            </button>

            {/* Botón central Agregar — entre home y perfil */}
            {idx === 0 && onAddDocument && (
              <button
                onClick={onAddDocument}
                className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all text-[#074738] hover:bg-[#074738]/10"
              >
                <div className="size-10 rounded-full bg-[#074738] flex items-center justify-center -mt-3 shadow-lg shadow-[#074738]/30">
                  <MaterialIcon name="add" className="text-white text-2xl" />
                </div>
                <span className="text-[9px] font-bold uppercase tracking-wider">
                  Agregar
                </span>
              </button>
            )}
          </div>
        ))}
      </div>
    </nav>
  );
}
