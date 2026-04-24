/**
 * useLearningVideos — fetchea `learningVideos` de Firestore (active == true)
 * y los filtra/ordena client-side por species + condiciones activas + edad.
 *
 * v1: sin AI, sin embedding, scoring determinístico. Si no hay match (score > 0),
 * retorna lista vacía → la UI oculta la sección.
 */

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../lib/firebase";
import type {
  LearningVideo,
  LearningVideoAgeRange,
  LearningVideoSpecies,
} from "../types/learningVideo";
import type { ClinicalCondition } from "../types/medical";

export interface UseLearningVideosInput {
  species: LearningVideoSpecies | null;
  /** Edad de la mascota en meses. null si desconocida. */
  ageMonths: number | null;
  /** Condiciones activas (solo status === "active" | "monitoring"). */
  conditions: ClinicalCondition[];
  /** Tope de resultados (default 3). */
  limit?: number;
}

export interface UseLearningVideosResult {
  videos: LearningVideo[];
  loading: boolean;
  error: Error | null;
}

function normalizeCondition(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function matchesAge(ageMonths: number | null, range: LearningVideoAgeRange): boolean {
  if (ageMonths === null) return false;
  if (typeof range.minMonths === "number" && ageMonths < range.minMonths) return false;
  if (typeof range.maxMonths === "number" && ageMonths > range.maxMonths) return false;
  return true;
}

function scoreMatch(
  video: LearningVideo,
  species: LearningVideoSpecies | null,
  ageMonths: number | null,
  normalizedConditions: string[],
): number {
  let score = 0;
  // +10 por cada condición activa que matchea
  for (const c of normalizedConditions) {
    if (video.conditions.includes(c)) score += 10;
  }
  // +2 si species match exacto (no null)
  if (species && video.species?.includes(species)) score += 2;
  // +1 si edad match
  if (video.ageRange && matchesAge(ageMonths, video.ageRange)) score += 1;
  // Video totalmente genérico (sin species, sin conditions, sin ageRange):
  // lo dejamos visible con score muy bajo para que aparezca si no hay nada mejor.
  if (!video.species && video.conditions.length === 0 && !video.ageRange) {
    score += 0.5;
  }
  return score;
}

export function useLearningVideos({
  species,
  ageMonths,
  conditions,
  limit = 3,
}: UseLearningVideosInput): UseLearningVideosResult {
  const [allVideos, setAllVideos] = useState<LearningVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const q = query(collection(db, "learningVideos"), where("active", "==", true));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: LearningVideo[] = snap.docs.map((d) => {
          const data = d.data() as Partial<LearningVideo>;
          return {
            id: d.id,
            title: String(data.title ?? ""),
            provider: (data.provider ?? "web") as LearningVideo["provider"],
            url: String(data.url ?? ""),
            thumbnailUrl: String(data.thumbnailUrl ?? ""),
            durationSeconds: Number(data.durationSeconds ?? 0),
            language: (data.language ?? "es") as LearningVideo["language"],
            species: (data.species as LearningVideo["species"]) ?? null,
            conditions: Array.isArray(data.conditions) ? data.conditions : [],
            ageRange: (data.ageRange as LearningVideo["ageRange"]) ?? null,
            tags: Array.isArray(data.tags) ? data.tags : [],
            active: data.active !== false,
            curatedAt: typeof data.curatedAt === "string" ? data.curatedAt : "",
          };
        });
        setAllVideos(list);
        setLoading(false);
      },
      (err) => {
        setError(err as Error);
        setLoading(false);
      },
    );
    return unsub;
  }, []);

  const videos = useMemo(() => {
    const normalizedConditions = conditions
      .filter((c) => c.status === "active" || c.status === "monitoring")
      .map((c) => normalizeCondition(c.normalizedName));

    return allVideos
      .filter((v) => !v.species || (species && v.species.includes(species)))
      .filter((v) => !v.ageRange || matchesAge(ageMonths, v.ageRange))
      .map((v) => ({ v, score: scoreMatch(v, species, ageMonths, normalizedConditions) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((x) => x.v);
  }, [allVideos, species, ageMonths, conditions, limit]);

  return { videos, loading, error };
}
