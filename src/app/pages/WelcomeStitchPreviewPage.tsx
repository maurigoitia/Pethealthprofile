/**
 * WelcomeStitchPreviewPage — preview del rediseño WelcomeScreen basado
 * en Stitch (project 6178600823871648647) con tokens Plano + logo Pessy.
 *
 * Reglas:
 * - Solo vista, NO toca AuthContext / firebase.ts
 * - Handlers no-op para preview (alert)
 * - URL: /preview/welcome-stitch (solo en dev/QA)
 *
 * Mapeo Stitch → Plano (ver LoginStitchPreviewPage para más detalle).
 */
import { useNavigate } from "react-router";

// Hero illustration de Pessy (no foto stock — usar lo que ya tenemos)
const HERO_IMG = "/illustrations/dark_top_surprised_cork_head.svg";

export default function WelcomeStitchPreviewPage() {
  const navigate = useNavigate();

  return (
    <main
      className="min-h-screen flex flex-col max-w-md mx-auto relative overflow-hidden bg-white"
      style={{ fontFamily: "'Manrope', sans-serif" }}
    >
      {/* Hero (asymmetric layout, ocupa el 60% inicial) */}
      <div className="relative h-[530px] w-full overflow-hidden bg-gradient-to-b from-[#074738] to-[#0e5c49]">
        <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent z-10" />
        <img
          src={HERO_IMG}
          alt="Pessy"
          className="absolute inset-0 w-full h-full object-contain object-bottom opacity-90 scale-110"
        />

        {/* Branding chip flotante con backdrop blur */}
        <div className="absolute top-12 left-0 right-0 flex justify-center z-20">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-xl border border-white/30">
            <img src="/pessy-logo.svg" alt="" className="w-6 h-6" />
            <span
              className="text-[18px] font-extrabold text-white tracking-tight"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Pessy
            </span>
          </div>
        </div>
      </div>

      {/* Content section (overlap con hero via -mt-20) */}
      <div className="flex-1 flex flex-col justify-end px-5 pb-12 relative z-20 -mt-24 bg-white rounded-t-[32px] pt-8">
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-[#1A9B7D]/10 border border-[#1A9B7D]/20">
              <span
                className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#1A9B7D]"
                style={{ fontFamily: "'Manrope', sans-serif" }}
              >
                Tu mascota, todo en orden
              </span>
            </div>
            <h1
              className="text-[32px] font-extrabold text-[#074738] leading-[1.1] tracking-tight"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Bienvenido a <span className="text-[#1A9B7D]">Pessy</span>
            </h1>
            <p className="text-[16px] text-[#6B7280] max-w-[320px] leading-relaxed">
              La forma más simple de organizar la salud, las rutinas y los
              papeles de tu mascota.
            </p>
          </div>

          {/* Action cluster */}
          <div className="space-y-3 pt-2">
            {/* Primary CTA */}
            <button
              type="button"
              onClick={() => alert("[Preview] Get started no conectado")}
              className="group w-full h-14 bg-[#074738] hover:bg-[#0e5c49] active:scale-[0.98] transition-all duration-200 rounded-full flex items-center justify-center gap-3 shadow-[0_8px_30px_rgba(7,71,56,0.25)]"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              <span className="text-[15px] text-white font-bold">Empezar</span>
              <span className="material-symbols-outlined text-white text-[20px]">
                arrow_forward
              </span>
            </button>

            {/* Secondary CTA */}
            <div className="flex flex-col items-center gap-4 pt-1">
              <button
                type="button"
                onClick={() => navigate("/preview/login-stitch")}
                className="w-full h-14 bg-[#F0FAF9] hover:bg-[#E0F2F1] active:scale-[0.98] transition-all duration-200 rounded-full flex items-center justify-center"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                <span className="text-[14px] text-[#6B7280] font-semibold">
                  Ya tengo cuenta
                </span>
              </button>

              <div className="flex items-center gap-2">
                <div className="w-8 h-px bg-[#E5E7EB]" />
                <span
                  className="text-[10px] uppercase tracking-[0.18em] text-[#9CA3AF] font-semibold"
                  style={{ fontFamily: "'Manrope', sans-serif" }}
                >
                  o continuá con
                </span>
                <div className="w-8 h-px bg-[#E5E7EB]" />
              </div>

              {/* Social options */}
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => alert("[Preview] Google no conectado")}
                  aria-label="Google"
                  className="w-12 h-12 rounded-full border border-[#E5E7EB] flex items-center justify-center hover:bg-[#F0FAF9] active:scale-90 transition-all"
                >
                  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
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
                </button>
                <button
                  type="button"
                  onClick={() => alert("[Preview] Apple no conectado")}
                  aria-label="Apple"
                  className="w-12 h-12 rounded-full border border-[#E5E7EB] flex items-center justify-center hover:bg-[#F0FAF9] active:scale-90 transition-all"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#1A1A1A" aria-hidden="true">
                    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.08zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer compliance */}
        <p className="mt-8 text-center text-[11px] text-[#9CA3AF] px-6 leading-relaxed">
          Al continuar aceptás los{" "}
          <a
            href="/terminos"
            className="text-[#1A9B7D] font-semibold underline decoration-[#1A9B7D]/30"
            onClick={(e) => e.preventDefault()}
          >
            Términos
          </a>{" "}
          y la{" "}
          <a
            href="/privacidad"
            className="text-[#1A9B7D] font-semibold underline decoration-[#1A9B7D]/30"
            onClick={(e) => e.preventDefault()}
          >
            Política de Privacidad
          </a>
          .
        </p>
      </div>

      {/* Decorative blurs */}
      <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-[#1A9B7D]/8 rounded-full blur-3xl -z-10" />
      <div className="absolute top-1/2 -right-32 w-80 h-80 bg-[#074738]/6 rounded-full blur-3xl -z-10" />

      {/* Banner preview-only */}
      <div className="fixed top-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-amber-500 text-white text-[10px] font-bold uppercase tracking-wider shadow-lg z-50">
        Preview · Welcome Stitch (no funcional)
      </div>
    </main>
  );
}
