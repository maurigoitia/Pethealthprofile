import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

const DELETE_BATCH_SIZE = 200;

type DeleteSummary = {
  userId: string;
  ownedPetsDeleted: number;
  coTutorLinksRemoved: number;
  firestoreDocsDeleted: number;
  userSubcollectionsDeleted: number;
  storagePrefixesDeleted: string[];
};

type FieldDeleteConfig = {
  collection: string;
  field: string;
};

const USER_SCOPED_DELETES: FieldDeleteConfig[] = [
  { collection: "medical_events", field: "userId" },
  { collection: "appointments", field: "userId" },
  { collection: "medications", field: "userId" },
  { collection: "treatments", field: "userId" },
  { collection: "pending_reviews", field: "userId" },
  { collection: "clinical_review_drafts", field: "userId" },
  { collection: "reminders", field: "userId" },
  { collection: "scheduled_notifications", field: "userId" },
  { collection: "scheduled_reminders", field: "userId" },
  { collection: "dose_events", field: "userId" },
  { collection: "verified_reports", field: "ownerId" },
  { collection: "gmail_ingestion_sessions", field: "user_id" },
  { collection: "gmail_ingestion_documents", field: "user_id" },
  { collection: "gmail_raw_documents_tmp", field: "user_id" },
  { collection: "gmail_attachment_extract_tmp", field: "user_id" },
  { collection: "gmail_event_reviews", field: "user_id" },
  { collection: "gmail_event_fingerprints", field: "user_id" },
  { collection: "gmail_document_hashes", field: "user_id" },
  { collection: "gmail_ingestion_errors", field: "user_id" },
  { collection: "structured_medical_dataset", field: "user_id" },
  { collection: "gmail_oauth_states", field: "uid" },
  { collection: "invitations", field: "createdBy" },
  { collection: "invitations", field: "usedBy" },
];

const PET_SCOPED_DELETES: FieldDeleteConfig[] = [
  { collection: "medical_events", field: "petId" },
  { collection: "appointments", field: "petId" },
  { collection: "medications", field: "petId" },
  { collection: "treatments", field: "petId" },
  { collection: "clinical_conditions", field: "petId" },
  { collection: "diagnoses", field: "petId" },
  { collection: "clinical_alerts", field: "petId" },
  { collection: "clinical_review_drafts", field: "petId" },
  { collection: "pending_actions", field: "petId" },
  { collection: "pending_reviews", field: "petId" },
  { collection: "clinical_events", field: "petId" },
  { collection: "reminders", field: "petId" },
  { collection: "scheduled_notifications", field: "petId" },
  { collection: "scheduled_reminders", field: "petId" },
  { collection: "dose_events", field: "petId" },
  { collection: "structured_medical_dataset", field: "pet_id" },
  { collection: "gmail_event_reviews", field: "pet_id" },
  { collection: "invitations", field: "petId" },
];

const USER_DOC_IDS = [
  { collection: "user_email_config" },
  { collection: "userGmailConnections" },
  { collection: "gmail_oauth_attempts" },
  { collection: "gmail_sync_invitations" },
  { collection: "email_sync_plan_overrides" },
  { collection: "gmail_user_locks" },
];

function nowIso(): string {
  return new Date().toISOString();
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function deleteQueryInBatches(
  query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData>
): Promise<number> {
  let deleted = 0;

  while (true) {
    const snap = await query.limit(DELETE_BATCH_SIZE).get();
    if (snap.empty) break;

    const batch = admin.firestore().batch();
    snap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();
    deleted += snap.size;

    if (snap.size < DELETE_BATCH_SIZE) break;
  }

  return deleted;
}

async function deleteDocsByField(collectionName: string, field: string, value: string): Promise<number> {
  return deleteQueryInBatches(
    admin.firestore().collection(collectionName).where(field, "==", value)
  );
}

async function deleteSubcollections(docRef: FirebaseFirestore.DocumentReference): Promise<number> {
  let deleted = 0;
  const subcollections = await docRef.listCollections();

  for (const subcollection of subcollections) {
    deleted += await deleteQueryInBatches(subcollection);
  }

  return deleted;
}

async function deleteStoragePrefix(prefix: string): Promise<boolean> {
  try {
    await admin.storage().bucket().deleteFiles({ prefix });
    return true;
  } catch (error: any) {
    const message = String(error?.message || error || "");
    if (message.includes("No such object") || message.includes("no such object")) {
      return false;
    }
    throw error;
  }
}

async function removeUserAsCoTutor(uid: string): Promise<number> {
  const snap = await admin
    .firestore()
    .collection("pets")
    .where("coTutorUids", "array-contains", uid)
    .get();

  let updated = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data() as Record<string, unknown>;
    const ownerId = asString(data.ownerId);
    if (ownerId === uid) continue;

    const coTutorUids = Array.isArray(data.coTutorUids)
      ? data.coTutorUids.filter((row): row is string => typeof row === "string" && row !== uid)
      : [];
    const coTutors = Array.isArray(data.coTutors)
      ? data.coTutors.filter((row) => {
          const item = typeof row === "object" && row !== null ? row as Record<string, unknown> : {};
          return asString(item.uid) !== uid;
        })
      : [];

    await docSnap.ref.update({
      coTutorUids,
      coTutors,
      updatedAt: nowIso(),
    });
    updated += 1;
  }

  return updated;
}

