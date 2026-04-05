# PESSY Module Map — Paths Absolutos

Base: `/Users/mauriciogoitia/Downloads/03_PESSY_APP/PESSY_PRODUCCION/`

## Clinical Brain (Cloud Functions)
Path: `functions/src/clinical/`

| Archivo | Path | Líneas | Descripción |
|---------|------|--------|-------------|
| groundedBrain.ts | functions/src/clinical/groundedBrain.ts | ~300 | Grounding clínico via Vertex AI (Gemini) + Claude. Inyecta contexto del knowledge base |
| brainResolver.ts | functions/src/clinical/brainResolver.ts | 407 | Normaliza outputs AI → datos clínicos estructurados. Valida ownership, parsea señales numéricas |
| knowledgeBase.ts | functions/src/clinical/knowledgeBase.ts | ~200 | Query Firestore notebook_knowledge. Scoring por keywords. Hasta 10 secciones relevantes |
| notebookKnowledgeSync.ts | functions/src/clinical/notebookKnowledgeSync.ts | ~150 | Cloud Function POST. Recibe secciones de NotebookLM → Firestore. Auth: GMAIL_FORCE_SYNC_KEY |
| episodeCompiler.ts | functions/src/clinical/episodeCompiler.ts | ~200 | Construye episodios clínicos completos desde datos dispersos |
| projectionLayer.ts | functions/src/clinical/projectionLayer.ts | ~150 | Proyecciones de salud futura basadas en historial |
| treatmentReminderEngine.ts | functions/src/clinical/treatmentReminderEngine.ts | ~200 | Recordatorios inteligentes de tratamiento |
| ingestHistory.ts | functions/src/clinical/ingestHistory.ts | ~150 | Procesamiento de historial médico |
| vertexDatastoreAdmin.ts | functions/src/clinical/vertexDatastoreAdmin.ts | ~100 | Admin de Vertex AI Datastore |

## Intelligence Engine (Frontend Domain)
Path: `src/domain/intelligence/`

| Archivo | Path | Líneas | Descripción |
|---------|------|--------|-------------|
| pessyIntelligenceEngine.ts | src/domain/intelligence/pessyIntelligenceEngine.ts | 519 | Motor principal. Analiza breed/age/thermal/behavior → recomendaciones |
| smartSuggestionGenerator.ts | src/domain/intelligence/smartSuggestionGenerator.ts | ~150 | Sugerencias contextuales de bienestar |
| pessyIntelligenceTrainingSet.ts | src/domain/intelligence/pessyIntelligenceTrainingSet.ts | ~100 | Dataset de validación |
| userRoutinePreferences.ts | src/domain/intelligence/userRoutinePreferences.ts | ~80 | Preferencias de rutina del usuario |

## Wellbeing & Training (Frontend Domain)
Path: `src/domain/wellbeing/` y `src/domain/training/`

| Archivo | Path | Líneas | Descripción |
|---------|------|--------|-------------|
| wellbeingMasterBook.ts | src/domain/wellbeing/wellbeingMasterBook.ts | ~500 | Knowledge base: especies, thermal safety, food safety, rutinas |
| wellbeingProtocol.contract.ts | src/domain/wellbeing/wellbeingProtocol.contract.ts | ~100 | Interfaces y tipos del protocolo |
| wellbeingProtocol.guards.ts | src/domain/wellbeing/wellbeingProtocol.guards.ts | ~80 | Type guards y validación |
| training_master_book.ts | src/domain/training/training_master_book.ts | ~300 | Comandos, guía conductual, niveles de entrenamiento |

## Services (Frontend App)
Path: `src/app/services/`

| Archivo | Path | Líneas | Descripción |
|---------|------|--------|-------------|
| analysisService.ts | src/app/services/analysisService.ts | 2973 | El servicio más grande. Análisis de datos médicos |
| calendarSyncService.ts | src/app/services/calendarSyncService.ts | ~150 | Integración calendario |
| gmailSyncService.ts | src/app/services/gmailSyncService.ts | ~200 | Sync emails médicos |
| notificationService.ts | src/app/services/notificationService.ts | ~150 | Push notifications |
| petPhotoService.ts | src/app/services/petPhotoService.ts | ~100 | Gestión fotos de mascotas |

## Utils Clínicos (Frontend App)
Path: `src/app/utils/`

| Archivo | Path | Líneas | Descripción |
|---------|------|--------|-------------|
| clinicalBrain.ts | src/app/utils/clinicalBrain.ts | 103 | Normalización frontend: diagnósticos, hallazgos, tratamientos, citas |
| clinicalRouting.ts | src/app/utils/clinicalRouting.ts | ~100 | Routing de eventos médicos a colecciones Firestore |
| medicalRulesEngine.ts | src/app/utils/medicalRulesEngine.ts | ~150 | Motor de reglas médicas |
| gamification.ts | src/app/utils/gamification.ts | ~100 | Sistema de gamification |
| pdfExport.ts | src/app/utils/pdfExport.ts | ~150 | Exportación PDF de registros médicos |
| reportVerification.ts | src/app/utils/reportVerification.ts | ~100 | Verificación de reportes médicos |

