import { buildAuthActionUrl } from "./authActionLinks";

export const CO_TUTOR_INVITE_STORAGE_KEY = "pessy_pending_cotutor_invite";

export const normalizeCoTutorInviteCode = (value?: string | null): string =>
  (value || "").trim().toUpperCase();

export const buildCoTutorReferralUrl = (inviteCode: string): string =>
  buildAuthActionUrl("/login", { invite: normalizeCoTutorInviteCode(inviteCode) });

export const rememberPendingCoTutorInvite = (inviteCode?: string | null) => {
  const normalizedCode = normalizeCoTutorInviteCode(inviteCode);
  if (!normalizedCode) return;
  localStorage.setItem(CO_TUTOR_INVITE_STORAGE_KEY, normalizedCode);
};

export const readPendingCoTutorInvite = (): string =>
  normalizeCoTutorInviteCode(localStorage.getItem(CO_TUTOR_INVITE_STORAGE_KEY));

export const clearPendingCoTutorInvite = () => {
  localStorage.removeItem(CO_TUTOR_INVITE_STORAGE_KEY);
};
