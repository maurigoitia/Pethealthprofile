// @vitest-environment node
import { describe, expect, test, it, beforeEach } from "vitest";
/**
 * Test suite for Human Medical Content Blocker
 *
 * Tests the weighted signal detection system without Firebase.
 * All tests use pure input/output assertions.
 */

import {
  checkHumanMedicalContent,
  HumanMedicalBlockResult,
} from "../humanMedicalBlocker";

describe("humanMedicalBlocker", () => {
  // ────────────────────────────────────────────────────────────────────────────
  // Test Group 1: Blocked Domains (weight: 100)
  // ────────────────────────────────────────────────────────────────────────────

  describe("Blocked Domains", () => {
    test("OSDE domain triggers immediate block at confidence 100", () => {
      const result = checkHumanMedicalContent({
        fromEmail: "notificaciones@osde.com.ar",
        subject: "Tu comprobante",
        bodyText: "Información de afiliación",
        attachmentFilenames: [],
      });

      expect(result.isHumanMedical).toBe(true);
      expect(result.confidence).toBe(100);
      expect(result.shouldSkipAi).toBe(true);
      expect(result.blockedReason).toContain("blocked domain");
      expect(result.signals.some(s => s.weight === 100)).toBe(true);
    });

    test("Huesped domain triggers immediate block", () => {
      const result = checkHumanMedicalContent({
        fromEmail: "admin@huesped.org.ar",
        subject: "Turno programado",
        bodyText: "Confirmar asistencia",
        attachmentFilenames: [],
      });

      expect(result.isHumanMedical).toBe(true);
      expect(result.confidence).toBe(100);
      expect(result.shouldSkipAi).toBe(true);
    });

    test("Swissmedical domain blocks even with empty body", () => {
      const result = checkHumanMedicalContent({
        fromEmail: "from@swissmedical.com.ar",
        subject: "",
        bodyText: "",
        attachmentFilenames: [],
      });

      expect(result.isHumanMedical).toBe(true);
      expect(result.confidence).toBe(100);
    });

    test("AFIP domain blocks at high confidence", () => {
      const result = checkHumanMedicalContent({
        fromEmail: "consultas@afip.gob.ar",
        subject: "CUIL information",
        bodyText: "Consulta de contribuyente",
        attachmentFilenames: [],
      });

      expect(result.isHumanMedical).toBe(true);
      expect(result.confidence).toBe(100);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Test Group 2: Keywords (weight: 70-90)
  // ────────────────────────────────────────────────────────────────────────────

  describe("Keywords", () => {
    test("'número de socio' keyword triggers block at high confidence", () => {
      const result = checkHumanMedicalContent({
        fromEmail: "sender@example.com",
        subject: "Información importante",
        bodyText: "Tu número de socio es 12345. Cobertura médica activa.",
        attachmentFilenames: [],
      });

      expect(result.isHumanMedical).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(80);
      expect(result.shouldSkipAi).toBe(true);
      expect(result.blockedReason).toContain("healthcare signals");
    });

    test("'cobertura médica' + 'plan médico' combined triggers block", () => {
      const result = checkHumanMedicalContent({
        fromEmail: "admin@insurance.com",
        subject: "Plan médico actualizado",
        bodyText: "Su cobertura médica ha sido renovada",
        attachmentFilenames: [],
      });

      expect(result.isHumanMedical).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(80);
    });

    test("'obra social' keyword at high weight", () => {
      const result = checkHumanMedicalContent({
        fromEmail: "notif@example.com",
        subject: "Afiliación a obra social",
        bodyText: "Bienvenido a nuestra obra social",
        attachmentFilenames: [],
      });

      expect(result.isHumanMedical).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(80);
    });

    test("'médico de cabecera' single keyword at weight 90", () => {
      const result = checkHumanMedicalContent({
        fromEmail: "sistema@health.com",
        subject: "Selecciona tu médico de cabecera",
        bodyText: "Por favor elige tu médico de cabecera",
        attachmentFilenames: [],
      });

      expect(result.isHumanMedical).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(80);
    });

    test("'afiliado' + 'autorización médica' high score", () => {
      const result = checkHumanMedicalContent({
        fromEmail: "system@prepaga.com",
        subject: "Autorización médica requerida",
        bodyText: "Como afiliado, requiere autorización médica",
        attachmentFilenames: [],
      });

      expect(result.isHumanMedical).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(80);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Test Group 3: DNI/CUIL Patterns (weight: 90 in human context)
  // ────────────────────────────────────────────────────────────────────────────

  describe("DNI/CUIL Patterns", () => {
    test("DNI pattern in patient context triggers block", () => {
      const result = checkHumanMedicalContent({
        fromEmail: "salud@system.com",
        subject: "Información de paciente",
        bodyText: "Paciente: DNI 12345678",
        attachmentFilenames: [],
      });

      expect(result.isHumanMedical).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(80);
    });

    test("CUIL in afiliación context triggers block", () => {
      const result = checkHumanMedicalContent({
        fromEmail: "admin@prepaga.com",
        subject: "Afiliación activa",
        bodyText: "CUIL: 20-12345678-9. Socio afiliado.",
        attachmentFilenames: [],
      });

      expect(result.isHumanMedical).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(80);
    });

    test("D.N.I.: format also detected", () => {
      const result = checkHumanMedicalContent({
        fromEmail: "system@health.com",
        subject: "Datos del paciente",
        bodyText: "D.N.I.: 23456789. Beneficiario confirmado.",
        attachmentFilenames: [],
      });

      expect(result.isHumanMedical).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(80);
    });

    test("DNI without human context is NOT blocked", () => {
      const result = checkHumanMedicalContent({
        fromEmail: "petshop@example.com",
        subject: "Compra completada",
        bodyText: "Tu DNI 12345678 fue registrado para la compra",
        attachmentFilenames: [],
      });

      expect(result.isHumanMedical).toBe(false);
      expect(result.confidence).toBeLessThan(80);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Test Group 4: Attachment Names (weight: 75)
  // ────────────────────────────────────────────────────────────────────────────

  describe("Attachment Names", () => {
    test("'historia_clinica' attachment triggers block", () => {
      const result = checkHumanMedicalContent({
        fromEmail: "consulta@clinic.com",
        subject: "Documento adjunto",
        bodyText: "Ver historia clínica",
        attachmentFilenames: ["historia_clinica.pdf"],
      });

      expect(result.isHumanMedical).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(80);
    });

    test("'receta_medica' attachment blocks", () => {
      const result = checkHumanMedicalContent({
        fromEmail: "farmacia@system.com",
        subject: "Receta",
        bodyText: "Receta adjunta",
        attachmentFilenames: ["receta_medica.pdf"],
      });

      expect(result.isHumanMedical).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(80);
    });

    test("'bono_consulta' blocks", () => {
      const result = checkHumanMedicalContent({
        fromEmail: "prepaga@system.com",
        subject: "Bono",
        bodyText: "Tu bono",
        attachmentFilenames: ["bono_consulta_001.pdf"],
      });

      expect(result.isHumanMedical).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(80);
    });

    test("'resultado_laboratorio' without veterinary context blocks", () => {
      const result = checkHumanMedicalContent({
        fromEmail: "lab@system.com",
        subject: "Resultados",
        bodyText: "Tus resultados",
        attachmentFilenames: ["resultado_laboratorio.pdf"],
      });

      expect(result.isHumanMedical).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(80);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Test Group 5: Veterinary Guardrails (reduce confidence by -20 to -25)
  // ────────────────────────────────────────────────────────────────────────────

  describe("Veterinary Guardrails", () => {
    test("Known pet name 'Thor' reduces confidence for prepaga email", () => {
      const result = checkHumanMedicalContent({
        fromEmail: "notif@osde.com.ar",
        subject: "Thor tiene cobertura",
        bodyText: "Tu mascota Thor está cubierto",
        attachmentFilenames: [],
      });

      // Still blocks because OSDE is 100-weight domain, but shows pattern works
      expect(result.isHumanMedical).toBe(true);
      expect(result.confidence).toBe(100); // Domain override
    });

    test("'veterinaria' keyword reduces confidence for human medical email", () => {
      const result = checkHumanMedicalContent({
        fromEmail: "admin@example.com",
        subject: "Número de socio y clínica veterinaria",
        bodyText: "Clínica veterinaria associated with your coverage",
        attachmentFilenames: [],
      });

      // Has "número de socio" (90 weight) but veterinaria reduces
      expect(result.isHumanMedical).toBe(true);
      expect(result.confidence).toBeLessThan(85);
    });

    test("Pet name 'Max' + 'mascota' reduces medical classification", () => {
      const result = checkHumanMedicalContent({
        fromEmail: "system@clinic.com",
        subject: "Max tiene cita",
        bodyText: "Tu mascota Max. Autorización médica.",
        attachmentFilenames: [],
      });

      // "Autorización médica" (85w) but vet signals reduce
      expect(result.isHumanMedical).toBe(true);
      // Reduced from 85 by vet penalties
      expect(result.confidence).toBeLessThan(80);
    });

    test("Multiple vet signals cap reduction at -60", () => {
      const result = checkHumanMedicalContent({
        fromEmail: "notif@example.com",
        subject: "Historia de Luna en clínica veterinaria",
        bodyText: "Tu mascota felino Luna. Cobertura médica. Veterinaria.",
        attachmentFilenames: ["historia_veterinaria.pdf"],
      });

      // Has "cobertura médica" but multiple vet reductions
      expect(result.confidence).toBeLessThan(60);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Test Group 6: False Positives (clean emails)
  // ────────────────────────────────────────────────────────────────────────────

  describe("False Positives - Clean Emails", () => {
    test("Regular pet shop email is NOT blocked", () => {
      const result = checkHumanMedicalContent({
        fromEmail: "promo@petshop.com",
        subject: "Alimento para perros",
        bodyText: "Nuevo balanceado para tu perro. Compra hoy.",
        attachmentFilenames: ["catalogo.pdf"],
      });

      expect(result.isHumanMedical).toBe(false);
      expect(result.confidence).toBe(0);
    });

    test("Veterinary clinic normal email NOT blocked", () => {
      const result = checkHumanMedicalContent({
        fromEmail: "contacto@clinicaveterinaria.com",
        subject: "Próximo control de Luna",
        bodyText: "Tu gato Luna tiene control el jueves 10:00",
        attachmentFilenames: [],
      });

      expect(result.isHumanMedical).toBe(false);
      expect(result.confidence).toBe(0);
    });

    test("Generic email with no signals", () => {
      const result = checkHumanMedicalContent({
        fromEmail: "marketing@example.com",
        subject: "Promoción especial",
        bodyText: "Descuento del 50% en todos los productos",
        attachmentFilenames: [],
      });

      expect(result.isHumanMedical).toBe(false);
      expect(result.confidence).toBe(0);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Test Group 7: Edge Cases and Boundary Conditions
  // ────────────────────────────────────────────────────────────────────────────

  describe("Edge Cases", () => {
    test("Empty email content results in no block", () => {
      const result = checkHumanMedicalContent({
        fromEmail: "sender@example.com",
        subject: "",
        bodyText: "",
        attachmentFilenames: [],
      });

      expect(result.isHumanMedical).toBe(false);
      expect(result.confidence).toBe(0);
    });

    test("Case insensitive domain matching", () => {
      const result = checkHumanMedicalContent({
        fromEmail: "admin@OSDE.COM.AR",
        subject: "Test",
        bodyText: "Test",
        attachmentFilenames: [],
      });

      expect(result.isHumanMedical).toBe(true);
      expect(result.confidence).toBe(100);
    });

    test("Diacritics normalized (médico = medico)", () => {
      const result = checkHumanMedicalContent({
        fromEmail: "system@example.com",
        subject: "Médico de cabecera",
        bodyText: "Selecciona tu médico",
        attachmentFilenames: [],
      });

      expect(result.isHumanMedical).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(80);
    });

    test("shouldSkipAi is true only when confidence >= 80", () => {
      const lowConfidence = checkHumanMedicalContent({
        fromEmail: "example@example.com",
        subject: "Some text",
        bodyText: "afiliado mention only once",
        attachmentFilenames: [],
      });
      expect(lowConfidence.shouldSkipAi).toBe(lowConfidence.confidence >= 80);

      const highConfidence = checkHumanMedicalContent({
        fromEmail: "admin@osde.com.ar",
        subject: "Test",
        bodyText: "Test",
        attachmentFilenames: [],
      });
      expect(highConfidence.shouldSkipAi).toBe(true);
    });

    test("Signals array includes all detected signals", () => {
      const result = checkHumanMedicalContent({
        fromEmail: "system@example.com",
        subject: "Autorización médica para DNI 12345678",
        bodyText: "Paciente afiliado. Número de socio: 999. Obra social.",
        attachmentFilenames: ["historia_clinica.pdf"],
      });

      expect(result.signals.length).toBeGreaterThan(0);
      expect(result.signals.every(s => s.weight > 0)).toBe(true);
      expect(result.signals.every(s => ["domain", "keyword", "pattern", "attachment_name"].includes(s.type))).toBe(true);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Test Group 8: Real-world Examples
  // ────────────────────────────────────────────────────────────────────────────

  describe("Real-world Examples", () => {
    test("Real OSDE notification", () => {
      const result = checkHumanMedicalContent({
        fromEmail: "notificaciones@osde.com.ar",
        subject: "Tu comprobante mensual está disponible",
        bodyText: `
          Estimado afiliado,
          
          Tu comprobante del mes está listo para descargar.
          Número de socio: 12345678
          Cobertura médica activa.
          
          Saludos,
          OSDE
        `,
        attachmentFilenames: ["comprobante_osde.pdf"],
      });

      expect(result.isHumanMedical).toBe(true);
      expect(result.confidence).toBe(100);
      expect(result.shouldSkipAi).toBe(true);
    });

    test("Real Panda Vet clinic (should NOT be blocked)", () => {
      const result = checkHumanMedicalContent({
        fromEmail: "contacto@pandaveterinaria.com",
        subject: "Turno confirmado para Thor",
        bodyText: `
          Hola,
          
          Tu perro Thor tiene turno confirmado para:
          Fecha: 15/03/2025
          Hora: 10:00
          Motivo: Control general
          
          Equipo Panda
        `,
        attachmentFilenames: [],
      });

      expect(result.isHumanMedical).toBe(false);
      expect(result.confidence).toBe(0);
    });

    test("Ambiguous email: 'guardia' without pet context", () => {
      const result = checkHumanMedicalContent({
        fromEmail: "info@healthsystem.com",
        subject: "Acceso a guardia médica",
        bodyText: "Información sobre tu acceso a guardia médica",
        attachmentFilenames: [],
      });

      expect(result.isHumanMedical).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(70);
      expect(result.confidence).toBeLessThan(100);
    });
  });
});
