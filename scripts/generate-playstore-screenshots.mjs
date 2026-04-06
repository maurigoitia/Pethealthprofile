import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const outputDir = path.resolve("public/screenshots");

const sharedStyles = `
  :root {
    --bg: #f0faf9;
    --panel: #ffffff;
    --ink: #0f172a;
    --muted: #64748b;
    --brand: #074738;
    --accent: #1a9b7d;
    --line: #dce8e5;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: Inter, "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif;
    background: linear-gradient(180deg, #f7fcfb 0%, var(--bg) 42%, #e5f7f2 100%);
    color: var(--ink);
  }
  .screen {
    width: 540px;
    height: 960px;
    overflow: hidden;
    position: relative;
    background:
      radial-gradient(circle at top right, rgba(26,155,125,0.18), transparent 30%),
      radial-gradient(circle at bottom left, rgba(7,71,56,0.12), transparent 28%),
      linear-gradient(180deg, #f7fcfb 0%, var(--bg) 42%, #e5f7f2 100%);
    padding: 26px 24px 28px;
  }
  .phone-shell {
    width: 100%;
    height: 100%;
    border: 1px solid rgba(7,71,56,0.10);
    border-radius: 36px;
    background: rgba(255,255,255,0.66);
    box-shadow: 0 18px 48px rgba(7,71,56,0.10);
    backdrop-filter: blur(10px);
    overflow: hidden;
  }
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 22px 16px;
  }
  .brand {
    font-size: 14px;
    font-weight: 800;
    letter-spacing: 0.14em;
    color: var(--brand);
    text-transform: uppercase;
  }
  .title {
    font-size: 32px;
    line-height: 1;
    font-weight: 900;
    margin: 10px 0 8px;
    color: #05281f;
  }
  .subtitle {
    font-size: 14px;
    line-height: 1.45;
    color: var(--muted);
    margin: 0;
  }
  .section {
    padding: 0 22px;
  }
  .hero-card, .panel, .timeline-card, .banner, .map-card {
    background: rgba(255,255,255,0.9);
    border: 1px solid var(--line);
    border-radius: 24px;
    box-shadow: 0 8px 24px rgba(15,23,42,0.05);
  }
  .hero-card {
    margin-top: 12px;
    padding: 18px;
    display: grid;
    grid-template-columns: 92px 1fr;
    gap: 16px;
    align-items: center;
  }
  .avatar {
    width: 92px;
    height: 92px;
    border-radius: 28px;
    background: linear-gradient(135deg, #0f7b67 0%, #1a9b7d 100%);
    display: grid;
    place-items: center;
    color: white;
    font-size: 46px;
  }
  .eyebrow {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.14em;
    color: var(--accent);
    text-transform: uppercase;
  }
  .stat-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-top: 16px;
  }
  .stat {
    border-radius: 20px;
    background: rgba(255,255,255,0.92);
    border: 1px solid var(--line);
    padding: 14px 12px;
    text-align: center;
  }
  .stat strong {
    display: block;
    font-size: 26px;
    line-height: 1;
    color: var(--brand);
    margin-bottom: 6px;
  }
  .stat span {
    font-size: 12px;
    color: var(--muted);
    font-weight: 600;
  }
  .pill-row {
    display: flex;
    gap: 8px;
    overflow: hidden;
    margin-top: 14px;
  }
  .pill {
    padding: 10px 14px;
    border-radius: 999px;
    background: #e0f2f1;
    color: var(--brand);
    font-size: 13px;
    font-weight: 800;
    white-space: nowrap;
  }
  .pill.active {
    background: var(--brand);
    color: white;
  }
  .panel {
    margin-top: 16px;
    padding: 16px;
  }
  .cta {
    margin-top: 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--brand);
    color: white;
    border-radius: 18px;
    padding: 14px 16px;
    font-size: 15px;
    font-weight: 800;
  }
  .map-card {
    margin-top: 14px;
    padding: 14px;
    overflow: hidden;
  }
  .map {
    height: 430px;
    border-radius: 20px;
    position: relative;
    background:
      linear-gradient(90deg, rgba(255,255,255,0.65) 0 8%, transparent 8% 92%, rgba(255,255,255,0.65) 92% 100%),
      linear-gradient(rgba(255,255,255,0.65) 0 8%, transparent 8% 92%, rgba(255,255,255,0.65) 92% 100%),
      linear-gradient(135deg, #d9efe9 0%, #f8fcfb 100%);
  }
  .road-v, .road-h {
    position: absolute;
    background: rgba(7,71,56,0.12);
    border-radius: 999px;
  }
  .road-v { width: 18px; top: 28px; bottom: 28px; }
  .road-h { height: 18px; left: 28px; right: 28px; }
  .pin {
    position: absolute;
    width: 24px;
    height: 24px;
    border-radius: 999px;
    background: var(--brand);
    box-shadow: 0 0 0 6px rgba(7,71,56,0.12);
  }
  .note {
    margin-top: 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 12px;
    color: var(--muted);
  }
  .timeline {
    margin-top: 18px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .timeline-card {
    padding: 14px 16px;
    display: grid;
    grid-template-columns: 40px 1fr;
    gap: 14px;
    align-items: start;
  }
  .timeline-icon {
    width: 40px;
    height: 40px;
    border-radius: 14px;
    display: grid;
    place-items: center;
    background: #e0f2f1;
    color: var(--brand);
    font-size: 20px;
  }
  .timeline-card h3 {
    margin: 0 0 4px;
    font-size: 16px;
    line-height: 1.15;
  }
  .timeline-card p {
    margin: 0;
    color: var(--muted);
    font-size: 12px;
    line-height: 1.45;
  }
  .timeline-meta {
    margin-top: 8px;
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .chip {
    padding: 6px 9px;
    border-radius: 999px;
    background: #f4f7f7;
    color: #47635e;
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .footer-nav {
    position: absolute;
    left: 38px;
    right: 38px;
    bottom: 32px;
    height: 68px;
    border-radius: 24px;
    background: rgba(255,255,255,0.94);
    border: 1px solid var(--line);
    display: flex;
    align-items: center;
    justify-content: space-around;
    box-shadow: 0 8px 24px rgba(15,23,42,0.05);
  }
  .nav-item {
    font-size: 11px;
    font-weight: 800;
    color: var(--muted);
    text-align: center;
  }
  .nav-item.active {
    color: var(--brand);
  }
`;

