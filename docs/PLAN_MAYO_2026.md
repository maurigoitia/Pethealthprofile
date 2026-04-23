# Plan Pessy — post-sprint 23 Abril 2026

## ✅ Lo que está en prod HOY

### PWA (pessy.app/inicio)
- Home v2 con HomeHeader + Greeting + PendienteHoyCard
- Timeline con filtros semánticos (sin emails, sin placeholders, sin ruido)
- Export PDF narrativo con resumen clínico arriba
- DocumentScannerModal con preview "Lo que se encontró"
- Sanitization en ingesta (masterPayloadSanitizer) — no entra data sucia a DB
- -321 líneas de código muerto (mail-sync, wizard, knowledge injection)
- CSP permite `blob:` para uploads de fotos

### Landing (pessy.app/)
- UI kit v2 alineado
- LCP optimizado: WebP team (-178KB), preload hero SVG, lazy loading, font-display
- Sin dependencias externas rotas (Unsplash removido)
- 9 hreflang (es-AR/MX/ES/CL/CO/UY/CR/x-default)
- Organization Schema enriquecido con 4 perfiles reales (IG/LinkedIn/TikTok/Crunchbase)
- WebSite Schema con SearchAction
- 18 URLs en sitemap (hub + 8 blog + 3 vs + landing + legal)

### GEO / SEO
- 7 AI bots autorizados en robots.txt (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, etc.)
- IndexNow workflow auto-ping a Bing/Yandex en cada merge a main (HTTP 202 confirmado)
- BlogPosting + BreadcrumbList + FAQPage schemas
- OG + Twitter Card completos (landing + 8 artículos + 3 comparativas)
- Bing Webmaster Tools configurado (import de GSC)

### Comparativas
- /vs/ hub
- /vs/11pets, /vs/pet-cloud, /vs/petbuddy (con tabla, FAQ, CTAs)

### Escape hatch
- /reset page para browsers con SW cacheado roto

---

## 🔴 Críticos (hacer esta semana)

### 1. Functions deploy pendiente
Hoy falló un retry (`Failed to list functions for polar-scene-488615-i0`) — API de Firebase transient. Las Cloud Functions en prod son las del último deploy exitoso (~14:14 UTC). Hay que retriggerar manualmente cuando Firebase se estabilice.

**Acción:** `gh workflow run deploy-prod.yml --ref main` mañana y verificar que el step "Deploy functions" pase.

### 2. CSP hardening
Hoy tuvimos que agregar `'unsafe-inline'` a script-src porque la landing tiene ~150 líneas de inline JS (GSAP setup, FAQ accordion, mobile menu). Mover esos scripts a `/landing.js` externo y volver a quitar el `'unsafe-inline'`.

**Acción:** 30 min de trabajo. Crear `apps/website/landing.js`, extraer el bloque `<script>` de línea 932, referenciarlo con `<script src="/landing.js" defer>`. Actualizar postbuild-website.js para copiarlo. Quitar `'unsafe-inline'` del CSP.

### 3. Bundle SW update agresivo
Usuarios con bundle viejo quedan stuck. El /reset page es workaround — pero la solución real es que el SW detecte que el activo no es el último y fuerce un reload transparente.

**Acción:** en main.tsx, cuando `registration.waiting` existe, postMessage skipWaiting + reload inmediato (hoy lo hace pero con demora). Además, agregar un version check HTTP a `/version.json` al cargar la app, y si difiere del buildId runtime → force reload sin esperar SW lifecycle.

---

## 🟡 Importantes (próximas 2 semanas)

