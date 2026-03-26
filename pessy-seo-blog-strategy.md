# Pessy — Estrategia SEO Blog
## Generación automática de contenido para pessy.app/blog

---

## Clusters de Keywords (por prioridad)

### 1. CUIDADO DIARIO (volumen alto, competencia media)
- cada cuanto bañar a mi perro
- cada cuanto bañar a mi gato
- como saber si mi perro esta enfermo
- como saber si mi gato esta estresado
- que hacer cuando mi perro no come
- como limpiar las orejas de mi perro
- cada cuanto cortar las uñas de mi perro
- como cepillar los dientes de mi gato
- rutina diaria para perro cachorro
- horarios de paseo ideales para perros

### 2. ALIMENTACIÓN (volumen alto, competencia alta)
- mejor alimento para perro cachorro
- que frutas puede comer mi perro
- alimentos prohibidos para gatos
- alimentos prohibidos para perros
- dieta natural para perros (BARF)
- cuanta agua debe tomar mi perro por dia
- como cambiar el alimento de mi perro
- snacks saludables para perros caseros
- alimentacion para gato senior
- mi perro no toma agua que hago

### 3. SALUD Y VACUNAS (volumen medio, alta intención)
- calendario de vacunas para cachorros
- vacunas obligatorias para perros
- cuando desparasitar a mi perro
- señales de que mi perro tiene parasitos
- que vacunas necesita un gato
- como saber si mi perro tiene fiebre
- primeros auxilios para mascotas
- cuando llevar a mi mascota al veterinario
- enfermedades comunes en perros
- como saber si mi gato tiene dolor

### 4. ORGANIZACIÓN Y TECH (baja competencia, alto match con Pessy)
- como organizar los papeles de mi mascota
- app para recordar vacunas de mi perro
- carnet digital para mascotas
- como llevar el historial medico de mi mascota
- organizar gastos de mi mascota
- recordatorios de cuidado para mascotas
- identidad digital para mascotas
- como compartir cuidado de mascota con pareja
- checklist para nuevo cachorro
- que documentos necesita mi mascota

### 5. COMPORTAMIENTO (volumen alto, engagement alto)
- por que mi perro ladra de noche
- como socializar a mi cachorro
- por que mi gato maulla mucho
- mi perro tiene ansiedad por separacion
- como entrenar a mi perro a ir al baño
- por que mi perro muerde todo
- como calmar a un perro durante tormentas
- señales de estres en gatos
- como presentar un gato nuevo en casa
- mi perro no quiere pasear que hago

### 6. ESTILO DE VIDA PET PARENT (engagement, branding)
- viajar con mascotas en avion
- hoteles pet friendly argentina
- como mudarme con mi mascota
- preparar la casa para un cachorro
- costos de tener un perro en 2026
- seguros para mascotas vale la pena
- como elegir veterinario
- adoptar o comprar un perro
- razas de perros para departamento
- tener gato y perro juntos

---

## Calendario de Publicación

**Frecuencia:** 2 blogs por semana (martes y viernes)
**Rotación de clusters:** 1 cluster por semana, rotar entre los 6

| Semana | Cluster | Ejemplo Post 1 (martes) | Ejemplo Post 2 (viernes) |
|--------|---------|------------------------|--------------------------|
| 1 | Cuidado Diario | Cada cuánto bañar a tu perro según su raza | Rutina diaria ideal para un cachorro |
| 2 | Alimentación | 10 alimentos que tu perro NO puede comer | Snacks caseros y saludables para perros |
| 3 | Salud y Vacunas | Calendario completo de vacunas para cachorros | 5 señales de que tu perro necesita ir al vet |
| 4 | Organización (Pessy) | Cómo organizar todos los papeles de tu mascota | Checklist completo para tu nuevo cachorro |
| 5 | Comportamiento | Por qué tu perro ladra de noche (y cómo solucionarlo) | Cómo socializar a tu cachorro paso a paso |
| 6 | Estilo de Vida | Costos reales de tener un perro en 2026 | Razas ideales para vivir en departamento |

---

## Formato de cada Blog Post

```
Título: [keyword principal + gancho emocional]
Meta description: ~155 caracteres con keyword
URL: pessy.app/blog/[slug-seo-friendly]
Imagen principal: Unsplash API (query relacionada)
Extensión: 800-1200 palabras
Estructura:
  - Intro con hook (2-3 oraciones)
  - H2 con keyword principal
  - 3-5 secciones con H3
  - Lista práctica o checklist
  - CTA suave hacia Pessy (sin ser invasivo)
  - FAQ schema (2-3 preguntas relacionadas)
```

---

## Configuración de Imágenes

**Fuente principal:** Unsplash API (gratis, sin atribución requerida)
- Endpoint: `https://api.unsplash.com/search/photos?query={keyword}&orientation=landscape&per_page=3`
- API Key: registrar en https://unsplash.com/developers
- Fallback queries por cluster:
  - Cuidado: "dog grooming", "cat bath", "pet care"
  - Alimentación: "dog food bowl", "healthy pet food", "cat eating"
  - Salud: "veterinary", "puppy vaccine", "pet hospital"
  - Organización: "pet documents", "phone app pet", "organized desk pet"
  - Comportamiento: "dog training", "puppy playing", "cat behavior"
  - Estilo de vida: "travel with dog", "apartment dog", "pet friendly"

**Fuente secundaria:** Pexels API (gratis)
- Endpoint: `https://api.pexels.com/v1/search?query={keyword}&orientation=landscape&per_page=3`

**Tamaño:** 1200x630 para OG image, 800px ancho para inline

---

## CTA en cada post (sutil, al final)

```
¿Querés tener todo esto organizado en un solo lugar?
Pessy te ayuda a llevar el control de vacunas, paseos,
compras y papeles de tu mascota. Gratis para siempre.
→ Probá Pessy [link a pessy.app/register-user?src=blog-{slug}]
```

---

## SEO Técnico del Blog

- Cada post: título único, meta description, canonical URL
- Schema: Article + FAQPage
- Internal linking: cada post linkea a 2-3 posts relacionados
- Breadcrumbs: Pessy > Blog > [Categoría] > [Post]
- Sitemap: actualizar automáticamente
- Alt text en todas las imágenes con keyword
