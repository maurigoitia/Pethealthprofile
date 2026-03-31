# Handoff Claude — 2026-03-29

## Objetivo
Continuar sobre la base ya corregida hoy sin reabrir landing/blog/website. El foco sigue siendo:

1. app interna
2. historia clínica
3. export clínico
4. ingestión de emails
5. diseño pendiente pedido por Mauri

## Lo que quedó hecho hoy

### Home / clínica
- El check-in de medicación del home ya no celebra con copy falso tipo "está al día".
- Cuando se confirma una dosis desde home, intenta actualizar la medicación canónica (`lastDoseAt` / `nextDoseAt`) además del `dailyCheckin`.
- Se dejó de surfacer en el home el tip de `kitchen_trash_check`.
- También se eliminó la duplicación del tip de medicación activa por debajo del check-in.

### Perfil / historial / export
- Se creó una base compartida de narrativa clínica en `src/app/utils/clinicalNarrative.ts`.
- `PetProfileModal` ahora puede mostrar `ClinicalProfileBlock` con la narrativa del snapshot clínico.
- `ExportReportModal` usa la narrativa clínica para el perfil resumido y cambió la sección final a `Hitos confirmados`, menos tabular y menos dump.
- `Timeline` ahora:
  - muestra `ClinicalProfileBlock` arriba
  - saca de la UI los snapshots trimestrales tipo `Q1`
  - agrega lectura anual
  - muestra episodios con `Relato clínico` en lugar de puro metacopy

### QA local
- `vitest` de `HomeCards` verde
- `npm run build` verde
- `npm --prefix functions run build` verde

## Pendientes de producto/diseño pedidos por Mauri

### P0
- Login/auth shell: revisar branding visual. Mauri pidió que si aparece Cork/Fritz sea exactamente el oficial, y hoy ese frente no se trabajó.
- Iconografía general de app: migrar a lenguaje cartoon/mascotas. Hoy todavía hay Material/Lucide genérico en varios bloques.
- Home: definir si el `hamburger` queda o si se limpia más el inicio. No se tocó.
- Explorar: Mauri pidió Cork/Fritz/personajes en vez de cafés/maps genéricos. No se aplicó.

### P1
- Perfil de mascota: profundizar la narrativa de Thor como identidad clínica ("Thor es...", "asumimos A/B/C", jerarquía de problemas).
- Historial: separar aún mejor `historial`, `estudios` y `tratamientos` para evitar sensación de repetición.
- Estudios: reforzar click-through y lectura por estudio individual.
- Comunidad/adopción/perdidos/encontrados: rediseño funcional. No se tocó hoy.

### P2
- Oficializar logo PESSY en más puntos de la app.
- Revisar mapas/explorar para priorizar perfiles/lugares pet-friendly reales antes que categorías genéricas.

## Audit real de Gmail: patrones que PESSY hoy debe aprender

### 1. Emails veterinarios operativos que no nombran a Thor
Casos tipo Panda:
- `Recordatorio del Turno`
- `Información de Turno Solicitado`

Hallazgo:
- varios mails describen actos veterinarios reales pero usan datos del tutor en el cuerpo (`GOITIA, MAURICIO`, DNI, cobertura) y no siempre nombran a Thor.
- a la vez, el texto habla de `mascota`, `orden firmada`, `ecografía abdominal`, `placa radiográfica`, `cardiología`, etc.

Regla:
- no descartar por ausencia de nombre de mascota
- detectar contexto veterinario por dominio + léxico + estructura del turno
- soportar múltiples turnos en un mismo mail
- soportar un mail que mezcla agenda, preparación y centros

### 2. Emails administrativos veterinarios que no deben pasar como hecho clínico
Caso:
- `Comprobante de Pago` de Panda con PDF

Hallazgo:
- el PDF menciona un producto (`HEPATICO TOTAL`) y monto, pero no es receta ni diagnóstico.

Regla:
- tratar factura/comprobante como evidencia administrativa
- puede servir como `purchase/refill signal`, pero no como diagnóstico ni estudio
- jamás crear episodio clínico directo desde factura

### 3. Emails clínicos donde el body no dice nada y todo está en adjuntos
Casos:
- `ECO DE THOR`
- `Ecografía Thor`
- `Radiografias de Thor`

Hallazgo:
- el body puede venir vacío o casi vacío
- el valor real está en PDF/JPG/`HistoriaClinica.pdf`
- en esos adjuntos aparecen:
  - especie
  - nombre Thor
  - raza
  - edad
  - fecha del estudio
  - hallazgos
  - conclusiones
  - profesional firmante

Regla:
- priorizar adjuntos sobre subject/body cuando el mail es `attachment-first`
- OCR + PDF parsing no son opcionales
- si hay `HistoriaClinica.pdf`, usarla como evidencia secundaria/longitudinal
- guardar `study_report` canónico con hallazgos + firma + fecha

### 4. Correos reenviados
Casos:
- `Fwd: Radiografias de Thor`

Hallazgo:
- muchas veces Mauricio reenvía un estudio
- el cuerpo del forward agrega poco, pero arrastra adjuntos o contenido original clínico

Regla:
- identificar y colapsar `forward chains`
- no duplicar evento si ya existe el estudio original
- usar hash de adjunto + fecha + tipo de estudio para dedup

## Qué errores no debe seguir cometiendo PESSY

1. No tratar `Recordatorio del Turno` como review eterna si hay suficientes señales para turno veterinario.
2. No inventar `study_report` desde HTML/logística.
3. No ignorar un mail porque solo el adjunto trae el dato clínico.
4. No mezclar factura/compra con diagnóstico.
5. No mandar a episodios o export algo que sigue en `review`.

## Plan de ejecución sugerido

### Etapa 1
- Cerrar parser de emails operativos veterinarios:
  - Panda y similares
  - múltiples turnos por mail
  - dominio + léxico + preparación + prestaciones

### Etapa 2
- Cerrar parser de estudios attachment-first:
  - PDF/JPG/HistoriaClinica
  - study type
  - fecha
  - hallazgo principal
  - profesional

### Etapa 3
- Llevar eso a la UX:
  - estudios individuales bien separados
  - historial narrado
  - export pasando por snapshot/brain

### Etapa 4
- Recién después, atacar diseño pendiente:
  - login/branding
  - cartoons/iconografía
  - explorar/personajes
  - comunidad

## Restricción
- No tocar `pessy.app` website.
- No mezclar landing/blog con la PWA.
