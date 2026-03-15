import * as admin from "firebase-admin";
import { ClinicalEventExtraction, DomainIngestionType } from "./types";
import { getNowIso, sha256 } from "./utils";
import { buildCanonicalEventTitle, toMedicalEventDocumentType } from "./clinicalNormalization";

/**
 * Inserta el evento procesado en la colección final de la mascota.
 */
export async function ingestEventToDomain(args: {
  uid: string;
  petId: string;
  event: ClinicalEventExtraction;
  sourceEmailId: string;
  requiresConfirmation: boolean;
}) {
  const now = getNowIso();
  const title = buildCanonicalEventTitle(args.event);
  const eventId = `gmail_evt_${sha256(`${args.uid}_${args.sourceEmailId}_${title}`).slice(0, 20)}`;

  await admin
    .firestore()
    .collection("medical_events")
    .doc(eventId)
    .set(
      {
        id: eventId,
        userId: args.uid,
        petId: args.petId,
        title,
        eventDate: args.event.event_date,
        status: args.requiresConfirmation ? "draft" : "completed",
        source: "email_import",
        source_email_id: args.sourceEmailId,
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    );

  return { canonicalEventId: eventId };
}

/**
 * Limpieza de eventos viejos (Legacy) que ya no cumplen con la nueva taxonomía.
 */
export async function runLegacyMailsyncCleanup(uid: string) {
  // Lógica de borrado/salvataje de registros duplicados o mal formados
}
