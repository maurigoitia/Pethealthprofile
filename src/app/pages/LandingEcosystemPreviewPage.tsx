import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { SEO } from "../components/SEO";
import { Logo } from "../components/Logo";
import { detectInAppBrowser, getInAppBrowserLabel, openInSystemBrowser } from "../utils/inAppBrowser";
import {
  persistAcquisitionSource,
  resolveAcquisitionSource,
  trackAcquisitionEvent,
  withAcquisitionParams,
} from "../utils/acquisitionTracking";

/* ------------------------------------------------------------------ */
/*  CSS variables & shared inline styles (mirrors the approved HTML)  */
/* ------------------------------------------------------------------ */
const cssVars = {
  "--primary": "#3D7C7C",
  "--primary-dark": "#2A5555",
  "--primary-light": "#5A9E9E",
  "--primary-lighter": "#E8F4F4",
  "--bg": "#FFFFFF",
  "--text-primary": "#1A1A1A",
  "--text-secondary": "#6B6B6B",
  "--accent-success": "#4CAF50",
  "--accent-warning": "#FFC107",
  "--accent-danger": "#F44336",
  "--border-light": "#E5E5E5",
} as React.CSSProperties;

const fontStack =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif";

/* ------------------------------------------------------------------ */
/*  Structured data for SEO                                           */
/* ------------------------------------------------------------------ */
const faqItems = [
  {
    question: "¿Qué guarda Pessy?",
    answer:
      "Pessy junta rutinas, compras, papeles, recordatorios y lo que va pasando con tu mascota en un solo lugar.",
  },
  {
    question: "¿Pessy sirve para perros y gatos?",
    answer:
      "Sí. Pessy está pensado para acompañar la vida diaria de perros y gatos, con una experiencia simple para quien cuida.",
  },
  {
    question: "¿Qué tipo de avisos da Pessy?",
    answer:
      "Pessy te avisa cuando se acerca algo, cuando falta algo o cuando hay algo importante para seguir durante el día.",
  },
  {
    question: "¿Puedo compartir la información con otra persona?",
    answer:
      "Sí. Podés compartir lo importante con familia, guardería o con quien acompañe a tu mascota, para que todos vean lo mismo.",
  },
  {
    question: "¿Qué veo cuando entro a Pessy?",
    answer:
      "Ves lo que ya está, lo que falta y lo que se viene para tu mascota, sin tener que ordenar todo por tu cuenta.",
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

/* ------------------------------------------------------------------ */
/*  Reveal-on-scroll hook                                             */
/* ------------------------------------------------------------------ */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -100px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

function Reveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(20px)",
        transition: "opacity 0.6s ease-out, transform 0.6s ease-out",
      }}
    >
      {children}
    </div>
  );
}

