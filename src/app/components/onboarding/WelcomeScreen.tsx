import { Link, useNavigate } from "react-router";

export function WelcomeScreen() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F0FAF9] font-['Manrope'] text-slate-900">
      <header className="mx-auto max-w-5xl px-5 pt-5">
        <div className="rounded-[2rem] border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between">
            <Link to="/" className="inline-flex items-center gap-2" aria-label="Pessy inicio">
              <img src="/pessy-logo.svg" alt="Pessy" className="size-7" />
              <span className="text-3xl font-black tracking-tight text-[#074738]">Pessy</span>
            </Link>

            <div className="flex items-center gap-3">
              <span className="text-lg font-black uppercase text-slate-500">ES</span>
              <button
                onClick={() => navigate("/login")}
                className="rounded-full bg-[#1A9B7D] px-6 py-2.5 text-sm font-black uppercase tracking-widest text-white">
                Entrar
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="px-5 pb-16 pt-8">
        <div className="mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[#074738]/20 bg-[#074738]/8 px-3 py-1 text-xs font-bold uppercase tracking-widest text-[#074738] mb-6">
            <span className="size-1.5 rounded-full bg-[#074738] animate-pulse inline-block" />
            AI-powered
          </div>
          <h1 className="mx-auto max-w-3xl text-6xl font-black leading-[0.95] tracking-tight text-slate-900 md:text-8xl">
            Porque quererlo ya es suficiente trabajo.
          </h1>
          <p className="mx-auto mt-8 max-w-3xl text-2xl font-semibold leading-relaxed text-slate-500 md:text-3xl">
            Pessy lo maneja. Vos lo disfrutás.
          </p>

          <button
            onClick={() => navigate("/login")}
            className="mt-10 rounded-full bg-[#074738] px-14 py-5 text-2xl font-black text-white shadow-xl shadow-[#074738]/30">
            Probar ahora
          </button>
          <p className="mt-8 text-sm font-black uppercase tracking-[0.35em] text-slate-400">PESSY LO MANEJA. VOS LO DISFRUTÁS.</p>
        </div>
      </main>
    </div>
  );
}
