import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

export interface GmailInvitationAccess {
  allowed: boolean;
  status: string;
  reason: string;
}

const ALLOW_STATUSES = new Set([
  "invited",
  "enabled",
  "approved",
  "accepted",
  "connected",
  "active",
]);

const BLOCK_STATUSES = new Set([
  "blocked",
  "revoked",
  "disabled",
  "denied",
]);

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "object" && value !== null && typeof (value as { toDate?: unknown }).toDate === "function") {
    try {
      const parsed = (value as { toDate: () => Date }).toDate();
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    } catch {
      return null;
    }
  }
  return null;
}

function computeInviteDecision(source: Record<string, unknown>): GmailInvitationAccess {
  const inviteEnabled = asBoolean(source.enabled)
    || asBoolean(source.allowed)
    || asBoolean(source.inviteEnabled)
    || asBoolean(source.isEnabled)
    || asBoolean(source.gmailSyncEnabled);

  const status = asString(source.status || source.inviteStatus || source.state).toLowerCase();
  const revokedAt = toDate(source.revokedAt || source.disabledAt);
  const expiresAt = toDate(source.expiresAt || source.expireAt);

  if (revokedAt) {
    return {
      allowed: false,
      status: status || "revoked",
      reason: "invitation_revoked",
    };
  }

  if (expiresAt && expiresAt.getTime() < Date.now()) {
    return {
      allowed: false,
      status: status || "expired",
      reason: "invitation_expired",
    };
  }

  if (status && BLOCK_STATUSES.has(status)) {
    return {
      allowed: false,
      status,
      reason: `invitation_${status}`,
    };
  }

  if (inviteEnabled || (status && ALLOW_STATUSES.has(status))) {
    return {
      allowed: true,
      status: status || "invited",
      reason: "invitation_allowed",
    };
  }

  return {
    allowed: true,
    status: status || "open_access",
    reason: "open_access_default",
  };
}

export async function getGmailInvitationAccess(uid: string): Promise<GmailInvitationAccess> {
  const userSnap = await admin.firestore().collection("users").doc(uid).get();
  const userData = asRecord(userSnap.data());
  const gmailSync = asRecord(userData.gmailSync);
  const embeddedInvite = asRecord(userData.gmailSyncInvitation);

  // If user is already connected, allow maintenance actions on the channel.
  if (asBoolean(gmailSync.connected)) {
    return {
      allowed: true,
      status: "connected",
      reason: "already_connected",
    };
  }

  const embeddedDecision = computeInviteDecision({
    ...embeddedInvite,
    inviteEnabled: gmailSync.inviteEnabled,
    inviteStatus: gmailSync.inviteStatus,
  });

  const inviteDoc = await admin.firestore().collection("gmail_sync_invitations").doc(uid).get();
  const inviteDecision = inviteDoc.exists ? computeInviteDecision(asRecord(inviteDoc.data())) : null;

  if (!embeddedDecision.allowed) return embeddedDecision;
  if (inviteDecision && !inviteDecision.allowed) return inviteDecision;

  if (inviteDecision?.allowed && inviteDecision.reason !== "open_access_default") {
    return inviteDecision;
  }
  if (embeddedDecision.allowed && embeddedDecision.reason !== "open_access_default") {
    return embeddedDecision;
  }

  return {
    allowed: true,
    status: "open_access",
    reason: "open_access_default",
  };
}

export async function assertGmailInvitationOrThrow(uid: string): Promise<GmailInvitationAccess> {
  const access = await getGmailInvitationAccess(uid);
  if (!access.allowed) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "La sincronización Gmail está habilitada solo por invitación para esta cuenta."
    );
  }
  return access;
}
