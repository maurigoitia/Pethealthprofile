/**
 * PetQRCodeModal — genera un QR con la URL pública de rescate.
 *
 * URL apunta a /p/:petId. Solo es útil si el dueño activa el "modo perdido"
 * (publicProfile.enabled) — sin eso, el QR lleva a un empty state.
 *
 * El QR se genera vía api.qrserver.com (gratis, sin lib client-side).
 * Para v2: generar SVG inline para evitar dep externa.
 *
 * Acciones:
 * - Activar/desactivar modo perdido (toggle iOS-style)
 * - Editar contacto (tel/email/alertas) que verá el rescatista
 * - Descargar/imprimir el QR para collar
 */
import { useState, useEffect } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { usePet } from "../../contexts/PetContext";
import { MaterialIcon } from "../shared/MaterialIcon";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function PetQRCodeModal({ isOpen, onClose }: Props) {
  const { activePet } = usePet();
  const [enabled, setEnabled] = useState(false);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [alerts, setAlerts] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Cargar estado cuando se abre
  useEffect(() => {
    if (!isOpen || !activePet) return;
    const profile = (activePet as any).publicProfile || {};
    setEnabled(!!profile.enabled);
    setPhone(profile.ownerPhone || "");
    setEmail(profile.ownerEmail || "");
    setAlerts(profile.alerts || "");
    setError("");
  }, [isOpen, activePet]);

  if (!isOpen || !activePet) return null;

  const baseUrl =
    typeof window !== "undefined" ? window.location.origin : "https://pessy.app";
  const publicUrl = `${baseUrl}/p/${activePet.id}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&color=074738&bgcolor=F0FAF9&data=${encodeURIComponent(
    publicUrl,
  )}`;

  const handleSave = async () => {
    if (!activePet) return;
    setSaving(true);
    setError("");
    try {
      await updateDoc(doc(db, "pets", activePet.id), {
        publicProfile: {
          enabled,
          ownerPhone: phone.trim() || null,
          ownerEmail: email.trim() || null,
          alerts: alerts.trim() || null,
          updatedAt: new Date().toISOString(),
        },
      });
      onClose();
    } catch (e: any) {
      console.error("[PetQRCodeModal] save error:", e);
      setError(e?.message || "No pudimos guardar. Probá de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
      />
      <div className="fixed inset-x-0 bottom-0 z-[60] bg-white rounded-t-[24px] max-h-[92vh] overflow-y-auto pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-md mx-auto px-5 py-5">
          <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-4" />

          <div className="flex items-center justify-between mb-4">
            <h2
              className="text-xl font-extrabold text-[#074738]"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              QR de identidad
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="size-9 rounded-full bg-slate-100 flex items-center justify-center"
              aria-label="Cerrar"
            >
              <MaterialIcon name="close" className="text-lg text-slate-600" />
            </button>
          </div>

          <p
            className="text-sm text-slate-500 mb-5 leading-relaxed"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            Pegá este QR en el collar de {activePet.name}. Si alguien lo
            encuentra, escanea y te puede llamar al toque.
          </p>

          {/* QR */}
          <div className="bg-[#F0FAF9] rounded-[20px] p-6 flex items-center justify-center mb-4">
            <img
              src={qrSrc}
              alt={`QR de ${activePet.name}`}
              className="w-56 h-56"
              loading="lazy"
            />
          </div>
          <p className="text-[11px] text-center text-slate-400 mb-5 break-all">
            {publicUrl}
          </p>

          {/* Toggle modo perdido */}
          <div className="flex items-center justify-between bg-slate-50 rounded-[14px] px-4 py-3 mb-4">
            <div className="flex-1 min-w-0">
              <p
                className="text-sm font-bold text-[#074738]"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Modo perdido activo
              </p>
              <p
                className="text-[11px] text-slate-500 mt-0.5"
                style={{ fontFamily: "Manrope, sans-serif" }}
              >
                Solo se muestran datos al rescatista si está activo.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={() => setEnabled((v) => !v)}
              className={`relative w-12 h-7 rounded-full transition-colors ${
                enabled ? "bg-[#1A9B7D]" : "bg-slate-300"
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  enabled ? "translate-x-5" : ""
                }`}
              />
            </button>
          </div>

          {/* Form */}
          <div className="space-y-3 mb-4">
            <div>
              <label
                className="text-[11px] font-bold uppercase tracking-wide text-slate-500 block mb-1.5 ml-1"
                style={{ fontFamily: "Manrope, sans-serif" }}
                htmlFor="qr-phone"
              >
                Tu teléfono
              </label>
              <input
                id="qr-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+54 11 ..."
                className="w-full h-12 px-4 bg-white border border-slate-200 rounded-[12px] text-sm text-[#1A1A1A] focus:border-[#1A9B7D] focus:ring-2 focus:ring-[#1A9B7D]/20 outline-none"
                style={{ fontFamily: "Manrope, sans-serif" }}
              />
            </div>
            <div>
              <label
                className="text-[11px] font-bold uppercase tracking-wide text-slate-500 block mb-1.5 ml-1"
                style={{ fontFamily: "Manrope, sans-serif" }}
                htmlFor="qr-email"
              >
                Tu email (opcional)
              </label>
              <input
                id="qr-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="hola@example.com"
                className="w-full h-12 px-4 bg-white border border-slate-200 rounded-[12px] text-sm text-[#1A1A1A] focus:border-[#1A9B7D] focus:ring-2 focus:ring-[#1A9B7D]/20 outline-none"
                style={{ fontFamily: "Manrope, sans-serif" }}
              />
            </div>
            <div>
              <label
                className="text-[11px] font-bold uppercase tracking-wide text-slate-500 block mb-1.5 ml-1"
                style={{ fontFamily: "Manrope, sans-serif" }}
                htmlFor="qr-alerts"
              >
                Alertas médicas críticas (opcional)
              </label>
              <textarea
                id="qr-alerts"
                value={alerts}
                onChange={(e) => setAlerts(e.target.value)}
                placeholder="Ej: Toma medicación diaria. Alérgica a la penicilina."
                rows={2}
                maxLength={200}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-[12px] text-sm text-[#1A1A1A] focus:border-[#1A9B7D] focus:ring-2 focus:ring-[#1A9B7D]/20 outline-none resize-none"
                style={{ fontFamily: "Manrope, sans-serif" }}
              />
            </div>
          </div>

          {error && (
            <div className="rounded-[10px] bg-red-50 border border-red-200 px-3 py-2.5 mb-3 text-xs font-semibold text-red-700">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <a
              href={qrSrc}
              download={`pessy-qr-${activePet.name || activePet.id}.png`}
              className="min-h-[48px] rounded-[14px] border border-[#074738]/20 text-[#074738] text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              <MaterialIcon name="download" className="text-base" />
              Descargar
            </a>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="min-h-[48px] rounded-[14px] bg-[#074738] text-white text-sm font-bold disabled:opacity-50 active:scale-[0.97] transition-transform flex items-center justify-center gap-2"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              {saving ? (
                <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <MaterialIcon name="check" className="text-base" />
              )}
              Guardar
            </button>
          </div>
          <p className="text-[10px] text-center text-slate-400 mt-2">
            Pessy solo muestra datos al rescatista si modo perdido está activo.
          </p>
        </div>
      </div>
    </>
  );
}
