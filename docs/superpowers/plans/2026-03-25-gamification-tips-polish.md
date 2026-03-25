# Gamification + Tips + Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make gamification points real (not "0 pts"), enable swipe between tips, fix breed-specific suggestions, and clear stale SW cache automatically.

**Architecture:** Points already use localStorage via `gamification.ts` — just need to wire the display and award logic. Tips use `wellbeingMasterBook.daily_suggestions` filtered by breed group — need to expand breed→group mapping and add swipe UI. SW cache fix is a one-line meta tag.

**Tech Stack:** React, Tailwind, localStorage, Vite PWA plugin

---

## Scope: 3 independent tasks (parallelizable)

| Task | What | Impact |
|------|------|--------|
| 1 | Gamification: wire real points | "0 pts" → real score |
| 2 | Tips: breed mapping + swipe | Better suggestions + swipeable cards |
| 3 | SW cache auto-clear | No more stale pages on deploy |

**NOT in scope:** Flutter (Phase 2 — separate plan), Veterinarios (already built, just needs `VITE_GOOGLE_PLACES_KEY` env var in Firebase).

---

## Task 1: Wire Real Gamification Points

**Files:**
- Modify: `src/app/components/PetHomeView.tsx:573` (hardcoded "0 pts")
- Modify: `src/app/components/PetHomeView.tsx` (award points on routine check)
- Modify: `src/app/components/home/DailyHookCard.tsx` (award points on "Empezar actividad")
- Read: `src/app/utils/gamification.ts` (existing API: `getPoints()`, `addPoints()`, `markDailyActivityDone()`)

### What's broken

`PetHomeView.tsx:573` displays:
```tsx
<MaterialIcon name="star" className="!text-sm" /> 0 pts
```
This is **hardcoded**. The `gamification.ts` utility has `getPoints()` and `addPoints()` but nothing calls them.

### Steps

- [ ] **Step 1: Fix the points display**

In `PetHomeView.tsx`, import `getPoints` from `gamification.ts` and replace hardcoded "0 pts":

```tsx
// Add import at top
import { getPoints, addPoints, isDailyActivityDone, markDailyActivityDone } from "../utils/gamification";

// Add state
const [points, setPoints] = useState(() => getPoints());

// Replace line 573: hardcoded "0 pts" → dynamic
<MaterialIcon name="star" className="!text-sm" /> {points} pts
```

- [ ] **Step 2: Award points when completing a routine item**

Find the routine checkbox handler in `PetHomeView.tsx` (where `RoutineChecklist` items get toggled). After a successful toggle-on, award points:

```tsx
// Inside the routine toggle handler, after marking complete:
const earned = addPoints(5);
setPoints(earned);
```

- [ ] **Step 3: Award points from DailyHookCard**

In `DailyHookCard.tsx`, the "Empezar actividad" button needs an `onStart` callback. Add prop:

```tsx
interface DailyHookCardProps {
  suggestion: DailySuggestion;
  onStart?: (points: number) => void;  // NEW
}
```

When button is clicked:
```tsx
onClick={() => {
  if (!isDailyActivityDone()) {
    markDailyActivityDone();
    onStart?.(suggestion.gamificationPoints);
  }
}}
```

In `PetHomeView.tsx`, pass the callback:
```tsx
<DailyHookCard
  suggestion={dailySuggestion}
  onStart={(pts) => {
    const total = addPoints(pts);
    setPoints(total);
  }}
/>
```

- [ ] **Step 4: Verify in preview**

1. Open pessy.app/inicio in preview
2. Check that points display shows current localStorage value
3. Click "Empezar actividad" → points should increase
4. Complete a routine item → points should increase by 5
5. Reload → points should persist

- [ ] **Step 5: Commit**

```bash
git add src/app/components/PetHomeView.tsx src/app/components/home/DailyHookCard.tsx
git commit -m "feat(gamification): wire real points display and earning"
```

---

## Task 2: Breed Mapping + Swipeable Tips

**Files:**
- Modify: `src/app/components/PetHomeView.tsx:99-108` (resolveGroupIds — expand breed mapping)
- Modify: `src/app/components/PetHomeView.tsx:332-372` (daily suggestion — pick multiple for swipe)
- Modify: `src/app/components/home/DailyHookCard.tsx` (add swipe/carousel)
- Read: `src/domain/wellbeing/wellbeingMasterBook.ts:632-660` (daily_suggestions groups)

### What's broken

`resolveGroupIds()` only returns `"dog.general"` or `"dog.brachycephalic"`. But the master book has suggestions for `"dog.active_working"`, `"dog.companion"`, `"dog.reactive"`, `"dog.puppy"` — none of which are ever matched.

```typescript
// CURRENT (too simple)
function resolveGroupIds(species, breed) {
  if (species === "cat") return [isBrachy ? "cat.brachycephalic" : "cat.general"];
  return [isBrachy ? "dog.brachycephalic" : "dog.general"];
}
```

### Steps

- [ ] **Step 1: Expand breed → group mapping**

Replace `resolveGroupIds` with proper breed classification:

