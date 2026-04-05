# PESSY — Rules for AI Agents

## CRITICAL: READ THIS FIRST

### NEVER deploy without EXPLICIT user approval
- You MUST ask "Can I deploy to production?" and receive "yes" BEFORE running any deploy command.
- Showing a plan is NOT the same as getting approval. Wait for confirmation.

### NEVER deploy from any branch other than `pessy-website`
- The ONLY branch authorized for production deploys is `pessy-website`.
- `main` has a DIFFERENT architecture and WILL break production.
- `claude/*` worktrees, `feature/*`, `sandbox/*` — NONE of these can deploy.
- If you are on any other branch, STOP. Do not attempt to deploy.

### NEVER modify firebase.json
- The firebase.json on `pessy-website` is correct and tested.
- Do NOT add rewrites, redirects, headers, or change the hosting config.
- EXCEPTION: The `predeploy` hook is intentional and must stay — it calls `pre-deploy-check.sh`.
- If you think firebase.json needs other changes, STOP and ask the user first.

### NEVER run `firebase deploy` directly
- Always use `bash deploy-with-landing.sh` which runs pre-checks automatically.
- Running firebase deploy directly skips the landing page copy step and WILL break the site.
- Note: firebase.json now includes a `predeploy` hook that runs `pre-deploy-check.sh`, so even
  direct `firebase deploy` calls will be blocked if not on pessy-website. But still — don't do it.

### NEVER deploy from a worktree
- Claude worktrees (`.claude/worktrees/*`) and Codex worktrees (`.codex/*`) MUST NOT deploy.
- The pre-deploy-check.sh script will block this automatically.
- If you are in a worktree, commit your changes and work through the main checkout.

## Project Info
- Firebase Project ID: `polar-scene-488615-i0`
- Domain: pessy.app
- Production branch: `pessy-website`
- Deploy script: `deploy-with-landing.sh`
- Audit log: `deploy-audit.log` (auto-written by pre-deploy-check.sh)

## Architecture (pessy-website branch)
- `/` → Landing page (public/landing.html, copied to dist/index.html by deploy script)
- `/login`, `/inicio`, `/register-*`, etc. → Vite SPA (dist/app.html)
- Catch-all rewrite: `** → /app.html`

## Deploy Protection Layers (as of 2026-03-30)

| Layer | What it does |
|-------|-------------|
| `firebase.json predeploy` | Runs pre-deploy-check.sh before ANY firebase deploy command |
| `pre-deploy-check.sh` | Verifies branch, landing.html, dist/index.html, no worktree, no detached HEAD |
| `.git/hooks/pre-push` | Blocks pushing to pessy-website from a different branch |
| `CLAUDE.md` | Rules for Claude agents |
| `CODEX.md` | Rules for OpenAI Codex |
| `.cursorrules` | Rules for Cursor AI |
| `deploy-audit.log` | Logs every deploy attempt with timestamp + result |

