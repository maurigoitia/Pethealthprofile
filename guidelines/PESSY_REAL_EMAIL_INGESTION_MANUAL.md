# Pessy Real Email Ingestion Manual

Fecha: 2026-03-30
Fuente: auditoría real sobre Gmail de Mauricio Goitia, con foco en Thor y correos veterinarios de 2023-2026.

## Objetivo

Este manual define cómo Pessy debe leer correos veterinarios reales a partir del corpus de Mauricio/Thor.

No está basado en ejemplos sintéticos.
Está basado en patrones efectivamente observados en:

- Panda
- myVete
- Veterinaria Honorio
- Petit Pet Shop
- correos reenviados por Mauricio
- recordatorios automáticos generados por Pessy

## Principio rector

Pessy no debe clasificar por remitente solamente.

Debe leer cada correo como si fuera un documento clínico o administrativo compuesto por:

1. asunto
2. remitente
3. cuerpo limpio
4. adjuntos
5. links útiles
6. contexto del paciente
7. contexto temporal

La unidad correcta de lectura no es "el mail" en abstracto.
La unidad correcta es "la evidencia clínica o administrativa contenida en el mail".

## Qué detectó el audit real

### 1. Correos operativos veterinarios

Ejemplos reales:

- `Información de Turno Solicitado` de Panda
- `Recordatorio del Turno` de Panda
- `Turno para Thor (ACTUALIZADO)` de Veterinaria Honorio
- `Recordatorio de Turno para Thor` de myVete / Petit Pet

Patrón:

- traen fecha
- traen hora
- traen especialidad o práctica
- a veces traen profesional
- a veces traen sede o centro de atención
- a veces un mismo correo trae varios actos clínicos

Regla:

- si hay estructura operativa suficiente, el correo es clínicamente accionable
- no debe descartarse como no clínico
- debe ir a `medical_events` como appointment canonical event
- luego proyectarse a `appointments`

### 2. Correos clínicos attachment-first

Ejemplos reales:

- `ECO DE THOR`
- `Ecografía Thor`
- `Radiografias de Thor`
- `Fwd: Radiografias de Thor`

Patrón:

- el body puede ser vacío o casi vacío
- el dato real vive en PDF/JPG/HistoriaClinica
- el asunto solo anticipa el estudio

Regla:

- si el asunto o el adjunto sugiere estudio clínico, el adjunto es la fuente principal
- el cuerpo no puede tener prioridad por encima del adjunto
- si OCR/AI fallan, el correo no debe degradarse a "basura"
- debe quedar como `study_report` en review o canonical, según nivel de certeza

### 3. Correos administrativos veterinarios

Ejemplos reales:

- `Comprobante de Pago` de Panda
- `Comprobantes de Cliente` de Veterinaria Honorio

Patrón:

- hablan de consumos, factura, importe, comprobantes, encuesta
- pueden incluir PDFs
- no describen hallazgos clínicos

Regla:

- no crear hecho clínico canónico
- no crear appointment
- no crear study_report salvo que el adjunto contenga evidencia clínica real
- si solo hay consumo/factura, descartar como administrativo

### 4. Correos enviados por el tutor

Ejemplo real:

- `Demora`

Patrón:

- no vienen de prestador
- pueden describir una situación clínica o logística real

Regla:

- no descartar por venir del tutor
- si refieren turno, demora, control o síntoma relevante, pueden ir a review
- requieren más cautela que un prestador

### 5. Correos auto-generados por Pessy

Ejemplos reales:

- `Hora de la medicación de thor — Pessy`
- `En 5 min: medicación de thor — Pessy`

Patrón:

- contienen medicación, hora y nombre
- parecen clínicos por texto
- pero son notificaciones del propio sistema

Regla:

- no deben entrar al pipeline clínico de ingestión
- deben excluirse en query y clasificación

## Cómo debe leer Pessy cada mail

## Paso 1. Clasificar la naturaleza del correo

Clases válidas:

- `vet_operational`
- `vet_clinical_attachment_first`
- `vet_administrative`
- `pet_owner_message`
- `self_generated_pessy`
- `human_medical`
- `non_medical`
- `unknown_review`

## Paso 2. Detectar evidencia mínima

Evidencias operativas:

- fecha
- hora
- especialidad
- práctica/prestación
- profesional
- centro

Evidencias de estudio:

- asunto de estudio
- nombre de archivo clínico
- PDF/JPG de informe o historia clínica
- términos de imagen/lab

Evidencias administrativas:

- factura
- comprobante
- consumo
- importe
- CAE
- encuesta

## Paso 3. Resolver destino canónico

- `vet_operational` -> `medical_events` -> `appointments`
- `vet_clinical_attachment_first` -> `medical_events`
- `vet_administrative` -> descarte o evidencia administrativa, no historia clínica
- `pet_owner_message` -> review si aporta información clínica/logística útil
- `self_generated_pessy` -> excluir del pipeline

## Regla de multiplicidad

Un correo puede contener más de un evento.

Ejemplo real:

`Información de Turno Solicitado` de Panda puede traer:

- consulta cardiológica
- ecografía abdominal
- placa radiográfica

Regla:

- no colapsar todo en un solo turno
- crear un evento por acto clínico

## Regla de adjuntos

Si el correo es `attachment-first`, el orden de prioridad es:

1. adjunto
2. OCR del adjunto
3. metadata del adjunto
4. asunto
5. cuerpo

Nunca al revés.

## Regla de baja confianza

