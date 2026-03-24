# Invite-Only Registration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Pessy registration invite-only: users can only register via a platform invite link from an existing user, or via a waitlist approval from admin.

**Architecture:** Frontend gate on RegisterUserScreen blocks registration without valid `?ref=CODE` or `?access=TOKEN`. Firestore stores platform invites in existing `invitations` collection (with `type: "platform"`) and waitlist requests in new `access_requests` collection. One new Cloud Function `approveAccessRequest` sends approval emails via Resend.

**Tech Stack:** React + react-router, Firebase Firestore, Firebase Cloud Functions (v1), Resend email API

**Spec:** `docs/superpowers/specs/2026-03-24-invite-only-registration-design.md`

**GUARDRAILS:**
- DO NOT modify `AuthContext.tsx`, `firebase.ts`, `PetContext.tsx`, `CoTutorModal.tsx`, `HomeScreen.tsx`
- DO NOT modify existing Cloud Functions
- DO NOT modify the existing co-tutor invitation flow
- Only touch files listed in each task

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `src/app/utils/platformInvite.ts` | Create | Generate/validate platform invite codes and access tokens |
| `src/app/components/RequestAccessScreen.tsx` | Create | Waitlist form (public) |
| `src/app/components/AdminAccessRequests.tsx` | Create | Admin panel to approve/reject requests |
| `src/app/components/InviteFriendsModal.tsx` | Create | Modal for users to generate and share invite links |
| `src/app/components/RegisterUserScreen.tsx` | Modify | Add gate logic at mount + small additions in submit |
| `src/app/components/LoginScreen.tsx` | Modify | Change register button to "Solo por invitación" + add waitlist link |
| `src/app/routes.tsx` | Modify | Add `/solicitar-acceso` and `/admin/access-requests` routes |
| `firestore.rules` | Modify | Add `access_requests` rules + merge platform invite rules |
| `functions/src/index.ts` | Modify | Add `approveAccessRequest` callable function |

---

## Task 1: Platform invite utilities

**Files:**
- Create: `src/app/utils/platformInvite.ts`

- [ ] **Step 1: Create the utility file**

