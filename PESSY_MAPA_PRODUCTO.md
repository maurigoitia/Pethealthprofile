# PESSY — Mapa de Producto
*Última actualización: 2026-04-05*

---

## POR QUÉ EXISTE PESSY

**Un tutor usa Pessy porque Pessy le resuelve la administración diaria de su mascota.**

No se acuerda a qué hora es la pastilla.
No sabe cuándo le toca el turno al veterinario.
No sabe cuándo vence la vacuna.
No recuerda el tratamiento ni la medicación.
No sabe cómo darle instrucciones a alguien cuando deja la mascota con otra persona.
No sabe cuánto invierte en su animal.
Su mascota no tiene seguro ni acceso a atención rápida.
No sabe cómo tratar a su mascota según su raza.
No sabe cómo ayudarla con problemas específicos de la raza.

**Pessy resuelve todo eso. Sin que el tutor tenga que pensar.**

---

## QUÉ ES PESSY (una línea)

**Pessy es un agente para la vida diaria de tu mascota.**
Un organizador para el tutor. Un sugerente inteligente basado en los datos reales del animal.

> ⚠️ PESSY NO ES una app médica. NO diagnostica. NO prescribe.
> Lenguaje SIEMPRE: "tutor" (nunca "dueño"), "registro de Thor" (nunca "historial clínico").

---

## LOS 10 PROBLEMAS QUE PESSY RESUELVE

| # | Problema del tutor | Cómo lo resuelve Pessy |
|---|-------------------|----------------------|
| 1 | No recuerda la hora de la pastilla | Recordatorio push automático, 15 min antes, con nombre del medicamento y dosis |
| 2 | No sabe cuándo le toca el turno | Calendario integrado, alerta previa, sincronización Google Calendar |
| 3 | No sabe cuándo vence la vacuna | Alert automática + CTA directo para agendar vet cercano |
| 4 | No recuerda el tratamiento completo | Timeline de historial, medicaciones activas siempre visibles |
| 5 | No sabe cómo dejar instrucciones | Co-tutor: comparte acceso completo a Pessy con quien cuida a la mascota. Esa persona ve todo. |
| 6 | No sabe cuánto gasta en su mascota | (próximo: resumen de gastos integrado) |
| 7 | Su mascota no tiene seguro | (Fase 3: Pessy Card + seguro integrado) |
| 8 | No sabe cómo tratar su raza | IA personalizada por raza: recomendaciones, alertas, rutinas específicas |
| 9 | No sabe con qué problemas de raza ayudarla | El perfil de raza carga predisposiciones. Pessy avisa antes de que sea un problema. |
| 10 | No tiene un lugar donde esté todo | Pessy es el único lugar donde está todo junto: salud, rutinas, lugares, documentos, comunidad |

---

## LA EVOLUCIÓN EN 3 FASES

```
FASE 1 — DATOS          FASE 2 — MARKETPLACE       FASE 3 — FINTECH
─────────────────       ──────────────────────       ────────────────────
Rutinas, documentos  →  Paseadores afiliados     →  Tarjeta Pessy
Sugerencias IA          Vets afiliados               Seguro de mascota
Lugares (Google)        Groomers afiliados           Cuotas cirugías
Calendario/Tratamientos Tiendas afiliadas            Cashback pet-shops
Comunidad               Reservas en app              Insurtech

✅ EN PRODUCCIÓN        🚧 PRÓXIMA ETAPA             🔮 VISIÓN
```

---

## QUÉ TIENE PESSY HOY (construido, no reinventar)

### 1. 📄 DOCUMENTOS + IA

El tutor sube una foto de un estudio o documento veterinario.
Pessy lo analiza con IA (Gemini), extrae los datos y los agrega al historial automáticamente.

**Estado: ✅ Completamente funcional**

| Componente | Archivo |
|-----------|---------|
| Escaneo y OCR | `DocumentScannerModal.tsx` |
| Análisis IA | `analyzeDocument` (Cloud Function) |
| Revisión manual | `ClinicalReviewScreen.tsx`, `VerifyReportScreen.tsx` |
| Timeline de historial | `Timeline.tsx` |
| Exportar a PDF | `ExportReportModal.tsx` |
| Brain de IA | `brainResolver.ts`, `groundedBrain.ts` |

**❌ Lo que falta para que el tutor LO SIENTA:**
El análisis ocurre pero es invisible. Agregar un momento "Pessy encontró esto en el documento" post-escaneo.

---

### 2. 🤖 SUGERENCIAS IA

Motor que cruza raza + edad + clima + personalidad + historial → recomendaciones contextuales.

**Estado: ✅ Motor construido — ❌ poco visible al tutor**

