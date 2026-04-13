import * as functions from "firebase-functions";

/**
 * SCRUM-52: Generate AI-powered pet health insights on demand.
 * Callable function — triggered from app when user opens insights panel.
 */
export const pessyGeneratePetInsights = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
  }

  const { petId } = data;
  if (!petId) {
    throw new functions.https.HttpsError("invalid-argument", "petId is required");
  }

  // TODO: Implement AI insights generation using clinical data
  // This will query medical_events, vaccines, weight_history and generate
  // proactive health recommendations via Gemini
  return {
    insights: [],
    generatedAt: new Date().toISOString(),
    status: "pending_implementation",
  };
});

/**
 * SCRUM-52: Daily scheduled refresh of pet insights for all active users.
 * Runs at 6:00 AM UTC daily.
 */
export const pessyDailyInsightsRefresh = functions.pubsub
  .schedule("0 6 * * *")
  .timeZone("America/Argentina/Buenos_Aires")
  .onRun(async () => {
    // TODO: Iterate active users, regenerate insights for each pet
    functions.logger.info("[InsightsRefresh] Daily refresh — pending implementation");
    return null;
  });
