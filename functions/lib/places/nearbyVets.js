"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nearbyVets = void 0;
const functions = require("firebase-functions");
const params_1 = require("firebase-functions/params");
const rateLimiter = require("../utils/rateLimiter");
const authGuard_1 = require("../utils/authGuard");
const inputValidator_1 = require("../utils/inputValidator");
// Define the Google Places API key as a secret
const GOOGLE_PLACES_API_KEY = (0, params_1.defineSecret)("GOOGLE_PLACES_API_KEY");
/**
 * Cloud Function that proxies Google Places Nearby Search API
 * Prevents exposing API key to client
 *
 * Request: { lat: number, lng: number, radius?: number, type?: string }
 * Response: { success: boolean, results?: VetResult[], error?: string }
 */
exports.nearbyVets = functions
    .runWith({
    // Increase timeout for API calls
    timeoutSeconds: 30,
    // Set memory to handle requests
    memory: "256MB",
})
    .https.onCall(async (requestData, context) => {
    const uid = (0, authGuard_1.requireCallableAuth)(context);
    if (!rateLimiter.perUser(uid, 10, 60000)) {
        throw new functions.https.HttpsError("resource-exhausted", "Too many requests. Try again later.");
    }
    if (!rateLimiter.globalLimit("nearbyVets", 100, 60000)) {
        throw new functions.https.HttpsError("resource-exhausted", "Service is busy. Try again later.");
    }
    try {
        (0, inputValidator_1.validateRequired)(requestData, ["lat", "lng"]);
        // Validate input
        const { lat, lng, radius = 5000, type = "veterinary_care" } = requestData;
        if (typeof lat !== "number" || typeof lng !== "number") {
            return {
                success: false,
                error: "Invalid coordinates. lat and lng must be numbers.",
            };
        }
        if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            return {
                success: false,
                error: "Invalid coordinates. Latitude must be -90 to 90, longitude must be -180 to 180.",
            };
        }
        if (radius < 1 || radius > 50000) {
            return {
                success: false,
                error: "Invalid radius. Must be between 1 and 50000 meters.",
            };
        }
        // Get the API key from secret
        const apiKey = GOOGLE_PLACES_API_KEY.value();
        if (!apiKey) {
            console.error("[nearbyVets] GOOGLE_PLACES_API_KEY not configured");
            return {
                success: false,
                error: "Server not configured. Please contact support.",
            };
        }
        // Build the Places API URL
        const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
        url.searchParams.append("location", `${lat},${lng}`);
        url.searchParams.append("radius", radius.toString());
        url.searchParams.append("type", type);
        url.searchParams.append("language", "es");
        url.searchParams.append("key", apiKey);
        // Call Google Places API
        const response = await fetch(url.toString());
        const placesResponse = await response.json();
        // Handle Google Places API response
        if (placesResponse.status === "OK") {
            const results = (placesResponse.results || []).map((place) => ({
                place_id: place.place_id,
                name: place.name,
                vicinity: place.vicinity,
                rating: place.rating,
                user_ratings_total: place.user_ratings_total,
                opening_hours: place.opening_hours
                    ? {
                        open_now: place.opening_hours.open_now === true,
                    }
                    : undefined,
                geometry: {
                    location: {
                        lat: place.geometry.location.lat,
                        lng: place.geometry.location.lng,
                    },
                },
            }));
            return {
                success: true,
                results,
            };
        }
        else if (placesResponse.status === "ZERO_RESULTS") {
            return {
                success: true,
                results: [],
            };
        }
        else if (placesResponse.status === "REQUEST_DENIED") {
            console.error("[nearbyVets] API Key invalid or restricted:", placesResponse.error_message);
            return {
                success: false,
                error: "API key configuration error.",
            };
        }
        else if (placesResponse.status === "OVER_QUERY_LIMIT") {
            console.warn("[nearbyVets] Rate limit exceeded");
            return {
                success: false,
                error: "Too many requests. Please try again in a moment.",
            };
        }
        else {
            console.error("[nearbyVets] Google Places API error:", placesResponse.status, placesResponse.error_message);
            return {
                success: false,
                error: `API error: ${placesResponse.status}`,
            };
        }
    }
    catch (error) {
        console.error("[nearbyVets] Unexpected error:", error);
        return {
            success: false,
            error: "An unexpected error occurred. Please try again.",
        };
    }
});
//# sourceMappingURL=nearbyVets.js.map