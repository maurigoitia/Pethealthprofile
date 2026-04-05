# PESSY — Identidad de Producto

> Última actualización: abril 2026

---

## Identidad del Producto

**"Pessy te ayuda a llevar el día a día de tu mascota."**
Rutinas, alimentación, salud y cuidados — todo en un lugar.

Esto es lo que Pessy ES. Una app donde el tutor maneja la vida completa de su mascota.
Clara, honesta, cualquier persona lo entiende en 3 segundos.

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
- **Dolor central**: la carga cognitiva de cuidar bien — recordar, buscar, coordinar
- **Promesa**: Pessy elimina el "tenés que buscar" — detecta y conecta

---

## Qué ES Pessy

- Un **conector activo** entre la mascota y los servicios/productos que necesita
- Una **capa de contexto** que aprende el perfil de la mascota para conectar con precisión
- Un **motor de cierre de loop**: necesidad → solución → ejecutado

## Qué NO ES Pessy

- ❌ Un organizador de rutinas (eso es consecuencia, no propósito)
- ❌ Un directorio de veterinarios
- ❌ Una app que "avisa" y te deja a vos buscando
- ❌ Un marketplace (por ahora — llega en una fase posterior)

---

## Módulos del Producto

| Módulo | Función de conexión |
|--------|---------------------|
| Identidad Digital | Aprende quién es la mascota → alimenta todas las conexiones |
| Salud / Vacunas | Detecta vencimientos → conecta con vets disponibles |
| Salud / Medicamentos | Detecta stock bajo → bridge de reposición (pendiente marketplace) |
| Nutrición / Alimento | Detecta stock bajo → conecta con MercadoLibre |
| Rutinas | Detecta necesidades del día → conecta con quien las resuelve |
| Recordatorios | No solo avisa — conecta cuando la acción es ejecutable |
| Vets / Servicios | Directorio + booking bridge (SCRUM-68 pendiente) |
| Comunidad | Feed + Perdidos + Adopción |

---

## Reglas de Diseño Derivadas

1. **Toda pantalla que detecta una necesidad DEBE cerrar el loop con un CTA ejecutable.**
2. **El CTA debe ser de 1 tap** — no redirigir a una lista, sino a la acción directa.
3. **El copy nunca termina en "buscá" o "consultá"** — siempre termina en un verbo ejecutado.
4. **Si no hay backend para cerrar el loop** (ej: sin marketplace aún), no prometer la conexión — mostrar el estado real.

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
