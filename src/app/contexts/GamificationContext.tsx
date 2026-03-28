/**
 * GamificationContext
 *
 * Firestore-backed gamification (replaces localStorage in utils/gamification.ts).
 * Reads/writes to: user_gamification/{userId}
 *
 * Exposes:
 *   - profile: UserGamificationProfile | null
 *   - addPoints(source, metadata?): earn points + check badge unlocks
 *   - level / totalPoints / streak: quick accessors
 *   - loading: boolean
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "./AuthContext";
import type {
  UserGamificationProfile,
  PointSource,
  PointEntry,
} from "../../domain/gamification/gamification.contract";
import {
  createEmptyGamificationProfile,
  getLevelForPoints,
  CORE_POINTS,
  LEVEL_THRESHOLDS,
} from "../../domain/gamification/gamification.contract";
import { COMMUNITY_POINTS } from "../../domain/community/adoption.contract";

interface GamificationContextValue {
  profile: UserGamificationProfile | null;
  addPoints: (source: PointSource, metadata?: Record<string, string>) => Promise<void>;
  totalPoints: number;
  level: number;
  streak: number;
  loading: boolean;
}

const GamificationCtx = createContext<GamificationContextValue | null>(null);

export function useGamification() {
  const ctx = useContext(GamificationCtx);
  if (!ctx) throw new Error("useGamification must be inside GamificationProvider");
  return ctx;
}

/** Resolve points for a source action */
function resolvePoints(source: PointSource): number {
  if (source in CORE_POINTS) return CORE_POINTS[source];
  if (source in COMMUNITY_POINTS) return COMMUNITY_POINTS[source as keyof typeof COMMUNITY_POINTS];
  return 0;
}

/** Check if today's date matches lastActiveDate for streak purposes */
function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}
function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function GamificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserGamificationProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Load or create profile ───────────────────────────────────
  useEffect(() => {
    if (!user?.uid) { setProfile(null); setLoading(false); return; }

    const ref = doc(db, "user_gamification", user.uid);
    getDoc(ref).then((snap) => {
      const now = Timestamp.now();
      if (snap.exists()) {
        const data = snap.data() as UserGamificationProfile;
        // Migrate localStorage points if not done yet
        if (!data.migratedFromLocalStorage) {
          try {
            const lsPoints = parseInt(localStorage.getItem("pessy_gamification_points") || "0", 10);
            if (lsPoints > 0) {
              data.totalPoints += lsPoints;
              data.level = getLevelForPoints(data.totalPoints);
            }
            data.migratedFromLocalStorage = true;
            setDoc(ref, data, { merge: true });
            localStorage.removeItem("pessy_gamification_points");
            localStorage.removeItem("pessy_daily_activity_done");
          } catch { /* ignore localStorage errors */ }
        }
        setProfile(data);
      } else {
        // First time: check localStorage for existing points
        let initialPoints = 0;
        try {
          initialPoints = parseInt(localStorage.getItem("pessy_gamification_points") || "0", 10);
          localStorage.removeItem("pessy_gamification_points");
          localStorage.removeItem("pessy_daily_activity_done");
        } catch { /* ignore */ }
        const empty = createEmptyGamificationProfile(user.uid, now);
        empty.totalPoints = initialPoints;
        empty.level = getLevelForPoints(initialPoints);
        empty.migratedFromLocalStorage = true;
        setDoc(ref, empty);
        setProfile(empty);
      }
      setLoading(false);
    });
  }, [user?.uid]);

  // ── Add points ───────────────────────────────────────────────
  const addPoints = useCallback(
    async (source: PointSource, metadata?: Record<string, string>) => {
      if (!profile || !user?.uid) return;

      const amount = resolvePoints(source);
      if (amount <= 0) return;

      const now = Timestamp.now();
      const today = todayKey();
      const yesterday = yesterdayKey();

      // Update streak
      const streak = { ...profile.streak };
      if (streak.lastActiveDate === today) {
        // Already active today, no streak change
      } else if (streak.lastActiveDate === yesterday) {
        streak.currentStreak += 1;
        streak.longestStreak = Math.max(streak.longestStreak, streak.currentStreak);
        streak.lastActiveDate = today;
      } else {
        streak.currentStreak = 1;
        streak.lastActiveDate = today;
      }

      const newTotal = profile.totalPoints + amount;
      const newLevel = getLevelForPoints(newTotal);
      const entry: PointEntry = { source, amount, earnedAt: now, metadata };

      // Check badge unlocks
      const badges = [...profile.badges];
      const unlock = (id: string) => {
        const b = badges.find((x) => x.id === id);
        if (b && !b.unlockedAt) b.unlockedAt = now;
      };

      if (source === "daily_checkin" && !badges.find((b) => b.id === "first_checkin")?.unlockedAt) unlock("first_checkin");
      if (source === "scan_document" && !badges.find((b) => b.id === "first_scan")?.unlockedAt) unlock("first_scan");
      if (streak.currentStreak >= 7) unlock("streak_7");
      if (streak.currentStreak >= 30) unlock("streak_30");
      if (streak.currentStreak >= 100) unlock("streak_100");
      if (newLevel >= 10) unlock("pet_parent_pro");
      if (source === "verified_sighting") unlock("community_hero");
      if (source === "successful_adoption") unlock("adoption_angel");

      // Count-based badges
      const scanCount = profile.recentPoints.filter((p) => p.source === "scan_document").length + (source === "scan_document" ? 1 : 0);
      if (scanCount >= 10) unlock("health_detective");
      const questionCount = profile.recentPoints.filter((p) => p.source === "answer_random_question").length + (source === "answer_random_question" ? 1 : 0);
      if (questionCount >= 5) unlock("social_butterfly");
      const checkinCount = profile.recentPoints.filter((p) => p.source === "confirmed_place_checkin").length + (source === "confirmed_place_checkin" ? 1 : 0);
      if (checkinCount >= 5) unlock("explorer");

      const updated: UserGamificationProfile = {
        ...profile,
        totalPoints: newTotal,
        level: newLevel,
        streak,
        badges,
        recentPoints: [entry, ...profile.recentPoints].slice(0, 50),
        updatedAt: now,
      };

      setProfile(updated);
      const ref = doc(db, "user_gamification", user.uid);
      await setDoc(ref, updated, { merge: true });
    },
    [profile, user?.uid],
  );

  const value = useMemo<GamificationContextValue>(
    () => ({
      profile,
      addPoints,
      totalPoints: profile?.totalPoints ?? 0,
      level: profile?.level ?? 0,
      streak: profile?.streak.currentStreak ?? 0,
      loading,
    }),
    [profile, addPoints, loading],
  );

  return <GamificationCtx.Provider value={value}>{children}</GamificationCtx.Provider>;
}