```typescript
// src/app/utils/platformInvite.ts
import { doc, getDoc, setDoc, runTransaction, Timestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";

const PLATFORM_INVITE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Generate a 6-char alphanumeric code */
export function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1 to avoid confusion
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/** Create a platform invitation in Firestore */
export async function createPlatformInvite(userId: string, userName: string): Promise<string> {
  const code = generateInviteCode();
  const now = Timestamp.now();
  const expiresAt = Timestamp.fromMillis(now.toMillis() + PLATFORM_INVITE_EXPIRY_MS);

  await setDoc(doc(db, "invitations", code), {
    type: "platform",
    createdBy: userId,
    createdByName: userName,
    used: false,
    usedBy: null,
    usedAt: null,
    createdAt: now,
    expiresAt,
  });

  return code;
}

export interface PlatformInviteValidation {
  valid: boolean;
  reason?: string;
  createdByName?: string;
  createdBy?: string;
}

/** Validate a platform invite code (for unauthenticated users) */
export async function validatePlatformInvite(code: string): Promise<PlatformInviteValidation> {
  if (!code || code.length !== 6) return { valid: false, reason: "invalid" };

  try {
    const snap = await getDoc(doc(db, "invitations", code.toUpperCase()));
    if (!snap.exists()) return { valid: false, reason: "not_found" };

    const data = snap.data();
    if (data.type !== "platform") return { valid: false, reason: "wrong_type" };
    if (data.used) return { valid: false, reason: "already_used" };
    if (data.expiresAt && data.expiresAt.toMillis() < Date.now()) {
      return { valid: false, reason: "expired" };
    }

    return { valid: true, createdByName: data.createdByName, createdBy: data.createdBy };
  } catch {
    return { valid: false, reason: "error" };
  }
}

/** Mark a platform invite as used (in a transaction to prevent double-use) */
export async function markPlatformInviteUsed(code: string, usedByUid: string): Promise<void> {
  const ref = doc(db, "invitations", code.toUpperCase());
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists() || snap.data().used) {
      throw new Error("Invitation already used or not found");
    }
    tx.update(ref, {
      used: true,
      usedBy: usedByUid,
      usedAt: Timestamp.now(),
    });
  });
}

export interface AccessTokenValidation {
  valid: boolean;
  reason?: string;
  name?: string;
  email?: string;
  docId?: string;
}

/** Validate a waitlist access token */
export async function validateAccessToken(token: string): Promise<AccessTokenValidation> {
  if (!token || token.length !== 8) return { valid: false, reason: "invalid" };

  // We need to query by accessToken field — import query utils
  const { collection, query, where, getDocs } = await import("firebase/firestore");
  const q = query(
    collection(db, "access_requests"),
    where("accessToken", "==", token),
    where("status", "==", "approved")
  );

  try {
    const snap = await getDocs(q);
    if (snap.empty) return { valid: false, reason: "not_found" };

    const docSnap = snap.docs[0];
    const data = docSnap.data();

    if (data.accessTokenExpiresAt && data.accessTokenExpiresAt.toMillis() < Date.now()) {
      return { valid: false, reason: "expired" };
    }

    return { valid: true, name: data.name, email: data.email, docId: docSnap.id };
  } catch {
    return { valid: false, reason: "error" };
  }
}

/** Build the platform invite URL */
export function buildPlatformInviteUrl(code: string): string {
  const base = typeof window !== "undefined" ? window.location.origin : "https://app.pessy.app";
  return `${base}/register-user?ref=${code}`;
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd /Users/mauriciogoitia/Downloads/03_PESSY_APP/PESSY_PRODUCCION/.claude/worktrees/clever-wilson && npx tsc --noEmit src/app/utils/platformInvite.ts 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/app/utils/platformInvite.ts
git commit -m "feat(invite): add platform invite utilities"
```

---

## Task 2: Firestore Rules — access_requests + platform invites

**Files:**
- Modify: `firestore.rules:111-160`

- [ ] **Step 1: Add `isAdmin` helper function after existing helpers**

Add after line 42 (after `canLeavePetAsCoTutor` function) in `firestore.rules`:

```
    function isAdmin() {
      return signedIn() && request.auth.token.email == 'mauriciogoitia@gmail.com';
    }
```

- [ ] **Step 2: Add `access_requests` collection rules**

Add BEFORE the `match /invitations/{code}` block (before line 111):

```
    match /access_requests/{docId} {
      allow create: if request.resource.data.status == 'pending'
        && request.resource.data.createdAt == request.time
        && request.resource.data.keys().hasAll(['name', 'email', 'source', 'status', 'createdAt'])
        && request.resource.data.name is string
        && request.resource.data.email is string
        && request.resource.data.name.size() > 0
        && request.resource.data.email.size() > 5;

      allow read, update: if isAdmin();
      allow delete: if false;
    }
```

- [ ] **Step 3: Modify `invitations/{code}` create rule to support platform invites**

Replace the existing create rule (lines 112-117) with:

```
      allow create: if signedIn() && code.matches('^[A-Z0-9]{6}$') && (
        // Existing co-tutor invite rule (unchanged)
        (
          request.resource.data.createdBy == request.auth.uid
          && request.resource.data.petId is string
          && isPetOwnerById(request.resource.data.petId)
          && request.resource.data.used == false
        )
        ||
        // New platform invite rule
        (
          request.resource.data.type == 'platform'
          && request.resource.data.createdBy == request.auth.uid
          && request.resource.data.used == false
        )
      );
```

- [ ] **Step 4: Modify `invitations/{code}` get rule for unauthenticated platform invite validation**

Replace the existing get rule (lines 119-127) with:

