import { useState, useEffect } from "react";
import { MaterialIcon } from "./MaterialIcon";
import { useNotifications } from "../contexts/NotificationContext";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../../lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

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

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  vaccines: true,
  appointments: true,
  results: true,
  medications: true,
};

export function NotificationsScreen({ onBack }: NotificationsScreenProps) {
  const { permission, hasToken, requestPermission } = useNotifications();
  const { user } = useAuth();
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);

  // Cargar desde Firestore
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists() && snap.data().notificationSettings) {
          setSettings(snap.data().notificationSettings);
        }
      } catch {
        // fallback a localStorage si falla Firestore
        const stored = localStorage.getItem("pessy_notification_settings");
        if (stored) setSettings(JSON.parse(stored));
      }
    };
    load();
  }, [user]);

  // Guardar en Firestore + localStorage como backup
  const save = async (newSettings: NotificationSettings) => {
    setSettings(newSettings);
    localStorage.setItem("pessy_notification_settings", JSON.stringify(newSettings));
    if (!user) return;
    setSaving(true);
    try {
      await setDoc(doc(db, "users", user.uid), { notificationSettings: newSettings }, { merge: true });
    } catch {
      // silencioso, ya guardó en localStorage
    } finally {
      setSaving(false);
    }
  };

  const toggleGlobal = async () => {
    const nextEnabled = !settings.enabled;
    await save({ ...settings, enabled: nextEnabled });
    if (nextEnabled && permission !== "granted") {
      await requestPermission();
    }
  };

  const toggleSetting = async (key: keyof Omit<NotificationSettings, "enabled">) => {
    await save({ ...settings, [key]: !settings[key] });
  };

  const Toggle = ({ active, onToggle, color = "bg-[#2b7cee]", disabled = false }: {
    active: boolean; onToggle: () => void; color?: string; disabled?: boolean;
  }) => (
    <button onClick={onToggle} disabled={disabled}
      className={`relative w-12 h-7 rounded-full transition-colors ${active && !disabled ? color : "bg-slate-300 dark:bg-slate-700"}`}>
      <div className={`absolute top-1 size-5 bg-white rounded-full transition-transform shadow ${active && !disabled ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );

  return (
    <div className="bg-[#f6f6f8] dark:bg-[#101622] min-h-screen">
      <div className="max-w-md mx-auto">
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <div className="px-4 py-4 flex items-center gap-3">
            <button onClick={onBack} aria-label="Volver" className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center focus-visible:ring-2 focus-visible:ring-[#074738] focus-visible:ring-offset-2">
              <MaterialIcon name="arrow_back" className="text-xl" />
            </button>
            <h1 className="text-xl font-black text-slate-900 dark:text-white">Notificaciones</h1>
            {saving && <div className="ml-auto size-4 border-2 border-[#2b7cee]/30 border-t-[#2b7cee] rounded-full animate-spin" />}
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Global */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-[#2b7cee]/10 flex items-center justify-center">
                  <MaterialIcon name="notifications" className="text-[#2b7cee] text-xl" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">Activar notificaciones</h3>
                  <p className="text-xs text-slate-500">Control global</p>
                </div>
              </div>
              <Toggle active={settings.enabled} onToggle={toggleGlobal} />
            </div>
            <div className="mt-3 text-xs text-slate-500">
              Estado:{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {permission === "granted" ? (hasToken ? "Push activo" : "Permiso OK") : permission === "denied" ? "Bloqueado" : "Sin permiso"}
              </span>
            </div>
            {permission !== "granted" && (
              <button onClick={requestPermission} className="mt-3 w-full py-2.5 rounded-lg bg-[#2b7cee] text-white text-sm font-bold">
                Activar push en este dispositivo
              </button>
            )}
          </div>

          {/* Items */}
          {[
            { key: "vaccines" as const, icon: "vaccines", color: "bg-emerald-500", label: "Recordatorios de vacunas", desc: "Te avisamos antes de cada vacuna" },
            { key: "appointments" as const, icon: "event", color: "bg-[#2b7cee]", label: "Recordatorios de turnos", desc: "Te avisamos antes de cada cita" },
            { key: "results" as const, icon: "biotech", color: "bg-purple-500", label: "Resultados de estudios", desc: "Te avisamos cuando estén listos" },
            { key: "medications" as const, icon: "medication", color: "bg-amber-500", label: "Recordatorios de medicación", desc: "Te recordamos cada toma" },
          ].map(({ key, icon, color, label, desc }) => (
            <div key={key} className={`bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 ${!settings.enabled ? "opacity-50" : ""}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MaterialIcon name={icon} className={`text-xl ${color.replace("bg-", "text-")}`} />
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">{label}</h3>
                    <p className="text-xs text-slate-500">{desc}</p>
                  </div>
                </div>
                <Toggle active={settings[key]} onToggle={() => toggleSetting(key)} color={color} disabled={!settings.enabled} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
