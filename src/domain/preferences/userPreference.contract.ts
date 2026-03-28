/**
 * User Preference Engine — Contracts
 *
 * Builds a living lifestyle profile of the PET OWNER (not just the pet).
 * Complements PetContext.preferences which already tracks pet-level data:
 *   favoriteActivities, favoritePlaces (Google IDs), personality, food, allergies, fears.
 *
 * This module captures the OWNER's lifestyle to power:
 *   - Personalized place recommendations (cafés, parks, shops)
 *   - Adoption matching (owner ↔ pet compatibility)
 *   - Gamification engagement tuning
 *   - Targeted notifications and content
 */

import type { Timestamp } from "firebase/firestore";

// ─── Owner Lifestyle Profile ────────────────────────────────────────────────

export type OutdoorLevel = "low" | "medium" | "high";
export type SocialLevel = "introvert" | "social" | "very_social";
export type SpendingTier = "budget" | "mid" | "premium";
export type PlanTier = "free" | "premium";

export interface OwnerLifestyle {
  outdoorLevel: OutdoorLevel;
  socialLevel: SocialLevel;
  spendingTier: SpendingTier;
  locationPrefs: string[];       // "parques", "cafés", "playas", "montaña"
  activityPrefs: string[];       // "caminatas", "running", "socialización"
  shoppingPrefs: string[];       // "premium food", "toys", "grooming", "ropa"
}

export interface OwnerEngagement {
  firstSeen: Timestamp | null;
  lastSeen: Timestamp | null;
  totalSessions: number;
  streakDays: number;
  currentPlan: PlanTier;
  responseRate: number;          // 0-1, % of random questions answered
}

export interface QuestionAnswer {
  questionId: string;
  answeredAt: Timestamp;
  answer: string;
  category: RandomQuestionCategory;
}

/**
 * The full owner preference document stored in Firestore.
 * Collection: user_preferences/{userId}
 */
export interface UserPreferenceProfile {
  userId: string;
  lifestyle: OwnerLifestyle;
  tags: string[];                // derived: ["café_lover", "runner", "premium_buyer"]
  questionsAnswered: QuestionAnswer[];
  engagement: OwnerEngagement;
  profileVersion: number;
  lastComputed: Timestamp | null;
}

// ─── Random Questions ───────────────────────────────────────────────────────

export type RandomQuestionCategory =
  | "outdoor"
  | "social"
  | "foodie"
  | "shopping"
  | "activity"
  | "travel"
  | "schedule"
  | "care";

export interface RandomQuestionOption {
  label: string;
  value: string;
  tag: string;                   // tag applied when selected
}

export interface RandomQuestion {
  id: string;
  category: RandomQuestionCategory;
  text: string;                  // uses {petName} as placeholder
  options: RandomQuestionOption[];
  cooldownDays: number;          // don't repeat for N days
  minSessionCount: number;       // require N sessions before showing
  tagsGenerated: string[];       // all possible tags from this question
}

// ─── Defaults ───────────────────────────────────────────────────────────────

export const DEFAULT_OWNER_LIFESTYLE: OwnerLifestyle = {
  outdoorLevel: "medium",
  socialLevel: "social",
  spendingTier: "mid",
  locationPrefs: [],
  activityPrefs: [],
  shoppingPrefs: [],
};

export const DEFAULT_OWNER_ENGAGEMENT: OwnerEngagement = {
  firstSeen: null,
  lastSeen: null,
  totalSessions: 0,
  streakDays: 0,
  currentPlan: "free",
  responseRate: 0,
};

export function createEmptyPreferenceProfile(userId: string): UserPreferenceProfile {
  return {
    userId,
    lifestyle: { ...DEFAULT_OWNER_LIFESTYLE },
    tags: [],
    questionsAnswered: [],
    engagement: { ...DEFAULT_OWNER_ENGAGEMENT },
    profileVersion: 0,
    lastComputed: null,
  };
}
