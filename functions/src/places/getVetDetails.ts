import * as functions from "firebase-functions";
import { defineSecret } from "firebase-functions/params";
import * as rateLimiter from "../utils/rateLimiter";
import { requireCallableAuth } from "../utils/authGuard";

const GOOGLE_PLACES_API_KEY = defineSecret("GOOGLE_PLACES_API_KEY");

interface GetVetDetailsRequest {
  place_id: string;
}

interface VetDetails {
  place_id: string;
  name: string;
  formatted_phone_number?: string;
  international_phone_number?: string;
  website?: string;
  url?: string; // Google Maps URL
  formatted_address?: string;
  rating?: number;
  opening_hours?: {
    open_now: boolean;
    weekday_text?: string[];
  };
}

interface GetVetDetailsResponse {
  success: boolean;
  details?: VetDetails;
  error?: string;
}

/**
 * Cloud Function — Places Details API
 * Returns phone number, website, and full hours for a vet clinic
 * Used by NearbyVetsScreen to enable real phone calls and booking
 */
export const getVetDetails = functions
  .runWith({
    timeoutSeconds: 15,
    memory: "128MB",
    secrets: ["GOOGLE_PLACES_API_KEY"],
  })
  .https.onCall(async (requestData: GetVetDetailsRequest, context): Promise<GetVetDetailsResponse> => {
    const uid = requireCallableAuth(context);
    if (!rateLimiter.perUser(uid, 20, 60_000)) {
      throw new functions.https.HttpsError("resource-exhausted", "Too many requests. Try again later.");
    }

    const { place_id } = requestData;
    if (!place_id || typeof place_id !== "string") {
      return { success: false, error: "Invalid place_id" };
    }

    const apiKey = GOOGLE_PLACES_API_KEY.value();
    if (!apiKey) {
      return { success: false, error: "Server not configured." };
    }

    try {
      const fields = [
        "place_id",
        "name",
        "formatted_phone_number",
        "international_phone_number",
        "website",
        "url",
        "formatted_address",
        "rating",
        "opening_hours",
      ].join(",");

      const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
      url.searchParams.append("place_id", place_id);
      url.searchParams.append("fields", fields);
      url.searchParams.append("language", "es");
      url.searchParams.append("key", apiKey);

      const response = await fetch(url.toString());
      const data = await response.json();

      if (data.status === "OK" && data.result) {
        const r = data.result;
        return {
          success: true,
          details: {
            place_id,
            name: r.name,
            formatted_phone_number: r.formatted_phone_number,
            international_phone_number: r.international_phone_number,
            website: r.website,
            url: r.url,
            formatted_address: r.formatted_address,
            rating: r.rating,
            opening_hours: r.opening_hours
              ? {
                  open_now: r.opening_hours.open_now === true,
                  weekday_text: r.opening_hours.weekday_text,
                }
              : undefined,
          },
        };
      }

      return { success: false, error: `Places API: ${data.status}` };
    } catch (error) {
      console.error("[getVetDetails] Error:", error);
      return { success: false, error: "Unexpected error." };
    }
  });
