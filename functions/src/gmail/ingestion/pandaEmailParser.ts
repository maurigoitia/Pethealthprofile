/**
 * Panda Veterinaria Email Parser
 * 
 * Parses emails from Panda Veterinaria (veterinariapanda.com.ar) containing
 * appointment tables in HTML format. Handles multiple appointments per email
 * with fallback strategies for text-only parsing.
 */

export interface PandaAppointment {
  date: string | null;          // ISO "2026-03-21"
  time: string | null;          // "10:30"
  specialty: string | null;     // "Cardiología"
  procedure: string | null;     // "Eco Abdominal"
  professional: string | null;  // "Dr. Roberti"
  center: string | null;        // "Huidobro"
  rawRow: string;               // texto crudo de la fila para debugging
}

export interface PandaParseResult {
  appointments: PandaAppointment[];
  parseMethod: 'html_table' | 'text_fallback' | 'regex_only';
  isPandaEmail: boolean;
  rawTableFound: boolean;
}

// Month mapping for Spanish dates
const SPANISH_MONTHS: { [key: string]: string } = {
  enero: '01',
  febrero: '02',
  marzo: '03',
  abril: '04',
  mayo: '05',
  junio: '06',
  julio: '07',
  agosto: '08',
  septiembre: '09',
  setiembre: '09',
  octubre: '10',
  noviembre: '11',
  diciembre: '12',
};

/**
 * Normalizes date from various Spanish formats to ISO "YYYY-MM-DD"
 */
function normalizeDate(dateStr: string): string | null {
  if (!dateStr) return null;

  const cleaned = dateStr.trim();

  // Try format: "21/03/2026" or "21/03/26"
  const dmyRegex = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/;
  const dmyMatch = cleaned.match(dmyRegex);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    let year = dmyMatch[3];

    // Handle 2-digit years (assume 2000s for 00-50, otherwise 1900s)
    if (year.length === 2) {
      const yearNum = parseInt(year);
      year = (yearNum <= 50 ? '20' : '19') + year;
    }

    return `${year}-${month}-${day}`;
  }

  // Try format: "21 de marzo de 2026"
  const textRegex = /^(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})$/i;
  const textMatch = cleaned.match(textRegex);
  if (textMatch) {
    const day = textMatch[1].padStart(2, '0');
    const monthName = textMatch[2].toLowerCase();
    const month = SPANISH_MONTHS[monthName];
    const year = textMatch[3];

    if (month) {
      return `${year}-${month}-${day}`;
    }
  }

  return null;
}

/**
 * Normalizes time from various formats to "HH:MM"
 */
function normalizeTime(timeStr: string): string | null {
  if (!timeStr) return null;

  const cleaned = timeStr.trim();

  // Remove "hs" suffix and normalize separators
  const normalized = cleaned.replace(/\s*hs\s*/i, '').replace(/\./, ':');

  // Match "HH:MM" or "H:MM"
  const timeRegex = /^(\d{1,2}):(\d{2})$/;
  const match = normalized.match(timeRegex);

  if (match) {
    const hour = match[1].padStart(2, '0');
    const minute = match[2];
    return `${hour}:${minute}`;
  }

  return null;
}
/**
 * Extracts text content from HTML string
 */
