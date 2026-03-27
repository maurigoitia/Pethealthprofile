# PESSY — Reglas para agentes AI

## Proyecto
- **Firebase Project ID**: `polar-scene-488615-i0` (definido en `.firebaserc`)
- **Dominio producción**: pessy.app
- **Hosting target producción**: `app` → sitio `polar-scene-488615-i0`

## Reglas CRÍTICAS — NO romper

### 1. NUNCA subir código local sin verificar contra git
- Todo el código fuente está en **git** (`origin/main` y branches).
- **PROHIBIDO** editar archivos locales y hacer deploy sin antes sincronizar con `origin/main`.
- Siempre hacer `git fetch origin` y verificar que local esté al día.

### 2. Vite borra `dist/` en cada build
- **NUNCA commitear archivos estáticos directo a `dist/`**. Vite lo borra y recrea.
- Los archivos estáticos (blog HTML, SVG, robots.txt, sitemap.xml, 404.html, og-cover) van en **`public/`**.
- Vite copia automáticamente `public/` → `dist/` durante el build.

### 3. El SPA rewrite SIEMPRE apunta a `/index.html`
- En `firebase.json`, el catch-all rewrite del target `app` DEBE ser:
  ```json
  { "source": "**", "destination": "/index.html" }
  ```
- En `vite.config.ts`, el `navigateFallback` DEBE ser `'/index.html'`.
- Vite produce `index.html` como entry point. **NO existe `app.html`** en el output.

### 4. NO hacer rollback con `firebase hosting:clone` sin verificar versión
- Un rollback a una versión vieja puede romper la PWA y el website.
- Siempre verificar que la versión objetivo tiene el código correcto antes de clonar.

### 5. NO tocar rutas de la PWA al trabajar en el website
- Website: `/` (LandingEcosystemPreviewPage)
- PWA: `/login`, `/inicio`, `/register-*`, `/solicitar-acceso`
- Landing social: `/empezar`
- Blog: `/blog`, `/blog/*` (HTML estático en `public/blog/`)
- Cada área es independiente. Si trabajás en el blog, no modifiqués la PWA.

### 6. Verificar TODAS las rutas antes de deploy
Antes de hacer deploy a producción, verificar que estas rutas devuelven 200:
```bash
curl -s -o /dev/null -w "%{http_code}" https://pessy.app/
curl -s -o /dev/null -w "%{http_code}" https://pessy.app/login
curl -s -o /dev/null -w "%{http_code}" https://pessy.app/inicio
curl -s -o /dev/null -w "%{http_code}" https://pessy.app/blog
curl -s -o /dev/null -w "%{http_code}" https://pessy.app/empezar
```

### 7. El Firebase project ID correcto
- **Correcto**: `polar-scene-488615-i0`
- **Incorrecto** (NO usar): `gen-lang-client-0123805751`
- Siempre verificar contra `.firebaserc`.

## Estructura de branches
- `main` — código de producción (website + PWA + blog)
- `pessy-website` — branch legacy, NO usar para deploys
- `pessy-app` — branch legacy, NO usar para deploys
- `pessy-landing-social` — branch legacy
- `pessy-flutter` — futuro Flutter app
- `sandbox/restructure-and-flutter-prep` — desarrollo, NO deployar a prod sin aprobación

## Workflow de deploy a producción
```bash
# 1. Sincronizar con origin
git fetch origin
git checkout main
git pull origin main

# 2. Hacer cambios y commit
git add <archivos>
git commit -m "descripción"

# 3. Build
npm run build

# 4. Verificar que dist/ tiene los archivos correctos
ls dist/index.html dist/blog.html dist/blog/

# 5. Deploy
firebase deploy --only hosting:app --project polar-scene-488615-i0

# 6. Verificar rutas
curl -s -o /dev/null -w "%{http_code}" https://pessy.app/
curl -s -o /dev/null -w "%{http_code}" https://pessy.app/login
curl -s -o /dev/null -w "%{http_code}" https://pessy.app/blog

# 7. Push a origin
git push origin main
```

## Incidentes previos (para no repetir)
1. **2026-03-27**: firebase.json tenía `"destination": "/app.html"` pero Vite solo genera `index.html` → 404 en todas las rutas SPA excepto `/`.
2. **2026-03-27**: Archivos del blog commiteados en `dist/` en vez de `public/` → Vite los borraba en cada build.
3. **2026-03-27**: Rollback con `hosting:clone` a versión de marzo 22 rompió la PWA.
4. **2026-03-27**: Deploy desde branch local desincronizado subió código viejo a producción.