```
      allow get: if
        // Platform invites: anyone can read (needed before auth)
        (resource.data.type == 'platform')
        ||
        // Co-tutor invites: existing rules (unchanged)
        (signedIn() && (
          resource.data.createdBy == request.auth.uid ||
          resource.data.inviteEmail == null ||
          (
            request.auth.token.email != null &&
            resource.data.inviteEmail is string &&
            resource.data.inviteEmail == request.auth.token.email
          )
        ));
```

- [ ] **Step 5: Modify `invitations/{code}` update rule to support platform invite marking**

Replace the existing update rule (lines 130-157) with:

```
      allow update: if signedIn() && (
        // Owner can always update their own invitations
        resource.data.createdBy == request.auth.uid ||
        // Co-tutor join flow (existing rule, unchanged)
        (
          resource.data.used == false &&
          request.resource.data.createdBy == resource.data.createdBy &&
          request.resource.data.petId == resource.data.petId &&
          request.resource.data.expiresAt == resource.data.expiresAt &&
          request.resource.data.petName == resource.data.petName &&
          request.resource.data.used == true &&
          request.resource.data.usedBy == request.auth.uid &&
          (
            resource.data.inviteEmail == null ||
            (
              request.auth.token.email != null &&
              resource.data.inviteEmail is string &&
              resource.data.inviteEmail == request.auth.token.email
            )
          ) &&
          petExists(resource.data.petId) &&
          petData(resource.data.petId).coTutorUids is list &&
          petData(resource.data.petId).coTutorUids.hasAny([request.auth.uid]) &&
          (
            !(resource.data.expiresAt is timestamp) ||
            resource.data.expiresAt > request.time
          ) &&
          request.resource.data.diff(resource.data).changedKeys().hasOnly(['used', 'usedBy', 'usedAt'])
        )
        ||
        // Platform invite mark-as-used (new)
        (
          resource.data.type == 'platform' &&
          resource.data.used == false &&
          request.resource.data.used == true &&
          request.resource.data.usedBy == request.auth.uid &&
          request.resource.data.diff(resource.data).changedKeys().hasOnly(['used', 'usedBy', 'usedAt'])
        )
      );
```

- [ ] **Step 6: Commit**

```bash
git add firestore.rules
git commit -m "feat(invite): add Firestore rules for access_requests + platform invites"
```

---

## Task 3: RequestAccessScreen (waitlist form)

**Files:**
- Create: `src/app/components/RequestAccessScreen.tsx`

- [ ] **Step 1: Create the waitlist screen**

```tsx
// src/app/components/RequestAccessScreen.tsx
import { useState } from "react";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { AuthPageShell } from "./AuthPageShell";

const SOURCES = [
  { value: "tiktok", label: "TikTok" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "otro", label: "Otro" },
];

export function RequestAccessScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await addDoc(collection(db, "access_requests"), {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        source: source || "otro",
        status: "pending",
        createdAt: Timestamp.now(),
      });
      setSubmitted(true);
    } catch {
      setError("No se pudo enviar. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <AuthPageShell
        eyebrow="Solicitud enviada"
        title="Te avisamos cuando tengas acceso."
        description="Pessy está en beta cerrada. Revisamos cada solicitud personalmente."
        highlights={[]}
      >
        <div className="rounded-[1.5rem] border border-[#b5efd9] bg-[#eef8f3] px-6 py-6 text-center">
          <p className="text-lg font-bold text-[#074738]">Listo</p>
          <p className="mt-2 text-sm text-[#5e716b]">
            Te mandamos un email cuando tu acceso esté aprobado.
          </p>
        </div>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell
      eyebrow="Beta cerrada"
      title="Solicitar acceso a Pessy"
      description="Dejanos tus datos y te avisamos."
      highlights={[]}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          placeholder="Tu nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-[#074738] outline-none"
          required
        />
        <input
          type="email"
          placeholder="Tu email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-[#074738] outline-none"
          required
        />
        <div className="relative">
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="w-full px-4 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-[#074738] outline-none appearance-none bg-white text-slate-700 cursor-pointer"
            required
          >
            <option value="">¿Cómo nos conociste?</option>
            {SOURCES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">▾</div>
        </div>

        {error && <p className="text-red-500 text-sm font-semibold text-center">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-[#074738] py-4 text-sm font-bold uppercase tracking-[0.16em] text-white disabled:opacity-60"
        >
          {loading ? "Enviando..." : "Solicitar acceso"}
        </button>
      </form>
    </AuthPageShell>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/components/RequestAccessScreen.tsx
git commit -m "feat(invite): add waitlist request screen"
```

