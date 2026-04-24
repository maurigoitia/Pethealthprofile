import type { ReactNode } from "react";
import { Link } from "react-router";
import { Logo } from "../shared/Logo";
import { isNativeAppContext } from "../../utils/runtimeFlags";

interface AuthPageShellProps {
  eyebrow: string;
  title: string;
  description: string;
  highlights?: string[];
  children: ReactNode;
}

/* ── Hero illustration del design kit (local, sin dependencia externa) ── */
const heroPhoto = "/illustrations/dark_top_surprised_cork_head.svg";

/**
 * AuthPageShell — V2 UI Kit aligned.
 *
 * Mobile: gradient verde dark onboarding (matches v2 kit s-ob screen)
 * Desktop: split panel dark + light form (mantiene flow actual)
 */
export function AuthPageShell({
  eyebrow,
  title,
  description,
  highlights = [],
  children,
}: AuthPageShellProps) {
  const isApp = isNativeAppContext() ||
    (typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname));

  return (
    <div
      className="flex min-h-screen"
      style={{ fontFamily: "'Plus Jakarta Sans', 'Manrope', system-ui, sans-serif" }}
    >
      {/* ── Left: brand panel (hidden on mobile, hidden in native app) ── */}
      {!isApp && (
        <div className="relative hidden w-[45%] overflow-hidden bg-[#074738] lg:block">
          <img
            src={heroPhoto}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#074738] via-[#074738]/80 to-[#074738]/60" />

          <div className="relative z-10 flex h-full flex-col justify-between p-10">
            <Link to="/" className="flex items-center gap-3">
              <Logo className="size-9" color="#ffffff" />
              <span className="text-2xl font-extrabold tracking-tight text-white">Pessy</span>
            </Link>

            <div className="mb-16">
              <span className="mb-4 inline-block rounded-full bg-white/15 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.22em] text-[#b5efd9]">
                {eyebrow}
              </span>
              <h1 className="mb-4 text-4xl font-extrabold leading-[1.1] tracking-tight text-white xl:text-5xl">
                {title}
              </h1>
              <p className="max-w-md text-base font-medium leading-relaxed text-white/75">
                {description}
              </p>
              {highlights.length > 0 && (
                <div className="mt-6 flex flex-wrap gap-2">
                  {highlights.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-white"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <p className="text-xs font-medium text-white/40">
              Tu mascota, sus cosas, todo en orden.
            </p>
          </div>
        </div>
      )}

      {/* ── Right: form panel ── */}
      {/* MOBILE: v2 kit — gradient verde oscuro, inputs translúcidos blancos */}
      {/* DESKTOP: light form (mantiene actual) */}
      <div
        className="flex flex-1 flex-col lg:bg-[#f4f7f6]"
        style={{
          // En mobile/app: gradient dark del UI kit v2 onboarding
          // En desktop lg: override a #f4f7f6 via className arriba
          backgroundImage:
            "linear-gradient(180deg, #074738 0%, #0e5c49 55%, #1A9B7D 100%)",
        }}
      >
        {/* Logo + link ingresar top bar */}
        <header className="flex items-center justify-between px-6 pt-6 lg:hidden">
          <Link to="/" className="flex items-center gap-2.5">
            <Logo className="size-7" color="#ffffff" />
            <span className="text-xl font-extrabold tracking-tight text-white">
              Pessy
            </span>
          </Link>
          <Link
            to="/login"
            className="rounded-full border border-white/20 bg-white/10 backdrop-blur px-4 py-2 text-xs font-bold text-white"
          >
            Entrar
          </Link>
        </header>

        {/* Mobile: eyebrow + title sobre dark (v2 kit style) */}
        <div className="px-6 pt-8 pb-4 lg:hidden">
          <span
            className="mb-3 inline-block text-[10px] font-extrabold uppercase tracking-[0.25em] text-white/50"
            style={{ fontFamily: "'Manrope', sans-serif" }}
          >
            {eyebrow}
          </span>
          <h1
            className="text-[30px] font-extrabold leading-[1.08] tracking-[-0.025em] text-white"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            {title}
          </h1>
          <p
            className="mt-2 text-sm font-medium leading-relaxed text-white/55"
            style={{ fontFamily: "'Manrope', sans-serif" }}
          >
            {description}
          </p>
        </div>

        {/* Desktop-only header in the right panel */}
        <div className="hidden items-center justify-center px-5 pt-8 pb-2 lg:flex">
          <div className="flex items-center gap-2.5">
            <Logo className="size-8" color="#074738" />
            <span className="text-xl font-extrabold tracking-tight text-[#074738]">
              Pessy
            </span>
          </div>
        </div>

        {/* Form container
            Mobile: sin card, el form va directo sobre el gradient (v2 kit style)
            Desktop: card blanca centrada */}
        <div
          className="flex flex-1 items-start justify-center px-6 lg:items-center lg:px-12 lg:py-0"
          style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}
        >
          <div
            className="w-full max-w-md
                       lg:rounded-[16px] lg:border lg:border-[#E5E7EB] lg:bg-white
                       lg:p-6 lg:shadow-[0_2px_8px_rgba(0,0,0,0.04)]
                       lg:md:p-8"
          >
            {children}
          </div>
        </div>

        {/* Footer links: desktop = border top claro, mobile = texto blanco sobre dark */}
        {!isApp && (
          <>
            <div className="hidden items-center justify-center gap-4 border-t border-[#E5E7EB] bg-white px-5 py-3 text-[11px] font-medium text-[#9CA3AF] lg:flex">
              <Link to="/" className="hover:text-[#074738]">Inicio</Link>
              <span className="text-[#E5E7EB]">·</span>
              <Link to="/privacidad" className="hover:text-[#074738]">Privacidad</Link>
              <span className="text-[#E5E7EB]">·</span>
              <Link to="/terminos" className="hover:text-[#074738]">Términos</Link>
            </div>
            <div className="flex items-center justify-center gap-4 px-5 py-4 text-[11px] font-medium text-white/40 lg:hidden">
              <Link to="/" className="hover:text-white">Inicio</Link>
              <span>·</span>
              <Link to="/privacidad" className="hover:text-white">Privacidad</Link>
              <span>·</span>
              <Link to="/terminos" className="hover:text-white">Términos</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
