---
name: pessy-security-audit
description: "Auditoría de seguridad y cumplimiento legal para PESSY, la app de salud de mascotas. Usa esta skill cuando necesites revisar flujos de la app para detectar vulnerabilidades de seguridad, violaciones de privacidad de datos, o incumplimientos legales. Cubre GDPR (UE), leyes LATAM (Chile Ley 21.719, Argentina Ley 25.326, México LFPDPPP 2025, Colombia Ley 1581), políticas de datos de USA (CCPA, leyes veterinarias estatales), regulaciones de IA (EU AI Act, políticas de retención de Gemini y Claude API), y normativas específicas de datos veterinarios/mascotas. Activa esta skill siempre que el usuario mencione: auditoría de seguridad, compliance, protección de datos, privacidad, GDPR, datos de mascotas, seguridad de IA, o quiera verificar que un flujo de PESSY cumple con regulaciones antes de ir a producción."
---

# PESSY Security & Compliance Audit Skill

## Propósito

Esta skill te guía para auditar los flujos de PESSY (app de salud de mascotas basada en React + Firebase + AI) y detectar problemas de seguridad, privacidad y cumplimiento legal. El resultado es un reporte HTML interactivo con cada hallazgo clasificado por severidad, la ley que viola, y una sugerencia concreta de fix.

## Contexto del proyecto

PESSY es una PWA (Progressive Web App) de salud veterinaria que:
- Almacena datos personales de usuarios (nombre, email, país) y datos de mascotas (historial médico, medicamentos, vacunas, diagnósticos)
- Usa Firebase Auth, Firestore y Storage como backend
- Procesa documentos médicos con IA (Google Gemini / Anthropic Claude) para extracción de datos
- Permite colaboración entre co-tutores (acceso compartido a datos de mascotas)
- Envía push notifications y sincroniza con Google Calendar
- Opera en múltiples jurisdicciones: LATAM (Chile, Argentina, México, Colombia), EU y USA

## Cómo funciona esta auditoría

La auditoría trabaja en 3 capas, porque los problemas de seguridad y compliance viven en lugares distintos:

### Capa 1: Datos en reposo y en tránsito
Revisa cómo se almacenan, transmiten y protegen los datos en Firestore, Storage y localStorage. Los problemas más comunes acá son Firestore security rules demasiado permisivas, datos sensibles en localStorage sin encriptar, y falta de cifrado en tránsito.

### Capa 2: Flujos de usuario y consentimiento
Revisa cada flujo de la app para verificar que el consentimiento se obtiene correctamente, que los derechos de los titulares se respetan (acceso, rectificación, eliminación, portabilidad), y que la retención de datos tiene política clara.

### Capa 3: Pipeline de IA
Revisa qué datos entran al pipeline de IA, qué sale, si hay retención por parte del proveedor, si el usuario consintió el procesamiento por IA, y si se cumple con el EU AI Act y las políticas de los proveedores.

---

## Procedimiento de auditoría

### Paso 1: Leer el marco legal de referencia

Antes de auditar, lee `references/legal-framework.md` en el directorio de esta skill. Contiene los artículos específicos de cada ley que aplican a PESSY. Esto es importante porque cada hallazgo debe referenciar la ley y artículo concreto que se viola — un reporte que solo dice "esto viola la privacidad" no es útil para tomar decisiones.

### Paso 2: Mapear los flujos a auditar

Identificar qué bloque funcional se va a auditar. Los bloques de PESSY son:

1. **Autenticación y Onboarding** — Login, registro, gating, invitaciones
2. **Home Dashboard** — Hub central, vistas, selector de mascota
3. **Documentos Médicos e IA** — Upload, OCR, AI extraction, review clínico
4. **Gestión de Citas** — CRUD, auto-sugerencias, calendar sync
5. **Medicamentos** — Tracking, parsing, notas de tratamiento, Clinical Brain
6. **Recordatorios y Notificaciones** — Reminders, push, acciones pendientes
7. **Co-Tutores** — Invitaciones, acceso compartido, permisos
8. **Bienestar e Inteligencia** — Wellbeing protocols, gamificación, vets cercanos

Si el usuario no especifica un bloque, auditar todos. Si especifica uno, enfocarse en ese pero revisar las conexiones con otros bloques (los datos fluyen entre bloques).

### Paso 3: Ejecutar los checklists de auditoría

Para cada flujo, ejecutar estos checklists en orden. Cada check tiene un ID para referencia en el reporte.

#### Checklist A: Datos Personales y Consentimiento

