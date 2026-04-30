/**
 * AI Transparency Utilities
 * 
 * EU AI Act Art. 50 — Los usuarios deben saber cuándo el contenido fue generado por IA.
 * GDPR Art. 22 — Derecho a no ser sujeto de decisiones puramente automatizadas.
 * LFPDPPP 2025 — Transparencia en el tratamiento de datos.
 * 
 * Estas utilidades aseguran que:
 * 1. Todo contenido generado por IA está marcado como tal
 * 2. Se registra qué modelo procesó cada documento
 * 3. Los niveles de confianza son visibles para el usuario
 * 4. Hay mecanismo de revisión humana (ClinicalReviewDraft)
 */

export interface AIProcessingMetadata {
  /** Modelo que procesó el documento */
  aiModel: string;
  /** Versión del modelo */
  aiModelVersion?: string;
  /** Timestamp del procesamiento */
  processedAt: string;
  /** Si los datos fueron revisados por humano */
  humanReviewed: boolean;
  /** Quién revisó (userId) */
  reviewedBy?: string;
  /** Timestamp de la revisión */
  reviewedAt?: string;
  /** Nivel de confianza general (0-1) */
  overallConfidence: number;
  /** Si el usuario consintió el procesamiento por IA */
  aiConsentGiven: boolean;
  /** Versión del consentimiento */
  consentVersion?: string;
}

/**
 * Crea metadata de procesamiento de IA para adjuntar a un MedicalEvent.
 * Debe llamarse cada vez que un documento pasa por el pipeline de IA.
 */
export function createAIProcessingMetadata(
  model: string,
  confidence: number,
  consentGiven: boolean,
  consentVersion?: string,
): AIProcessingMetadata {
  return {
    aiModel: model,
    processedAt: new Date().toISOString(),
    humanReviewed: false,
    overallConfidence: Math.max(0, Math.min(1, confidence)),
    aiConsentGiven: consentGiven,
    consentVersion: consentVersion || undefined,
  };
}

/**
 * Marca un evento como revisado por humano.
 */
export function markAsHumanReviewed(
  metadata: AIProcessingMetadata,
  userId: string,
): AIProcessingMetadata {
  return {
    ...metadata,
    humanReviewed: true,
    reviewedBy: userId,
    reviewedAt: new Date().toISOString(),
  };
}

/**
 * Texto de transparencia para mostrar al usuario.
 * EU AI Act Art. 50 exige informar claramente.
 */
export function getAITransparencyLabel(metadata: AIProcessingMetadata): string {
  const model = metadata.aiModel.includes("gemini") ? "Google Gemini" :
    metadata.aiModel.includes("claude") ? "Anthropic Claude" :
    metadata.aiModel;
  
  if (metadata.humanReviewed) {
    return `Analizado por IA (${model}) y verificado por el usuario`;
  }
  return `Analizado automáticamente por IA (${model}) — pendiente de verificación`;
}

/**
 * Verifica si el usuario dio consentimiento para procesamiento de IA.
 * Lee del documento de usuario en Firestore.
 */
export function hasAIConsent(userConsent: {
  aiProcessingAccepted?: boolean;
} | null | undefined): boolean {
  return userConsent?.aiProcessingAccepted === true;
}

/**
 * Badge de confianza para la UI.
 */
export function getConfidenceBadge(confidence: number): {
  label: string;
  color: string;
} {
  if (confidence >= 0.85) return { label: "Alta confianza", color: "#10B981" };
  if (confidence >= 0.6) return { label: "Confianza media", color: "#F59E0B" };
  return { label: "Baja confianza — verificá los datos", color: "#EF4444" };
}