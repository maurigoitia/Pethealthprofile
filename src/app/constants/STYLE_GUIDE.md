# Guía de Estilos PESSY - Dirección Visual Plano

Documento de referencia para mantener la coherencia visual en toda la aplicación.

## Tipografía

### Headings (Todos los h1-h6)
**Font:** Plus Jakarta Sans
- **h1:** 32px, font-weight: 700, line-height: 1.2, letter-spacing: -0.5px
- **h2:** 28px, font-weight: 700, line-height: 1.3, letter-spacing: -0.3px
- **h3:** 24px, font-weight: 700, line-height: 1.3, letter-spacing: -0.2px
- **h4:** 20px, font-weight: 600, line-height: 1.4
- **h5:** 16px, font-weight: 600, line-height: 1.4
- **h6:** 14px, font-weight: 600, line-height: 1.5

**Aplicación en JSX:**
```tsx
style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
// O en className (si Tailwind está configurado):
className="font-jakarta"
```

### Body (Párrafos, inputs, labels)
**Font:** Manrope
- **Body:** 16px, font-weight: 400, line-height: 1.6
- **Body Small:** 14px, font-weight: 400, line-height: 1.5
- **Body Extra Small:** 12px, font-weight: 400, line-height: 1.4
- **Label:** 12px, font-weight: 600, line-height: 1.4, text-transform: uppercase

**Aplicación en JSX:**
```tsx
style={{ fontFamily: "'Manrope', sans-serif" }}
// O en className (si Tailwind está configurado):
className="font-manrope"
```

## Paleta de Colores

### Colores Primarios
- **Primary Deep:** #074738 — Acciones principales, botones, acentos
- **Primary Action:** #1A9B7D — Hover states, acciones secundarias
- **Primary Soft:** #E0F2F1 — Backgrounds suaves, active states
- **Primary Background:** #F0FAF9 — Background general de la app

### Colores de Acento
- **Purple Accent:** #5048CA — Para elementos especiales (si aplica)

### Colores de Texto
- **Text:** #1A1A1A — Texto principal
- **Text Secondary:** #6B7280 — Texto secundario, descripciones
- **Text Tertiary:** #9CA3AF — Texto débil, disabled
- **Text Inverse:** #FFFFFF — Texto sobre fondos oscuros

### Colores de Estado
- **Success:** #10B981 — Estados positivos, confirmaciones
- **Warning:** #F59E0B — Advertencias, acciones que requieren atención
- **Error:** #EF4444 — Errores, estados críticos
- **Info:** #3B82F6 — Información general

### Colores de UI
- **Border:** #E5E7EB — Bordes estándar
- **Border Light:** #F3F4F6 — Bordes suaves
- **Border Dark:** #D1D5DB — Bordes en zonas activas
- **Divider:** #F0F0F0 — Líneas separadoras
- **Background Light:** #FFFFFF — Fondo de tarjetas
- **Background Alt:** #F9FAFB — Fondo alternativo

**Uso en componentes:**
```tsx
className="border border-[#E5E7EB] bg-white text-[#1A1A1A]"
// O usar variables CSS (recomendado en theme.css):
className="border-border text-text"
```

## Espaciado

- **xs:** 4px
- **sm:** 8px
- **md:** 16px
- **lg:** 24px
- **xl:** 32px
- **xxl:** 48px
- **3xl:** 64px

**Uso recomendado:**
- Padding en tarjetas: 16px (md) o 24px (lg)
- Gap entre elementos: 8px (sm), 16px (md), 24px (lg)
- Margins verticales: 16px, 24px, 32px

## Border Radius

- **sm:** 8px — Elementos pequeños (checkboxes, pequeños botones)
- **md:** 12px — Botones estándar
- **lg:** 16px — Tarjetas, contenedores principales
- **xl:** 24px — Modales grandes, elementos especiales
- **full:** 9999px — Botones pill, avatares redondos

**Aplicación:**
```tsx
className="rounded-[16px]" // Para lg
className="rounded-[12px]" // Para md
className="rounded-full"   // Para avatares/pills
```

## Componentes Base

### Botones

#### Primary (Acciones principales)
```tsx
<button
  className="rounded-full bg-[#074738] px-6 py-3 font-bold text-white
             hover:bg-[#1A9B7D] transition-colors active:scale-95"
  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
>
  Etiqueta
</button>
```

