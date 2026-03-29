# Producto PESSY — Knowledge Base

## Qué es PESSY
PESSY es una plataforma de inteligencia para pet owners. No es un chatbot, no es una app de recordatorios. Es un sistema estructurado de salud e inteligencia para mascotas.

**Tagline:** "Porque quererlo ya es suficiente trabajo"
**Web:** pessy.app | **Contacto:** mauri@pessy.app

## Features implementadas (Marzo 2026)
### Core
- Escaneo de documentos médicos con extracción AI (vacunas, medicamentos, diagnósticos, labs)
- Historial médico completo con timeline cronológica y resúmenes mensuales
- Sistema de citas con auto-extracción desde Gmail + Google Calendar
- Tracking de medicaciones (activa/crónica/completada) con notas
- Recordatorios inteligentes (vacunas, medicación, checkups, grooming, desparasitación)
- Co-tutors: guardianship compartida con códigos de invitación
- Export PDF de reportes médicos verificados

### Inteligencia
- Clinical Brain: Vertex AI + Claude con knowledge base fundamentada
- Intelligence Engine: thermal safety por raza, recomendaciones de training
- Wellbeing profiles y smart suggestions contextuales
- Nearby Vets: Google Places API con geolocalización

### Comunidad (nuevo)
- Mascotas perdidas: reporte + push geolocalizadas + avistamientos
- Adopción: matching inteligente adoptante ↔ mascota
- Feed de comunidad con gamificación

### Lifestyle (nuevo)
- Recomendaciones personalizadas de lugares (cafés, parques, shops, grooming)
- Random questions para perfil de lifestyle del dueño
- Scoring: preferencias + proximidad + rating + pet compatibility

### Gamificación
- Puntos, streaks, 11 badges, 11 niveles (0-5000pts)
- Migración de localStorage a Firestore
- Puntos por acciones de comunidad

## Pricing
| Tier | Precio | Features |
|---|---|---|
| Free | $0 | Core features, 2 recs/día, ads |
| Premium | Variable por país | Todo ilimitado, push proactivas, sin ads |

Procesadores: MercadoPago (AR, BR, CL, MX, CO, UY, PE, BO, PY) + Stripe (US, ES, EC)

## Tech Stack
- Frontend: React 18 + TypeScript + Vite + Tailwind + Capacitor 7.4.3
- Backend: Firebase (Firestore, Auth, Storage, Cloud Functions Node 22)
- AI: Vertex AI + Claude + NotebookLM
- Design: Plano tokens (#074738, #1A9B7D, #E0F2F1)
- Push: FCM (routine, contextual, re-engagement, risk-based, max 1-3/día)

## Decisiones clave
- PESSY es solo para tutores. Pessy Vet será app separada para veterinarios
- Modelo "Uber de mascotas": conectar owners con servicios
- Mobile-first: Flutter wrapper para iOS/Android, web como base
- Idioma principal: Español (LATAM + España)
