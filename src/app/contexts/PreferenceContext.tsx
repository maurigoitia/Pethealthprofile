/**
 * PreferenceContext
 *
 * Manages the owner's lifestyle preference profile.
 * Reads/writes to Firestore: user_preferences/{userId}
 *
 * Exposes:
 *   - profile: the current UserPreferenceProfile (or null while loading)
 *   - currentQuestion: the next RandomQuestion to show (or null if none eligible)
 *   - answerQuestion(questionId, answer, tag): record answer + update tags
 *   - dismissQuestion(): skip this session's question
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
  UserPreferenceProfile,
  RandomQuestion,
} from "../../domain/preferences/userPreference.contract";
import { createEmptyPreferenceProfile } from "../../domain/preferences/userPreference.contract";
import { selectNextQuestion } from "../../domain/preferences/questionSelector";

interface PreferenceContextValue {
  profile: UserPreferenceProfile | null;
  currentQuestion: RandomQuestion | null;
  answerQuestion: (questionId: string, answer: string, tag: string) => Promise<void>;
  dismissQuestion: () => void;
  loading: boolean;
}

const PreferenceCtx = createContext<PreferenceContextValue | null>(null);

export function usePreferences() {
  const ctx = useContext(PreferenceCtx);
  if (!ctx) throw new Error("usePreferences must be inside PreferenceProvider");
  return ctx;
}

export function PreferenceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserPreferenceProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  // ── Load profile from Firestore ──────────────────────────────
  useEffect(() => {
    if (!user?.uid) {
      setProfile(null);
      setLoading(false);
      return;
    }
    const ref = doc(db, "user_preferences", user.uid);
    getDoc(ref).then((snap) => {
      if (snap.exists()) {
        setProfile(snap.data() as UserPreferenceProfile);
      } else {
        const empty = createEmptyPreferenceProfile(user.uid);
        setDoc(ref, empty);
        setProfile(empty);
      }
      setLoading(false);
    });
  }, [user?.uid]);

  // ── Select next question ─────────────────────────────────────
  const currentQuestion = useMemo(() => {
    if (!profile || dismissed) return null;
    return selectNextQuestion({
      totalSessions: profile.engagement.totalSessions,
      answeredQuestions: profile.questionsAnswered,
    });
  }, [profile, dismissed]);

  // ── Answer a question ────────────────────────────────────────
  const answerQuestion = useCallback(
    async (questionId: string, answer: string, tag: string) => {
      if (!profile || !user?.uid) return;

      const now = Timestamp.now();
      const question = currentQuestion;
      if (!question) return;

      const updatedProfile: UserPreferenceProfile = {
        ...profile,
        tags: profile.tags.includes(tag) ? profile.tags : [...profile.tags, tag],
        questionsAnswered: [
          ...profile.questionsAnswered,
          { questionId, answeredAt: now, answer, category: question.category },
        ],
        profileVersion: profile.profileVersion + 1,
        lastComputed: now,
      };

      setProfile(updatedProfile);
      setDismissed(true);

      const ref = doc(db, "user_preferences", user.uid);
      await setDoc(ref, updatedProfile, { merge: true });
    },
    [profile, user?.uid, currentQuestion],
  );

  // ── Dismiss ──────────────────────────────────────────────────
  const dismissQuestion = useCallback(() => setDismissed(true), []);

  const value = useMemo<PreferenceContextValue>(
    () => ({
      profile,
      currentQuestion,
      answerQuestion,
      dismissQuestion,
      loading,
    }),
    [profile, currentQuestion, answerQuestion, dismissQuestion, loading],
  );

  return <PreferenceCtx.Provider value={value}>{children}</PreferenceCtx.Provider>;
}
