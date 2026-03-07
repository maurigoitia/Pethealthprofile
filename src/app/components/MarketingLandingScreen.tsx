import { ArrowRight, BellRing, CheckCircle2, LayoutPanelTop, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "react-router";
import { Logo } from "./Logo";
import { SEO } from "./SEO";

const featureCards = [
  {
    title: "Perfil unificado",
    body: "Cada mascota tiene un solo espacio para documentos, notas y datos importantes.",
    icon: LayoutPanelTop,
  },
  {
    title: "Recordatorios utiles",
    body: "Pessy te ayuda a sostener la rutina con avisos claros y accionables.",
    icon: BellRing,
  },
  {
    title: "Datos listos para compartir",
    body: "Comparte informacion cuando la necesites con familia, cuidadores o veterinaria.",
    icon: ShieldCheck,
  },
];

const productBlocks = [
  {
    title: "Una base operativa para el dia a dia",
    body: "Centraliza informacion y evita perder contexto entre chats, fotos y papeles sueltos.",
    bullets: ["Perfil digital de mascota", "Documentos organizados", "Timeline claro"],
    image: "/phone-real.png",
    imageAlt: "Vista de la app Pessy en telefono",
  },
  {
    title: "IA orientada a orden y seguimiento",
    body: "La capa de IA interpreta contenido, estructura datos y sugiere acciones concretas para el tutor.",
    bullets: ["Lectura de documentos", "Estructura automatica", "Recordatorios por contexto"],
    image: "/team/team-cover.jpg",
    imageAlt: "Equipo fundador y mascota",
  },
];

export function MarketingLandingScreen() {
  return (
    <div className="min-h-screen bg-[#f5faf8] font-['Manrope'] text-slate-900 selection:bg-[#d9efe9] selection:text-[#074738]">
      <SEO
        title="Pessy | Identidad digital para mascotas"
        description="Pessy organiza identidad digital, documentos y recordatorios para mascotas en una experiencia moderna y clara."
        keywords="pessy, mascotas, identidad digital, app pet care, recordatorios"
        canonical="https://pessy.app/"
      />

      <header className="sticky top-0 z-50 border-b border-[#d6e6e1] bg-white/90 backdrop-blur-md">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link to="/" className="inline-flex items-center gap-2.5" aria-label="Pessy inicio">
            <Logo className="size-8" color="#074738" />
            <span className="text-xl font-black tracking-tight text-[#074738]">Pessy</span>
          </Link>

          <div className="hidden items-center gap-6 md:flex">
            <Link to="/soluciones/historial" className="text-xs font-black uppercase tracking-widest text-slate-600 hover:text-[#074738]">
              Producto
            </Link>
            <Link to="/soluciones/medicacion" className="text-xs font-black uppercase tracking-widest text-slate-600 hover:text-[#074738]">
              Soluciones
            </Link>
            <Link to="/soluciones/vacunas" className="text-xs font-black uppercase tracking-widest text-slate-600 hover:text-[#074738]">
              Recursos
            </Link>
          </div>

          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-full bg-[#074738] px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-[#074738]/20 hover:scale-[1.02]"
          >
            Entrar
            <ArrowRight size={14} />
          </Link>
        </nav>
      </header>

      <main>
        <section className="relative overflow-hidden bg-[#0a4337] px-6 pb-20 pt-16 text-white md:pb-24 md:pt-20">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-16 top-8 h-72 w-72 rounded-full bg-[#1a9b7d]/25 blur-3xl" />
            <div className="absolute right-8 top-16 h-72 w-72 rounded-full bg-[#4ed3b5]/20 blur-3xl" />
          </div>

          <div className="relative mx-auto grid max-w-7xl gap-12 md:grid-cols-[1.1fr_0.9fr] md:items-center">
            <div className="space-y-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.22em]">
                <Sparkles size={13} />
                Pet care platform
              </div>

              <h1 className="max-w-2xl text-5xl font-black leading-[0.95] tracking-tight md:text-7xl">
                La capa operativa para la vida de tu mascota.
              </h1>

              <p className="max-w-2xl text-lg font-semibold leading-relaxed text-[#d4eee6] md:text-xl">
                Inspiracion SaaS de primer nivel, adaptada a Pessy: identidad digital, documentos y recordatorios en una sola experiencia.
              </p>

              <div className="flex flex-wrap gap-3">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-3 rounded-full bg-[#1a9b7d] px-8 py-4 text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-[#1a9b7d]/35"
                >
                  Probar MVP
                  <ArrowRight size={16} />
                </Link>
                <a
                  href="https://pessy.app/login"
                  className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-6 py-4 text-sm font-black uppercase tracking-widest text-white"
                >
                  Ver login
                </a>
              </div>

              <div className="grid max-w-xl grid-cols-3 gap-2 pt-2">
                <div className="rounded-2xl border border-white/20 bg-white/10 p-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#9edfd1]">Stage</p>
                  <p className="mt-1 text-sm font-black">MVP</p>
                </div>
                <div className="rounded-2xl border border-white/20 bg-white/10 p-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#9edfd1]">Estado</p>
                  <p className="mt-1 text-sm font-black">Activo</p>
                </div>
                <div className="rounded-2xl border border-white/20 bg-white/10 p-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#9edfd1]">Producto</p>
                  <p className="mt-1 text-sm font-black">App + IA</p>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/15 bg-white/10 p-4 shadow-2xl shadow-black/30 backdrop-blur-md">
              <div className="rounded-[1.4rem] border border-white/20 bg-[#08362d] p-4">
                <div className="mb-3 flex items-center justify-between rounded-xl border border-white/15 bg-[#0b4a3d] px-3 py-2">
                  <div className="inline-flex items-center gap-2">
                    <Logo className="size-5" color="#d8f3ec" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#d8f3ec]">Pessy OS</span>
                  </div>
                  <span className="rounded-full bg-[#1a9b7d] px-2 py-1 text-[10px] font-black uppercase tracking-widest">Live</span>
                </div>

                <img
                  src="/phone-real.png"
                  alt="Vista app Pessy"
                  className="h-72 w-full rounded-2xl border border-white/10 object-cover object-top"
                  loading="lazy"
                />

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-white/15 bg-[#0b4a3d] p-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#9edfd1]">Perfil activo</p>
                    <p className="mt-1 text-xs font-black">Datos en orden</p>
                  </div>
                  <div className="rounded-xl border border-white/15 bg-[#0b4a3d] p-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#9edfd1]">Siguiente accion</p>
                    <p className="mt-1 text-xs font-black">Recordatorio listo</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-[#d6e6e1] bg-[#edf7f4] px-6 py-6">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3">
            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Construido para</span>
            {[
              "Tutores",
              "Familias",
              "Cuidadores",
              "Veterinaria",
              "Comunidad pet",
            ].map((item) => (
              <span key={item} className="rounded-full border border-[#c7dfd8] bg-white px-3 py-1.5 text-xs font-black text-[#074738]">
                {item}
              </span>
            ))}
          </div>
        </section>

        <section className="px-6 py-20">
          <div className="mx-auto max-w-7xl space-y-10">
            <div className="max-w-3xl space-y-4">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#1a9b7d]">Core</p>
              <h2 className="text-4xl font-black tracking-tight text-slate-900 md:text-5xl">Un sistema simple para coordinar mejor.</h2>
              <p className="text-lg font-semibold text-slate-600">
                Mismo patron visual de producto moderno, lenguaje y propuesta 100% Pessy.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {featureCards.map((feature) => {
                const Icon = feature.icon;
                return (
                  <article key={feature.title} className="rounded-3xl border border-[#d6e6e1] bg-white p-6 shadow-sm">
                    <div className="mb-4 inline-flex size-11 items-center justify-center rounded-2xl bg-[#e0f2f1] text-[#074738]">
                      <Icon size={22} />
                    </div>
                    <h3 className="text-xl font-black tracking-tight text-slate-900">{feature.title}</h3>
                    <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">{feature.body}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="border-y border-[#d6e6e1] bg-white px-6 py-20">
          <div className="mx-auto grid max-w-7xl gap-8">
            {productBlocks.map((block, idx) => (
              <article
                key={block.title}
                className="grid overflow-hidden rounded-3xl border border-slate-200 bg-[#f7fcfa] shadow-sm md:grid-cols-2"
              >
                <div className={`p-8 md:p-10 ${idx % 2 === 1 ? "md:order-2" : ""}`}>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1a9b7d]">Pessy stack</p>
                  <h3 className="mt-3 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">{block.title}</h3>
                  <p className="mt-4 text-base font-semibold leading-relaxed text-slate-600 md:text-lg">{block.body}</p>

                  <ul className="mt-6 space-y-2">
                    {block.bullets.map((bullet) => (
                      <li key={bullet} className="inline-flex w-full items-center gap-2 text-sm font-black text-[#074738]">
                        <CheckCircle2 size={16} className="text-[#1a9b7d]" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </div>

                <img
                  src={block.image}
                  alt={block.imageAlt}
                  className={`h-64 w-full object-cover md:h-full ${idx % 2 === 1 ? "md:order-1" : ""}`}
                  loading="lazy"
                />
              </article>
            ))}
          </div>
        </section>

        <section className="bg-[#f5faf8] px-6 py-20" aria-labelledby="founders-title">
          <div className="mx-auto max-w-7xl space-y-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1a9b7d]">Company</p>
                <h2 id="founders-title" className="mt-2 text-4xl font-black tracking-tight text-slate-900">Equipo fundador</h2>
              </div>
              <Link to="/login" className="text-xs font-black uppercase tracking-widest text-[#074738] hover:opacity-70">
                Entrar al MVP
              </Link>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <img src="/team/mauricio.jpg" alt="Mauricio Goitia" className="size-20 rounded-2xl object-cover" loading="lazy" />
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1a9b7d]">Founder</p>
                      <p className="text-xl font-black text-slate-900">Mauricio Goitia</p>
                      <a href="mailto:mauri@pessy.app" className="text-sm font-semibold text-slate-500 hover:text-[#074738]">mauri@pessy.app</a>
                    </div>
                  </div>
                  <a href="https://www.linkedin.com/in/mauriciogoitia/" target="_blank" rel="noreferrer" className="text-xs font-black uppercase tracking-widest text-[#074738] hover:opacity-70">
                    LinkedIn
                  </a>
                </div>
              </article>

              <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <img src="/team/ronald.jpg" alt="Ronald Carvajal" className="size-20 rounded-2xl object-cover" loading="lazy" />
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#1a9b7d]">Co-founder</p>
                      <p className="text-xl font-black text-slate-900">Ronald Carvajal</p>
                      <a href="mailto:ronny@pessy.app" className="text-sm font-semibold text-slate-500 hover:text-[#074738]">ronny@pessy.app</a>
                    </div>
                  </div>
                  <a href="https://www.linkedin.com/in/ronaldacarvajal/" target="_blank" rel="noreferrer" className="text-xs font-black uppercase tracking-widest text-[#074738] hover:opacity-70">
                    LinkedIn
                  </a>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="bg-[#0a4337] px-6 py-20 text-white">
          <div className="mx-auto max-w-5xl rounded-[2rem] border border-white/15 bg-white/10 p-8 text-center backdrop-blur md:p-12">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#9adbc9]">Pessy</p>
            <h2 className="mt-3 text-4xl font-black leading-tight tracking-tight md:text-5xl">Una inspiracion clara, un producto propio.</h2>
            <p className="mx-auto mt-4 max-w-3xl text-lg font-semibold leading-relaxed text-[#d4eee6]">
              Mismo estandar de maquetado moderno. Mensaje, marca y enfoque completamente Pessy.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-full bg-[#1a9b7d] px-7 py-3.5 text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-[#1a9b7d]/25"
              >
                Entrar ahora
                <ArrowRight size={16} />
              </Link>
              <Link
                to="/soluciones/historial"
                className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-7 py-3.5 text-sm font-black uppercase tracking-widest text-white"
              >
                Ver soluciones
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#d6e6e1] bg-white px-6 py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 text-center md:flex-row md:text-left">
          <div className="inline-flex items-center gap-2.5">
            <Logo className="size-7" color="#074738" />
            <span className="text-lg font-black text-[#074738]">Pessy</span>
          </div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Tu mascota, sus cosas, todo en orden.</p>
          <div className="flex items-center gap-5">
            <Link to="/soluciones/historial" className="text-xs font-black uppercase tracking-widest text-slate-600 hover:text-[#074738]">Historial</Link>
            <Link to="/soluciones/vacunas" className="text-xs font-black uppercase tracking-widest text-slate-600 hover:text-[#074738]">Vacunas</Link>
            <Link to="/soluciones/medicacion" className="text-xs font-black uppercase tracking-widest text-slate-600 hover:text-[#074738]">Medicacion</Link>
            <Link to="/login" className="text-xs font-black uppercase tracking-widest text-[#074738] hover:opacity-70">Entrar</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