| ID | Check | Severidad base |
|----|-------|---------------|
| A1 | Existe aviso de privacidad visible ANTES de recolectar datos | CRITICA |
| A2 | El consentimiento es libre, especifico e informado | CRITICA |
| A3 | Se distingue entre datos personales y datos sensibles (datos medicos de mascotas vinculados a persona = datos personales; datos biometricos del usuario = sensibles) | ALTA |
| A4 | Hay mecanismo para retirar consentimiento | CRITICA |
| A5 | Se informa la finalidad especifica de cada tipo de dato recolectado | ALTA |
| A6 | Existe base legal para cada procesamiento (consentimiento, contrato, interes legitimo) | ALTA |
| A7 | Se informa sobre transferencias internacionales de datos (Firebase US, Gemini API, Claude API) | CRITICA |
| A8 | Hay politica de retencion con plazos definidos por tipo de dato | ALTA |
| A9 | Para Mexico: El aviso de privacidad cumple con los requisitos de la LFPDPPP 2025 | ALTA |
| A10 | Para Chile: Se cumple con los requisitos de la Ley 21.719 (vigente dic 2026) | MEDIA |

#### Checklist B: Derechos del Titular (ARCO+)

| ID | Check | Severidad base |
|----|-------|---------------|
| B1 | Existe mecanismo de Acceso (el usuario puede ver todos sus datos) | CRITICA |
| B2 | Existe mecanismo de Rectificacion (el usuario puede corregir sus datos) | ALTA |
| B3 | Existe mecanismo de Cancelacion/Eliminacion (`deleteAccountPermanently()` + cascade) | CRITICA |
| B4 | Existe mecanismo de Oposicion (el usuario puede oponerse a ciertos procesamientos) | ALTA |
| B5 | Existe mecanismo de Portabilidad (exportar datos en formato estandar) | ALTA |
| B6 | La eliminacion en cascada realmente borra TODOS los datos (Firestore, Storage, Auth, logs) | CRITICA |
| B7 | El co-tutor que deja una mascota pierde acceso inmediato a todos los datos | ALTA |
| B8 | Se puede ejercer derechos ARCO sin asistencia tecnica (UI accesible) | MEDIA |

#### Checklist C: Seguridad Tecnica

| ID | Check | Severidad base |
|----|-------|---------------|
| C1 | Las Firestore Security Rules siguen principio de minimo privilegio | CRITICA |
| C2 | Hay validacion server-side ademas de client-side | CRITICA |
| C3 | Los datos sensibles en localStorage estan encriptados (tokens, invite codes) | ALTA |
| C4 | Las URLs de Firebase Storage tienen tokens de acceso con expiracion | ALTA |
| C5 | Hay rate limiting en operaciones sensibles (login, registro, invitaciones) | ALTA |
| C6 | Los invite codes tienen expiracion y se invalidan despues de uso | MEDIA |
| C7 | Hay logging de accesos a datos sensibles para auditoria | ALTA |
| C8 | Se sanitizan inputs para prevenir XSS en campos de texto libre (notas, diagnosticos) | ALTA |
| C9 | Los endpoints del backend verifican autenticacion y autorizacion | CRITICA |
| C10 | Hay proteccion contra IDOR (Insecure Direct Object Reference) en acceso a mascotas/eventos | CRITICA |
| C11 | El `petId` y `userId` se validan contra el usuario autenticado en cada operacion | CRITICA |
| C12 | Los datos de co-tutores se filtran correctamente (no exponer email/uid innecesariamente) | MEDIA |

#### Checklist D: Pipeline de IA — Ingesta y Salida

| ID | Check | Severidad base |
|----|-------|---------------|
| D1 | Se obtiene consentimiento explicito antes de enviar documentos a la IA | CRITICA |
| D2 | El usuario sabe que sus documentos seran procesados por servicios externos (Google/Anthropic) | CRITICA |
| D3 | Se minimizan los datos enviados a la IA (solo el documento, no todo el perfil del usuario) | ALTA |
| D4 | La API de Gemini esta configurada para NO retener datos para entrenamiento | CRITICA |
| D5 | Se usa la API de Gemini (Vertex AI) y no la version consumer | ALTA |
| D6 | La API de Claude esta bajo Commercial Terms con data retention apropiada | ALTA |
| D7 | Se almacenan los resultados de la IA de forma segura (extractedData en Firestore) | ALTA |
| D8 | Hay validacion humana de los resultados de IA antes de que se materialicen (ClinicalReviewDraft) | ALTA |
| D9 | Se protege contra prompt injection en documentos subidos | ALTA |
| D10 | Los resultados de IA se marcan claramente como auto-generados | MEDIA |
| D11 | Hay fallback si la IA falla o devuelve datos incorrectos | MEDIA |
| D12 | Se registra que modelo de IA proceso cada documento (para trazabilidad) | MEDIA |
| D13 | Los datos extraidos por IA incluyen nivel de confianza | MEDIA |
| D14 | Existe politica de retencion de logs de llamadas a IA | ALTA |
| D15 | Se cumple con EU AI Act Art. 52 (transparencia de sistemas de IA) | ALTA |

