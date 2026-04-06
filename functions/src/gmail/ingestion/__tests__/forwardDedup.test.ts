// @vitest-environment node
import { describe, expect, test, it, beforeEach } from "vitest";
import {
  detectForward,
  stripForwardHeaders,
  computeContentHash,
  checkForwardDedup,
  ForwardDetectionResult,
  ForwardDedupResult,
} from "../forwardDedup";

describe("forwardDedup", () => {
  // ──────────────────────────────────────────────────────────────────────────
  // Tests: detectForward
  // ──────────────────────────────────────────────────────────────────────────

  describe("detectForward", () => {
    it("should detect Fwd: prefix (Gmail standard)", () => {
      const result = detectForward({
        subject: "Fwd: Resultado eco Thor",
        bodyText: "Este es el contenido del email",
        fromEmail: "owner@example.com",
      });

      expect(result.isForward).toBe(true);
      expect(result.forwardDepth).toBe(1);
      expect(result.originalSubject).toBe("Resultado eco Thor");
      expect(result.forwardChain).toContain("Fwd:");
    });

    it("should detect FW: prefix (Outlook)", () => {
      const result = detectForward({
        subject: "FW: Turno confirmado",
        bodyText: "Contenido del email",
        fromEmail: "owner@example.com",
      });

      expect(result.isForward).toBe(true);
      expect(result.forwardDepth).toBe(1);
      expect(result.originalSubject).toBe("Turno confirmado");
    });

    it("should detect Reenvío: prefix (Spanish)", () => {
      const result = detectForward({
        subject: "Reenvío: Vacunas aplicadas",
        bodyText: "Contenido",
        fromEmail: "owner@example.com",
      });

      expect(result.isForward).toBe(true);
      expect(result.forwardDepth).toBe(1);
      expect(result.originalSubject).toBe("Vacunas aplicadas");
    });

    it("should detect Reenvio: prefix (Spanish without accent)", () => {
      const result = detectForward({
        subject: "Reenvio: Resultado análisis",
        bodyText: "Contenido",
        fromEmail: "owner@example.com",
      });

      expect(result.isForward).toBe(true);
      expect(result.forwardDepth).toBe(1);
    });

    it("should detect RV: prefix (Outlook Spanish)", () => {
      const result = detectForward({
        subject: "RV: Cita con veterinario",
        bodyText: "Contenido",
        fromEmail: "owner@example.com",
      });

      expect(result.isForward).toBe(true);
      expect(result.forwardDepth).toBe(1);
    });

    it("should detect TR: prefix (French)", () => {
      const result = detectForward({
        subject: "TR: Résultats médicaux",
        bodyText: "Contenido",
        fromEmail: "owner@example.com",
      });

      expect(result.isForward).toBe(true);
      expect(result.forwardDepth).toBe(1);
    });

    it("should detect multiple forward depth (FW: FW:)", () => {
      const result = detectForward({
        subject: "FW: FW: Turno confirmado",
        bodyText: "Contenido",
        fromEmail: "owner@example.com",
      });

      expect(result.isForward).toBe(true);
      expect(result.forwardDepth).toBe(2);
      expect(result.originalSubject).toBe("Turno confirmado");
      expect(result.forwardChain.length).toBe(2);
    });

    it("should NOT detect forward in regular subject", () => {
      const result = detectForward({
        subject: "Recordatorio del Turno",
        bodyText: "Este es un email normal",
        fromEmail: "owner@example.com",
      });

      expect(result.isForward).toBe(false);
      expect(result.forwardDepth).toBe(0);
      expect(result.originalSubject).toBeNull();
    });

    it("should detect forward by body markers", () => {
      const bodyWithMarker = `
Contenido del email original

---------- Forwarded message ---------
De: vet@example.com
Fecha: 2024-01-15

Resultado del análisis
      `.trim();

      const result = detectForward({
        subject: "Resultado análisis",
        bodyText: bodyWithMarker,
        fromEmail: "owner@example.com",
      });

      expect(result.isForward).toBe(true);
    });

    it("should extract original sender from body", () => {
      const bodyWithSender = `
---------- Forwarded message ---------
De: veterinarian@clinic.com
Fecha: 2024-01-15

Resultado del análisis
      `.trim();

      const result = detectForward({
        subject: "Resultado",
        bodyText: bodyWithSender,
        fromEmail: "owner@example.com",
      });

      expect(result.originalSender).toBe("veterinarian@clinic.com");
    });

    it("should extract original sender with From: pattern", () => {
      const bodyWithSender = `
-------- Original Message --------
From: vet@example.com
Date: 2024-01-15

Contenido
      `.trim();

      const result = detectForward({
        subject: "Test",
        bodyText: bodyWithSender,
        fromEmail: "owner@example.com",
      });

      expect(result.originalSender).toBe("vet@example.com");
    });

    it("should extract original date from body", () => {
      const bodyWithDate = `
---------- Forwarded message ---------
De: vet@example.com
Fecha: 15/01/2024

Resultado
      `.trim();

      const result = detectForward({
        subject: "Test",
        bodyText: bodyWithDate,
        fromEmail: "owner@example.com",
      });

      expect(result.originalDate).toBe("15/01/2024");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Tests: stripForwardHeaders
  // ──────────────────────────────────────────────────────────────────────────

  describe("stripForwardHeaders", () => {
    it("should strip 'Forwarded message' header", () => {
      const bodyWithHeader = `
---------- Forwarded message ---------
De: vet@example.com
Para: owner@example.com
Fecha: 2024-01-15
Asunto: Resultado

Contenido clínico del email
      `.trim();

      const result = stripForwardHeaders(bodyWithHeader);

      expect(result).not.toContain("---------- Forwarded message");
      expect(result).not.toContain("De: vet@example.com");
      expect(result).toContain("Contenido clínico del email");
    });

    it("should strip 'Original Message' header", () => {
      const bodyWithHeader = `
-------- Original Message --------
From: vet@example.com
To: owner@example.com
Date: 2024-01-15
Subject: Results

Clinical content here
      `.trim();

      const result = stripForwardHeaders(bodyWithHeader);

      expect(result).not.toContain("-------- Original Message");
      expect(result).not.toContain("From: vet@example.com");
      expect(result).toContain("Clinical content here");
    });

    it("should preserve clinical content after stripping headers", () => {
      const bodyWithHeader = `
---------- Forwarded message ---------
De: veterinarian@clinic.com
Fecha: 2024-01-15

Diagnóstico: Alergia alimentaria
Recomendación: Cambiar dieta
Medicamentos: Antihistamínico
      `.trim();

      const result = stripForwardHeaders(bodyWithHeader);

      expect(result).toContain("Diagnóstico: Alergia alimentaria");
      expect(result).toContain("Recomendación: Cambiar dieta");
      expect(result).toContain("Medicamentos: Antihistamínico");
    });

    it("should handle empty body after stripping", () => {
      const bodyOnlyHeader = `
---------- Forwarded message ---------
De: vet@example.com
Fecha: 2024-01-15
      `.trim();

      const result = stripForwardHeaders(bodyOnlyHeader);

      expect(result.trim()).toBe("");
    });

    it("should clean up excessive whitespace", () => {
      const bodyWithExtraWhitespace = `
Content line 1



Content line 2
      `.trim();

      const result = stripForwardHeaders(bodyWithExtraWhitespace);

      expect(result).not.toMatch(/\n\n\n/);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Tests: computeContentHash
  // ──────────────────────────────────────────────────────────────────────────

  describe("computeContentHash", () => {
    it("should compute same hash for original and forward with same content", () => {
      const originalHash = computeContentHash({
        subject: "Resultado eco Thor",
        bodyText: "Diagnóstico: Normal. Recomendación: Control en 6 meses",
        senderDomain: "clinic.com",
      });

      const forwardHash = computeContentHash({
        subject: "Resultado eco Thor", // same subject
        bodyText: "Diagnóstico: Normal. Recomendación: Control en 6 meses", // same body
        senderDomain: "clinic.com", // same domain
      });

      expect(originalHash).toBe(forwardHash);
    });

    it("should compute different hash for different content", () => {
      const hash1 = computeContentHash({
        subject: "Resultado eco Thor",
        bodyText: "Diagnóstico: Normal",
        senderDomain: "clinic.com",
      });

      const hash2 = computeContentHash({
        subject: "Resultado eco Thor",
        bodyText: "Diagnóstico: Alterado",
        senderDomain: "clinic.com",
      });

      expect(hash1).not.toBe(hash2);
    });

    it("should compute different hash for different subject", () => {
      const hash1 = computeContentHash({
        subject: "Resultado eco Thor",
        bodyText: "Contenido",
        senderDomain: "clinic.com",
      });

      const hash2 = computeContentHash({
        subject: "Resultado echo Max",
        bodyText: "Contenido",
        senderDomain: "clinic.com",
      });

      expect(hash1).not.toBe(hash2);
    });

    it("should compute different hash for different domain", () => {
      const hash1 = computeContentHash({
        subject: "Resultado",
        bodyText: "Contenido",
        senderDomain: "clinic1.com",
      });

      const hash2 = computeContentHash({
        subject: "Resultado",
        bodyText: "Contenido",
        senderDomain: "clinic2.com",
      });

      expect(hash1).not.toBe(hash2);
    });

    it("should normalize whitespace in subject and body", () => {
      const hash1 = computeContentHash({
        subject: "Resultado   eco   Thor",
        bodyText: "Diagnóstico:  Normal",
        senderDomain: "clinic.com",
      });

      const hash2 = computeContentHash({
        subject: "Resultado eco Thor",
        bodyText: "Diagnóstico: Normal",
        senderDomain: "clinic.com",
      });

      expect(hash1).toBe(hash2);
    });

    it("should be case-insensitive", () => {
      const hash1 = computeContentHash({
        subject: "RESULTADO ECO THOR",
        bodyText: "DIAGNÓSTICO: NORMAL",
        senderDomain: "CLINIC.COM",
      });

      const hash2 = computeContentHash({
        subject: "Resultado eco Thor",
        bodyText: "Diagnóstico: Normal",
        senderDomain: "clinic.com",
      });

      expect(hash1).toBe(hash2);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Tests: checkForwardDedup
  // ──────────────────────────────────────────────────────────────────────────

  describe("checkForwardDedup", () => {
    it("should NOT mark as duplicate when hash is new", () => {
      const recentHashes = new Map<string, string>();

      const result = checkForwardDedup({
        currentEmail: {
          messageId: "msg123",
          subject: "Resultado eco Thor",
          bodyText: "Diagnóstico: Normal",
          fromEmail: "owner@example.com",
          date: "2024-01-15",
        },
        recentHashes,
      });

      expect(result.isDuplicate).toBe(false);
      expect(result.reason).toBeNull();
      expect(result.originalEmailId).toBeNull();
      expect(result.canonicalHash).toBeTruthy();
    });

    it("should mark as duplicate when hash matches recent email", () => {
      const recentHashes = new Map<string, string>();

      // Simular que ya tenemos un email guardado
      const existingHash = "hash123abc";
      recentHashes.set(existingHash, "msg_original");

      // Crear un mock de computeContentHash que retorne el hash que ya existe
      // Para este test, usamos checkForwardDedup con inputs que generarán el mismo hash

      // Primer email
      const originalEmail = {
        messageId: "msg_original",
        subject: "Resultado eco Thor",
        bodyText: "Diagnóstico: Normal",
        fromEmail: "vet@clinic.com",
        date: "2024-01-15",
      };

      // Guardar el hash del original
      const originalHash = computeContentHash({
        subject: originalEmail.subject,
        bodyText: originalEmail.bodyText,
        senderDomain: "clinic.com",
      });
      recentHashes.set(originalHash, "msg_original");

      // Forward del mismo email
      const forwardEmail = {
        messageId: "msg_forward",
        subject: "Fwd: Resultado eco Thor",
        bodyText: `---------- Forwarded message ---------
De: vet@clinic.com

Diagnóstico: Normal`,
        fromEmail: "owner@example.com",
        date: "2024-01-16",
      };

      const result = checkForwardDedup({
        currentEmail: forwardEmail,
        recentHashes,
      });

      expect(result.isDuplicate).toBe(true);
      expect(result.reason).toContain("msg_original");
      expect(result.originalEmailId).toBe("msg_original");
    });

    it("should detect duplicate even if original has 'Fwd:' prefix", () => {
      const recentHashes = new Map<string, string>();

      // Email original con Fwd:
      const firstForward = {
        messageId: "msg1",
        subject: "Fwd: Resultado",
        bodyText: "Contenido",
        fromEmail: "owner@example.com",
        date: "2024-01-15",
      };

      const hash1 = computeContentHash({
        subject: "Resultado", // sin Fwd:
        bodyText: "Contenido",
        senderDomain: "example.com",
      });
      recentHashes.set(hash1, "msg1");

      // Segundo forward de lo mismo
      const secondForward = {
        messageId: "msg2",
        subject: "Fwd: Fwd: Resultado",
        bodyText: `---------- Forwarded message ---------
Contenido`,
        fromEmail: "owner@example.com",
        date: "2024-01-16",
      };

      const result = checkForwardDedup({
        currentEmail: secondForward,
        recentHashes,
      });

      expect(result.isDuplicate).toBe(true);
    });

    it("should return valid canonicalHash even without duplicate", () => {
      const recentHashes = new Map<string, string>();

      const result = checkForwardDedup({
        currentEmail: {
          messageId: "msg123",
          subject: "Nuevo email",
          bodyText: "Contenido único",
          fromEmail: "sender@example.com",
          date: "2024-01-15",
        },
        recentHashes,
      });

      expect(result.canonicalHash).toBeTruthy();
      expect(result.canonicalHash.length).toBe(64); // SHA256 hex = 64 chars
      expect(/^[a-f0-9]{64}$/.test(result.canonicalHash)).toBe(true);
    });

    it("should use stripped body when detecting forward duplicate", () => {
      const recentHashes = new Map<string, string>();

      // Email original
      const originalEmail = {
        messageId: "msg_orig",
        subject: "Resultado",
        bodyText: "Diagnóstico: Normal. Seguimiento en 3 meses.",
        fromEmail: "vet@clinic.com",
        date: "2024-01-15",
      };

      const originalHash = computeContentHash({
        subject: "Resultado",
        bodyText: "Diagnóstico: Normal. Seguimiento en 3 meses.",
        senderDomain: "clinic.com",
      });
      recentHashes.set(originalHash, "msg_orig");

      // Forward con headers
      const forwardEmail = {
        messageId: "msg_fwd",
        subject: "Fwd: Resultado",
        bodyText: `---------- Forwarded message ---------
De: vet@clinic.com
Fecha: 2024-01-15
Asunto: Resultado

Diagnóstico: Normal. Seguimiento en 3 meses.`,
        fromEmail: "owner@example.com",
        date: "2024-01-16",
      };

      const result = checkForwardDedup({
        currentEmail: forwardEmail,
        recentHashes,
      });

      // Debe detectar que es duplicado porque el contenido normalizado es igual
      expect(result.isDuplicate).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Integration tests
  // ──────────────────────────────────────────────────────────────────────────

  describe("integration scenarios", () => {
    it("should handle complex forward chain", () => {
      const bodyComplex = `
Fwd: Result

---------- Forwarded message ---------
De: vet@clinic.com
Fecha: 2024-01-14

Original diagnosis here

---------- Forwarded message ---------
De: owner@example.com
Fecha: 2024-01-15

Otro contenido
      `.trim();

      const result = detectForward({
        subject: "Test",
        bodyText: bodyComplex,
        fromEmail: "owner@example.com",
      });

      expect(result.isForward).toBe(true);
    });

    it("should workflow: detect -> strip -> hash -> dedup", () => {
      // Simulate original email from vet
      const originalEmail = {
        messageId: "original",
        subject: "Vacunación completada",
        bodyText: "Vacunas aplicadas: Sextuple, Rabia, Gripe",
        fromEmail: "vet@clinic.com",
        date: "2024-01-15",
      };

      // Detect
      const detection1 = detectForward({
        subject: originalEmail.subject,
        bodyText: originalEmail.bodyText,
        fromEmail: originalEmail.fromEmail,
      });
      expect(detection1.isForward).toBe(false);

      // Hash
      const hash1 = computeContentHash({
        subject: originalEmail.subject,
        bodyText: originalEmail.bodyText,
        senderDomain: "clinic.com",
      });

      // Store in recent hashes
      const recentHashes = new Map<string, string>();
      recentHashes.set(hash1, "original");

      // Simulate forward from owner
      const forwardEmail = {
        messageId: "forward",
        subject: "Fwd: Vacunación completada",
        bodyText: `---------- Forwarded message ---------
De: vet@clinic.com
Fecha: 2024-01-15

Vacunas aplicadas: Sextuple, Rabia, Gripe`,
        fromEmail: "owner@example.com",
        date: "2024-01-16",
      };

      // Detect
      const detection2 = detectForward({
        subject: forwardEmail.subject,
        bodyText: forwardEmail.bodyText,
        fromEmail: forwardEmail.fromEmail,
      });
      expect(detection2.isForward).toBe(true);
      expect(detection2.forwardDepth).toBe(1);

      // Dedup check
      const dedupResult = checkForwardDedup({
        currentEmail: forwardEmail,
        recentHashes,
      });

      // Should detect as duplicate
      expect(dedupResult.isDuplicate).toBe(true);
      expect(dedupResult.originalEmailId).toBe("original");
    });
  });
});
