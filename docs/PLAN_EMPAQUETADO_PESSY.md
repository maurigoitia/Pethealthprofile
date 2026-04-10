# Estrategia de Despliegue: PWA + Capacitor (Hybrid Native)

## Vision

Mantener una base de codigo unica (Single Codebase) que alimente la web (pessy.app) y las apps nativas, garantizando paridad de features y velocidad de actualizacion.

**Stack real:** React 18 + Vite + Firebase + Capacitor 7.x

> No se usa Flutter. La arquitectura anterior (pessy_flutter/) fue reemplazada por Capacitor integrado directamente en este repo.

---

## Pilares

| Canal | Proposito | Tecnologia |
|-------|-----------|------------|
| **Web/PWA** | Adquisicion rapida, SEO, acceso inmediato | Vite build → Firebase Hosting |
| **Capacitor (iOS/Android)** | Hardware nativo, presencia en Stores, credibilidad de marca | Capacitor 7.x wrapping dist/ |

El "cerebro" de la app (MedicalContext, Gemini/analysisService, clinical brain) es identico en todas las plataformas — Capacitor carga la misma SPA que Firebase Hosting sirve.

---

## Arquitectura

```
React SPA (src/)
  ├── npm run build → dist/
  ├── Firebase Hosting (pessy.app) ← web/PWA
  └── Capacitor sync → android/ + ios/ ← native apps
       ├── Android (WebView) → Play Store
       └── iOS (WKWebView) → App Store
```

### Deteccion de contexto

La app detecta si esta corriendo en WebView nativo via `isNativeAppContext()` en `runtimeFlags.ts`:
- **Nativo:** catch-all redirige a `/login`, no muestra landing
- **Web:** `/` muestra landing page, `/empezar` muestra onboarding

---

## Fase 1: PWA Optimizada (completado parcialmente)

- [x] manifest.webmanifest configurado
- [x] Service worker con cache de assets
- [x] App icons en todas las resoluciones
- [ ] Install prompt nativo ("Agregar a pantalla de inicio")
- [ ] Offline mode basico (cache de datos del pet)
- [ ] Push notifications via FCM (infra lista, UX pendiente)

### Beneficio inmediato
- Se puede "instalar" desde el browser
- Sin pasar por App Store / Play Store
- Updates instantaneos (sin review de stores)

---

## Fase 2: Capacitor Native Shell (en progreso)

- [x] Proyecto Capacitor inicializado (`capacitor.config.ts`)
- [x] Android e iOS platforms agregados
- [x] Icons generados para ambas plataformas
- [x] ProGuard configurado para release
- [x] Firebase config placeholders creados
- [x] Script de setup (`scripts/setup-mobile.sh`)
- [ ] Google Services config (descarga manual de Firebase Console)
- [ ] iOS code signing con Apple Developer Team
- [ ] Splash screen personalizado
- [ ] Test en dispositivo fisico (Android)
- [ ] Test en dispositivo fisico (iOS)
- [ ] Envio a TestFlight (iOS internal testing)
- [ ] Envio a Internal Testing (Google Play)

### Build command

```bash
npm run build:mobile    # Compila SPA + sincroniza nativos
npx cap open android    # Abre en Android Studio
npx cap open ios        # Abre en Xcode
```

---

## Fase 3: Features Nativas (post-launch)

Capacidades que requieren plugins nativos de Capacitor:

| Feature | Plugin/Approach | Prioridad |
|---------|----------------|-----------|
| Push Notifications | @capacitor/push-notifications + FCM | Alta |
| Camera (document scanner) | @capacitor/camera | Alta |
| Deep links | @capacitor/app (appUrlOpen) | Alta |
| Haptic feedback | @capacitor/haptics | Media |
| Share sheet | @capacitor/share | Media |
| Biometric lock | capacitor-native-biometric | Baja |
| Local notifications (meds) | @capacitor/local-notifications | Media |

---

## Sync: Web y Native

El despliegue web y el despliegue nativo comparten el mismo build de Vite:

```
develop branch → push → GitHub Actions → Firebase Hosting (QA)
main branch → push → GitHub Actions → Firebase Hosting (prod)

Para native: npm run build:mobile → manual build en Android Studio / Xcode
```

> **IMPORTANTE:** Nunca correr `firebase deploy` manualmente. Ver CLAUDE.md para detalles.

Las actualizaciones de contenido web (bug fixes, UI changes) se reflejan automaticamente en la proxima vez que el usuario abre la app nativa — Capacitor carga la SPA desde el server por defecto. Para actualizaciones que requieren cambios nativos (nuevos plugins, permissions), se necesita un nuevo build y envio a stores.

---

## Decision de Agosto 2026

**Objetivo:** Tener Pessy en App Store y Play Store para credibilidad de marca y acceso a hardware nativo.

**Ruta critica:**
1. Descargar Firebase configs (google-services.json + GoogleService-Info.plist)
2. Configurar code signing (iOS team + Android keystore)
3. Build y test en dispositivos fisicos
4. Enviar a testing tracks (TestFlight + Internal Testing)
5. Preparar store listings (screenshots, descripciones, privacy policy)
6. Enviar a revision
