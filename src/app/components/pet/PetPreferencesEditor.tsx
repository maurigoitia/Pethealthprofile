import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MaterialIcon } from "../shared/MaterialIcon";
import type { PetPreferences } from "../contexts/PetContext";

interface PetPreferencesEditorProps {
  petName: string;
  preferences: PetPreferences;
  onSave: (prefs: PetPreferences) => void;
  onClose: () => void;
}

const ACTIVITY_OPTIONS: { id: PetPreferences["favoriteActivities"] extends (infer T)[] | undefined ? T : never; label: string; icon: string }[] = [
  { id: "walk", label: "Paseos", icon: "directions_walk" },
  { id: "park", label: "Parque", icon: "park" },
  { id: "cafe", label: "Cafés", icon: "local_cafe" },
  { id: "beach", label: "Playa", icon: "beach_access" },
  { id: "hiking", label: "Senderismo", icon: "hiking" },
  { id: "playdate", label: "Jugar con otros", icon: "groups" },
  { id: "training", label: "Entrenamiento", icon: "school" },
  { id: "swim", label: "Nadar", icon: "pool" },
];

const PERSONALITY_OPTIONS: { id: PetPreferences["personality"] extends (infer T)[] | undefined ? T : never; label: string }[] = [
  { id: "calm", label: "Tranquilo" },
  { id: "energetic", label: "Energético" },
  { id: "shy", label: "Tímido" },
  { id: "social", label: "Sociable" },
  { id: "independent", label: "Independiente" },
  { id: "playful", label: "Juguetón" },
  { id: "protective", label: "Protector" },
];

const FEAR_OPTIONS = ["Truenos", "Fuegos artificiales", "Otros perros", "Autos", "Aspiradora", "Veterinario"];

