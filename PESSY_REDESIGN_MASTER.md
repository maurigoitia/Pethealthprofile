# PESSY — Redesign Master Rules

> Última actualización: abril 2026
> Este documento define las reglas de diseño y arquitectura de UI que ningún agente puede ignorar.

---

## Reglas Inamovibles

### Regla #1 — Mobile First
Todo diseño parte de 390px. No se diseña en desktop y se adapta.

### Regla #2 — Plano Design System
Tokens de color, tipografía y espaciado definidos en el sistema Plano. No se usan valores hardcodeados sin justificación.

### Regla #3 — Un CTA por pantalla
Cada pantalla tiene una acción principal dominante. No más de una.

### Regla #4 — Sin estados vacíos sin acción
Todo estado vacío (sin datos, sin mascotas, sin historial) tiene un CTA que lleva al usuario a algo útil.

### Regla #5 — Feedback inmediato
Toda acción del usuario tiene respuesta visual en ≤100ms (loading state, scale, color change).

### Regla #6 — Navegación predecible
El usuario nunca queda atrapado. Siempre hay un back, un onClose o un path de escape.

### Regla #7 — Dark green (#074738) para CTAs primarios
El color primario de acción es `#074738`. El secundario de éxito/conectado es `#1A9B7D`.

### Regla #8 — No modals apilados
Un modal a la vez. Si necesitás mostrar algo adicional, usá un sheet o una pantalla nueva.

### Regla #9 — Sin texto menor a 11px en producción
Accesibilidad mínima. Excepciones: badges, chips de status con max 3 chars.

### Regla #10 — Los colores de alerta tienen semántica fija
- 🔴 Rojo / Amber: urgente, vencido, riesgo
- 🟡 Amarillo: próximo, atención
- 🟢 Verde: al día, conectado, resuelto

### Regla #11 — The Connection Rule (CORE — Non-Negotiable)

**Toda pantalla que detecta una necesidad DEBE cerrar el loop con una acción ejecutable en 1 tap.**

```
Necesidad detectada → Pessy procesa → CTA ejecutable (1 tap)
```

#### Checklist por pantalla (obligatorio antes de mergear cualquier UI)

- [ ] ¿La pantalla detecta una necesidad? → ¿Tiene CTA que la resuelve?
- [ ] ¿El CTA lleva directo a la solución, no a una lista?
- [ ] ¿El copy del CTA es un verbo ejecutado? (Agendar, Comprar, Llamar — no "Ver" ni "Consultar")
- [ ] Si no hay backend para cerrar el loop → ¿el copy es honesto sobre el estado real?

---

## Patrones de UI Aprobados

### Vet Booking Bridge
Aparece después de cualquier detección de necesidad de salud.

```tsx
<button onClick={() => navigate("/home?viewmode=nearby-vets")} ...>
  <MaterialIcon name="local_hospital" />
  <p>¿Necesitás turno veterinario?</p>
  <p>Ver veterinarias con turno disponible</p>
  <span>Agendar →</span>
</button>
```

### Buy Bridge (MercadoLibre)
Aparece cuando el stock de alimento es ≤7 días.

```tsx
<a href={`https://listado.mercadolibre.com.ar/${encodeURIComponent(query)}`} ...>
  <MaterialIcon name="shopping_cart" />
  {daysLeft <= 3 ? "Comprar ahora — queda poco" : "Reponer esta semana"}
</a>
```

### Auto-Reminder (si el usuario cierra sin actuar)
Cuando un modal detecta urgencia y el usuario lo cierra sin ejecutar el CTA.

```tsx
// didActionRef.current = false → user didn't act
useEffect(() => {
  if (isOpen) return;
  if (!hasUrgency || didActionRef.current) return;
  addReminder({ ... notifyEnabled: true }).catch(() => {});
}, [isOpen]);
```

---

## Arquitectura de Pantallas

| Tipo | Pattern | Ejemplo |
|------|---------|---------|
| Modal de salud | Detecta → muestra estado → CTA bridge | VaccinationCardModal |
| Pantalla de revisión | Clasifica riesgo → CTA booking post-confirm | ClinicalReviewScreen |
| Feed contextual | Species-aware → auto-select según alerta | RecommendationFeed |
| Home widget | Detecta necesidad → CTA ejecutable | ContextualNexosSection |
| Preferencias | Muestra stock → buy link cuando urgente | SupplyForecast |

---

## Flujo de Deep Links

| URL | Resultado |
|-----|-----------|
| `/home?viewmode=nearby-vets` | Abre NearbyVetsScreen directamente |
| `/home?review=appointments` | Abre vista de turnos |
| `/home?review=medications` | Abre vista de medicamentos |
| `/home?review=feed` | Abre feed de actividad |

---

## Lo que está Pendiente (abril 2026)

| Item | Ticket | Prioridad |
|------|--------|-----------|
| NearbyVets — Google Maps real | SCRUM-68 | 🔴 Alta |
| Booking engine real con slots | Post SCRUM-68 | 🔴 Alta |
| Medication bridge de reposición | Bloqueado/marketplace | ⏳ |
| Skills update con Connection Rule | — | 🟡 Media |

---

*Ver también: CLAUDE.md § The Connection Rule, PESSY_IDENTIDAD_PRODUCTO.md*
