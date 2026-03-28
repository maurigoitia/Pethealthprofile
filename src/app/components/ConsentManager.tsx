/**
 * ConsentManager — Componente de consentimiento legal multi-jurisdicción
 * 
 * Cumple con:
 * - GDPR Art. 7 (consentimiento libre, específico, informado, inequívoco)
 * - LFPDPPP 2025 Art. 8-9 (consentimiento expreso para datos sensibles)
 * - Argentina Ley 25.326 Art. 5 (consentimiento libre, expreso, informado)
 * - Colombia Ley 1581 Art. 9 (autorización previa, expresa, informada)
 * - Chile Ley 21.719 Art. 5 (consentimiento libre, informado, específico)
 * - CCPA 1798.100 (right to know)
 * 
 * IMPORTANTE: Este componente se muestra ANTES de recolectar datos,
 * no después. El registro no puede proceder sin consentimiento explícito.
 */
import { useState } from "react";

export interface ConsentState {
  termsAccepted: boolean;
  privacyAccepted: boolean;
  aiProcessingAccepted: boolean;
  internationalTransferAccepted: boolean;
  timestamp: string;
  version: string;
}

interface ConsentManagerProps {
  onConsent: (consent: ConsentState) => void;
  onBack?: () => void;
  /** Si true, muestra versión compacta (para modals) */
  compact?: boolean;
}

const CONSENT_VERSION = "2026-03-27-v1";

export function ConsentManager({ onConsent, onBack, compact = false }: ConsentManagerProps) {
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [aiConsent, setAiConsent] = useState(false);
  const [transferConsent, setTransferConsent] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const allRequired = terms && privacy && aiConsent && transferConsent;

  const handleAccept = () => {
    if (!allRequired) return;
    onConsent({
      termsAccepted: true,
      privacyAccepted: true,
      aiProcessingAccepted: true,
      internationalTransferAccepted: true,
      timestamp: new Date().toISOString(),
      version: CONSENT_VERSION,
    });
  };
  const toggleSection = (id: string) => setExpanded(expanded === id ? null : id);

  const containerClass = compact
    ? "space-y-4"
    : "space-y-5 px-1";

  return (
    <div className={containerClass}>
      {!compact && (
        <div className="text-center mb-2">
          <h2
            className="text-2xl font-extrabold tracking-tight text-[#002f24]"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Antes de empezar
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[#5e716b]">
            Tu privacidad es importante. Leé cada punto antes de aceptar.
          </p>
        </div>
      )}

      {/* 1. Términos y Condiciones */}
      <ConsentItem
        checked={terms}
        onChange={setTerms}
        title="Términos y condiciones"
        expandedId="terms"
        expanded={expanded}
        onToggle={toggleSection}
        link="/terminos"
      >
        Reglas del servicio, uso aceptable, y tus responsabilidades como usuario de Pessy.
      </ConsentItem>

      {/* 2. Política de Privacidad */}
      <ConsentItem
        checked={privacy}
        onChange={setPrivacy}
        title="Política de privacidad"
        expandedId="privacy"
        expanded={expanded}
        onToggle={toggleSection}
        link="/privacidad"
      >
        Recolectamos tu nombre, email, país y datos de tus mascotas (historial médico,
        medicamentos, vacunas). Estos datos se almacenan en servidores de Google (Firebase)
        en Estados Unidos. Podés acceder, corregir, exportar o eliminar tus datos en cualquier
        momento desde Configuración → Privacidad.
      </ConsentItem>
      {/* 3. Procesamiento por IA — CONSENT SEPARADO (GDPR Art. 22, LFPDPPP Art. 9) */}
      <ConsentItem
        checked={aiConsent}
        onChange={setAiConsent}
        title="Procesamiento por inteligencia artificial"
        expandedId="ai"
        expanded={expanded}
        onToggle={toggleSection}
        badge="Datos sensibles"
      >
        Cuando subís un documento médico (foto o PDF), Pessy lo envía a servicios
        de inteligencia artificial externos (Google Gemini API y/o Anthropic Claude API)
        para extraer información como diagnósticos, medicamentos y fechas. Estos servicios
        NO retienen tus documentos para entrenar sus modelos. Los resultados son revisables
        por vos antes de confirmarse. Podés usar Pessy sin subir documentos si preferís
        no usar esta función.
      </ConsentItem>

      {/* 4. Transferencia Internacional — (GDPR Art. 44-49, LFPDPPP Art. 36-37) */}
      <ConsentItem
        checked={transferConsent}
        onChange={setTransferConsent}
        title="Transferencia internacional de datos"
        expandedId="transfer"
        expanded={expanded}
        onToggle={toggleSection}
      >
        Tus datos se almacenan y procesan en servidores de Google (Estados Unidos)
        y pueden ser procesados por servicios de IA en Estados Unidos. Google y Anthropic
        operan bajo cláusulas contractuales estándar (SCCs) y el Data Privacy Framework
        para proteger tus datos. Si estás en la Unión Europea, Chile, Argentina, México
        o Colombia, esto constituye una transferencia internacional de datos que requiere
        tu consentimiento explícito.
      </ConsentItem>

      {/* Botones */}
      <div className="pt-2 space-y-3">
        <button
          type="button"
          onClick={handleAccept}
          disabled={!allRequired}
          className="w-full rounded-full bg-[#074738] py-4 text-sm font-bold uppercase tracking-[0.16em] text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Acepto y continúo
        </button>

        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="w-full rounded-full border border-[#dfe6e2] py-3 text-sm font-bold uppercase tracking-[0.16em] text-[#074738]"
          >
            Volver
          </button>
        )}

        <p className="text-center text-[11px] leading-relaxed text-[#9ca8a2]">
          Podés retirar tu consentimiento en cualquier momento desde
          Configuración → Privacidad y seguridad.
        </p>
      </div>
    </div>
  );
}
/* ── Sub-componente: cada ítem de consentimiento ── */
interface ConsentItemProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  expandedId: string;
  expanded: string | null;
  onToggle: (id: string) => void;
  link?: string;
  badge?: string;
  children: React.ReactNode;
}

function ConsentItem({
  checked, onChange, title, expandedId, expanded, onToggle, link, badge, children,
}: ConsentItemProps) {
  const isOpen = expanded === expandedId;

  return (
    <div className="rounded-2xl border border-slate-200 overflow-hidden transition-all">
      <label className="flex items-start gap-3 px-4 py-4 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-5 w-5 flex-shrink-0 rounded border-slate-300 accent-[#074738]"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-[#002f24]">{title}</span>
            {badge && (
              <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                {badge}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); onToggle(expandedId); }}
            className="mt-1 text-xs font-semibold text-[#1A9B7D] hover:underline"
          >
            {isOpen ? "Ocultar detalle ▲" : "Ver detalle ▼"}
          </button>
        </div>
      </label>

      {isOpen && (
        <div className="px-4 pb-4 pt-0">
          <div className="rounded-xl bg-[#F0FAF9] px-4 py-3">
            <p className="text-xs leading-relaxed text-[#3d5c52]">{children}</p>
            {link && (
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-xs font-bold text-[#074738] underline"
              >
                Leer documento completo →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Utilidad: guardar/leer consentimiento ── */
export const CONSENT_STORAGE_KEY = "pessy_user_consent";

export function saveConsent(consent: ConsentState): void {
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consent));
  } catch { /* quota exceeded — no-op */ }
}

export function getStoredConsent(): ConsentState | null {
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearStoredConsent(): void {
  try { localStorage.removeItem(CONSENT_STORAGE_KEY); } catch { /* no-op */ }
}