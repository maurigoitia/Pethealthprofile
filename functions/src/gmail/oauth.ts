import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { randomBytes } from "crypto";
import { initializeEmailIngestionAfterOauth } from "./clinicalIngestion";
import { assertGmailInvitationOrThrow, getGmailInvitationAccess } from "./invitation";
import { saveGmailToken, loadGmailToken, deleteGmailToken } from "./secretManager";
import { checkRateLimitByTier } from "../utils/rateLimiter";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const GOOGLE_GMAIL_PROFILE_URL = "https://gmail.googleapis.com/gmail/v1/users/me/profile";
const STATE_TTL_MS = 10 * 60 * 1000;
const OAUTH_ATTEMPT_WINDOW_MS = 60 * 60 * 1000;
const OAUTH_BLOCK_DURATION_MS = 60 * 60 * 1000;
const OAUTH_MAX_ATTEMPTS_PER_WINDOW = 10;
const OAUTH_MAX_CONSECUTIVE_FAILURES = 3;

const BASE_GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
];
const REQUIRED_GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const OPTIONAL_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

function buildGmailScopes(includeCalendar: boolean): string {
  const scopes = includeCalendar ? [...BASE_GMAIL_SCOPES, OPTIONAL_CALENDAR_SCOPE] : BASE_GMAIL_SCOPES;
  return scopes.join(" ");
}

const ALLOWED_RETURN_ORIGINS = new Set([
  "https://pessy.app",
  "https://www.pessy.app",
  "https://app.pessy.app",
  "https://polar-scene-488615-i0.web.app",
  "http://localhost:5173",
  "http://localhost:4173",
]);

const ALLOWED_RETURN_PATHS = new Set([
  "/home",
  "/register-pet",
  "/register-pet/step2",
]);

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  id_token?: string;
}

interface GmailProfileResponse {
  emailAddress?: string;
}

interface GmailMessageListResponse {
  messages?: Array<{ id?: string }>;
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

interface GmailHeader {
  name?: string;
  value?: string;
}

interface GmailMessagePart {
  mimeType?: string;
  filename?: string;
  body?: {
    attachmentId?: string;
    size?: number;
  };
  parts?: GmailMessagePart[];
}

interface GmailMessageDetailResponse {
  id?: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: {
    headers?: GmailHeader[];
    parts?: GmailMessagePart[];
  };
}

interface SyncAppointmentCalendarInput {
  appointmentId?: string;
  petName?: string | null;
  title?: string;
  date?: string;
  time?: string;
  clinic?: string | null;
  veterinarian?: string | null;
  notes?: string | null;
  status?: "upcoming" | "completed" | "cancelled";
  googleCalendarEventId?: string | null;
  timeZone?: string | null;
}

interface CalendarEventApiResponse {
  id?: string;
  htmlLink?: string;
}

function getEnvOrThrow(name: string): string {
  const value = (process.env[name] || "").trim();
  if (!value) {
    throw new functions.https.HttpsError("failed-precondition", `${name} no configurada.`);
  }
  return value;
}

function pickSingleQueryParam(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return "";
}

function normalizeReturnOrigin(input: unknown): string | null {
  if (typeof input !== "string" || !input.trim()) return null;
  try {
    const parsed = new URL(input);
    const normalized = parsed.origin;
    return ALLOWED_RETURN_ORIGINS.has(normalized) ? normalized : null;
  } catch {
    return null;
  }
}

function getDefaultAppOrigin(): string {
  return "https://pessy.app";
}

function normalizeReturnPath(input: unknown): string {
  if (typeof input !== "string") return "/home";
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) return "/home";
  if (trimmed.startsWith("//")) return "/home";
  return ALLOWED_RETURN_PATHS.has(trimmed) ? trimmed : "/home";
}

