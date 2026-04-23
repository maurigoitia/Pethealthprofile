# Bing Webmaster Tools + IndexNow — Setup

## Estado actual

- ✅ **IndexNow Key generada** y alojada en `public/d011ce80553b64c87db35f6f236b92643ce3fb5cb6a486bbe7bb1bab95932bc5.txt`
- ✅ **GitHub Action** en `.github/workflows/indexnow-ping.yml` — pinga IndexNow automáticamente cuando hay cambios en `apps/website/`, `apps/blog/`, `sitemap.xml`, `robots.txt` en main
- ⏳ **Acción manual pendiente**: registrar en Bing Webmaster Tools

## Acción manual (10 min)

### 1. Registrar pessy.app en Bing Webmaster Tools

1. Entrar a https://www.bing.com/webmasters/
2. Sign in con cuenta Microsoft (podés usar la misma de Google si tenés una vinculada)
3. **Add a site** → `https://pessy.app`
4. Opción A — **Importar desde Google Search Console**:
   - Si ya tenés pessy.app verificado en GSC, Bing puede importarlo automáticamente
   - Esta es la opción más rápida
5. Opción B — **Verificar con meta tag** (si no tenés GSC):
   - Bing te da un `<meta name="msvalidate.01" content="...">`
   - Pegar ese tag en `apps/website/index.html` después del `<meta name="robots">` y commitear
6. Opción C — **Verificar con XML file**:
   - Bing te da un archivo `BingSiteAuth.xml` para poner en el root
   - Lo podés poner en `public/BingSiteAuth.xml` y se sirve automáticamente

### 2. Submit sitemap a Bing

1. Una vez verificado → **Sitemaps** → Submit sitemap
2. URL: `https://pessy.app/sitemap.xml`
3. Bing empieza a crawlear inmediatamente

### 3. Verificar IndexNow está activo

En Bing Webmaster → **IndexNow** → debe mostrar "Key: d011ce80...95932bc5" como activa.
Bing ya valida automáticamente contra `https://pessy.app/d011ce80...95932bc5.txt`.

### 4. Opcional — agregar Yandex también

IndexNow es un protocolo compartido. Con la misma key, también te indexa Yandex:
- https://webmaster.yandex.com/sites/ → Add site → pessy.app
- El ping a `api.indexnow.org` notifica a TODOS los search engines compatibles (Bing, Yandex, Naver, Seznam)

## Cómo funciona el auto-ping

Cada vez que mergeás a main un cambio en:
- `apps/website/index.html` (landing)
- `apps/blog/articles/**` (artículos de blog)
- `public/sitemap.xml`
- `public/robots.txt`

El workflow `.github/workflows/indexnow-ping.yml` corre, detecta qué URLs cambiaron, arma un JSON con ellas y lo manda a `api.indexnow.org`. Bing y Yandex re-crawlean esa URL en horas (no días como Googlebot sin IndexNow).

## Verificación de que funciona

Después del primer merge a main post-deploy:

1. Ir a **Actions** en GitHub → workflow "IndexNow" → ver el run más reciente
2. En el log debe aparecer `HTTP 200` o `HTTP 202` del POST a `api.indexnow.org`
3. En Bing Webmaster → **IndexNow** → ver "Recent URL submissions" con nuestras URLs

## Si necesitás rotar la key

Si alguna vez comprometés la key (no debería pasar — está hardcoded en un workflow público pero eso es por diseño de IndexNow):

1. Generar nueva: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
2. Renombrar `public/OLD_KEY.txt` → `public/NEW_KEY.txt` con el contenido nuevo
3. Actualizar `INDEXNOW_KEY` env var en `.github/workflows/indexnow-ping.yml`
4. Bing detecta la nueva key la próxima vez que pinguemos

## Impacto esperado

- **Indexación de nuevos artículos de blog**: de días a horas (Bing + Yandex)
- **Visibilidad en Microsoft Copilot**: una vez indexada en Bing, la app empieza a aparecer en respuestas de Copilot
- **Backlink equity**: Bing usa señales distintas a Google para rankear — estar en ambos es multiplicador
