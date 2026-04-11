import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

function getDb() { return admin.firestore(); }

// ─── HAVERSINE DISTANCE (km) ───
function distanceKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── NIGHT WINDOW CHECK (23:00–08:00) ───
function isNightWindow(): boolean {
  const hour = new Date().getUTCHours() - 3; // UTC-3 (Argentina)
  const localHour = ((hour % 24) + 24) % 24;
  return localHour >= 23 || localHour < 8;
}

// ─── ON LOST PET CREATED → GEO-ALERT PUSH NOTIFICATIONS ───
// Triggers when a new lost_pets document is created.
// Finds nearby users (within expanding radius) and sends FCM push.
export const onLostPetReport = functions.firestore
  .document("lost_pets/{reportId}")
  .onCreate(async (snap, context) => {
    const report = snap.data();
    const reportId = context.params.reportId;

    if (!report || report.status !== "active") return;

    const loc = report.lastSeenLocation;
    if (!loc || typeof loc.lat !== "number" || typeof loc.lng !== "number") {
      functions.logger.warn(`Lost pet ${reportId}: missing location`);
      return;
    }

    // Radius tiers: alert nearby users first, expand over time
    const radiusKm = report.alertRadiusKm || 5;
    const petName = report.petSnapshot?.name || "una mascota";
    const breed = report.petSnapshot?.breed || "";

    try {
      // Get all users with FCM tokens
      const usersSnap = await getDb().collectionGroup("fcm_tokens").get();
      const tokensByUser = new Map<string, string[]>();

      for (const doc of usersSnap.docs) {
        const userId = doc.ref.parent.parent?.id;
        if (!userId || userId === report.reportedBy) continue;
        const token = doc.data().token;
        if (token) {
          const existing = tokensByUser.get(userId) || [];
          existing.push(token);
          tokensByUser.set(userId, existing);
        }
      }

      // Get user locations from their pets (approximation)
      // Users whose pets have location data within radius
      const nearbyTokens: string[] = [];
      const petsSnap = await getDb().collection("pets").get();

      for (const petDoc of petsSnap.docs) {
        const pet = petDoc.data();
        const ownerId = pet.ownerId;
        if (!ownerId || ownerId === report.reportedBy) continue;

        // Check if user has location from preferences or pet data
        const userPrefsDoc = await getDb().doc(`user_preferences/${ownerId}`).get();
        const userLoc = userPrefsDoc.data()?.lastKnownLocation;

        if (userLoc && typeof userLoc.lat === "number" && typeof userLoc.lng === "number") {
          const dist = distanceKm(loc.lat, loc.lng, userLoc.lat, userLoc.lng);
          if (dist <= radiusKm) {
            const tokens = tokensByUser.get(ownerId);
            if (tokens) nearbyTokens.push(...tokens);
          }
        }
      }

      if (nearbyTokens.length === 0) {
        functions.logger.info(`Lost pet ${reportId}: no nearby users within ${radiusKm}km`);
        return;
      }

      // Send FCM multicast
      const message: admin.messaging.MulticastMessage = {
        tokens: nearbyTokens.slice(0, 500), // FCM limit
        notification: {
          title: `🐾 Mascota perdida cerca tuyo`,
          body: breed
            ? `${petName} (${breed}) se perdió cerca de tu zona. ¿La viste?`
            : `${petName} se perdió cerca de tu zona. ¿La viste?`,
        },
        data: {
          type: "lost_pet_alert",
          reportId,
          petName,
        },
        webpush: {
          fcmOptions: { link: `https://pessy.app/inicio` },
        },
      };

      const result = await admin.messaging().sendEachForMulticast(message);
      functions.logger.info(
        `Lost pet ${reportId}: sent ${result.successCount}/${nearbyTokens.length} push notifications`
      );

      // Clean up invalid tokens
      const invalidTokens: string[] = [];
      result.responses.forEach((resp, idx) => {
        if (!resp.success && resp.error?.code === "messaging/registration-token-not-registered") {
          invalidTokens.push(nearbyTokens[idx]);
        }
      });

      if (invalidTokens.length > 0) {
        const batch = getDb().batch();
        for (const token of invalidTokens) {
          const tokenSnap = await getDb().collectionGroup("fcm_tokens")
            .where("token", "==", token).limit(1).get();
          tokenSnap.docs.forEach((d) => batch.delete(d.ref));
        }
        await batch.commit();
        functions.logger.info(`Cleaned ${invalidTokens.length} invalid FCM tokens`);
      }
    } catch (err) {
      functions.logger.error(`Lost pet ${reportId}: push error`, err);
    }
  });

