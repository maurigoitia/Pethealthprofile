# PESSY — Audit de Alineación a La Regla de Conexión

**Fecha:** 3 abril 2026  
**Disparador:** Mauri define nueva dirección estratégica  
**Regla auditada:** _"Pessy conecta a tu mascota con lo que necesita, sin que tengas que buscar."_

---

## La Regla (grabada en CLAUDE.md y PESSY_IDENTIDAD_PRODUCTO.md)

El posicionamiento anterior decía: **"organiza y sugiere"**  
El nuevo posicionamiento es: **"conecta y ejecuta"**

La diferencia no es cosmética. Es el core del producto:

| Antes | Después |
|-------|---------|
| "Vacuna vence pronto, consultá un vet" | "Vacuna vence. Estos 3 vets tienen turno mañana → [Agendar]" |
| "Te recomendamos este alimento" | "Thor come Royal Canin → [Comprar ahora]" |
| "Tu mascota necesita grooming" | "Último baño: hace 5 semanas → [Agendar grooming — hoy 14hs disponible]" |

**Pessy no deja al usuario buscando. Pessy lleva al usuario directo ahí.**

---

## Estado Actual: ¿Está Pessy orientada a esto?

**Respuesta corta: NO** (al 3 abril 2026 — en proceso de corrección)

De todos los documentos auditados, la regla existía de forma implícita pero nunca estaba escrita como regla inamovible. El producto estaba orientado a "organizar y sugerir", no a "conectar y cerrar el loop".

### Documentos actualizados en esta sesión:
- ✅ `CLAUDE.md` — Sección nueva: "The Connection Rule (CORE — Non-Negotiable)"
- ✅ `PESSY_IDENTIDAD_PRODUCTO.md` — Posicionamiento reescrito, loop de producto actualizado
- ✅ `PESSY_REDESIGN_MASTER.md` — Regla #11 agregada a "Reglas Inamovibles"
- ✅ `PESSY_CONEXION_AUDIT.md` — Este documento (estado y gaps completos)

---

## Audit por Área

### 1. Copy & Landing Page

**Gaps encontrados:**

| Elemento | Copy Actual | Gap | Copy Sugerido | Prioridad |
|----------|-------------|-----|---------------|-----------|
| Tagline splash | "Tu asistente de salud mascotas" | Pasivo, organizacional | "Conecta a tu mascota con lo que necesita" | 🔴 ALTA |
| Onboarding | "Get guidance, track care, stay connected" | Soft language, sin acción directa | "Registra una necesidad, Pessy la resuelve" | 🔴 ALTA |
| Home status | "Everything looks good" | Observación pasiva | "Si algo cambia, Pessy te conecta con quien lo resuelve" | 🟡 MEDIA |
| Check-in CTA | "Help guide you" | Implica consejo, no conexión | "Pessy te lleva directo al vet" | 🔴 ALTA |
| Vaccine flow | "Vaccine expires soon" | Loop roto: el usuario busca solo | "Vence el X. 3 vets cercanos tienen turno → [Agendar]" | 🔴 CRÍTICA |
| Food logging | Sin copy de conexión | Falta commerce bridge | "Thor come Brand X → [Comprar ahora]" | 🔴 ALTA |
| CTAs generales | "Get Guidance", "View", "Continue" | Genéricos, sin acción clara | "Agendar", "Comprar", "Conectar con veterinario" | 🔴 ALTA |

**Diagnóstico:** Todos los verbos actuales son pasivos: organizar, sugerir, ver, guiar.  
Necesitan reemplazarse por verbos activos: **conectar, agendar, comprar, ejecutar.**

---

### 2. Redes Sociales & Marketing

**Estado del plan semanal (30 Mar - 3 Abr):**

| Día | Tema | ¿Muestra conexión? | Gap |
|-----|------|--------------------|-----|
| Lun | Adopción responsable | ❌ Solo educación | No muestra cómo Pessy conecta adoptantes con refugios, vets, seguimiento |
| Mar | Boom pet LATAM | ❌ Dato de industria | Pessy aparece como observador pasivo del trend |
| Mié | Denuncia maltrato online | ✅ Orientado a acción | El más cercano — pero el link es externo, no Pessy |
| Jue | Ansiedad por separación | ❌ Síntomas solo | Sin pathway de solución → Pessy no conecta con etólogo ni vet |
| Vie | Castraciones gratuitas | ✅ Orientado a acción | Dice "consultá tu municipio" — Pessy debería ser quien geolocaliza |

**Tagline actual en todos los posts:** `pessy · Ecosistema digital para mascotas`  
**Gap:** "Ecosistema digital" es organizacional. No comunica la promesa de conexión.  
**Tagline sugerido:** `pessy · Tu mascota siempre conectada con lo que necesita`

**5 posts nuevos propuestos para mostrar la conexión:**

1. **Adopción + Pessy conecta:** "Adoptar es hermoso. Pessy conecta con el refugio, coordina la visita, agenda el primer vet, hace el seguimiento. Adopción sin drama."
2. **Boom pet + Pessy como conector:** "El mercado pet crece. ¿Quién conecta a los tutores con los servicios nuevos? Pessy."
3. **Maltrato + Pessy:** "Denunciaste maltrato. Pessy conecta tu denuncia con rescatistas, vets y ONG de tu zona."
4. **Ansiedad + Conexión:** "Tu perro tiene ansiedad. Pessy lo conecta con veterinarios conductuales verificados cerca tuyo."
5. **Castración + Pessy geolocaliza:** "Castraciones gratuitas existen. Pessy las geolocaliza, agenda la cita, te avisa. Eso es conectar."