### 4. Google Business Profile verificación postal
Creado hoy. Espera PIN físico a la dirección. Cuando llegue, ingresarlo en [business.google.com](https://business.google.com) → unlock de Google Knowledge Panel.

### 5. Google Search Console submit sitemap
- URL: https://search.google.com/search-console
- Agregar sitemap https://pessy.app/sitemap.xml
- Monitorear indexación las próximas 2 semanas

### 6. Post inicial idéntico en IG, LinkedIn, TikTok
Ya están creados los perfiles. Falta el primer post con link a pessy.app.

**Copy sugerido (usar IDÉNTICO en los 3):**
> 🐾 Arrancamos Pessy — la app con IA que organiza la vida diaria de tu mascota en un solo lugar.
>
> Rutinas, vacunas, papeles, compras y más. Pessy te dice qué ya está, qué falta y qué se viene.
>
> Entrá gratis durante la beta: https://pessy.app

### 7. Outreach a medios (press kit + emails)
Objetivo: 3-5 menciones con backlinks dofollow en 60 días.

**Targets (email + angle):**
- Infobae Tech → Argentina startup con IA
- La Nación Tech → startup local
- Perfil Tecnología → Mismo
- Xataka (ES) → App de mascotas hispano-first
- TN Tecno → IA argentina
- Mascotas & Compañía → vertical

**Asset pack:** logo SVG, 3 screenshots (inicio, historial, export), 1 video loom de 60s, press release PDF.

---

## 🟢 Backlog táctico (próximos 30-60 días)

### 8. Segundo ciclo de contenido blog
Nuevos artículos SEO-first apuntando a long-tail:
- "Cómo saber si mi perro tiene dolor" (long-tail alto)
- "Cuándo cambiar de alimento a un perro" (evergreen)
- "Primer visita al veterinario con cachorro: qué llevar" (funnel topof)
- "Cuidados del gato mayor (+7 años)"

Cada uno con BlogPosting + BreadcrumbList + FAQPage schemas (ya tenemos el patrón).

### 9. Product Hunt launch preparación
- Crear Product Hunt maker profile (user: mauriciogoitia)
- Preparar assets: 3-5 screenshots, GIF demo 30s, copy del launch
- Build audiencia previa: avisar en IG/LinkedIn 1 semana antes
- Lanzar un martes/miércoles a las 00:01 PT para ventana completa de 24h
- Target: top 5 del día

### 10. Reviews collection
Conseguir 5 reviews reales (G2, Trustpilot, Capterra) para agregar `aggregateRating` al Schema → rich snippets con estrellas en Google.

### 11. Hardening CSP completo
Después de extraer el landing.js (punto 2), revisar que TODAS las pages tengan CSP strict:
- Landing: sin unsafe-inline
- Blog articles: sin inline scripts
- /vs/ pages: sin inline scripts (actualmente usan CSS inline pero no JS — ok)

### 12. Timeline episódico en /historial
El user pidió esto antes: agrupar events por mes con colapsibles. Hoy tenemos años colapsados (2025, 2024, 2023). Falta dentro de cada año agrupar por mes.

---

## 📊 KPIs para trackear (cada 15 días)

| Métrica | Target 30 días | Target 60 días | Cómo medir |
|---|---|---|---|
| URLs indexadas Google | 18 | 25+ | GSC coverage |
| URLs indexadas Bing | 10+ | 20+ | Bing Webmaster |
| Backlinks | 5 | 15 | Ahrefs free checker |
| Citations en ChatGPT/Gemini/Perplexity | 0 ahora | Aparecer en 1/3 | query "app mascotas argentina" |
| Knowledge Panel Google | No | Sí (post-GBP verif) | búsqueda "Pessy app" |
| Performance mobile | 67 | 85+ | Lighthouse mobile |
| Daily active users | X | 2X | Firebase Analytics |

---

## 🔥 Anti-patrones a evitar

1. **No tocar auth sin aprobación** (regla dura del CLAUDE.md)
2. **No deployar manual con `firebase deploy`** — rompió prod 2 veces
3. **No agregar features no pedidas** (regla `feedback_no_extras`)
4. **No score/rating numérico sin pedirlo** (regla explícita del user)
5. **No semántica "mascota activa"** (idem)
6. **CSP test antes de deploy** — aprendimos esto hoy a fuerza de bugs
7. **SW: skipWaiting + version bust** — o usuarios quedan stuck
