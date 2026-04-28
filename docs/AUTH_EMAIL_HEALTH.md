# Auth + Email Health Check — 2026-04-28

Read-only audit of the auth surface (login, register, password recovery,
co-tutor invite) and the email plumbing. **No code modified by this
audit. Findings drive separate fix PRs.**

---

## 🔴 CRITICAL: Welcome / invite / co-tutor / generic-invite emails are silently broken in production

### What's wrong

Four email callables in `functions/src/index.ts` do NOT declare
`RESEND_API_KEY` as a Firebase Secret. In v1 Cloud Functions, a secret
must be bound with `.runWith({ secrets: ["RESEND_API_KEY"] })` for
`process.env.RESEND_API_KEY` to be populated at runtime. Without that,
the read at module load returns an empty string, `resendClient` is
`null`, and every email call hits this branch:

```js
if (!resendClient) { console.warn("[EMAIL] RESEND_API_KEY no configurada — email omitido"); return; }
```

**The function returns success to the caller but no email is sent.** The
user sees a green confirmation in the UI; nothing arrives in the inbox.

### Affected functions

| Callable | File:line | Triggered by |
|---|---|---|
| `pessySendInvitationEmail` | `functions/src/index.ts:444` | manual invite |
| `pessySendWelcomeEmail` | `functions/src/index.ts:457` | manual welcome |
| `pessySendCoTutorInvitation` | `functions/src/index.ts:474` | co-tutor invite flow |
| `onUserCreatedSendWelcome` | `functions/src/index.ts:505` | every new signup |

### Functions that DO work (for reference / comparison)

These correctly bind the secret and send emails fine:
- `sendScheduledNotifications` — `functions/src/index.ts:991`
- (line 3277, 3419) — other notification senders

The pattern they use:
```ts
export const sendXxx = functions
  .runWith({ secrets: ["RESEND_API_KEY"] })  // ← THIS LINE IS MISSING ON THE 4 BROKEN ONES
  .https.onCall(async (data, context) => { ... });
```

### Symptom you've already seen

Users register but don't get the welcome email. Co-tutor invites are
"sent" but the recipient never sees them. Invite flow looks fine in the
UI but nothing arrives.

### Fix (separate tiny PR — `fix/email-secret-binding`)

Add `.runWith({ secrets: ["RESEND_API_KEY"] })` to all 4 callables.
4-line PR. Estimated risk: **low**. The secret already exists in Firebase
(other functions use it). Just needs to be bound to these.

After deploy, every existing user will start receiving emails on the
next welcome / invite / co-tutor trigger.

---

## 🟡 Password reset stays on Firebase's hosted UI

### What works
`ForgotPasswordScreen.tsx` calls
`sendPasswordResetEmail(auth, email, createPasswordResetActionCodeSettings())`
correctly. The email IS sent because Firebase's password reset endpoint
sends the email itself (no Resend involved). The `actionCodeSettings.url`
is set to `/login?source=password_reset` (`apps/pwa/src/app/utils/authActionLinks.ts:54`).

The "did not reveal account existence" behaviour is correctly
implemented — `auth/user-not-found` falls through to the generic success
message (`ForgotPasswordScreen.tsx:34`).

### What's missing
`handleCodeInApp: false` means the user clicks the email link → Firebase's
default password-reset hosted UI (the bare Firebase-branded page) →
types new password → Firebase redirects to `/login?source=password_reset`.

The user spends the most security-sensitive moment of their relationship
with Pessy on a Firebase-branded page. **Bad UX, dilutes brand, blocks
A/B testing of reset copy.**

### Fix (PR `feat/in-app-password-reset` — separate)
1. New route `/reset-password` in `apps/pwa/src/app/routes.tsx`.
2. New screen reads `oobCode` from URL, calls `verifyPasswordResetCode`,
   prompts for new password, calls `confirmPasswordReset`.
3. In `authActionLinks.ts:55`, change the `url` of
   `createPasswordResetActionCodeSettings` to point at `/reset-password`,
   set `handleCodeInApp: true`.

