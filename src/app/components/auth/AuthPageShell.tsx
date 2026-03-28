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

/* ── Pet photos for the left panel (Unsplash, royalty-free) ── */
const petPhotos = [
  "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800&q=80", // golden retriever
  "https://images.unsplash.com/photo-1574158622682-e40e69881006?w=800&q=80", // orange cat
  "https://images.unsplash.com/photo-1530281700549-e82e7bf110d6?w=800&q=80", // dog on grass
];
const heroPhoto = petPhotos[Math.floor(Math.random() * petPhotos.length)];

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
    <div className="flex min-h-screen" style={{ fontFamily: "'Plus Jakarta Sans', 'Manrope', system-ui, sans-serif" }}>
      {/* ── Left: brand panel (hidden on mobile, hidden in native app) ── */}
      {!isApp && <div className="relative hidden w-[45%] overflow-hidden bg-[#074738] lg:block">
        {/* Pet photo with overlay */}
        <img
          src={heroPhoto}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#074738] via-[#074738]/80 to-[#074738]/60" />

        {/* Content */}
        <div className="relative z-10 flex h-full flex-col justify-between p-10">
          <Link to="/" className="flex items-center gap-3">
            <Logo className="size-9" color="#ffffff" />
            <span className="text-2xl font-extrabold tracking-tight text-white">
              Pessy
            </span>
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
      </div>}

      {/* ── Right: form panel ── */}
      <div className={`flex flex-1 flex-col ${isApp ? "bg-[#F0FAF9]" : "bg-[#f4f7f6]"}`}>
        {/* Mobile header — only on website */}
        {!isApp && (
          <header className="flex items-center justify-between border-b border-[#E5E7EB] bg-white px-5 py-4 lg:hidden">
            <Link to="/" className="flex items-center gap-2.5">
              <Logo className="size-7" color="#074738" />
              <span className="text-xl font-extrabold tracking-tight text-[#074738]">
                Pessy
              </span>
            </Link>
            <Link
              to="/login"
              className="rounded-full bg-[#074738] px-4 py-2 text-xs font-bold text-white"
            >
              Entrar
            </Link>
          </header>
        )}

        {/* App: minimal logo header */}
        {isApp && (
          <div className="flex items-center justify-center px-5 pt-8 pb-2">
            <div className="flex items-center gap-2.5">
              <Logo className="size-8" color="#074738" />
              <span className="text-xl font-extrabold tracking-tight text-[#074738]">
                Pessy
              </span>
            </div>
          </div>
        )}

        {/* Mobile eyebrow + title — only on website */}
        {!isApp && (
          <div className="px-5 pt-6 lg:hidden">
            <span className="mb-3 inline-block rounded-full bg-[#074738]/10 px-3.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#074738]">
              {eyebrow}
            </span>
            <h1 className="mb-2 text-2xl font-extrabold leading-tight tracking-tight text-[#074738]">
              {title}
            </h1>
            <p className="mb-5 text-sm font-medium text-[#9CA3AF]">{description}</p>
          </div>
        )}

        {/* Form card */}
        <div className={`flex flex-1 items-start justify-center px-5 ${isApp ? "py-4" : "py-6"} lg:items-center lg:px-12 lg:py-0`}>
          <div className="w-full max-w-md rounded-[16px] border border-[#E5E7EB] bg-white p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] md:p-8">
            {children}
          </div>
        </div>

        {/* Footer links — only on website */}
        {!isApp && (
          <div className="flex items-center justify-center gap-4 border-t border-[#E5E7EB] bg-white px-5 py-3 text-[11px] font-medium text-[#9CA3AF]">
            <Link to="/" className="hover:text-[#074738]">Inicio</Link>
            <span className="text-[#E5E7EB]">·</span>
            <Link to="/privacidad" className="hover:text-[#074738]">Privacidad</Link>
            <span className="text-[#E5E7EB]">·</span>
            <Link to="/terminos" className="hover:text-[#074738]">Términos</Link>
          </div>
        )}
      </div>
    </div>
  );
}