Si hay evidencia clínica pero no suficiente para auto-ingestar:

- crear `gmail_event_reviews`
- crear `pending_actions.sync_review`
- no crear episodio narrativo final

## Pipeline universal en segundo plano

La ingesta no debe bloquear la app ni depender de una lectura síncrona.

Orden correcto:

1. `gmail_ingestion_documents`
- el mail entra como evidencia operativa
- queda con `processing_status` tipo:
  - `queued_classification`
  - `queued_attachment_ocr`
  - `requires_review_*`
  - `discarded_*`
  - `ingested`

2. clasificación barata
- asunto
- remitente
- cuerpo limpio
- metadata de adjuntos
- contexto de mascota

3. OCR selectivo
- solo si hay adjuntos con señal clínica
- no correr OCR sobre todo PDF por defecto

4. IA selectiva
- solo para mails mixtos, hallazgos clínicos complejos o extracción fina
- no usar IA como primera capa para todo

5. salida canónica
- `gmail_event_reviews` si queda en revisión
- `medical_events` si ya hay verdad suficiente
- después proyectar a:
  - `appointments`
  - `treatments`
  - `medications`

6. narrativa
- el cerebro solo narra verdad confirmada o revisiones explícitas
- nunca narra `gmail_ingestion_documents` como historia clínica

## Matriz operativa universal

### Turno estructurado

- evidencia mínima: fecha + hora + práctica/profesional/centro
- OCR: no
- IA: opcional
- destino:
  - `medical_events`
  - `appointments`
- review: solo si faltan campos críticos o hay conflicto de identidad

### Estudio attachment-first

- evidencia mínima: asunto/adjunto clínico + nombre mascota o contexto veterinario fuerte
- OCR: sí, selectivo
- IA: sí, si hace falta extraer hallazgos
- destino:
  - `medical_events`
- review:
  - sí, si no alcanza para estructurar bien
  - no, si el estudio es inequívoco y autoingestable

### Laboratorio / sangre / hemograma / bioquímica

- evidencia mínima: subject/body/adjunto con señal de laboratorio
- OCR: sí, si el valor está en PDF/JPG
- IA: sí, si hay que estructurar resultados
- destino:
  - `medical_events`
- review:
  - sí, si el dato es ambiguo
  - no, si el informe es claramente de laboratorio

### Receta completa

- evidencia mínima: droga + dosis + frecuencia
- OCR: opcional
- IA: sí, para extraer estructura si hace falta
- destino:
  - `medical_events`
  - `treatments`
  - `medications`
- review: no, si está completa

### Receta incompleta

- evidencia mínima: droga explícita pero faltan campos críticos
- OCR: opcional
- IA: sí
- destino:
  - `medical_events` review-safe
  - `gmail_event_reviews`
  - `clinical_review_drafts`
  - `pending_actions.incomplete_data`
- review: sí

### Administrativo veterinario

- evidencia mínima: factura/comprobante/consumo/pago
- OCR: no, salvo señal clínica en adjunto
- IA: no por defecto
- destino:
  - descarte clínico
- review: solo si el adjunto o link parece realmente clínico

### Mensaje del tutor

- evidencia mínima: referencia útil a turno, síntoma o estudio
- OCR: no
- IA: opcional
- destino:
  - `review` por defecto
- review: sí, salvo que haya estructura excepcionalmente clara

## Qué no debe hacer Pessy

- no mezclar factura con estudio
- no tomar un recordatorio propio como historia clínica
- no perder un estudio solo porque el body está vacío
- no resumir tres turnos en uno
- no escribir directo a `clinical_episodes`
- no usar `gmail_ingestion_documents` como verdad clínica

## Cómo escribir la historia clínica a partir de correos

Pessy debe pensar como un lector clínico:

1. detectar el hecho
2. ubicarlo en el tiempo
3. identificar si es turno, estudio, receta, vacuna o señal administrativa
4. crear evento canónico
5. recién después narrar

La narrativa nunca debe decir:

- "extraído por correo"
- "detectado por correo"

La narrativa correcta debe decir:

- "En marzo de 2026 Thor tuvo controles cardiológicos y estudios por imágenes"
- "En julio de 2024 se registraron radiografías con hallazgos ortopédicos"
- "Durante este período hubo seguimiento por..."

## Gold set real observado

Casos de referencia confirmados del corpus:

- Panda multi-acto: `19ce886e2dcb7f42`
- Panda recordatorio operativo: `19d0b48e2b038c83`
- Panda administrativo: `19d124fe86388414`
- Ecografía attachment-first: `18fa148e2500d094`
- Radiografías attachment-first: `18d23bc96b370753`
- Forward clínico: `190d12283a899b08`
- Turno Honorio estructurado: `192edbfe9a945111`
- Administrativo Honorio: `192edca101866ac8`
- Tutor reporta logística: `190704f00782ae17`

## Qué debe hacer Claude/Codex ante nuevas iteraciones

Antes de tocar reglas de ingestión:

1. ubicar el mail en una de las clases de este manual
2. decidir el destino canónico
3. verificar si el mail debe o no entrar en episodios
4. probar contra este gold set real
5. no dar por bueno un cambio si mejora Panda pero rompe myVete/Honorio/Petit Pet

## Decisión operativa actual

La dirección correcta para Pessy es:

- menos dependencia ciega de Gemini en clasificación
- más heurística clínica basada en estructura real
- más peso de adjuntos en estudios
- más descarte administrativo limpio
- narrativa final basada en eventos canónicos, no en mails crudos
