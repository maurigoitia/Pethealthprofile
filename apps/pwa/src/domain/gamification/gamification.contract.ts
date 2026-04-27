/**
 * Gamification System v2 — Contracts
 *
 * Evolves from localStorage-based points (src/app/utils/gamification.ts)
 * to a Firestore-backed system with streaks, badges, and levels.
 *
 * Migration path:
 *   1. Read existing points from localStorage (pessy_gamification_points)
 *   2. Write to Firestore user_gamification/{userId}
 *   3. Clear localStorage after successful migration
 *   4. All future reads/writes go to Firestore
 *
 * This enables:
 *   - Cross-device sync
 *   - Leaderboards (per zone)
 *   - Plan gating (feature access by level)
 *   - Community action rewards
 */

import type { Timestamp } from "firebase/firestore";
import type { CommunityAction, COMMUNITY_POINTS } from "../community/adoption.contract";

// ─── Points ─────────────────────────────────────────────────────────────────

export type PointSource =
  | "daily_checkin"
  | "complete_routine"
  | "answer_random_question"
  | "scan_document"
  | "add_appointment"
  | CommunityAction;

export const CORE_POINTS: Record<string, number> = {
  daily_checkin: 5,
  complete_routine: 10,
  answer_random_question: 8,
  scan_document: 15,
  add_appointment: 10,
};

export interface PointEntry {
  source: PointSource;
  amount: number;
  earnedAt: Timestamp;
  metadata?: Record<string, string>; // e.g. { petId, questionId }
}

// ─── Streaks ────────────────────────────────────────────────────────────────

export interface StreakData {
  currentStreak: number;         // consecutive days
  longestStreak: number;
  lastActiveDate: string;        // "2026-03-28" format
}

// ─── Badges / Achievements ──────────────────────────────────────────────────

export type BadgeId =
  | "first_checkin"
  | "streak_7"
  | "streak_30"
  | "streak_100"
  | "first_scan"
  | "health_detective"          // 10 documents scanned
  | "social_butterfly"          // 5 random questions answered
  | "community_hero"            // first verified sighting
  | "adoption_angel"            // facilitated adoption
  | "explorer"                  // 5 place check-ins
  | "pet_parent_pro";           // reached level 10

export interface Badge {
  id: BadgeId;
  name: string;
  description: string;
  icon: string;                  // Material Design icon name
  unlockedAt: Timestamp | null;
}

export const BADGE_DEFINITIONS: Omit<Badge, "unlockedAt">[] = [
  { id: "first_checkin", name: "Primera vez", description: "Hiciste tu primer check-in", icon: "emoji_events" },
  { id: "streak_7", name: "Una semana", description: "7 días seguidos", icon: "local_fire_department" },
  { id: "streak_30", name: "Un mes", description: "30 días seguidos", icon: "whatshot" },
  { id: "streak_100", name: "Imparable", description: "100 días seguidos", icon: "military_tech" },
  { id: "first_scan", name: "Detective", description: "Escaneaste tu primer documento", icon: "document_scanner" },
  { id: "health_detective", name: "Investigador/a", description: "10 documentos escaneados", icon: "biotech" },
  { id: "social_butterfly", name: "Social", description: "Respondiste 5 preguntas", icon: "forum" },
  { id: "community_hero", name: "Héroe comunitario", description: "Avistamiento verificado", icon: "visibility" },
  { id: "adoption_angel", name: "Ángel adoptivo", description: "Facilitaste una adopción", icon: "favorite" },
  { id: "explorer", name: "Explorador/a", description: "5 check-ins en lugares", icon: "explore" },
  { id: "pet_parent_pro", name: "Pet Parent Pro", description: "Llegaste al nivel 10", icon: "star" },
];

// ─── Levels ─────────────────────────────────────────────────────────────────

/** Points required to reach each level. Level N needs LEVEL_THRESHOLDS[N] total points. */
export const LEVEL_THRESHOLDS = [
  0,      // Level 0 (starting)
  50,     // Level 1
  150,    // Level 2
  300,    // Level 3
  500,    // Level 4
  800,    // Level 5
  1200,   // Level 6
  1800,   // Level 7
  2500,   // Level 8
  3500,   // Level 9
  5000,   // Level 10 (Pet Parent Pro)
] as const;

export function getLevelForPoints(points: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (points >= LEVEL_THRESHOLDS[i]) return i;
  }
  return 0;
}

// ─── Full Gamification Document ─────────────────────────────────────────────

/**
 * Firestore: user_gamification/{userId}
 */
export interface UserGamificationProfile {
  userId: string;
  totalPoints: number;
  level: number;
  streak: StreakData;
  badges: Badge[];
  recentPoints: PointEntry[];    // last 50 entries for history display
  migratedFromLocalStorage: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export function createEmptyGamificationProfile(userId: string, now: Timestamp): UserGamificationProfile {
  return {
    userId,
    totalPoints: 0,
    level: 0,
    streak: { currentStreak: 0, longestStreak: 0, lastActiveDate: "" },
    badges: BADGE_DEFINITIONS.map((b) => ({ ...b, unlockedAt: null })),
    recentPoints: [],
    migratedFromLocalStorage: false,
    createdAt: now,
    updatedAt: now,
  };
}