Estimated risk: medium. Touches auth flow. Manual QA mandatory.

---

## 🟡 Email verification not enforced

`createVerificationActionCodeSettings` exists in
`apps/pwa/src/app/utils/authActionLinks.ts:49` but no UI calls
`sendEmailVerification` after register. So unverified emails can use the
app fully.

### Decision needed
Founder call: enforce verification (block app until confirmed) vs
optional banner ("Verificá tu email" with resend CTA). Recommendation:
**optional banner** — fewer drop-offs.

### Fix (PR `feat/email-verification-banner` — separate)
1. After `RegisterUserScreen` success, call `sendEmailVerification(user, createVerificationActionCodeSettings())`.
2. Add banner in `HomeScreen.tsx` reading `user.emailVerified === false`.
3. CTA: resend.

Estimated risk: low. Aditivo.

---

## ✅ What is healthy

| Surface | File | Status |
|---|---|---|
| Email/password login | `LoginScreen.tsx` | OK |
| Google OAuth (web + native) | `LoginScreen.tsx` | OK |
| Passwordless email-link sign-in | `EmailLinkSignInScreen.tsx` | OK |
| Forgot password (email send) | `ForgotPasswordScreen.tsx` + Firebase | OK (email sent by Firebase, not Resend) |
| Register email/password | `RegisterUserScreen.tsx` | OK |
| Co-tutor invite flow logic | `useAcceptPetInvite.ts` (referenced earlier) | OK (the email itself is broken — see above) |
| Beta waitlist | `RequestAccessScreen.tsx` | OK (writes to `access_requests`, no email) |
| Generic-success on user-not-found | `ForgotPasswordScreen.tsx:34` | OK (good security hygiene) |
| `actionCodeSettings.url` builder | `utils/authActionLinks.ts` | OK (handles native Capacitor origins) |

---

## Manual checks the founder should run in production

These can't be inferred from code. Need access to dashboards:

### Firebase Console
1. **Project → Functions → Secret Manager**: confirm `RESEND_API_KEY` exists and is enabled. **Critical: confirm it's bound to the 4 user-facing callables AFTER the fix PR ships.** Until then it's bound to the wrong subset of functions.
2. **Authentication → Templates**: confirm the password-reset email template uses Pessy branding (logo, colors, sender name). If it's still Firebase's default, that's a polish task.
3. **Authentication → Settings → Authorized domains**: confirm `pessy.app`, `pessy-qa-app-1618a.web.app`, and `pessy-qa-app-1618a.firebaseapp.com` are all listed.

### Resend dashboard
4. **Domains**: confirm `pessy.app` is verified (green check).
5. **DNS records**: SPF, DKIM, DMARC all pass.
6. **Logs (last 7 days)**: confirm there are recent successful sends. If logs show 0 sends, that's another signal of the secret-binding bug.

### Live test (after fix PR ships)
7. Register a fresh account on `pessy-qa-app-1618a.web.app` → welcome email lands in inbox in <30s, has Pessy branding.
8. Trigger co-tutor invite → email lands in invitee's inbox.
9. Forgot password → reset email lands, link works.

---

## Recommended PR order

| # | Branch | Risk | Impact | Effort |
|---|---|---|---|---|
| 1 | `fix/email-secret-binding` | low | **HIGH — fixes prod silent failure** | 5 min |
| 2 | `feat/in-app-password-reset` | medium | medium UX win | half day |
| 3 | `feat/email-verification-banner` | low | medium UX/security | 1-2 hours |
| 4 | `feat/auth-settings-page` (change email/password/logout/delete) | medium | low–medium UX | 1 day |

PR #1 should ship **immediately** — it's a 4-line fix with prod consequences. The rest can be sequenced normally.

---

## Out of scope for this audit

- Google OAuth flow internals
- Capacitor-native auth quirks
- Vet-mode auth (`/vet/login` separate from main auth)
- Account-deletion compliance flow (already implemented in `functions/src/compliance/accountDeletion.ts`, not audited here)