#### Checklist E: Transferencias Internacionales

| ID | Check | Severidad base |
|----|-------|---------------|
| E1 | Se documenta donde residen los datos (Firebase region, API endpoints) | ALTA |
| E2 | Hay SCCs (Standard Contractual Clauses) o equivalente para transferencias EU a US | CRITICA para usuarios EU |
| E3 | Se cumple con el Data Privacy Framework para transferencias a USA | ALTA |
| E4 | Para Argentina: hay autorizacion de la AAIP para transferencia internacional | ALTA |
| E5 | Para Colombia: la SIC ha sido notificada de las transferencias | ALTA |
| E6 | Firebase Auth y Analytics usan servidores en US por defecto — esta documentado | ALTA |

#### Checklist F: Datos Veterinarios Especificos

| ID | Check | Severidad base |
|----|-------|---------------|
| F1 | Los registros medicos vinculados a persona se tratan como datos personales | ALTA |
| F2 | Se cumple con retencion minima de registros veterinarios (3-5 anios segun jurisdiccion) | MEDIA |
| F3 | El reporte exportable (ExportReportModal) no incluye datos personales del dueño sin consentimiento | ALTA |
| F4 | La URL publica de verificacion (/verify/:hash) no expone datos sensibles | ALTA |
| F5 | Los datos compartidos entre co-tutores respetan el principio de minimizacion | MEDIA |
| F6 | El NearbyVetsScreen no envia datos medicos de la mascota al buscar veterinarias | MEDIA |

### Paso 4: Revisar el codigo

Para cada check que requiera verificacion en codigo, buscar en los archivos relevantes. La estructura del proyecto esta en:

- **Contexts**: `app/contexts/` — AuthContext, PetContext, MedicalContext, RemindersContext, NotificationContext
- **Servicios**: `app/services/` — analysisService, calendarSyncService, notificationService, petPhotoService
- **Reglas Firebase**: `firestore.rules`, `storage.rules`
- **Config Firebase**: `firebase.json`, `.firebaserc`
- **Tipos**: `app/types/` — medical.ts y otros
- **Domain logic**: `app/domain/` — clinicalBrain, wellbeingMasterBook, etc.
- **Utilities**: `app/utils/` — deduplication, gamification, coTutorInvite, platformInvite, runtimeFlags

Buscar patrones especificos con Grep:

- `localStorage.` en archivos .ts/.tsx — datos almacenados en el navegador
- `fetch` / `axios` / `api.` — llamadas a APIs externas
- `firestore.rules` — reglas de seguridad de la base de datos
- `storage.rules` — reglas de acceso a archivos
- `consent` / `privacy` / `aviso` / `consentimiento` / `terms` — mecanismos de consentimiento
- `email` / `phone` / `uid` combinado con `log` / `console` — datos sensibles expuestos en logs

### Paso 5: Clasificar hallazgos

Cada hallazgo debe tener esta estructura:

```json
{
  "id": "C10-001",
  "title": "Descripcion corta",
  "severity": "CRITICAL | HIGH | MEDIUM | LOW",
  "block": "Bloque funcional afectado",
  "file": "ruta/al/archivo.ts:linea",
  "law_violated": "GDPR Art. 25 / Chile Ley 21.719 Art. X / etc",
  "description": "Que esta mal y por que importa",
  "impact": "Que puede pasar si no se arregla",
  "fix_suggestion": "Codigo o cambio especifico sugerido",
  "fix_code": "// codigo de ejemplo si aplica"
}
```

Severidades:
- **CRITICAL**: Exposicion directa de datos personales, falta de consentimiento, acceso no autorizado posible. Debe arreglarse antes de produccion.
- **HIGH**: Incumplimiento claro de una ley especifica, falta de mecanismo requerido. Debe arreglarse en el corto plazo.
- **MEDIUM**: Mejora importante de seguridad o compliance, best practice faltante. Planificar para el mediano plazo.
- **LOW**: Mejora deseable, hardening adicional. Nice to have.