function buildRedirectUrl(
  origin: string,
  path: string,
  params: { status: "connected" | "error"; reason?: string; email?: string }
): string {
  const url = new URL(path, origin);
  url.searchParams.set("gmail_sync", params.status);
  if (params.reason) url.searchParams.set("reason", params.reason.slice(0, 80));
  if (params.email) url.searchParams.set("gmail_email", params.email.slice(0, 120));
  return url.toString();
}

/**
 * SCRUM-8: Verifica la firma del id_token usando Firebase Admin SDK.
 * Reemplaza la decodificación manual sin verificación de firma.
 * Un atacante podría forjar un JWT sin verificación — esto lo previene.
 */
async function verifyIdTokenAndGetEmail(idToken: string | undefined): Promise<string | null> {
  if (!idToken) return null;
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    return decoded.email ?? null;
  } catch (err) {
    console.error("[oauth] id_token verification failed:", err);
    return null;
  }
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function addMinutesToDateTime(date: string, time: string, minutes: number): string {
  const [year, month, day] = date.split("-").map((v) => Number(v));
  const [hour, minute] = time.split(":").map((v) => Number(v));
  if (!year || !month || !day) return `${date}T${time}:00`;
  const local = new Date(year, month - 1, day, Number.isFinite(hour) ? hour : 9, Number.isFinite(minute) ? minute : 0, 0);
  local.setMinutes(local.getMinutes() + minutes);
  const yyyy = local.getFullYear();
  const mm = String(local.getMonth() + 1).padStart(2, "0");
  const dd = String(local.getDate()).padStart(2, "0");
  const hh = String(local.getHours()).padStart(2, "0");
  const min = String(local.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}:00`;
}

async function exchangeRefreshTokenForAccessToken(params: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<string> {
  const body = new URLSearchParams({
    client_id: params.clientId,
    client_secret: params.clientSecret,
    refresh_token: params.refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`refresh_token_exchange_failed_${response.status}: ${text.slice(0, 250)}`);
  }

  const payload = (await response.json()) as GoogleTokenResponse;
  const accessToken = asNonEmptyString(payload.access_token);
  if (!accessToken) {
    throw new Error("missing_access_token_from_refresh");
  }
  return accessToken;
}

async function callGoogleCalendarApi<T>(params: {
  method: "POST" | "PATCH" | "DELETE";
  accessToken: string;
  eventId?: string;
  body?: Record<string, unknown>;
}): Promise<T | null> {
  const baseUrl = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
  const url = params.eventId ? `${baseUrl}/${encodeURIComponent(params.eventId)}` : baseUrl;
  const response = await fetch(url, {
    method: params.method,
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      Accept: "application/json",
      ...(params.body ? { "Content-Type": "application/json" } : {}),
    },
    ...(params.body ? { body: JSON.stringify(params.body) } : {}),
  });

  if (params.method === "DELETE" && response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`calendar_api_failed_${response.status}: ${text.slice(0, 250)}`);
  }

  if (params.method === "DELETE") return null;
  return (await response.json()) as T;
}

async function callGoogleJson<T>(url: string, accessToken: string): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`google_api_failed_${response.status}: ${body.slice(0, 250)}`);
  }

  return (await response.json()) as T;
}

async function fetchGmailAccountEmail(accessToken: string): Promise<string | null> {
  try {
    const profile = await callGoogleJson<GmailProfileResponse>(GOOGLE_GMAIL_PROFILE_URL, accessToken);
    return typeof profile.emailAddress === "string" ? profile.emailAddress : null;
  } catch {
    return null;
  }
}

async function verifyGmailFullPayloadAccess(accessToken: string): Promise<void> {
  const listUrl = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
  listUrl.searchParams.set("maxResults", "1");
  const listResponse = await callGoogleJson<GmailMessageListResponse>(listUrl.toString(), accessToken);
  const messageId = (listResponse.messages || [])
    .map((row) => (typeof row.id === "string" ? row.id : ""))
    .find(Boolean);

  // If inbox is empty, list access itself is enough to validate token + scope.
  if (!messageId) return;

  const messageUrl = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`);
  messageUrl.searchParams.set("format", "full");
  const detail = await callGoogleJson<GmailMessageDetailResponse>(messageUrl.toString(), accessToken);
  if (!detail.payload) {
    throw new Error("gmail_full_payload_unavailable");
  }
}

