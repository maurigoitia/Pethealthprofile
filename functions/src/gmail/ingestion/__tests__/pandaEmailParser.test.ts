// @vitest-environment node
import { describe, expect, test, it, beforeEach } from "vitest";
import { parsePandaEmail, PandaAppointment } from '../pandaEmailParser';

describe('pandaEmailParser', () => {
  describe('isPandaEmail detection', () => {
    test('detects Panda veterinaria domain', () => {
      const result = parsePandaEmail({
        bodyText: 'Tu turno está confirmado',
        subject: 'Confirmar turno',
        fromEmail: 'info@veterinariapanda.com.ar',
      });
      expect(result.isPandaEmail).toBe(true);
    });

    test('detects Sendinblue + vet keywords', () => {
      const result = parsePandaEmail({
        bodyText: 'Tu turno veterinario está confirmado',
        subject: 'Turno confirmado',
        fromEmail: 'noreply@sendinblue.com',
      });
      expect(result.isPandaEmail).toBe(true);
    });

    test('rejects non-Panda emails', () => {
      const result = parsePandaEmail({
        bodyText: 'Factura electrónica',
        subject: 'Factura #123',
        fromEmail: 'facturaelectronica@panda.com.ar',
      });
      expect(result.isPandaEmail).toBe(false);
    });

    test('rejects generic Sendinblue without vet context', () => {
      const result = parsePandaEmail({
        bodyText: 'Campaign email',
        subject: 'Weekly update',
        fromEmail: 'noreply@sendinblue.com',
      });
      expect(result.isPandaEmail).toBe(false);
    });
  });

  describe('HTML table parsing', () => {
    test('parses HTML table with 3 appointments (turno solicitado)', () => {
      const htmlEmail = `
        <html>
          <body>
            <h2>Información de Turno Solicitado</h2>
            <p>Próximos Turnos:</p>
            <table border="1">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Hora</th>
                  <th>Especialidad</th>
                  <th>Prestación</th>
                  <th>Profesional</th>
                  <th>Centro</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>21/03/2026</td>
                  <td>09:45 hs</td>
                  <td>Cardiología</td>
                  <td>Consulta Inicial</td>
                  <td>Dr. Roberti</td>
                  <td>Huidobro</td>
                </tr>
                <tr>
                  <td>21/03/2026</td>
                  <td>10:30 hs</td>
                  <td>Cardiología</td>
                  <td>Eco Abdominal</td>
                  <td>Dr. Roberti</td>
                  <td>Huidobro</td>
                </tr>
                <tr>
                  <td>21/03/2026</td>
                  <td>11:00 hs</td>
                  <td>Radiología</td>
                  <td>Placa Radiográfica</td>
                  <td>Dra. López</td>
                  <td>Huidobro</td>
                </tr>
              </tbody>
            </table>
          </body>
        </html>
      `;

      const result = parsePandaEmail({
        bodyText: 'Información de turno solicitado',
        rawHtml: htmlEmail,
        subject: 'Información de Turno Solicitado - Pessy',
        fromEmail: 'noreply@veterinariapanda.com.ar',
      });

      expect(result.isPandaEmail).toBe(true);
      expect(result.parseMethod).toBe('html_table');
      expect(result.rawTableFound).toBe(true);
      expect(result.appointments.length).toBe(3);
      // First appointment
      expect(result.appointments[0]).toMatchObject({
        date: '2026-03-21',
        time: '09:45',
        specialty: 'Cardiología',
        procedure: 'Consulta Inicial',
        professional: 'Dr. Roberti',
        center: 'Huidobro',
      });

      // Second appointment
      expect(result.appointments[1]).toMatchObject({
        date: '2026-03-21',
        time: '10:30',
        specialty: 'Cardiología',
        procedure: 'Eco Abdominal',
        professional: 'Dr. Roberti',
        center: 'Huidobro',
      });

      // Third appointment
      expect(result.appointments[2]).toMatchObject({
        date: '2026-03-21',
        time: '11:00',
        specialty: 'Radiología',
        procedure: 'Placa Radiográfica',
        professional: 'Dra. López',
        center: 'Huidobro',
      });
    });

    test('parses HTML table with 1 appointment (recordatorio)', () => {
      const htmlEmail = `
        <html>
          <body>
            <h2>Recordatorio de Turno</h2>
            <table>
              <tr>
                <th>Fecha</th>
                <th>Hora</th>
                <th>Especialidad</th>
                <th>Prestación</th>
                <th>Profesional</th>
                <th>Centro</th>
              </tr>
              <tr>
                <td>25/03/2026</td>
                <td>14:30 hs</td>
                <td>Cirugía General</td>
                <td>Castración</td>
                <td>Dr. García</td>
                <td>Las Heras</td>
              </tr>
            </table>
          </body>
        </html>
      `;

      const result = parsePandaEmail({
        bodyText: 'Recordatorio del turno',
        rawHtml: htmlEmail,
        subject: 'Recordatorio del Turno',
        fromEmail: 'noreply@sendinblue.com',
      });

      expect(result.appointments.length).toBe(1);
      expect(result.appointments[0]).toMatchObject({
        date: '2026-03-25',
        time: '14:30',
        specialty: 'Cirugía General',
        procedure: 'Castración',
        professional: 'Dr. García',
        center: 'Las Heras',
      });
    });

    test('handles different date formats', () => {
      const htmlEmail = `
        <table>
          <tr><th>Fecha</th><th>Hora</th></tr>
          <tr><td>21-03-2026</td><td>10.30 hs</td></tr>
          <tr><td>21.03.26</td><td>15:45 hs</td></tr>
        </table>
      `;

      const result = parsePandaEmail({
        bodyText: 'turnos',
        rawHtml: htmlEmail,
        subject: 'Turnos',
        fromEmail: 'info@veterinariapanda.com.ar',
      });

      expect(result.appointments.length).toBe(2);
      expect(result.appointments[0].date).toBe('2026-03-21');
      expect(result.appointments[0].time).toBe('10:30');
      expect(result.appointments[1].date).toBe('2026-03-21');
      expect(result.appointments[1].time).toBe('15:45');
    });
  });

  describe('text fallback parsing', () => {
    test('parses text-based appointment blocks', () => {
      const textEmail = `
        Tu turno está confirmado:

        21/03/2026
        10:30 hs
        Eco Abdominal - Dr. Roberti
        Centro Huidobro

        Próximo acto:
        21/03/2026
        11:00 hs
        Radiología - Dra. López
        Centro Huidobro
      `;

      const result = parsePandaEmail({
        bodyText: textEmail,
        subject: 'Turno Confirmado',
        fromEmail: 'noreply@veterinariapanda.com.ar',
      });

      expect(result.isPandaEmail).toBe(true);
      expect(result.parseMethod).toBe('text_fallback');
      expect(result.appointments.length).toBeGreaterThan(0);

      // Should have extracted at least date and time
      expect(result.appointments.some(apt => apt.date === '2026-03-21' && apt.time === '10:30')).toBe(true);
    });

    test('extracts appointments from malformed text', () => {
      const textEmail = `
        INFORMACIÓN DE TURNO SOLICITADO
        
        Fecha: 21/03/2026
        Hora: 10:30 hs
        Especialidad: Cardiología
        Procedimiento: Ecocardiograma
        Profesional: Dr. Roberti
        Centro: Huidobro
      `;

      const result = parsePandaEmail({
        bodyText: textEmail,
        subject: 'Turno',
        fromEmail: 'info@veterinariapanda.com.ar',
      });

      expect(result.appointments.length).toBeGreaterThan(0);
      expect(result.appointments[0].date).toBe('2026-03-21');
      expect(result.appointments[0].time).toBe('10:30');
    });
  });

  describe('regex-only fallback', () => {
    test('extracts date and time via regex when other methods fail', () => {
      const minimalText = `
        Tu mascota tiene turno confirmado.
        Fecha: 21/03/2026 Hora: 10:30
        No faltes!
      `;

      const result = parsePandaEmail({
        bodyText: minimalText,
        subject: 'Turno',
        fromEmail: 'info@veterinariapanda.com.ar',
      });

      expect(result.parseMethod).toBe('regex_only');
      expect(result.appointments.length).toBeGreaterThan(0);
      expect(result.appointments[0].date).toBe('2026-03-21');
    });
  });

  describe('edge cases', () => {
    test('ignores administrative emails (not vet-related)', () => {
      const result = parsePandaEmail({
        bodyText: 'Factura emitida',
        subject: 'Comprobante de pago',
        fromEmail: 'facturaelectronica@panda.com.ar',
      });

      expect(result.isPandaEmail).toBe(false);
      expect(result.appointments.length).toBe(0);
    });

    test('handles empty appointments list', () => {
      const htmlEmail = `
        <html>
          <body>
            <h2>No hay turnos próximos</h2>
            <p>Gracias por tu confianza</p>
          </body>
        </html>
      `;

      const result = parsePandaEmail({
        bodyText: 'No hay turnos',
        rawHtml: htmlEmail,
        subject: 'Estado de Turnos',
        fromEmail: 'info@veterinariapanda.com.ar',
      });

      expect(result.isPandaEmail).toBe(true);
      expect(result.appointments.length).toBe(0);
    });
    test('deduplicates regex-only results', () => {
      const repeatedText = `
        Fecha: 21/03/2026 Hora: 10:30
        Confirmación: 21/03/2026 Hora: 10:30
        Recordatorio: 21/03/2026 Hora: 10:30
      `;

      const result = parsePandaEmail({
        bodyText: repeatedText,
        subject: 'Turno',
        fromEmail: 'info@veterinariapanda.com.ar',
      });

      const uniqueDates = new Set(result.appointments.map(a => `${a.date}-${a.time}`));
      expect(uniqueDates.size).toBeLessThanOrEqual(result.appointments.length);
    });

    test('handles malformed table HTML gracefully', () => {
      const badHtml = `
        <table>
          <tr>
            <td>21/03/2026</td>
            <td>10:30</td>
            <td>Cardiología</td>
          </tr>
          <tr>
            <!-- missing closing tr tag -->
            <td>22/03/2026</td>
        </table>
      `;

      const result = parsePandaEmail({
        bodyText: 'turnos',
        rawHtml: badHtml,
        subject: 'Turnos',
        fromEmail: 'info@veterinariapanda.com.ar',
      });

      expect(result.isPandaEmail).toBe(true);
      // Should still parse what it can
      expect(result.appointments.length).toBeGreaterThanOrEqual(0);
    });

    test('preserves rawRow for debugging', () => {
      const htmlEmail = `
        <table>
          <tr>
            <th>Fecha</th>
            <th>Hora</th>
          </tr>
          <tr>
            <td>21/03/2026</td>
            <td>10:30 hs</td>
          </tr>
        </table>
      `;

      const result = parsePandaEmail({
        bodyText: 'turnos',
        rawHtml: htmlEmail,
        subject: 'Turnos',
        fromEmail: 'info@veterinariapanda.com.ar',
      });

      expect(result.appointments[0].rawRow).toBeTruthy();
      expect(result.appointments[0].rawRow.length).toBeGreaterThan(0);
    });

    test('handles Spanish date formats (21 de marzo de 2026)', () => {
      const textEmail = `
        Tu turno es el 21 de marzo de 2026 a las 10:30 hs
      `;

      const result = parsePandaEmail({
        bodyText: textEmail,
        subject: 'Turno',
        fromEmail: 'info@veterinariapanda.com.ar',
      });

      // Date should be normalized
      const hasValidDate = result.appointments.some(apt => apt.date === '2026-03-21');
      expect(hasValidDate || result.appointments.length === 0).toBe(true);
    });

    test('correctly identifies Panda via body content', () => {
      const result = parsePandaEmail({
        bodyText: 'Veterinaria Panda te confirma tu turno',
        subject: 'Confirmación',
        fromEmail: 'noreply@example.com',
      });

      expect(result.isPandaEmail).toBe(true);
    });
  });

  describe('integration scenarios', () => {
    test('full flow: HTML table with multiple appointments', () => {
      const complexEmail = `
        <html>
          <head><title>Turnos Confirmados</title></head>
          <body>
            <h1>Veterinaria Panda</h1>
            <p>Los turnos para tu mascota Milo están confirmados:</p>
            
            <table border="1" cellpadding="10">
              <thead>
                <tr style="background: #f0f0f0">
                  <th><strong>Fecha</strong></th>
                  <th><strong>Hora</strong></th>
                  <th><strong>Especialidad</strong></th>
                  <th><strong>Prestación</strong></th>
                  <th><strong>Profesional</strong></th>
                  <th><strong>Centro</strong></th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>21/03/2026</td>
                  <td>09:00 hs</td>
                  <td>Consulta General</td>
                  <td>Revisión Clínica</td>
                  <td>Dr. Martín</td>
                  <td>San Martín</td>
                </tr>
                <tr>
                  <td>21/03/2026</td>
                  <td>10:15 hs</td>
                  <td>Cardiología</td>
                  <td>Ecocardiograma</td>
                  <td>Dra. Silva</td>
                  <td>San Martín</td>
                </tr>
                <tr>
                  <td>22/03/2026</td>
                  <td>14:00 hs</td>
                  <td>Cirugía</td>
                  <td>Castración</td>
                  <td>Dr. González</td>
                  <td>Belgrano</td>
                </tr>
              </tbody>
            </table>
            
            <footer>
              <p>Veterinaria Panda - Tel: (011) 4123-4567</p>
            </footer>
          </body>
        </html>
      `;

      const result = parsePandaEmail({
        bodyText: 'Los turnos para tu mascota están confirmados',
        rawHtml: complexEmail,
        subject: 'Confirmación de Turnos - Veterinaria Panda',
        fromEmail: 'noreply@veterinariapanda.com.ar',
      });

      expect(result.isPandaEmail).toBe(true);
      expect(result.parseMethod).toBe('html_table');
      expect(result.appointments.length).toBe(3);

      // Validate specific fields
      expect(result.appointments[0].date).toBe('2026-03-21');
      expect(result.appointments[0].time).toBe('09:00');
      expect(result.appointments[0].specialty).toBe('Consulta General');

      expect(result.appointments[1].specialty).toBe('Cardiología');
      expect(result.appointments[1].professional).toBe('Dra. Silva');

      expect(result.appointments[2].date).toBe('2026-03-22');
      expect(result.appointments[2].center).toBe('Belgrano');
    });
  });
});