// ─── ON SIGHTING → NOTIFY PET OWNER ───
export const onPetSighting = functions.firestore
  .document("lost_pet_sightings/{sightingId}")
  .onCreate(async (snap, context) => {
    const sighting = snap.data();
    if (!sighting || !sighting.lostPetReportId) return;

    try {
      const reportDoc = await getDb().doc(`lost_pets/${sighting.lostPetReportId}`).get();
      const report = reportDoc.data();
      if (!report || report.status !== "active") return;

      const ownerId = report.reportedBy;
      const petName = report.petSnapshot?.name || "tu mascota";

      // Get owner FCM tokens
      const tokensSnap = await getDb().collection(`users/${ownerId}/fcm_tokens`).get();
      const tokens = tokensSnap.docs.map((d) => d.data().token).filter(Boolean);

      if (tokens.length === 0) return;

      const loc = sighting.location;
      let distanceText = "";
      if (loc && report.lastSeenLocation) {
        const dist = distanceKm(
          report.lastSeenLocation.lat, report.lastSeenLocation.lng,
          loc.lat, loc.lng
        );
        distanceText = ` a ~${dist.toFixed(1)}km de donde se perdió`;
      }

      const message: admin.messaging.MulticastMessage = {
        tokens: tokens.slice(0, 10),
        notification: {
          title: `👀 ¡Posible avistamiento de ${petName}!`,
          body: `Alguien reportó haber visto a ${petName}${distanceText}.`,
        },
        data: {
          type: "pet_sighting",
          reportId: sighting.lostPetReportId,
          sightingId: context.params.sightingId,
        },
        webpush: {
          fcmOptions: { link: `https://pessy.app/inicio` },
        },
      };

      await admin.messaging().sendEachForMulticast(message);
      functions.logger.info(`Sighting notification sent to owner ${ownerId} for pet ${petName}`);

      // Update sighting count on the report
      await reportDoc.ref.update({
        sightingCount: admin.firestore.FieldValue.increment(1),
        lastSightingAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (err) {
      functions.logger.error(`Sighting notification error`, err);
    }
  });

// ─── ADOPTION MATCHING (callable) ───
// Client sends adopter profile, returns scored matches from active listings.
interface AdopterInput {
  livingSpace: "apartment_small" | "apartment_large" | "house_no_yard" | "house_yard";
  experience: "none" | "beginner" | "intermediate" | "expert";
  hasOtherPets: boolean;
  otherPetTypes?: string[];
  activityLevel: "low" | "moderate" | "high";
  hoursAlonePerDay: number;
}

const WEIGHTS = {
  livingSpace: 25,
  experience: 25,
  otherPets: 20,
  activity: 15,
  schedule: 15,
};

function scoreLivingSpace(adopter: AdopterInput, pet: any): number {
  const size = pet.size || "medium";
  const space = adopter.livingSpace;
  if (size === "large" && space === "apartment_small") return 0.2;
  if (size === "large" && space === "apartment_large") return 0.5;
  if (size === "large" && space.startsWith("house")) return 1.0;
  if (size === "medium" && space === "apartment_small") return 0.5;
  if (size === "small") return space === "apartment_small" ? 0.8 : 1.0;
  return 0.7;
}

function scoreExperience(adopter: AdopterInput, pet: any): number {
  const exp = adopter.experience;
  const needs = pet.specialNeeds || false;
  if (needs && exp === "none") return 0.1;
  if (needs && exp === "beginner") return 0.3;
  if (needs) return exp === "expert" ? 1.0 : 0.7;
  if (exp === "none") return 0.5;
  return exp === "expert" ? 1.0 : 0.8;
}

function scoreOtherPets(adopter: AdopterInput, pet: any): number {
  if (!adopter.hasOtherPets) return 1.0;
  const friendly = pet.goodWithOtherPets ?? true;
  return friendly ? 0.9 : 0.3;
}

function scoreActivity(adopter: AdopterInput, pet: any): number {
  const petEnergy = pet.energyLevel || "moderate";
  const adopterLevel = adopter.activityLevel;
  if (petEnergy === adopterLevel) return 1.0;
  if (petEnergy === "high" && adopterLevel === "low") return 0.2;
  if (petEnergy === "low" && adopterLevel === "high") return 0.5;
  return 0.7;
}

function scoreSchedule(adopter: AdopterInput, pet: any): number {
  const hours = adopter.hoursAlonePerDay;
  const species = pet.species || "dog";
  if (species === "cat") return hours <= 12 ? 1.0 : 0.5;
  if (hours <= 4) return 1.0;
  if (hours <= 6) return 0.8;
  if (hours <= 8) return 0.5;
  return 0.2;
}

function getMatchLabel(score: number): string {
  if (score >= 80) return "excellent";
  if (score >= 60) return "good";
  if (score >= 40) return "possible";
  return "incompatible";
}

export const computeAdoptionMatches = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login required");

  const adopter = data as AdopterInput;
  if (!adopter.livingSpace || !adopter.experience || !adopter.activityLevel) {
    throw new functions.https.HttpsError("invalid-argument", "Missing adopter profile fields");
  }

  // Get active adoption listings
  const listingsSnap = await getDb().collection("adoption_listings")
    .where("status", "==", "active")
    .limit(50)
    .get();

  const matches = listingsSnap.docs.map((doc) => {
    const pet = doc.data().petProfile || doc.data();
    const ls = scoreLivingSpace(adopter, pet) * WEIGHTS.livingSpace;
    const ex = scoreExperience(adopter, pet) * WEIGHTS.experience;
    const op = scoreOtherPets(adopter, pet) * WEIGHTS.otherPets;
    const ac = scoreActivity(adopter, pet) * WEIGHTS.activity;
    const sc = scoreSchedule(adopter, pet) * WEIGHTS.schedule;
    const total = Math.round(ls + ex + op + ac + sc);

    return {
      listingId: doc.id,
      petName: pet.name || "Sin nombre",
      species: pet.species || "dog",
      breed: pet.breed || "",
      photo: pet.photo || null,
      score: total,
      label: getMatchLabel(total),
    };
  });

  // Sort by score descending
  matches.sort((a, b) => b.score - a.score);

  return { matches };
});

// ─── ON NEW ADOPTION LISTING → SEARCH_MATCH + ADOPT_MATCH PUSH ───
// Triggers when a new adoption_listings document is created.
// 1. Checks all active searchAlerts for matching species/breed → SEARCH_MATCH push
// 2. Finds compatible users based on their profile → ADOPT_MATCH push (max 2/day)
export const onNewAdoptionListing = functions.firestore
  .document("adoption_listings/{listingId}")
  .onCreate(async (snap, context) => {
    const listing = snap.data();
    const listingId = context.params.listingId;

    if (!listing || listing.status !== "active") return;

    const pet = listing.petProfile || listing;
    const petSpecies: string = pet.species || "dog";
    const petBreed: string = (pet.breed || "").toLowerCase();
    const petName: string = pet.name || "una mascota";
    const listingOwnerId: string = listing.ownerId || "";
    const listingLoc = listing.location; // { lat, lng }

    const now = Date.now();
    const nightWindow = isNightWindow();

    try {
      // ── 1. SEARCH_MATCH: check active searchAlerts ──
      const alertsSnap = await getDb().collection("searchAlerts")
        .where("status", "==", "active")
        .get();

      const searchMatchBatch: Promise<void>[] = [];

      for (const alertDoc of alertsSnap.docs) {
        const alert = alertDoc.data();
        if (!alert || alert.userId === listingOwnerId) continue;

        // Check expiry
        if (alert.expiresAt && alert.expiresAt.toMillis() < now) {
          await alertDoc.ref.update({ status: "expired" });
          continue;
        }

        // Species match (required)
        if (alert.species && alert.species !== petSpecies) continue;

        // Breed match (optional — skip if no breed specified in alert)
        if (alert.breed) {
          const alertBreed = alert.breed.toLowerCase();
          if (!petBreed.includes(alertBreed) && !alertBreed.includes(petBreed)) continue;
        }

        // Respect night window
        if (nightWindow) continue;

        // Rate limit: max 3 pushes per alert per week
        const matchesNotified: string[] = alert.matchesNotified || [];
        const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
        const recentNotifications = (alert.matchesNotifiedAt || []) as number[];
        const recentCount = recentNotifications.filter((t: number) => t > oneWeekAgo).length;
        if (recentCount >= 3) {
          functions.logger.info(`Alert ${alertDoc.id}: weekly limit reached, skipping`);
          continue;
        }

        // Already notified about this listing?
        if (matchesNotified.includes(listingId)) continue;

        // Send push to alert owner
        const pushPromise = (async () => {
          const tokensSnap = await getDb()
            .collection(`users/${alert.userId}/fcm_tokens`)
            .get();
          const tokens = tokensSnap.docs.map((d) => d.data().token).filter(Boolean);
          if (tokens.length === 0) return;

          const message: admin.messaging.MulticastMessage = {
            tokens: tokens.slice(0, 10),
            notification: {
              title: `🐾 Match para tu búsqueda activa`,
              body: `Apareció ${petName}${petBreed ? ` (${pet.breed})` : ""} en adopción cerca tuyo.`,
            },
            data: {
              type: "SEARCH_MATCH",
              listingId,
              alertId: alertDoc.id,
              petName,
              species: petSpecies,
            },
            webpush: {
              fcmOptions: { link: `https://pessy.app/comunidad/adopcion/${listingId}` },
            },
          };

          await admin.messaging().sendEachForMulticast(message);
          functions.logger.info(`SEARCH_MATCH sent to user ${alert.userId} for alert ${alertDoc.id}`);

          // Update alert: add listingId to matchesNotified + timestamp
          await alertDoc.ref.update({
            matchesNotified: admin.firestore.FieldValue.arrayUnion(listingId),
            matchesNotifiedAt: admin.firestore.FieldValue.arrayUnion(now),
          });
        })();

        searchMatchBatch.push(pushPromise);
      }

      await Promise.allSettled(searchMatchBatch);

      // ── 2. ADOPT_MATCH: proactive push to compatible users ──
      // Respect night window for ADOPT_MATCH
      if (nightWindow) {
        functions.logger.info(`onNewAdoptionListing ${listingId}: skipping ADOPT_MATCH (night window)`);
        return;
      }

      // Get all users with FCM tokens who haven't opted out
      const allTokensSnap = await getDb().collectionGroup("fcm_tokens").get();
      const tokensByUser = new Map<string, string[]>();

      for (const doc of allTokensSnap.docs) {
        const userId = doc.ref.parent.parent?.id;
        if (!userId || userId === listingOwnerId) continue;
        const token = doc.data().token;
        if (token) {
          const existing = tokensByUser.get(userId) || [];
          existing.push(token);
          tokensByUser.set(userId, existing);
        }
      }

      const adoptMatchBatch: Promise<void>[] = [];

      for (const [userId, tokens] of tokensByUser.entries()) {
        const pushPromise = (async () => {
          // Check user prefs (opt-out, recent adoption)
          const prefsDoc = await getDb().doc(`user_preferences/${userId}`).get();
          const prefs = prefsDoc.data() || {};

          if (prefs.noAdoptionNotifications === true) return;

          // If user adopted in last 3 months, skip
          if (prefs.lastAdoptionAt) {
            const threeMonthsAgo = now - 90 * 24 * 60 * 60 * 1000;
            if (prefs.lastAdoptionAt.toMillis() > threeMonthsAgo) return;
          }

          // Check rate: max 2 ADOPT_MATCH per day per user
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          const adoptSentToday: number[] = prefs.adoptMatchSentAt || [];
          const sentToday = adoptSentToday.filter((t: number) => t >= todayStart.getTime()).length;
          if (sentToday >= 2) return;

          // Distance filter (radius from user location)
          const userLoc = prefs.lastKnownLocation;
          if (listingLoc && userLoc &&
              typeof userLoc.lat === "number" && typeof listingLoc.lat === "number") {
            const dist = distanceKm(userLoc.lat, userLoc.lng, listingLoc.lat, listingLoc.lng);
            if (dist > 30) return; // max 30km for ADOPT_MATCH
          }

          const message: admin.messaging.MulticastMessage = {
            tokens: tokens.slice(0, 10),
            notification: {
              title: `💛 Nueva mascota en adopción cerca tuyo`,
              body: `${petName}${petBreed ? ` (${pet.breed})` : ""} busca hogar. ¿Querés conocerlo?`,
            },
            data: {
              type: "ADOPT_MATCH",
              listingId,
              petName,
              species: petSpecies,
            },
            webpush: {
              fcmOptions: { link: `https://pessy.app/comunidad/adopcion/${listingId}` },
            },
          };

          await admin.messaging().sendEachForMulticast(message);
          functions.logger.info(`ADOPT_MATCH sent to user ${userId} for listing ${listingId}`);

          // Track send timestamp
          await getDb().doc(`user_preferences/${userId}`).set({
            adoptMatchSentAt: admin.firestore.FieldValue.arrayUnion(now),
          }, { merge: true });
        })();

        adoptMatchBatch.push(pushPromise);
      }

      await Promise.allSettled(adoptMatchBatch);
      functions.logger.info(`onNewAdoptionListing ${listingId}: ADOPT_MATCH batch complete`);
    } catch (err) {
      functions.logger.error(`onNewAdoptionListing ${listingId}: error`, err);
    }
  });

// ─── SCHEDULED: EXPIRE LOST PETS AFTER 7 DAYS ───
// Runs daily at 03:00 ART (06:00 UTC). Marks active lost_pets
// with createdAt > 7 days ago as "expired".
export const scheduledExpireLostPets = functions.pubsub
  .schedule("0 6 * * *")
  .timeZone("America/Argentina/Buenos_Aires")
  .onRun(async (_context) => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    try {
      const expiredSnap = await getDb().collection("lost_pets")
        .where("status", "==", "active")
        .where("createdAt", "<=", sevenDaysAgo)
        .get();

      if (expiredSnap.empty) {
        functions.logger.info("scheduledExpireLostPets: no reports to expire");
        return;
      }

      const batch = getDb().batch();
      let count = 0;

      for (const doc of expiredSnap.docs) {
        batch.update(doc.ref, {
          status: "expired",
          expiredAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        count++;
      }

      await batch.commit();
      functions.logger.info(`scheduledExpireLostPets: expired ${count} lost pet reports`);
    } catch (err) {
      functions.logger.error("scheduledExpireLostPets: error", err);
    }
  });

// ─── SCHEDULED: EXPIRE SEARCH ALERTS AFTER 30 DAYS ───
// Runs daily. Marks active searchAlerts with expiresAt in the past as "expired".
export const scheduledExpireSearchAlerts = functions.pubsub
  .schedule("30 6 * * *")
  .timeZone("America/Argentina/Buenos_Aires")
  .onRun(async (_context) => {
    const now = new Date();

    try {
      const expiredSnap = await getDb().collection("searchAlerts")
        .where("status", "==", "active")
        .where("expiresAt", "<=", now)
        .get();

      if (expiredSnap.empty) {
        functions.logger.info("scheduledExpireSearchAlerts: nothing to expire");
        return;
      }

      const batch = getDb().batch();
      expiredSnap.docs.forEach((doc) =>
        batch.update(doc.ref, { status: "expired" })
      );
      await batch.commit();
      functions.logger.info(`scheduledExpireSearchAlerts: expired ${expiredSnap.size} alerts`);
    } catch (err) {
      functions.logger.error("scheduledExpireSearchAlerts: error", err);
    }
  });

// ─── ON FOUND PET REPORT → CROSS-MATCH AGAINST ACTIVE LOST REPORTS ───
// When a user reports finding a stray, we cross-reference against active
// lost_pets in the same area. If we find a plausible match, we notify
// the owner directly (closes the loop without them searching).
//
// Collection: found_pet_reports/{foundId}
// Required fields: location { lat, lng }, species, breed (optional),
//                  description (optional), photo (optional), reportedBy
export const onFoundPetReport = functions.firestore
  .document("found_pet_reports/{foundId}")
  .onCreate(async (snap, context) => {
    const found = snap.data();
    const foundId = context.params.foundId;

    if (!found) return;

    const foundLoc = found.location;
    if (!foundLoc || typeof foundLoc.lat !== "number") {
      functions.logger.warn(`Found pet ${foundId}: missing location`);
      return;
    }

    const foundSpecies: string = found.species || "";
    const foundBreed: string = (found.breed || "").toLowerCase();
    const searchRadiusKm = 10; // search within 10km

    try {
      // Get all active lost_pets reports
      const lostSnap = await getDb().collection("lost_pets")
        .where("status", "==", "active")
        .get();

      interface MatchResult {
        doc: admin.firestore.QueryDocumentSnapshot;
        score: number;
        distKm: number;
      }

      const candidates: MatchResult[] = [];

      for (const lostDoc of lostSnap.docs) {
        const lost = lostDoc.data();
        if (!lost || lost.reportedBy === found.reportedBy) continue;

        // Distance check
        const lostLoc = lost.lastSeenLocation;
        if (!lostLoc || typeof lostLoc.lat !== "number") continue;
        const dist = distanceKm(foundLoc.lat, foundLoc.lng, lostLoc.lat, lostLoc.lng);
        if (dist > searchRadiusKm) continue;

        // Score the match (0–100)
        let score = 0;

        // Distance score: closer = higher (max 40pts)
        score += Math.max(0, 40 - dist * 4);

        // Species match (30pts)
        const lostSpecies = lost.petSnapshot?.species || "";
        if (foundSpecies && lostSpecies && foundSpecies === lostSpecies) score += 30;
        else if (!foundSpecies || !lostSpecies) score += 15; // unknown, partial credit

        // Breed match (20pts)
        const lostBreed = (lost.petSnapshot?.breed || "").toLowerCase();
        if (foundBreed && lostBreed) {
          if (foundBreed === lostBreed) score += 20;
          else if (foundBreed.includes(lostBreed) || lostBreed.includes(foundBreed)) score += 10;
        } else if (!foundBreed || !lostBreed) {
          score += 10; // unknown breed, partial credit
        }

        // Color/description match (10pts) — simple keyword check
        const foundDesc = (found.description || "").toLowerCase();
        const lostDesc = (lost.description || "").toLowerCase();
        if (foundDesc && lostDesc) {
          const keywords = ["negro", "blanco", "marrón", "café", "gris", "naranja",
                            "manchas", "tricolor", "mediano", "grande", "pequeño"];
          const matchedKw = keywords.filter((k) => foundDesc.includes(k) && lostDesc.includes(k));
          score += Math.min(10, matchedKw.length * 5);
        }

        if (score >= 40) {
          candidates.push({ doc: lostDoc, score, distKm: dist });
        }
      }

      if (candidates.length === 0) {
        functions.logger.info(`Found pet ${foundId}: no matching lost reports`);
        // Update found report with no-match status
        await snap.ref.update({ crossMatchStatus: "no_match", crossMatchedAt: admin.firestore.FieldValue.serverTimestamp() });
        return;
      }

      // Sort by score desc, take top 3
      candidates.sort((a, b) => b.score - a.score);
      const topMatches = candidates.slice(0, 3);

      // Notify owners of top matches
      const notifyBatch: Promise<void>[] = [];
      const matchSummaries: Array<{ reportId: string; score: number; distKm: number }> = [];

      for (const match of topMatches) {
        const lost = match.doc.data();
        const ownerId = lost.reportedBy;
        const petName = lost.petSnapshot?.name || "tu mascota";

        const pushPromise = (async () => {
          const tokensSnap = await getDb()
            .collection(`users/${ownerId}/fcm_tokens`)
            .get();
          const tokens = tokensSnap.docs.map((d) => d.data().token).filter(Boolean);
          if (tokens.length === 0) return;

          const message: admin.messaging.MulticastMessage = {
            tokens: tokens.slice(0, 10),
            notification: {
              title: `🔍 ¡Posible coincidencia para ${petName}!`,
              body: `Alguien reportó encontrar una mascota a ${match.distKm.toFixed(1)}km de donde se perdió ${petName}. ¿Es ${petName}?`,
            },
            data: {
              type: "FOUND_MATCH",
              foundReportId: foundId,
              lostReportId: match.doc.id,
              matchScore: String(Math.round(match.score)),
              distKm: match.distKm.toFixed(1),
              petName,
            },
            webpush: {
              fcmOptions: {
                link: `https://pessy.app/comunidad/perdidos/${match.doc.id}?foundMatch=${foundId}`,
              },
            },
          };

          await admin.messaging().sendEachForMulticast(message);
          functions.logger.info(
            `FOUND_MATCH sent to owner ${ownerId} (score ${Math.round(match.score)}, dist ${match.distKm.toFixed(1)}km)`
          );
        })();

        notifyBatch.push(pushPromise);
        matchSummaries.push({
          reportId: match.doc.id,
          score: Math.round(match.score),
          distKm: parseFloat(match.distKm.toFixed(1)),
        });
      }

      await Promise.allSettled(notifyBatch);

      // Update found report with cross-match results
      await snap.ref.update({
        crossMatchStatus: "matched",
        crossMatchedAt: admin.firestore.FieldValue.serverTimestamp(),
        potentialMatches: matchSummaries,
      });

      functions.logger.info(
        `Found pet ${foundId}: notified ${topMatches.length} owner(s) of potential match`
      );
    } catch (err) {
      functions.logger.error(`Found pet ${foundId}: cross-match error`, err);
    }
  });
