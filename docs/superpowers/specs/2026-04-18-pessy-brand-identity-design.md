# Pessy — Identidad de Marca y Narrativa de Producto
**Fecha:** 2026-04-18  
**Fuente de verdad:** Plano Branding & Diseño (Semana 1 + Semana 2)  
**Alcance:** Mensajería externa + documentación interna + pilares en código

---

## 1. Definición en 1 línea

> **"Tu mascota, sus cosas, todo en orden."**

Esta es la promesa de marca oficial definida por Plano. Es la única línea autorizada para hero copy, store listing, onboarding y comunicación externa.

---

## 2. Definición en 1 párrafo

Pessy organiza la vida cotidiana con tu mascota integrando información, rutinas y servicios en un solo lugar, de forma simple y accesible. No es una herramienta técnica ni clínica — es una solución cercana que centraliza lo importante, da visibilidad clara y acompaña el día a día.

---

## 3. Misión, Visión y Valores (Plano Semana 2)

**Misión**  
Facilitar la vida cotidiana con mascotas, ayudando a los tutores a organizar información, rutinas y cuidados en un solo lugar, de forma simple y accesible.

**Visión**  
Construir una plataforma que acompañe toda la vida de la mascota, donde su información esté siempre ordenada y disponible para tomar mejores decisiones en el día a día.

**Valores**  
Claridad · Cercanía · Utilidad · Confianza · Proactividad

---

## 4. Concepto rector

> **"Orden en la vida real con tu mascota"**

La marca se construye sobre tres pilares:
- **Orden** — todo en su lugar, visible, sin caos
- **Funcionalidad** — cada feature tiene un propósito concreto
- **Cercanía** — tono humano, situaciones reales, nunca clínico

---

## 5. Los 5 pilares del producto

| # | Nombre en código (anterior) | Nombre oficial (Plano-alineado) | Qué resuelve |
|---|---|---|---|
| 1 | Día a Día | **Día a Día** | Lo que pasa hoy: rutinas, check-in, tips personalizados |
| 2 | Rutinas / Reminders | **Rutinas** | Lo que no puede olvidarse: meds, vacunas, citas |
| 3 | Historial Clínico | **Historial** | Lo que pasó: timeline, documentos, escaneo |
| 4 | Identidad Digital | **Identidad** | Quién es tu mascota: carnet, perfil, export |
| 5 | Comunidad | **Comunidad** | Las personas alrededor: perdidos, adopción, vets |

> **Decisión de nomenclatura:** "Historial Clínico" → **"Historial"**. La palabra "clínico" activa el framing médico que Plano explícitamente rechaza. El cambio aplica a navegación, copy, documentación y code comments.

---

## 6. Lo que Pessy NO es (regla explícita para agentes, equipo y copy)

| ❌ PROHIBIDO usar | ✅ USAR EN CAMBIO |
|---|---|
| "App médica" | "Organizador de vida con mascotas" |
| "Herramienta clínica" | "Solución simple y cercana" |
| "Sistema de salud animal" | "Plataforma de cuidado diario" |
| "Historial clínico" | "Historial" |
| "Motor de IA clínica" | "Asistente que organiza y recuerda" |
| Estética clínica / imágenes técnicas | Situaciones reales, tono humano |

---

## 7. Sistema visual (Plano — fuente de verdad)

### Paleta de colores

| Token | Hex | Uso |
|---|---|---|
| Deep Green | `#074738` | Marca, CTAs, headers |
| Action Green | `#1A9B7D` | Interacción, estados activos |
| Soft Mint | `#E0F2F1` | Fondos suaves, icon boxes, surfaces |
| Light Mint | `#F0FAF9` | Superficies, background general |
| Violet | `#5048CA` | **Acentos puntuales** — identidad digital, badges verificados |

> El color organiza la información, no la decora.

### Tipografía

| Fuente | Peso | Uso |
|---|---|---|
| Plus Jakarta Sans | 800 (ExtraBold) | Titulares, marca, headings |
| Manrope | 500–700 | Cuerpo, sistema, labels |

### Lenguaje visual
- Composiciones simples, foco en lo importante
- Uso controlado del color
- Equilibrio entre contenido y espacio
- Tarjetas y bloques con bordes redondeados
- Jerarquía clara
- **Todo debe sentirse claro y usable**

### Dirección visual: Functional Warm Tech
Una identidad basada en tecnología accesible, diseño funcional y cercanía en la experiencia.  
La marca debe sentirse: **clara · útil · ordenada · cercana**

---

## 8. Tono de comunicación

- Cercano y humano — no técnico, no clínico
- Práctico y directo — dice qué hace, no cómo funciona
- Empático — entiende que tener una mascota tiene momentos difíciles
- Nunca condescendiente, nunca sobre-explicado

### Copy por audiencia

| Audiencia | Mensaje |
|---|---|
| Usuario cotidiano | "Todo lo importante de tu mascota, en orden." |
| Padre/madre primerizo | "Pessy te recuerda lo que toca y guarda lo que pasó." |
| Multi-mascota | "Un solo lugar para todos tus animales." |
| Veterinario | "Contexto completo del paciente fuera del consultorio." |
| Inversor | "Plataforma de continuidad del cuidado animal: engagement diario + memoria + coordinación tutor-vet." |

---

## 9. Aplicación en el código

### CLAUDE.md — nueva definición de producto
```
Pessy es una plataforma que organiza la vida cotidiana con mascotas, 
integrando información, rutinas y servicios en un solo lugar.
NO es una app médica. NO es una herramienta clínica.
Es simple, útil y cercana.
Promesa: "Tu mascota, sus cosas, todo en orden."
```

### Pilares en BottomNav
```
Inicio | Comunidad | [+] | Rutinas | Perfil
```
*(sin cambios de navegación — el cambio es semántico/narrativo)*

### Renombrar en copy y comments
- `MedicalContext` → mantener nombre técnico interno, pero el label UI = "Historial"
- `ClinicalProfileBlock` → mantener nombre técnico, label UI = "Perfil de salud"
- Store listing subtitle: "Salud y bienestar animal" → **"Tu mascota, todo en orden"**

### Color Violet `#5048CA`
Hoy ausente del codebase. Incorporar como token para:
- Badges "Verificado" en perfiles vet
- Estado especial en Identidad Digital
- Highlights de logros/milestones

---

## 10. Checklist de propagación

- [ ] Actualizar `CLAUDE.md` — definición de producto + reglas de tono
- [ ] Actualizar `docs/PROJECT_SUMMARY.md` — ¿qué es Pessy?
- [ ] Actualizar `docs/ROADMAP.md` — renombrar "Historial Clínico" → "Historial"
- [ ] Actualizar `docs/STORE_LISTING_COPY.md` — subtitle + descripción corta
- [ ] Agregar `#5048CA` como token en Tailwind config
- [ ] Actualizar copy de navegación interna donde aparezca "clínico"
- [ ] Compartir este doc con Plano como referencia del estado actual

---

## Fuentes

- `PESSY - Entrega semana 1 (1).pdf` — Plano, dirección visual inicial
- `Entrega PESSY - Semana 2.pdf` — Plano, BrandBook en desarrollo
- Conversaciones de producto: acuerdos sobre asistente integral, tono emocional, comunidad
