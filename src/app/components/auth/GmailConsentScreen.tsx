import { useEffect, useRef, useState } from "react";
import { MaterialIcon } from "../shared/MaterialIcon";

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
  const firstCheckboxRef = useRef<HTMLInputElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const canProceed = acceptedTerms && acceptedAI;

  // BUG-10 fix: move focus into modal on mount, restore on unmount
  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement;
    // Small delay to ensure the modal is rendered before focusing
    const timer = setTimeout(() => {
      firstCheckboxRef.current?.focus();
    }, 50);
    return () => {
      clearTimeout(timer);
      previouslyFocused.current?.focus();
    };
  }, []);

  // BUG-11 fix: ESC closes the modal
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onDecline();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onDecline]);

  // BUG-17 fix: lock body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    // BUG-09 fix: role="dialog", aria-modal, aria-labelledby
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gmail-modal-title"
      // BUG-18 fix: disable backdrop click to prevent accidental state loss
      // Users can close with "Ahora no" button or ESC key
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900 animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#074738] px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-white/20">
              <MaterialIcon name="mail" className="text-xl" />
            </div>
            <div>
              <h2 id="gmail-modal-title" className="text-lg font-black">Conectar Gmail</h2>
              <p className="text-sm text-white/70">Lectura automática de emails veterinarios</p>
            </div>
          </div>
        </div>

        {/* BUG-15 fix: use <ul>/<li> instead of loose <div>/<p> */}
        {/* What Pessy DOES */}
        <div className="px-6 py-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-[#074738]">Pessy va a hacer esto</p>

          <ul className="space-y-2.5 list-none p-0 m-0" aria-label="Pessy va a hacer esto">
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
              text="Procesar el contenido con IA de Google (Gemini) para extraer información de tu mascota"
              tone="emerald"
            />
            <ConsentItem
              icon="delete_sweep"
              text="Destruir el email original en menos de 24 horas — no guardamos tu correo"
              tone="emerald"
            />
          </ul>
        </div>

        {/* What Pessy does NOT do */}
        <div className="border-t border-slate-100 px-6 py-4 space-y-3 dark:border-slate-800">
          <p className="text-xs font-bold uppercase tracking-widest text-red-500">Pessy NO hace esto</p>

          <ul className="space-y-2.5 list-none p-0 m-0" aria-label="Pessy NO hace esto">
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
          </ul>
        </div>

        {/* BUG-20 fix: checkboxes with id, name, aria-required */}
        <div className="border-t border-slate-100 px-6 py-4 space-y-3 dark:border-slate-800">
          <label htmlFor="consent-email" className="flex items-start gap-3 cursor-pointer">
            <input
              ref={firstCheckboxRef}
              type="checkbox"
              id="consent-email"
              name="consent-email"
              aria-required="true"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-0.5 size-4 rounded border-slate-300 text-[#074738] accent-[#074738]"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">
              Acepto que Pessy lea mis emails veterinarios y extraiga información sobre mis mascotas.
            </span>
          </label>

          <label htmlFor="consent-gemini" className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              id="consent-gemini"
              name="consent-gemini"
              aria-required="true"
              checked={acceptedAI}
              onChange={(e) => setAcceptedAI(e.target.checked)}
              className="mt-0.5 size-4 rounded border-slate-300 text-[#074738] accent-[#074738]"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">
              Acepto que el contenido de los emails sea procesado por Google Gemini (IA) para extraer información de mis mascotas.
            </span>
          </label>

          {/* BUG-12 fix: hint when button is disabled */}
          {!canProceed && (
            <p role="note" className="text-xs text-slate-400">
              Marcá las dos opciones para continuar.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="border-t border-slate-100 px-6 py-4 dark:border-slate-800">
          {/* BUG-12 fix: use aria-disabled instead of disabled to keep in tab order */}
          {/* BUG-13 fix: type="button" */}
          {/* BUG-19 fix: loading state */}
          <button
            type="button"
            onClick={canProceed && !loading ? onAccept : undefined}
            aria-disabled={!canProceed || loading}
            className={`w-full rounded-2xl py-3.5 text-sm font-bold text-white shadow-lg transition-all ${
              !canProceed || loading ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
            }`}
            style={{ backgroundColor: "#074738" }}
            title={!canProceed ? "Marcá las dos opciones para continuar" : undefined}
          >
            {loading ? "Conectando..." : "Aceptar y conectar Gmail"}
          </button>
          <button
            type="button"
            onClick={onDecline}
            className="mt-2 w-full rounded-2xl py-3 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Ahora no
          </button>
          {/* BUG-16 fix: "Privacidad y seguridad" is now a clickable button */}
          <p className="mt-3 text-center text-[11px] text-slate-400">
            Podés desconectar Gmail y borrar tu información en cualquier momento desde{" "}
            <button
              type="button"
              onClick={onDecline}
              className="font-bold text-[#074738] underline bg-transparent border-none cursor-pointer p-0 hover:text-[#1a9b7d]"
            >
              Privacidad y seguridad
            </button>.
          </p>
        </div>
      </div>
    </div>
  );
}

function ConsentItem({ icon, text, tone }: { icon: string; text: string; tone: "emerald" | "red" }) {
  const colors = tone === "emerald"
    ? "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/30"
    : "text-red-500 bg-red-50 dark:text-red-400 dark:bg-red-950/30";

  return (
    <li className="flex items-start gap-3">
      <div className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ${colors}`}>
        <MaterialIcon name={icon} className="text-sm" />
      </div>
      <span className="text-sm text-slate-700 dark:text-slate-300">{text}</span>
    </li>
  );
}