---

## Task 4: Gate on RegisterUserScreen

**Files:**
- Modify: `src/app/components/RegisterUserScreen.tsx`

- [ ] **Step 1: Add imports for platform invite validation**

Add after line 9 (after the `acquisitionTracking` import):

```typescript
import { validatePlatformInvite, validateAccessToken, markPlatformInviteUsed, type PlatformInviteValidation, type AccessTokenValidation } from "../utils/platformInvite";
```

- [ ] **Step 2: Add gate state and validation logic**

Add after line 25 (after the `gmailStepLoading` state) these new state variables:

```typescript
  // Platform invite gate
  const [gateStatus, setGateStatus] = useState<"loading" | "allowed" | "blocked" | "invalid">("loading");
  const [gateMessage, setGateMessage] = useState("");
  const [platformInviteData, setPlatformInviteData] = useState<PlatformInviteValidation | null>(null);
  const [accessTokenData, setAccessTokenData] = useState<AccessTokenValidation | null>(null);

  const refCode = useMemo(() => (searchParams.get("ref") || "").trim().toUpperCase(), [searchParams]);
  const accessToken = useMemo(() => (searchParams.get("access") || "").trim(), [searchParams]);
```

- [ ] **Step 3: Add gate validation useEffect**

Add after the existing `useEffect` for leadName/leadEmail/leadPet (after line 61):

```typescript
  // Platform invite gate — runs before anything else
  useEffect(() => {
    let cancelled = false;

    async function checkGate() {
      // Flujo A: platform invite via ?ref=CODE
      if (refCode) {
        const result = await validatePlatformInvite(refCode);
        if (cancelled) return;
        if (result.valid) {
          setPlatformInviteData(result);
          setGateStatus("allowed");
        } else {
          setGateMessage(
            result.reason === "expired" ? "Este link expiró. Pedile uno nuevo a quien te invitó." :
            result.reason === "already_used" ? "Este link ya fue usado." :
            "Este link no es válido."
          );
          setGateStatus("invalid");
        }
        return;
      }

      // Flujo B: waitlist access via ?access=TOKEN
      if (accessToken) {
        const result = await validateAccessToken(accessToken);
        if (cancelled) return;
        if (result.valid) {
          setAccessTokenData(result);
          if (result.name) setName((c) => c || result.name!);
          if (result.email) setEmail((c) => c || result.email!);
          setGateStatus("allowed");
        } else {
          setGateMessage(
            result.reason === "expired" ? "Este acceso expiró. Solicitá uno nuevo." :
            "Este acceso no es válido."
          );
          setGateStatus("invalid");
        }
        return;
      }

      // Co-tutor invite via ?invite=CODE — let through (existing flow handles it)
      if (inviteCode) {
        setGateStatus("allowed");
        return;
      }

      // No token at all — blocked
      setGateStatus("blocked");
    }

    void checkGate();
    return () => { cancelled = true; };
  }, [refCode, accessToken, inviteCode]);
```

- [ ] **Step 4: Add `invitedBy` and `accessSource` to user doc creation**

Inside `handleCreateAccount`, after line 108 (after the `gmailSyncReminder` block, before the closing `});` of `setDoc`), add:

```typescript
        // Invite-only tracking
        ...(platformInviteData?.createdBy ? { invitedBy: platformInviteData.createdBy } : {}),
        accessSource: refCode ? "invite" : accessToken ? "waitlist" : inviteCode ? "cotutor" : "direct",
```

