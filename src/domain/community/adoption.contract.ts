/**
 * Adoption System — Contracts
 *
 * Intelligent matching between adopters and pets based on:
 *   - Living space, experience, other pets (adopter)
 *   - Size, energy, temperament, special needs (pet)
 *
 * The matching score guides the experience:
 *   80-100% = "Excelente match" → direct connection
 *   60-79%  = "Buen match" → connection with note
 *   40-59%  = "Match posible" → show with caveat
 *   <40%    = Don't show
 */

import type { Timestamp } from "firebase/firestore";
import type { PessyGeoPoint } from "./lostPet.contract";

// ─── Adoption Listing ───────────────────────────────────────────────────────

export type AdoptionStatus = "active" | "adopted" | "removed";
export type PublisherType = "shelter" | "individual";
export type EnergyLevel = "low" | "medium" | "high";

export interface AdoptionPetProfile {
  name: string;
  species: "dog" | "cat";
  breed: string;
  age: number;                   // months
  size: "small" | "medium" | "large";
  energyLevel: EnergyLevel;
  temperament: string[];         // ["tranquilo", "juguetón", "tímido"]
  goodWith: {
    kids: boolean;
    dogs: boolean;
    cats: boolean;
  };
  specialNeeds: string[];
  photoUrls: string[];
  description: string;
}

/**
 * Firestore: adoption_listings/{listingId}
 */
export interface AdoptionListing {
  id: string;
  publisherId: string;
  publisherType: PublisherType;
  status: AdoptionStatus;
  petProfile: AdoptionPetProfile;
  location: PessyGeoPoint;
  address: string;
  publishedAt: Timestamp;
  updatedAt: Timestamp;
  viewCount: number;
  applicationCount: number;
}

// ─── Matching ───────────────────────────────────────────────────────────────

export type LivingSpace = "apartment" | "house_small" | "house_big" | "rural";
export type ExperienceLevel = "first_time" | "experienced" | "professional";

export interface AdopterProfile {
  userId: string;
  livingSpace: LivingSpace;
  hasYard: boolean;
  otherPets: number;
  experienceLevel: ExperienceLevel;
  activityPrefs: string[];       // from UserPreferenceProfile tags
  scheduleAvailability: "low" | "medium" | "high";
}

export interface MatchResult {
  listingId: string;
  adopterId: string;
  totalScore: number;            // 0-100
  components: {
    livingSpace: number;         // 0-25
    experience: number;          // 0-25
    otherPets: number;           // 0-20
    activity: number;            // 0-15
    schedule: number;            // 0-15
  };
  label: MatchLabel;
  reason: string;                // "Tu depto es ideal para un perro chico y tranquilo"
}

export type MatchLabel = "excellent" | "good" | "possible" | "incompatible";

export function getMatchLabel(score: number): MatchLabel {
  if (score >= 80) return "excellent";
  if (score >= 60) return "good";
  if (score >= 40) return "possible";
  return "incompatible";
}

// ─── Gamification points for community actions ──────────────────────────────

export const COMMUNITY_POINTS = {
  report_lost_pet: 10,
  report_sighting: 25,
  verified_sighting: 100,
  publish_adoption: 20,
  successful_adoption: 200,
  share_lost_alert: 5,
  leave_place_review: 10,
  confirmed_place_checkin: 15,
} as const;

export type CommunityAction = keyof typeof COMMUNITY_POINTS;
