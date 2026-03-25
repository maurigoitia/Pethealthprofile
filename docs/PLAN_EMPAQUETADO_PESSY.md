# Plan de Empaquetado Pessy — PWA → Flutter

## Fase 1: PWA Mejorada (1-2 días)
Lo que ya tenemos funcionando como PWA, pero mejorado:

### Pendiente:
- [ ] Mejorar manifest.webmanifest (screenshots, shortcuts, categorías)
- [ ] Install prompt nativo ("Agregar a pantalla de inicio")
- [ ] Splash screen personalizado con logo Pessy
- [ ] Offline mode básico (cache de datos del pet)
- [ ] Push notifications mejoradas (FCM ya está, pulir UX)
- [ ] App icon correcto en todas las resoluciones

### Beneficio inmediato:
- Se puede "instalar" desde el browser como app
- Funciona offline parcialmente
- Notificaciones push funcionan
- Sin pasar por App Store/Play Store

---

## Fase 2: Flutter Shell (1-2 semanas)
Wrapper Flutter que carga la PWA existente en un WebView, pero con acceso nativo:

### Qué se hace:
- [ ] Proyecto Flutter nuevo con WebView que carga pessy.app
- [ ] Bridge JS ↔ Flutter para push notifications nativas
- [ ] Deep links nativos (pessy.app/inicio?invite=CODE)
- [ ] Splash screen nativo con animación
- [ ] App icon nativo
- [ ] Publicar en App Store (TestFlight) y Play Store (Internal Testing)

### Beneficio:
- App en las stores rápido
- Mantiene todo el código React existente
- Push notifications nativas (no web push)
- Deep links funcionan como app nativa

---

## Fase 3: Flutter Nativo (2-3 meses)
Reescritura progresiva de pantallas en Flutter/Dart:

### Orden de migración:
1. **Home Screen** — la más usada, más impacto visual
2. **Pet Profile** — segunda pantalla más visitada
3. **Login/Register** — flujo de entrada
4. **Rutinas y Gamificación** — el hook diario
5. **Cerebro/Intelligence** — recomendaciones
6. **Medical/Clinical** — la más compleja, última

### Stack Flutter:
- **State management:** Riverpod o Bloc
- **Backend:** Firebase (mismo proyecto polar-scene)
- **Auth:** Firebase Auth (mismo)
- **DB:** Firestore (mismas colecciones)
- **Push:** FCM nativo
- **Design:** Material 3 + componentes custom con paleta Pessy

### Beneficio:
- Performance nativa real (60fps)
- Acceso a cámara, GPS, biometrics, haptics
- Una sola codebase para iOS + Android
- Animaciones fluidas (confetti de patitas, swipe cards, etc.)
- Widget de iOS/Android para el home del teléfono

---

## Fase 4: Features Nativas (post-Flutter)
Cosas que solo se pueden hacer bien en nativo:

- [ ] Widget de medicación en el home screen del teléfono
- [ ] Complicaciones en Apple Watch
- [ ] Cámara integrada para scanner de documentos
- [ ] Haptic feedback en checklist de rutinas
- [ ] Animaciones Lottie para gamificación (estrellas, patitas, confetti)
- [ ] Biometric lock para datos médicos
- [ ] Share sheet nativo para compartir perfil del pet
- [ ] Siri/Google Assistant integration ("Hey Siri, ¿Thor tomó su medicación?")

---

## Decisión inmediata para mañana

**Recomendación:** Arrancar con Fase 1 (PWA mejorada, 1-2 días) + Fase 2 (Flutter Shell, 1-2 semanas) en paralelo. Esto nos da presencia en las stores rápido sin reescribir nada. La Fase 3 (nativo completo) se hace progresivamente después.

---

## Gamificación (transversal a todas las fases)

### Sistema de puntos:
- Completar item de rutina: +5 pts
- Completar rutina completa: +15 pts bonus
- Hacer la actividad del día (hook): +10-15 pts
- Marcar tip como "hecho": +3 pts
- Subir documento médico: +20 pts
- Completar perfil: +50 pts
- Invitar amigo: +25 pts

### Animaciones al completar:
- Confetti de patitas (🐾) al completar rutina
- Estrellas (⭐) al ganar puntos
- Emoji del pet (🐶/🐱) saltando al marcar tip
- Barra de progreso semanal
- Streak counter ("7 días seguidos cuidando a Thor")

### Swipe en tips:
- Swipe derecha → "Lo hice" (puntos + animación)
- Swipe izquierda → "Después" (se mueve al final)
- Tap → expande detalle
