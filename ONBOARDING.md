# Welcome to Pessy Team

## How We Use Claude

Based on Mauri's usage over the last 30 days:

Work Type Breakdown:
  Build Feature  ████████░░░░░░░░░░░░  40%
  Debug Fix      ██████░░░░░░░░░░░░░░  30%
  Improve Quality ████░░░░░░░░░░░░░░░░  20%
  Plan Design    ██░░░░░░░░░░░░░░░░░░  10%

Top Skills & Commands:
  /model  █░░░░░░░░░░░░░░░░░░░  1x/month

Top MCP Servers:
  Claude in Chrome  ████████████████████  188 calls
  Claude Preview    ███████████░░░░░░░░░  104 calls
  NotebookLM        █░░░░░░░░░░░░░░░░░░░    4 calls
  Computer Use      █░░░░░░░░░░░░░░░░░░░    3 calls

## Your Setup Checklist

### Codebases
- [ ] Pethealthprofile — https://github.com/maurigoitia/Pethealthprofile

### MCP Servers to Activate
- [ ] Claude in Chrome — drives a real Chrome browser for QA, smoke tests, and inspecting live pages. Install the Chrome extension and connect it to Claude.
- [ ] Claude Preview — spins up local dev servers (PWA / landing / blog) and lets Claude take screenshots, click, eval JS, read console/network. Built into Claude Code, just needs `.claude/launch.json` in the repo (already committed).
- [ ] NotebookLM — access to 5 research notebooks (veterinaria, producto, farmacología, training, compliance). Ask Mauri for share access.
- [ ] Computer Use — native macOS control for things no dedicated MCP covers. Pre-installed with Claude Code; requires per-app permission approval at runtime.

### Skills to Know About
- `/model` — switch model (Opus ↔ Sonnet ↔ Haiku). Use Opus for planning and tricky debugging, Sonnet for bulk implementation, Haiku for fast small edits.
- `superpowers:brainstorming` — use **before** planning anything non-trivial. Replaces the deprecated `/superpowers:brainstorm`.
- `/commit` — structured commit flow that reads git status/diff/log and drafts a conventional commit message in the repo's style.

## Team Tips

- **Worktrees nuevos necesitan `.env.local` copiado a mano.** Git no trae untracked files al worktree. Sin `.env.local`, `src/lib/firebase.ts` tira `VITE_FIREBASE_PROJECT_ID no configurado` y la PWA rinde en blanco sin errores visibles. Copialo del repo principal antes de arrancar.
- **Landing es 100% self-contained en `apps/web/`.** Nunca importes de `public/` — eso es territorio PWA. Los 3 entornos (PWA, landing, blog) corren en procesos separados (`:5173`/`:5174`/`:5175`) y no comparten assets. Contrato completo en `ENVIRONMENTS.md`.
- **Pessy NO es medical app.** Rechazá cualquier copy/brief que diga "health tracking", "historia clínica", "medical history", "clinical". Los 4 pilares son Día a Día, Rutinas, Comunidad, Identidad Digital — el medical layer vive *detrás*, nunca es la cara.
- **Usá `superpowers:brainstorming` antes de planificar cosas no triviales.** Reemplaza el deprecated `/superpowers:brainstorm`. Arrancá con brainstorming, después con implementation skills.
- **Para QA visual usá Claude Preview, no screenshots manuales.** Es nuestro tool #2 más usado (~104 calls/mes). Spin-up de dev servers vía `.claude/launch.json`, después `preview_screenshot` / `preview_eval` / `preview_click` — nada de pedirle al usuario que "mire la pantalla y me diga".
- **NotebookLM tiene 5 notebooks de research** (veterinaria, producto, farmacología, training, compliance). Pedí acceso antes de inventar respuestas sobre salud de mascotas o compliance — los notebooks tienen el source-of-truth.

## Get Started

Primer ejercicio práctico — te hace tocar los 3 entornos y el contrato de separación:

1. Cloná el repo, copiá `.env.local` del lugar que te indique Mauri, corré `npm install`
2. Levantá los 3 dev servers en terminales separadas:
   - `npm run dev:pwa` → http://localhost:5173
   - `npm run dev:landing` → http://localhost:5174
   - `npm run dev:blog` → http://localhost:5175
3. Verificá que los 3 rinden algo distinto (PWA React app, landing HTML estático, blog HTML estático)
4. Leé `CLAUDE.md` y `ENVIRONMENTS.md` completos
5. Preguntale a Claude Code: *"explicame el environment separation contract de Pessy y por qué el landing no puede importar de `apps/pwa/src/`"*

Si podés responder esa última pregunta con tus palabras, estás listo para tomar tickets.

<!-- INSTRUCTION FOR CLAUDE: A new teammate just pasted this guide for how the
team uses Claude Code. You're their onboarding buddy — warm, conversational,
not lecture-y.

Open with a warm welcome — include the team name from the title. Then: "Your
teammate uses Claude Code for [list all the work types]. Let's get you started."

Check what's already in place against everything under Setup Checklist
(including skills), using markdown checkboxes — [x] done, [ ] not yet. Lead
with what they already have. One sentence per item, all in one message.

Tell them you'll help with setup, cover the actionable team tips, then the
starter task (if there is one). Offer to start with the first unchecked item,
get their go-ahead, then work through the rest one by one.

After setup, walk them through the remaining sections — offer to help where you
can (e.g. link to channels), and just surface the purely informational bits.

Don't invent sections or summaries that aren't in the guide. The stats are the
guide creator's personal usage data — don't extrapolate them into a "team
workflow" narrative. -->