async function revokeGoogleToken(token: string): Promise<void> {
  if (!token.trim()) return;
  const body = new URLSearchParams({ token });
  await fetch(GOOGLE_REVOKE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  }).catch(() => undefined);
}

async function checkAndRegisterOAuthAttempt(uid: string): Promise<void> {
  const now = Date.now();
  const attemptsRef = admin.firestore().collection("gmail_oauth_attempts").doc(uid);
  let limitReason: "oauth_temporarily_blocked" | "oauth_rate_limit_exceeded" | null = null;

  await admin.firestore().runTransaction(async (tx) => {
    const snap = await tx.get(attemptsRef);
    const data = (snap.data() || {}) as Record<string, unknown>;
    const blockedUntilMs = typeof data.blockedUntilMs === "number" ? data.blockedUntilMs : 0;
    const currentWindowStartMs = typeof data.windowStartMs === "number" ? data.windowStartMs : now;
    const sameWindow = now - currentWindowStartMs < OAUTH_ATTEMPT_WINDOW_MS;
    const attemptsInWindowRaw = typeof data.attemptsInWindow === "number" ? data.attemptsInWindow : 0;
    const attemptsInWindow = sameWindow ? attemptsInWindowRaw : 0;

    if (blockedUntilMs > now) {
      limitReason = "oauth_temporarily_blocked";
      return;
    }

    if (attemptsInWindow >= OAUTH_MAX_ATTEMPTS_PER_WINDOW) {
      const nextBlockedUntil = now + OAUTH_BLOCK_DURATION_MS;
      tx.set(
        attemptsRef,
        {
          blockedUntilMs: nextBlockedUntil,
          lastErrorCode: "oauth_rate_limit_exceeded",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      limitReason = "oauth_rate_limit_exceeded";
      return;
    }

    tx.set(
      attemptsRef,
      {
        windowStartMs: sameWindow ? currentWindowStartMs : now,
        attemptsInWindow: attemptsInWindow + 1,
        lastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });

  if (limitReason) {
    throw new Error(limitReason);
  }
}

async function markOAuthAttemptSuccess(uid: string): Promise<void> {
  const attemptsRef = admin.firestore().collection("gmail_oauth_attempts").doc(uid);
  await attemptsRef.set(
    {
      consecutiveFailures: 0,
      lastSuccessAt: admin.firestore.FieldValue.serverTimestamp(),
      lastErrorCode: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

async function markOAuthAttemptFailure(uid: string, code: string): Promise<void> {
  const now = Date.now();
  const attemptsRef = admin.firestore().collection("gmail_oauth_attempts").doc(uid);
  const next = await admin.firestore().runTransaction(async (tx) => {
    const snap = await tx.get(attemptsRef);
    const data = (snap.data() || {}) as Record<string, unknown>;
    const currentFailures = typeof data.consecutiveFailures === "number" ? data.consecutiveFailures : 0;
    const nextFailures = currentFailures + 1;
    const shouldBlock = nextFailures >= OAUTH_MAX_CONSECUTIVE_FAILURES;

    tx.set(
      attemptsRef,
      {
        consecutiveFailures: nextFailures,
        lastFailureAt: admin.firestore.FieldValue.serverTimestamp(),
        lastErrorCode: code,
        blockedUntilMs: shouldBlock ? now + OAUTH_BLOCK_DURATION_MS : 0,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return { nextFailures, shouldBlock };
  });

  if (next.shouldBlock) {
    console.warn(`[gmailAuthCallback] UID ${uid} temporarily blocked after ${next.nextFailures} failures.`);
  }
}

async function exchangeCodeForGoogleToken(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    code: params.code,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: params.redirectUri,
    grant_type: "authorization_code",
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`token_exchange_failed_${response.status}: ${text.slice(0, 300)}`);
  }

  return (await response.json()) as GoogleTokenResponse;
}

export const getGmailConnectUrl = functions
  .runWith({
    secrets: ["GMAIL_OAUTH_CLIENT_ID", "GMAIL_OAUTH_REDIRECT_URI"],
  })
  .region("us-central1")
  .https.onCall(async (data, context) => {
    if (!context.auth?.uid) {
      throw new functions.https.HttpsError("unauthenticated", "Debes iniciar sesión.");
    }

    // SCRUM-20: Rate limit Gmail connect requests per user tier
    const gmailUserSnap = await admin.firestore().collection("users").doc(context.auth.uid).get();
    const gmailUserData = gmailUserSnap.data() || {};
    const gmailCandidatePlans = [gmailUserData.plan, gmailUserData.planType, gmailUserData.subscriptionPlan].join(" ").toLowerCase();
    const gmailUserIsPremium = ["premium", "pro", "founder", "unlimited"].some((t) => gmailCandidatePlans.includes(t));
    const gmailRl = await checkRateLimitByTier(context.auth.uid, "gmail-sync", gmailUserIsPremium);
    if (!gmailRl.allowed) {
      throw new functions.https.HttpsError(
        "resource-exhausted",
        `Límite de sincronización Gmail alcanzado. Reintentar en ${gmailRl.resetInSeconds}s.`
      );
    }

    await assertGmailInvitationOrThrow(context.auth.uid);

    const clientId = getEnvOrThrow("GMAIL_OAUTH_CLIENT_ID");
    const redirectUri = getEnvOrThrow("GMAIL_OAUTH_REDIRECT_URI");
    const returnOrigin = normalizeReturnOrigin(data?.returnOrigin) || getDefaultAppOrigin();
    const returnPath = normalizeReturnPath(data?.returnPath);
    const includeCalendar = data?.includeCalendar === true;
    const preferredPetId = typeof data?.petId === "string" ? data.petId.trim() : "";
    const state = randomBytes(20).toString("hex");

    await admin.firestore().collection("gmail_oauth_states").doc(state).set({
      uid: context.auth.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      used: false,
      returnOrigin,
      returnPath,
      includeCalendar,
      preferredPetId: preferredPetId || null,
    });

    const query = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: buildGmailScopes(includeCalendar),
      access_type: "offline",
      prompt: "consent",
      state,
    });

    return {
      url: `${GOOGLE_AUTH_URL}?${query.toString()}`,
      redirectUri,
    };
  });

export const gmailAuthCallback = functions
  .runWith({
    secrets: [
      "GMAIL_OAUTH_CLIENT_ID",
      "GMAIL_OAUTH_CLIENT_SECRET",
      "GMAIL_OAUTH_REDIRECT_URI",
      "MAIL_TOKEN_ENCRYPTION_KEY",
    ],
  })
  .region("us-central1")
  .https.onRequest(async (req, res) => {
    const state = pickSingleQueryParam(req.query.state);
    const code = pickSingleQueryParam(req.query.code);
    const authError = pickSingleQueryParam(req.query.error);

    if (!state) {
      res.redirect(buildRedirectUrl(getDefaultAppOrigin(), "/home", { status: "error", reason: "missing_state" }));
      return;
    }

    const stateRef = admin.firestore().collection("gmail_oauth_states").doc(state);
    const stateSnap = await stateRef.get();
    if (!stateSnap.exists) {
      res.redirect(buildRedirectUrl(getDefaultAppOrigin(), "/home", { status: "error", reason: "invalid_state" }));
      return;
    }

    const stateData = stateSnap.data() as {
      uid?: string;
      createdAt?: FirebaseFirestore.Timestamp;
      used?: boolean;
      returnOrigin?: string;
      returnPath?: string;
      preferredPetId?: string | null;
    };

    const redirectOrigin = normalizeReturnOrigin(stateData.returnOrigin) || getDefaultAppOrigin();
    const redirectPath = normalizeReturnPath(stateData.returnPath);
    const createdAtMs = stateData.createdAt?.toDate?.().getTime() || 0;
    const expired = !createdAtMs || Date.now() - createdAtMs > STATE_TTL_MS;
    const uid = stateData.uid || "";
    const preferredPetId = typeof stateData.preferredPetId === "string" ? stateData.preferredPetId : null;

    if (stateData.used || expired || !uid) {
      res.redirect(buildRedirectUrl(redirectOrigin, redirectPath, { status: "error", reason: "expired_state" }));
      return;
    }

    const inviteAccess = await getGmailInvitationAccess(uid);
    if (!inviteAccess.allowed) {
      const reason = inviteAccess.reason || "invite_required";
      await stateRef.set(
        {
          used: true,
          usedAt: admin.firestore.FieldValue.serverTimestamp(),
          completed: false,
          callbackError: reason,
        },
        { merge: true }
      );
      res.redirect(buildRedirectUrl(redirectOrigin, redirectPath, { status: "error", reason }));
      return;
    }

    try {
      await checkAndRegisterOAuthAttempt(uid);
    } catch (error) {
      const reason = String(error).includes("oauth_") ? String(error).replace("Error: ", "") : "rate_limited";
      await stateRef.set(
        {
          used: true,
          usedAt: admin.firestore.FieldValue.serverTimestamp(),
          completed: false,
          callbackError: reason,
        },
        { merge: true }
      );
      res.redirect(buildRedirectUrl(redirectOrigin, redirectPath, { status: "error", reason }));
      return;
    }

    if (authError) {
      await markOAuthAttemptFailure(uid, `oauth_error_${authError}`);
      await stateRef.set(
        {
          used: true,
          usedAt: admin.firestore.FieldValue.serverTimestamp(),
          error: authError,
        },
        { merge: true }
      );
      res.redirect(buildRedirectUrl(redirectOrigin, redirectPath, { status: "error", reason: authError }));
      return;
    }

    if (!code) {
      await markOAuthAttemptFailure(uid, "missing_code");
      await stateRef.set(
        {
          used: true,
          usedAt: admin.firestore.FieldValue.serverTimestamp(),
          completed: false,
          callbackError: "missing_code",
        },
        { merge: true }
      );
      res.redirect(buildRedirectUrl(redirectOrigin, redirectPath, { status: "error", reason: "missing_code" }));
      return;
    }

    try {
      const clientId = getEnvOrThrow("GMAIL_OAUTH_CLIENT_ID");
      const clientSecret = getEnvOrThrow("GMAIL_OAUTH_CLIENT_SECRET");
      const redirectUri = getEnvOrThrow("GMAIL_OAUTH_REDIRECT_URI");

      const tokenResponse = await exchangeCodeForGoogleToken({
        code,
        clientId,
        clientSecret,
        redirectUri,
      });

      const tokenRef = admin
        .firestore()
        .collection("users")
        .doc(uid)
        .collection("mail_sync_tokens")
        .doc("gmail");

      let refreshToken = (tokenResponse.refresh_token || "").trim();
      if (!refreshToken) {
        // SCRUM-7: Retrieve previous refresh token from Secret Manager (not Firestore)
        try {
          const previous = await loadGmailToken(uid);
          const previousRefresh = typeof previous?.refreshToken === "string" ? previous.refreshToken.trim() : "";
          if (previousRefresh) {
            refreshToken = previousRefresh;
            console.warn(
              `[gmailAuthCallback] refresh_token ausente en intercambio, reutilizando token previo para uid=${uid}`
            );
          }
        } catch (error) {
          console.error("[gmailAuthCallback] Failed to load existing refresh token:", error);
        }
      }

      if (!refreshToken) {
        throw new Error("missing_refresh_token");
      }

      const grantedScopes = (tokenResponse.scope || "")
        .split(" ")
        .map((scope) => scope.trim())
        .filter(Boolean);
      const hasRequiredReadonlyScope = grantedScopes.includes(REQUIRED_GMAIL_SCOPE);
      if (!hasRequiredReadonlyScope) {
        throw new Error("missing_gmail_readonly_scope");
      }

      const immediateAccessToken = (tokenResponse.access_token || "").trim();
      if (!immediateAccessToken) {
        throw new Error("missing_access_token_on_callback");
      }
      await verifyGmailFullPayloadAccess(immediateAccessToken).catch((error) => {
        console.error("[gmailAuthCallback] post-auth validation failed:", error);
        throw new Error("gmail_full_payload_validation_failed");
      });

      const tokenPayload = {
        refreshToken,
        accessToken: immediateAccessToken,
        tokenType: tokenResponse.token_type || "Bearer",
        expiresIn: Number(tokenResponse.expires_in || 0),
        grantedScopes,
      };

       // SCRUM-7: Store token in Secret Manager, not Firestore
      await saveGmailToken(uid, tokenPayload);
      let accountEmail = await verifyIdTokenAndGetEmail(tokenResponse.id_token);
      if (!accountEmail && immediateAccessToken) {
        accountEmail = await fetchGmailAccountEmail(immediateAccessToken);
      }

      // Keep Firestore record for metadata only (no credential data)
      await tokenRef.set(
        {
          hasToken: true,
          secretManagerRef: `gmail_token_${uid}`,
          grantedScopes,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      await admin.firestore().collection("users").doc(uid).set(
        {
          gmailSync: {
            connected: true,
            accountEmail: accountEmail || null,
            grantedScopes,
            updatedAt: new Date().toISOString(),
            connectedAt: new Date().toISOString(),
            consentGrantedAt: new Date().toISOString(),
            consentSource: "oauth",
            inviteEnabled: true,
            inviteStatus: "connected",
          },
          gmailSyncReminder: {
            status: "connected",
            dayNumber: 0,
            updatedAt: new Date().toISOString(),
            lastResolvedAt: new Date().toISOString(),
            lastError: null,
          },
        },
        { merge: true }
      );

      await admin.firestore().collection("userGmailConnections").doc(uid).set(
        {
          userId: uid,
          gmailConnected: true,
          userEmail: accountEmail || null,
          // SCRUM-7: tokens moved to Secret Manager
          lastSync: admin.firestore.FieldValue.serverTimestamp(),
          scopes: grantedScopes,
          expiresAt: admin.firestore.Timestamp.fromMillis(
            Date.now() + Math.max(Number(tokenResponse.expires_in || 0), 0) * 1000
          ),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      await stateRef.set(
        {
          used: true,
          usedAt: admin.firestore.FieldValue.serverTimestamp(),
          completed: true,
        },
        { merge: true }
      );

      await markOAuthAttemptSuccess(uid);

      if (immediateAccessToken) {
        await initializeEmailIngestionAfterOauth({
          uid,
          accountEmail: accountEmail || null,
          accessToken: immediateAccessToken,
          preferredPetId,
        }).catch((error) => {
          console.error("[gmailAuthCallback] Failed to initialize ingestion pipeline:", error);
        });

        // Initial ingestion pipeline handles scanning asynchronously.
      }

      res.redirect(
        buildRedirectUrl(redirectOrigin, redirectPath, {
          status: "connected",
          email: accountEmail || undefined,
        })
      );
    } catch (error) {
      console.error("[gmailAuthCallback] Error:", error);
      const errorMessage = String(error || "");
      const reason = errorMessage.includes("gmail_full_payload_validation_failed")
        ? "gmail_reconsent_required"
        : "oauth_callback_failed";
      await markOAuthAttemptFailure(uid, reason);
      await stateRef.set(
        {
          used: true,
          usedAt: admin.firestore.FieldValue.serverTimestamp(),
          completed: false,
          callbackError: String(error),
        },
        { merge: true }
      );
      res.redirect(buildRedirectUrl(redirectOrigin, redirectPath, { status: "error", reason }));
    }
  });

export const syncAppointmentCalendarEvent = functions
  .runWith({
    secrets: [
      "GMAIL_OAUTH_CLIENT_ID",
      "GMAIL_OAUTH_CLIENT_SECRET",
      "MAIL_TOKEN_ENCRYPTION_KEY",
    ],
  })
  .region("us-central1")
  .https.onCall(async (data: SyncAppointmentCalendarInput, context) => {
    if (!context.auth?.uid) {
      throw new functions.https.HttpsError("unauthenticated", "Debes iniciar sesión.");
    }

    const uid = context.auth.uid;
    const appointmentId = asNonEmptyString(data?.appointmentId);
    const status = data?.status || "upcoming";
    const date = asNonEmptyString(data?.date);
    const title = asNonEmptyString(data?.title);
    const normalizedTime = asNonEmptyString(data?.time) || "09:00";
    const timeZone = asNonEmptyString(data?.timeZone) || "UTC";
    const existingEventId = asNonEmptyString(data?.googleCalendarEventId);

    if (!appointmentId) {
      throw new functions.https.HttpsError("invalid-argument", "appointmentId es obligatorio.");
    }

    if (status === "cancelled" || status === "completed") {
      if (!existingEventId) {
        return { ok: true, action: "skipped", reason: "no_event_id" };
      }
    } else if (!date || !title) {
      throw new functions.https.HttpsError("invalid-argument", "Faltan fecha o título para sincronizar.");
    }

    // SCRUM-7: Load token from Secret Manager
    const tokenPayloadCalendar = await loadGmailToken(uid);
    if (!tokenPayloadCalendar) {
      return { ok: false, action: "skipped", reason: "gmail_not_connected" };
    }
    const refreshToken = asNonEmptyString(tokenPayloadCalendar.refreshToken);
    const grantedScopes = Array.isArray(tokenPayloadCalendar.grantedScopes)
      ? tokenPayloadCalendar.grantedScopes.filter((scope: unknown): scope is string => typeof scope === "string")
      : [];

    if (!refreshToken) {
      throw new functions.https.HttpsError("failed-precondition", "No hay refresh token de Gmail.");
    }

    if (!grantedScopes.includes("https://www.googleapis.com/auth/calendar.events")) {
      return { ok: false, action: "skipped", reason: "missing_calendar_scope" };
    }

    const clientId = getEnvOrThrow("GMAIL_OAUTH_CLIENT_ID");
    const clientSecret = getEnvOrThrow("GMAIL_OAUTH_CLIENT_SECRET");
    const accessToken = await exchangeRefreshTokenForAccessToken({
      refreshToken,
      clientId,
      clientSecret,
    });

    if (status === "cancelled" || status === "completed") {
      try {
        await callGoogleCalendarApi({
          method: "DELETE",
          accessToken,
          eventId: existingEventId || undefined,
        });
      } catch (error) {
        const message = String(error);
        if (message.includes("calendar_api_failed_403")) {
          return { ok: false, action: "error", reason: "calendar_forbidden" };
        }
        throw error;
      }

      return {
        ok: true,
        action: "deleted",
        eventId: existingEventId || null,
        syncedAt: new Date().toISOString(),
      };
    }

    const petName = asNonEmptyString(data?.petName);
    const veterinarian = asNonEmptyString(data?.veterinarian);
    const clinic = asNonEmptyString(data?.clinic);
    const notes = asNonEmptyString(data?.notes);
    const location = [clinic, veterinarian].filter(Boolean).join(" · ");
    const summary = petName ? `${title} — ${petName}` : title!;
    const startDateTime = `${date}T${normalizedTime}:00`;
    const endDateTime = addMinutesToDateTime(date!, normalizedTime, 45);
    const description = [
      notes,
      petName ? `Mascota: ${petName}` : null,
      veterinarian ? `Veterinario: ${veterinarian}` : null,
      clinic ? `Clínica: ${clinic}` : null,
      `Appointment ID: ${appointmentId}`,
    ].filter(Boolean).join("\n");

    const body: Record<string, unknown> = {
      summary,
      location: location || undefined,
      description,
      start: {
        dateTime: startDateTime,
        timeZone,
      },
      end: {
        dateTime: endDateTime,
        timeZone,
      },
      extendedProperties: {
        private: {
          pessyAppointmentId: appointmentId,
        },
      },
    };

    let event: CalendarEventApiResponse | null = null;
    let action: "created" | "updated" = "created";

    if (existingEventId) {
      try {
        event = await callGoogleCalendarApi<CalendarEventApiResponse>({
          method: "PATCH",
          accessToken,
          eventId: existingEventId,
          body,
        });
        action = "updated";
      } catch (error) {
        const message = String(error);
        if (!message.includes("calendar_api_failed_404")) throw error;
      }
    }

    if (!event) {
      event = await callGoogleCalendarApi<CalendarEventApiResponse>({
        method: "POST",
        accessToken,
        body,
      });
      action = "created";
    }

    return {
      ok: true,
      action,
      eventId: event?.id || null,
      htmlLink: event?.htmlLink || null,
      syncedAt: new Date().toISOString(),
    };
  });

export const disconnectGmailSync = functions
  .runWith({
    secrets: ["MAIL_TOKEN_ENCRYPTION_KEY"],
  })
  .region("us-central1")
  .https.onCall(async (_data, context) => {
    if (!context.auth?.uid) {
      throw new functions.https.HttpsError("unauthenticated", "Debes iniciar sesión.");
    }

    const uid = context.auth.uid;
    const tokenRef = admin
      .firestore()
      .collection("users")
      .doc(uid)
      .collection("mail_sync_tokens")
      .doc("gmail");

    // SCRUM-7: Load token from Secret Manager, revoke, then delete secret
    try {
      const existingPayload = await loadGmailToken(uid);
      if (typeof existingPayload?.refreshToken === "string" && existingPayload.refreshToken) {
        await revokeGoogleToken(existingPayload.refreshToken as string);
      }
    } catch (error) {
      console.error("[disconnectGmailSync] Failed to load/revoke token:", error);
    }
    await deleteGmailToken(uid);
    await tokenRef.delete().catch(() => undefined);

    await admin.firestore().collection("users").doc(uid).set(
      {
        gmailSync: {
          connected: false,
          accountEmail: null,
          grantedScopes: [],
          updatedAt: new Date().toISOString(),
          disconnectedAt: new Date().toISOString(),
          consentRevokedAt: new Date().toISOString(),
        },
        gmailSyncReminder: {
          status: "pending_permission",
          dayNumber: 0,
          consentRequestedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastError: null,
        },
      },
      { merge: true }
    );

    await admin.firestore().collection("user_email_config").doc(uid).set(
      {
        gmail_account: null,
        ingestion_status: "idle",
        sync_status: "idle",
        token_encrypted: false,
        updated_at: new Date().toISOString(),
      },
      { merge: true }
    );

    const sessions = await admin
      .firestore()
      .collection("gmail_ingestion_sessions")
      .where("user_id", "==", uid)
      .limit(100)
      .get();
    await Promise.all(
      sessions.docs
        .filter((doc) => {
          const data = doc.data() as Record<string, unknown>;
          const status = asNonEmptyString(data.status);
          return status === "queued" || status === "processing";
        })
        .map((doc) => doc.ref.delete().catch(() => undefined))
    );

    const rawTmpDocs = await admin
      .firestore()
      .collection("gmail_raw_documents_tmp")
      .where("user_id", "==", uid)
      .limit(100)
      .get();
    await Promise.all(rawTmpDocs.docs.map((doc) => doc.ref.delete().catch(() => undefined)));

    await admin.firestore().collection("userGmailConnections").doc(uid).set(
      {
        gmailConnected: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return { ok: true };
  });
