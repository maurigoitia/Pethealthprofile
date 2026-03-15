import { ClinicalEventExtraction, AttachmentMetadata } from "./types";
import { sha256, getNowIso } from "./utils";
import * as admin from "firebase-admin";

/**
 * Crea la acción pendiente para que el usuario Mauricio vea el dato en la App.
 */
export async function upsertSyncReviewPendingAction(args: {
  uid: string;
  petId: string | null;
  sessionId: string;
  sourceEmailId: string;
  event: ClinicalEventExtraction;
  reason: string;
  gmailReviewId: string;
}) {
  if (!args.petId) return;
  const pendingId = `sync_review_${args.gmailReviewId}`;

  await admin.firestore().collection("pending_actions").doc(pendingId).set(
    {
      userId: args.uid,
      petId: args.petId,
      type: "sync_review",
      status: "pending",
      title: "Revisar registro detectado",
      createdAt: getNowIso(),
      sessionId: args.sessionId,
    },
    { merge: true }
  );
}
