import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

const db = admin.firestore();

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
      const usersSnap = await db.collectionGroup("fcm_tokens").get();
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
      const petsSnap = await db.collection("pets").get();

      for (const petDoc of petsSnap.docs) {
        const pet = petDoc.data();
        const ownerId = pet.ownerId;
        if (!ownerId || ownerId === report.reportedBy) continue;

        // Check if user has location from preferences or pet data
        const userPrefsDoc = await db.doc(`user_preferences/${ownerId}`).get();
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
        const batch = db.batch();
        for (const token of invalidTokens) {
          const tokenSnap = await db.collectionGroup("fcm_tokens")
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
      const reportDoc = await db.doc(`lost_pets/${sighting.lostPetReportId}`).get();
      const report = reportDoc.data();
      if (!report || report.status !== "active") return;

      const ownerId = report.reportedBy;
      const petName = report.petSnapshot?.name || "tu mascota";

      // Get owner FCM tokens
      const tokensSnap = await db.collection(`users/${ownerId}/fcm_tokens`).get();
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
  const listingsSnap = await db.collection("adoption_listings")
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
