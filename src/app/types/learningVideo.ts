/**
 * Learning Videos — curated educational content.
 *
 * Owner curates manually (`scripts/seed-learning-videos.ts`). Clients read only.
 * Matched client-side by species + active clinical conditions + age range.
 *
 * v1 scope:
 *   - No "Revisado por vet" chip (no real review workflow in v1).
 *   - No bookmark collection.
 *   - No iframe embed — tap opens url in a new tab.
 */

export type LearningVideoProvider = "youtube" | "vimeo" | "web";
export type LearningVideoSpecies = "dog" | "cat" | "rabbit" | "bird" | "reptile";
export type LearningVideoLanguage = "es" | "en";

export interface LearningVideoAgeRange {
  minMonths?: number;
  maxMonths?: number;
}

export interface LearningVideo {
  id: string;
  title: string;
  provider: LearningVideoProvider;
  url: string;
  thumbnailUrl: string;
  durationSeconds: number;
  language: LearningVideoLanguage;
  /** null = applies to all species */
  species: LearningVideoSpecies[] | null;
  /** Normalized condition names (lowercase, ascii). Empty = general. */
  conditions: string[];
  /** null = no age restriction */
  ageRange: LearningVideoAgeRange | null;
  tags: string[];
  active: boolean;
  /** ISO string or Firestore Timestamp; app treats as string for simplicity. */
  curatedAt: string;
}
