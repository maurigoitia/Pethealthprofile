# PESSY — Identidad de Producto

> Última actualización: abril 2026

---

## ⚠️ CORRECCIÓN CRÍTICA: Pessy NO es una app médica

**Pessy es un ecosystem de lifestyle para tutores de mascotas. NO es un dispositivo médico, NO diagnostica, NO prescribe.**

Pessy CONECTA con servicios (vets, petshops, seguros) pero NO proporciona atención veterinaria. El veterinario es quien diagnostica y trata.

Esta distinción es crítica por razones regulatorias.

---

## Identidad del Producto

**"Pessy te ayuda a llevar el día a día de tu mascota."**
Rutinas, alimentación, paseos, compras y servicios — todo en un lugar.

Esto es lo que Pessy ES. Un ecosystem central donde el tutor:
- Organiza rutinas y recordatorios
- Compra alimento y supplies
- Agenda servicios (vet, grooming)
- Accede a crédito y seguros
- Paga todo desde un lugar

Clara, honesta, cualquier persona lo entiende en 3 segundos.

**Lo que Pessy NO es:** Una app médica, un consultor veterinario, o un diagnóstico. Eso lo hace el vet.

---

## Build Rule (cómo construimos cada feature)

Toda feature que detecte una necesidad debe cerrar el loop con una acción ejecutable en 1 tap.
Esto no es el posicionamiento — es el estándar de construcción interno.

---

## El Loop de Producto (no negociable)

```
Necesidad detectada  →  Pessy procesa  →  Acción concreta en 1 tap
```

### Ejemplos correctos

| Señal detectada | Acción que Pessy ejecuta |
|----------------|--------------------------|
| Vacuna vence en 7 días | Muestra 2-3 vets cercanos con turno → [Agendar] |
| Alimento por agotar (≤7 días) | Link directo a MercadoLibre → [Comprar ahora] |
| Riesgo clínico clasificado | Vet Booking Bridge post-revisión → [Agendar turno] |
| Medicamento terminándose | Bridge a reposición (cuando marketplace esté disponible) |

### Ejemplos incorrectos (prohibidos)

| ❌ Incorrecto | ✅ Correcto |
|--------------|------------|
| "Vacuna vence pronto, consultá un vet" | "Vence el X. 3 vets tienen turno → [Agendar]" |
| "Te recomendamos este alimento" | "Thor come Royal Canin → [Comprar ahora]" |
| "Tu mascota necesita atención" | "Riesgo detectado → [Ver vets disponibles]" |

---

## Vocabulario de Producto

| Viejo (prohibido) | Nuevo (correcto) |
|-------------------|-----------------|
| Organiza | Conecta |
| Sugiere | Ejecuta |
| Ecosistema digital | Conecta sin que busques |
| Ver veterinarios | Agendar con veterinario |
| Tracking | Cierre de loop |
| Todo en orden | Todo conectado |
| Te recomendamos | Acá está |
| Buscá un especialista | [2 especialistas cerca → Agendar] |

---

## Audiencia

- **Pet parents urbanos** con 1-2 mascotas (perro o gato)
  - **Mercados iniciales:** Argentina, México, Chile, Colombia, Uruguay, Brasil (portugués), USA
  - **Perfil:** Usuarios smartphone-first en LatAm + USA. Higher willingness-to-pay en USA; market size compensation en LatAm
- **Dolor central**: la carga cognitiva de cuidar bien — recordar, buscar, coordinar
  - **Consistente en todos los mercados:** Fragmentación de servicios, necesidad de billetera integrada, búsqueda manual
- **Promesa**: Pessy elimina el "tenés que buscar" — detecta y conecta

---

## Qué ES Pessy

- Un **conector activo** entre la mascota y los servicios/productos que necesita
- Una **capa de contexto** que aprende el perfil de la mascota para conectar con precisión
- Un **motor de cierre de loop**: necesidad → solución → ejecutado

## Qué NO ES Pessy

- ❌ Una app médica o dispositivo de salud (NO diagnostica, NO prescribe)
- ❌ Un consultor veterinario o médico
- ❌ Un organizador de rutinas puro (eso es consecuencia, no propósito)
- ❌ Un directorio de veterinarios inerte
- ❌ Una app que "avisa" y te deja a vos buscando
- ❌ Un marketplace genérico (por ahora — llega en una fase posterior)