### Paso 6: Generar el reporte HTML

Generar un archivo HTML interactivo con:

1. **Resumen ejecutivo**: Score general, hallazgos por severidad, bloques mas afectados
2. **Vista por bloque**: Cada bloque funcional con sus hallazgos expandibles
3. **Vista por ley**: Agrupar hallazgos por jurisdiccion/ley violada
4. **Detalle de cada hallazgo**: Con toda la info del paso 5, incluyendo el codigo sugerido de fix
5. **Checklist de compliance**: Estado de cada check (pass/fail/partial)
6. **Roadmap sugerido**: Orden de prioridad para arreglar, agrupado por sprint

El HTML debe usar los tokens de diseño de PESSY (Plano brand) para ser coherente con el proyecto:
- Primary: #074738, Accent: #1A9B7D, Surface: #E0F2F1, BG: #F0FAF9
- Font: Plus Jakarta Sans para headings, Manrope para body
- Cards: rounded-16, shadow suave
- Severidades: CRITICAL = #DC2626, HIGH = #F59E0B, MEDIUM = #3B82F6, LOW = #6B7280

El reporte se guarda en el directorio del proyecto como `PESSY_SECURITY_AUDIT_[fecha].html`.

---

## Notas importantes sobre el contexto legal

### Datos de mascotas no son simplemente datos de animales

Un error comun es pensar que los datos de mascotas no son datos personales porque GDPR solo protege datos de personas vivas. La realidad es mas matizada: los registros veterinarios de una mascota, cuando estan vinculados al nombre, email y direccion del dueno, son datos personales del dueno. El historial medico de "Thor" es dato personal de "Mauri" porque identifica indirectamente a una persona natural.

Esto aplica en todas las jurisdicciones que PESSY cubre.

### La IA como encargado del tratamiento

Cuando PESSY envia un documento medico a Gemini o Claude para analisis, esta realizando una transferencia de datos a un encargado del tratamiento (data processor). Esto requiere: base legal para la transferencia, contrato de procesamiento de datos (DPA) con el proveedor, y que el usuario sepa que esto sucede.

Google Vertex AI y Anthropic Commercial API ofrecen DPAs y zero-data-retention. Pero si se usa la version consumer de Gemini o la API sin Commercial Terms de Claude, los datos podrian ser retenidos para entrenamiento — lo cual seria una violacion grave.

### Retencion de datos de IA por proveedores

- **Google Gemini API**: Retiene prompts 55 dias para deteccion de abuso. No entrena con datos de API. Vertex AI ofrece zero data retention.
- **Anthropic Claude API**: Retiene logs 7 dias (desde sept 2025). No entrena con datos de API bajo Commercial Terms. Ofrece ZDR addendum.

La auditoria debe verificar que PESSY usa las versiones correctas de estas APIs y tiene los DPAs correspondientes.

### Leyes LATAM que aplican

- **Chile (Ley 21.719)**: Vigente desde dic 2026. Crea Agencia de Proteccion de Datos. Multas hasta 20.000 UTM. Homologada a GDPR. Requiere DPO para cierto volumen de datos.
- **Argentina (Ley 25.326 + reforma pendiente)**: Vigente. Derechos ARCO. Reforma 2025 agrega portabilidad, responsabilidad proactiva, datos biometricos como sensibles. AAIP supervisa.
- **Mexico (LFPDPPP 2025)**: Nueva ley vigente desde marzo 2025. Requiere aviso de privacidad completo. Consentimiento expreso escrito para datos sensibles. Autoridad: Secretaria de Anticorrupcion.
- **Colombia (Ley 1581 de 2012)**: Vigente. Habeas data. SIC supervisa. Consultas en 10 dias habiles. Registro Nacional de Bases de Datos.

### USA no tiene HIPAA para veterinaria

HIPAA no aplica a registros veterinarios porque las mascotas son propiedad, no personas. Pero 35 estados tienen leyes de confidencialidad veterinaria. California (CCPA + Business and Professions Code) es la mas estricta: prohibe divulgar informacion del paciente animal sin consentimiento escrito.

---

## Output esperado

El reporte HTML interactivo con las sugerencias de fix es el output principal. Ademas, se genera un resumen en consola con:

- Total de hallazgos por severidad
- Top 5 hallazgos mas criticos
- Porcentaje de compliance por jurisdiccion
- Siguiente accion recomendada
