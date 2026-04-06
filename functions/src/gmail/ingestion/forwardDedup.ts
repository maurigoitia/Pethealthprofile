import { sha256, normalizeForHash, asString } from "./utils";

/**
 * Resultado de la detección de un email forwardeado
 */
export interface ForwardDetectionResult {
  isForward: boolean;
  forwardDepth: number; // 0=original, 1=Fwd, 2=Fwd: Fwd, etc.
  originalSubject: string | null; // subject sin "Fwd: " prefijos
  originalSender: string | null; // From: del email original dentro del body
  originalDate: string | null; // fecha del email original
  forwardChain: string[]; // ["Fwd: ...", "FW: ..."] si hay cadena
}

/**
 * Resultado de la deduplicación de forwards
 */
export interface ForwardDedupResult {
  isDuplicate: boolean;
  reason: string | null;
  canonicalHash: string; // hash del contenido clínico normalizado
  originalEmailId: string | null; // ID del email original si se puede determinar
}

/**
 * Patrones para detectar prefijos de forward en el subject
 */
const FORWARD_PREFIX_PATTERNS = [
  /^Fwd:\s*/i, // Gmail estándar
  /^FW:\s*/i, // Outlook
  /^Reenv[íi]o?:\s*/i, // español (Reenvío, Reenvio)
  /^RV:\s*/i, // Outlook español
  /^TR:\s*/i, // francés, algunos sistemas
];

/**
 * Patrones para detectar headers de forward dentro del body
 */
const FORWARD_BODY_PATTERNS = [
  /---------- Forwarded message ---------/i,
  /-------- Original Message --------/i,
  /^De:\s+[\w.+-]+@[\w.-]+\.[a-z]{2,}/m,
  /^From:\s+[\w.+-]+@[\w.-]+\.[a-z]{2,}/m,
  /^Fecha:\s*\d{1,2}\/\d{1,2}\/\d{4}/m,
  /^Date:\s*\w+,\s*\d{1,2}\s+\w+\s+\d{4}/m,
];

/**
 * Detecta si un email es un forward y extrae información sobre la cadena
 */
export function detectForward(input: {
  subject: string;
  bodyText: string;
  fromEmail: string;
}): ForwardDetectionResult {
  const subject = asString(input.subject);
  const bodyText = asString(input.bodyText);

  // Detectar prefijos de forward en el subject
  let isForward = false;
  let forwardDepth = 0;
  let workingSubject = subject;
  const forwardChain: string[] = [];

  // Contar y extraer prefijos
  while (true) {
    let matched = false;
    for (const pattern of FORWARD_PREFIX_PATTERNS) {
      const match = workingSubject.match(pattern);
      if (match) {
        isForward = true;
        forwardDepth += 1;
        forwardChain.push(match[0].trim());
        workingSubject = workingSubject.slice(match[0].length);
        matched = true;
        break;
      }
    }
    if (!matched) break;
  }

  const originalSubject = isForward ? workingSubject.trim() : null;

  // Detectar sender original en el body
  let originalSender: string | null = null;
  if (isForward || hasForwardBodyMarkers(bodyText)) {
    originalSender = extractOriginalSenderFromBody(bodyText);
  }

  // Detectar fecha original en el body
  let originalDate: string | null = null;
  if (isForward || hasForwardBodyMarkers(bodyText)) {
    originalDate = extractOriginalDateFromBody(bodyText);
  }

  return {
    isForward: isForward || hasForwardBodyMarkers(bodyText),
    forwardDepth,
    originalSubject,
    originalSender,
    originalDate,
    forwardChain,
  };
}

/**
 * Verifica si el body contiene marcadores de forward
 */
function hasForwardBodyMarkers(bodyText: string): boolean {
  for (const pattern of FORWARD_BODY_PATTERNS) {
    if (pattern.test(bodyText)) {
      return true;
    }
  }
  return false;
}

/**
 * Extrae el email del remitente original del body forwardeado
 */
