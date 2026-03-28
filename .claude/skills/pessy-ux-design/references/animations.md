# Pessy Animation Reference

## pessy.app Landing Page Animations

The landing page uses organic blob shapes that morph continuously, creating a living, breathing feel.
These are the reference animations to replicate across the app where decorative motion is needed.

### Blob morphing (hero sections, empty states)
```css
@keyframes blobMorph {
  0%, 100% { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; }
  25% { border-radius: 30% 60% 70% 40% / 50% 60% 30% 60%; }
  50% { border-radius: 50% 50% 40% 60% / 40% 50% 60% 50%; }
  75% { border-radius: 40% 60% 60% 40% / 60% 40% 40% 60%; }
}
```

### Gradient shift (background accents)
```css
@keyframes gradientShift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
.gradient-bg {
  background: linear-gradient(-45deg, #074738, #1A9B7D, #E0F2F1, #5048CA);
  background-size: 400% 400%;
  animation: gradientShift 15s ease infinite;
}
```

### Staggered card entrance (lists, grids)
```css
.card-stagger {
  opacity: 0;
  transform: translateY(16px);
  animation: fadeIn 300ms ease-out forwards;
}
.card-stagger:nth-child(1) { animation-delay: 0ms; }
.card-stagger:nth-child(2) { animation-delay: 50ms; }
.card-stagger:nth-child(3) { animation-delay: 100ms; }
.card-stagger:nth-child(4) { animation-delay: 150ms; }
/* Max 200ms total stagger — don't make users wait */
```

### Toast notification
```css
@keyframes toastIn {
  from { opacity: 0; transform: translateY(-100%) scale(0.95); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes toastOut {
  from { opacity: 1; transform: translateY(0) scale(1); }
  to { opacity: 0; transform: translateY(-100%) scale(0.95); }
}
```

### Floating action button pulse
```css
@keyframes fabPulse {
  0%, 100% { box-shadow: 0 4px 12px rgba(26,155,125,0.3); }
  50% { box-shadow: 0 4px 20px rgba(26,155,125,0.5); }
}
```

## Do's and Don'ts

**Do:**
- Use `will-change: transform` on animated elements
- Keep total animation duration under 400ms for interactions
- Use `prefers-reduced-motion` media query to disable animations

**Don't:**
- Animate layout properties (width, height, top, left) — use transform instead
- Chain more than 2 animations on one element
- Use animation on data tables or text-heavy content
- Import any animation library (framer-motion, react-spring, GSAP)
