/**
 * EmpezarLandingPage — Landing de acceso anticipado con fotos reales (Pessy branding v2)
 *
 * Ruta: /empezar
 * NO toca login, registro, ni backend. Solo es una landing estática con CTA.
 */
import { useNavigate } from "react-router";
import { SEO } from "../components/SEO";

const unsplash = (id: string, w = 800, h = 500) =>
  `https://images.unsplash.com/${id}?w=${w}&h=${h}&fit=crop`;

const photos = {
  herodog: unsplash("photo-1587300003388-59208cc962cb"),
  cat: unsplash("photo-1592194996308-7b43878e84a6"),
  puppy: unsplash("photo-1601758228041-f3b2795255f1", 600, 400),
  dogRelax: unsplash("photo-1586671267731-da2cf3ceeb80", 600, 400),
  catSun: unsplash("photo-1526336024174-e58f5cdd8e13", 600, 400),
  dogPortrait: unsplash("photo-1583511655857-d19b40a7a54e", 400, 300),
  catPortrait: unsplash("photo-1574158622682-e40e69881006", 400, 300),
  dogsRunning: unsplash("photo-1548199973-03cce0bbc87b", 600, 400),
  dogSmile: unsplash("photo-1544568100-847a948585b9", 200, 200),
};

export default function EmpezarLandingPage() {
  const navigate = useNavigate();
  const goRegister = () => navigate("/register-user");

  return (
    <>
      <SEO title="Pessy — Tu mascota, sus cosas, todo en orden" />
      <div style={{ fontFamily: "'Manrope', sans-serif", background: "#fff", color: "#333", maxWidth: 430, margin: "0 auto", overflowX: "hidden" }}>

        {/* ── NAV ── */}
        <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(7,71,56,0.97)", backdropFilter: "blur(12px)", padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src="https://pessy.app/pessy-logo.svg" alt="Pessy" style={{ height: 40, filter: "brightness(0) invert(1)" }} />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 18, color: "#fff", letterSpacing: "0.06em", lineHeight: 1 }}>PESSY</span>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", fontWeight: 500, marginTop: 2 }}>Tu mascota, todo en orden</span>
            </div>
          </div>
          <button onClick={goRegister} style={{ background: "#1A9B7D", color: "#fff", fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 13, padding: "10px 20px", borderRadius: 10, border: "none", cursor: "pointer" }}>
            Probar gratis
          </button>
        </nav>

        {/* ── HERO ── */}
        <section style={{ position: "relative", height: 520, overflow: "hidden" }}>
          <img src={photos.herodog} alt="Perro feliz" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(to top, #074738 0%, rgba(7,71,56,0.8) 40%, rgba(7,71,56,0.2) 70%, transparent 100%)", padding: "120px 24px 36px" }}>
            <span style={{ display: "inline-block", background: "rgba(26,155,125,0.3)", border: "1px solid rgba(26,155,125,0.5)", color: "#fff", fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 20, marginBottom: 16, backdropFilter: "blur(4px)" }}>Acceso anticipado</span>
            <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 32, fontWeight: 800, color: "#fff", lineHeight: 1.15, marginBottom: 12 }}>
              Tu mascota, sus cosas,<br />todo en <em style={{ fontStyle: "normal", color: "#1A9B7D" }}>orden</em>.
            </h1>
            <p style={{ fontSize: 16, color: "rgba(255,255,255,0.85)", lineHeight: 1.5, marginBottom: 24 }}>
              La app que centraliza la salud, las rutinas y los recordatorios de tu mascota en un solo lugar.
            </p>
            <button onClick={goRegister} style={{ display: "block", width: "100%", textAlign: "center", background: "#1A9B7D", color: "#fff", fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 17, padding: 18, borderRadius: 14, border: "none", cursor: "pointer" }}>
              Quiero probar Pessy
            </button>
            <p style={{ textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 10 }}>Gratis. Sin tarjeta de crédito.</p>
          </div>
        </section>

        {/* ── PHOTO MOSAIC ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3 }}>
          <img src={photos.cat} alt="Gato" style={{ width: "100%", height: 180, objectFit: "cover", gridColumn: "1 / -1" }} />
          <img src={photos.dogPortrait} alt="Perro" style={{ width: "100%", height: 140, objectFit: "cover" }} />
          <img src={photos.catPortrait} alt="Gato" style={{ width: "100%", height: 140, objectFit: "cover" }} />
        </div>

        {/* ── PROBLEM ── */}
        <section style={{ padding: "48px 24px" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#1A9B7D", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8, display: "block" }}>El problema</span>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 24, fontWeight: 800, color: "#074738", lineHeight: 1.2, marginBottom: 12 }}>¿Te pasó alguna vez?</h2>
          <p style={{ fontSize: 15, color: "#555", lineHeight: 1.65 }}>
            No te acordás cuándo fue la última vacuna. No sabés si tu pareja ya compró el alimento. El turno del veterinario quedó en un chat perdido. La vida con mascotas tiene muchas partes móviles. Pessy las pone en orden.
          </p>
        </section>

        {/* ── FEATURE CARDS ── */}
        <div style={{ padding: "0 24px 48px", display: "flex", flexDirection: "column", gap: 16 }}>
          {[
            { img: photos.puppy, title: "Perfil completo de tu mascota", desc: "Toda la info en un solo lugar: vacunas, controles, alergias, medicamentos. Siempre actualizado y accesible." },
            { img: photos.dogRelax, title: "Recordatorios inteligentes", desc: "Vacunas, desparasitaciones, turnos veterinarios. Pessy te avisa antes de que se te pase." },
            { img: photos.catSun, title: "Rutinas claras", desc: "Alimentación, paseos, medicación. Todo organizado para que la rutina de tu mascota sea predecible y saludable." },
          ].map((f) => (
            <div key={f.title} style={{ background: "#F0FAF9", borderRadius: 18, overflow: "hidden", border: "1px solid #E0F2F1" }}>
              <img src={f.img} alt={f.title} style={{ width: "100%", height: 160, objectFit: "cover" }} />
              <div style={{ padding: 20 }}>
                <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 17, fontWeight: 700, color: "#074738", marginBottom: 6 }}>{f.title}</h3>
                <p style={{ fontSize: 14, color: "#666", lineHeight: 1.55, margin: 0 }}>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── STATS ── */}
        <section style={{ background: "#074738", padding: "40px 24px" }}>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#fff", fontSize: 22, fontWeight: 800, textAlign: "center", marginBottom: 24 }}>Números que importan</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {[
              { num: "67%", label: "olvidan algún control veterinario" },
              { num: "3+", label: "personas cuidan una mascota en promedio" },
              { num: "12", label: "controles al año necesita tu mascota" },
              { num: "1", label: "app para tener todo en orden" },
            ].map((s) => (
              <div key={s.num} style={{ background: "rgba(255,255,255,0.08)", borderRadius: 16, padding: 20, textAlign: "center", border: "1px solid rgba(255,255,255,0.1)" }}>
                <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 28, fontWeight: 800, color: "#1A9B7D", display: "block", marginBottom: 4 }}>{s.num}</span>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{s.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── CO-TUTOR ── */}
        <section style={{ background: "#F0FAF9", padding: "48px 24px" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#1A9B7D", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8, display: "block" }}>Compartí el cuidado</span>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 24, fontWeight: 800, color: "#074738", marginBottom: 12 }}>Invitá un co-tutor</h2>
          <img src={photos.dogsRunning} alt="Perros juntos" style={{ width: "100%", height: 220, objectFit: "cover", borderRadius: 18, marginBottom: 20 }} />
          <p style={{ fontSize: 15, color: "#555", lineHeight: 1.65, marginBottom: 20 }}>
            Tu pareja, tu roommate, un familiar. Quien también cuide a tu mascota puede tener acceso a toda la información y recibir recordatorios.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { n: "1", text: "Ambos ven el mismo historial y datos" },
              { n: "2", text: "Los dos reciben recordatorios" },
              { n: "3", text: "Cualquiera puede agregar información" },
            ].map((b) => (
              <div key={b.n} style={{ display: "flex", gap: 12, alignItems: "center", background: "#fff", padding: "14px 16px", borderRadius: 14, border: "1px solid #E0F2F1" }}>
                <span style={{ width: 24, height: 24, background: "#1A9B7D", borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{b.n}</span>
                <span style={{ fontSize: 14, color: "#074738", fontWeight: 500 }}>{b.text}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── TESTIMONIAL ── */}
        <section style={{ padding: "48px 24px", textAlign: "center" }}>
          <img src={photos.dogSmile} alt="Perro sonriente" style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", marginBottom: 16, border: "3px solid #E0F2F1" }} />
          <blockquote style={{ fontSize: 16, color: "#074738", fontStyle: "italic", lineHeight: 1.6, marginBottom: 12, border: "none", padding: 0 }}>
            "La idea es simple: que no se te pase nada importante de tu mascota, nunca más."
          </blockquote>
          <cite style={{ fontSize: 13, color: "#666", fontStyle: "normal", fontWeight: 600 }}>— Equipo Pessy</cite>
        </section>

        {/* ── FINAL CTA ── */}
        <section style={{ background: "linear-gradient(135deg, #074738 0%, #1A9B7D 100%)", padding: "48px 24px", textAlign: "center", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -60, right: -60, width: 200, height: 200, background: "rgba(255,255,255,0.06)", borderRadius: "50%" }} />
          <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 26, fontWeight: 800, color: "#fff", marginBottom: 12, lineHeight: 1.2, position: "relative", zIndex: 1 }}>
            ¿Querés organizar la vida con tu mascota?
          </h2>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.8)", marginBottom: 24, lineHeight: 1.5, position: "relative", zIndex: 1 }}>
            Sumate al acceso anticipado. Gratis, sin compromiso.
          </p>
          <button onClick={goRegister} style={{ display: "block", width: "100%", background: "#fff", color: "#074738", fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 17, padding: 18, borderRadius: 14, border: "none", cursor: "pointer", position: "relative", zIndex: 1 }}>
            Crear mi cuenta gratis
          </button>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 10, position: "relative", zIndex: 1 }}>Sin tarjeta de crédito. Cancelá cuando quieras.</p>
        </section>

        {/* ── PHOTO FOOTER STRIP ── */}
        <div style={{ display: "flex", height: 100 }}>
          <img src={photos.dogPortrait} alt="" style={{ flex: 1, objectFit: "cover", minWidth: 0 }} />
          <img src={photos.cat} alt="" style={{ flex: 1, objectFit: "cover", minWidth: 0 }} />
          <img src={photos.puppy} alt="" style={{ flex: 1, objectFit: "cover", minWidth: 0 }} />
          <img src={photos.catSun} alt="" style={{ flex: 1, objectFit: "cover", minWidth: 0 }} />
        </div>

        {/* ── FOOTER ── */}
        <footer style={{ background: "#074738", padding: "32px 24px", textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <img src="https://pessy.app/pessy-logo.svg" alt="Pessy" style={{ height: 32, filter: "brightness(0) invert(1)" }} />
            <div>
              <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 17, color: "#fff", letterSpacing: "0.05em", display: "block", lineHeight: 1.1 }}>PESSY</span>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontWeight: 500, display: "block" }}>Tu mascota, todo en orden</span>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 20, marginBottom: 16 }}>
            <a href="/terminos" style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>Términos</a>
            <a href="/privacidad" style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>Privacidad</a>
          </div>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", margin: 0 }}>© 2026 Pessy. Todos los derechos reservados.</p>
        </footer>
      </div>
    </>
  );
}