## Contexts (Frontend React State)
Path: `src/app/contexts/`

| Archivo | Descripción |
|---------|-------------|
| AuthContext.tsx | Estado de autenticación |
| PetContext.tsx | Datos de mascotas |
| MedicalContext.tsx | Registros médicos |
| NotificationContext.tsx | Notificaciones |
| RemindersContext.tsx | Recordatorios |

## Config & Infra
| Archivo | Descripción |
|---------|-------------|
| src/lib/firebase.ts | Init Firebase, messaging, persistence |
| capacitor.config.ts | Config app móvil (iOS/Android) |
| firestore.rules | Reglas de seguridad |
| functions/src/index.ts | Exports de Cloud Functions (syncNotebookKnowledge, resolveBrainOutput, etc.) |

---

## NUEVOS MÓDULOS (por implementar)

Los siguientes módulos son parte del roadmap de PESSY Brain v2. Al generar código para estos módulos, seguir los patterns existentes de PESSY (Cloud Functions + Firestore + React + Tailwind + Capacitor).

### User Preference Engine
Path propuesto: `functions/src/preferences/` (backend) + `src/domain/preferences/` (frontend)

| Archivo propuesto | Función |
|-------------------|---------|
| functions/src/preferences/preferenceComputer.ts | Recalcula perfil de preferencias (batch + on-demand) |
| functions/src/preferences/randomQuestionEngine.ts | Selecciona y sirve preguntas random |
| src/domain/preferences/userPreferenceProfile.ts | Tipos e interfaces del perfil de usuario |
| src/domain/preferences/questionPool.ts | Pool de preguntas random con categorías y tags |
| src/app/contexts/PreferenceContext.tsx | Estado de preferencias en React |
| src/app/components/preferences/RandomQuestionCard.tsx | UI de pregunta random |

### Community: Mascotas Perdidas
Path propuesto: `functions/src/community/` (backend) + `src/domain/community/` (frontend)

| Archivo propuesto | Función |
|-------------------|---------|
| functions/src/community/lostPetAlerts.ts | Push geolocalizadas, expansión de radio |
| functions/src/community/sightingProcessor.ts | Procesa avistamientos, notifica al dueño |
| src/domain/community/lostPet.contract.ts | Tipos de reporte y avistamiento |
| src/app/components/community/LostPetFeed.tsx | Feed de mascotas perdidas |
| src/app/components/community/ReportLostPet.tsx | Formulario de reporte |
| src/app/components/community/SightingForm.tsx | Formulario de avistamiento |

### Community: Adopción
Path propuesto: `functions/src/community/` (backend) + `src/domain/community/` (frontend)

| Archivo propuesto | Función |
|-------------------|---------|
| functions/src/community/adoptionMatcher.ts | Matching inteligente adoptante ↔ mascota |
| functions/src/community/adoptionListingManager.ts | CRUD de listings + expiración |
| src/domain/community/adoption.contract.ts | Tipos de listing y matching |
| src/app/components/community/AdoptionFeed.tsx | Feed de mascotas en adopción |
| src/app/components/community/AdoptionProfile.tsx | Perfil detallado + match score |
| src/app/components/community/CompatibilityQuiz.tsx | Cuestionario de compatibilidad |

### Lifestyle: Recomendaciones de Lugares
Path propuesto: `functions/src/lifestyle/` (backend) + `src/domain/lifestyle/` (frontend)

| Archivo propuesto | Función |
|-------------------|---------|
| functions/src/lifestyle/recommendationEngine.ts | Scoring personalizado, Top 5 |
| functions/src/lifestyle/placesSyncEngine.ts | Import de Google Places API + verificación |
| src/domain/lifestyle/place.contract.ts | Tipos de lugar y recomendación |
| src/domain/lifestyle/scoringModel.ts | Modelo de scoring (preference + proximity + context) |
| src/app/components/lifestyle/RecommendationFeed.tsx | Cards de recomendaciones |
| src/app/components/lifestyle/PlaceDetail.tsx | Detalle de lugar con reviews |
| src/app/components/lifestyle/PlaceReview.tsx | Formulario de review |

### Gamificación (expandir existente)
Path existente: `src/app/utils/gamification.ts` → expandir

| Archivo propuesto | Función |
|-------------------|---------|
| functions/src/gamification/pointsEngine.ts | Cálculo de puntos por acción |
| functions/src/gamification/achievementEngine.ts | Evaluación de logros y badges |
| functions/src/gamification/planGating.ts | Lógica de restricción por plan |
| src/domain/gamification/gamification.contract.ts | Tipos (puntos, logros, niveles, planes) |
| src/app/contexts/GamificationContext.tsx | Estado de gamificación en React |
| src/app/components/gamification/AchievementBadge.tsx | UI de badge |
| src/app/components/gamification/StreakCounter.tsx | UI de streak |
| src/app/components/gamification/PlanUpgradeCard.tsx | CTA de upgrade |