| Componente | Archivo |
|-----------|---------|
| Motor de inteligencia | `pessyIntelligenceEngine.ts` |
| Feed de recomendaciones | `RecommendationFeed.tsx` |
| Tip diario | `PessyTip.tsx` |
| Card de insight diario | `DailyHookCard.tsx` |
| Pregunta de aprendizaje | `PessyQuestion.tsx` |

**❌ Lo que falta:**
- **Detección de raza por foto** — el tutor sube foto, Pessy detecta raza. No existe aún.
- **Insight diario en HomeScreen prominente** — la IA tiene la lógica pero el tutor no la ve al abrir la app.

---

### 3. 📍 LUGARES

Veterinarios cercanos (Google Places), registro de paseos, sugerencias de parques.

**Estado: ✅ Funcional**

| Componente | Archivo |
|-----------|---------|
| Vets cercanos | `NearbyVetsScreen.tsx` |
| Registro de paseos | `WalkLogModal.tsx` |
| Proxy Google Places | `nearbyVets` (Cloud Function) |

**❌ Fase 2:** Google Places → vets/groomers/paseadores afiliados con reservas en app.

---

### 4. 📅 CALENDARIO + TRATAMIENTOS

Medicaciones, vacunas, citas con recordatorios automáticos push + email.

**Estado: ✅ Uno de los módulos más sólidos**

| Componente | Archivo |
|-----------|---------|
| Medicaciones | `MedicationsScreen.tsx` |
| Vacunas | `VaccinationCardModal.tsx` |
| Citas | `AppointmentsScreen.tsx` |
| Recordatorios | `RemindersScreen.tsx` |
| Motor automático | `treatmentReminderEngine.ts` |
| Sync Google Calendar | `calendarSyncService.ts` |

**Flujo completo:** agregar → recordatorio automático → marcar tomada → historial → alerta reposición.

**❌ Lo que falta:** conexión directa "vacuna vence → agendar vet" con 1 tap.

---

### 5. 👥 CO-TUTOR (resuelve el problema de "dejar instrucciones")

Cuando el tutor deja la mascota con alguien más, le da acceso a Pessy.
Esa persona ve el historial, las medicaciones activas, los recordatorios. Todo.

**Estado: ✅ Funcional**

| Componente | Archivo |
|-----------|---------|
| Invitar co-tutor | `CoTutorModal.tsx` |
| Aceptar invitación | `acceptCoTutorInvite` (Cloud Function) |

---

### 6. 🐾 COMUNIDAD

Mascotas perdidas con geo-alertas. Adopción con matching automático.

**Estado: ✅ Funcional**

| Componente | Archivo |
|-----------|---------|
| Hub | `CommunityHub.tsx` |
| Perdidas | `LostPetFeed.tsx`, `ReportLostPet.tsx` |
| Adopción | `AdoptionFeed.tsx`, `AdoptionDetail.tsx` |
| Geo-alertas automáticas | `onLostPetReport` (Cloud Function) |

---

### 7. 🏥 SERVICIOS

Búsqueda dinámica de vets, groomers, tiendas, parques — hoy via Google Places.

**Estado: ✅ Funcional — Fase 2: afiliados propios con reservas**

---

### 8. 🐶 PERFIL DE LA MASCOTA

Raza (300+), edad, peso, foto, castración, personalidad interactiva, co-tutores.

**Estado: ✅ Completamente funcional**

| Componente | Archivo |
|-----------|---------|
| Perfil completo | `PetProfileModal.tsx` |
| Personalidad interactiva | `PersonalityOnboarding.tsx` |
| Preferencias | `PetPreferencesEditor.tsx` |
| Lista razas | `breeds.ts` (~300) |

**❌ Lo que falta:** detección de raza por foto (Fase 1 prioritario).

---

## LO QUE FALTA CONSTRUIR (ordenado por impacto)

### 🔴 Construir ahora — Fase 1

| # | Feature | Impacto |
|---|---------|---------|
| 1 | **Detección de raza por foto** | Wow moment del onboarding. El tutor no escribe la raza, Pessy la ve. |
| 2 | **Insight diario en HomeScreen** | La IA existe pero es invisible. "Thor lleva 3 días sin salir → [Registrar paseo]" |
| 3 | **Vacuna vence → vet cercano (1 tap)** | Cerrar el loop más obvio del producto. |
| 4 | **Resumen de gastos del tutor** | "Este mes gastaste $X en Thor" — nadie más lo tiene. |
| 5 | **Reemplazar "dueño" por "tutor" en todo el código y copy** | Identidad del producto. |

### 🟡 Fase 2 — Marketplace

| # | Feature |
|---|---------|
| 6 | Vets/groomers afiliados (no Google Places) |
| 7 | Reservas en app con vet afiliado |
| 8 | Paseadores (modelo Uber) |
| 9 | Tiendas con links contextuales a compras reales |

