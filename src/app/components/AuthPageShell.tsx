import type { ReactNode } from "react";
import { Link } from "react-router";
import { Logo } from "./Logo";

interface AuthPageShellProps {
  eyebrow: string;
  title: string;
  description: string;
  highlights?: string[];
  children: ReactNode;
}

export function AuthPageShell({
  eyebrow,
  title,
  description,
  highlights = [],
  children,
}: AuthPageShellProps) {
  return (
    <div className="min-h-screen overflow-hidden bg-[#faf9ff] text-[#1a1b20]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 top-20 h-72 w-72 rounded-full bg-[#b5efd9]/40 blur-[110px]" />
        <div className="absolute -right-20 top-0 h-80 w-80 rounded-full bg-[#e3dfff]/45 blur-[130px]" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-[#ffdad3]/30 blur-[120px]" />
      </div>

      <header className="fixed inset-x-0 top-0 z-50 border-b border-[#d8e4de] bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-3">
            <Logo className="size-8" color="#074738" />
            <span
              className="text-2xl font-extrabold tracking-tight text-[#074738]"
              style={{ fontFamily: "'Plus Jakarta Sans', 'Manrope', sans-serif" }}
            >
              Pessy
            </span>
          </Link>

          <div
            className="hidden items-center gap-7 text-sm font-bold tracking-tight text-[#36584e] md:flex"
            style={{ fontFamily: "'Plus Jakarta Sans', 'Manrope', sans-serif" }}
          >
            <Link to="/">Inicio</Link>
            <Link to="/privacidad">Privacidad</Link>
            <Link to="/terminos">Terminos</Link>
            <Link to="/inicio" className="rounded-full bg-[#074738] px-5 py-2.5 text-white">
              Entrar
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto grid min-h-screen max-w-7xl items-center gap-10 px-6 pb-10 pt-28 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="max-w-xl">
          <span
            className="mb-5 inline-block rounded-full bg-[#e3dfff] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.22em] text-[#100069]"
            style={{ fontFamily: "'Plus Jakarta Sans', 'Manrope', sans-serif" }}
          >
            {eyebrow}
          </span>

          <h1
            className="mb-5 text-5xl font-extrabold leading-[1.05] tracking-tight text-[#002f24] md:text-6xl"
            style={{ fontFamily: "'Plus Jakarta Sans', 'Manrope', sans-serif" }}
          >
            {title}
          </h1>

          <p className="text-lg font-medium leading-relaxed text-[#404945] md:text-xl">
            {description}
          </p>

          {highlights.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-3">
              {highlights.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-[#dfe6e2] bg-white px-4 py-2 text-sm font-semibold text-[#074738] shadow-[0_12px_30px_-18px_rgba(0,47,36,0.15)]"
                >
                  {item}
                </span>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-[2rem] border border-[#dfe6e2] bg-white p-6 shadow-[0_32px_64px_-28px_rgba(0,47,36,0.18)] md:p-8">
          {children}
        </section>
      </main>
    </div>
  );
}
