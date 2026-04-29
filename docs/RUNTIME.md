# PESSY Runtime — what's live, what's not

The repo currently carries two parallel router/Home pairs. Only **one** of
them is the live runtime today. Anything you change in the dead pair will
not be visible to users.

## ✅ LIVE runtime (modify these)

| Surface | File |
|---|---|
| App entry | `apps/pwa/src/app/App.tsx` (imports `routesV2.tsx`) |
| Router | `apps/pwa/src/app/routesV2.tsx` |
| Home (`/inicio`, `/home`) | `apps/pwa/src/app/components/home/HomeScreenSimplified.tsx` |
| App shell / layout | `apps/pwa/src/app/components/layout/AppLayout.tsx` |
| Home variants used inside Simplified | `PetHomeView.tsx`, `FocusedHomeExperience.tsx` |

**Everything user-facing must be added or wired through `routesV2.tsx`
and `HomeScreenSimplified.tsx`.**

## ⚠️ DEAD pair (do NOT modify)

| Surface | File | Status |
|---|---|---|
| Legacy router | `apps/pwa/src/app/routes.tsx` | not imported by App.tsx |
| Legacy Home | `apps/pwa/src/app/components/home/HomeScreen.tsx` | not reachable at runtime |

Don't delete them yet — they have a long history and we want to keep
options open for a future revert. But: don't add features to them, don't
expect changes there to ship to production.

## How this happened

A V2 routing pass was started a while back (deep linking, AppLayout,
real URLs per "viewMode"). `App.tsx` was switched to import
`routesV2.tsx`. The legacy `routes.tsx` and `HomeScreen.tsx` stayed in
the tree but unwired. Over time, several PRs (#97 reset password, #99
"Pasó algo") landed changes against the legacy pair without realizing
it. **PR `fix/live-router-product-visibility` migrates those changes
into the live pair.**

## Rule for new PRs

When you add a new route or a new Home card, **always**:
1. Add the route in `routesV2.tsx` (not `routes.tsx`).
2. Add the Home UI in `HomeScreenSimplified.tsx` (or its child:
   `PetHomeView` / `FocusedHomeExperience`).
3. Cross-check by running:
   ```
   grep -n "<your-new-thing>" apps/pwa/src/app/routesV2.tsx
   grep -n "<your-new-thing>" apps/pwa/src/app/components/home/HomeScreenSimplified.tsx
   ```
   If you don't see your change in the live files, you wired the wrong
   side.

## Future

When we have time and confidence:
- Either delete `routes.tsx` + `HomeScreen.tsx` (legacy is dead, stop
  carrying it).
- Or migrate live runtime back to `routes.tsx` + `HomeScreen.tsx` and
  delete V2 (only if the V2 path has no features worth keeping).

**Until that decision is made, V2 wins.**
