/**
 * WelcomeScreen — onboarding inicial. Stitch-style port + tokens Plano + logo Pessy.
 * Hero de 530px con illustration + chip flotante de marca + content card abajo.
 */
import { useNavigate } from "react-router";

const HERO_IMG = "/illustrations/dark_top_surprised_cork_head.svg";

export function WelcomeScreen() {
  const navigate = useNavigate();

  return (
    <main
      className="min-h-screen flex flex-col max-w-md mx-auto relative overflow-hidden bg-white"
      style={{ fontFamily: "'Manrope', sans-serif" }}
    >
      {/* Hero — illustration sobre gradient verde */}
      <div className="relative h-[480px] sm:h-[530px] w-full overflow-hidden bg-gradient-to-b from-[#074738] to-[#0e5c49]">
        <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent z-10" />
        <img
          src={HERO_IMG}
          alt=""
          className="absolute inset-0 w-full h-full object-contain object-bottom opacity-90 scale-110"
        />

        {/* Chip de marca flotante */}
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

      {/* Content section con overlap del hero */}
      <div
        className="flex-1 flex flex-col justify-end px-5 pb-12 relative z-20 -mt-24 bg-white rounded-t-[32px] pt-8"
        style={{ paddingBottom: "max(3rem, env(safe-area-inset-bottom))" }}
      >
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

          {/* Acciones */}
          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={() => navigate("/register-user")}
              className="group w-full h-14 bg-[#074738] hover:bg-[#0e5c49] active:scale-[0.98] transition-all duration-200 rounded-full flex items-center justify-center gap-3 shadow-[0_8px_30px_rgba(7,71,56,0.25)]"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              <span className="text-[15px] text-white font-bold">Empezar</span>
              <span className="material-symbols-outlined text-white text-[20px]">
                arrow_forward
              </span>
            </button>

            <button
              type="button"
              onClick={() => navigate("/login")}
              className="w-full h-14 bg-[#F0FAF9] hover:bg-[#E0F2F1] active:scale-[0.98] transition-all duration-200 rounded-full flex items-center justify-center"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              <span className="text-[14px] text-[#6B7280] font-semibold">
                Ya tengo cuenta
              </span>
            </button>
          </div>
        </div>

        {/* Footer compliance */}
        <p className="mt-8 text-center text-[11px] text-[#9CA3AF] px-6 leading-relaxed">
          Al continuar aceptás los{" "}
          <a
            href="/terminos"
            className="text-[#1A9B7D] font-semibold underline decoration-[#1A9B7D]/30"
          >
            Términos
          </a>{" "}
          y la{" "}
          <a
            href="/privacidad"
            className="text-[#1A9B7D] font-semibold underline decoration-[#1A9B7D]/30"
          >
            Política de Privacidad
          </a>
          .
        </p>
      </div>

      {/* Decorative blurs sutiles */}
      <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-[#1A9B7D]/8 rounded-full blur-3xl -z-10" />
      <div className="absolute top-1/2 -right-32 w-80 h-80 bg-[#074738]/6 rounded-full blur-3xl -z-10" />
    </main>
  );
}