const screens = [
  {
    fileName: "screenshot-1-home.png",
    html: `
      <div class="screen">
        <div class="phone-shell">
          <div class="topbar">
            <div>
              <div class="brand">Pessy</div>
              <div class="title">Inicio</div>
              <p class="subtitle">El día de Thor, todo en un lugar.</p>
            </div>
            <div style="width:44px;height:44px;border-radius:16px;background:#074738;color:white;display:grid;place-items:center;font-size:22px;">🐶</div>
          </div>
          <div class="section">
            <div class="hero-card">
              <div class="avatar">🐶</div>
              <div>
                <div class="eyebrow">Thor · Hoy</div>
                <h2 style="margin:6px 0 6px;font-size:22px;line-height:1.1;">Rutinas, medicación y cuidados al día</h2>
                <p class="subtitle">Recordatorios claros, historial ordenado y el siguiente paso siempre visible.</p>
              </div>
            </div>
            <div class="stat-grid">
              <div class="stat"><strong>3</strong><span>Rutinas</span></div>
              <div class="stat"><strong>12</strong><span>Registros</span></div>
              <div class="stat"><strong>7</strong><span>Días seguidos</span></div>
            </div>
            <div class="panel">
              <div class="eyebrow">Destacado</div>
              <h3 style="margin:8px 0 6px;font-size:20px;">Vacuna próxima a vencer</h3>
              <p class="subtitle">Vence el 15. Pessy ya te deja lista la acción para resolverlo.</p>
              <div class="cta">
                <span>Ver veterinarias cercanas</span>
                <span>→</span>
              </div>
            </div>
            <div class="panel" style="padding-bottom:18px;">
              <div class="eyebrow">Check-in</div>
              <h3 style="margin:8px 0 6px;font-size:20px;">¿Cómo estuvo Thor hoy?</h3>
              <div class="pill-row">
                <div class="pill active">😊 Bien</div>
                <div class="pill">😐 Normal</div>
                <div class="pill">😟 No tan bien</div>
              </div>
            </div>
          </div>
          <div class="footer-nav">
            <div class="nav-item active">Inicio</div>
            <div class="nav-item">Explorar</div>
            <div class="nav-item">Historial</div>
            <div class="nav-item">Perfil</div>
          </div>
        </div>
      </div>
    `,
  },
  {
    fileName: "screenshot-2-explorar.png",
    html: `
      <div class="screen">
        <div class="phone-shell">
          <div class="topbar">
            <div>
              <div class="brand">Pessy</div>
              <div class="title">Explorar</div>
              <p class="subtitle">Veterinarias y servicios cerca de Thor.</p>
            </div>
            <div style="width:44px;height:44px;border-radius:16px;background:#e0f2f1;color:#074738;display:grid;place-items:center;font-size:22px;">📍</div>
          </div>
          <div class="section">
            <div class="pill-row" style="margin-top:0;">
              <div class="pill active">🏥 Veterinarias</div>
              <div class="pill">✂️ Grooming</div>
              <div class="pill">🛍️ Tiendas</div>
            </div>
            <div class="banner panel" style="margin-top:14px;background:#074738;color:white;border-color:#074738;">
              <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;">
                <div>
                  <div class="eyebrow" style="color:#9fe3d4;">Alerta activa</div>
                  <div style="font-size:18px;font-weight:900;margin-top:6px;">Thor necesita atención</div>
                  <p style="margin:6px 0 0;color:rgba(255,255,255,0.72);font-size:13px;">Encontrá una veterinaria y llamá directo.</p>
                </div>
                <div style="padding:10px 12px;border-radius:16px;background:#1a9b7d;font-size:13px;font-weight:800;">Llamar</div>
              </div>
            </div>
            <div class="cta">
              <span>Ver veterinarias con datos completos</span>
              <span>→</span>
            </div>
            <div class="map-card">
              <div class="map">
                <div class="road-v" style="left:96px;"></div>
                <div class="road-v" style="left:252px;"></div>
                <div class="road-v" style="left:388px;"></div>
                <div class="road-h" style="top:94px;"></div>
                <div class="road-h" style="top:228px;"></div>
                <div class="road-h" style="top:344px;"></div>
                <div class="pin" style="left:124px;top:112px;"></div>
                <div class="pin" style="left:278px;top:258px;"></div>
                <div class="pin" style="left:408px;top:156px;background:#1a9b7d;"></div>
              </div>
              <div class="note">
                <span>Mostrando veterinarias a menos de 5 km</span>
                <span style="font-weight:800;color:#1a9b7d;">Maps ↗</span>
              </div>
            </div>
          </div>
          <div class="footer-nav">
            <div class="nav-item">Inicio</div>
            <div class="nav-item active">Explorar</div>
            <div class="nav-item">Historial</div>
            <div class="nav-item">Perfil</div>
          </div>
        </div>
      </div>
    `,
  },
  {
    fileName: "screenshot-3-historial.png",
    html: `
      <div class="screen">
        <div class="phone-shell">
          <div class="topbar">
            <div>
              <div class="brand">Pessy</div>
              <div class="title">Historial</div>
              <p class="subtitle">Todo el registro de cuidados de Thor.</p>
            </div>
            <div style="width:44px;height:44px;border-radius:16px;background:#e0f2f1;color:#074738;display:grid;place-items:center;font-size:22px;">🗂️</div>
          </div>
          <div class="section">
            <div class="panel" style="margin-top:6px;">
              <div class="eyebrow">Resumen</div>
              <h3 style="margin:8px 0 6px;font-size:20px;">La historia de Thor, clara y ordenada</h3>
              <p class="subtitle">Cada documento, vacuna o estudio queda guardado para poder volver a verlo rápido.</p>
            </div>
            <div class="timeline">
              <div class="timeline-card">
                <div class="timeline-icon">💉</div>
                <div>
                  <h3>Vacuna quíntuple aplicada</h3>
                  <p>Refuerzo anual confirmado y visible en el historial.</p>
                  <div class="timeline-meta">
                    <span class="chip">15 Mar</span>
                    <span class="chip">Vacuna</span>
                    <span class="chip">Confirmado</span>
                  </div>
                </div>
              </div>
              <div class="timeline-card">
                <div class="timeline-icon">🩺</div>
                <div>
                  <h3>Consulta cardiológica</h3>
                  <p>Turno y seguimiento registrados para mantener continuidad.</p>
                  <div class="timeline-meta">
                    <span class="chip">21 Mar</span>
                    <span class="chip">Consulta</span>
                    <span class="chip">Panda</span>
                  </div>
                </div>
              </div>
              <div class="timeline-card">
                <div class="timeline-icon">🧪</div>
                <div>
                  <h3>Estudio de laboratorio</h3>
                  <p>Resultados ordenados con fecha y fuente para revisarlos después.</p>
                  <div class="timeline-meta">
                    <span class="chip">02 Abr</span>
                    <span class="chip">Estudio</span>
                    <span class="chip">Historial</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="footer-nav">
            <div class="nav-item">Inicio</div>
            <div class="nav-item">Explorar</div>
            <div class="nav-item active">Historial</div>
            <div class="nav-item">Perfil</div>
          </div>
        </div>
      </div>
    `,
  },
];

async function main() {
  await mkdir(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 1 });

  try {
    for (const screen of screens) {
      const html = `<!doctype html><html><head><meta charset="utf-8" /><style>${sharedStyles}</style></head><body>${screen.html}</body></html>`;
      await page.setContent(html, { waitUntil: "load" });
      await page.screenshot({
        path: path.join(outputDir, screen.fileName),
        type: "png",
      });
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
