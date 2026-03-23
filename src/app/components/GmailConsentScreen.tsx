import { useState } from "react";
import { motion } from "motion/react";
import { MaterialIcon } from "./MaterialIcon";

interface GmailConsentScreenProps {
  onAccept: () => void;
  onDecline: () => void;
  loading?: boolean;
}

/**
 * Pantalla de consentimiento explícito ANTES de OAuth de Gmail.
 * Requerida por Apple App Store Guidelines 5.1.1 (Health Data)
 * y Google Play Data Safety requirements.
 *
 * Explica exactamente qué hace Pessy con los emails:
 * - Qué lee
 * - Qué extrae
 * - Qué procesa con IA
 * - Qué destruye
 * - Qué NO hace
 */
export function GmailConsentScreen({ onAccept, onDecline, loading }: GmailConsentScreenProps) {
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedAI, setAcceptedAI] = useState(false);

  const canProceed = acceptedTerms && acceptedAI;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={onDecline}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 25 }}
        className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#074738] px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-white/20">
              <MaterialIcon name="mail" className="text-xl" />
            </div>
            <div>
              <h2 className="text-lg font-black">Conectar Gmail</h2>
              <p className="text-sm text-white/70">Lectura automática de emails veterinarios</p>
            </div>
          </div>
        </div>

        {/* What Pessy DOES */}
        <div className="px-6 py-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-[#074738]">Pessy va a hacer esto</p>

          <div className="space-y-2.5">
            <ConsentItem
              icon="search"
              text="Leer emails de veterinarias, laboratorios y pet shops"
              tone="emerald"
            />
            <ConsentItem
              icon="description"
              text="Extraer vacunas, turnos, recetas y resultados de análisis"
              tone="emerald"
            />
            <ConsentItem
              icon="smart_toy"
              text="Procesar el contenido con IA de Google (Gemini) para identificar datos clínicos"
              tone="emerald"
            />
            <ConsentItem
              icon="delete_sweep"
              text="Destruir el email original en menos de 24 horas — no guardamos tu correo"
              tone="emerald"
            />
          </div>
        </div>

        {/* What Pessy does NOT do */}
        <div className="border-t border-slate-100 px-6 py-4 space-y-3 dark:border-slate-800">
          <p className="text-xs font-bold uppercase tracking-widest text-red-500">Pessy NO hace esto</p>

          <div className="space-y-2.5">
            <ConsentItem
              icon="block"
              text="No lee emails personales, bancarios ni laborales"
              tone="red"
            />
            <ConsentItem
              icon="block"
              text="No comparte tus datos con terceros ni con publicidad"
              tone="red"
            />
            <ConsentItem
              icon="block"
              text="No escribe ni envía emails desde tu cuenta"
              tone="red"
            />
          </div>
        </div>

        {/* Checkboxes */}
        <div className="border-t border-slate-100 px-6 py-4 space-y-3 dark:border-slate-800">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-0.5 size-4 rounded border-slate-300 text-[#074738] accent-[#074738]"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">
              Acepto que Pessy lea mis emails veterinarios y extraiga datos clínicos de mis mascotas.
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={acceptedAI}
              onChange={(e) => setAcceptedAI(e.target.checked)}
              className="mt-0.5 size-4 rounded border-slate-300 text-[#074738] accent-[#074738]"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">
              Acepto que el contenido de los emails sea procesado por Google Gemini (IA) para extraer información médica.
            </span>
          </label>
        </div>

        {/* Actions */}
        <div className="border-t border-slate-100 px-6 py-4 dark:border-slate-800">
          <button
            onClick={onAccept}
            disabled={!canProceed || loading}
            className="w-full rounded-2xl py-3.5 text-sm font-bold text-white shadow-lg transition-all disabled:opacity-40"
            style={{ backgroundColor: "#074738" }}
          >
            {loading ? "Conectando..." : "Aceptar y conectar Gmail"}
          </button>
          <button
            onClick={onDecline}
            className="mt-2 w-full rounded-2xl py-3 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Ahora no
          </button>
          <p className="mt-3 text-center text-[11px] text-slate-400">
            Podés desconectar Gmail y borrar tus datos clínicos en cualquier momento desde Privacidad y seguridad.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ConsentItem({ icon, text, tone }: { icon: string; text: string; tone: "emerald" | "red" }) {
  const colors = tone === "emerald"
    ? "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/30"
    : "text-red-500 bg-red-50 dark:text-red-400 dark:bg-red-950/30";

  return (
    <div className="flex items-start gap-3">
      <div className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ${colors}`}>
        <MaterialIcon name={icon} className="text-sm" />
      </div>
      <p className="text-sm text-slate-700 dark:text-slate-300">{text}</p>
    </div>
  );
}
