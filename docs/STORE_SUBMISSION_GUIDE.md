# Pessy — App Store Submission Guide (Capacitor)

> **Verdad Tecnica:** Esta app es una SPA construida con **React 18 + Vite** y empaquetada mediante **Capacitor 7.x**. No utilizar comandos de Flutter.

## Prerequisites

- Apple Developer Account ($99/year) — developer.apple.com
- Google Play Developer Account ($25 one-time) — play.google.com/console
- Firebase project: `polar-scene-488615-i0`
- Bundle ID: `app.pessy.mobile`
- Node.js + npm instalados
- Android Studio (para Android builds)
- Xcode (para iOS builds)

---

## Build Engine

El ciclo de build unificado compila la SPA y sincroniza con los proyectos nativos:

```bash
npm run build:mobile
```

Este comando:
1. Compila la app con Vite (`npm run build`)
2. Sincroniza los assets en `/android` e `/ios` (`npx cap sync`)

Para verificar que el entorno esta listo:

```bash
bash scripts/setup-mobile.sh
```

---

## iOS — App Store Connect

### 1. Code Signing

```bash
npx cap open ios
```

En Xcode:
- Select target "App" → Signing & Capabilities
- Team: Select Pessy LLC (Apple Developer team)
- Bundle Identifier: `app.pessy.mobile`
- Enable: Push Notifications capability
- Enable: Associated Domains → `applinks:pessy.app`

### 2. Firebase Config

Colocar `GoogleService-Info.plist` en `ios/App/App/`:
- Firebase Console → Project Settings → iOS app → Download
- Ver `ios/App/App/GoogleService-Info.plist.example` como referencia

### 3. Build Archive

```bash
npm run build:mobile
npx cap open ios
```

En Xcode:
- Product → Archive
- Distribute App → App Store Connect
- Subir via TestFlight o directo a App Store Connect

### 4. App Store Listing

| Campo | Valor |
|-------|-------|
| Name | Pessy |
| Subtitle | Tu mascota, organizada |
| Category (primary) | Lifestyle |
| Category (secondary) | Health & Fitness |
| Privacy URL | https://pessy.app/privacidad |
| Support URL | https://pessy.app/soporte |
| Screenshots | iPhone 15 Pro (6.7") + iPhone SE (4.7") |

### 5. App Review Checklist

- [ ] Privacy policy accesible en https://pessy.app/privacidad
- [ ] Push notification permission tiene purpose string claro en Info.plist
- [ ] Camera/photo library permission strings configurados
- [ ] Screenshots sin contenido placeholder
- [ ] Cuenta demo con mascota precargada para el revisor
- [ ] GDPR/consent flow funciona antes de recolectar datos

---

## Android — Google Play Console

### 1. Keystore (primera vez)

```bash
keytool -genkey -v -keystore ~/pessy-release.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias pessy -storepass <PASSWORD>
```

Crear `android/key.properties`:

```properties
storePassword=<PASSWORD>
keyPassword=<PASSWORD>
keyAlias=pessy
storeFile=/path/to/pessy-release.jks
```

> **IMPORTANTE:** `key.properties` y `*.jks` estan en `.gitignore`. NUNCA commitear.

### 2. Firebase Config

Colocar `google-services.json` en `android/app/`:
- Firebase Console → Project Settings → Android app → Download
- Ver `android/app/google-services.json.example` como referencia

### 3. Build Signed AAB

```bash
npm run build:mobile
npx cap open android
```

En Android Studio:
- Build → Generate Signed Bundle / APK
- Seleccionar Android App Bundle
- Usar el keystore de Pessy LLC
- Build variant: Release

### 4. Google Play Listing

| Campo | Valor |
|-------|-------|
| Title | Pessy |
| Short description | La app para el cuidado integral de tu mascota |
| Category | Lifestyle |
| Content rating | Completar cuestionario (target: 18+, pet owners) |
| Privacy policy | https://pessy.app/privacidad |

### 5. Play Console Checklist

- [ ] Data safety form completado (declarar Firestore, FCM, archivos subidos)
- [ ] Content rating questionnaire completado
- [ ] Privacy policy URL configurada
- [ ] App signing by Google Play habilitado (recomendado)
- [ ] Flujo: Internal Testing → Closed Beta → Production
- [ ] ProGuard habilitado con reglas Capacitor-safe (ya configurado)

---

## Release Optimization (ya configurado)

El build de release incluye:
- **minifyEnabled true** — R8 elimina codigo muerto
- **shrinkResources true** — remueve recursos no usados
- **proguard-android-optimize.txt** — optimizaciones adicionales de R8
- Reglas ProGuard para Capacitor JS bridge, Firebase Messaging, AndroidX

Ver `android/app/build.gradle` y `android/app/proguard-rules.pro`.

---

## App Icons (ya generados)

Los iconos fueron generados desde `public/pessy-logo.png` (500x500):

**Android:** 5 densidades en `android/app/src/main/res/mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/`

**iOS:** 15 PNGs + Contents.json en `ios/App/App/Assets.xcassets/AppIcon.appiconset/`

---

## Versionado

El versionado se gestiona en `capacitor.config.ts` y en los proyectos nativos:

| Tipo de Cambio | versionName | versionCode |
|----------------|-------------|-------------|
| Fix de bug | 1.0.1 | +1 |
| Nueva feature | 1.1.0 | +1 |
| Breaking change / Launch | 2.0.0 | +1 |

> El `versionCode` en Android siempre debe ser estrictamente mayor al anterior.