#### Secondary (Acciones secundarias)
```tsx
<button
  className="rounded-[12px] border border-[#E5E7EB] bg-[#F0FAF9] px-6 py-3
             font-semibold text-[#074738] hover:bg-[#E0F2F1] transition-colors"
  style={{ fontFamily: "'Manrope', sans-serif" }}
>
  Etiqueta
</button>
```

#### Ghost (Minimal)
```tsx
<button
  className="rounded-[12px] px-4 py-2 text-[#6B7280] hover:text-[#074738]
             hover:bg-[#F0FAF9] transition-colors"
  style={{ fontFamily: "'Manrope', sans-serif" }}
>
  Etiqueta
</button>
```

### Tarjetas (Cards)

```tsx
<div
  className="rounded-[16px] border border-[#E5E7EB] bg-white p-4
             shadow-sm hover:shadow-md transition-shadow"
>
  <h3 className="text-lg font-bold text-[#074738]"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
    Título
  </h3>
  <p className="mt-2 text-[14px] text-[#6B7280]"
     style={{ fontFamily: "'Manrope', sans-serif" }}>
    Descripción
  </p>
</div>
```

### Inputs

```tsx
<input
  type="text"
  placeholder="Placeholder"
  className="w-full rounded-[12px] border border-[#E5E7EB] bg-white
             px-4 py-3 text-[#1A1A1A] outline-none
             focus:ring-2 focus:ring-[#074738]/20"
  style={{ fontFamily: "'Manrope', sans-serif" }}
/>
```

### Labels & Información

```tsx
<label
  className="text-[12px] font-bold uppercase tracking-[0.5px] text-[#6B7280]"
  style={{ fontFamily: "'Manrope', sans-serif" }}
>
  Etiqueta
</label>
```

## Shadow Elevation

- **sm:** 0 1px 2px 0 rgba(0, 0, 0, 0.05)
- **md:** 0 4px 6px -1px rgba(0, 0, 0, 0.1)
- **lg:** 0 10px 15px -3px rgba(0, 0, 0, 0.1)
- **xl:** 0 20px 25px -5px rgba(0, 0, 0, 0.1)

**Uso:** Las tarjetas y elementos elevados deben usar shadow-sm o shadow-md para darles profundidad sin saturar.

## Transiciones

- **Duración:** 200ms a 300ms para la mayoría de interacciones
- **Easing:** ease-in-out (por defecto en Tailwind)

```tsx
className="transition-colors hover:bg-[#E0F2F1]"
className="transition-all hover:shadow-lg"
className="active:scale-95 transition-transform"
```

## Accesibilidad

- **Color de texto principal:** #1A1A1A sobre #FFFFFF (contrast ratio: 16.5:1)
- **Texto secundario:** #6B7280 sobre #FFFFFF (contrast ratio: 7:1)
- **Texto en primary (#074738):** Siempre #FFFFFF (contrast ratio: 8:1)
- **Borders:** #E5E7EB es visible en fondo blanco (contrast ratio: 3:1)

**Siempre usar aria-labels en iconos decorativos:**
```tsx
<MaterialIcon
  name="check"
  aria-hidden="true"  // Para iconos puramente visuales
/>
```

## Exportar Colores para TypeScript

Todos los colores están disponibles en:
```tsx
import { PESSY_COLORS, PESSY_SPACING, PESSY_RADIUS } from '@/app/constants/designTokens';

// Uso:
const bgColor = PESSY_COLORS.primary;       // #074738
const padding = PESSY_SPACING.md;           // 16px
const borderRadius = PESSY_RADIUS.lg;       // 16px
```

## Checklist para Code Review

Al revisar PRs visuales, verificar:

- [ ] **Tipografía:** ¿Headings usan Plus Jakarta Sans? ¿Body usa Manrope?
- [ ] **Colores:** ¿Se usan colores de la paleta Plano?
- [ ] **Bordes:** ¿Radius #E5E7EB para bordes estándar?
- [ ] **Spacing:** ¿Padding/gaps están dentro de la escala (4/8/16/24/32)?
- [ ] **Estados:** ¿Hover/active states con colores del sistema?
- [ ] **Accesibilidad:** ¿Contrast ratio >= 4.5:1 para body text?
- [ ] **Mobile:** ¿Se respeta el safe area en notch devices?
- [ ] **Dark Mode:** ¿Los componentes se ven bien en modo oscuro?

---

**Última actualización:** 2026-03-26
**Versión:** 1.0
**Responsable:** Tech Lead Frontend
