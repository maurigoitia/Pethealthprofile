import { useCallback } from "react";
import { doc, getDoc, updateDoc, increment } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../contexts/AuthContext";

// ── Límites por plan ──────────────────────────────────────────────────────────
export const PLAN_LIMITS = {
  free:    1  * 1024 * 1024 * 1024, // 1 GB
  premium: 10 * 1024 * 1024 * 1024, // 10 GB
} as const;

export type UserPlan = "free" | "premium";

export interface StorageQuota {
  used: number;
  limit: number;
  plan: UserPlan;
  percentUsed: number;
  remaining: number;
  isNearLimit: boolean;   // > 80%
  isOverLimit: boolean;   // >= 100%
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024)                return `${bytes} B`;
  if (bytes < 1024 * 1024)        return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function buildQuota(used: number, plan: UserPlan): StorageQuota {
  const limit = PLAN_LIMITS[plan];
  const pct = Math.min(100, (used / limit) * 100);
  return {
    used, limit, plan,
    percentUsed: pct,
    remaining: Math.max(0, limit - used),
    isNearLimit: pct >= 80,
    isOverLimit: pct >= 100,
  };
}

export function useStorageQuota() {
  const { user } = useAuth();

  const getQuota = useCallback(async (): Promise<StorageQuota> => {
    if (!user?.uid) return buildQuota(0, "free");
    const snap = await getDoc(doc(db, "users", user.uid));
    const data = snap.data() || {};
    const used = Number(data.storageUsedBytes) || 0;
    const plan: UserPlan = data.plan === "premium" ? "premium" : "free";
    return buildQuota(used, plan);
  }, [user?.uid]);

  const trackUpload = useCallback(async (bytes: number): Promise<void> => {
    if (!user?.uid || bytes <= 0) return;
    await updateDoc(doc(db, "users", user.uid), {
      storageUsedBytes: increment(bytes),
    });
  }, [user?.uid]);

  const trackDelete = useCallback(async (bytes: number): Promise<void> => {
    if (!user?.uid || bytes <= 0) return;
    await updateDoc(doc(db, "users", user.uid), {
      storageUsedBytes: increment(-bytes),
    });
  }, [user?.uid]);

  const canUpload = useCallback(async (fileBytes: number) => {
    const quota = await getQuota();
    return { allowed: quota.used + fileBytes <= quota.limit, quota };
  }, [getQuota]);

  return { getQuota, trackUpload, trackDelete, canUpload };
}
