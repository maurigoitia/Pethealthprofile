import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { Check } from "lucide-react";
import { SEO } from "../components/SEO";
import { Logo } from "../components/Logo";
import { detectInAppBrowser, openInSystemBrowser } from "../utils/inAppBrowser";
import {
  persistAcquisitionSource,
  resolveAcquisitionSource,
  trackAcquisitionEvent,
  withAcquisitionParams,
} from "../utils/acquisitionTracking";

const features = [
  {
    title: "Perfil completo de tu mascota",
    body: "Toda la info en un solo lugar: vacunas, controles, alergias, medicamentos. Siempre actualizado y accesible.",
    image:
      "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=600&h=400&fit=crop&q=80",
  },
  {
    title: "Recordatorios inteligentes",
    body: "Vacunas, desparasitaciones, turnos veterinarios. Pessy te avisa antes de que te lo pierdas.",
    image:
      "https://images.unsplash.com/photo-1574158622682-e40e69881006?w=600&h=400&fit=crop&q=80",
  },
  {
    title: "Rutinas claras",
    body: "Alimentación, paseos, medicación. Todo organizado para que la rutina de tu mascota sea predecible y constante.",
    image:
      "https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=600&h=400&fit=crop&q=80",
  },
];

const stats = [
  { value: "67%", label: "olvidan algún control veterinario" },
  { value: "3+", label: "personas cuidan una mascota en promedio" },
  { value: "12", label: "controles al año" },
  { value: "1", label: "app para tener todo en orden" },
];

const coTutorBullets = [
  "Ambos ven el mismo historial y datos",
  "Los dos reciben recordatorios",
  "Cualquiera puede agregar información",
];

