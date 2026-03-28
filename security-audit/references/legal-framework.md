# Marco Legal de Referencia para PESSY

Este documento contiene los articulos y disposiciones especificas de cada ley que aplican a PESSY. Usarlo como referencia al clasificar hallazgos de la auditoria.

## Tabla de contenidos

1. [GDPR (Union Europea)](#gdpr)
2. [Chile — Ley 21.719](#chile)
3. [Argentina — Ley 25.326](#argentina)
4. [Mexico — LFPDPPP 2025](#mexico)
5. [Colombia — Ley 1581 de 2012](#colombia)
6. [USA — CCPA y leyes estatales](#usa)
7. [EU AI Act](#eu-ai-act)
8. [Politicas de proveedores de IA](#proveedores-ia)
9. [Datos veterinarios por jurisdiccion](#datos-veterinarios)

---

## GDPR (Union Europea) {#gdpr}

Aplica si PESSY tiene usuarios en la UE o procesa datos de personas en la UE.

### Articulos clave para PESSY

| Articulo | Tema | Aplicacion en PESSY |
|----------|------|---------------------|
| Art. 5 | Principios del tratamiento | Licitud, lealtad, transparencia, limitacion de finalidad, minimizacion, exactitud, limitacion de almacenamiento, integridad y confidencialidad |
| Art. 6 | Bases legales | Consentimiento (registro), contrato (prestacion del servicio), interes legitimo (seguridad) |
| Art. 7 | Condiciones del consentimiento | Demostrable, distinguible, retirable, libre |
| Art. 12-14 | Transparencia e informacion | Aviso de privacidad claro, informar sobre procesamiento de IA |
| Art. 15 | Derecho de acceso | El usuario debe poder ver todos sus datos |
| Art. 16 | Derecho de rectificacion | Editar datos de perfil y mascota |
| Art. 17 | Derecho de supresion | deleteAccountPermanently() + cascade completa |
| Art. 20 | Portabilidad | ExportReportModal debe poder exportar en formato legible por maquina |
| Art. 21 | Derecho de oposicion | Oposicion a procesamiento por IA, a notificaciones |
| Art. 22 | Decisiones automatizadas | ClinicalReviewDraft = validacion humana (cumple parcialmente) |
| Art. 25 | Proteccion de datos por diseno y por defecto | Privacy by design en toda la arquitectura |
| Art. 28 | Encargado del tratamiento | DPA con Google (Gemini), Anthropic (Claude), Firebase |
| Art. 32 | Seguridad del tratamiento | Cifrado, control de acceso, Firestore rules |
| Art. 33-34 | Notificacion de brechas | Procedimiento para notificar en 72h |
| Art. 35 | Evaluacion de impacto (DPIA) | Requerida para procesamiento de IA a gran escala |
| Art. 44-49 | Transferencias internacionales | SCCs, Data Privacy Framework para Firebase US |

### Datos especiales bajo GDPR

Los datos de salud de mascotas vinculados a una persona identificable son **datos personales** (Art. 4(1)). No son datos de categoria especial (Art. 9) a menos que revelen informacion sobre la salud del dueno.

---

## Chile — Ley 21.719 {#chile}

Publicada: 13 dic 2024. Vigencia: 1 dic 2026. Reforma integral de Ley 19.628.

### Articulos clave

| Articulo | Tema | Aplicacion en PESSY |
|----------|------|---------------------|
| Art. 3 | Principios: licitud, finalidad, proporcionalidad, calidad, responsabilidad, seguridad, transparencia, confidencialidad | Todos los flujos |
| Art. 4 | Licitud del tratamiento | Base legal para cada procesamiento |
| Art. 5 | Consentimiento | Libre, informado, especifico, inequivoco. Verificable. Retirable |
| Art. 8-8 quater | Derechos ARCO + portabilidad | Acceso, rectificacion, supresion, oposicion, portabilidad |
| Art. 10 | Forma de ejercer derechos | Gratuito, sin formalismos excesivos |
| Art. 13-14 | Datos sensibles | Requiere consentimiento expreso. Datos de salud son sensibles |
| Art. 16 | Transferencia internacional | Solo a paises con nivel adecuado o con garantias |
| Art. 25 | Encargado del tratamiento | Contrato obligatorio con procesadores (Google, Anthropic) |
| Art. 30 | Evaluacion de impacto | Para tratamientos a gran escala |
| Art. 34-35 | Agencia de Proteccion de Datos | Entidad fiscalizadora |
| Art. 38-40 | Infracciones y sanciones | Leves (5.000 UTM), graves (10.000 UTM), gravisimas (20.000 UTM) |

### Nota importante

Aunque la vigencia es dic 2026, es recomendable disenar cumplimiento ahora porque la adaptacion toma tiempo y la ley es retroactiva para datos ya recolectados.

---

## Argentina — Ley 25.326 {#argentina}

Vigente desde 2000. Reforma en tramite legislativo (2025).

### Articulos clave (ley actual)

| Articulo | Tema | Aplicacion en PESSY |
|----------|------|---------------------|
| Art. 2 | Definiciones: dato personal, dato sensible, titular, responsable | Clasificacion de datos |
| Art. 3 | Archivos de datos — finalidad | Cada coleccion Firestore debe tener finalidad |
| Art. 4 | Calidad de los datos | Datos ciertos, adecuados, pertinentes, no excesivos |
| Art. 5 | Consentimiento | Libre, expreso, informado. Por escrito para datos sensibles |
| Art. 6 | Informacion al titular | Finalidad, destinatarios, consecuencias de no dar datos |
| Art. 7 | Datos sensibles | Salud, origen racial/etnico. Consentimiento expreso |
| Art. 14 | Derecho de acceso | Gratuito, intervalos de 6 meses |
| Art. 16 | Derecho de rectificacion y supresion | 5 dias habiles para cumplir |
| Art. 12 | Transferencia internacional | Solo a paises con nivel adecuado (o excepciones) |
| Art. 25 | Control | AAIP (Agencia de Acceso a la Informacion Publica) |

### Reforma pendiente (2025)

Los proyectos de ley agregan:
- **Portabilidad** de datos
- **Responsabilidad proactiva y demostrada** (accountability)
- **Privacidad por diseno y por defecto**
- **Datos biometricos** como nuevos datos sensibles
- **Oposicion a decisiones automatizadas** que produzcan efectos juridicos
- Periodo de adaptacion: solo 6 meses

---

## Mexico — LFPDPPP 2025 {#mexico}

Nueva Ley Federal vigente desde 21 marzo 2025. Reemplaza LFPDPPP 2010.

### Articulos clave

| Articulo | Tema | Aplicacion en PESSY |
|----------|------|---------------------|
| Art. 8 | Consentimiento | Libre, especifico, informado. Tacito o expreso |
| Art. 9 | Datos sensibles | Consentimiento expreso y escrito. Salud = dato sensible |
| Art. 15-16 | Aviso de privacidad | Obligatorio ANTES de recolectar. Contenido minimo extenso |
| Art. 22 | Consentimiento tacito | Aviso puesto a disposicion + no oposicion |
| Art. 28-29 | Derechos ARCO | Acceso, rectificacion, cancelacion, oposicion |
| Art. 36-37 | Transferencias | Consentimiento + informar destinatario y finalidad |
| Art. 44 | Encargado | Contrato con clausulas de confidencialidad y seguridad |
| Art. 63 | Sanciones | Multas de 100 a 320,000 UMAs |

### Requisitos del aviso de privacidad (Art. 16)

El aviso de privacidad de PESSY debe contener:
1. Identidad y domicilio del responsable
2. Datos que se recaban
3. Finalidades del tratamiento
4. Opciones para limitar uso o divulgacion
5. Medios para ejercer derechos ARCO
6. Transferencias que se efectuen
7. Procedimiento de notificacion de cambios
8. Consentimiento para datos sensibles (salud de mascotas)

### Autoridad

Desde 2025: Secretaria de Anticorrupcion y Buen Gobierno (reemplazo del INAI disuelto).

---

## Colombia — Ley 1581 de 2012 {#colombia}

Vigente. Complementada por Decreto 1377 de 2013.

### Articulos clave

| Articulo | Tema | Aplicacion en PESSY |
|----------|------|---------------------|
| Art. 3 | Definiciones | Dato personal, dato sensible, tratamiento, responsable, encargado |
| Art. 4 | Principios | Legalidad, finalidad, libertad, veracidad, transparencia, acceso y circulacion restringida, seguridad, confidencialidad |
| Art. 5 | Datos sensibles | Salud, orientacion sexual, biometricos. Prohibido tratamiento SALVO consentimiento explicito |
| Art. 6 | Datos de menores | Tratamiento prohibido salvo que responda al interes superior |
| Art. 8 | Derechos del titular | Conocer, actualizar, rectificar, solicitar prueba de consentimiento, revocar, presentar quejas ante SIC |
| Art. 9 | Autorizacion | Previa, expresa, informada. Puede ser escrita, oral o conducta inequivoca |
| Art. 10 | Casos sin autorizacion | Orden judicial, emergencia medica, tratamiento estadistico (anonimizado) |
| Art. 12 | Deber de informar | Finalidad, derechos, direccion del responsable, caracter facultativo de las respuestas |
| Art. 14-15 | Consultas y reclamos | Consulta: 10 dias habiles + 5 prorroga. Reclamo: 15 dias habiles + 8 prorroga |
| Art. 17-18 | Deberes responsable/encargado | Seguridad, confidencialidad, atencion de consultas |
| Art. 25 | Registro Nacional de Bases de Datos | Obligatorio inscribir bases en el RNBD de la SIC |
| Art. 26 | Transferencia internacional | Solo a paises con nivel adecuado o con contrato |

### Registro Nacional de Bases de Datos (RNBD)

Si PESSY opera en Colombia, debe registrar sus bases de datos ante la SIC. Esto incluye la base de usuarios, mascotas y eventos medicos.

---

## USA — CCPA y leyes estatales {#usa}

### HIPAA: NO aplica

HIPAA no cubre registros veterinarios. Las mascotas son propiedad legal, no personas protegidas por HIPAA.

### CCPA (California Consumer Privacy Act)

Aplica si PESSY tiene usuarios en California y cumple umbrales de datos:

| Seccion | Tema | Aplicacion en PESSY |
|---------|------|---------------------|
| 1798.100 | Derecho a saber | Que datos se recolectan y con que proposito |
| 1798.105 | Derecho a eliminar | Equivalente a deleteAccountPermanently() |
| 1798.110 | Acceso a datos | Que categorias de datos, fuentes, propositos |
| 1798.115 | Venta de datos | PESSY no vende datos — pero debe declararlo |
| 1798.120 | Opt-out de venta | Banner "Do Not Sell" si aplica |
| 1798.125 | No discriminacion | No degradar servicio por ejercer derechos |
| 1798.130 | Respuesta a solicitudes | 45 dias para responder |

### Leyes veterinarias estatales

35 estados tienen estatutos de confidencialidad veterinaria. Los mas relevantes:

- **California**: Business and Professions Code Sec. 4857 — prohibe divulgar informacion del paciente animal sin consentimiento escrito u oral presenciado
- **Retencion**: La mayoria requiere 3-4 anos desde la ultima visita
- **Propiedad**: En la mayoria de estados, el veterinario es dueno del registro; el cliente tiene derecho a copia

---

## EU AI Act {#eu-ai-act}

### Clasificacion del sistema de IA de PESSY

El pipeline de analisis de documentos medicos de PESSY probablemente clasifica como **sistema de IA de riesgo limitado** bajo el EU AI Act, porque asiste en decisiones pero no las toma automaticamente (hay review humano via ClinicalReviewDraft).

### Obligaciones aplicables

| Articulo | Tema | Aplicacion en PESSY |
|----------|------|---------------------|
| Art. 4 | Alfabetizacion en IA | Los usuarios deben entender que la IA procesa sus documentos |
| Art. 50 (ex Art. 52) | Transparencia | Informar claramente cuando contenido es generado por IA |
| Art. 53 | GPAI models | Si usa modelos GPAI (Gemini, Claude), los proveedores deben cumplir obligaciones de documentacion |
| Art. 6 + Annex III | Alto riesgo | Si la IA toma decisiones con efectos legales — PESSY no lo hace directamente, pero la frontera es difusa en salud |

### Timeline

- Feb 2025: Practicas prohibidas + alfabetizacion IA (vigente)
- Ago 2025: Obligaciones para modelos GPAI (vigente)
- Ago 2026: Sistemas de alto riesgo
- Ago 2027: Productos regulados

### Que debe hacer PESSY

1. Informar al usuario que la IA procesa documentos (Art. 50 transparencia)
2. Marcar contenido generado por IA como tal (aiGeneratedSummary, extractedData)
3. Mantener registro de que modelo proceso que documento
4. Permitir que el usuario revise y corrija resultados de IA (ClinicalReviewDraft)
5. No tomar decisiones automatizadas con efectos significativos sin intervencion humana

---

## Politicas de proveedores de IA {#proveedores-ia}

### Google Gemini API

| Aspecto | Detalle |
|---------|---------|
| Retencion | 55 dias para deteccion de abuso |
| Entrenamiento | NO usa datos de API para entrenar modelos |
| Vertex AI | Ofrece zero data retention (ZDR) |
| DPA | Disponible via Google Cloud Terms of Service |
| Region | Configurable en Vertex AI (elegir EU si hay usuarios EU) |
| Consumer vs API | La version CONSUMER (gemini.google.com) SI puede usar datos para entrenamiento. PESSY debe usar la API, NO la consumer |

### Anthropic Claude API

| Aspecto | Detalle |
|---------|---------|
| Retencion | 7 dias (desde sept 2025, antes era 30) |
| Entrenamiento | NO bajo Commercial Terms |
| ZDR | Disponible como addendum al DPA |
| DPA | Disponible para clientes comerciales |
| Commercial Terms | Aplican a API, Claude for Work, Government, Education |
| Consumer Terms | NO aplicar — la version consumer retiene hasta 5 anos si el usuario opta in |

### Verificaciones criticas

La auditoria debe confirmar:
1. PESSY usa Gemini via Vertex AI (no consumer)
2. PESSY usa Claude via API con Commercial Terms (no consumer)
3. Existe DPA firmado con ambos proveedores
4. Los datos no se envian a endpoints consumer
5. La region de procesamiento esta configurada (idealmente matching la jurisdiccion del usuario)

---

## Datos veterinarios por jurisdiccion {#datos-veterinarios}

### Clasificacion de datos en PESSY

| Tipo de dato | Clasificacion legal | Notas |
|---|---|---|
| Nombre del dueno | Dato personal | Identificable directamente |
| Email del dueno | Dato personal | Identificador electronico |
| Pais del dueno | Dato personal | Puede combinarse para identificar |
| Nombre de la mascota | Dato personal (indirecto) | Vinculado al dueno |
| Historial medico de la mascota | Dato personal del dueno | Vinculado a persona identificable |
| Documentos medicos (fotos/PDFs) | Dato personal + potencialmente sensible | Pueden contener datos del veterinario, clinica, diagnosticos |
| Resultados de IA (extractedData) | Dato personal derivado | Generado a partir de datos personales |
| Peso, raza, edad de mascota | Dato personal (indirecto) | Vinculado al dueno |
| Ubicacion (NearbyVets) | Dato personal sensible | Geolocalizacion en tiempo real |
| Invite codes | Dato personal (indirecto) | Vinculan a relacion entre personas |
| Tokens de autenticacion | Credencial | No es dato personal pero requiere proteccion |

### Retencion recomendada

| Tipo de dato | Retencion minima | Retencion maxima recomendada | Base legal |
|---|---|---|---|
| Registros veterinarios | 3 anos (USA) / 5 anos (EU) | Mientras el usuario tenga cuenta activa | Leyes veterinarias + consentimiento |
| Datos de cuenta | Mientras dure la relacion | 30 dias post-eliminacion para backup | Contrato |
| Documentos originales | Mientras el usuario quiera | A definir en politica | Consentimiento |
| Logs de IA | 7-55 dias (proveedor) | 90 dias locales para auditoria | Interes legitimo |
| Datos de ubicacion | Sesion actual | No persistir | Consentimiento por sesion |
| Invite codes | Hasta uso o expiracion (48h) | 48h | Interes legitimo |