- [ ] **Step 5: Mark platform invite as used after account creation**

Inside `handleCreateAccount`, after line 114 (after `trackAcquisitionEvent`), add:

```typescript
      // Mark platform invite as used (transactional)
      if (refCode && platformInviteData?.valid) {
        try {
          await markPlatformInviteUsed(refCode, user.uid);
        } catch (err) {
          console.warn("Could not mark platform invite as used:", err);
        }
      }
```

- [ ] **Step 6: Add blocked/loading/invalid UI before the form**

Replace the outer return (line 160 onwards). Wrap the existing JSX:

Before the existing `return (<AuthPageShell ...>` add early returns:

```typescript
  // Gate: loading
  if (gateStatus === "loading") {
    return (
      <AuthPageShell eyebrow="Verificando" title="Un momento..." description="" highlights={[]}>
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#074738] border-t-transparent" />
        </div>
      </AuthPageShell>
    );
  }

  // Gate: blocked (no invite/token)
  if (gateStatus === "blocked") {
    return (
      <AuthPageShell
        eyebrow="Beta cerrada"
        title="Pessy es solo por invitación"
        description="Si alguien te invitó, pedile el link. Si no, solicitá acceso."
        highlights={[]}
      >
        <div className="space-y-4">
          <div className="rounded-[1.5rem] border border-[#e8d5b5] bg-[#fdf6ec] px-6 py-6 text-center">
            <p className="text-sm text-[#5e716b]">
              Estamos en beta cerrada. Solo podés registrarte con un link de invitación.
            </p>
          </div>
          <a
            href="/solicitar-acceso"
            className="block w-full rounded-full bg-[#074738] py-4 text-center text-sm font-bold uppercase tracking-[0.16em] text-white"
          >
            Solicitar acceso
          </a>
          <a
            href="/login"
            className="block w-full rounded-full border border-[#dfe6e2] py-4 text-center text-sm font-bold uppercase tracking-[0.16em] text-[#074738]"
          >
            Ya tengo cuenta
          </a>
        </div>
      </AuthPageShell>
    );
  }

  // Gate: invalid invite/token
  if (gateStatus === "invalid") {
    return (
      <AuthPageShell
        eyebrow="Link inválido"
        title={gateMessage}
        description=""
        highlights={[]}
      >
        <div className="space-y-4">
          <a
            href="/solicitar-acceso"
            className="block w-full rounded-full bg-[#074738] py-4 text-center text-sm font-bold uppercase tracking-[0.16em] text-white"
          >
            Solicitar acceso
          </a>
          <a
            href="/login"
            className="block w-full rounded-full border border-[#dfe6e2] py-4 text-center text-sm font-bold uppercase tracking-[0.16em] text-[#074738]"
          >
            Ya tengo cuenta
          </a>
        </div>
      </AuthPageShell>
    );
  }

  // Gate: allowed — show the registration form (existing JSX below)
```

- [ ] **Step 7: Verify the file compiles**

Run: `cd /Users/mauriciogoitia/Downloads/03_PESSY_APP/PESSY_PRODUCCION/.claude/worktrees/clever-wilson && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 8: Commit**

```bash
git add src/app/components/RegisterUserScreen.tsx
git commit -m "feat(invite): add registration gate on RegisterUserScreen"
```

---

## Task 5: Gate on LoginScreen

**Files:**
- Modify: `src/app/components/LoginScreen.tsx:346-353`

- [ ] **Step 1: Replace the "Registrarse gratis" button**

Replace lines 346-353 with:

```tsx
          <button
            type="button"
            disabled
            className="w-full rounded-full border border-[#dfe6e2] bg-white py-4 font-bold uppercase tracking-[0.16em] text-[#9ca8a2] cursor-not-allowed"
            style={{ fontFamily: "'Plus Jakarta Sans', 'Manrope', sans-serif" }}
          >
            Solo por invitación
          </button>

          <a
            href="/solicitar-acceso"
            className="block text-center text-sm font-semibold text-[#1A9B7D] hover:underline mt-2"
          >
            ¿Querés acceso? Solicitalo acá
          </a>
