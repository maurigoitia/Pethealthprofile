import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { Camera, Check, ExternalLink, Linkedin, Mail, Shield } from "lucide-react";
import { SEO } from "../components/shared/SEO";
import { Logo } from "../components/shared/Logo";
import { MaterialIcon } from "../components/shared/MaterialIcon";
import { ImageWithFallback } from "../components/shared/ImageWithFallback";
import { HistoryMockup, MedicationMockup, VaccinesMockup } from "../components/shared/AppMockups";
import { detectInAppBrowser, getInAppBrowserLabel, openInSystemBrowser } from "../utils/inAppBrowser";
import {
  persistAcquisitionSource,
  resolveAcquisitionSource,
  trackAcquisitionEvent,
  withAcquisitionParams,
} from "../utils/acquisitionTracking";

const howItWorks = [
  {
    step: "01",
    title: "Le contas a Pessy una vez",
    body: "Su perfil, sus papeles y las cosas importantes quedan en un solo lugar, claras y faciles de encontrar.",
    mockup: <HistoryMockup />,
  },
  {
    step: "02",
    title: "Pessy va siguiendo el dia",
    body: "Paseos, cuidados, compras y pendientes aparecen claros, para que sepas que ya esta y que falta.",
    mockup: <MedicationMockup />,
  },
  {
    step: "03",
    title: "Si falta algo, Pessy te lo dice",
    body: "Papeles, visitas y proximos pasos siempre visibles para que no se te pase nada.",
    mockup: <VaccinesMockup />,
  },
];

const trustPoints = [
  "Ves que ya esta, que falta y que se viene.",
  "Si se acerca algo, Pessy te avisa.",
  "Si se termino algo o falta algo, tambien te lo marca.",
];

const pricingPlans = [
  {
    name: "BASE",
    price: "$0",
    period: "para siempre",
    features: ["1 mascota", "perfil digital", "documentos", "carnet digital"],
    cta: "Elegir base",
    tone: "bg-white border border-[#dfe6e2] text-[#074738]",
  },
  {
    name: "PREMIUM",
    price: "Consultar",
    period: "mensual",
    features: ["compras desde Pessy", "envios premium", "alertas instantaneas", "co-tutores"],
    cta: "Quiero premium",
    tone: "bg-[#074738] border border-[#074738] text-white shadow-[0_28px_56px_-24px_rgba(7,71,56,0.45)]",
  },
  {
    name: "FAMILIAR",
    price: "Consultar",
    period: "mensual",
    features: ["hasta 4 mascotas", "todo de Premium", "compras compartidas"],
    cta: "Quiero familiar",
    tone: "bg-white border border-[#dfe6e2] text-[#074738]",
  },
];

const team = [
  {
    name: "Mauri",
    role: "Cofundador",
    image: "/team/mauri-real.jpeg",
    linkedin: "https://www.linkedin.com/in/mauriciogoitia/",
  },
  {
    name: "Ronald",
    role: "Cofundador",
    image: "/team/ronald.jpg",
    linkedin: "https://www.linkedin.com/in/ronaldacarvajal/",
  },
  {
    name: "Ary",
    role: "Marketing",
    image: "/team/founder-2.jpg",
    linkedin: "https://www.linkedin.com/in/ariannysbermudez/",
  },
  {
    name: "Thor",
    role: "CEO",
    image: "/team/founder-3.jpg",
    linkedin: "https://www.linkedin.com/company/pessy-app",
  },
];

const notifications = [
  { title: "Thor va al 50% del dia", body: "Ya hizo el paseo. Falta una compra y un cuidado.", time: "AHORA" },
  { title: "A Thor se le acaba algo", body: "Las bolsas vienen justas para esta semana.", time: "AHORA" },
  { title: "Se viene algo de Thor", body: "Hay una visita agendada para el jueves.", time: "AHORA" },
];

const ecosystemChips = [
  "Identidad digital",
  "Rutinas",
  "Compras",
  "Cuidados",
  "Papeles",
  "Co-tutores",
  "Recordatorios",
  "Servicios",
];

