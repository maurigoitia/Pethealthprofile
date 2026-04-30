/**
 * Email workflows — barrel export.
 *
 * Todos los emails de Pessy se centralizan acá.
 * Los existentes (medication reminder, invitation, welcome) siguen en index.ts
 * hasta que se migren a esta estructura.
 */
export { sendWeeklyDigest, gatherWeeklyData } from "./weeklyDigest";
export { sendOverdueReminder } from "./overdueReminder";
export type { WeeklyDigestData } from "./weeklyDigest";
export type { OverdueReminderArgs } from "./overdueReminder";
