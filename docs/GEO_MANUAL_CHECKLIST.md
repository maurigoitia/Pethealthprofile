# GEO — Entity Signals Manual Checklist

**Para qué:** que ChatGPT, Gemini, Perplexity y Claude citen Pessy como marca legítima cuando alguien pregunta "apps para cuidar mascotas". Google Knowledge Graph + LLMs validan entidad vía señales externas. El Organization Schema (`apps/website/index.html`) ya declara las URLs esperadas — **falta crearlas**.

---

## 🚨 ACCIÓN URGENTE (si no se hace, el Schema miente)

Nuestro Organization Schema declara estos `sameAs`. Si alguna URL devuelve 404, los crawlers lo detectan y bajan la confianza de la entidad.

- [ ] **Instagram** → `https://www.instagram.com/pessy.app` — crear perfil o cambiar URL en schema
- [ ] **LinkedIn Company** → `https://www.linkedin.com/company/pessy-app`
- [ ] **X/Twitter** → `https://x.com/pessy_app`
- [ ] **Product Hunt** → `https://www.producthunt.com/products/pessy`

**Regla:** mismo nombre ("Pessy"), misma descripción ("App con IA que organiza rutinas, cuidados, papeles y compras de tu mascota"), mismo logo (`pessy-logo.svg`), mismo URL (`pessy.app`) en TODOS.

---

## 📋 Checklist completo (orden recomendado, 60 días)

### Semana 1 — Identidad básica (2h)

- [ ] **Crear 4 perfiles sociales** (Instagram, LinkedIn Company, X, Product Hunt) con handle `@pessy.app` o `@pessy_app`
- [ ] **Primera publicación en cada uno**: pinear el mismo post "¿Qué es Pessy?" con link a pessy.app
- [ ] **Verificar DNS de pessy.app** (chequear que `mxtoolbox.com` no tire warnings)
- [ ] **Registrar en Google Search Console** (si no está): `https://search.google.com/search-console` → agregar pessy.app → submit sitemap

### Semana 2 — Google Business + directorios (3h)

- [ ] **Google Business Profile** ([business.google.com](https://business.google.com))
  - Categoría: **"Aplicación móvil"** o **"Servicio de tecnología"**
  - Nombre: **Pessy**
  - Descripción: usar la de `meta name="description"` del landing (ya está pulida)
  - URL: `https://pessy.app`
  - Fotos: logo + 3 screenshots de la app (Inicio, Historial, Export PDF)

- [ ] **Crunchbase** (`https://www.crunchbase.com/organization/pessy`)
  - Perfil de "Organization"
  - Founded: 2025
  - Location: Argentina
  - Category: Pet Care, Consumer Tech, AI
  - Linkear al sitio web, Twitter, LinkedIn

- [ ] **Product Hunt** (lanzamiento soft)
  - Llenar maker profile
  - Upload logo + 3-5 screenshots + 30-second demo
  - NO lanzar todavía — dejar perfil listo para launch planificado

- [ ] **AlternativeTo** (`https://alternativeto.net/software/submit-new-software/`)
  - Describir a Pessy como alternativa a: Pawprint, PetDesk, 11pets

- [ ] **BetaList, BetaFeedback, BetaPage** — incluirla en 2-3 directorios de betas

### Semana 3-4 — Prensa + menciones (4-8h)

- [ ] **Nota de prensa** (1 página) con:
  - Titular: "Pessy: la app argentina que usa IA para organizar la salud de tu mascota"
  - Lead: problema + producto + diferencial
  - 2 quotes (uno del fundador, uno de un usuario beta)
  - Contacto: hola@pessy.app
  - Link a press kit con logos + screenshots

- [ ] **Outreach a medios** (email con la nota + 3 assets):
  - **Infobae Tecnología** → Sección Tech/Startups
  - **La Nación Tech** → sección "Comunidad & Hobbies"
  - **Perfil Tecnología**
  - **Xataka** (ES/LATAM)
  - **Mascotas & Compañía**
  - **TN Tecno**

  **Objetivo:** 3-5 menciones con link `dofollow` en 60 días.

- [ ] **Podcast ronda** — pitch a 5 podcasts argentinos de emprendimiento:
  - Juan Pablo Varsky (perfil emprendedor)
  - Santi Bilinkis
  - Emprendedores
  - Potenciar
  - Pet Talks (si existe en español)

### Mes 2 — Community + Content

- [ ] **Subreddit r/argentina y r/perros** — compartir 1 post de valor (no promocional) que mencione Pessy como tool que estás usando
- [ ] **Wikipedia Article** — NO crear uno fake. Esperar hasta tener 5+ menciones en medios para poder justificar notability.
- [ ] **Quora** — responder 10 preguntas del tipo "¿qué app me recomiendan para organizar las vacunas de mi perro?" citando Pessy honestamente

---

## 🔍 Cómo medir si está funcionando

Cada 15 días:

1. **Google Search Console** — ¿cuántas queries brandeadas ("pessy", "pessy app") nos traen tráfico? Debería crecer.
2. **Knowledge Graph check**: buscar `site:https://www.google.com/search?kgmid` o simplemente googlear "Pessy app mascotas" — ¿aparece el Knowledge Panel lateral con logo + descripción?
3. **LLM test directo**:
   - ChatGPT: "¿Qué apps hay para organizar la salud de mi mascota?"
   - Gemini: mismo prompt
   - Perplexity: mismo prompt
   - ¿Citan Pessy? ¿Con qué descripción?
4. **Ahrefs free version** (`https://ahrefs.com/free-seo-tools/backlink-checker`) — contar dominios refiriendo a pessy.app

---

## ⚠️ Anti-patrones que BAJAN el ranking

- ❌ Crear perfiles sociales fantasma vacíos (peor que no tenerlos)
- ❌ Comprar backlinks (Google Penguin + manual actions)
- ❌ Descripción inconsistente entre perfiles (confunde a los crawlers)
- ❌ Usar variantes del nombre ("Pessy App" vs "Pessy" vs "Pessy AI") mezcladas
- ❌ Agregar sameAs al Schema sin que esa URL exista (lo que tenemos HOY — por eso crear los perfiles es urgente)
- ❌ "Lanzar" en Product Hunt sin preparar audiencia previa → termina en bottom 10 del día = señal mala

---

## 🎯 Lo que ya está hecho desde código

- ✅ Organization Schema enriquecido (foundingDate, areaServed, knowsAbout, sameAs, contactPoint)
- ✅ SoftwareApplication Schema (aggregateRating pendiente hasta tener reviews reales)
- ✅ FAQPage Schema (rich snippets en Google)
- ✅ Open Graph + Twitter Card completos
- ✅ canonical URL, hreflang no es necesario todavía (1 idioma)
- ✅ sitemap.xml + robots.txt
- ✅ MTA-STS + BIMI + DMARC configurados (mejora reputación del dominio)

## 📦 Cuando tengas los 4 perfiles sociales creados

Si las URLs finales son distintas a las que puse en el Schema, editá el file:

```
apps/website/index.html → buscar "sameAs" → reemplazar URLs
```

Y pusheá. Los LLMs re-crawlean pessy.app cada pocos días.