const faqItems = [
  {
    question: "¿Que guarda Pessy?",
    answer:
      "Pessy junta rutinas, compras, papeles, recordatorios y lo que va pasando con tu mascota en un solo lugar.",
  },
  {
    question: "¿Pessy sirve para perros y gatos?",
    answer:
      "Si. Pessy esta pensado para acompanar la vida diaria de perros y gatos, con una experiencia simple para quien cuida.",
  },
  {
    question: "¿Que tipo de avisos da Pessy?",
    answer:
      "Pessy te avisa cuando se acerca algo, cuando falta algo o cuando hay algo importante para seguir durante el dia.",
  },
  {
    question: "¿Puedo compartir la informacion con otra persona?",
    answer:
      "Si. Podes compartir lo importante con familia, guarderia o con quien acompane a tu mascota, para que todos vean lo mismo.",
  },
  {
    question: "¿Que veo cuando entro a Pessy?",
    answer:
      "Ves lo que ya esta, lo que falta y lo que se viene para tu mascota, sin tener que ordenar todo por tu cuenta.",
  },
];

const landingStructuredData = [
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  },
];

export default function LandingEcosystemPreviewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [time, setTime] = useState(new Date());
  const [activeNotification, setActiveNotification] = useState(0);
  const [leadName, setLeadName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadPetName, setLeadPetName] = useState("");
  const isPreview = useMemo(() => location.pathname.startsWith("/preview/"), [location.pathname]);
  const acquisitionSource = useMemo(
    () => resolveAcquisitionSource(location.search, location.pathname),
    [location.pathname, location.search]
  );
  const inAppInfo = useMemo(() => detectInAppBrowser(), []);
  const [showInAppWarning, setShowInAppWarning] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const entryHref = useMemo(
    () => withAcquisitionParams("/inicio", acquisitionSource),
    [acquisitionSource]
  );
  const registerHref = useMemo(
    () => withAcquisitionParams("/register-user", acquisitionSource),
    [acquisitionSource]
  );

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    const notifTimer = setInterval(() => {
      setActiveNotification((current) => (current + 1) % notifications.length);
    }, 3500);

    return () => {
      clearInterval(timer);
      clearInterval(notifTimer);
    };
  }, []);

  useEffect(() => {
    if (isPreview) return;
    persistAcquisitionSource(acquisitionSource);
    void trackAcquisitionEvent("pessy_acquisition_view", {
      source: acquisitionSource,
      path: location.pathname,
      in_app_browser: inAppInfo.isInApp,
      in_app_source: inAppInfo.source,
    });
  }, [acquisitionSource, inAppInfo.isInApp, inAppInfo.source, isPreview, location.pathname]);

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

  const formatDate = (date: Date) =>
    date
      .toLocaleDateString("es-AR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
      .replace(/^./, (char) => char.toUpperCase())
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const handleLeadSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const payload = {
      name: leadName.trim(),
      email: leadEmail.trim().toLowerCase(),
      petName: leadPetName.trim(),
    };

    if (typeof window !== "undefined") {
      window.localStorage.setItem("pessy_landing_prefill", JSON.stringify(payload));
    }

    void trackAcquisitionEvent("pessy_acquisition_lead_submit", {
      source: acquisitionSource,
      has_pet_name: Boolean(payload.petName),
      path: location.pathname,
    });

    const params = new URLSearchParams();
    if (acquisitionSource) params.set("src", acquisitionSource);
    if (payload.name) params.set("lead_name", payload.name);
    if (payload.email) params.set("lead_email", payload.email);
    if (payload.petName) params.set("lead_pet", payload.petName);
    navigate(`/register-user${params.toString() ? `?${params.toString()}` : ""}`);
  };

  const handlePrimaryEntry = () => {
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

    navigate(entryHref);
  };

  const handleOpenInBrowser = () => {
    void trackAcquisitionEvent("pessy_acquisition_open_system_browser", {
      source: acquisitionSource,
      path: location.pathname,
      in_app_source: inAppInfo.source,
    });
    openInSystemBrowser("https://pessy.app/empezar");
  };

  const handleHowItWorksClick = () => {
    void trackAcquisitionEvent("pessy_acquisition_secondary_click", {
      source: acquisitionSource,
      target: "como_funciona",
      path: location.pathname,
    });
  };

  const handlePricingClick = (planName: string) => {
    void trackAcquisitionEvent("pessy_acquisition_plan_click", {
      source: acquisitionSource,
      plan: planName.toLowerCase(),
      path: location.pathname,
    });

    if (planName === "BASE") {
      navigate(entryHref);
      return;
    }

    const target = document.getElementById("sumate");
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-[#faf9ff] text-[#1a1b20]">
      <SEO
        title="Pessy - Tu mascota, sus cosas, todo en orden"
        description="Paseos, cuidados, compras, papeles y servicios. Pessy te va diciendo que ya esta, que falta y que se viene."
        keywords="mascota, pet care, perros y gatos, rutinas, compras, papeles, recordatorios, servicios para mascotas"
        canonical={
          isPreview
            ? "https://pessy.app/preview/landing-ecosistema"
            : location.pathname === "/empezar"
              ? "https://pessy.app/empezar"
              : "https://pessy.app/"
        }
        robots={isPreview ? "noindex,nofollow" : "index,follow"}
        structuredData={landingStructuredData}
      />

      <nav className="fixed inset-x-0 top-0 z-50 border-b border-[#d8e4de] bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-3">
            <Logo className="size-8" color="#074738" />
            <span
              className="text-2xl font-extrabold tracking-tight text-[#074738]"
              style={{ fontFamily: "'Plus Jakarta Sans', 'Manrope', sans-serif" }}>
              Pessy
            </span>
          </Link>

          <div
            className="hidden items-center gap-8 text-sm font-bold tracking-tight text-[#36584e] md:flex"
            style={{ fontFamily: "'Plus Jakarta Sans', 'Manrope', sans-serif" }}>
            <a href="#identidad" className="transition-colors hover:text-[#074738]">Identidad</a>
            <a href="#como-funciona" className="transition-colors hover:text-[#074738]">Como funciona</a>
            <a href="#planes" className="transition-colors hover:text-[#074738]">Planes</a>
            <a href="#equipo" className="transition-colors hover:text-[#074738]">Equipo</a>
            <Link to={entryHref} className="rounded-full bg-[#074738] px-6 py-2.5 text-white transition-transform hover:scale-[0.98]">
              Entrar
            </Link>
          </div>

          <button type="button" className="md:hidden" onClick={() => setMobileMenuOpen((v) => !v)}>
            <MaterialIcon name={mobileMenuOpen ? "close" : "menu"} className="text-3xl text-[#074738]" />
          </button>
        </div>

        
          {mobileMenuOpen && (
            <div className="overflow-hidden border-t border-[#d8e4de] bg-white/95 backdrop-blur-xl md:hidden">
              <div
                className="flex flex-col gap-4 px-6 py-5 text-base font-bold tracking-tight text-[#36584e]"
                style={{ fontFamily: "'Plus Jakarta Sans', 'Manrope', sans-serif" }}>
                <a href="#identidad" onClick={() => setMobileMenuOpen(false)} className="transition-colors hover:text-[#074738]">Identidad</a>
                <a href="#como-funciona" onClick={() => setMobileMenuOpen(false)} className="transition-colors hover:text-[#074738]">Como funciona</a>
                <a href="#planes" onClick={() => setMobileMenuOpen(false)} className="transition-colors hover:text-[#074738]">Planes</a>
                <a href="#equipo" onClick={() => setMobileMenuOpen(false)} className="transition-colors hover:text-[#074738]">Equipo</a>
                <Link to={entryHref} onClick={() => setMobileMenuOpen(false)} className="rounded-full bg-[#074738] px-6 py-3 text-center text-white transition-transform hover:scale-[0.98]">
                  Entrar
                </Link>
              </div>
            </div>
          )}
        
      </nav>

      <main className="pt-28">
        <section className="overflow-hidden px-6 pb-20 pt-6">
          <div className="mx-auto grid max-w-7xl items-center gap-14 md:grid-cols-12">
            <div className="md:col-span-7">
              <span className="mb-6 inline-block rounded-full bg-[#e3dfff] px-4 py-1.5 text-xs font-bold tracking-[0.24em] text-[#100069]"
                style={{ fontFamily: "'Plus Jakarta Sans', 'Manrope', sans-serif" }}>
                ECOSISTEMA DIGITAL
              </span>

              <h1 className="mb-6 text-5xl font-extrabold leading-[1.06] tracking-tight text-[#074738] md:text-7xl"
                style={{ fontFamily: "'Plus Jakarta Sans', 'Manrope', sans-serif" }}>
                Tu mascota, sus cosas,
                <br />
                <span className="text-[#5048ca]">todo en orden.</span>
              </h1>

              <p className="mb-10 max-w-2xl text-xl font-medium leading-relaxed text-[#404945]">
                Paseos, cuidados, compras, visitas y papeles. Pessy te va diciendo que ya esta,
                que falta y que se viene.
              </p>

              <div className="mb-10 flex flex-col gap-4 sm:flex-row">
                <button
                  type="button"
                  onClick={handlePrimaryEntry}
                  className="rounded-full bg-[#074738] px-8 py-4 text-center text-lg font-bold text-white transition-transform hover:scale-[1.02]"
                  style={{ fontFamily: "'Plus Jakarta Sans', 'Manrope', sans-serif" }}>
                  Probar ahora
                </button>
                <a
                  href="#como-funciona"
                  onClick={handleHowItWorksClick}
                  className="flex items-center justify-center gap-2 rounded-full bg-[#f4f3f9] px-8 py-4 text-lg font-bold text-[#074738] transition-colors hover:bg-[#e8e7ed]"
                  style={{ fontFamily: "'Plus Jakarta Sans', 'Manrope', sans-serif" }}>
                  Ver como funciona
                  <MaterialIcon name="play_circle" className="text-xl" />
                </a>
              </div>

              {showInAppWarning && (
                <div className="mb-8 max-w-xl rounded-[2rem] border border-[#f2d08c] bg-[#fff7e8] p-5 text-left shadow-[0_24px_48px_-24px_rgba(0,47,36,0.12)]">
                  <p
                    className="text-sm font-bold uppercase tracking-[0.18em] text-[#8b5e00]"
                    style={{ fontFamily: "'Plus Jakarta Sans', 'Manrope', sans-serif" }}>
                    Abrilo en tu navegador
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[#5a4a24]">
                    El navegador de {getInAppBrowserLabel(inAppInfo.source)} puede bloquear el acceso seguro con Google.
                    Abrí Pessy en Chrome o Safari para seguir sin fricción.
                  </p>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={handleOpenInBrowser}
                      className="rounded-full bg-[#074738] px-5 py-3 text-sm font-bold uppercase tracking-[0.16em] text-white">
                      Abrir en navegador
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowInAppWarning(false)}
                      className="rounded-full border border-[#d7c7a0] px-5 py-3 text-sm font-bold uppercase tracking-[0.16em] text-[#8b5e00]">
                      Seguir aca
                    </button>
                  </div>
                </div>
              )}

              <span
                className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#707975]"
                style={{ fontFamily: "'Plus Jakarta Sans', 'Manrope', sans-serif" }}>
                PESSY TE VA DICIENDO QUE TOCA.
              </span>
            </div>

            <div className="relative md:col-span-5">
              <div className="absolute inset-0 scale-150 rounded-full bg-[#074738]/6 blur-[100px]" />

              <div className="relative mx-auto aspect-[9/19.5] w-full max-w-[280px] rounded-[3.5rem] bg-[#0c0c0c] p-1 shadow-2xl ring-1 ring-white/10">
                <div className="h-full w-full overflow-hidden rounded-[3.3rem] bg-black p-1.5">
                  <div className="relative h-full w-full overflow-hidden rounded-[3rem] bg-black">
                    <ImageWithFallback
                      src="https://images.unsplash.com/photo-1686419682443-5050ca21098d?auto=format&fit=crop&q=80&w=800"
                      alt="Vista previa de Pessy"
                      className="absolute inset-0 h-full w-full object-cover brightness-[0.85]"
                    />

                    <div className="absolute left-1/2 top-2 z-[100] h-6 w-24 -translate-x-1/2 rounded-full bg-black" />

                    <div className="absolute inset-0 z-30 flex flex-col items-center px-6 pt-16">
                      <div className="space-y-0.5 text-center text-white">
                        <p className="text-[10px] font-bold opacity-80">{formatDate(time)}</p>
                        <h3
                          className="text-5xl font-black tracking-tighter leading-none md:text-6xl"
                          style={{ fontFamily: "'Plus Jakarta Sans', 'Manrope', sans-serif" }}>
                          {formatTime(time)}
                        </h3>
                      </div>

                      <div className="relative mt-auto mb-10 h-20 w-full">
                        
                          <div
                            key={activeNotification} className="absolute inset-0 rounded-[1.8rem] border border-white/15 bg-white/[0.12] p-3 backdrop-blur-xl">
                            <div className="mb-1 flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <div className="flex size-4 items-center justify-center rounded bg-white p-0.5">
                                  <Logo className="size-full" color="#074738" />
                                </div>
                                <span className="text-[8px] font-black uppercase tracking-widest text-white/60">PESSY</span>
                              </div>
                              <span className="text-[8px] font-bold text-white/40">{notifications[activeNotification].time}</span>
                            </div>
                            <div className="space-y-0.5">
                              <div className="text-[10px] font-bold leading-tight text-white">
                                {notifications[activeNotification].title}
                              </div>
                              <div className="line-clamp-2 text-[9px] leading-tight text-white/80">
                                {notifications[activeNotification].body}
                              </div>
                            </div>
                          </div>
                        
                      </div>

                      <div className="mb-6 flex w-full justify-between px-2 opacity-60">
                        <Camera size={16} className="text-white" />
                        <Shield size={16} className="text-white" />
                      </div>
                    </div>

                    <div className="absolute bottom-1.5 left-1/2 z-[100] h-1 w-24 -translate-x-1/2 rounded-full bg-white/20" />
                  </div>
                </div>
              </div>

              <div className="absolute -bottom-10 -left-8 size-40 rounded-full bg-[#ffdad3] opacity-40 blur-3xl" />
              <div className="absolute -right-10 -top-10 size-52 rounded-full bg-[#e3dfff] opacity-25 blur-3xl" />
            </div>
          </div>
        </section>

        <section id="identidad" className="bg-[#f4f3f9] py-24">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mb-14 max-w-3xl">
              <h2
                className="mb-4 text-4xl font-extrabold tracking-tight text-[#074738]"
                style={{ fontFamily: "'Plus Jakarta Sans', 'Manrope', sans-serif" }}>
                Su historia comienza aqui.
              </h2>
              <p className="text-xl font-medium text-[#404945]">
                Un solo lugar para su identidad digital, sus papeles, sus rutinas, sus compras y todo lo que queres tener a mano.
              </p>
            </div>

            <div className="grid items-center gap-10 md:grid-cols-[1.1fr_0.9fr]">
              <div className="overflow-hidden rounded-[2rem] border border-[#dfe6e2] bg-white shadow-[0_28px_56px_-24px_rgba(0,47,36,0.12)]">
                <HistoryMockup />
              </div>

              <div className="space-y-6">
                <div className="rounded-[2rem] bg-white p-8 shadow-[0_24px_48px_-20px_rgba(0,47,36,0.1)]">
                  <h3
                    className="mb-3 text-2xl font-bold text-[#074738]"
                    style={{ fontFamily: "'Plus Jakarta Sans', 'Manrope', sans-serif" }}>
                    Todo organizado
                  </h3>
                  <p className="leading-relaxed text-[#404945]">
                    Fechas, documentos y momentos importantes siempre claros, sin depender de fotos perdidas o chats viejos.
                  </p>
                </div>
                <div className="rounded-[2rem] bg-white p-8 shadow-[0_24px_48px_-20px_rgba(0,47,36,0.1)]">
                  <h3
                    className="mb-3 text-2xl font-bold text-[#074738]"
                    style={{ fontFamily: "'Plus Jakarta Sans', 'Manrope', sans-serif" }}>
                    Lista para compartir
                  </h3>
                  <p className="leading-relaxed text-[#404945]">
                    Con familia, guarderia o quien la acompane. Todos ven lo mismo y nadie arranca de cero.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="como-funciona" className="py-24">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mb-14 max-w-3xl">
              <h2
                className="mb-4 text-4xl font-extrabold tracking-tight text-[#074738]"
                style={{ fontFamily: "'Plus Jakarta Sans', 'Manrope', sans-serif" }}>
                Ver como funciona
              </h2>
              <p className="text-xl font-medium text-[#404945]">
                Le contas algo a Pessy una vez. Despues ves que ya esta, que falta y que se viene.
              </p>
            </div>

            <div className="grid gap-8 lg:grid-cols-3">
              {howItWorks.map((item, index) => (
                <article
                  key={item.title} className="rounded-[2rem] border border-[#dfe6e2] bg-white p-6 shadow-[0_24px_48px_-24px_rgba(0,47,36,0.1)]">
                  <div className="mb-5 flex items-center justify-between">
                    <span
                      className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#707975]"
                      style={{ fontFamily: "'Plus Jakarta Sans', 'Manrope', sans-serif" }}>
                      Paso {item.step}
                    </span>
                    <MaterialIcon name="arrow_outward" className="text-[#074738]" />
                  </div>
                  <div className="mb-6 overflow-hidden rounded-[1.5rem] bg-[#f4f3f9]">{item.mockup}</div>
                  <h3
                    className="mb-3 text-2xl font-bold text-[#074738]"
                    style={{ fontFamily: "'Plus Jakarta Sans', 'Manrope', sans-serif" }}>
                    {item.title}
                  </h3>
                  <p className="leading-relaxed text-[#404945]">{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-6 rounded-[2.5rem] bg-[#074738] py-24 text-white">
          <div className="mx-auto grid max-w-7xl items-center gap-16 px-8 md:grid-cols-2 md:px-12">
            <div>
              <h2
                className="mb-8 text-4xl font-extrabold leading-tight md:text-5xl"
                style={{ fontFamily: "'Plus Jakarta Sans', 'Manrope', sans-serif" }}>
                Un lugar para sus rutinas, sus compras y sus cuidados.
              </h2>
              <p className="mb-10 text-lg leading-relaxed text-[#cfe7dd]">
                Pessy te va marcando lo que ya esta, lo que falta y lo que viene, sin llenarte de tecnicismos.
              </p>

              <div className="space-y-5">
                {trustPoints.map((item) => (
                  <div key={item} className="flex gap-4">
                    <Check size={20} className="mt-1 shrink-0 text-[#b5efd9]" />
                    <p className="leading-relaxed text-[#dceee8]">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-5">
              <div className="rounded-[2rem] bg-[#f7fff9] p-7 text-[#074738] shadow-[0_28px_56px_-20px_rgba(0,0,0,0.35)]">
                <div className="mb-4 flex items-center justify-between">
                  <span
                    className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#5a6d67]"
                    style={{ fontFamily: "'Plus Jakarta Sans', 'Manrope', sans-serif" }}>
                    Rutinas activas
                  </span>
                  <MaterialIcon name="pets" className="text-[#074738]" />
                </div>
                <div className="space-y-3">
                  <div className="rounded-[1.25rem] bg-[#eef5f2] p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-bold">Paseo de la tarde</span>
                      <span className="rounded-full bg-[#b5efd9] px-2 py-0.5 text-xs font-bold text-[#002018]">En orden</span>
                    </div>
                  </div>
                  <div className="rounded-[1.25rem] bg-[#eef5f2] p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-bold">Compra sugerida</span>
                      <span className="text-xs font-bold text-[#074738]">En 15 dias</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[2rem] border border-[#1f4d43] bg-[#0d3f35] p-7">
                <span
                  className="mb-3 block text-[11px] font-bold uppercase tracking-[0.25em] text-[#99d2be]"
                  style={{ fontFamily: "'Plus Jakarta Sans', 'Manrope', sans-serif" }}>
                  Tu mascota conectada
                </span>
                <div className="flex flex-wrap gap-3">
                  {ecosystemChips.map((chip) => (
                    <span key={chip} className="rounded-full border border-[#2b5b50] bg-[#134c40] px-4 py-2 text-sm font-semibold text-[#e2f4ed]">
                      {chip}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="equipo" className="py-24">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mb-14">
              <span
                className="mb-4 inline-block text-[11px] font-bold uppercase tracking-[0.25em] text-[#707975]"
                style={{ fontFamily: "'Plus Jakarta Sans', 'Manrope', sans-serif" }}>
                El equipo
              </span>
              <h2
                className="mb-4 text-4xl font-extrabold tracking-tight text-[#074738]"
                style={{ fontFamily: "'Plus Jakarta Sans', 'Manrope', sans-serif" }}>
                Las personas detras de Pessy
              </h2>
              <p className="max-w-2xl text-xl font-medium text-[#404945]">
                Estamos construyendo un sistema que se acuerda de lo importante para que cuidar sea mas simple todos los dias.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {team.map((member, index) => (
                <article
                  key={member.name} className="group">
                  <div className="overflow-hidden rounded-[2rem] border border-[#dfe6e2] bg-white shadow-[0_24px_48px_-24px_rgba(0,47,36,0.1)]">
                    <div className="relative aspect-[4/5] overflow-hidden bg-[#eef4f1]">
                      <ImageWithFallback
                        src={member.image}
                        alt={member.name}
                        className="h-full w-full object-cover grayscale transition-all duration-700 group-hover:scale-[1.03] group-hover:grayscale-0"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-5">
                        <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white backdrop-blur-md">
                          {member.role}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-5">
                      <div>
                        <h3
                          className="text-xl font-bold text-[#074738]"
                          style={{ fontFamily: "'Plus Jakarta Sans', 'Manrope', sans-serif" }}>
                          {member.name}
                        </h3>
                        <p className="text-sm font-medium text-[#9CA3AF]">{member.role}</p>
                      </div>
                      <a
                        href={member.linkedin}
                        target="_blank"
                        rel="noreferrer"
                        className="flex size-10 items-center justify-center rounded-full bg-[#f4f3f9] text-[#074738] transition-transform hover:scale-105">
                        <Linkedin size={16} />
                      </a>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="planes" className="bg-[#f4f3f9] py-24">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mx-auto mb-14 max-w-3xl text-center">
              <span
                className="mb-4 inline-block text-[11px] font-bold uppercase tracking-[0.25em] text-[#707975]"
                style={{ fontFamily: "'Plus Jakarta Sans', 'Manrope', sans-serif" }}>
                Suscripciones
              </span>
              <h2
                className="mb-4 text-4xl font-extrabold tracking-tight text-[#074738]"
                style={{ fontFamily: "'Plus Jakarta Sans', 'Manrope', sans-serif" }}>
                Nuestras suscripciones
              </h2>
              <p className="text-xl font-medium text-[#404945]">
                Cada plan conecta más. Base organiza. Premium conecta. Familiar conecta a toda la familia.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {pricingPlans.map((plan) => (
                <article key={plan.name} className={`relative rounded-[2rem] p-8 ${plan.tone}`}>
                  <div className="mb-6">
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.24em] opacity-70">{plan.name}</p>
                    <div className="flex items-end gap-2">
                      <span
                        className="text-4xl font-extrabold tracking-tight"
                        style={{ fontFamily: "'Plus Jakarta Sans', 'Manrope', sans-serif" }}>
                        {plan.price}
                      </span>
                      <span className="pb-1 text-sm font-semibold opacity-70">/ {plan.period}</span>
                    </div>
                  </div>
                  <ul className="space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-3 text-sm font-medium">
                        <Check size={16} className="shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <div className="pt-8">
                    <button
                      type="button"
                      onClick={() => handlePricingClick(plan.name)}
                      className={`block rounded-full px-5 py-3 text-center text-sm font-bold uppercase tracking-[0.18em] ${
                        plan.name === "PREMIUM"
                          ? "bg-white text-[#074738]"
                          : "bg-[#074738] text-white"
                      }`}>
                      {plan.cta}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="sumate" className="bg-[#f4f3f9] py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="rounded-[2.5rem] bg-white p-8 shadow-[0_32px_64px_-24px_rgba(0,47,36,0.14)] md:p-12">
              <div className="grid items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
                <div>
                  <span
                    className="mb-4 inline-block text-[11px] font-bold uppercase tracking-[0.25em] text-[#707975]"
                    style={{ fontFamily: "'Plus Jakarta Sans', 'Manrope', sans-serif" }}>
                    Creciendo con Pessy
                  </span>
                  <h2
                    className="mb-4 text-4xl font-extrabold tracking-tight text-[#074738]"
                    style={{ fontFamily: "'Plus Jakarta Sans', 'Manrope', sans-serif" }}>
                    Sumate a los más de 100 usuarios que ya están ordenando la vida de sus mascotas.
                  </h2>
                  <p className="text-lg font-medium leading-relaxed text-[#9CA3AF]">
                    Dejanos tus datos y te llevamos directo al alta con tu cuenta precompletada para arrancar mas rapido.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <span className="rounded-full bg-[#eef5f2] px-4 py-2 text-sm font-semibold text-[#074738]">
                      +100 usuarios
                    </span>
                    <span className="rounded-full bg-[#eef5f2] px-4 py-2 text-sm font-semibold text-[#074738]">
                      comunidad creciendo
                    </span>
                  </div>
                </div>

                <form onSubmit={handleLeadSubmit} className="grid gap-4 rounded-[2rem] border border-[#dfe6e2] bg-[#f8fafc] p-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <input
                      type="text"
                      value={leadName}
                      onChange={(event) => setLeadName(event.target.value)}
                      placeholder="Tu nombre"
                      className="w-full rounded-2xl border border-[#dfe6e2] bg-white px-4 py-4 text-sm text-[#074738] outline-none transition focus:border-[#074738] focus:ring-2 focus:ring-[#074738]/15"
                      required
                    />
                    <input
                      type="email"
                      value={leadEmail}
                      onChange={(event) => setLeadEmail(event.target.value)}
                      placeholder="Tu email"
                      className="w-full rounded-2xl border border-[#dfe6e2] bg-white px-4 py-4 text-sm text-[#074738] outline-none transition focus:border-[#074738] focus:ring-2 focus:ring-[#074738]/15"
                      required
                    />
                  </div>
                  <input
                    type="text"
                    value={leadPetName}
                    onChange={(event) => setLeadPetName(event.target.value)}
                    placeholder="Nombre de tu mascota"
                    className="w-full rounded-2xl border border-[#dfe6e2] bg-white px-4 py-4 text-sm text-[#074738] outline-none transition focus:border-[#074738] focus:ring-2 focus:ring-[#074738]/15"
                  />
                  <button
                    type="submit"
                    className="rounded-full bg-[#074738] px-6 py-4 text-center text-sm font-bold uppercase tracking-[0.18em] text-white transition-transform hover:scale-[1.01]">
                    Quiero sumarme
                  </button>
                  <p className="text-sm text-[#9CA3AF]">
                    Este formulario te lleva directo a crear tu cuenta con tus datos ya cargados.
                  </p>
                </form>
              </div>
            </div>
          </div>
        </section>

        <section className="px-6 py-24 text-center">
          <div className="mx-auto max-w-4xl rounded-[2.5rem] bg-white p-12 shadow-[0_32px_64px_-24px_rgba(0,47,36,0.14)] md:p-16">
            <h2
              className="mb-6 text-4xl font-extrabold tracking-tight text-[#074738]"
              style={{ fontFamily: "'Plus Jakarta Sans', 'Manrope', sans-serif" }}>
              Empeza a ordenar la vida de tu mascota
            </h2>
            <p className="mb-10 text-xl font-medium text-[#404945]">
              Contanos de tu mascota. Nosotros nos encargamos de ayudarte a seguirle el ritmo.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                to={registerHref}
                onClick={() =>
                  void trackAcquisitionEvent("pessy_acquisition_final_cta_click", {
                    source: acquisitionSource,
                    target: "register_user",
                    path: location.pathname,
                  })
                }
                className="inline-flex rounded-full bg-[#074738] px-10 py-4 text-lg font-extrabold text-white transition-transform hover:scale-[1.02]"
                style={{ fontFamily: "'Plus Jakarta Sans', 'Manrope', sans-serif" }}>
                Crear cuenta
              </Link>
              <a
                href="#como-funciona"
                onClick={handleHowItWorksClick}
                className="inline-flex items-center gap-2 rounded-full bg-[#f4f3f9] px-8 py-4 text-lg font-bold text-[#074738]"
                style={{ fontFamily: "'Plus Jakarta Sans', 'Manrope', sans-serif" }}>
                Ver como funciona
                <ExternalLink size={18} />
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="mt-16 rounded-t-[2rem] bg-[#052f27]">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8 md:flex-row md:items-center md:justify-between">
          <div>
            <div
              className="text-lg font-bold text-[#f1f7f4]"
              style={{ fontFamily: "'Plus Jakarta Sans', 'Manrope', sans-serif" }}>
              Pessy
            </div>
            <p className="mt-1 text-xs text-[#cfe0da]">
              Tu mascota, sus cosas, todo en orden.
            </p>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-3 text-xs text-[#cfe0da]">
            <a href="#identidad">Identidad digital</a>
            <a href="#como-funciona">Cómo funciona</a>
            <a href="#planes">Suscripciones</a>
            <Link to="/privacidad">Privacidad</Link>
            <Link to="/terminos">Términos</Link>
            <a href="/data-deletion">Eliminación de datos</a>
            <a href="mailto:it@pessy.app">it@pessy.app</a>
          </div>
        </div>

        <div className="mx-auto max-w-7xl border-t border-[#1f4d43] px-6 pb-6 pt-4">
          <p className="text-center text-[10px] uppercase tracking-[0.16em] text-[#9ab5ad]">
            Pessy organiza informacion y acompana el cuidado diario.
          </p>
        </div>
      </footer>
    </div>
  );
}
