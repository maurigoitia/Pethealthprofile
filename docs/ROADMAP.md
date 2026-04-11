# 🗺️ PESSY — Roadmap de Producto 2026

> Última actualización: Abril 2026  
> Estado actual: **Beta Privada** — infraestructura completa, módulos en refinamiento

---

## 📍 Dónde estamos hoy

El roadmap anterior reflejaba un estado de "frontend sin backend". Eso cambió. Pessy es hoy un producto completo en beta:

- Firebase Firestore + Cloud Functions en producción
- Auth completa (email/password, Google, magic link, email de recuperación)
- Pipeline de Gmail → ingesta clínica con IA (Vertex AI)
- Portal de veterinarios (registro, consultas, pacientes)
- Módulo Comunidad (mascotas perdidas, adopción)
- Recordatorios, citas, rutinas diarias
- CI/CD con smoke tests post-deploy
- Security rules auditadas (IDOR, field immutability, vet isolation, geo exposure)
- 119 tests automatizados (unitarios + componentes)

---

## 🗂️ Módulos del producto

Pessy se estructura en 4 pilares:

| Pilar | Descripción | Estado |
|---|---|---|
| **Día a Día** | Check-in diario, rutina, tips, hook cards | ✅ Producción |
| **Historial Clínico** | Timeline, escaneo de docs, ingesta Gmail, certif. vacunas | ✅ Producción |
| **Identidad Digital** | Carnet digital, portal vet, co-tutor, validación matrícula | 🔄 Beta |
| **Comunidad** | Perdidos, adopción, búsqueda activa, alertas geo | 🔄 Beta |

---

## ✅ Completado (Q1 2026)

### Infraestructura
- Firebase Firestore, Cloud Functions, FCM, Storage
- Redis (rate limiting), Vertex AI Datastore
- CI/CD: deploy automático a pessy.app + app.pessy.app
- Smoke tests post-deploy
- Firestore security rules (auditadas por Security Auditor)
- Sentry (error tracking con PII redaction)

### Auth y Usuarios
- Login email/password + Google OAuth
- Magic link (EmailLinkSignIn)
- Recuperación de contraseña (anti-enumeración)
- Registro de usuario en pasos
- Co-tutor: invitación para compartir mascota
- Admin claims + access requests
- GDPR: borrado de cuenta, DPA, terms acceptance
- Consentimiento Gmail con modal accesible

### Historial Clínico
- Timeline de eventos médicos
- Scanner de documentos (DocumentScannerModal)
- Ingesta de Gmail → parseo clínico → IA → Firestore
- ClinicalReviewScreen + VerifyReportScreen
- Carnet de vacunación (VaccinationCardModal)
- Medicamentos (MedicationsScreen)
- Exportar reporte (ExportReportModal)
- Brain resolver + episode compiler + projection layer

### Día a Día
- HomeScreen con DailyHookCard, RoutineChecklist, QuickActions
- PessyTip, ProfileNudge, FocusedHomeExperience
- Recordatorios (RemindersScreen + AddReminderModal)
- Citas (AppointmentsScreen + AddAppointmentModal)
- Emails automáticos: overdue reminder, weekly digest

### Settings
- Perfil personal, apariencia, idioma
- Privacidad y seguridad (cambio de password + Gmail consent)
- Notificaciones, ayuda, about
- Storage usage + límites

### Portal Veterinario
- VetLoginScreen + VetRegisterScreen
- VetDashboard, VetPatientList
- VetConsultationView + VetNewConsultation
- VetProfileScreen

### Tests
- 119 tests en verde (dateUtils, sentryConfig, i18n, auth screens, privacy screen)

---

## 🔄 En progreso (Q2 2026 — Abril–Junio)

### Comunidad — Completar backend
- [ ] Geo-push al reportar mascota perdida (LOST_NEARBY)
- [ ] Match automático foto vs reportes activos (FOUND_QR)
- [ ] Chat directo entre usuarios sin exponer datos
- [ ] Algoritmo de matching para adopción (score 0–100)
- [ ] Alertas persistentes de búsqueda (SEARCH_MATCH)
- [ ] Tests unitarios: lostReports, adoptionPosts, searchAlerts

