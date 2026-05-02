# GSC — URLs prioritarias para pedir indexación

> Lista lista para copiar/pegar en Google Search Console → URL Inspection → Solicitar indexación.
>
> **Estrategia: Opción B (content-first).** Pessy compite contra "Pessy" (apellido italiano + juegos antiguos) en branded search. La autoridad de marca llega después; el tráfico orgánico inicial viene de queries informacionales (vacunas, alimentos, calendario). Esos posts son el motor.
>
> **GSC limita ~10 URLs/día.** Estas 5 caben holgadas y dejan margen para 5 más al día siguiente.

## Las 5 URLs (orden de prioridad)

```
https://pessy.app/blog
https://pessy.app/blog/vacunas-perros-argentina
https://pessy.app/blog/alimentos-prohibidos-perros
https://pessy.app/blog/calendario-vacunas-perros-2026
https://pessy.app/blog/microchip-mascotas-argentina
```

## Por qué estas y no otras

| URL | Volumen búsqueda esperado | Intención | Estado verificado |
|---|---|---|---|
| `/blog` | medio (entry point) | navigational | HTTP 200, contenido real |
| `/vacunas-perros-argentina` | alto (tema clave AR) | informational | HTTP 200, contenido real |
| `/alimentos-prohibidos-perros` | alto (universal) | informational | HTTP 200, contenido real |
| `/calendario-vacunas-perros-2026` | medio-alto (recencia 2026) | informational | HTTP 200, contenido real |
| `/microchip-mascotas-argentina` | medio (legal AR) | informational + transactional | HTTP 200, contenido real |

Las 5 están en `pessy.app/sitemap.xml` (verificadas el 2026-04-30 contra prod).

## Pasos en GSC (después de verificar dominio)

1. https://search.google.com/search-console
2. Seleccionar la propiedad `pessy.app` (verificarla primero si todavía no — método HTML file ya está colgado)
3. Sidebar → **Inspección de URLs**
4. Pegar cada URL de la lista de arriba, una a la vez
5. Si dice "URL no está en Google" → click **"Solicitar indexación"** → esperar el OK de validación (~1 min cada una)
6. Repetir las 5

## Día 2 (después)

```
https://pessy.app/blog/desparasitar-perro
https://pessy.app/blog/cada-cuanto-banar-perro
https://pessy.app/blog/como-saber-si-tu-perro-esta-enfermo
https://pessy.app/blog/castracion-perros
https://pessy.app/blog/control-anual
```

## Día 3+

Las 14 URLs restantes del sitemap, en lotes de 10 por día.

## Qué NO indexar (intencional)

- `/inicio`, `/login`, `/home`, `/register*`, `/empezar`, `/admin/*`, `/review/*`, `/email-link` — todas tienen `X-Robots-Tag: noindex, nofollow` en `firebase.json`. **No las pidas indexar**, Google las va a rechazar.

## Después de pedir indexación

- Esperar 24–48 hs por URL
- En GSC → **Cobertura** verás cuáles entraron
- En **Rendimiento** verás impresiones aparecer en 3–7 días
- Pessy app NO va a aparecer mañana en `pessy` branded — eso requiere autoridad de marca (LinkedIn, Crunchbase, Product Hunt — ver `docs/SEO_BRAND_PROFILES_COPY.md`)