```

- [ ] **Step 2: Commit**

```bash
git add src/app/components/LoginScreen.tsx
git commit -m "feat(invite): disable register button on login, add waitlist link"
```

---

## Task 6: Add new routes

**Files:**
- Modify: `src/app/routes.tsx:97-126`

- [ ] **Step 1: Add imports at the top of routes.tsx**

After line 12 (after `LegalPage` import):

```typescript
import { RequestAccessScreen } from "./components/RequestAccessScreen";
```

- [ ] **Step 2: Add lazy import for AdminAccessRequests**

After the new import, add:

```typescript
const AdminAccessRequests = () => import("./components/AdminAccessRequests").then(m => ({ Component: m.AdminAccessRequests }));
```

- [ ] **Step 3: Add the two new routes**

After line 107 (after the `/login` route), add:

```typescript
  withErrorBoundary({ path: "/solicitar-acceso", Component: RequestAccessScreen }),
  withErrorBoundary({ path: "/admin/access-requests", lazy: AdminAccessRequests }),
```

- [ ] **Step 4: Commit**

```bash
git add src/app/routes.tsx
git commit -m "feat(invite): add solicitar-acceso and admin routes"
```

---

## Task 7: InviteFriendsModal

**Files:**
- Create: `src/app/components/InviteFriendsModal.tsx`

- [ ] **Step 1: Create the modal component**

```tsx
// src/app/components/InviteFriendsModal.tsx
import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { createPlatformInvite, buildPlatformInviteUrl } from "../utils/platformInvite";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function InviteFriendsModal({ open, onClose }: Props) {
  const { user, userFullName } = useAuth();
  const [inviteUrl, setInviteUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const code = await createPlatformInvite(user.uid, userFullName || user.displayName || "");
      setInviteUrl(buildPlatformInviteUrl(code));
    } catch (err) {
      console.error("Error generating invite:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: "Unite a Pessy",
        text: "Te invito a Pessy — tu mascota, sus cosas, todo en orden.",
        url: inviteUrl,
      });
    } else {
      await handleCopy();
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-x-4 bottom-4 z-50 rounded-[2rem] bg-white p-6 shadow-2xl max-w-md mx-auto">
        <h3 className="text-lg font-bold text-[#074738]">Invitar amigos a Pessy</h3>
        <p className="mt-1 text-sm text-[#5e716b]">
          Generá un link de invitación. Expira en 24 horas.
        </p>

        {!inviteUrl ? (
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="mt-4 w-full rounded-full bg-[#074738] py-3 text-sm font-bold uppercase tracking-[0.16em] text-white disabled:opacity-60"
          >
            {loading ? "Generando..." : "Generar link"}
          </button>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="rounded-xl bg-[#f0faf9] border border-[#b5efd9] px-4 py-3 text-xs font-mono text-[#074738] break-all">
              {inviteUrl}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="flex-1 rounded-full border border-[#074738] py-3 text-sm font-bold text-[#074738]"
              >
                {copied ? "Copiado" : "Copiar"}
              </button>
              <button
                onClick={handleShare}
                className="flex-1 rounded-full bg-[#074738] py-3 text-sm font-bold text-white"
              >
                Compartir
              </button>
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-3 w-full py-2 text-sm font-semibold text-[#5e716b]"
        >
          Cerrar
        </button>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/components/InviteFriendsModal.tsx
git commit -m "feat(invite): add InviteFriendsModal component"
```

---

## Task 8: AdminAccessRequests panel

**Files:**
- Create: `src/app/components/AdminAccessRequests.tsx`

- [ ] **Step 1: Create the admin panel**

```tsx
// src/app/components/AdminAccessRequests.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { collection, query, where, orderBy, getDocs, doc, updateDoc, Timestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db } from "../../lib/firebase";
import { functions } from "../../lib/firebase";
import { useAuth } from "../contexts/AuthContext";

const ADMIN_EMAIL = "mauriciogoitia@gmail.com";

interface AccessRequest {
  id: string;
  name: string;
  email: string;
  source: string;
  status: string;
  createdAt: any;
}

export function AdminAccessRequests() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isAdmin) {
      navigate("/login", { replace: true });
      return;
    }

    async function loadRequests() {
      const q = query(
        collection(db, "access_requests"),
        where("status", "==", "pending"),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AccessRequest)));
      setLoading(false);
    }

    void loadRequests();
  }, [user, authLoading, isAdmin, navigate]);

  const handleApprove = async (req: AccessRequest) => {
    setActionLoading(req.id);
    try {
      const approve = httpsCallable(functions, "approveAccessRequest");
      await approve({ requestId: req.id });
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
    } catch (err) {
      console.error("Error approving:", err);
      alert("Error al aprobar. Revisá la consola.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (req: AccessRequest) => {
    setActionLoading(req.id);
    try {
      await updateDoc(doc(db, "access_requests", req.id), {
        status: "rejected",
        approvedBy: user!.uid,
        approvedAt: Timestamp.now(),
      });
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
    } catch (err) {
      console.error("Error rejecting:", err);
    } finally {
      setActionLoading(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#074738] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-2xl font-bold text-[#074738]">Solicitudes de acceso</h1>
      <p className="mt-1 text-sm text-[#5e716b]">{requests.length} pendientes</p>

      <div className="mt-6 space-y-4">
        {requests.map((req) => (
          <div key={req.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="font-bold text-[#074738]">{req.name}</p>
            <p className="text-sm text-[#5e716b]">{req.email}</p>
            <p className="mt-1 text-xs text-slate-400">Via {req.source} · {req.createdAt?.toDate?.()?.toLocaleDateString() || "?"}</p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => handleApprove(req)}
                disabled={actionLoading === req.id}
                className="flex-1 rounded-full bg-[#074738] py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {actionLoading === req.id ? "..." : "Aprobar"}
              </button>
              <button
                onClick={() => handleReject(req)}
                disabled={actionLoading === req.id}
                className="flex-1 rounded-full border border-red-300 py-2 text-sm font-bold text-red-600 disabled:opacity-60"
              >
                Rechazar
              </button>
            </div>
          </div>
        ))}
        {requests.length === 0 && (
          <p className="py-12 text-center text-sm text-[#5e716b]">No hay solicitudes pendientes.</p>
        )}
      </div>
    </div>
  );
}
```

**Note:** This component imports `functions` from `../../lib/firebase`. Verify that `functions` is exported from that file. If not, the implementer should add `export const functions = getFunctions(app);` — but ONLY after confirming this doesn't conflict with existing exports. If `functions` is not exported, use `getFunctions` inline instead.

- [ ] **Step 2: Commit**

```bash
git add src/app/components/AdminAccessRequests.tsx
git commit -m "feat(invite): add admin access requests panel"
```

---

## Task 9: Cloud Function `approveAccessRequest`

**Files:**
- Modify: `functions/src/index.ts` (append at end)

- [ ] **Step 1: Add the callable function**

Append at the end of `functions/src/index.ts`:

```typescript
// ---------------------------------------------------------------------------
// Approve waitlist access request — generates token + sends welcome email
// ---------------------------------------------------------------------------
export const approveAccessRequest = functions
  .region("us-central1")
  .runWith({ secrets: ["RESEND_API_KEY"] })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Requiere sesión activa.");
    }

    // Admin check
    const callerEmail = (context.auth.token.email || "").toLowerCase();
    if (callerEmail !== "mauriciogoitia@gmail.com") {
      throw new functions.https.HttpsError("permission-denied", "Solo admin puede aprobar.");
    }

    const requestId = (data.requestId || "").trim();
    if (!requestId) {
      throw new functions.https.HttpsError("invalid-argument", "requestId requerido.");
    }

    const admin = await import("firebase-admin");
    const firestore = admin.firestore();
    const docRef = firestore.collection("access_requests").doc(requestId);
    const snap = await docRef.get();

    if (!snap.exists) {
      throw new functions.https.HttpsError("not-found", "Solicitud no encontrada.");
    }

    const reqData = snap.data()!;
    if (reqData.status !== "pending") {
      throw new functions.https.HttpsError("failed-precondition", "Solicitud ya procesada.");
    }

    // Generate 8-char access token
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let accessToken = "";
    for (let i = 0; i < 8; i++) {
      accessToken += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const now = admin.firestore.Timestamp.now();
    const expiresAt = admin.firestore.Timestamp.fromMillis(now.toMillis() + 24 * 60 * 60 * 1000);

    await docRef.update({
      status: "approved",
      approvedAt: now,
      approvedBy: context.auth.uid,
      accessToken,
      accessTokenExpiresAt: expiresAt,
    });

    // Send approval email via Resend
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (RESEND_API_KEY) {
      const { Resend } = await import("resend");
      const resend = new Resend(RESEND_API_KEY);

      const inviteLink = `https://app.pessy.app/register-user?access=${accessToken}`;

      await resend.emails.send({
        from: "PESSY <noreply@pessy.app>",
        to: reqData.email,
        subject: "Ya tenés acceso a Pessy",
        html: `
          <div style="font-family: 'Manrope', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
            <h1 style="color: #074738; font-size: 24px;">Hola ${reqData.name}</h1>
            <p style="color: #5e716b; font-size: 15px; line-height: 1.6;">
              Tu solicitud de acceso a Pessy fue aprobada. Tenés 24 horas para crear tu cuenta.
            </p>
            <a href="${inviteLink}" style="display: block; background: #074738; color: white; text-align: center; padding: 16px; border-radius: 999px; font-weight: bold; text-decoration: none; margin-top: 24px;">
              Crear mi cuenta
            </a>
            <p style="color: #9ca8a2; font-size: 12px; margin-top: 24px;">
              Este link expira en 24 horas. Si no lo pediste, ignorá este email.
            </p>
          </div>
        `,
      });
    }

    return { ok: true, accessToken };
  });
```

- [ ] **Step 2: Verify functions compile**

Run: `cd /Users/mauriciogoitia/Downloads/03_PESSY_APP/PESSY_PRODUCCION/.claude/worktrees/clever-wilson/functions && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add functions/src/index.ts
git commit -m "feat(invite): add approveAccessRequest cloud function"
```

---

## Task 10: Verify `functions` export from firebase.ts

**Files:**
- Read only: `src/lib/firebase.ts`

- [ ] **Step 1: Check if `functions` is exported**

Run: `grep -n "functions\|getFunctions" src/lib/firebase.ts`

If `functions` is NOT exported, add this to the exports:

```typescript
import { getFunctions } from "firebase/functions";
export const functions = getFunctions(app);
```

**GUARDRAIL:** Only add this one line. Do not modify anything else in firebase.ts.

- [ ] **Step 2: Commit if changed**

```bash
git add src/lib/firebase.ts
git commit -m "feat(invite): export functions from firebase.ts"
```

---

## Task 11: Full build verification

- [ ] **Step 1: Run TypeScript check**

Run: `cd /Users/mauriciogoitia/Downloads/03_PESSY_APP/PESSY_PRODUCCION/.claude/worktrees/clever-wilson && npx tsc --noEmit 2>&1 | tail -20`
Expected: No errors

- [ ] **Step 2: Run Vite build**

Run: `cd /Users/mauriciogoitia/Downloads/03_PESSY_APP/PESSY_PRODUCCION/.claude/worktrees/clever-wilson && npx vite build 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 3: Run functions build**

Run: `cd /Users/mauriciogoitia/Downloads/03_PESSY_APP/PESSY_PRODUCCION/.claude/worktrees/clever-wilson/functions && npm run build 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix(invite): build fixes"
```
