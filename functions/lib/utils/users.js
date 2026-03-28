"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserSettings = getUserSettings;
exports.getUserTokenAndTimezone = getUserTokenAndTimezone;
exports.resolvePetName = resolvePetName;
exports.getUserEmail = getUserEmail;
const admin = require("firebase-admin");
const userSettingsCache = new Map();
const userTokenCache = new Map();
const userTimezoneCache = new Map();
const petNameCache = new Map();
async function getUserSettings(userId) {
    var _a;
    if (userSettingsCache.has(userId))
        return userSettingsCache.get(userId);
    const userSnap = await admin.firestore().collection("users").doc(userId).get();
    const settings = (((_a = userSnap.data()) === null || _a === void 0 ? void 0 : _a.notificationSettings) || {});
    userSettingsCache.set(userId, settings);
    return settings;
}
async function getUserTokenAndTimezone(userId) {
    var _a, _b;
    let token = userTokenCache.get(userId);
    let timezone = userTimezoneCache.get(userId);
    if (token === undefined || !timezone) {
        const tokenCol = admin.firestore().collection("users").doc(userId).collection("fcm_tokens");
        const primaryDoc = await tokenCol.doc("primary").get();
        if (primaryDoc.exists) {
            token = ((_a = primaryDoc.data()) === null || _a === void 0 ? void 0 : _a.token) || null;
            timezone = ((_b = primaryDoc.data()) === null || _b === void 0 ? void 0 : _b.timezone) || "UTC";
        }
        else {
            const fallbackSnap = await tokenCol.limit(1).get();
            if (!fallbackSnap.empty) {
                const fallback = fallbackSnap.docs[0].data();
                token = (fallback === null || fallback === void 0 ? void 0 : fallback.token) || null;
                timezone = (fallback === null || fallback === void 0 ? void 0 : fallback.timezone) || "UTC";
            }
            else {
                token = null;
                timezone = "UTC";
            }
        }
        userTokenCache.set(userId, token);
        userTimezoneCache.set(userId, timezone);
    }
    return { token: token || null, timezone: timezone || "UTC" };
}
async function resolvePetName(petId) {
    var _a;
    if (!petId)
        return "tu mascota";
    if (petNameCache.has(petId))
        return petNameCache.get(petId);
    const petSnap = await admin.firestore().collection("pets").doc(petId).get();
    const name = petSnap.exists ? ((_a = petSnap.data()) === null || _a === void 0 ? void 0 : _a.name) || "tu mascota" : "tu mascota";
    petNameCache.set(petId, name);
    return name;
}
async function getUserEmail(userId) {
    try {
        const userRecord = await admin.auth().getUser(userId);
        return userRecord.email || null;
    }
    catch (_a) {
        return null;
    }
}
//# sourceMappingURL=users.js.map