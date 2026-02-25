import { useState, useEffect } from "react";
import { MaterialIcon } from "./MaterialIcon";
import { useNotifications } from "../contexts/NotificationContext";

interface NotificationsScreenProps {
  onBack: () => void;
}

interface NotificationSettings {
  enabled: boolean;
  vaccines: boolean;
  appointments: boolean;
  results: boolean;
  medications: boolean;
}

export function NotificationsScreen({ onBack }: NotificationsScreenProps) {
  const { permission, hasToken, requestPermission } = useNotifications();
  const [settings, setSettings] = useState<NotificationSettings>(() => {
    const stored = localStorage.getItem("pessy_notification_settings");
    return stored
      ? JSON.parse(stored)
      : {
          enabled: true,
          vaccines: true,
          appointments: true,
          results: true,
          medications: true,
        };
  });

  useEffect(() => {
    localStorage.setItem("pessy_notification_settings", JSON.stringify(settings));
  }, [settings]);

  const toggleGlobal = async () => {
    const nextEnabled = !settings.enabled;
    setSettings({ ...settings, enabled: nextEnabled });

    if (nextEnabled && permission !== "granted") {
      await requestPermission();
    }
  };

  const toggleSetting = (key: keyof Omit<NotificationSettings, "enabled">) => {
    setSettings({ ...settings, [key]: !settings[key] });
  };

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
              Notificaciones
            </h1>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Global Toggle */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-[#2b7cee]/10 flex items-center justify-center">
                  <MaterialIcon name="notifications" className="text-[#2b7cee] text-xl" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">
                    Activar notificaciones
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Control global
                  </p>
                </div>
              </div>
              <button
                onClick={toggleGlobal}
                className={`relative w-12 h-7 rounded-full transition-colors ${
                  settings.enabled ? "bg-[#2b7cee]" : "bg-slate-300 dark:bg-slate-700"
                }`}
              >
                <div
                  className={`absolute top-1 size-5 bg-white rounded-full transition-transform ${
                    settings.enabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              Estado del navegador:{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {permission === "granted"
                  ? hasToken
                    ? "Push activo"
                    : "Permiso OK, token pendiente"
                  : permission === "denied"
                    ? "Bloqueado por usuario"
                    : "Sin permiso"}
              </span>
            </div>
            {permission !== "granted" && (
              <button
                onClick={requestPermission}
                className="mt-3 w-full py-2.5 rounded-lg bg-[#2b7cee] text-white text-sm font-bold hover:bg-[#2563d4] transition-colors"
              >
                Activar push en este dispositivo
              </button>
            )}
          </div>

          {/* Individual Settings */}
          <div className="space-y-3">
            {/* Vaccines */}
            <div
              className={`bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 ${
                !settings.enabled ? "opacity-50" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MaterialIcon name="vaccines" className="text-emerald-500 text-xl" />
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      Recordatorios de vacunas
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Te avisamos antes de cada vacuna
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => toggleSetting("vaccines")}
                  disabled={!settings.enabled}
                  className={`relative w-12 h-7 rounded-full transition-colors ${
                    settings.vaccines && settings.enabled
                      ? "bg-emerald-500"
                      : "bg-slate-300 dark:bg-slate-700"
                  }`}
                >
                  <div
                    className={`absolute top-1 size-5 bg-white rounded-full transition-transform ${
                      settings.vaccines && settings.enabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Appointments */}
            <div
              className={`bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 ${
                !settings.enabled ? "opacity-50" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MaterialIcon name="event" className="text-[#2b7cee] text-xl" />
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      Recordatorios de turnos
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Te avisamos antes de cada cita
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => toggleSetting("appointments")}
                  disabled={!settings.enabled}
                  className={`relative w-12 h-7 rounded-full transition-colors ${
                    settings.appointments && settings.enabled
                      ? "bg-[#2b7cee]"
                      : "bg-slate-300 dark:bg-slate-700"
                  }`}
                >
                  <div
                    className={`absolute top-1 size-5 bg-white rounded-full transition-transform ${
                      settings.appointments && settings.enabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Results */}
            <div
              className={`bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 ${
                !settings.enabled ? "opacity-50" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MaterialIcon name="biotech" className="text-purple-500 text-xl" />
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      Resultados de estudios
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Te avisamos cuando estén listos
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => toggleSetting("results")}
                  disabled={!settings.enabled}
                  className={`relative w-12 h-7 rounded-full transition-colors ${
                    settings.results && settings.enabled
                      ? "bg-purple-500"
                      : "bg-slate-300 dark:bg-slate-700"
                  }`}
                >
                  <div
                    className={`absolute top-1 size-5 bg-white rounded-full transition-transform ${
                      settings.results && settings.enabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Medications */}
            <div
              className={`bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 ${
                !settings.enabled ? "opacity-50" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MaterialIcon name="medication" className="text-amber-500 text-xl" />
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      Recordatorios de medicación
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Te recordamos cada toma
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => toggleSetting("medications")}
                  disabled={!settings.enabled}
                  className={`relative w-12 h-7 rounded-full transition-colors ${
                    settings.medications && settings.enabled
                      ? "bg-amber-500"
                      : "bg-slate-300 dark:bg-slate-700"
                  }`}
                >
                  <div
                    className={`absolute top-1 size-5 bg-white rounded-full transition-transform ${
                      settings.medications && settings.enabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