## Branch Strategy
| Branch | Purpose | Deploy to prod? |
|--------|---------|-----------------|
| pessy-website | Production-ready code | YES (only this one, only via deploy-with-landing.sh) |
| main | Development (different architecture) | NEVER |
| feature/* | Feature development | NEVER (merge to pessy-website first) |
| sandbox/* | Experimental work | NEVER |
| claude/* | AI agent worktrees | NEVER |

## Pre-Deploy Checklist (MANDATORY)
- [ ] On `pessy-website` branch (not a worktree, not detached HEAD)
- [ ] Branch is up to date with origin
- [ ] `public/landing.html` exists and has content (>1KB)
- [ ] `deploy-with-landing.sh` exists
- [ ] User has explicitly approved the deploy
- [ ] NOT modifying firebase.json rewrites

## Forbidden Actions
- Deploying from `main` or any branch other than `pessy-website`
- Deploying from any worktree (`.claude/worktrees/`, `.codex/`)
- Running `firebase deploy` directly (use deploy-with-landing.sh)
- Modifying firebase.json rewrites
- Pushing to `pessy-website` without user approval
- Touching website files when working on PWA: public/landing.html, public/blog/, public/team/, public/tailwind.css, public/og-cover.png, public/robots.txt, public/sitemap.xml
- Deleting ANY file from public/ without explicit user approval
- Removing or weakening the `predeploy` hook in firebase.json



## Regla de Construcción (Build Rule — Cómo construimos cada feature)

**Identidad del producto:** "Pessy te ayuda a llevar el día a día de tu mascota."
Sub-línea: "Rutinas, alimentación, salud y cuidados — todo en un lugar."

Esta es la identidad real del producto. Clara, honesta, cualquiera la entiende.

---

**Build Rule (para agentes y desarrolladores):** Toda feature que detecte una necesidad debe cerrar el loop con una acción ejecutable en 1 tap. Esto es cómo construimos cada pantalla — no es el posicionamiento del producto.

**Pessy te ayuda a llevar el día a día de tu mascota — y cada feature construida bajo esta regla hace eso posible sin que el usuario tenga que pensar.**

### The Loop (must always close)
```
Detected need  →  Pessy processes  →  Concrete next step with ONE tap
```

### Correct vs Incorrect Examples

| ❌ WRONG (organizar/sugerir) | ✅ CORRECT (conectar/ejecutar) |
|-----------------------------|-------------------------------|
| "Vacuna vence pronto" | "Vence el 15. 3 vets tienen turno → [Agendar]" |
| "Te recomendamos este alimento" | "Thor come Royal Canin → [Comprar ahora]" |
| "Ver veterinarios cercanos" | "[2 vets near you → Agendar ahora]" |
| "Riesgo detectado: MEDIUM" | "Riesgo detectado → [Conectar con vet que atiende esto]" |
| "Medicamento por agotar" | "Quedan 3 días → [Reponer en farmacia cercana]" |

### Agent Rules derived from The Connection Rule
1. NEVER end a detected-need flow without a CTA that closes it
2. NEVER use passive verbs: organizar, sugerir, ver, guiar — use: agendar, comprar, conectar, ejecutar
3. NEVER show a risk/alert without a booking or purchase bridge
4. Tagline: "Tu mascota conectada con lo que necesita" — NOT "Ecosistema digital para mascotas"
5. The Services/Vets screen is NOT a directory — it's a booking engine
6. Módulo veterinario = BETA. Do NOT wire vet consultations yet. Use NearbyVetsScreen instead.
7. Payments = NOT YET. Connection flows go to external links (MercadoLibre, vet booking) for now.

### Reference Documents
- `PESSY_CONEXION_AUDIT.md` — Full gap analysis by area (copy, UX, social, skills)
- `PESSY_IDENTIDAD_PRODUCTO.md` — Product identity and positioning
- `PESSY_REDESIGN_MASTER.md` — UI redesign rules including Rule #11

## 🎯 PRODUCT VISION — Ecosistema End-to-End (Mauri, 2026-04-05)

### ⚠️ CRÍTICO: Pessy NO es una app médica / clínica

**Pessy NO diagnostica, NO prescribe, NO es un sistema de registros médicos.**

Esto no es solo copy — es regulatorio. Posicionar Pessy como "app clínica" o "historial médico"
abre riesgos regulatorios de salud digital. El producto debe mantenerse en el espacio lifestyle/consumer.

**Lenguaje PROHIBIDO para agentes:**
- ❌ "historial médico / clínico"
- ❌ "motor clínico", "análisis clínico", "riesgo clínico"
- ❌ "diagnóstico", "prescripción", "tratamiento médico"
- ❌ "app de salud médica para mascotas"

**Lenguaje CORRECTO:**
- ✅ "historial de tu mascota", "registro de Thor"
- ✅ "rutinas de salud", "cuidado de tu mascota"
- ✅ "conectar con un veterinario", "pedir turno"
- ✅ "datos de Thor", "el perfil de tu mascota"

---

### La Visión Real: Ecosistema End-to-End para Dueños de Mascotas

Pessy es el ecosistema completo de la vida de una mascota. No una feature, no una vertical —
el lugar donde el dueño gestiona TODO lo relacionado con su animal.

```
RUTINAS → PASEOS → COMPRAR → SERVICIOS DE SALUD → 💳 TARJETA DE CRÉDITO
```

Cada capa habilita la siguiente. Juntas crean el lock-in y el moat.

### Los 5 Pilares del Ecosistema

1. **Rutinas** — El día a día: alimentación, medicamentos, recordatorios, actividad física.
   El dueño registra. Pessy aprende. Pessy sugiere.

2. **Paseos & Actividad** — Registro de salidas, rutas, tiempo activo, energía gastada.
   Social layer: dueños cerca, perros compatibles.

3. **Comprar** — Alimento, accesorios, medicamentos, productos de higiene.
   Contexto: "Thor come Royal Canin Maxi → [Comprar] antes de que se acabe"
   Conexión directa a tiendas (MercadoLibre, etc.) — sin catálogo genérico.

4. **Servicios de Salud** — Turnos veterinarios, peluquería, guardería, adiestramiento.
   NO reemplaza al vet. CONECTA con el vet en el momento justo.
   "Vacuna vence el 15 → [Agendar turno] en clínica cercana"

5. **💳 Tarjeta de Crédito / Capa Financiera** *(roadmap futuro)*
   La capa que lo une todo. Pessy card: pagar veterinarios, petshops, servicios.
   Cashback en gastos de mascotas. Cuotas para cirugías. Seguro de mascota integrado.
   → Este es el moat final. El que hace que Pessy sea Nubank para dueños de mascotas.

### Roadmap de Capas (en orden de construcción)

| Etapa | Capa | Status |
|-------|------|--------|
| 1 | Rutinas + Historial | ✅ En producción |
| 2 | Servicios de Salud (vets, turnos) | 🚧 Beta |
| 3 | Comprar (links contextuales) | 📋 Próximo |
| 4 | Paseos & Comunidad | 📋 Backlog |
| 5 | Tarjeta de Crédito / Fintech | 🔮 Visión |

### Reglas de diseño para el ecosistema:
- SIEMPRE disparar desde datos reales del perfil de la mascota, NUNCA genérico
- SIEMPRE con una acción concreta (botón, link) — nunca solo información
- NUNCA lenguaje médico/clínico — siempre lifestyle/consumer
- Los pagos directos = siguiente etapa (hoy: links externos a MercadoLibre/vets)
- La tarjeta de crédito = visión, NO construir aún
- La UI debe comunicar el ecosistema completo desde el HomeScreen

### Conexiones Contextuales que deben existir (MVP)

1. **Vacuna próxima a vencer → veterinaria cercana con turno**
   "Vence el 15. 3 vets tienen turno → [Agendar]"

2. **Mascota come X → sugerencia de alimento con link de compra**
   "Thor come Royal Canin → [Comprar ahora]" (link a MercadoLibre)

3. **Datos de actividad → sugerencia de paseo o rutina**
   "Thor lleva 3 días sin salir → [Registrar paseo]"

### Comunicación de marketing:
- "Pessy no te da info, te da el siguiente paso"
- NO "ecosistema digital para mascotas" (tecno-jerga)
- SÍ "todo lo de tu mascota, en un lugar"

## Incident Log
- 2026-03-27: Agent deployed from `main` instead of `pessy-website`. main has different SPA
  architecture without landing page. Result: blank page in production. Fixed by redeploying from pessy-website.
- 2026-03-30: Bulletproof protection added after 4 incidents (predeploy hook, Codex/Cursor rules,
  pre-push git hook, worktree detection, audit logging).
