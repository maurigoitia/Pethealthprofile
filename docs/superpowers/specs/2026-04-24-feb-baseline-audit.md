# Auditoría Pessy: Febrero baseline vs estado actual + plan priorizado

## Contexto

Sesión `5687431` (25-feb) era estable. Después de eso se acumularon mejoras buenas
+ regresiones y hardcoding visible. El dueño pidió audit completo de 19 puntos
(documento "Mensaje final" del 24-abr).

**Misión**: recuperar lo que funcionaba en febrero, integrar las mejoras buenas,
**eliminar todo dato falso o hardcodeado**, sin tirar a la basura el trabajo de
los últimos 60 días.

## Principios duros (no negociables)

1. **No mostrar datos falsos**. Mejor estado vacío honesto que contenido inventado.
2. **No afirmar nada médico sin evidencia**. Reemplazar "vacunas al día" por
   "no encontramos información de vacunas".
3. **No duplicar secciones**. Una sola entrada por concepto.
4. **Cards clickeables → tienen que navegar**. Si no, no son clickeables.
5. **No romper lo que funcionaba en febrero** sin razón explícita.
6. **Cada dato lleva metadata**: `source`, `confidence`, `createdAt`, `updatedAt`,
   `petId`, `type`, `status`.

## Taxonomía oficial (reglas de información)

```
Mascota
  Datos básicos: peso, edad, raza, sexo, foto, tutor
Salud
  Alergias, patologías, vacunas, tratamientos, medicamentos,
  visitas veterinarias, documentos médicos
Rutinas
  Alimentación, paseos, limpieza, entrenamiento, recordatorios, tareas
Servicios
  Vets reales (extraídos por IA) + Google Maps API + especialidades
Comunidad
  Alertas reales, mascotas perdidas reales, reportes reales
```

Cada bloque visual respeta esta taxonomía. Nada cae en categoría errónea.

---

## P0 — Crítico (bloquea launch)

### P0.1 — Eliminar hardcoding visible
- [ ] **"Limpieza de pliegues"** que aparece sin venir de data → buscar source y eliminar (probablemente DailyHookCard residual o `gamification.ts` items)
- [ ] **"Tratamientos activos" duplicado** (aparece 2 veces) → identificar ambos sources y unificar
- [ ] **"Tratamientos activos 1"** clickeable que no navega → o navega a /tratamientos/{id} o no es clickeable
- [ ] **"Última visita hace 2 meses"** falso → calcular real desde `events` con tipo `appointment` confirmado, no programado. Si no hay → "No hay visitas confirmadas registradas"
- [ ] **"Vacunas al día"** sin carnet → reemplazar por "Sin información de vacunas cargada" o "Subí el carnet para ver estado real"
- [ ] **"Carnet oficial de vacunación"** que aparece sin upload real → estado vacío
- [ ] **Doctores hardcodeados** ("Dra. Luna", "Dr. Martín Sosa", etc.) en VetSearchScreen → ya quitamos `MOCK_VETS` (commit anterior), verificar que no queden en otro componente
- [ ] **Mascotas perdidas inventadas** en Comunidad → empty state "No hay reportes activos"

### P0.2 — Recuperar funcionalidad de febrero
- [ ] **Marcar medicamento como tomado → desaparece de pendientes**. En febrero funcionaba; hoy "le doy a empezar y no pasa nada". Investigar `PendienteHoyCard` + `useMedical`
- [ ] **Swipe-up de mascota** que existía en febrero. Buscar en commit `5687431` qué componente lo tenía y portarlo al Home v2
- [ ] **Mascota más grande / más presencia visual**. Hoy se ve muy chica en `HomeHeaderV2`. Aumentar tamaño avatar / agregar zona hero compacta sin perder el v2 kit

### P0.3 — Tono y lenguaje
- [ ] Cambiar "Saludo a Thor, todo en orden" → "Hola Thor, revisemos cómo estás hoy" o variantes según data real
- [ ] Cuando no hay data: usar "No encontramos información sobre X" / "Falta cargar Y" / "Datos pendientes"
- [ ] Nunca afirmar estado médico sin source verificable

### P0.4 — Subir documento (deduplicar)
- [ ] **Card "subir documento"** que duplica el botón central [+] → eliminar la card del Home, dejar solo el [+] del BottomNav

---

## P1 — Calidad (mejora UX significativa)

### P1.1 — Perfil completo de Thor
- [ ] **Resumen médico** (≤20 líneas, lectura 30 seg) en perfil:
  - Alergias conocidas
  - Patologías / condiciones relevantes
  - Tratamientos activos reales
  - Datos pendientes destacados
- [ ] **Reducir longitud del historial** dentro del perfil
- [ ] Si Thor tiene alergias en `clinical_conditions`, **mostrarlas explícitamente** en el header del perfil

### P1.2 — Reducir scroll del dashboard
- [ ] Auditoría de `PetHomeView.tsx` (~900 LOC): qué secciones se pueden colapsar/eliminar
- [ ] Ordenar por prioridad de acción, no por orden histórico
- [ ] Cada sección con un objetivo claro (Ver / Completar / Marcar / Subir / Buscar)