```typescript
const ACTIVE_WORKING_BREEDS = [
  "border collie", "pastor aleman", "pastor alemán", "husky", "malinois",
  "australian shepherd", "pastor australiano", "labrador", "golden retriever",
  "weimaraner", "vizsla", "pointer", "setter", "dalmata", "dálmata",
  "jack russell", "beagle", "cocker spaniel", "springer spaniel",
];

const COMPANION_BREEDS = [
  "chihuahua", "pomeranian", "pomerania", "maltés", "maltes", "bichon",
  "cavalier", "papillon", "havanese", "lhasa apso", "shih tzu",
  "yorkshire", "yorkie", "caniche", "poodle", "coton",
];

function resolveGroupIds(species: PetSpecies, breed: string): WellbeingSpeciesGroupId[] {
  const b = normalizeText(breed);
  const isBrachy = BRAXY_BREEDS.some((item) => b.includes(normalizeText(item)));

  if (species === "cat") {
    return [isBrachy ? "cat.brachycephalic" : "cat.general"];
  }

  const groups: WellbeingSpeciesGroupId[] = [];
  if (isBrachy) groups.push("dog.brachycephalic");
  if (ACTIVE_WORKING_BREEDS.some((x) => b.includes(x))) groups.push("dog.active_working");
  if (COMPANION_BREEDS.some((x) => b.includes(x))) groups.push("dog.companion");
  // Fallback: if no specific group matched, use dog.general
  if (groups.length === 0) groups.push("dog.general");
  // Always include dog.general as secondary pool
  if (!groups.includes("dog.general")) groups.push("dog.general");

  return groups;
}
```

This means Thor (American Bully Pocket) still gets `["dog.general"]` since bully isn't in any specific list, but a Border Collie would get `["dog.active_working", "dog.general"]`.

- [ ] **Step 2: Generate multiple suggestions for swipe**

In the daily suggestion logic (~line 332), instead of picking 1, pick up to 3:

```typescript
// Replace single suggestion pick with multiple
const poolForSwipe = candidates.length > 0 ? candidates : [fallbackSuggestion];
const startIdx = dayOfYear % poolForSwipe.length;
const dailySuggestions: DailySuggestion[] = [];
for (let i = 0; i < Math.min(3, poolForSwipe.length); i++) {
  dailySuggestions.push(poolForSwipe[(startIdx + i) % poolForSwipe.length]);
}
```

Update state: `dailySuggestion` (single) → `dailySuggestions` (array).

- [ ] **Step 3: Add swipe to DailyHookCard**

Wrap in a horizontal scroll snap container:

```tsx
interface DailyHookCarouselProps {
  suggestions: DailySuggestion[];
  onStart?: (points: number) => void;
}

export function DailyHookCarousel({ suggestions, onStart }: DailyHookCarouselProps) {
  return (
    <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
      {suggestions.map((s, i) => (
        <div key={i} className="min-w-[85%] snap-center flex-shrink-0">
          <DailyHookCard suggestion={s} onStart={onStart} />
        </div>
      ))}
    </div>
  );
}
```

Add CSS for scrollbar-hide in `src/styles/index.css`:
```css
.scrollbar-hide::-webkit-scrollbar { display: none; }
.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
```

- [ ] **Step 4: Wire carousel in PetHomeView**

Replace `<DailyHookCard suggestion={dailySuggestion} />` with:
```tsx
<DailyHookCarousel suggestions={dailySuggestions} onStart={...} />
```

- [ ] **Step 5: Verify in preview**

1. Open home for Thor → should see swipeable cards
2. Swipe left → second suggestion appears
3. Different breed dog → verify different group suggestions appear

- [ ] **Step 6: Commit**

```bash
git add src/app/components/PetHomeView.tsx src/app/components/home/DailyHookCard.tsx src/styles/index.css
git commit -m "feat(tips): breed-aware suggestions with swipe carousel"
```

---

## Task 3: Auto-Clear Stale Service Worker on Deploy

**Files:**
- Modify: `vite.config.ts` (SW config)
- Modify: `index.html` (cache-control meta)

### What's broken

Users see stale pages after deploy because the SW caches aggressively and `skipWaiting: true` only works if the browser fetches the new SW. On iOS Safari especially, SWs can stay stale for hours.

### Steps

- [ ] **Step 1: Add cache-busting headers to index.html**

In `index.html` `<head>`, add:
```html
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
<meta http-equiv="Pragma" content="no-cache" />
<meta http-equiv="Expires" content="0" />
```

- [ ] **Step 2: Add SW registration with forced update check**

In `src/main.tsx` or wherever the SW is registered, ensure `updateViaCache: 'none'`:

```typescript
// In the registerSW callback or main.tsx
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistration().then(reg => {
    if (reg) reg.update(); // force check on every page load
  });
}
```

- [ ] **Step 3: Add firebase.json cache headers for SW**

In `firebase.json` hosting config, ensure sw.js is never cached:
```json
{
  "headers": [
    { "source": "/sw.js", "headers": [{ "key": "Cache-Control", "value": "no-cache" }] },
    { "source": "/workbox-*.js", "headers": [{ "key": "Cache-Control", "value": "no-cache" }] }
  ]
}
```

- [ ] **Step 4: Commit**

```bash
git add index.html src/main.tsx firebase.json
git commit -m "fix(pwa): force SW update check + no-cache headers"
```

---

## Quick Wins (no plan needed)

| Item | Action | Time |
|------|--------|------|
| Veterinarios | Add `VITE_GOOGLE_PLACES_KEY=your_key` to `.env` and redeploy | 2 min |
| Flutter Phase 2 | Separate plan needed — it's a new Flutter project | Future session |

---

## Execution Order

Tasks 1, 2, and 3 are **independent** — can run in parallel with 3 agents.

Recommended: subagent-driven development, 3 parallel agents.
