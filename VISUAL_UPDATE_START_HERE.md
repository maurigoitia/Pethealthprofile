# 🎨 Actualización Visual PESSY — Plano Design System

**Estado:** ✅ COMPLETADO | **Rama:** `sandbox/restructure-and-flutter-prep`

---

## Lo Que Se Hizo

Se realizó una actualización visual **completa** de PESSY para alinearla con la dirección "Functional Warm Tech" de Plano.

### ✨ Cambios Principales

**Tipografía**
- ✅ Plus Jakarta Sans para todos los headings (h1-h6)
- ✅ Manrope para body, inputs, labels
- ✅ Importado desde Google Fonts en `index.html`

**Colores** (Paleta Plano)
- ✅ `#074738` — Primary (botones, acentos)
- ✅ `#1A9B7D` — Accent (hover, active states)
- ✅ `#E0F2F1` — Surface (backgrounds suaves)
- ✅ `#F0FAF9` — Background general
- ✅ Colores de estado: Success, Warning, Error, Info

**Componentes Mejorados** (13 archivos)
- ✅ Header — Plus Jakarta Sans en nombre
- ✅ LoginScreen — Inputs con Manrope, botones con Plus Jakarta
- ✅ BottomNav — Active state con #E0F2F1
- ✅ QuickActions — Cards con bordes #E5E7EB
- ✅ RoutineChecklist — Checkboxes y labels optimizados
- ✅ DailyHookCard — Padding y radius mejorados
- ✅ Sidebar — Logo y navegación actualizada
- ✅ EmptyState — Colors y tipografía Plano
- ✅ ActionTray — Heading y texto optimizado
- ✅ PessyTip — Colores de acento actualizados
- ✅ ProfileNudge — Warning state mejorado
- ✅ Header — Pet card con estilos Plano

---

## Dónde Está Todo

### 📚 Documentación
```
PLANO_VISUAL_UPDATE_SUMMARY.md  ← Resumen ejecutivo detallado
VISUAL_UPDATE_START_HERE.md     ← Este archivo
src/app/constants/STYLE_GUIDE.md ← Guía de estilos completa
```

### 🎯 Design System
```
src/app/constants/designTokens.ts  ← Colores, espaciado, tipografía en TypeScript
src/styles/theme.css               ← CSS variables y estilos base
```

### 🔧 Componentes Mejorados
```
src/app/components/
├── shared/
│   ├── Header.tsx         ✅ Plus Jakarta Sans
│   ├── EmptyState.tsx     ✅ Colores Plano
│   ├── BottomNav.tsx      ✅ Active states #E0F2F1
│   └── Sidebar.tsx        ✅ Logo y nav optimizados
├── auth/
│   └── LoginScreen.tsx    ✅ Inputs Manrope, botones Plus Jakarta
├── home/
│   ├── DailyHookCard.tsx      ✅ Padding/radius mejorados
│   ├── QuickActions.tsx        ✅ Bordes #E5E7EB
│   ├── RoutineChecklist.tsx    ✅ Plus Jakarta en header
│   ├── PessyTip.tsx            ✅ Colores actualizados
│   └── ProfileNudge.tsx        ✅ Warning state #FEF3C7
└── medical/
    └── ActionTray.tsx      ✅ Heading Plus Jakarta, body Manrope
```

---

## Cómo Usar los Colores y Tipografía

### Opción 1: Usar Design Tokens (Recomendado)
```tsx
import { PESSY_COLORS, PESSY_SPACING, PESSY_RADIUS } from '@/app/constants/designTokens';

<button style={{
  backgroundColor: PESSY_COLORS.primary,        // #074738
  padding: PESSY_SPACING.md,                    // 16px
  borderRadius: PESSY_RADIUS.lg,                // 16px
  fontFamily: "'Plus Jakarta Sans', sans-serif"
}}>
  Acción
</button>
```

### Opción 2: Usar Valores Hex Inline
```tsx
<button className="rounded-[16px] bg-[#074738] text-white px-6 py-3" 
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
  Acción
</button>
```

### Opción 3: Usar CSS Variables (theme.css)
```css
.my-button {
  background-color: var(--pessy-primary-deep);  /* #074738 */
  color: var(--pessy-white);
  border-radius: 16px;
  padding: 16px 24px;
}
```

---

## Commits Principales

