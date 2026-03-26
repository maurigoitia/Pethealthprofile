"use strict";
// ============================================================================
// PESSY — Backfill: Proyectar clinical_events historicos sin proyectar
//
// Busca todos los clinical_events con status="verified" y projected != true
// y los proyecta usando projectClinicalEvent() del projection layer.
//
// Exportado en index.ts como: backfillClinicalProjection (HTTP, admin-only)
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.backfillClinicalProjection = void 0;
exports.runBackfillProjection = runBackfillProjection;
const admin = require("firebase-admin");
const functions = require("firebase-functions");
const projectionLayer_1 = require("./projectionLayer");
const ADMIN_SECRET_HEADER = "x-pessy-admin-secret";
function asString(v) {
    return typeof v === "string" ? v.trim() : "";
}
async function runBackfillProjection(opts) {
    var _a;
    const dryRun = (opts === null || opts === void 0 ? void 0 : opts.dryRun) === true;
    const limit = (_a = opts === null || opts === void 0 ? void 0 : opts.limit) !== null && _a !== void 0 ? _a : 200;
    const result = {
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
        if (data.projected === true) {
            result.already_projected += 1;
            continue;
        }
        if (asString(data.status) !== "verified") {
            result.skipped_pending += 1;
            continue;
        }
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
            const projection = await (0, projectionLayer_1.projectClinicalEvent)(docId, data);
            result.projected += 1;
            functions.logger.info(`[BACKFILL] OK ${docId} -> ${projection.projectedTo}/${projection.projectedDocId}`);
        }
        catch (err) {
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
exports.backfillClinicalProjection = functions
    .runWith({ timeoutSeconds: 540, memory: "1GB", secrets: ["BACKFILL_ADMIN_SECRET"] })
    .https.onRequest(async (req, res) => {
    var _a, _b, _c, _d;
    const expectedSecret = asString(process.env.BACKFILL_ADMIN_SECRET);
    const providedSecret = asString(req.headers[ADMIN_SECRET_HEADER]);
    if (!expectedSecret || providedSecret !== expectedSecret) {
        res.status(403).json({ error: "Forbidden" });
        return;
    }
    const dryRun = req.query.dry_run === "true" || ((_a = req.body) === null || _a === void 0 ? void 0 : _a.dry_run) === true;
    const limit = Math.min(Number((_d = (_b = req.query.limit) !== null && _b !== void 0 ? _b : (_c = req.body) === null || _c === void 0 ? void 0 : _c.limit) !== null && _d !== void 0 ? _d : 200), 500);
    try {
        const result = await runBackfillProjection({ dryRun, limit });
        res.status(200).json(Object.assign({ ok: true, dryRun }, result));
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        res.status(500).json({ ok: false, error: msg });
    }
});
//# sourceMappingURL=backfillProjection.js.map