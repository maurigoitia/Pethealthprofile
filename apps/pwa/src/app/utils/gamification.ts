// Simple localStorage-based gamification points
// Points are earned by: completing routine items, starting daily activities

const POINTS_KEY = "pessy_gamification_points";

export function getPoints(): number {
  try {
    return parseInt(localStorage.getItem(POINTS_KEY) || "0", 10);
  } catch { return 0; }
}

export function addPoints(amount: number): number {
  const current = getPoints();
  const newTotal = current + amount;
  try { localStorage.setItem(POINTS_KEY, String(newTotal)); } catch {}
  return newTotal;
}

export function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

// Track daily activity completion to avoid double-earning
const DAILY_DONE_KEY = "pessy_daily_activity_done";

export function isDailyActivityDone(): boolean {
  try {
    return localStorage.getItem(DAILY_DONE_KEY) === getTodayKey();
  } catch { return false; }
}

export function markDailyActivityDone(): void {
  try { localStorage.setItem(DAILY_DONE_KEY, getTodayKey()); } catch {}
}