function stripHtmlTags(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parses HTML table to extract appointments
 */
function parseHtmlTable(html: string): PandaAppointment[] {
  const appointments: PandaAppointment[] = [];

  // Find table tags (case-insensitive)
  const tableRegex = /<table[^>]*>[\s\S]*?<\/table>/gi;
  const tables = html.match(tableRegex) || [];

  for (const table of tables) {
    // Check if this table contains the expected headers
    const headerRegex = /(?:fecha|hora|especialidad|prestación|profesional|centro)/i;
    if (!headerRegex.test(table)) {
      continue;
    }

    // Extract all rows
    const rowRegex = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
    const rows = table.match(rowRegex) || [];

    for (const row of rows) {
      // Extract cells
      const cellRegex = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
      const cells: string[] = [];

      let cellMatch;
      while ((cellMatch = cellRegex.exec(row)) !== null) {
        const cellContent = stripHtmlTags(cellMatch[1]).trim();
        cells.push(cellContent);
      }

      // Skip header rows and empty rows
      if (cells.length === 0 || cells.every(c => !c)) {
        continue;
      }

      // Skip if row looks like a header (contains "fecha" or similar)
      if (cells.some(c => /^(fecha|hora|especialidad|prestación|profesional|centro)$/i.test(c))) {
        continue;
      }

      // Try to map cells to appointment fields
      // Expected: [fecha, hora, especialidad, prestación, profesional, centro]
      const appointment: PandaAppointment = {
        date: cells.length > 0 ? normalizeDate(cells[0]) : null,
        time: cells.length > 1 ? normalizeTime(cells[1]) : null,
        specialty: cells.length > 2 ? cells[2] || null : null,
        procedure: cells.length > 3 ? cells[3] || null : null,
        professional: cells.length > 4 ? cells[4] || null : null,
        center: cells.length > 5 ? cells[5] || null : null,
        rawRow: row,
      };

      // Only include if at least one field is populated
      if (appointment.date || appointment.time || appointment.specialty || appointment.procedure) {
        appointments.push(appointment);
      }
    }
  }

  return appointments;
}

/**
 * Parses text-based appointments from plain text.
 * Handles two formats:
 * 1. Key-value: "Fecha: 21/03/2026\nHora: 10:30 hs\nEspecialidad: Cardiología..."
 * 2. Sequential lines: "21/03/2026\n10:30 hs\nEco Abdominal - Dr. Roberti\nCentro Huidobro"
 */
function parseTextFallback(text: string): PandaAppointment[] {
  const appointments: PandaAppointment[] = [];

  // Normalize: split into clean lines, remove empty ones
  const allLines = text.split(/\n/).map(l => l.trim()).filter(l => l.length > 0);

  // ── Strategy 1: Key-value format (Fecha:, Hora:, Especialidad:, etc.) ──────
  const kvAppointments = parseKeyValueFormat(allLines);
  if (kvAppointments.length > 0) return kvAppointments;

  // ── Strategy 2: Group consecutive date+time+procedure lines ─────────────
  return parseSequentialLines(allLines);
}

function parseKeyValueFormat(lines: string[]): PandaAppointment[] {
  const appointments: PandaAppointment[] = [];
  let current: Partial<PandaAppointment> & { rawRow: string } | null = null;

  for (const line of lines) {
    // Detect key-value pairs like "Fecha: 21/03/2026"
    const kvMatch = line.match(/^(fecha|hora|especialidad|prestaci[oó]n|profesional|centro|procedimiento)[:\s]+(.+)$/i);
    if (kvMatch) {
      if (!current) {
        current = { date: null, time: null, specialty: null, procedure: null, professional: null, center: null, rawRow: line };
      } else {
        current.rawRow += ' | ' + line;
      }
      const key = kvMatch[1].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const val = kvMatch[2].trim();
      switch (key) {
        case 'fecha': current.date = normalizeDate(val); break;
        case 'hora': current.time = normalizeTime(val); break;
        case 'especialidad': current.specialty = val; break;
        case 'prestacion': case 'procedimiento': current.procedure = val; break;
        case 'profesional': current.professional = val; break;
        case 'centro': current.center = val; break;
      }
    } else if (current && (current.date || current.time)) {
      // Non-kv line after we started collecting — push and reset
      if (current.date || current.time || current.specialty || current.procedure) {
        appointments.push(current as PandaAppointment);
      }
      current = null;
    }
  }
  if (current && (current.date || current.time || current.specialty || current.procedure)) {
    appointments.push(current as PandaAppointment);
  }
  return appointments;
}

function parseSequentialLines(lines: string[]): PandaAppointment[] {
  const appointments: PandaAppointment[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const date = normalizeDate(line);

    if (date) {
      // Found a date — try to collect the following lines as one appointment
      let time: string | null = null;
      let specialty: string | null = null;
      let procedure: string | null = null;
      let professional: string | null = null;
      let center: string | null = null;
      const rawParts: string[] = [line];
      let j = i + 1;

      while (j < lines.length && j < i + 6) {
        const next = lines[j];
        // Stop if we hit another date (new appointment block)
        if (normalizeDate(next)) break;

        if (!time) {
          const t = normalizeTime(next);
          if (t) { time = t; rawParts.push(next); j++; continue; }
        }
        if (!center && /centro|sucursal|sede|huidobro/i.test(next)) {
          center = next; rawParts.push(next); j++; continue;
        }
        if (!specialty && /cardiolog[ií]a|ortopedia|traumatolog[ií]a|dermatolog[ií]a|oftalmolog[ií]a|medicina general|radiolog[ií]a/i.test(next)) {
          specialty = next; rawParts.push(next); j++; continue;
        }
        if (!procedure && !professional) {
          const procMatch = next.match(/^([^-]+?)\s*-\s*(.+)$/);
          if (procMatch) {
            procedure = procMatch[1].trim() || null;
            professional = procMatch[2].trim() || null;
          } else if (/eco|radiograf[ií]a|placa|ecocardiograma|análisis|examen|consulta/i.test(next)) {
            procedure = next;
          }
          rawParts.push(next); j++; continue;
        }
        break;
      }

      appointments.push({ date, time, specialty, procedure, professional, center, rawRow: rawParts.join(' | ') });
      i = j;
    } else {
      i++;
    }
  }

  return appointments;
}

/**
 * Parses appointments using regex only on plain text
 * Fallback when table and text parsing fail
 */
function parseRegexOnly(text: string): PandaAppointment[] {
  const appointments: PandaAppointment[] = [];

  // Look for date patterns
  const dateRegex = /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/g;
  const dates = text.match(dateRegex) || [];

  for (const dateStr of dates) {
    const normalizedDate = normalizeDate(dateStr);
    if (normalizedDate) {
      // Try to find time near this date
      const dateIndex = text.indexOf(dateStr);
      const nearbyText = text.substring(dateIndex, dateIndex + 200);

      const timeMatch = nearbyText.match(/(\d{1,2}[:.]\d{2})\s*(?:hs)?/);
      const time = timeMatch ? normalizeTime(timeMatch[1]) : null;

      appointments.push({
        date: normalizedDate,
        time,
        specialty: null,
        procedure: null,
        professional: null,
        center: null,
        rawRow: nearbyText.substring(0, 100),
      });
    }
  }

  // Deduplicate by date+time
  const seen = new Set<string>();
  return appointments.filter(apt => {
    const key = `${apt.date}-${apt.time}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Detects if email is from Panda Veterinaria
 */
function isPandaEmail(fromEmail: string, subject: string, bodyText: string): boolean {
  const fromLower = fromEmail.toLowerCase();
  const subjectLower = subject.toLowerCase();
  const bodyLower = bodyText.toLowerCase();

  // Check sender domain
  if (fromLower.includes('veterinariapanda.com.ar') || (fromLower.includes('panda.com.ar') && !fromLower.startsWith('facturaelectronica@'))) {
    return true;
  }

  // Check for Sendinblue + veterinary keywords
  if (fromLower.includes('sendinblue') || fromLower.includes('brevo')) {
    const vetKeywords = ['veterinaria', 'turno', 'cita', 'appointment', 'panda'];
    if (vetKeywords.some(kw => subjectLower.includes(kw) || bodyLower.includes(kw))) {
      return true;
    }
  }

  // Check body for Panda-specific markers
  if (bodyLower.includes('veterinaria panda') || bodyLower.includes('panda veterinaria')) {
    return true;
  }

  return false;
}

/**
 * Main parser function
 */
export function parsePandaEmail(input: {
  bodyText: string;
  rawHtml?: string;
  subject: string;
  fromEmail: string;
}): PandaParseResult {
  const { bodyText, rawHtml, subject, fromEmail } = input;

  // Step 1: Check if this is a Panda email
  const isPanda = isPandaEmail(fromEmail, subject, bodyText);

  if (!isPanda) {
    return {
      appointments: [],
      parseMethod: 'html_table',
      isPandaEmail: false,
      rawTableFound: false,
    };
  }

  // Step 2: Try HTML table parsing if HTML is available
  if (rawHtml) {
    const htmlAppointments = parseHtmlTable(rawHtml);
    if (htmlAppointments.length > 0) {
      return {
        appointments: htmlAppointments,
        parseMethod: 'html_table',
        isPandaEmail: true,
        rawTableFound: true,
      };
    }
  }

  // Step 3: Try text fallback parsing
  const textAppointments = parseTextFallback(bodyText);
  if (textAppointments.length > 0) {
    return {
      appointments: textAppointments,
      parseMethod: 'text_fallback',
      isPandaEmail: true,
      rawTableFound: false,
    };
  }

  // Step 4: Regex-only fallback
  const regexAppointments = parseRegexOnly(bodyText);
  return {
    appointments: regexAppointments,
    parseMethod: 'regex_only',
    isPandaEmail: true,
    rawTableFound: false,
  };
}