### Identidad Digital — Refinar
- [ ] Validación de matrícula veterinaria (multi-país)
- [ ] Watermark en documentos compartidos
- [ ] QR del carnet → conexión inmediata con dueño
- [ ] Perfil público de mascota (compartible)

### Calidad
- [ ] Tests de integración: Gmail ingestion pipeline
- [ ] Tests E2E con Playwright (flujos críticos: login → ingesta → timeline)
- [ ] Lighthouse score > 90
- [ ] Cobertura de tests: subir de 119 a 200+

### Portal Veterinario — MVP funcional
- [ ] Flujo completo: registro → validación → consulta → paciente
- [ ] Notificación al tutor cuando el vet revisa el historial
- [ ] Aislamiento de datos por matrícula confirmada

---

## 📅 Próximos (Q3 2026 — Julio–Septiembre)

### Conexión real (The Connection Rule)
> Pessy no dice "buscá un veterinario". Pessy te lleva directo.

- [ ] NearbyVets con disponibilidad real + botón "Agendar"
- [ ] Producto detectado en ingesta → link de compra directo
- [ ] Vacuna por vencer → vet disponible + "Reservar turno" (1 tap)
- [ ] Análisis detectado → 2–3 vets especializados → "Contactar"

### Wellbeing (Monetización)
- [ ] WellbeingMasterBook: lanzamiento como producto pago
- [ ] WellbeingProtocol: protocolo personalizado por mascota
- [ ] RecommendationFeed: algoritmo de recomendaciones basado en historial

### Notificaciones inteligentes
- [ ] Reglas de frecuencia por tipo (LOST, ADOPT, SEARCH, routine)
- [ ] Ventanas de silencio configurables por usuario
- [ ] Daily loop: mañana → rutina, tarde → recordatorio, noche → check-in

### PWA y offline
- [ ] Service Worker para offline parcial
- [ ] Caché de timeline e historial
- [ ] Sync cuando vuelve la conexión

---

## 🚀 Lanzamiento (Q4 2026 — Octubre–Diciembre)

### v1.0.0 — Launch Público
- [ ] Beta cerrada → 500 usuarios activos
- [ ] Corrección de bugs críticos del beta
- [ ] SEO + metadatos + OpenGraph por mascota
- [ ] Landing pessy.app actualizada con social proof
- [ ] Onboarding mejorado con análisis de drop-off
- [ ] Analytics: Mixpanel o Amplitude (no solo Sentry)
- [ ] Product Hunt launch
- [ ] Soporte multi-país: AR, MX, UY, CL, CO

### v1.1.0 — Monetización
- [ ] Wellbeing products con paywall
- [ ] Plan premium: historial ilimitado, reportes PDF, alertas avanzadas
- [ ] Marketplace de productos por mascota
- [ ] API para clínicas veterinarias partners

---

## 📊 Métricas objetivo

| Métrica | Hoy (Beta) | v1.0 Target |
|---|---|---|
| Tests en verde | 119 | 300+ |
| Lighthouse score | TBD | > 90 |
| Tiempo de ingesta Gmail | TBD | < 30s |
| DAU / MAU | TBD | > 40% |
| Retención día 7 | TBD | > 40% |
| NPS | TBD | > 50 |

---

## 🔑 El principio que no negocia

> **"Pessy conecta a tu mascota con lo que necesita, sin que tengas que buscar."**

Cada feature nueva que entra al roadmap debe responder una pregunta:  
**¿Estoy cerrando el loop, o estoy dejando al usuario que busque solo?**

Si la respuesta es "dejarlo buscar" → no entra todavía.

---

## 🏗️ Tech stack actual

| Capa | Tech |
|---|---|
| Frontend | React 18, TypeScript, Tailwind CSS, Motion |
| Backend | Firebase Cloud Functions (Node.js/TS) |
| DB | Firestore + Redis |
| Auth | Firebase Auth (email, Google, magic link) |
| IA | Vertex AI (Datastore + generative) |
| Storage | Firebase Storage |
| Notificaciones | FCM |
| Infra | GitHub Actions CI/CD, Firebase Hosting |
| Observabilidad | Sentry (error + PII redaction) |
| Tests | Vitest + Testing Library + Playwright (por venir) |
