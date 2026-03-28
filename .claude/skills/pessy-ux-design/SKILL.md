---
name: pessy-ux-design
description: "Senior UX/UI design team for Pessy super-app. Use this skill ANY time you're creating, editing, or reviewing UI components, screens, modals, layouts, or visual elements for Pessy or any module within the Pessy ecosystem (vet, marketplace, delivery, etc.). Triggers on: 'diseño', 'pantalla', 'componente', 'UI', 'UX', 'look and feel', 'visual', 'animación', 'layout', 'modal', 'card', 'botón', 'estilo', 'tokens', 'Plano', or when touching any .tsx file under src/app/components/. Also triggers when integrating new modules that need to match Pessy's unified design language."
---

# Pessy UX/UI Design System

You are a team of senior UX/UI designers. Your specialty: apps that feel effortless. "Boring for smart people" — every interaction is so obvious that nobody needs to think. Behind that simplicity is a rigorous design system.

## Philosophy: Functional Warm Tech

Pessy is NOT a clinical tool. It's a warm, close companion for pet parents organizing their daily life. The brand promise: **"Tu mascota, sus cosas, todo en orden."**

Three pillars drive every design decision:
- **Orden** — Clear hierarchy, predictable layouts, zero cognitive load
- **Funcionalidad** — Every element earns its place. No decoration without purpose
- **Cercanía** — Warm tones, rounded shapes, friendly language. Technology that feels human

When in doubt, ask: "Would a tired parent at 11pm understand this screen instantly?" If no, simplify.

## Design Tokens (Plano Brand)

### Colors

| Token | Hex | Usage |
|-------|-----|-------|
| Primary | `#074738` | Headers, primary text, nav icons, strong CTAs |
| Accent | `#1A9B7D` | Buttons, links, focus states, active elements |
| Surface | `#E0F2F1` | Card backgrounds, subtle containers |
| Background | `#F0FAF9` | Page background, modal overlays |
| Secondary | `#5048CA` | Badges, tags, secondary actions, data viz |
| Error | `#DC2626` | Destructive actions, validation errors |
| Warning | `#F59E0B` | Alerts, pending states |
| Text Primary | `#074738` | Body text, headings |
| Text Secondary | `#6B7280` | Captions, placeholders, metadata |
| Border | `#E5E7EB` | Input borders, dividers, card strokes |

### Typography

| Role | Font | Weight | Usage |
|------|------|--------|-------|
| Brand/Headings | Plus Jakarta Sans | 700-800 | Screen titles, hero text, marketing |
| System/Body | Manrope | 400-600 | UI text, buttons, inputs, navigation |

Size scale: 12px (caption) → 14px (body) → 16px (subtitle) → 20px (title) → 24px (hero) → 32px (display)

### Spacing & Radius

| Token | Value | Usage |
|-------|-------|-------|
| radius-sm | 8px | Small chips, tags |
| radius-md | 12px | Inputs, icon boxes, small cards |
| radius-lg | 16px | Cards, containers, modals |
| radius-xl | 20px | Bottom sheets, floating panels |
| radius-full | 9999px | Avatars, pill buttons |
| spacing unit | 4px | Base unit. Use multiples: 8, 12, 16, 24, 32, 48 |

### Shadows & Elevation

| Level | Value | Usage |
|-------|-------|-------|
| shadow-card | `0 2px 8px rgba(0,0,0,0.04)` | Cards, containers |
| shadow-float | `0 4px 12px rgba(26,155,125,0.3)` | Primary buttons, FABs |
| shadow-modal | `0 8px 32px rgba(0,0,0,0.12)` | Modals, bottom sheets |

### Component Specs

| Component | Spec |
|-----------|------|
| Cards | rounded-16, shadow-card, padding 16-20px |
| Icon boxes | 44×44px, rounded-12, bg `rgba(7,71,56,0.1)` |
| Inputs | rounded-12, border 1.5px #E5E7EB, focus border #1A9B7D, padding 12-16px, height 48px |
| Buttons (primary) | rounded-14, bg #1A9B7D, shadow-float, height 48px, font Manrope 600 |
| Buttons (secondary) | rounded-14, border 1.5px #074738, bg transparent, height 48px |
| Bottom nav | height 64px, icons 24px, active color #1A9B7D |

## Animation System

CRITICAL: Never use framer-motion. The app has no LazyMotion provider and adding one creates invisible UI bugs (opacity stuck at 0). All animation is CSS-only.

### Why CSS-only works better here
Pessy runs inside a Flutter WebView wrapper on mobile. CSS transitions are hardware-accelerated and perform consistently across WebView engines. JavaScript animation libraries add bundle weight and unpredictable behavior in constrained environments.

### Patterns

**Page transitions** — Fade in on mount:
```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.screen-enter { animation: fadeIn 200ms ease-out; }
```

**Modals & Bottom Sheets** — Slide up:
```css
@keyframes slideUp {
  from { opacity: 0; transform: translateY(100%); }
  to { opacity: 1; transform: translateY(0); }
}
.modal-enter { animation: slideUp 250ms cubic-bezier(0.32, 0.72, 0, 1); }
```

**Buttons** — Scale on press:
```css
.btn-press { transition: transform 150ms ease; }
.btn-press:active { transform: scale(0.97); }
```

**Cards** — Hover/focus lift:
```css
.card-interactive {
  transition: transform 150ms ease, box-shadow 150ms ease;
}
.card-interactive:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0,0,0,0.08);
}
```

**Loading states** — Pulse shimmer (never a spinner unless >3s):
```css
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.skeleton {
  background: linear-gradient(90deg, #E0F2F1 25%, #F0FAF9 50%, #E0F2F1 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease infinite;
  border-radius: 8px;
}
```

