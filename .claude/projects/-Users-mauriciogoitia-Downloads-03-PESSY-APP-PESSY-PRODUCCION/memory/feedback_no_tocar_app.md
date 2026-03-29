---
name: No tocar la app cuando se trabaja en landings
description: NUNCA modificar componentes de la app (PetHomeView, HomeScreen, etc.) cuando el trabajo es sobre landings u otras páginas independientes
type: feedback
---

No tocar la app si estamos trabajando en otra cosa (landing, website, etc.)

**Why:** Se rompió la app en producción porque modifiqué PetHomeView.tsx mientras el trabajo era solo sobre la landing TikTok. El usuario tuvo que ver la app rota.

**How to apply:** Antes de editar cualquier archivo, verificar si el archivo pertenece a la app principal o a lo que se está trabajando. Si el scope es "landing", solo tocar archivos de landing. Si el scope es "diseño del Home", solo ahí tocar PetHomeView. NUNCA mezclar.
