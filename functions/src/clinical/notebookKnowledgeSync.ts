import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { handleCors } from "../utils/helpers";

const COLLECTION = "notebook_knowledge";
const SYNC_VERSION = "notebook_sync_v1";

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Cloud Function that receives knowledge sections from NotebookLM
 * (synced via the pessy-knowledge-sync skill in Claude Code)
 * and stores them in Firestore for the clinical brain to use.
 *
 * Expected payload:
 * {
 *   sections: [{
 *     id: string,
 *     notebook: string,        // "veterinaria" | "farmacologia" | "comportamiento" | "producto" | "compliance"
 *     title: string,
 *     body: string,
 *     keywords: string[],
 *     priority: number (50-100),
 *   }],
 *   replace_notebook?: string  // if set, deletes all existing sections from this notebook before writing
 * }
 */
export const syncNotebookKnowledge = functions
  .runWith({
    timeoutSeconds: 60,
    memory: "256MB",
    secrets: ["GMAIL_FORCE_SYNC_KEY"],
  })
  .region("us-central1")
  .https.onRequest(async (req, res) => {
    if (handleCors(req, res)) return;
    if (req.method !== "POST") {
      res.status(405).json({ ok: false, error: "method_not_allowed" });
      return;
    }

    // Auth: same key as other internal functions
    const configuredKey = asString(process.env.GMAIL_FORCE_SYNC_KEY);
    const incomingKey =
      asString(req.headers["x-force-sync-key"]) ||
      asString(req.headers["x-brain-key"]) ||
      asString(req.headers.authorization).replace(/^Bearer\s+/i, "");
    if (!configuredKey || !incomingKey || incomingKey !== configuredKey) {
      res.status(401).json({ ok: false, error: "unauthorized" });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const sections = Array.isArray(body.sections) ? body.sections : [];
    if (sections.length === 0) {
      res.status(400).json({ ok: false, error: "no_sections_provided" });
      return;
    }

    const db = admin.firestore();
    const batch = db.batch();
    const replaceNotebook = asString(body.replace_notebook);
    const now = new Date().toISOString();

    // If replacing a notebook, deactivate existing sections first
    if (replaceNotebook) {
      const existing = await db
        .collection(COLLECTION)
        .where("notebook", "==", replaceNotebook)
        .where("active", "==", true)
        .get();

      for (const doc of existing.docs) {
        batch.update(doc.ref, { active: false, deactivated_at: now });
      }
    }

    // Write new sections
    const ids: string[] = [];
    for (const section of sections) {
      const s = section as Record<string, unknown>;
      const id = asString(s.id) || `${asString(s.notebook)}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const ref = db.collection(COLLECTION).doc(id);
      batch.set(ref, {
        id,
        notebook: asString(s.notebook),
        title: asString(s.title),
        body: asString(s.body),
        keywords: Array.isArray(s.keywords) ? s.keywords : [],
        priority: typeof s.priority === "number" ? s.priority : 50,
        active: true,
        sync_version: SYNC_VERSION,
        synced_at: now,
      });
      ids.push(id);
    }

    await batch.commit();

    res.status(200).json({
      ok: true,
      synced: ids.length,
      replaced_notebook: replaceNotebook || null,
      ids,
    });
  });