### 🔵 Fase 3 — Fintech/Insurtech

| # | Feature |
|---|---------|
| 10 | Tarjeta Pessy |
| 11 | Seguro de mascota integrado |
| 12 | Cuotas para cirugías |
| 13 | Cashback en gastos pet |

---

## REGLAS PARA NO PERDERSE

1. **Tutor, nunca dueño** — siempre.
2. **La IA habla de Thor, no de "perros en general"** — siempre con nombre y contexto real.
3. **Toda pantalla cierra con 1 CTA accionable** — nunca solo información.
4. **No construir Fase 2 sin que Fase 1 esté sólida.**
5. **No construir Fase 3 todavía.** La tarjeta es visión, no sprint.
6. **Pessy NO diagnostica, NO prescribe.** Siempre lifestyle, nunca clínico.
7. **Pessy es un agente, no un formulario.** El tutor no viene a cargar datos — viene a que Pessy le resuelva el día.

---

## CLOUD FUNCTIONS ACTIVAS (~50 funciones)

| Categoría | Cantidad | Estado |
|-----------|----------|--------|
| Documentos / IA análisis | 3 | ✅ |
| Recordatorios / Notificaciones | 5 | ✅ |
| Tratamientos / Medicamentos | 9 | ✅ |
| Comunidad | 3 | ✅ |
| Lugares | 1 | ✅ |
| Email / Gmail OAuth | 7 | ✅ |
| Autenticación / Co-tutores / GDPR | 7 | ✅ |
| Citas | 3 | ✅ |
| Media / Fotos | 1 | ✅ |
| Brain IA / Vertex | 8 | ✅ |
| Gmail extracción clínica | 11 | ❌ DESHABILITADAS |

---

*Este documento es la fuente de verdad del producto.*
*Todo agente, desarrollador y sprint empieza leyendo esto.*

---

## SISTEMA DE APRENDIZAJE PROGRESIVO (core de la IA)

### La idea central
Pessy NO pregunta todo en el onboarding. Aprende preguntando una cosa por día,
durante semanas, de forma natural — como una conversación.

### El loop en 4 semanas

**Semana 1 — Pessy escucha:**
Una pregunta por día, en momentos naturales.
- "¿A qué hora sale Thor a caminar normalmente?"
- "¿Cuántas veces al día come?"
- "¿Tiene algún parque favorito?"
- "¿Lo baña en casa o lo llevás a la peluquería?"

**Semana 2 — Pessy anticipa:**
Ya tiene datos. ANTES de la hora habitual del paseo:
→ *"Son las 18hs — ¿hoy salen con Thor?"* [Sí, salimos] [Hoy no]
El tutor toca un botón. Pessy registra sin fricción.

**Semana 3+ — Pessy proactiva:**
Conoce el patrón. Si el paseo no ocurrió a la hora habitual:
→ *"Thor lleva 2 días sin su paseo de las 18hs. ¿Todo bien?"*

**IA de raza siempre activa:**
→ *"Labradores de 3 años necesitan 60 min de actividad diaria.*
*Thor lleva 20 min esta semana. ¿A dónde lo llevás habitualmente?"*
→ El tutor responde. Pessy guarda el lugar favorito.

### Reglas del sistema de preguntas
1. NUNCA más de 1 pregunta por sesión de uso
2. Las preguntas aparecen en momentos contextuales (antes del paseo habitual, al abrir la app, después de una acción)
3. Cada respuesta alimenta el motor de IA y mejora las sugerencias
4. El tutor puede ignorar — Pessy vuelve a intentar otro día
5. Una vez que Pessy aprendió algo, NO vuelve a preguntar lo mismo

### Preguntas por categoría (banco de preguntas)

| Categoría | Pregunta |
|-----------|---------|
| Paseos | ¿A qué hora sale Thor normalmente? |
| Paseos | ¿Cuántas veces por día? |
| Paseos | ¿Tiene un parque favorito? |
| Alimentación | ¿A qué hora come por las mañanas? |
| Alimentación | ¿Qué marca de alimento come? |
| Veterinario | ¿A qué veterinaria llevas a Thor? |
| Veterinario | ¿Con qué frecuencia lo revisás? |
| Salud | ¿Tiene alguna alergia conocida? |
| Salud | ¿Toma alguna medicación crónica? |
| Personalidad | ¿Le gusta jugar con otros perros? |
| Personalidad | ¿Tiene miedo a los truenos? |

### Trigger contextual de raza (siempre personalizado)
Formato: *"Perros de [raza] de [edad] años: [recomendación de raza]. ¿[pregunta accionable sobre Thor]?"*
→ *"Bulldogs Franceses de 4 años son propensos a problemas respiratorios en calor.*
*¿Cómo te fue en los últimos paseos de verano con Thor?"*

---