export function PetPreferencesEditor({ petName, preferences, onSave, onClose }: PetPreferencesEditorProps) {
  const [prefs, setPrefs] = useState<PetPreferences>({ ...preferences });
  const [section, setSection] = useState<"personality" | "activities" | "fears" | "food">("personality");

  const toggleArrayItem = <T extends string>(arr: T[] | undefined, item: T): T[] => {
    const current = arr || [];
    return current.includes(item) ? current.filter((i) => i !== item) : [...current, item];
  };

  const sections = [
    { id: "personality" as const, label: "Personalidad", icon: "psychology" },
    { id: "activities" as const, label: "Actividades", icon: "sports_handball" },
    { id: "fears" as const, label: "Miedos", icon: "warning" },
    { id: "food" as const, label: "Comida", icon: "restaurant" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="w-full max-w-md rounded-t-3xl bg-white dark:bg-slate-900 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white">Gustos de {petName}</h2>
            <p className="text-xs text-slate-500">Pessy usa esto para sugerirte mejores planes</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800">
            <MaterialIcon name="close" className="text-xl text-slate-500" />
          </button>
        </div>

        {/* Section Tabs */}
        <div className="flex gap-1 border-b border-slate-100 px-4 py-2 dark:border-slate-800">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                section === s.id
                  ? "bg-[#074738] text-white"
                  : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <MaterialIcon name={s.icon} className="text-sm" />
              {s.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="max-h-[50vh] overflow-y-auto px-5 py-4">
          <AnimatePresence mode="wait">
            {section === "personality" && (
              <motion.div key="personality" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                <p className="text-sm text-slate-500 dark:text-slate-400">¿Cómo es {petName}?</p>
                <div className="flex flex-wrap gap-2">
                  {PERSONALITY_OPTIONS.map((opt) => {
                    const selected = (prefs.personality || []).includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        onClick={() => setPrefs({ ...prefs, personality: toggleArrayItem(prefs.personality, opt.id) })}
                        className={`rounded-full border px-4 py-2 text-sm font-semibold transition-all ${
                          selected
                            ? "border-[#074738] bg-[#074738]/10 text-[#074738] dark:border-emerald-400 dark:bg-emerald-400/10 dark:text-emerald-400"
                            : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {section === "activities" && (
              <motion.div key="activities" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                <p className="text-sm text-slate-500 dark:text-slate-400">¿Qué le gusta hacer a {petName}?</p>
                <div className="grid grid-cols-2 gap-2">
                  {ACTIVITY_OPTIONS.map((opt) => {
                    const selected = (prefs.favoriteActivities || []).includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        onClick={() => setPrefs({ ...prefs, favoriteActivities: toggleArrayItem(prefs.favoriteActivities, opt.id) })}
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition-all ${
                          selected
                            ? "border-[#074738] bg-[#074738]/10 text-[#074738] dark:border-emerald-400 dark:bg-emerald-400/10 dark:text-emerald-400"
                            : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400"
                        }`}
                      >
                        <MaterialIcon name={opt.icon} className="text-lg" />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {section === "fears" && (
              <motion.div key="fears" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                <p className="text-sm text-slate-500 dark:text-slate-400">¿{petName} le tiene miedo a algo?</p>
                <div className="flex flex-wrap gap-2">
                  {FEAR_OPTIONS.map((fear) => {
                    const selected = (prefs.fears || []).includes(fear);
                    return (
                      <button
                        key={fear}
                        onClick={() => setPrefs({ ...prefs, fears: toggleArrayItem(prefs.fears, fear) })}
                        className={`rounded-full border px-4 py-2 text-sm font-semibold transition-all ${
                          selected
                            ? "border-amber-500 bg-amber-50 text-amber-700 dark:border-amber-400 dark:bg-amber-400/10 dark:text-amber-400"
                            : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400"
                        }`}
                      >
                        {fear}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2">
                  <input
                    type="text"
                    placeholder="Otro miedo..."
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const val = (e.target as HTMLInputElement).value.trim();
                        if (val && !(prefs.fears || []).includes(val)) {
                          setPrefs({ ...prefs, fears: [...(prefs.fears || []), val] });
                          (e.target as HTMLInputElement).value = "";
                        }
                      }
                    }}
                  />
                </div>
              </motion.div>
            )}

            {section === "food" && (
              <motion.div key="food" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">Datos de comida para predecir cuándo reponer</p>

                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">Marca</label>
                  <input
                    type="text"
                    placeholder="Ej: Royal Canin, ProPlan..."
                    value={prefs.foodBrand || ""}
                    onChange={(e) => setPrefs({ ...prefs, foodBrand: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">Bolsa (kg)</label>
                    <input
                      type="number"
                      placeholder="15"
                      value={prefs.foodBagKg || ""}
                      onChange={(e) => setPrefs({ ...prefs, foodBagKg: Number(e.target.value) || undefined })}
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">Consumo diario (g)</label>
                    <input
                      type="number"
                      placeholder="300"
                      value={prefs.foodDailyGrams || ""}
                      onChange={(e) => setPrefs({ ...prefs, foodDailyGrams: Number(e.target.value) || undefined })}
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">Última compra</label>
                  <input
                    type="date"
                    value={prefs.foodLastPurchase || ""}
                    onChange={(e) => setPrefs({ ...prefs, foodLastPurchase: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                {prefs.foodBagKg && prefs.foodDailyGrams && prefs.foodLastPurchase && (
                  <SupplyForecast bagKg={prefs.foodBagKg} dailyGrams={prefs.foodDailyGrams} lastPurchase={prefs.foodLastPurchase} />
                )}

                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">Alergias alimentarias</label>
                  <input
                    type="text"
                    placeholder="Pollo, gluten..."
                    value={(prefs.allergies || []).join(", ")}
                    onChange={(e) => setPrefs({ ...prefs, allergies: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Save Button */}
        <div className="border-t border-slate-100 px-5 py-4 dark:border-slate-800">
          <button
            onClick={() => onSave(prefs)}
            className="w-full rounded-2xl py-3.5 text-sm font-bold text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
            style={{ backgroundColor: "#074738" }}
          >
            Guardar gustos
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Supply Forecast Widget ──────────────────────────────────────────────────

function SupplyForecast({ bagKg, dailyGrams, lastPurchase }: { bagKg: number; dailyGrams: number; lastPurchase: string }) {
  const totalGrams = bagKg * 1000;
  const purchaseDate = new Date(lastPurchase);
  const today = new Date();
  const daysSincePurchase = Math.max(0, Math.floor((today.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24)));
  const gramsConsumed = daysSincePurchase * dailyGrams;
  const gramsLeft = Math.max(0, totalGrams - gramsConsumed);
  const daysLeft = Math.max(0, Math.floor(gramsLeft / dailyGrams));
  const percentLeft = Math.round((gramsLeft / totalGrams) * 100);
  const runOutDate = new Date(today.getTime() + daysLeft * 24 * 60 * 60 * 1000);

  const urgency = daysLeft <= 3 ? "red" : daysLeft <= 7 ? "amber" : "emerald";
  const colors = {
    red: { bg: "bg-red-50 dark:bg-red-950/30", text: "text-red-700 dark:text-red-400", bar: "bg-red-500", border: "border-red-200 dark:border-red-800" },
    amber: { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-400", bar: "bg-amber-500", border: "border-amber-200 dark:border-amber-800" },
    emerald: { bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-400", bar: "bg-emerald-500", border: "border-emerald-200 dark:border-emerald-800" },
  };
  const c = colors[urgency];

  return (
    <div className={`rounded-2xl border p-4 ${c.bg} ${c.border}`}>
      <div className="flex items-center justify-between">
        <span className={`text-sm font-bold ${c.text}`}>
          {daysLeft === 0 ? "Sin stock" : `${daysLeft} días de comida`}
        </span>
        <span className={`text-xs font-semibold ${c.text}`}>{percentLeft}%</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div className={`h-full rounded-full ${c.bar} transition-all`} style={{ width: `${percentLeft}%` }} />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {daysLeft <= 3
          ? `Comprá ya. Se termina el ${runOutDate.toLocaleDateString("es-AR")}.`
          : daysLeft <= 7
            ? `Conviene reponer esta semana. Queda hasta el ${runOutDate.toLocaleDateString("es-AR")}.`
            : `Próxima compra estimada: ${runOutDate.toLocaleDateString("es-AR")}`}
      </p>
    </div>
  );
}