async function deleteOwnedPetData(petId: string): Promise<number> {
  let deleted = 0;

  for (const config of PET_SCOPED_DELETES) {
    deleted += await deleteDocsByField(config.collection, config.field, petId);
  }

  const petRef = admin.firestore().collection("pets").doc(petId);
  deleted += await deleteSubcollections(petRef);
  await petRef.delete().catch(() => undefined);
  deleted += 1;

  return deleted;
}

async function deleteUserScopedDocs(uid: string): Promise<number> {
  let deleted = 0;

  for (const config of USER_SCOPED_DELETES) {
    deleted += await deleteDocsByField(config.collection, config.field, uid);
  }

  for (const config of USER_DOC_IDS) {
    const ref = admin.firestore().collection(config.collection).doc(uid);
    const snap = await ref.get();
    if (snap.exists) {
      await ref.delete();
      deleted += 1;
    }
  }

  return deleted;
}

async function deleteUserDocumentTree(uid: string): Promise<number> {
  const userRef = admin.firestore().collection("users").doc(uid);
  let deleted = await deleteSubcollections(userRef);
  const userSnap = await userRef.get();
  if (userSnap.exists) {
    await userRef.delete();
    deleted += 1;
  }
  return deleted;
}

async function performAccountDeletion(uid: string): Promise<DeleteSummary> {
  const ownedPetsSnap = await admin.firestore().collection("pets").where("ownerId", "==", uid).get();
  const ownedPetIds = ownedPetsSnap.docs.map((docSnap) => docSnap.id);

  const coTutorLinksRemoved = await removeUserAsCoTutor(uid);

  let firestoreDocsDeleted = 0;
  for (const petId of ownedPetIds) {
    firestoreDocsDeleted += await deleteOwnedPetData(petId);
  }

  firestoreDocsDeleted += await deleteUserScopedDocs(uid);
  const userSubcollectionsDeleted = await deleteUserDocumentTree(uid);
  firestoreDocsDeleted += userSubcollectionsDeleted;

  const storagePrefixesDeleted: string[] = [];
  for (const prefix of [`users/${uid}/`, `documents/${uid}/`, `gmail_ingestion/${uid}/`]) {
    const removed = await deleteStoragePrefix(prefix);
    if (removed) storagePrefixesDeleted.push(prefix);
  }

  await admin.auth().deleteUser(uid);

  return {
    userId: uid,
    ownedPetsDeleted: ownedPetIds.length,
    coTutorLinksRemoved,
    firestoreDocsDeleted,
    userSubcollectionsDeleted,
    storagePrefixesDeleted,
  };
}

export const deleteUserAccount = functions
  .region("us-central1")
  .https.onCall(async (_data, context) => {
    if (!context.auth?.uid) {
      throw new functions.https.HttpsError("unauthenticated", "Debes iniciar sesión.");
    }

    const uid = context.auth.uid;
    functions.logger.warn("[deleteUserAccount] Starting account deletion", { uid });

    try {
      const summary = await performAccountDeletion(uid);
      functions.logger.warn("[deleteUserAccount] Account deletion completed", summary);
      return { ok: true, ...summary };
    } catch (error) {
      functions.logger.error("[deleteUserAccount] Account deletion failed", { uid, error });
      throw new functions.https.HttpsError(
        "internal",
        "No se pudo eliminar la cuenta completa. Reintentá en unos minutos."
      );
    }
  });

export const submitDataDeletionRequest = functions
  .region("us-central1")
  .https.onRequest(async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({ ok: false, error: "method_not_allowed" });
      return;
    }

    const name = asString(req.body?.name);
    const email = asString(req.body?.email).toLowerCase();
    const message = asString(req.body?.message);

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ ok: false, error: "invalid_email" });
      return;
    }

    const requestRef = admin.firestore().collection("data_deletion_requests").doc();
    await requestRef.set({
      requestId: requestRef.id,
      name: name || null,
      email,
      message: message || null,
      status: "pending",
      source: "public_data_deletion_form",
      createdAt: nowIso(),
    });

    res.status(200).json({ ok: true, requestId: requestRef.id });
  });