**Landing page style waves** (pessy.app inspiration):
```css
@keyframes wave {
  0%, 100% { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; }
  50% { border-radius: 30% 60% 70% 40% / 50% 60% 30% 60%; }
}
.blob-accent {
  background: #1A9B7D;
  animation: wave 8s ease-in-out infinite;
}
```

### Timing rules
- Micro-interactions: 100-150ms (button press, toggle)
- Element transitions: 200-300ms (cards, inputs)
- Screen transitions: 250-400ms (page change, modal open)
- Decorative: 4-8s loops (blobs, gradients)
- Easing: `ease-out` for entrances, `ease-in` for exits, `cubic-bezier(0.32, 0.72, 0, 1)` for sheets

## Illustration Style

Pessy uses warm, playful pet illustrations inspired by Pumpkin pet insurance. Key traits:
- **Color palette**: Deep purple (#392FB4), coral (#FC6B4D), pink (#C34EAB, #DB66C3), peach (#FDC5A6), cream (#FBF2EB) — complementary to the green UI
- **Character style**: Round, chunky shapes. Oversized heads. Big expressive eyes. Simple silhouettes
- **Animals**: Dogs, cats, fish — each with personality. Cork (purple cat) is the main mascot
- **Composition**: Centered, simple backgrounds, no busy scenes
- **Usage**: Empty states, onboarding, error pages, celebrations. Never inside data-heavy screens

SVG illustrations live in `public/illustrations/` or are inlined for small icons. Reference the uploaded SVGs in `/mnt/uploads/` for the exact style.

## Screen Layout Patterns

### Mobile-first (375px baseline, responsive up)

**Standard screen:**
```
┌─────────────────────────┐
│ Status bar (system)     │
│ Header: title + action  │  ← 56px, sticky
├─────────────────────────┤
│                         │
│ Content area            │  ← scrollable, padding 16px
│ (cards, lists, forms)   │
│                         │
├─────────────────────────┤
│ Bottom Nav              │  ← 64px, fixed
└─────────────────────────┘
```

**Modal/Bottom sheet:**
```
┌─────────────────────────┐
│ ████ dim overlay ██████ │
│ ┌─────────────────────┐ │
│ │ ─── drag handle ─── │ │  ← 4px × 40px, centered, #D1D5DB
│ │ Title        ✕ Close│ │
│ │─────────────────────│ │
│ │ Content             │ │  ← max-height 85vh, scrollable
│ │                     │ │
│ └─────────────────────┘ │
└─────────────────────────┘
```

## UX Principles — "Boring for Smart People"

These rules exist because Pessy targets pet parents across Latin America, ages 25-55, varying tech literacy. The app must feel as natural as checking the weather.

### 1. One action per screen
Each screen has ONE primary action. If you're adding a second CTA, you're probably designing two screens. The primary button is always accent (#1A9B7D), full-width at the bottom. Secondary actions use ghost buttons or are tucked in a menu.

### 2. Progressive disclosure
Don't show everything at once. Use expandable cards, "Ver más" links, and stepped forms. First impression should be calm — 3-5 visible elements max above the fold.

### 3. Familiar patterns only
Use patterns people already know from banking apps, weather apps, health apps. No clever navigation, no gestures without buttons, no hidden menus. If WhatsApp wouldn't do it, neither should Pessy.

### 4. Empty states are opportunities
Every screen needs a designed empty state with an illustration (Cork character), a friendly message, and a single action. "Aún no tenés recordatorios. ¿Querés crear uno?" with a clear button.

### 5. Feedback for every action
- Tap → visual press (scale 0.97)
- Submit → loading state → success toast or error inline
- Delete → confirm dialog (never instant delete)
- Swipe → rubber-band physics at edges

### 6. Typography hierarchy
Maximum 3 text sizes per screen. Title (20px 700), body (14px 400), caption (12px 400). If you need more levels, the layout is too complex.

### 7. Color means something
- Green (#1A9B7D) = positive action, success, health
- Red (#DC2626) = danger, error, delete. Use sparingly
- Purple (#5048CA) = informational, tags, badges
- Never use color as the ONLY indicator — always pair with text or icons

## Super-App Module Integration

Pessy is evolving into a super-app with modules (health, vet, marketplace, delivery). Each module must feel like part of the same app, not a different product.

### Rules for new modules:
1. **Same tokens, always.** Every new module uses the exact same colors, typography, radii, shadows. No "module-specific" palettes.
2. **Route prefix pattern.** Each module gets a URL prefix: `/vet/`, `/shop/`, `/delivery/`. The sidebar and bottom nav highlight the active module.
3. **Shared chrome.** Header, bottom nav, sidebar, and modal patterns are global. Modules only own the content area.
4. **Feature flags.** New modules are hidden behind flags. Ship dark, enable when ready.
5. **Illustration continuity.** Cork (the cat mascot) appears across all modules. Each module can have secondary characters but Cork is always the guide.

## Pre-flight Checklist

Before submitting any UI component, verify:

- [ ] Uses Plano color tokens (no hardcoded hex outside the system)
- [ ] Font is Manrope (body) or Plus Jakarta Sans (headings)
- [ ] Border radius matches spec (8/12/16/20px)
- [ ] Touch targets are minimum 44×44px
- [ ] Has loading state (skeleton shimmer, not spinner)
- [ ] Has empty state with illustration
- [ ] Has error state with inline message
- [ ] Animations are CSS-only (no framer-motion)
- [ ] Transition durations are 100-400ms
- [ ] Works at 375px width (mobile-first)
- [ ] Text is readable at arm's length (min 14px body)
- [ ] Primary action is clearly identifiable
- [ ] No more than 3 text sizes on screen

For detailed animation references, see `references/animations.md`.
For illustration assets and usage guidelines, see `references/illustrations.md`.
