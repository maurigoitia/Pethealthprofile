import { MaterialIcon } from "./MaterialIcon";

interface BottomNavProps {
  currentTab: "home" | "reminders" | "vets" | "settings";
  onTabChange: (tab: "home" | "reminders" | "vets" | "settings") => void;
  onAddDocument?: () => void;
  reminderBadge?: number;
}

export function BottomNav({ currentTab, onTabChange, onAddDocument, reminderBadge }: BottomNavProps) {
  const tabs = [
    { id: "home"      as const, icon: "home",             label: "Inicio"   },
    { id: "reminders" as const, icon: "notifications",    label: "Recordar" },
    { id: "vets"      as const, icon: "local_hospital",   label: "Vets"     },
    { id: "settings"  as const, icon: "person",           label: "Perfil"   },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 z-40">
      <div className="max-w-md mx-auto flex items-center justify-around px-1 py-2">
        {tabs.map((tab, idx) => (
          <div key={tab.id} className="contents">
            <button
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all relative ${
                currentTab === tab.id
                  ? "text-[#2b6fee] bg-[#2b6fee]/10"
                  : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              }`}
            >
              <MaterialIcon
                name={tab.icon}
                className={`text-2xl ${currentTab === tab.id ? "fill-current" : ""}`}
              />
              {/* Badge para recordatorios pendientes */}
              {tab.id === "reminders" && reminderBadge && reminderBadge > 0 && (
                <span className="absolute -top-0.5 right-1.5 size-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                  {reminderBadge > 9 ? "9+" : reminderBadge}
                </span>
              )}
              <span className="text-[9px] font-bold uppercase tracking-wider">
                {tab.label}
              </span>
            </button>

            {/* Botón central Agregar — entre home y reminders */}
            {idx === 0 && onAddDocument && (
              <button
                onClick={onAddDocument}
                className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all text-[#2b6fee] hover:bg-[#2b6fee]/10"
              >
                <div className="size-10 rounded-full bg-[#2b6fee] flex items-center justify-center -mt-3 shadow-lg shadow-[#2b6fee]/30">
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