/* ================================================================== */
/*  MAIN COMPONENT                                                    */
/* ================================================================== */
export default function LandingEcosystemPreviewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const isPreview = useMemo(() => location.pathname.startsWith("/preview/"), [location.pathname]);
  const acquisitionSource = useMemo(
    () => resolveAcquisitionSource(location.search, location.pathname),
    [location.pathname, location.search]
  );
  const inAppInfo = useMemo(() => detectInAppBrowser(), []);
  const [showInAppWarning, setShowInAppWarning] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const loginHref = useMemo(
    () => withAcquisitionParams("/login", acquisitionSource),
    [acquisitionSource]
  );

  /* ---- Acquisition tracking on mount ---- */
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

  /* ---- CTA handler with InApp detection ---- */
  const handleCTA = useCallback(() => {
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
    navigate(loginHref);
  }, [acquisitionSource, inAppInfo, isPreview, location.pathname, loginHref, navigate]);

  const handleOpenInBrowser = useCallback(() => {
    void trackAcquisitionEvent("pessy_acquisition_open_system_browser", {
      source: acquisitionSource,
      path: location.pathname,
      in_app_source: inAppInfo.source,
    });
    openInSystemBrowser("https://pessy.app/empezar");
  }, [acquisitionSource, inAppInfo.source, location.pathname]);

  /* ---- Smooth scroll for anchor links ---- */
  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  }, []);

  /* ================================================================ */
  /*  RENDER                                                          */
  /* ================================================================ */
  return (
    <div style={{ ...cssVars, fontFamily: fontStack, background: "#FFFFFF", color: "#1A1A1A", lineHeight: 1.6 }}>
      <SEO
        title="PESSY - Identidad digital para tus mascotas"
        description="Una plataforma que conecta clínicas veterinarias con tutores. Historial médico centralizado, documentos analizados por IA, y recordatorios automáticos."
        keywords="mascota, pet care, identidad digital, historial médico veterinario, vacunas, IA veterinaria"
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

      {/* ---------- In-App Browser Warning ---------- */}
      {showInAppWarning && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.5)",
            padding: 24,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 24,
              padding: 32,
              maxWidth: 420,
              width: "100%",
              textAlign: "center",
            }}
          >
            <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>Abrilo en tu navegador</p>
            <p style={{ fontSize: 14, color: "#6B6B6B", marginBottom: 24 }}>
              El navegador de {getInAppBrowserLabel(inAppInfo.source)} puede bloquear el acceso seguro con Google.
              Abrí Pessy en Chrome o Safari para seguir sin fricción.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <button
                type="button"
                onClick={handleOpenInBrowser}
                style={{
                  background: "#3D7C7C",
                  color: "white",
                  padding: "12px 24px",
                  borderRadius: 24,
                  border: "none",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                Abrir en navegador
              </button>
              <button
                type="button"
                onClick={() => setShowInAppWarning(false)}
                style={{
                  background: "transparent",
                  color: "#3D7C7C",
                  padding: "12px 24px",
                  borderRadius: 24,
                  border: "2px solid #3D7C7C",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                Seguir acá
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== HEADER ==================== */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "20px 60px",
          background: "#FFFFFF",
          borderBottom: "1px solid #E5E5E5",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          <Logo className="size-7" color="#3D7C7C" />
          <span style={{ fontSize: 24, fontWeight: 700, color: "#3D7C7C", letterSpacing: -0.5 }}>PESSY</span>
        </Link>

        {/* Desktop nav */}
        <nav
          className="hidden md:flex"
          style={{ gap: 40, alignItems: "center" }}
        >
          <button
            type="button"
            onClick={() => scrollTo("features")}
            style={{ textDecoration: "none", color: "#6B6B6B", fontSize: 14, fontWeight: 500, background: "none", border: "none", cursor: "pointer" }}
          >
            Características
          </button>
          <button
            type="button"
            onClick={() => scrollTo("ecosystem")}
            style={{ textDecoration: "none", color: "#6B6B6B", fontSize: 14, fontWeight: 500, background: "none", border: "none", cursor: "pointer" }}
          >
            Ecosistema
          </button>
          <button
            type="button"
            onClick={() => scrollTo("pricing")}
            style={{ textDecoration: "none", color: "#6B6B6B", fontSize: 14, fontWeight: 500, background: "none", border: "none", cursor: "pointer" }}
          >
            Precios
          </button>
          <Link
            to={loginHref}
            style={{
              background: "#3D7C7C",
              color: "white",
              padding: "10px 24px",
              borderRadius: 24,
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Contacto
          </Link>
        </nav>

        {/* Mobile hamburger */}
        <button
          type="button"
          className="md:hidden"
          onClick={() => setMobileMenuOpen((v) => !v)}
          style={{ background: "none", border: "none", fontSize: 28, cursor: "pointer", color: "#3D7C7C" }}
        >
          {mobileMenuOpen ? "✕" : "☰"}
        </button>
      </header>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div
          className="md:hidden"
          style={{
            position: "sticky",
            top: 73,
            zIndex: 99,
            background: "white",
            borderBottom: "1px solid #E5E5E5",
            padding: "16px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            textAlign: "center",
          }}
        >
          <button type="button" onClick={() => { scrollTo("features"); setMobileMenuOpen(false); }} style={{ color: "#6B6B6B", fontSize: 14, fontWeight: 500, background: "none", border: "none", cursor: "pointer" }}>Características</button>
          <button type="button" onClick={() => { scrollTo("ecosystem"); setMobileMenuOpen(false); }} style={{ color: "#6B6B6B", fontSize: 14, fontWeight: 500, background: "none", border: "none", cursor: "pointer" }}>Ecosistema</button>
          <button type="button" onClick={() => { scrollTo("pricing"); setMobileMenuOpen(false); }} style={{ color: "#6B6B6B", fontSize: 14, fontWeight: 500, background: "none", border: "none", cursor: "pointer" }}>Precios</button>
          <Link
            to={loginHref}
            onClick={() => setMobileMenuOpen(false)}
            style={{ background: "#3D7C7C", color: "white", padding: "10px 24px", borderRadius: 24, textDecoration: "none", fontSize: 14, fontWeight: 600 }}
          >
            Contacto
          </Link>
        </div>
      )}

      {/* ==================== HERO ==================== */}
      <section
        style={{
          padding: "100px 60px",
          textAlign: "center",
          background: "linear-gradient(135deg, #FFFFFF 0%, #E8F4F4 100%)",
          minHeight: 600,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
        className="!px-5 !py-16 md:!px-[60px] md:!py-[100px]"
      >
        <h1
          style={{ fontSize: "clamp(36px, 5vw, 56px)", fontWeight: 700, color: "#1A1A1A", marginBottom: 20, lineHeight: 1.2 }}
        >
          Tu mascota, sus cosas.
        </h1>
        <p
          style={{ fontSize: "clamp(28px, 4vw, 48px)", color: "#3D7C7C", fontWeight: 700, marginBottom: 30, lineHeight: 1.2 }}
        >
          Identidad digital para mascotas
        </p>
        <p
          style={{ fontSize: 18, color: "#6B6B6B", maxWidth: 600, margin: "0 auto 40px" }}
        >
          Una plataforma que conecta clínicas veterinarias con tutores. Historial médico centralizado, documentos analizados por IA, y recordatorios automáticos.
        </p>

        <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleCTA}
            className="btn-primary-landing"
            style={{
              background: "#3D7C7C",
              color: "white",
              padding: "14px 32px",
              borderRadius: 28,
              fontSize: 16,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
            }}
          >
            Descargar App
          </button>
          <button
            type="button"
            onClick={() => scrollTo("como-funciona")}
            style={{
              background: "white",
              color: "#3D7C7C",
              padding: "14px 32px",
              borderRadius: 28,
              fontSize: 16,
              fontWeight: 600,
              border: "2px solid #3D7C7C",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            ▶ Ver Demo
          </button>
        </div>

        {/* Phone mockup */}
        <div style={{ marginTop: 60, perspective: 1000 }}>
          <div
            style={{
              width: 300,
              height: 600,
              background: "#FFFFFF",
              border: "12px solid #1A1A1A",
              borderRadius: 40,
              margin: "0 auto",
              overflow: "hidden",
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15)",
              transform: "rotateX(5deg) rotateZ(-10deg)",
            }}
            className="!w-[240px] !h-[480px] md:!w-[300px] md:!h-[600px]"
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                padding: 24,
                background: "linear-gradient(135deg, #E8F4F4, #5A9E9E)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div style={{ textAlign: "center", color: "#3D7C7C", fontWeight: 600 }}>PESSY</div>
              <div
                style={{
                  background: "white",
                  borderRadius: 20,
                  padding: 20,
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
                }}
              >
                <div style={{ fontSize: 20, fontWeight: 700, color: "#1A1A1A" }}>Thor</div>
                <div style={{ fontSize: 12, color: "#6B6B6B", marginTop: 4 }}>American Bully · 4 años</div>
                <div
                  style={{
                    marginTop: 16,
                    fontSize: 12,
                    padding: "8px 12px",
                    background: "#FFF3E0",
                    borderRadius: 8,
                    color: "#E65100",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  ⚠️ Vacuna próxima en 8 días
                </div>
              </div>
              <div style={{ textAlign: "center", color: "#3D7C7C", fontWeight: 600 }}>
                Documentos · Turnos · Vacunas
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== PROBLEM ==================== */}
      <section
        id="features"
        style={{ padding: "80px 60px", background: "white" }}
        className="!px-5 !py-16 md:!px-[60px] md:!py-[80px]"
      >
        <div
          className="grid gap-10 md:grid-cols-2"
          style={{ alignItems: "center" }}
        >
          <div>
            <h3 style={{ fontSize: 28, color: "#1A1A1A", marginBottom: 20 }}>El papelito que se pierde</h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {[
                "Certificados de vacunas desperdigados",
                "Ningún recordatorio automático",
                "Múltiples veterinarios, datos incompletos",
                "Analíticas sin contexto",
                "Papeles en cajas, fotos en el celular",
              ].map((item) => (
                <li
                  key={item}
                  style={{
                    fontSize: 16,
                    color: "#6B6B6B",
                    marginBottom: 12,
                    paddingLeft: 32,
                    position: "relative",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      left: 0,
                      color: "#F44336",
                      fontSize: 20,
                      fontWeight: 700,
                    }}
                  >
                    ×
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div
            style={{
              background: "linear-gradient(135deg, #FFE8E8, #FFD4D4)",
              borderRadius: 20,
              height: 300,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 80,
            }}
          >
            📋
          </div>
        </div>
      </section>

      {/* ==================== FEATURES ==================== */}
      <section
        style={{ padding: "80px 60px" }}
        className="!px-5 !py-16 md:!px-[60px] md:!py-[80px]"
      >
        <h2
          style={{
            textAlign: "center",
            fontSize: "clamp(28px, 4vw, 42px)",
            fontWeight: 700,
            color: "#1A1A1A",
            marginBottom: 60,
          }}
        >
          Qué podés hacer con PESSY
        </h2>
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: "🏥", title: "Historial Médico", desc: "Cronología completa de salud: vacunas, consultas, medicación, estudios. Todo sincronizado y accesible en tiempo real." },
            { icon: "📱", title: "App para Tutores", desc: "Descargá libre, visualizá historiales, recibí notificaciones y gestiona múltiples mascotas desde tu teléfono." },
            { icon: "🤖", title: "Análisis IA", desc: "Procesamos documentos veterinarios automáticamente. Fotos de recetas, resultados de laboratorio, todo extraído y clasificado." },
            { icon: "🔔", title: "Recordatorios", desc: "Alertas automáticas para vacunas, medicación recurring, chequeos preventivos. El tutor nunca se olvida." },
            { icon: "☁️", title: "Acceso en la Nube", desc: "Backups automáticos, seguridad enterprise. Accede desde cualquier navegador, sin instalaciones." },
            { icon: "🔄", title: "Sincronización Tiempo Real", desc: "Clínica registra → Ficha se actualiza → Tutor notificado al instante. Todo centralizado, nada se pierde." },
          ].map((f) => (
            <Reveal key={f.title}>
              <div
                style={{
                  background: "#E8F4F4",
                  borderRadius: 24,
                  padding: 40,
                  textAlign: "center",
                  border: "1px solid #D4E8E8",
                  height: "100%",
                  transition: "transform 0.3s, box-shadow 0.3s",
                }}
                className="hover:-translate-y-2 hover:shadow-[0_12px_32px_rgba(61,124,124,0.12)]"
              >
                <div style={{ fontSize: 48, marginBottom: 20 }}>{f.icon}</div>
                <h3 style={{ fontSize: 20, color: "#1A1A1A", marginBottom: 12 }}>{f.title}</h3>
                <p style={{ fontSize: 14, color: "#6B6B6B", lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ==================== ECOSYSTEM ==================== */}
      <section
        id="ecosystem"
        style={{ padding: "80px 60px", background: "#E8F4F4" }}
        className="!px-5 !py-16 md:!px-[60px] md:!py-[80px]"
      >
        <h2
          style={{
            textAlign: "center",
            fontSize: "clamp(28px, 4vw, 42px)",
            fontWeight: 700,
            color: "#1A1A1A",
            marginBottom: 16,
          }}
        >
          El Ecosistema PESSY
        </h2>
        <p
          style={{
            textAlign: "center",
            fontSize: 16,
            color: "#6B6B6B",
            marginBottom: 40,
          }}
        >
          Conectamos todos los actores de la salud veterinaria
        </p>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: "🏥", title: "Clínicas Veterinarias", desc: "Panel de control profesional. Gestiona pacientes, registra consultas, genera reportes, integración con agenda." },
            { icon: "👨‍👩‍👧", title: "Tutores", desc: "App móvil gratuita. Acceso total al historial, documentos certificados, notificaciones y recordatorios." },
            { icon: "🛒", title: "Tiendas Veterinarias", desc: "Integración de medicamentos y accesorios. Recomendaciones contextuales basadas en el historial del tutor." },
            { icon: "📊", title: "Seguros Veterinarios", desc: "Datos validados para reclamaciones. Reportes certificados, documentación automática de incidentes." },
          ].map((item) => (
            <div
              key={item.title}
              style={{
                background: "white",
                borderRadius: 16,
                padding: 32,
                textAlign: "center",
                border: "1px solid #D4E8E8",
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 12 }}>{item.icon}</div>
              <h4 style={{ fontSize: 16, color: "#3D7C7C", marginBottom: 12, fontWeight: 600 }}>{item.title}</h4>
              <p style={{ fontSize: 13, color: "#6B6B6B" }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ==================== FLOW ==================== */}
      <section
        id="como-funciona"
        style={{ padding: "80px 60px", background: "white" }}
        className="!px-5 !py-16 md:!px-[60px] md:!py-[80px]"
      >
        <h2
          style={{
            textAlign: "center",
            fontSize: "clamp(28px, 4vw, 42px)",
            fontWeight: 700,
            color: "#1A1A1A",
            marginBottom: 16,
          }}
        >
          Cómo Funciona
        </h2>
        <p style={{ textAlign: "center", fontSize: 16, color: "#6B6B6B", marginBottom: 40 }}>
          El flujo más simple del mercado
        </p>
        <div
          className="flex flex-col items-center gap-6 md:flex-row md:justify-center md:gap-10"
          style={{ maxWidth: 900, margin: "0 auto" }}
        >
          {[
            { num: "1", title: "Clínica Registra", desc: "El veterinario completa la historia clínica, carga una vacuna, un estudio." },
            { num: "2", title: "Actualización Instantánea", desc: "El sistema valida y centraliza el expediente digital del paciente." },
            { num: "3", title: "Tutor Visualiza", desc: "Push notification + acceso en la app. Descarga certificados, comparte con otros vets." },
          ].map((step, idx) => (
            <div key={step.num} className="flex flex-col items-center md:flex-row md:gap-10" style={{ flex: 1 }}>
              {idx > 0 && (
                <div className="hidden md:block" style={{ fontSize: 32, color: "#3D7C7C", marginBottom: 20 }}>→</div>
              )}
              <Reveal className="flex-1 text-center">
                <div
                  style={{
                    width: 60,
                    height: 60,
                    background: "#3D7C7C",
                    color: "white",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 24,
                    fontWeight: 700,
                    margin: "0 auto 20px",
                  }}
                >
                  {step.num}
                </div>
                <h4 style={{ fontSize: 18, color: "#1A1A1A", marginBottom: 10 }}>{step.title}</h4>
                <p style={{ fontSize: 14, color: "#6B6B6B" }}>{step.desc}</p>
              </Reveal>
            </div>
          ))}
        </div>
      </section>

      {/* ==================== USE CASE: THOR ==================== */}
      <section
        style={{ padding: "80px 60px", background: "#E8F4F4" }}
        className="!px-5 !py-16 md:!px-[60px] md:!py-[80px]"
      >
        <h2
          style={{
            textAlign: "center",
            fontSize: "clamp(28px, 4vw, 42px)",
            fontWeight: 700,
            color: "#1A1A1A",
            marginBottom: 16,
          }}
        >
          Caso Real: Thor
        </h2>
        <p style={{ textAlign: "center", fontSize: 16, color: "#6B6B6B", marginBottom: 40 }}>
          American Bully, 4 años. Múltiples condiciones.
        </p>

        <Reveal>
          <div
            style={{
              background: "white",
              borderRadius: 24,
              padding: 48,
              textAlign: "center",
              maxWidth: 600,
              margin: "0 auto",
              border: "2px solid #3D7C7C",
            }}
            className="!p-6 md:!p-12"
          >
            <div style={{ fontSize: 64, marginBottom: 20 }}>🐕</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#3D7C7C", marginBottom: 8 }}>Thor</div>
            <div style={{ fontSize: 14, color: "#6B6B6B", marginBottom: 30 }}>
              American Bully, 4 años · Displasia de cadera · Insuficiencia hepática · Alergias extensas
            </div>

            <div
              style={{
                textAlign: "left",
                marginBottom: 30,
                padding: 24,
                background: "#E8F4F4",
                borderRadius: 16,
              }}
            >
              <h5 style={{ fontSize: 14, fontWeight: 600, color: "#3D7C7C", marginBottom: 12 }}>El Problema</h5>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {[
                  "Cartilla de vacunas en 3 clínicas diferentes",
                  "Recetas esparcidas en carpetas y fotos del celular",
                  "Medicación diaria: ¿cuál? ¿cuándo? Siempre dudando",
                  "Ningún veterinario tenía el historial completo",
                  "Vet nuevo = explicar todo de nuevo",
                ].map((item) => (
                  <li
                    key={item}
                    style={{
                      fontSize: 13,
                      color: "#6B6B6B",
                      marginBottom: 8,
                      paddingLeft: 24,
                      position: "relative",
                    }}
                  >
                    <span style={{ position: "absolute", left: 0, color: "#3D7C7C", fontWeight: 700 }}>•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div
              style={{
                fontSize: 16,
                color: "#3D7C7C",
                fontWeight: 600,
                paddingTop: 20,
                borderTop: "2px solid #E5E5E5",
              }}
            >
              ✓ Con PESSY: Un perfil centralizado. Cualquier vet ve todo. Recordatorios automáticos de medicación. Libreta sanitaria oficial. Paz mental.
            </div>
          </div>
        </Reveal>
      </section>

      {/* ==================== PRICING ==================== */}
      <section
        id="pricing"
        style={{ padding: "80px 60px", background: "white" }}
        className="!px-5 !py-16 md:!px-[60px] md:!py-[80px]"
      >
        <h2
          style={{
            textAlign: "center",
            fontSize: "clamp(28px, 4vw, 42px)",
            fontWeight: 700,
            color: "#1A1A1A",
            marginBottom: 16,
          }}
        >
          Planes
        </h2>
        <p style={{ textAlign: "center", fontSize: 16, color: "#6B6B6B", marginBottom: 40 }}>
          Elije el que funcione para vos
        </p>

        <div
          className="grid gap-8 md:grid-cols-3"
          style={{ maxWidth: 1000, margin: "0 auto" }}
        >
          {[
            {
              title: "Para Tutores",
              price: "Gratis",
              desc: "Acceso completo a la app",
              features: ["1 mascota", "Historial médico ilimitado", "Notificaciones y recordatorios", "Documentos compartibles"],
              cta: "Descargar Ahora",
              featured: false,
            },
            {
              title: "Para Clínicas",
              price: "$199",
              desc: "por mes · primeros 30 días gratis",
              features: ["Panel de control profesional", "Hasta 500 pacientes", "OCR + IA incluido", "Integración con agenda", "Reportes y analytics", "Soporte prioritario"],
              cta: "Comenzar Prueba",
              featured: true,
            },
            {
              title: "Enterprise",
              price: "Custom",
              desc: "Soluciones a medida",
              features: ["Múltiples sedes", "Integración API", "White-label disponible", "SSO y control de acceso", "Soporte 24/7"],
              cta: "Contactar Ventas",
              featured: false,
            },
          ].map((plan) => (
            <Reveal key={plan.title}>
              <div
                style={{
                  background: plan.featured ? "white" : "#E8F4F4",
                  borderRadius: 20,
                  padding: 40,
                  textAlign: "center",
                  border: plan.featured ? "2px solid #3D7C7C" : "2px solid transparent",
                  transform: plan.featured ? "scale(1.05)" : "none",
                  transition: "all 0.3s",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                }}
                className={plan.featured ? "md:scale-105 !scale-100 md:!scale-105" : ""}
              >
                <h4 style={{ fontSize: 20, color: "#1A1A1A", marginBottom: 20 }}>{plan.title}</h4>
                <div style={{ fontSize: 48, fontWeight: 700, color: "#3D7C7C", marginBottom: 10 }}>{plan.price}</div>
                <p style={{ fontSize: 13, color: "#6B6B6B", marginBottom: 30 }}>{plan.desc}</p>
                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 30px", textAlign: "left" }}>
                  {plan.features.map((feat) => (
                    <li
                      key={feat}
                      style={{
                        fontSize: 13,
                        color: "#6B6B6B",
                        marginBottom: 12,
                        paddingLeft: 24,
                        position: "relative",
                      }}
                    >
                      <span style={{ position: "absolute", left: 0, color: "#4CAF50", fontWeight: 700 }}>✓</span>
                      {feat}
                    </li>
                  ))}
                </ul>
                <div style={{ marginTop: "auto" }}>
                  <button
                    type="button"
                    onClick={handleCTA}
                    style={{
                      width: "100%",
                      padding: 12,
                      borderRadius: 20,
                      border: plan.featured ? "none" : "2px solid #3D7C7C",
                      fontWeight: 600,
                      cursor: "pointer",
                      background: plan.featured ? "#3D7C7C" : "white",
                      color: plan.featured ? "white" : "#3D7C7C",
                      fontSize: 14,
                    }}
                  >
                    {plan.cta}
                  </button>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ==================== CTA FINAL ==================== */}
      <section
        style={{
          background: "#3D7C7C",
          color: "white",
          padding: "80px 60px",
          textAlign: "center",
        }}
        className="!px-5 !py-16 md:!px-[60px] md:!py-[80px]"
      >
        <h2 style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 700, marginBottom: 20 }}>
          Tutores, clínicas, mascotas. Conectadas.
        </h2>
        <p style={{ fontSize: 18, marginBottom: 40, opacity: 0.9 }}>
          Se parte del cambio en la salud veterinaria en Latinoamérica.
        </p>

        <div
          style={{ display: "flex", maxWidth: 500, margin: "0 auto", gap: 12 }}
          className="!flex-col md:!flex-row"
        >
          <Link
            to={loginHref}
            onClick={() =>
              void trackAcquisitionEvent("pessy_acquisition_final_cta_click", {
                source: acquisitionSource,
                target: "login",
                path: location.pathname,
              })
            }
            style={{
              flex: 1,
              padding: "14px 32px",
              borderRadius: 24,
              border: "none",
              background: "white",
              color: "#3D7C7C",
              fontWeight: 600,
              fontSize: 14,
              textDecoration: "none",
              textAlign: "center",
            }}
          >
            Acceso Anticipado →
          </Link>
        </div>
        <p style={{ fontSize: 12, opacity: 0.8, marginTop: 16 }}>
          Sin spam. Sin tarjeta. Primero 500 accesos gratis.
        </p>
      </section>

      {/* ==================== FOOTER ==================== */}
      <footer
        style={{
          background: "#1A1A1A",
          color: "white",
          padding: "40px 60px",
        }}
        className="!px-5 !py-8 md:!px-[60px]"
      >
        <div className="flex flex-col items-center gap-5 md:flex-row md:justify-between">
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
              <Logo className="size-5" color="white" />
              PESSY
            </div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Tu mascota, sus cosas. Todo en orden.</div>
          </div>
          <div className="flex flex-wrap justify-center gap-5 md:gap-8">
            <Link to="/privacidad" style={{ textDecoration: "none", color: "white", fontSize: 12, opacity: 0.7 }}>Privacidad</Link>
            <Link to="/terminos" style={{ textDecoration: "none", color: "white", fontSize: 12, opacity: 0.7 }}>Términos</Link>
            <a href="/data-deletion" style={{ textDecoration: "none", color: "white", fontSize: 12, opacity: 0.7 }}>Eliminación de datos</a>
            <a href="mailto:it@pessy.app" style={{ textDecoration: "none", color: "white", fontSize: 12, opacity: 0.7 }}>Contacto</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
