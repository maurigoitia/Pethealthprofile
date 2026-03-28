/**
 * Lost Pets & Sightings — Contracts
 *
 * Enables the community to help find lost pets via:
 *   - Geo-localized push notifications (expanding radius)
 *   - Feed of lost pets in the area
 *   - Sighting reports with photo + location
 *
 * Auto-fills from PetContext when the pet is registered.
 */

import type { Timestamp } from "firebase/firestore";

// ─── GeoPoint (compatible with Firestore) ───────────────────────────────────

export interface PessyGeoPoint {
  latitude: number;
  longitude: number;
}

// ─── Lost Pet Report ────────────────────────────────────────────────────────

export type LostPetStatus = "active" | "found" | "expired";

export interface PetSnapshot {
  name: string;
  species: "dog" | "cat";
  breed: string;
  color: string;
  size: "small" | "medium" | "large";
  photoUrls: string[];
  distinctiveFeatures: string;   // "collar rojo", "cicatriz oreja izquierda"
}

/**
 * Firestore: lost_pets/{reportId}
 */
export interface LostPetReport {
  id: string;
  petId: string;                 // ref to registered pet (or empty for unregistered)
  ownerId: string;
  status: LostPetStatus;

  petSnapshot: PetSnapshot;

  // Location & time
  lastSeenLocation: PessyGeoPoint;
  lastSeenAddress: string;
  lastSeenAt: Timestamp;
  searchRadius: number;          // km — starts at 2, expands to 5, then 10

  // Contact & report type
  contactPhone?: string;         // owner's phone/WhatsApp
  reportType?: "perdido" | "encontrado" | "reunido";

  // Metadata
  reportedAt: Timestamp;
  updatedAt: Timestamp;
  expiresAt: Timestamp;          // auto-expire at 30 days
  viewCount: number;
  sightingCount: number;
}

// ─── Sighting ───────────────────────────────────────────────────────────────

/**
 * Firestore: lost_pet_sightings/{sightingId}
 */
export interface PetSighting {
  id: string;
  lostPetId: string;             // ref to LostPetReport
  reporterId: string;            // who saw it
  location: PessyGeoPoint;
  address: string;
  seenAt: Timestamp;
  photoUrl: string | null;
  notes: string;
  verified: boolean;             // owner confirms it's their pet
  createdAt: Timestamp;
}

// ─── Push notification strategy ─────────────────────────────────────────────

export interface LostPetAlertConfig {
  /** Immediate push: 2km radius */
  immediateRadiusKm: number;
  /** After 30min if no sightings: expand to 5km */
  expandedRadiusKm: number;
  expandAfterMinutes: number;
  /** After 2h: expand to 10km */
  maxRadiusKm: number;
  maxExpandAfterMinutes: number;
  /** Max lost pet notifications per user per day */
  maxNotificationsPerDay: number;
  /** Auto-expire after days */
  expirationDays: number;
}

export const DEFAULT_LOST_PET_ALERT_CONFIG: LostPetAlertConfig = {
  immediateRadiusKm: 2,
  expandedRadiusKm: 5,
  expandAfterMinutes: 30,
  maxRadiusKm: 10,
  maxExpandAfterMinutes: 120,
  maxNotificationsPerDay: 3,
  expirationDays: 30,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Haversine distance between two geo points in km */
export function distanceKm(a: PessyGeoPoint, b: PessyGeoPoint): number {
  const R = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
