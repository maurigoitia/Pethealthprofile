import * as admin from "firebase-admin";

export interface NotificationSettings {
  enabled?: boolean;
  vaccines?: boolean;
  appointments?: boolean;
  medications?: boolean;
  results?: boolean;
}

const userSettingsCache = new Map<string, NotificationSettings>();
const userTokenCache = new Map<string, string | null>();
const userTimezoneCache = new Map<string, string>();
const petNameCache = new Map<string, string>();

export async function getUserSettings(userId: string): Promise<NotificationSettings> {
  if (userSettingsCache.has(userId)) return userSettingsCache.get(userId)!;
  const userSnap = await admin.firestore().collection("users").doc(userId).get();
  const settings = (userSnap.data()?.notificationSettings || {}) as NotificationSettings;
  userSettingsCache.set(userId, settings);
  return settings;
}

export async function getUserTokenAndTimezone(userId: string): Promise<{ token: string | null; timezone: string }> {
  let token = userTokenCache.get(userId);
  let timezone = userTimezoneCache.get(userId);

  if (token === undefined || !timezone) {
    const tokenCol = admin.firestore().collection("users").doc(userId).collection("fcm_tokens");
    const primaryDoc = await tokenCol.doc("primary").get();
    if (primaryDoc.exists) {
      token = (primaryDoc.data()?.token as string | undefined) || null;
      timezone = (primaryDoc.data()?.timezone as string | undefined) || "UTC";
    } else {
      const fallbackSnap = await tokenCol.limit(1).get();
      if (!fallbackSnap.empty) {
        const fallback = fallbackSnap.docs[0].data();
        token = (fallback?.token as string | undefined) || null;
        timezone = (fallback?.timezone as string | undefined) || "UTC";
      } else {
        token = null;
        timezone = "UTC";
      }
    }

    userTokenCache.set(userId, token);
    userTimezoneCache.set(userId, timezone);
  }

  return { token: token || null, timezone: timezone || "UTC" };
}

export async function resolvePetName(petId: string): Promise<string> {
  if (!petId) return "tu mascota";
  if (petNameCache.has(petId)) return petNameCache.get(petId)!;
  const petSnap = await admin.firestore().collection("pets").doc(petId).get();
  const name = petSnap.exists ? (petSnap.data()?.name as string | undefined) || "tu mascota" : "tu mascota";
  petNameCache.set(petId, name);
  return name;
}

export async function getUserEmail(userId: string): Promise<string | null> {
  try {
    const userRecord = await admin.auth().getUser(userId);
    return userRecord.email || null;
  } catch {
    return null;
  }
}