---

## Módulos del Producto

| Módulo | Función de conexión |
|--------|---------------------|
| Identidad Digital | Aprende quién es la mascota → alimenta todas las conexiones |
| Rutinas | Organiza día a día (paseos, tomas de meds, alimentación) |
| Paseos | Social layer + location tracking (futuro) |
| Nutrición / Alimento | Detecta stock bajo → conecta con MercadoLibre |
| Salud / Vacunas | Detecta vencimientos → conecta con vets disponibles (NO diagnostica) |
| Salud / Medicamentos | Detecta stock bajo → bridge de reposición (pendiente marketplace) |
| Servicios / Vets | Directorio + booking bridge (SCRUM-68 pendiente) |
| Servicios / Grooming | Similar a vets — conexión, no ejecución |
| Compras | Marketplace contextual (MercadoLibre, petshops integrados) |
| **💳 Capa Financiera** | **FUTURA: Crédito, seguros, tarjeta de crédito (Fase 2+)** |
| Comunidad | Feed + Perdidos + Adopción |

---

## Reglas de Diseño Derivadas

1. **Toda pantalla que detecta una necesidad DEBE cerrar el loop con un CTA ejecutable.**
2. **El CTA debe ser de 1 tap** — no redirigir a una lista, sino a la acción directa.
3. **El copy nunca termina en "buscá" o "consultá"** — siempre termina en un verbo ejecutado.
4. **Si no hay backend para cerrar el loop** (ej: sin marketplace aún), no prometer la conexión — mostrar el estado real.
5. **NUNCA dar consejos médicos o interpretar resultados clínicos.** Pessy CONECTA con veterinarios, no DIAGNOSTICA. Si algo requiere interpretación médica, el copy dice "Compartí esto con tu veterinario" — siempre dejando la decisión clínica al profesional.

---

## Alcance de Mercado

**Pessy no es un producto solo para Argentina.** El TAM real es LatAm + USA:

| Mercado | Pet Owners | Gasto Anual (USD) | Fase de Entrada |
|---------|-----------|------------------|-----------------|
| Argentina | 10M | $200-400 | Ahora (Q2 2026) |
| México | 20M | $300-600 | Q3-Q4 2026 |
| Chile | 4M | $400-800 | Q4 2026 |
| Colombia | 8M | $150-350 | Q1 2027 |
| Uruguay | 1.5M | $400-800 | Q1 2027 |
| **LatAm Spanish** | **43.5M** | **$200-600** | **Fase 1** |
| Brasil | 45M | $250-500 | Q2 2027 (portugués) |
| USA | 90M+ | $1,200-1,500 | Q3-Q4 2027 (English) |
| **TOTAL** | **~178M** | **$50B+** | **3 años** |

**Estrategia de ejecución:**
1. **Argentina primero:** Menor complejidad regulatoria, densidad de early adopters, validación de product-market fit
2. **LatAm Spanish:** México, Chile, Colombia — escala rápida una vez validado
3. **Brasil:** Mismo producto, localización a portugués, partnerships con fintechs locales
4. **USA:** Expansión final (pero mayor TAM y willingness-to-pay)

**Diferenciador geográfico:**
- Pessy entra cada mercado con diferentes mensajes de marketing y partnerships, pero el producto core es el mismo
- En USA: enfoque en "Pet Financial Hub" (tarjeta + seguros). En LatAm: enfoque en "Conexión sin buscar"

---

## Estado Actual (abril 2026)

### Loops cerrados ✅
- Alimento por agotar → MercadoLibre link
- Vacuna vencida/próxima → Maps búsqueda vets + auto-reminder
- Riesgo clínico → Vet Booking Bridge (navega a NearbyVets)
- Alerta clínica urgente → RecommendationFeed auto-selecciona Veterinarias

### Loops pendientes ⏳
- Medicamentos → bridge de reposición (bloqueado por marketplace)
- Vets → booking engine real con slots (SCRUM-68)
- Vacunas → booking engine real (depende de SCRUM-68)

---

*Fuente de verdad para todos los agentes AI de Pessy.*
*Ver también: CLAUDE.md § The Connection Rule, PESSY_REDESIGN_MASTER.md*
