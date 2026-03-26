import { doc, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions as firebaseFunctions } from "../../lib/firebase";

export interface GmailSyncStatus {
  connected: boolean;
  accountEmail: string | null;
  grantedScopes: string[];
  updatedAt: string | null;
  inviteEnabled: boolean;
  inviteStatus: string;
  inviteReason: string | null;
}

const DEFAULT_STATUS: GmailSyncStatus = {
  connected: false,
  accountEmail: null,
  grantedScopes: [],
  updatedAt: null,
  inviteEnabled: true,
  inviteStatus: "open_access",
  inviteReason: null,
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toInviteDecision(data: Record<string, unknown>): { enabled: boolean; status: string; reason: string | null } {
  const allowedStatuses = new Set(["invited", "enabled", "approved", "accepted", "connected", "active"]);
  const blockedStatuses = new Set(["blocked", "revoked", "disabled", "denied", "expired"]);

  const enabled = data.enabled === true
    || data.allowed === true
    || data.inviteEnabled === true
    || data.isEnabled === true;

  const status = asString(data.status || data.inviteStatus || data.state).toLowerCase();
  const reason = asString(data.reason || data.inviteReason || data.lastReason) || null;

  if (status && blockedStatuses.has(status)) {
    return { enabled: false, status, reason: reason || `invitation_${status}` };
  }

  if (enabled || (status && allowedStatuses.has(status))) {
    return { enabled: true, status: status || "invited", reason: null };
  }

  return {
    enabled: true,
    status: status || "open_access",
    reason: null,
  };
}

export function subscribeGmailSyncStatus(
  userId: string,
  onChange: (status: GmailSyncStatus) => void
) {
  return onSnapshot(
    doc(db, "users", userId),
    (snap) => {
      if (!snap.exists()) {
        onChange(DEFAULT_STATUS);
        return;
      }
      const data = snap.data() as Record<string, unknown>;
      const gmailSync = asRecord(data.gmailSync);
      const gmailSyncInvitation = asRecord(data.gmailSyncInvitation);

      const connected = Boolean(gmailSync.connected);
      const accountEmail = typeof gmailSync.accountEmail === "string" ? gmailSync.accountEmail : null;
      const grantedScopes = Array.isArray(gmailSync.grantedScopes)
        ? gmailSync.grantedScopes.filter((scope): scope is string => typeof scope === "string")
        : [];
      const updatedAt = typeof gmailSync.updatedAt === "string" ? gmailSync.updatedAt : null;

      const inviteFromEmbedded = toInviteDecision({
        ...gmailSyncInvitation,
        inviteEnabled: gmailSync.inviteEnabled,
        inviteStatus: gmailSync.inviteStatus,
      });
      const inviteEnabled = connected ? true : inviteFromEmbedded.enabled;
      const inviteStatus = connected ? "connected" : inviteFromEmbedded.status;
      const inviteReason = connected ? null : inviteFromEmbedded.reason;

      onChange({
        connected,
        accountEmail,
        grantedScopes,
        updatedAt,
        inviteEnabled,
        inviteStatus,
        inviteReason,
      });
    },
    () => onChange(DEFAULT_STATUS)
  );
}

export async function getGmailConnectUrl(
  params?: { returnOrigin?: string; returnPath?: string; petId?: string; includeCalendar?: boolean }
): Promise<string> {
  const callable = httpsCallable<
    { returnOrigin?: string; returnPath?: string; petId?: string; includeCalendar?: boolean },
    { url: string }
  >(
    firebaseFunctions,
    "getGmailConnectUrl"
  );
  const result = await callable({
    returnOrigin: params?.returnOrigin || window.location.origin,
    returnPath: params?.returnPath || "/home",
    petId: params?.petId,
    includeCalendar: params?.includeCalendar === true,
  });
  return result.data.url;
}

export async function startGmailConnectFlow(params?: { returnPath?: string; petId?: string; includeCalendar?: boolean }): Promise<void> {
  try {
    const url = await getGmailConnectUrl({
      returnOrigin: window.location.origin,
      returnPath: params?.returnPath || "/home",
      petId: params?.petId,
      includeCalendar: params?.includeCalendar,
    });
    window.location.assign(url);
  } catch (err: any) {
    // Traducir errores de rate-limit/bloqueo del backend a mensajes legibles
    const msg = err?.message || "";
    if (msg.includes("oauth_temporarily_blocked")) {
      throw new Error("Demasiados intentos fallidos. Esperá una hora antes de volver a intentar.");
    }
    if (msg.includes("oauth_rate_limit_exceeded")) {
      throw new Error("Demasiados intentos en poco tiempo. Esperá unos minutos antes de reintentar.");
    }
    throw err;
  }
}

export async function disconnectGmailSync(): Promise<void> {
  const callable = httpsCallable(firebaseFunctions, "disconnectGmailSync");
  await callable({});
}

export async function triggerEmailClinicalIngestion(params?: { petId?: string }): Promise<{ session_id: string }> {
  const callable = httpsCallable<{ petId?: string }, { ok: boolean; session_id: string }>(
    firebaseFunctions,
    "triggerEmailClinicalIngestion"
  );
  const result = await callable({ petId: params?.petId });
  return { session_id: result.data.session_id };
}
