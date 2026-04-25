/**
 * WelcomeScreen — Premium style: full-bleed dark photo + gradient overlay + glass cards.
 * Tokens Plano puros (no Material 3 aliases). Logo Pessy + illustration interna.
 */
import { useNavigate } from "react-router";

const HERO_IMG = "/illustrations/dark_top_surprised_cork_head.svg";

export function WelcomeScreen() {
  const navigate = useNavigate();

  return (
    <main
      className="relative min-h-screen w-full overflow-hidden bg-[#074738]"
      style={{ fontFamily: "'Manrope', sans-serif" }}
    >
      {/* Hero full-bleed background */}
      <img
        src={HERO_IMG}
        alt=""
        className="absolute inset-0 w-full h-full object-cover opacity-80"
        aria-hidden="true"
      />

      {/* Gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(7,71,56,0.4) 0%, rgba(7,71,56,0.75) 55%, rgba(7,71,56,0.95) 100%)",
        }}
        aria-hidden="true"
      />

      {/* Content */}
      <div
        className="relative z-10 flex flex-col items-center min-h-screen max-w-md mx-auto px-6 pt-16 pb-10"
        style={{ paddingBottom: "max(2.5rem, env(safe-area-inset-bottom))" }}
      >
        {/* Logo */}
        <img
          src="/pessy-logo.svg"
          alt="Pessy"
          className="w-20 h-20 drop-shadow-lg"
          style={{ filter: "brightness(0) invert(1)" }}
        />

        {/* Headline */}
        <div className="mt-8 text-center">
          <h1
            className="text-[32px] font-extrabold text-white tracking-tight leading-[1.15]"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Tu mascota, sus cosas, todo en orden.
          </h1>
          <p className="mt-4 text-[18px] leading-relaxed text-[#F0FAF9]/90">
            La forma más simple de gestionar la vida de tus compañeros.
          </p>
        </div>

        {/* Glass cards */}
        <div className="w-full max-w-sm mt-10 space-y-3">
          <GlassCard
            icon="pets"
            title="Perfiles únicos"
            desc="Toda la info médica centralizada"
          />
          <GlassCard
            icon="notifications_active"
            title="Recordatorios"
            desc="Nunca olvides una vacuna o medicación"
          />
          <GlassCard
            icon="groups"
            title="Comunidad"
            desc="Conectá con otros tutores"
          />
        </div>

        {/* Buttons */}
        <div className="w-full max-w-sm mt-10 space-y-3">
          <button
            type="button"
            onClick={() => navigate("/register-user")}
            className="w-full py-4 bg-[#1A9B7D] text-white rounded-full shadow-lg active:scale-95 transition-transform text-[15px] font-bold"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Empezar
          </button>
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="w-full py-4 bg-white/10 hover:bg-white/20 text-white border border-white/30 rounded-full backdrop-blur-sm active:scale-95 transition-all text-[15px] font-semibold"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Iniciar Sesión
          </button>
        </div>

        {/* Footer compliance */}
        <p className="mt-8 text-center text-[11px] text-white/60 px-4 leading-relaxed">
          Al continuar aceptás{" "}
          <a href="/terminos" className="underline decoration-white/40">
            Términos
          </a>{" "}
          y{" "}
          <a href="/privacidad" className="underline decoration-white/40">
            Privacidad
          </a>
        </p>
      </div>

      {/* Decorative bottom gradient bar */}
      <div
        className="absolute bottom-0 left-0 right-0 h-1 z-20"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, #1A9B7D 50%, transparent 100%)",
        }}
        aria-hidden="true"
      />
    </main>
  );
}

function GlassCard({
  icon,
  title,
  desc,
}: {
  icon: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="bg-white/95 backdrop-blur-md p-6 rounded-xl border border-white/20 shadow-xl flex items-center gap-4">
      <div className="w-12 h-12 rounded-full bg-[#F0FAF9] flex items-center justify-center shrink-0">
        <span
          className="material-symbols-outlined"
          style={{ color: "#1A9B7D", fontSize: 24 }}
        >
          {icon}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="text-[15px] font-bold text-[#1A1A1A] leading-tight"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          {title}
        </p>
        <p className="text-[13px] text-[#6B7280] mt-0.5 leading-snug">{desc}</p>
      </div>
    </div>
  );
}
