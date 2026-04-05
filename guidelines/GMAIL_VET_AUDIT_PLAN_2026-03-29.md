# Gmail Vet Audit Plan — 2026-03-29

## Objetivo
Usar el Gmail real de Mauricio como corpus de auditoría para enseñar a PESSY cómo separar, clasificar e ingerir correos de forma robusta.

Esto NO significa entrenar pesos del modelo. Significa:

1. construir reglas canónicas
2. armar un gold set de ejemplos
3. endurecer prompts, parsers y heurísticas
4. crear tests de regresión

## Hallazgos del audit real

### Clase A — Operativo veterinario
Ejemplos:
- `turnos@veterinariapanda.com.ar`
- subjects: `Recordatorio del Turno`, `Información de Turno Solicitado`

Patrones:
- no siempre nombran a la mascota
- muchas veces nombran al tutor (`GOITIA, MAURICIO`)
- incluyen:
  - fecha
  - hora
  - especialidad
  - prestación
  - profesional
  - centro
  - preparación previa
- un mismo correo puede traer varios turnos en una sola pieza

Debe producir:
- `appointment` canónico
- uno o más `appointment_event`
- preparación como metadata útil, no como diagnóstico

No debe producir:
- `study_report`
- `review eterna`

### Clase B — Administrativo veterinario
Ejemplos:
- `facturaelectronica@veterinariapanda.com.ar`
- subject: `Comprobante de Pago`

Patrones:
- factura PDF
- puede mencionar productos o consumos
- no trae hallazgo clínico canónico

Debe producir:
- descarte clínico o evidencia administrativa
- opcionalmente `purchase/refill signal`

No debe producir:
- diagnóstico
- estudio
- episodio clínico

### Clase C — Clínico attachment-first
Ejemplos:
- `ECO DE THOR`
- `Ecografía Thor`
- `Radiografias de Thor`
- remitentes: `noreply@myvete.com`, `lvdiazz@yahoo.com.ar`

Patrones:
- body casi vacío
- subject muy corto
- todo el valor está en:
  - PDF
  - JPG
  - `HistoriaClinica.pdf`
- aparecen:
  - nombre Thor
  - especie
  - raza
  - edad
  - fecha
  - hallazgos
  - conclusiones
  - firma profesional

Debe producir:
- `study_report` canónico
- tipo de estudio
- fecha del estudio
- hallazgo principal
- profesional firmante
- attachments vinculados al evento

No debe depender de:
- subject
- body
- sender solo

### Clase D — Reenvíos
Ejemplos:
- `Fwd: Radiografias de Thor`

Patrones:
- el usuario reenvía estudios a terceros
- a veces el forward incluye adjuntos
- a veces incluye quoted content original

Debe producir:
- dedup contra el estudio original
- reuso del hash de adjunto + fecha + tipo

No debe producir:
- duplicados clínicos

### Clase E — Salud humana / ruido médico
Ejemplos detectados en el inbox:
- OSDE
- Helios
- Medifé
- recetas e informes humanos

Patrones:
- parecen clínicos
- tienen adjuntos
- pero son del tutor humano, no de la mascota

Debe producir:
- descarte del flujo pet si no hay evidencia de mascota

No debe producir:
- eventos para Thor

## Errores que PESSY estaba cometiendo o puede cometer

1. Sobreconfiar en `subject + body` y subleer adjuntos.
2. Tratar correos administrativos como clínicos.
3. Dejar turnos veterinarios en `review` aunque el mail ya tenga estructura suficiente.
4. No soportar varios turnos/actos en un mismo correo.
5. No distinguir salud humana vs salud de mascota.
6. Duplicar estudios reenviados.

## Criterio correcto de separación

### Paso 1 — Clasificación macro
Cada mail entra primero en una de estas clases:

- `vet_operational`
- `vet_clinical_attachment_first`
- `vet_administrative`
- `human_medical`
- `non_medical`
- `unknown_review`

### Paso 2 — Extracción por clase

#### vet_operational
- parsear actos, agenda, preparación, profesional, sede
- permitir múltiples appointments por mail

#### vet_clinical_attachment_first
- correr OCR/PDF parse primero
- luego consolidar:
  - study type
  - date
  - diagnosis/hallazgo
  - professional
  - clinic

#### vet_administrative
- extraer producto/monto si sirve
- no crear clinical event

#### human_medical
- bloquear ingesta pet

### Paso 3 — Proyección
- `appointment` -> agenda/turnos
- `study_report` -> estudios
- `prescription` -> tratamientos/medications
- `review` solo si falta dato estructural de verdad

## Cómo avanzar

### Etapa 1
Armar dataset de ejemplos reales a partir del Gmail de Mauricio:
- 10 mails operativos
- 10 mails clínicos attachment-first
- 5 administrativos
- 5 forwards
- 5 falsos positivos humanos/no clínicos

### Etapa 2
Crear suite de tests parser/classifier con esos casos.

### Etapa 3
Ajustar parser:
- multi-appointment per mail
- attachment-first study extraction
- blocking de human medical
- billing/admin separation

### Etapa 4
Reauditar con rerun de ingesta y comparar:
- qué quedaba antes en `review`
- qué ahora entra canónicamente

## Regla principal
En este corpus real, el dato clínico no vive solo en el cuerpo.
Si PESSY no se vuelve attachment-first cuando corresponde, va a perder la historia real de Thor.
