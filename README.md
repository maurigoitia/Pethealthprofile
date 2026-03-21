# Pessy App — Mobile (iOS & Android)

## Stack tecnológico

**Pessy es una app móvil nativa** construida con:

| Capa | Tecnología | Para qué sirve |
|------|-----------|----------------|
| UI/Lógica | **React + TypeScript + Vite** | Todo el código de la app |
| Estilos | **Tailwind CSS v4** | Diseño responsive |
| Mobile wrapper | **Capacitor v7** | Empaqueta el app como iOS/Android nativo |
| Backend | **Firebase Functions (Node.js)** | API, ingesta de mails, AI clínica |
| Base de datos | **Firestore** | Datos en tiempo real |
| Auth | **Firebase Auth** | Login, email magic link |
| IA clínica | **Google Vertex AI / Gemini** | Procesar documentos médicos |

---

## ❓ ¿Es Flutter?

**No.** Pessy no usa Flutter ni Dart.

El enfoque es **React + Capacitor** — el código de la app se escribe una sola vez en React/TypeScript y Capacitor lo empaqueta como:
- 📱 **App iOS** (`.ipa`) para App Store
- 🤖 **App Android** (`.apk`/`.aab`) para Play Store

Este es el mismo enfoque que usan apps como Ionic. El resultado es una app **descargable desde los stores**, con acceso a APIs nativas del dispositivo (cámara, notificaciones, almacenamiento).

---

## Estructura del proyecto

```
src/
├── app/
│   ├── components/     # Todos los componentes del app (50+)
│   ├── contexts/       # Estado global (Medical, Pet, Auth...)
│   ├── pages/          # Páginas de routing (Landing, Legal)
│   ├── services/       # Servicios (calendar, account deletion...)
│   ├── utils/          # Utilidades (fechas, flags, clinical brain...)
│   ├── types/          # TypeScript types
│   └── routes.tsx      # Routing del app

functions/src/
├── clinical/           # Lógica AI clínica (episodios, proyección, brain)
├── gmail/              # Ingesta de emails médicos
├── compliance/         # Eliminación de datos / GDPR
└── index.ts            # Entry point de Cloud Functions

android/                # Proyecto Android nativo (Capacitor-generado)
ios/                    # Proyecto iOS nativo (Capacitor-generado)
public/                 # Assets estáticos (íconos PWA, data-deletion)
```

---

## Comandos principales

```bash
# Desarrollo web
npm run dev

# Build + sync a mobile
npm run build:mobile

# Abrir en Xcode (iOS)
npm run cap:open:ios

# Abrir en Android Studio
npm run cap:open:android

# Diagnóstico de Capacitor
npm run mobile:doctor

# Deploy a producción
firebase deploy --only hosting:app
```

---

## Environments

| URL | Firebase site | Para qué |
|-----|---------------|---------- |
| `pessy.app` | `app` | Producción |
| `polar-scene-488615-i0.web.app` | `app` | Host Firebase del proyecto productivo |

---

## Feature flags activos

- `VITE_ENABLE_EMAIL_SYNC` — activa visualización de datos de email sync
- `VITE_ENABLE_FOCUS_HISTORY_EXPERIMENT` — activa modelo episódico (solo QA)
- `BACKFILL_ADMIN_SECRET` — secret para correr backfill clínico
- `GMAIL_SMART_PET_MATCH_ENABLED` — matching inteligente de mascotas por email

---

> **Nota de stack**: Este proyecto fue bootstrapped originalmente desde una plantilla de Figma Make, de ahí el residuo del nombre `@figma/my-make-file` en versiones anteriores del package.json. Ese artifacto fue corregido (2026-03-11).
