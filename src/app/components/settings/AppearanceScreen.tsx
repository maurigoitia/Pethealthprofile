import { useState, useEffect } from "react";
import { MaterialIcon } from "../shared/MaterialIcon";

interface AppearanceScreenProps {
  onBack: () => void;
}

type Theme = "light" | "dark" | "system";

export function AppearanceScreen({ onBack }: AppearanceScreenProps) {
  const [selectedTheme, setSelectedTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem("pessy_theme");
    return (stored as Theme) || "system";
  });

  useEffect(() => {
    localStorage.setItem("pessy_theme", selectedTheme);
    
    if (selectedTheme === "system") {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.classList.toggle("dark", isDark);
    } else {
      document.documentElement.classList.toggle("dark", selectedTheme === "dark");
    }
  }, [selectedTheme]);

  const themes: { id: Theme; icon: string; title: string; description: string }[] = [
    {
      id: "light",
      icon: "light_mode",
      title: "Tema claro",
      description: "Interfaz clara siempre activa",
    },
    {
      id: "dark",
      icon: "dark_mode",
      title: "Tema oscuro",
      description: "Interfaz oscura siempre activa",
    },
    {
      id: "system",
      icon: "brightness_auto",
      title: "Seguir sistema",
      description: "Usa la configuración del dispositivo",
    },
  ];

  return (
    <div className="bg-[#f6f6f8] dark:bg-[#101622] min-h-screen">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <div className="px-4 py-4 flex items-center gap-3">
            <button
              onClick={onBack}
              className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <MaterialIcon name="arrow_back" className="text-xl" />
            </button>
            <h1 className="text-xl font-black text-slate-900 dark:text-white">
              Apariencia
            </h1>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {themes.map((theme) => (
            <button
              key={theme.id}
              onClick={() => setSelectedTheme(theme.id)}
              className={`w-full bg-white dark:bg-slate-900 rounded-xl border-2 p-4 flex items-center justify-between transition-all ${
                selectedTheme === theme.id
                  ? "border-[#074738] bg-[#074738]/5"
                  : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`size-10 rounded-lg flex items-center justify-center ${
                    selectedTheme === theme.id
                      ? "bg-[#074738]/10"
                      : "bg-slate-100 dark:bg-slate-800"
                  }`}
                >
                  <MaterialIcon
                    name={theme.icon}
                    className={`text-xl ${
                      selectedTheme === theme.id
                        ? "text-[#074738]"
                        : "text-slate-600 dark:text-slate-400"
                    }`}
                  />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-slate-900 dark:text-white">
                    {theme.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {theme.description}
                  </p>
                </div>
              </div>
              {selectedTheme === theme.id && (
                <div className="size-6 rounded-full bg-[#074738] flex items-center justify-center">
                  <MaterialIcon name="check" className="text-white text-sm" />
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Preview Card */}
        <div className="p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
              Vista previa
            </p>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-[#074738]/10 flex items-center justify-center">
                  <MaterialIcon name="ecg_heart" className="text-[#074738] text-xl" />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                    Elemento de ejemplo
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Así se verá la interfaz
                  </p>
                </div>
              </div>
              <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full w-2/3 bg-[#074738] rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