### P1.3 — Servicios con dos fuentes reales
- [ ] **Fuente A**: extraídos por IA de docs (ya implementado parcialmente con `extractVetsFromArchives` — falta deploy de la function)
- [ ] **Fuente B**: Google Maps Places API para vets cerca de la ubicación del usuario
  - Necesita `VITE_GOOGLE_PLACES_KEY` (ya declarado en `.env.local`)
  - Componente `NearbyVetsFromMaps.tsx` que llama Places + filtra por keyword "veterinaria"
- [ ] Eliminar TODO doctor hardcodeado de `VetSearchScreen` y otros consumers

### P1.4 — Rutinas y entrenamiento honesto
- [ ] Cualquier rutina sin data real (ej: "sesión de calma", "tirate al piso") → marcar como **sugerencia** explícita o eliminar
- [ ] Si una rutina tiene CTA "Empezar" debe **funcionar**: tener pasos, contenido o acción concreta
- [ ] No mezclar rutinas genéricas con datos específicos del pet (Thor)

---

## P2 — Mejoras (post-launch o si da tiempo)

### P2.1 — Comunidad con estados vacíos reales
- [ ] Empty state honesto: "Comunidad todavía no está activa en tu zona"
- [ ] No mostrar usuarios/eventos ficticios

### P2.2 — Animaciones (Cork y Fisa)
- [ ] Identificar las animaciones que existían en feb. Documentar cuáles son
- [ ] Decidir cuáles se reintegran y cuáles quedan post-launch
- [ ] **Regla**: solo CSS transitions, sin framer-motion (regla del proyecto)

### P2.3 — Metadata de fuente de datos
- [ ] Agregar al `MedicalEvent` schema (si no existe ya): `source: "uploaded_document" | "ai_extracted" | "user_input" | "google_maps" | "system_suggestion"`, `confidence: "high" | "medium" | "low"`
- [ ] UI muestra el badge cuando es relevante (ej: chip "Sugerido" en rutinas no confirmadas)

---

## Definition of Done

Esto está listo cuando:

- [ ] No hay datos falsos visibles en ningún screen
- [ ] No hay doctores inventados
- [ ] No se afirma "vacunas al día" sin carnet
- [ ] No hay mascotas perdidas inventadas
- [ ] Medicamentos pendientes se pueden marcar como tomados (regresión de feb arreglada)
- [ ] "Tratamientos activos" no está duplicado
- [ ] Todas las cards clickeables navegan
- [ ] La mascota tiene mejor presencia visual (cerca de feb baseline)
- [ ] Perfil completo de Thor incluye alergias + resumen médico breve
- [ ] Servicios usa data real (IA extraída) + Google Maps API
- [ ] Comunidad muestra estado vacío si no hay reportes reales
- [ ] El dashboard scrollea menos y cada card tiene función clara

---

## Plan de ejecución por épicas

### Épica 1 — Eliminar hardcoding (P0.1) — ~3h
Subagent dedicado audita Home + Cuidados + Rutinas + Servicios + Comunidad,
identifica strings hardcodeados, los reemplaza por datos reales o estado vacío.

### Épica 2 — Recuperar feb (P0.2) — ~4h
Análisis de commits feb (`5687431` y siguientes) para identificar:
- Qué componente tenía el swipe-up
- Cómo era el flow de "marcar med tomado"
- Cómo era el tamaño de la mascota
Luego portar/restaurar respetando el UI v2 actual.

### Épica 3 — Tono y mensajes (P0.3) — ~1.5h
Pasada de copywriting honesto. Reemplazos quirúrgicos en `PetHomeView`,
`CuidadosScreen`, `HomeGreetingV2`, etc. Sin tocar lógica.

### Épica 4 — Resumen médico de Thor (P1.1) — ~2h
Componente `MedicalSummaryCard.tsx` nuevo en perfil. Lee
`getClinicalConditionsByPetId` + `activeMedications` + `events`. Genera párrafo
narrativo de hechos reales (ya hay precedente en `CuidadosScreen`).

### Épica 5 — Servicios con Google Maps (P1.3) — ~3h
Cloud Function o callable client que consulta Places API. Componente
`NearbyVetsFromMaps`. Integrar con `VetSearchScreen` (sección "Cerca tuyo" con
fallback a Maps externo si Places API falla).

### Épica 6 — Reducir scroll dashboard (P1.2) — ~2h
Análisis + simplificación + reordenamiento.

**Total estimado: 15-16 horas de dev**, distribuibles en 3-4 sesiones.

---

## Cómo arrancamos (próxima sesión)

Sugerencia mía como agente:

1. **Ejecutar `/qa` de gstack** (browser real) sobre appqa para mapear cada
   string hardcodeado visible y cada card sin acción. Output: lista
   accionable de issues con paths de archivos.
2. **Épica 1 (P0.1)** primero — es donde más se gana en confianza del usuario.
   Subagent dedicado, commits atómicos por área.
3. **Épica 3 (P0.3) en paralelo** — copywriting no tiene conflictos con
   Épica 1.
4. Después **Épica 2 (P0.2)** que requiere más investigación del baseline feb.

## Métricas de éxito post-launch

- 0 reportes de "esto no funciona" en cards clickeables
- 0 menciones de "doctor inventado" o "vacuna falsa"
- Tiempo medio en /inicio: 30-60 seg (no más, no menos)
- Cards completion rate >60% (medicamentos tomados / total pendientes)