---

### 3. Flujos UX de la App

| Flujo | Estado | Gap | Sprint Impact |
|-------|--------|-----|---------------|
| Auth/Onboarding | ✅ OK | Ninguno | Sin cambio |
| Home Dashboard | ⚠️ Parcial | Tips detectan necesidad pero no tienen CTA de booking | Agregar CTA a Sprint 1 |
| Health/Vacunas | 🚨 CRÍTICO | Expiry detectado pero sin botón de agendar vet | Redesign Vaccine Detail |
| Health/Medicamentos | 🚨 CRÍTICO | Medicamento por agotar sin link de compra | Agregar pharmacy link a Med Detail |
| Nutrición | 🚨 CRÍTICO | Receta mostrada sin buy link | Agregar Chewy/Amazon links a recipes |
| Triage/Documentos | 🚨 CRÍTICO | Riesgo detectado (HIGH/MEDIUM/LOW) pero sin CTA de vet booking | Redesign Clinical Review screen |
| Calendario | ✅ OK | Funciona, depende de Flow 7 | Sin cambio |
| Social/Sharing | ✅ OK | Ninguno | Sin cambio |
| Vets/Servicios | 🚨 CRÍTICO | Es un directorio, no un booking engine | ELEVAR Services Marketplace a Sprint 1 P0 |
| Settings | ✅ OK | Ninguno | Sin cambio |
| Super-App (Community) | ⚠️ Pendiente | UI no diseñada aún | Evaluar cuando tenga spec |

**Cambio crítico de sprint:**  
El Services Marketplace estaba en Sprint 3 / P3. **Debe moverse a Sprint 1 P0.**

Por qué: Es el execution engine de toda la promesa de conexión. Sin él, cada pantalla que detecta una necesidad queda sin cerrarse.

```
Sprint 1 nuevo P0 (agregar):
- Vet Booking Bridge: directorio filtrado + disponibilidad + one-tap booking
- Medication Detail + pharmacy links
- Vaccine Detail + "Book vaccination clinic" CTA
- Clinical Review + risk → vet booking connection
```

---

### 4. Skill Files (Agentes AI)

De 9 skills auditados, ninguno mencionaba la regla de conexión (al momento del audit).

| Skill | Estado | Cambio Requerido | Prioridad |
|-------|--------|-----------------|-----------|
| pessy-screen-designer | ❌ Sin regla | Agregar "Regla de Conexión" + checklist por pantalla | 🔴 ALTA |
| pessy-ux-team | ❌ Sin regla | Agregar heurística #11: Cierre de Loop + checklist por rol | 🔴 CRÍTICA |
| pessy-copywriter | ❌ Sin regla | Agregar regla #11: Copy que Cierra Loop | 🔴 ALTA |
| pessy-social-team | ❌ Sin regla | Agregar Paso 4: CTAs de Conversión + deep links | 🔴 ALTA |
| ask-the-people-copywriter | ❌ Sin regla | Agregar Paso 5: Responder CON Acción Pessy | 🔴 ALTA |
| pessy-stitch | ❌ Sin regla | Agregar regla #8: Cierre de Loop en Stitch Designs | 🟡 MEDIA |
| pessy-community-builder | ❌ Sin regla | Agregar "Segundo Loop: Engagement → Acción Pessy" | 🟡 MEDIA |
| social-media-designer | ❌ Sin regla | Agregar CTA Visual Hierarchy section | 🟡 MEDIA |
| pessy-security-audit | N/A | Opcional: F7 en checklist de datos vet | 🟢 BAJA |

---

## Prioridad de Ejecución

### 🔴 Hacer ahora (esta semana)

1. **Actualizar skills core** — pessy-screen-designer, pessy-ux-team, pessy-copywriter, pessy-social-team con la Regla de Conexión
2. **Redesign Vaccine Detail** — agregar Vet Booking Bridge con slots disponibles + botón "Agendar"
3. **Redesign Clinical Review** — después de risk classification, mostrar vets que atienden la condición + booking
4. **Tagline update** — cambiar "Ecosistema digital para mascotas" → "Tu mascota conectada con lo que necesita"
5. **Mover Services Marketplace a Sprint 1 P0**

### 🟡 Esta semana / próxima

1. Rediseñar Medication Detail con pharmacy links
2. Agregar buy links a Nutrition Recipes
3. Actualizar plan de social media con el nuevo messaging
4. Actualizar skills secundarios (ask-the-people, community-builder, social-media-designer)

### 🟢 Mediano plazo

1. Crear "Deep Links Standard" document (booking, purchase, share links)
2. Implementar métricas de "Close the Loop" en QA
3. Actualizar todos los skills para referenciar PESSY_IDENTIDAD_PRODUCTO.md como fuente de verdad

---

## El Cambio de Lenguaje (Mapa Completo)

| Vocabulario viejo | Vocabulario nuevo |
|-------------------|-------------------|
| Organiza | Conecta |
| Sugiere | Ejecuta |
| Ecosistema digital | Conecta sin que busques |
| Ver veterinarios | Agendar con veterinario |
| Tracking | Cierre de loop |
| Todo en orden | Todo conectado |
| Te recomendamos | Acá está |
| Buscá un especialista | [2 especialistas cerca → Agendar] |

---

_Generado: 3 abril 2026 · Pessy AI System_