export default function LandingEcosystemPreviewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const isPreview = useMemo(
    () => location.pathname.startsWith("/preview/"),
    [location.pathname]
  );
  const acquisitionSource = useMemo(
    () => resolveAcquisitionSource(location.search, location.pathname),
    [location.pathname, location.search]
  );
  const inAppInfo = useMemo(() => detectInAppBrowser(), []);
  const [showInAppWarning, setShowInAppWarning] = useState(false);

  const registerHref = useMemo(
    () => withAcquisitionParams("/register-user", acquisitionSource),
    [acquisitionSource]
  );

  useEffect(() => {
    if (isPreview) return;
    persistAcquisitionSource(acquisitionSource);
    void trackAcquisitionEvent("pessy_acquisition_view", {
      source: acquisitionSource,
      path: location.pathname,
      in_app_browser: inAppInfo.isInApp,
      in_app_source: inAppInfo.source,
    });
  }, [
    acquisitionSource,
    inAppInfo.isInApp,
    inAppInfo.source,
    isPreview,
    location.pathname,
  ]);

  const handleCTA = () => {
    void trackAcquisitionEvent("pessy_acquisition_primary_click", {
      source: acquisitionSource,
      path: location.pathname,
      in_app_browser: inAppInfo.isInApp,
      in_app_source: inAppInfo.source,
    });

    if (!isPreview && inAppInfo.isInApp) {
      setShowInAppWarning(true);
      return;
    }

    navigate(registerHref);
  };

  const handleOpenInBrowser = () => {
    void trackAcquisitionEvent("pessy_acquisition_open_system_browser", {
      source: acquisitionSource,
      path: location.pathname,
      in_app_source: inAppInfo.source,
    });
    openInSystemBrowser("https://pessy.app/empezar");
  };

  return (
    <>
      <SEO
        title="Pessy — Tu mascota, sus cosas, todo en un solo lugar"
        description="La app que centraliza la salud, las rutinas y los recordatorios de tu mascota en un solo lugar."
        path={location.pathname}
      />

      <div className="min-h-screen bg-white font-['Plus_Jakarta_Sans',system-ui,sans-serif] text-[#1a1a1a]">
        {/* In-app browser warning */}
        {showInAppWarning && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
              <p className="mb-2 text-lg font-semibold text-[#074738]">
                Abrí en tu navegador
              </p>
              <p className="mb-4 text-sm text-gray-600">
                Para registrarte, necesitás abrir Pessy en Safari o Chrome.
              </p>
              <button
                onClick={handleOpenInBrowser}
                className="mb-2 w-full rounded-xl bg-[#1A9B7D] px-4 py-3 text-sm font-semibold text-white"
              >
                Abrir en navegador
              </button>
              <button
                onClick={() => setShowInAppWarning(false)}
                className="w-full rounded-xl px-4 py-3 text-sm text-gray-500"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* ── Header ── */}
        <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
            <Logo className="h-8" />
            <button
              onClick={handleCTA}
              className="rounded-full bg-[#1A9B7D] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#168a6e]"
            >
              Probar gratis
            </button>
          </div>
        </header>

        {/* ── Hero ── */}
        <section className="relative overflow-hidden bg-white">
          <div className="mx-auto max-w-6xl px-5 pb-16 pt-16 md:pb-24 md:pt-20">
            <div className="flex flex-col items-center text-center">
              <span className="mb-5 inline-block rounded-full bg-[#e6f7f2] px-4 py-1.5 text-xs font-semibold tracking-wide text-[#1A9B7D]">
                Acceso anticipado
              </span>
              <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight tracking-tight text-[#074738] md:text-5xl lg:text-6xl">
                Tu mascota, sus cosas, todo en{" "}
                <span className="text-[#1A9B7D]">un solo lugar</span>
              </h1>
              <p className="mx-auto mt-5 max-w-xl text-lg text-gray-600 md:text-xl">
                La app que centraliza la salud, las rutinas y los recordatorios
                de tu mascota en un solo lugar.
              </p>
              <button
                onClick={handleCTA}
                className="mt-8 rounded-full bg-[#1A9B7D] px-8 py-4 text-base font-bold text-white shadow-lg shadow-[#1A9B7D]/25 transition hover:bg-[#168a6e] md:text-lg"
              >
                Quiero probar Pessy
              </button>
              <p className="mt-3 text-sm text-gray-400">
                Gratis. Sin tarjeta de crédito.
              </p>
            </div>
            <div className="mt-12 overflow-hidden rounded-3xl md:mt-16">
              <img
                src="https://images.unsplash.com/photo-1623387641168-d9803ddd3f35?w=1200&h=600&fit=crop&q=80"
                alt="Gato y perro juntos"
                className="h-64 w-full object-cover md:h-[420px]"
                loading="eager"
              />
            </div>
          </div>
        </section>

        {/* ── Problem ── */}
        <section className="bg-[#fafbfa] py-20 md:py-28">
          <div className="mx-auto max-w-3xl px-5 text-center">
            <span className="mb-4 inline-block rounded-full bg-[#e6f7f2] px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-[#1A9B7D]">
              El problema
            </span>
            <h2 className="text-3xl font-extrabold text-[#074738] md:text-4xl">
              ¿Te pasó alguna vez?
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-gray-600">
              No te acordabas cuándo fue su última vacuna. No sabías si tu
              pareja iba a comprar el alimento. El turno del veterinario quedó
              en un chat perdido.
            </p>
            <p className="mt-4 text-lg font-semibold text-[#074738]">
              La vida con mascotas tiene muchas partes móviles. Pessy las pone
              en orden.
            </p>
          </div>
        </section>

        {/* ── Features ── */}
        <section className="py-20 md:py-28">
          <div className="mx-auto max-w-6xl px-5">
            <div className="space-y-16 md:space-y-24">
              {features.map((f, i) => (
                <div
                  key={f.title}
                  className={`flex flex-col items-center gap-8 md:flex-row md:gap-12 ${
                    i % 2 === 1 ? "md:flex-row-reverse" : ""
                  }`}
                >
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-[#074738] md:text-3xl">
                      {f.title}
                    </h3>
                    <p className="mt-3 text-lg leading-relaxed text-gray-600">
                      {f.body}
                    </p>
                  </div>
                  <div className="w-full flex-1">
                    <img
                      src={f.image}
                      alt={f.title}
                      className="h-64 w-full rounded-2xl object-cover shadow-lg md:h-80"
                      loading="lazy"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Stats ── */}
        <section className="bg-[#074738] py-20 md:py-28">
          <div className="mx-auto max-w-4xl px-5 text-center">
            <h2 className="mb-12 text-3xl font-extrabold text-white md:text-4xl">
              Números que importan
            </h2>
            <div className="grid grid-cols-2 gap-8 md:gap-12">
              {stats.map((s) => (
                <div key={s.value}>
                  <p className="text-4xl font-extrabold text-[#1A9B7D] md:text-5xl">
                    {s.value}
                  </p>
                  <p className="mt-2 text-sm text-gray-300 md:text-base">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Co-tutor ── */}
        <section className="py-20 md:py-28">
          <div className="mx-auto max-w-6xl px-5">
            <div className="flex flex-col items-center gap-10 md:flex-row md:gap-16">
              <div className="flex-1">
                <span className="mb-4 inline-block rounded-full bg-[#e6f7f2] px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-[#1A9B7D]">
                  Compartí el cuidado
                </span>
                <h2 className="mt-2 text-3xl font-extrabold text-[#074738] md:text-4xl">
                  Invitá un co-tutor
                </h2>
                <p className="mt-4 text-lg leading-relaxed text-gray-600">
                  Tu pareja, tu roommate, un familiar. Quien también cuide a tu
                  mascota puede tener acceso a toda la información y recibir
                  recordatorios.
                </p>
                <ul className="mt-6 space-y-3">
                  {coTutorBullets.map((b) => (
                    <li key={b} className="flex items-center gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1A9B7D] text-white">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                      <span className="text-gray-700">{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="w-full flex-1">
                <img
                  src="https://images.unsplash.com/photo-1544568100-847a948585b9?w=600&h=500&fit=crop&q=80"
                  alt="Persona con perro"
                  className="h-80 w-full rounded-2xl object-cover shadow-lg md:h-96"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── Quote ── */}
        <section className="bg-[#fafbfa] py-16 md:py-24">
          <div className="mx-auto max-w-3xl px-5 text-center">
            <blockquote className="text-2xl font-medium italic leading-relaxed text-[#074738] md:text-3xl">
              &ldquo;La idea es simple: que no se te pase nada importante de tu
              mascota, nunca más.&rdquo;
            </blockquote>
            <p className="mt-6 text-base font-semibold text-gray-500">
              — Equipo Pessy
            </p>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="bg-[#1A9B7D] py-20 md:py-28">
          <div className="mx-auto max-w-3xl px-5 text-center">
            <h2 className="text-3xl font-extrabold text-white md:text-4xl">
              ¿Querés organizar la vida con tu mascota?
            </h2>
            <p className="mx-auto mt-4 max-w-md text-lg text-white/80">
              Sumate al acceso anticipado. Gratis, sin compromisos.
            </p>
            <button
              onClick={handleCTA}
              className="mt-8 rounded-full bg-white px-8 py-4 text-base font-bold text-[#074738] shadow-lg transition hover:bg-gray-50 md:text-lg"
            >
              Crear mi cuenta gratis
            </button>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="border-t border-gray-100 bg-white py-10">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-5">
            <Logo className="h-7" />
            <div className="flex gap-4 text-sm text-gray-500">
              <Link to="/legal/terms" className="hover:text-[#074738]">
                Términos
              </Link>
              <span>·</span>
              <Link to="/legal/privacy" className="hover:text-[#074738]">
                Privacidad
              </Link>
              <span>·</span>
              <a
                href="mailto:hola@pessy.app"
                className="hover:text-[#074738]"
              >
                Contacto
              </a>
            </div>
            <p className="text-xs text-gray-400">
              &copy; 2025 Pessy. Todos los derechos reservados.
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
