# PESSY — Regla Dorada: Patrones de Uso de AI

> SCRUM-57 · Última actualización: abril 2026
> Para agentes AI (Claude, Codex, Cursor) trabajando en el codebase de Pessy.

---

## La Regla Dorada

**Pessy conecta a tu mascota con lo que necesita, sin que tengas que buscar.**

Todo código, copy y diseño que produzcas debe respetar esta regla.
Si una pantalla detecta una necesidad y no la resuelve en 1 tap → el trabajo está incompleto.

---

## Reglas de Trabajo para Agentes AI

### NUNCA hagas estas cosas

| ❌ Prohibido | Por qué |
|-------------|---------|
| Deploy desde `main` | Solo se deploya desde `pessy-website` con `bash deploy-with-landing.sh` |
| `firebase deploy` directo | Saltea el landing page copy step → rompe producción |
| Tocar el módulo veterinario (BETA) | Está desconectado intencionalmente, no conectar |
| Implementar pagos | Fuera de scope por ahora |
| Implementar marketplace | Fuera de scope por ahora |
| Crear una pantalla sin CTA ejecutable | Viola la Connection Rule |
| Copy que termina en "buscá" o "consultá" | Viola la Connection Rule |

### SIEMPRE haz estas cosas

| ✅ Obligatorio | Cuándo |
|--------------|--------|
| Crear ticket Jira antes de empezar | Todo trabajo de código |
| Seguir orden de prioridad del sprint | `pessy-team.atlassian.net` board |
| Actualizar Jira DESPUÉS del código | No antes |
| Aplicar Connection Rule checklist | Toda pantalla nueva o modificada |
| `npm run build` antes de commit | Para verificar que compila |
| `rm -f dist/index.html` antes del deploy | Pre-requisito del script |

---

## Patrones de Código Aprobados

### 1. Vet Booking Bridge
Úsalo después de cualquier detección de necesidad de salud.

```tsx
// En cualquier modal/pantalla que detecta urgencia de salud
<button
  onClick={() => navigate("/home?viewmode=nearby-vets")}
  className="mt-3 w-full rounded-xl bg-[#074738] px-4 py-3 flex items-center justify-between active:scale-[0.97] transition-all"
>
  <div className="flex items-center gap-3">
    <div className="size-9 rounded-full bg-[#1A9B7D]/20 flex items-center justify-center shrink-0">
      <MaterialIcon name="local_hospital" className="text-[#1A9B7D] text-lg" />
    </div>
    <div className="text-left">
      <p className="text-white text-sm font-bold">¿Necesitás turno veterinario?</p>
      <p className="text-white/70 text-xs mt-0.5">Ver veterinarias con turno disponible</p>
    </div>
  </div>
  <div className="flex items-center gap-1 bg-[#1A9B7D] rounded-lg px-3 py-1.5 shrink-0">
    <p className="text-white text-xs font-bold">Agendar</p>
    <MaterialIcon name="arrow_forward" className="text-white text-sm" />
  </div>
</button>
```

### 2. Auto-Reminder (si el usuario no actúa)
Cuando el usuario cierra un modal sin ejecutar el CTA de urgencia.

```tsx
const didActionRef = useRef(false);

// En el CTA handler:
const handleAction = () => {
  didActionRef.current = true;
  // ... acción
};

// Auto-reminder si cierra sin actuar:
useEffect(() => {
  if (isOpen) return;
  if (!hasUrgency || didActionRef.current || !activePet?.id) return;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  addReminder({
    petId: activePet.id,
    type: "checkup", // o "vaccine", "medication", etc.
    title: `Acción pendiente — ${petData.name}`,
    notes: "Cerró sin actuar — recordar coordinar",
    dueDate: tomorrow.toISOString().slice(0, 10),
    dueTime: "10:00",
    repeat: "none",
    notifyEnabled: true,
  }).catch(() => {});
}, [isOpen]);
```

### 3. Buy Bridge (MercadoLibre)
Para stock de alimento con urgencia (≤7 días).

```tsx
{urgency !== "emerald" && (
  <a
    href={`https://listado.mercadolibre.com.ar/${encodeURIComponent(
      foodBrand
        ? `${foodBrand} ${petSpecies === "cat" ? "gato" : "perro"}`
        : `alimento ${petSpecies === "cat" ? "gato" : "perro"}`
    )}`}
    target="_blank"
    rel="noopener noreferrer"
    className="mt-3 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-[#074738] text-white text-xs font-black active:scale-[0.98] transition-transform"
  >
    <MaterialIcon name="shopping_cart" className="text-sm" />
    {daysLeft <= 3 ? "Comprar ahora — queda poco" : "Reponer esta semana"}
  </a>
)}
```

### 4. Species-Aware Categories (RecommendationFeed)
Personalizar por especie, nunca mostrar contenido de perro a gato.

```tsx
function buildCategories(species: string, hasUrgentAlert: boolean) {
  if (species === "cat") {
    return [
      { id: "veterinarias", label: "Veterinarias felinas", ... },
      { id: "grooming", label: "Grooming felino", ... },
      { id: "tiendas", label: "Tiendas", ... },
    ];
  }
  // dog / default
  return [
    { id: "veterinarias", label: "Veterinarias caninas", ... },
    { id: "parques", label: "Parques para perros", ... },
    { id: "grooming", label: "Grooming canino", ... },
    { id: "tiendas", label: "Tiendas", ... },
  ];
}

// Auto-select vets si hay alerta urgente
const defaultCategory = hasUrgentAlert ? "veterinarias" : categories[0].id;
```

### 5. Deep Links desde otras pantallas
Para navegar a vistas específicas del home.

```tsx
// Abrir NearbyVets directamente
navigate("/home?viewmode=nearby-vets");

// Abrir vista de turnos
navigate("/home?review=appointments");

// Abrir vista de medicamentos
navigate("/home?review=medications");
```

---

## Contextos Disponibles (no reinventes la rueda)

| Contexto | Hook | Qué da |
|----------|------|--------|
| Pet activa | `usePet()` | `activePet`, species, id, nombre |
| Auth | `useAuth()` | `user`, uid, loading |
| Recordatorios | `useReminders()` | `addReminder()`, lista |
| Alertas clínicas | `useMedical()` | `getClinicalAlertsByPetId()` |
| Navegación | `useNavigate()` | navigate() |

---

## Checklist antes de hacer PR

- [ ] ¿Build pasa sin errores? (`npm run build`)
- [ ] ¿Toda pantalla nueva tiene CTA ejecutable (Connection Rule)?
- [ ] ¿El copy no termina en "buscá" o "consultá"?
- [ ] ¿Usé contextos existentes en lugar de prop drilling?
- [ ] ¿Commit message sigue el patrón `tipo(SCRUM-XX): descripción`?
- [ ] ¿Ticket Jira actualizado a Finalizado?
- [ ] ¿Deploy hecho con `bash deploy-with-landing.sh` desde `pessy-website`?

---

## Jira

- URL: `pessy-team.atlassian.net`
- Proyecto: `SCRUM`
- Board ID: `1`
- Transition IDs: `11`=Por hacer · `21`=En curso · `31`=En revisión · `41`=Finalizado

---

*Ver también: CLAUDE.md § The Connection Rule, PESSY_IDENTIDAD_PRODUCTO.md, PESSY_REDESIGN_MASTER.md*
