// @vitest-environment node
import { describe, expect, test, it, beforeEach } from "vitest";
import { classifyEmail, EmailClassType } from "../emailClassifier";

describe("emailClassifier", () => {
  test("recordatorio de turno de Panda → APPOINTMENT_REMINDER", () => {
    const result = classifyEmail({
      subject: "Recordatorio del Turno",
      fromEmail: "turnos@veterinariapanda.com.ar",
      bodyText: "Te recordamos tu turno programado para mañana.",
      attachmentFilenames: [],
    });
    expect(result.type).toBe(EmailClassType.APPOINTMENT_REMINDER);
    expect(result.confidence).toBeGreaterThanOrEqual(88);
    expect(result.isForwarded).toBe(false);
  });

  test("comprobante de pago facturaelectronica@panda → ADMINISTRATIVE", () => {
    const result = classifyEmail({
      subject: "Comprobante de Pago #12345",
      fromEmail: "facturaelectronica@veterinariapanda.com.ar",
      bodyText: "Adjuntamos el comprobante de pago de su consulta.",
      attachmentFilenames: ["factura_12345.pdf"],
    });
    expect(result.type).toBe(EmailClassType.ADMINISTRATIVE);
    expect(result.confidence).toBe(100);
  });

  test("forward de turno vet → APPOINTMENT_CONFIRMATION + isForwarded=true", () => {
    const result = classifyEmail({
      subject: "Fwd: Información de Turno Solicitado",
      fromEmail: "dueño@gmail.com",
      bodyText: "tu turno ha sido confirmado para el próximo martes.",
      attachmentFilenames: [],
    });
    expect(result.isForwarded).toBe(true);
    expect(result.type).toBe(EmailClassType.APPOINTMENT_CONFIRMATION);
  });

  test("email de OSDE → HUMAN_MEDICAL con confidence 100", () => {
    const result = classifyEmail({
      subject: "Su autorización médica",
      fromEmail: "notificaciones@osde.com.ar",
      bodyText: "Estimado afiliado, su autorización fue aprobada.",
      attachmentFilenames: [],
    });
    expect(result.type).toBe(EmailClassType.HUMAN_MEDICAL);
    expect(result.confidence).toBe(100);
  });

  test("email con keyword 'obra social' → HUMAN_MEDICAL", () => {
    const result = classifyEmail({
      subject: "Información de obra social",
      fromEmail: "info@prepaga.com.ar",
      bodyText: "Su obra social cubre el procedimiento solicitado.",
      attachmentFilenames: [],
    });
    expect(result.type).toBe(EmailClassType.HUMAN_MEDICAL);
  });

  test("eco de Thor (body vacío + adjunto THOR.pdf) → CLINICAL_REPORT", () => {
    const result = classifyEmail({
      subject: "ECO DE THOR",
      fromEmail: "lvdiazz@yahoo.com.ar",
      bodyText: "",
      attachmentFilenames: ["THOR.pdf", "eco_01.jpg", "eco_02.jpg"],
    });
    expect(result.type).toBe(EmailClassType.CLINICAL_REPORT);
    expect(result.signals.some((s) => s.startsWith("clinical_attachment"))).toBe(true);
  });

  test("información de turno solicitado → APPOINTMENT_CONFIRMATION", () => {
    const result = classifyEmail({
      subject: "Información de Turno Solicitado",
      fromEmail: "turnos@veterinariapanda.com.ar",
      bodyText: "Hemos registrado tu turno confirmado para el día 21/03/2026.",
      attachmentFilenames: [],
    });
    expect(result.type).toBe(EmailClassType.APPOINTMENT_CONFIRMATION);
  });

  test("turno cancelado → APPOINTMENT_CANCELLATION", () => {
    const result = classifyEmail({
      subject: "Cancelación de turno",
      fromEmail: "turnos@veterinariapanda.com.ar",
      bodyText: "Tu turno cancelado fue procesado. Podés reprogramar cuando quieras.",
      attachmentFilenames: [],
    });
    expect(result.type).toBe(EmailClassType.APPOINTMENT_CANCELLATION);
  });

  test("email de vacunación → VACCINATION", () => {
    const result = classifyEmail({
      subject: "Recordatorio de vacuna",
      fromEmail: "info@clinicavet.com",
      bodyText: "Es momento de la revacunación anual de tu mascota.",
      attachmentFilenames: [],
    });
    expect(result.type).toBe(EmailClassType.VACCINATION);
  });

  test("receta veterinaria → PRESCRIPTION", () => {
    const result = classifyEmail({
      subject: "Receta veterinaria",
      fromEmail: "drgarcia@vet.com",
      bodyText: "Medicación indicada: Amoxicilina 250mg, administrar cada 12 horas por 7 días.",
      attachmentFilenames: [],
    });
    expect(result.type).toBe(EmailClassType.PRESCRIPTION);
  });

  test("email de marketing → NON_CLINICAL", () => {
    const result = classifyEmail({
      subject: "¡Grandes descuentos en ropa!",
      fromEmail: "ofertas@tienda.com",
      bodyText: "Aprovechá los descuentos de temporada en nuestra tienda online.",
      attachmentFilenames: [],
    });
    expect(result.type).toBe(EmailClassType.NON_CLINICAL);
    expect(result.requiresAiReview).toBe(false);
  });

  test("FW: prefix también detecta forward", () => {
    const result = classifyEmail({
      subject: "FW: Resultado de laboratorio",
      fromEmail: "usuario@gmail.com",
      bodyText: "resultado de laboratorio de tu mascota: todo normal",
      attachmentFilenames: ["laboratorio.pdf"],
    });
    expect(result.isForwarded).toBe(true);
    expect(result.type).toBe(EmailClassType.CLINICAL_REPORT);
  });
});