function extractOriginalSenderFromBody(bodyText: string): string | null {
  // Busca "De: email" o "From: email" en líneas separadas
  const patterns = [
    /^De:\s*([\w.+-]+@[\w.-]+\.[a-z]{2,})/m,
    /^From:\s*([\w.+-]+@[\w.-]+\.[a-z]{2,})/m,
  ];

  for (const pattern of patterns) {
    const match = bodyText.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return null;
}

/**
 * Extrae la fecha original del body forwardeado
 */
function extractOriginalDateFromBody(bodyText: string): string | null {
  const patterns = [
    /^Fecha:\s*(.+?)$/m,
    /^Date:\s*(.+?)$/m,
  ];

  for (const pattern of patterns) {
    const match = bodyText.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  return null;
}

/**
 * Normaliza y limpia el body de un email forwardeado
 * Elimina los headers del forward para quedarse solo con el contenido clínico
 */
export function stripForwardHeaders(bodyText: string): string {
  let text = asString(bodyText);

  // Eliminar las líneas delimitadoras de forward
  text = text.replace(/---------- Forwarded message ---------[\s\S]*?(?=De:|From:|$)/i, "");
  text = text.replace(/-------- Original Message --------[\s\S]*?(?=De:|From:|$)/i, "");

  // Dividir por líneas y procesar
  const lines = text.split("\n");
  const contentLines: string[] = [];
  let inForwardHeader = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Detectar inicio del bloque de headers de forward
    if (/^De:\s+/i.test(trimmed) || /^From:\s+/i.test(trimmed)) {
      inForwardHeader = true;
      continue;
    }

    // Detectar otras líneas de header de forward
    if (inForwardHeader) {
      if (
        /^Para:\s+/i.test(trimmed) ||
        /^To:\s+/i.test(trimmed) ||
        /^Fecha:\s+/i.test(trimmed) ||
        /^Date:\s+/i.test(trimmed) ||
        /^Asunto:\s+/i.test(trimmed) ||
        /^Subject:\s+/i.test(trimmed)
      ) {
        // Continuamos en el bloque de header
        continue;
      }

      // Si encontramos una línea que no es header, salimos del bloque
      if (trimmed && !/^(De:|From:|Para:|To:|Fecha:|Date:|Asunto:|Subject:)/i.test(trimmed)) {
        inForwardHeader = false;
      } else {
        continue;
      }
    }

    // Agregar al contenido clínico
    if (!inForwardHeader) {
      contentLines.push(line);
    }
  }

  // Limpiar espacios en blanco extras
  return contentLines
    .join("\n")
    .replace(/\n\n\n+/g, "\n\n")
    .trim();
}

/**
 * Calcula el hash del contenido clínico normalizado
 * Este hash debe ser igual para un email original y su forward si el contenido es igual
 */
export function computeContentHash(input: {
  subject: string;
  bodyText: string;
  senderDomain: string;
}): string {
  const subject = normalizeForHash(asString(input.subject));
  const bodyNormalized = normalizeForHash(asString(input.bodyText));
  const domain = normalizeForHash(asString(input.senderDomain));

  // Normalizar el subject: remover prefijos de forward
  let cleanSubject = subject;
  for (const pattern of FORWARD_PREFIX_PATTERNS) {
    cleanSubject = cleanSubject.replace(pattern, "").trim();
  }

  // Combinar: subject normalizado + body normalizado + domain
  const combined = `${cleanSubject}|${bodyNormalized}|${domain}`;

  return sha256(combined);
}


/**
 * Strips forward headers aggressively using regex (handles single-line bodies).
 * Strategy:
 * 1. Strip the delimiter
 * 2. Strip De:/From: (email address is unambiguous boundary)
 * 3. Find the clinical content start = everything AFTER the last standard email header
 */
function aggressiveStripForward(body: string): string {
  // Remove delimiter blocks
  let result = body
    .replace(/Forwarded message/gi, " ")
    .replace(/Original Message/gi, " ")
    .replace(/\-{5,}\s*\-{5,}/gi, " ");

  // Remove De:/From: email address field (unambiguous — stops at next non-email char)
  result = result.replace(/(?:De|From):\s+[\w.+\-]+@[\w.-]+\.[a-z]{2,}/gi, " ");

  // For remaining header fields (Fecha/Date, Asunto/Subject, Para/To),
  // only remove them if they appear BEFORE any clinical content.
  // Key insight: find the last known email-header-label and take everything after its value.
  // "Asunto: XYZ" — value ends when we hit the next capital word that isn't a field name.
  const clinicalStart = findClinicalContentStart(result);
  if (clinicalStart !== null) {
    result = result.slice(clinicalStart);
  } else {
    // Fallback: remove header lines/segments the old way (multiline-safe)
    result = result
      .replace(/(?:Para|To):\s+[^\n]*/gi, " ")

      .replace(/(?:Fecha|Date):\s+[^\n]*/gi, " ")

      .replace(/(?:Asunto|Subject):\s+[^\n]*/gi, " ");

  }

  return result.replace(/\s+/g, " ").trim();
}

/**
 * Finds where clinical content starts after forward headers.
 * Returns the character index in text, or null if unclear.
 */
function findClinicalContentStart(text: string): number | null {
  // Standard email header labels (not clinical)
  const emailHeaderPattern = /(?:Para|To|Fecha|Date|Asunto|Subject):\s*(\S+)/gi;
  let lastMatch: RegExpExecArray | null = null;
  let m: RegExpExecArray | null;
  while ((m = emailHeaderPattern.exec(text)) !== null) {
    lastMatch = m;
  }
  if (lastMatch) {
    // Clinical content starts right after the last header's value
    return lastMatch.index + lastMatch[0].length;
  }
  return null;
}

/**
 * Verifica si un email es un duplicate de un forward (o viceversa)
 * Basado en el hash del contenido clínico normalizado
 */
export function checkForwardDedup(args: {
  currentEmail: {
    messageId: string;
    subject: string;
    bodyText: string;
    fromEmail: string;
    date: string;
  };
  recentHashes: Map<string, string>; // hash -> messageId, ventana de 30 días
}): ForwardDedupResult {
  const currentEmail = args.currentEmail;
  const recentHashes = args.recentHashes;

  // Detectar si es forward
  const detection = detectForward({
    subject: currentEmail.subject,
    bodyText: currentEmail.bodyText,
    fromEmail: currentEmail.fromEmail,
  });

  // Normalizar subject y body
  let normalizedSubject = currentEmail.subject;
  let normalizedBody = currentEmail.bodyText;
  let senderDomain = currentEmail.fromEmail.split("@")[1] || "";

  if (detection.isForward) {
    // Si es forward, usar el subject original
    normalizedSubject = detection.originalSubject || currentEmail.subject;
    // Strip agresivo: funciona incluso si los headers van en una sola linea
    normalizedBody = aggressiveStripForward(currentEmail.bodyText);
    // Intentar extraer el dominio del remitente ORIGINAL del body
    const originalSenderMatch = currentEmail.bodyText.match(
      /(?:De|From):\s+[\w.+\-]+@([\w.-]+\.[a-z]{2,})/i
    );
    if (originalSenderMatch) {
      senderDomain = originalSenderMatch[1];
    }
  }

  // Computar el hash canónico
  const canonicalHash = computeContentHash({
    subject: normalizedSubject,
    bodyText: normalizedBody,
    senderDomain,
  });

  // Verificar si el hash ya existe
  const existingMessageId = recentHashes.get(canonicalHash);

  if (existingMessageId) {
    return {
      isDuplicate: true,
      reason: `Duplicate of message ${existingMessageId}`,
      canonicalHash,
      originalEmailId: existingMessageId,
    };
  }

  return {
    isDuplicate: false,
    reason: null,
    canonicalHash,
    originalEmailId: null,
  };
}
