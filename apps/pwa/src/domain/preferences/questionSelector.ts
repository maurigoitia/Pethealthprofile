/**
 * Question Selector
 *
 * Picks the best random question to show this session.
 * Rules:
 *   - Max 1 question per session
 *   - Respect cooldown (don't repeat within N days)
 *   - Respect minSessionCount
 *   - Prioritize unanswered categories
 *   - Return null if nothing is eligible
 */

import type { QuestionAnswer, RandomQuestion } from "./userPreference.contract";
import { QUESTION_POOL } from "./questionPool";

interface SelectionContext {
  totalSessions: number;
  answeredQuestions: QuestionAnswer[];
  now?: Date;
}

export function selectNextQuestion(ctx: SelectionContext): RandomQuestion | null {
  const now = ctx.now ?? new Date();
  const nowMs = now.getTime();

  // Build a set of recently-answered question IDs (within cooldown)
  const recentlyAnswered = new Set<string>();
  const answeredCategories = new Set<string>();

  for (const qa of ctx.answeredQuestions) {
    answeredCategories.add(qa.category);
    const answeredMs = qa.answeredAt?.toMillis?.() ?? 0;
    const q = QUESTION_POOL.find((p) => p.id === qa.questionId);
    if (!q) continue;
    const cooldownMs = q.cooldownDays * 86_400_000;
    if (nowMs - answeredMs < cooldownMs) {
      recentlyAnswered.add(qa.questionId);
    }
  }

  // Filter eligible questions
  const eligible = QUESTION_POOL.filter((q) => {
    if (recentlyAnswered.has(q.id)) return false;
    if (ctx.totalSessions < q.minSessionCount) return false;
    return true;
  });

  if (eligible.length === 0) return null;

  // Prioritize: unanswered categories first, then random
  const fromNewCategory = eligible.filter((q) => !answeredCategories.has(q.category));
  const pool = fromNewCategory.length > 0 ? fromNewCategory : eligible;

  // Pseudo-random selection (deterministic per day so same question shows all session)
  const dayKey = now.toISOString().slice(0, 10);
  const hash = simpleHash(dayKey);
  return pool[hash % pool.length];
}

/** Simple string hash for deterministic daily selection */
function simpleHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}
