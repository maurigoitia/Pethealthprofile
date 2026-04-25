/**
 * LoginStitchPreviewPage — preview del rediseño LoginScreen basado en
 * Stitch (project 6178600823871648647) con tokens Plano + logo Pessy.
 *
 * Reglas:
 * - Solo vista, NO toca AuthContext / firebase.ts (regla del proyecto)
 * - Todos los handlers son no-op (alert) para preview
 * - URL: /preview/login-stitch (solo en dev/QA)
 * - Si el dueño aprueba el diseño, se hace port quirúrgico al LoginScreen real
 *
 * Mapeo Stitch → Plano:
 *   bg-surface (#f6f9ff)              → #F0FAF9
 *   primary-container (#2d9cdb cyan)  → #1A9B7D (accent Plano)
 *   on-surface                        → #1A1A1A / #074738
 *   on-surface-variant                → #6B7280
 *   surface-container-low             → white con borde #E5E7EB
 *   outline-variant                   → #E5E7EB
 */
import { useState } from "react";

const HERO_IMG = "/illustrations/dark_top_surprised_cork_head.svg";

export default function LoginStitchPreviewPage() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div
      className="min-h-screen bg-[#F0FAF9]"
      style={{ fontFamily: "'Manrope', sans-serif" }}
    >
      <div className="min-h-screen flex flex-col max-w-md mx-auto bg-[#F0FAF9] overflow-hidden relative">
        {/* Hero — pet illustration con gradiente de fade al fondo */}
        <div className="h-64 relative overflow-hidden flex items-end px-5 pb-6">
          <div className="absolute inset-0 z-0">
            <img
              src={HERO_IMG}
              alt="Pessy"
              className="w-full h-full object-cover opacity-90"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#F0FAF9] via-[#F0FAF9]/40 to-transparent" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <img src="/pessy-logo.svg" alt="" className="w-9 h-9" />
              <h1
                className="text-[32px] font-extrabold text-[#074738] tracking-tight leading-none"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Pessy
              </h1>
            </div>
            <p className="text-[15px] text-[#6B7280] max-w-[260px] leading-relaxed">
              Tu mascota, sus cosas, todo en orden.
            </p>
          </div>
        </div>

        {/* Form */}
        <main className="flex-1 px-5 pt-2 pb-8">
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label
                  className="text-[12px] font-semibold text-[#6B7280] block ml-1 uppercase tracking-wide"
                  style={{ fontFamily: "'Manrope', sans-serif" }}
                  htmlFor="preview-email"
                >
                  Email
                </label>
                <input
                  id="preview-email"
                  type="email"
                  placeholder="hola@pessy.app"
                  className="w-full h-14 px-4 bg-white border border-[#E5E7EB] rounded-[14px] focus:ring-2 focus:ring-[#1A9B7D]/30 focus:border-[#1A9B7D] outline-none text-[15px] text-[#1A1A1A] placeholder:text-[#9CA3AF] transition-all"
                  style={{ fontFamily: "'Manrope', sans-serif" }}
                />
              </div>
              <div className="space-y-1.5">
                <label
                  className="text-[12px] font-semibold text-[#6B7280] block ml-1 uppercase tracking-wide"
                  style={{ fontFamily: "'Manrope', sans-serif" }}
                  htmlFor="preview-password"
                >
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    id="preview-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="w-full h-14 px-4 pr-14 bg-white border border-[#E5E7EB] rounded-[14px] focus:ring-2 focus:ring-[#1A9B7D]/30 focus:border-[#1A9B7D] outline-none text-[15px] text-[#1A1A1A] placeholder:text-[#9CA3AF] transition-all"
                    style={{ fontFamily: "'Manrope', sans-serif" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Ocultar" : "Mostrar"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] rounded-full text-[#6B7280] hover:text-[#074738] transition-colors flex items-center justify-center"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {showPassword ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
              </div>
              <div className="flex justify-end">
                <a
                  href="#"
                  className="text-[13px] font-semibold text-[#1A9B7D] hover:underline transition-all"
                  style={{ fontFamily: "'Manrope', sans-serif" }}
                  onClick={(e) => e.preventDefault()}
                >
                  ¿Olvidaste tu contraseña?
                </a>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              <button
                type="button"
                onClick={() => alert("[Preview] Login no conectado")}
                className="w-full h-14 bg-[#074738] text-white text-[15px] font-bold rounded-[16px] flex items-center justify-center gap-2 active:scale-[0.97] transition-transform shadow-[0_4px_14px_rgba(7,71,56,0.18)]"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Ingresar
              </button>

              <div className="flex items-center gap-3 py-1">
                <div className="h-px flex-1 bg-[#E5E7EB]" />
                <span
                  className="text-[11px] uppercase tracking-[0.18em] text-[#9CA3AF] font-semibold"
                  style={{ fontFamily: "'Manrope', sans-serif" }}
                >
                  o
                </span>
                <div className="h-px flex-1 bg-[#E5E7EB]" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => alert("[Preview] Google SSO no conectado")}
                  className="h-14 bg-white border border-[#E5E7EB] rounded-[14px] flex items-center justify-center gap-2 text-[14px] font-semibold text-[#1A1A1A] active:scale-[0.97] transition-transform"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                    <path
                      fill="#FFC107"
                      d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"
                    />
                    <path
                      fill="#FF3D00"
                      d="M6.3 14.7l6.6 4.8C14.7 16.2 19 13 24 13c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"
                    />
                    <path
                      fill="#4CAF50"
                      d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.5 16.2 44 24 44z"
                    />
                    <path
                      fill="#1976D2"
                      d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.2 5.2c-.4.4 6.6-4.8 6.6-14.8 0-1.3-.1-2.7-.4-3.5z"
                    />
                  </svg>
                  Google
                </button>
                <button
                  type="button"
                  onClick={() => alert("[Preview] Apple SSO no conectado")}
                  className="h-14 bg-white border border-[#E5E7EB] rounded-[14px] flex items-center justify-center gap-2 text-[14px] font-semibold text-[#1A1A1A] active:scale-[0.97] transition-transform"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#1A1A1A" aria-hidden="true">
                    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.08zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                  </svg>
                  Apple
                </button>
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="p-6 flex flex-col items-center gap-2">
          <p className="text-[14px] text-[#6B7280]">¿Aún no tienes cuenta?</p>
          <button
            type="button"
            onClick={() => alert("[Preview] Sign up no conectado")}
            className="px-6 py-2.5 rounded-full bg-[#1A9B7D]/10 text-[#1A9B7D] text-[14px] font-bold active:scale-[0.97] transition-transform"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Crear cuenta
          </button>
        </footer>

        {/* Decorative blurs (sutil, no compite con UI) */}
        <div className="absolute bottom-10 -right-10 w-40 h-40 bg-[#1A9B7D]/8 rounded-full blur-3xl -z-10" />
        <div className="absolute top-20 -left-10 w-40 h-40 bg-[#074738]/8 rounded-full blur-3xl -z-10" />

        {/* Banner preview-only */}
        <div className="fixed top-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-amber-500 text-white text-[10px] font-bold uppercase tracking-wider shadow-lg z-50">
          Preview · Login Stitch (no funcional)
        </div>
      </div>
    </div>
  );
}
