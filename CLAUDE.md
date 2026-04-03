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



## The Connection Rule (CORE — Non-Negotiable)

**Pessy conecta a tu mascota con lo que necesita, sin que tengas que buscar.**

This is not a feature. It is the product identity. Every screen, every copy line, every CTA
must close the loop — from detected need to concrete action.

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

## 🎯 PRODUCT VISION — Conexiones Contextuales (Mauri, 2026-04-03)

Pessy NO es un marketplace genérico. El diferencial es que Pessy YA conoce a la mascota
y usa ese conocimiento para conectar en el momento justo, sin que el usuario tenga que buscar.

### Los 3 escenarios que deben existir en el producto:

1. **Análisis clínico detecta algo → veterinarios cercanos**
   - Cuando el motor clínico detecta una condición o riesgo, la app muestra 2-3 veterinarios
     cercanos que atienden ese tipo de caso → botón "Agendar"
   - NO es un directorio. Es una recomendación contextual disparada por datos reales.

2. **Mascota come X → sugerencia de alimento específico con link de compra**
   - Cuando el tutor carga la alimentación de su mascota, Pessy sugiere el alimento
     específico más adecuado → con link de compra directo
   - Sin búsqueda, sin catálogo. Solo "para Thor, esto."

3. **Vence una vacuna → veterinaria más cercana con turno disponible**
   - Cuando se acerca el vencimiento de una vacuna, Pessy conecta directamente con
     la clínica más cercana con disponibilidad → botón "Pedir turno"
   - No es un recordatorio vacío. Es un recordatorio con acción.

### Reglas de diseño para estas conexiones:
- SIEMPRE se disparan desde datos clínicos/perfil reales de la mascota, NUNCA genérico
- SIEMPRE tienen una acción concreta (botón, link)
- NUNCA reemplazar al veterinario (módulo vet = beta, NO conectar aún)
- Los pagos = NO por ahora, se habilitan en etapa siguiente
- La UI debe comunicar estas conexiones desde el HomeScreen de forma clara y visible

### Comunicación de marketing:
- Esta visión es el corazón del pitch de Pessy
- El landing page DEBE comunicar esto: "Pessy no te da info, te da el siguiente paso"
- Si el producto no hace esto → el marketing no tiene sustancia

## Incident Log
- 2026-03-27: Agent deployed from `main` instead of `pessy-website`. main has different SPA
  architecture without landing page. Result: blank page in production. Fixed by redeploying from pessy-website.
- 2026-03-30: Bulletproof protection added after 4 incidents (predeploy hook, Codex/Cursor rules,
  pre-push git hook, worktree detection, audit logging).
