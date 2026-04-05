// ============================================================================
// PESSY — Backfill: Proyectar clinical_events historicos sin proyectar
//
// Busca todos los clinical_events con status="verified" y projected != true
// y los proyecta usando projectClinicalEvent() del projection layer.
//
// Exportado en index.ts como: backfillClinicalProjection (HTTP, admin-only)
// ============================================================================

import * as admin from "firebase-admin";
import { handleCors } from "../utils/helpers";
import * as functions from "firebase-functions";
import { projectClinicalEvent } from "./projectionLayer";

const ADMIN_SECRET_HEADER = "x-pessy-admin-secret";

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

interface BackfillResult {
  total_scanned: number;
  projected: number;
  already_projected: number;
  errors: number;
  skipped_pending: number;
  error_details: Array<{ docId: string; error: string }>;
}

export async function runBackfillProjection(opts?: {
  dryRun?: boolean;
  limit?: number;
}): Promise<BackfillResult> {
  const dryRun = opts?.dryRun === true;
  const limit = opts?.limit ?? 200;

  const result: BackfillResult = {
    total_scanned: 0,
    projected: 0,
    already_projected: 0,
    errors: 0,
    skipped_pending: 0,
    error_details: [],
  };

  functions.logger.info("[BACKFILL] Iniciando backfill de clinical_events", { dryRun, limit });

  const snap = await admin
    .firestore()
    .collection("clinical_events")
    .where("status", "==", "verified")
    .where("projected", "!=", true)
    .limit(limit)
    .get();

  result.total_scanned = snap.size;
  functions.logger.info(`[BACKFILL] Encontrados ${snap.size} sin proyectar`);

  for (const doc of snap.docs) {
    const data = doc.data();
    const docId = doc.id;

    if (data.projected === true) { result.already_projected += 1; continue; }
    if (asString(data.status) !== "verified") { result.skipped_pending += 1; continue; }

    if (dryRun) {
      functions.logger.info(`[BACKFILL][DRY RUN] Proyectaria: ${docId}`, {
        category: data.category,
        document_type: data.document_type,
        petId: data.petId,
      });
      result.projected += 1;
      continue;
    }

    try {
      const projection = await projectClinicalEvent(docId, data);
      result.projected += 1;
      functions.logger.info(`[BACKFILL] OK ${docId} -> ${projection.projectedTo}/${projection.projectedDocId}`);
    } catch (err) {
      result.errors += 1;
      const msg = err instanceof Error ? err.message : String(err);
      result.error_details.push({ docId, error: msg });
      functions.logger.error(`[BACKFILL] ERROR ${docId}:`, err);
    }
  }

  functions.logger.info("[BACKFILL] Finalizado", result);
  return result;
}

// HTTP Cloud Function — protegida por header BACKFILL_ADMIN_SECRET
export const backfillClinicalProjection = functions
  .runWith({ timeoutSeconds: 540, memory: "1GB", secrets: ["BACKFILL_ADMIN_SECRET"] })
  .https.onRequest(async (req, res) => {
    if (handleCors(req, res)) return;
    const expectedSecret = asString(process.env.BACKFILL_ADMIN_SECRET);
    const providedSecret = asString(req.headers[ADMIN_SECRET_HEADER]);
    if (!expectedSecret || providedSecret !== expectedSecret) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const dryRun = req.query.dry_run === "true" || req.body?.dry_run === true;
    const limit = Math.min(Number(req.query.limit ?? req.body?.limit ?? 200), 500);

    try {
      const result = await runBackfillProjection({ dryRun, limit });
      res.status(200).json({ ok: true, dryRun, ...result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ ok: false, error: msg });
    }
  });
