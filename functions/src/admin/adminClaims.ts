/**
 * SCRUM-6: Admin Custom Claims
 * Reemplaza el admin hardcodeado por email en firestore.rules.
 * En lugar de `request.auth.token.email == 'mauri@pessy.app'`,
 * usamos `request.auth.token.admin == true`.
 */
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

/**
 * Callable — solo admins existentes pueden crear nuevos admins.
 */
export const setAdminClaim = functions.https.onCall(async (data, context) => {
  if (!context.auth?.token?.admin) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Solo administradores pueden modificar claims de admin."
    );
  }
  const { targetUid, isAdmin } = data as { targetUid: string; isAdmin: boolean };
  if (!targetUid || typeof targetUid !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "targetUid requerido.");
  }
  await admin.auth().setCustomUserClaims(targetUid, { admin: isAdmin === true });
  await admin.firestore().collection("admin_audit_log").add({
    action: isAdmin ? "grant_admin" : "revoke_admin",
    targetUid,
    performedBy: context.auth.uid,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { ok: true, targetUid, admin: isAdmin };
});

/**
 * Bootstrap trigger: crear doc en /admin_bootstrap/{uid} desde Firebase Console
 * para setear el primer admin. Se auto-elimina después.
 */
export const onAdminBootstrap = functions.firestore
  .document("admin_bootstrap/{uid}")
  .onCreate(async (snap, context) => {
    const uid = context.params.uid;
    await admin.auth().setCustomUserClaims(targetUid, { admin: true });
    await admin.firestore().collection("admin_audit_log").add({
      action: "bootstrap_admin",
      targetUid: uid,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    await snap.ref.delete();
    console.log(`[adminClaims] Admin claim seteado para UID: ${uid}`);
  });