```
dff46c3 docs: agregar resumen ejecutivo de actualización visual Plano
0d8d555 refactor: mejorar Sidebar con tipografía y colores Plano
34c3ed6 docs: agregar guía de estilos Plano completa
45ae50f refactor: mejorar BottomNav y ActionTray con paleta Plano
b5a902a refactor: mejorar componentes home con paleta y tipografía Plano
7eb074f refactor: mejorar componentes compartidos con paleta Plano y tipografía
5fed238 chore: agregar tipografía Plano (Plus Jakarta Sans + Manrope) y design tokens
```

**Ver detalles:** `git log --oneline | head -8`

---

## Paleta Rápida

### Colores Principales
| Nombre | Valor | Uso |
|--------|-------|-----|
| Primary | #074738 | Botones principales, acentos |
| Accent | #1A9B7D | Hover, active states |
| Surface | #E0F2F1 | Backgrounds suaves, active tabs |
| Background | #F0FAF9 | Background general |

### Colores de Texto
| Nombre | Valor | Uso |
|--------|-------|-----|
| Text | #1A1A1A | Texto principal |
| Text Secondary | #6B7280 | Subtítulos, descripciones |
| Text Tertiary | #9CA3AF | Disabled, weak text |

### Colores de Estado
| Nombre | Valor | Uso |
|--------|-------|-----|
| Success | #10B981 | OK, confirmaciones |
| Warning | #F59E0B | Advertencias |
| Error | #EF4444 | Errores |
| Info | #3B82F6 | Información |

### UI
| Nombre | Valor | Uso |
|--------|-------|-----|
| Border | #E5E7EB | Bordes estándar |
| Border Light | #F3F4F6 | Bordes suaves |

---

## Tipografía Rápida

### Headings (Plus Jakarta Sans)
```
h1: 32px, weight 700, -0.5px letter-spacing
h2: 28px, weight 700, -0.3px letter-spacing
h3: 24px, weight 700, -0.2px letter-spacing
h4: 20px, weight 600
h5: 16px, weight 600
h6: 14px, weight 600
```

### Body (Manrope)
```
Body:       16px, weight 400, 1.6 line-height
Body Small: 14px, weight 400, 1.5 line-height
Label:      12px, weight 600, uppercase
```

---

## Checklist para Implementar en Otros Componentes

Si necesitas mejorar otros componentes, sigue este checklist:

- [ ] ¿Headings usan Plus Jakarta Sans?
- [ ] ¿Body text usa Manrope?
- [ ] ¿Botones primary usan #074738?
- [ ] ¿Hover states usan #1A9B7D?
- [ ] ¿Cards tienen radio 16px?
- [ ] ¿Botones tienen radio 12px?
- [ ] ¿Inputs tienen radio 12px?
- [ ] ¿Bordes usan #E5E7EB?
- [ ] ¿Padding en cards es 16px o 24px?
- [ ] ¿Textos secundarios usan #6B7280?

---

## Preguntas Frecuentes

### ¿Cómo cambio el color de un botón?
```tsx
// ❌ Evita
className="bg-emerald-400 text-white"

// ✅ Usa
className="bg-[#074738] text-white"
// O con style
style={{ backgroundColor: PESSY_COLORS.primary }}
```

### ¿Cómo hago que un heading se vea bien?
```tsx
// ❌ Evita
<h1 className="text-2xl font-bold">Título</h1>

// ✅ Usa
<h1 className="text-3xl font-bold" 
    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
  Título
</h1>
```

### ¿Cuál es el radio correcto para cards?
**16px** para cards grandes, **12px** para botones, **8px** para inputs pequeños.

### ¿Cómo implemento hover states?
```tsx
className="bg-white hover:bg-[#E0F2F1] transition-colors"
// O con #1A9B7D
className="bg-[#074738] hover:bg-[#1A9B7D] transition-colors"
```

---

## ¿Necesitas Más Detalles?

- **Guía Completa de Estilos:** `src/app/constants/STYLE_GUIDE.md`
- **Design Tokens TypeScript:** `src/app/constants/designTokens.ts`
- **Resumen Ejecutivo:** `PLANO_VISUAL_UPDATE_SUMMARY.md`

---

## Siguiente Paso

✅ Todos los cambios están en la rama `sandbox/restructure-and-flutter-prep`

**Acciones recomendadas:**
1. Hacer code review de los 7 commits
2. Testing en dispositivos móviles
3. Verificar dark mode
4. Mergear a rama main cuando esté OK

---

**Actualizado:** 26 de marzo, 2026  
**Tech Lead Frontend:** Mauricio Goitia  
**Estado:** ✅ Listo para QA
