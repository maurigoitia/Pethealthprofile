import { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";
import {
  clearPendingCoTutorInvite,
  readPendingCoTutorInvite,
} from "../utils/coTutorInvite";

export interface InviteNotice {
  type: "info" | "success" | "error";
  message: string;
}

export interface UseAcceptPetInviteResult {
  /** Banner to render (null when idle). */
  inviteNotice: InviteNotice | null;
  /** Non-empty while the joinWithCode call is in-flight — use to show a loading screen. */
  inviteJoiningCode: string;
  /** Code that was fully resolved (success or permanent error) this session.
   *  Use to detect "just-accepted a shared pet" empty-state. */
  inviteResolvedCode: string;
  /** Exposed so callers can clear the post-success empty-state notice. */
  setInviteResolvedCode: Dispatch<SetStateAction<string>>;
}

/**
 * Reads a pending co-tutor invite code from localStorage (written either by
 * EmailLinkSignInScreen after magic-link auth, or by the ?invite= URL handler
 * in HomeScreen) and attempts to accept it automatically.
 *
 * Extracted from HomeScreen so it can be unit-tested in isolation.
 *
 * Timeout behaviour: if joinWithCode takes longer than 10 s the code is left
 * in localStorage for a retry on next mount, and an error notice is shown.
 */
export function useAcceptPetInvite(
  user: { uid: string } | null | undefined,
  joinWithCode: (code: string) => Promise<{ petName: string }>,
): UseAcceptPetInviteResult {
  const [inviteNotice, setInviteNotice] = useState<InviteNotice | null>(null);
  const [inviteJoiningCode, setInviteJoiningCode] = useState("");
  const [inviteResolvedCode, setInviteResolvedCode] = useState("");

  // Refs so the async closure always reads the latest values without needing
  // them in the dependency array (which would cause infinite re-runs).
  const joinWithCodeRef = useRef(joinWithCode);
  const inviteJoiningCodeRef = useRef(inviteJoiningCode);

  useEffect(() => { joinWithCodeRef.current = joinWithCode; }, [joinWithCode]);
  useEffect(() => { inviteJoiningCodeRef.current = inviteJoiningCode; }, [inviteJoiningCode]);

  useEffect(() => {
    if (!user) return;
    const pendingCode = readPendingCoTutorInvite();
    if (!pendingCode) return;
    // Skip if this code is already in-flight or was resolved this session.
    if (pendingCode === inviteJoiningCodeRef.current || pendingCode === inviteResolvedCode) return;

    let cancelled = false;
    let timedOut = false;

    setInviteJoiningCode(pendingCode);
    setInviteNotice({ type: "info", message: "Vinculando la invitación de co-tutor..." });

    // Safety timeout: if the callable takes too long, surface an error and
    // leave the code in localStorage so the next app launch retries it.
    const timeout = window.setTimeout(() => {
      if (cancelled) return;
      timedOut = true;
      setInviteJoiningCode("");
      setInviteNotice({
        type: "error",
        message:
          "La invitación está tardando más de lo normal. La vamos a reintentar cuando vuelvas a entrar.",
      });
      window.setTimeout(() => {
        setInviteNotice((current) => (current?.type === "error" ? null : current));
      }, 5000);
    }, 10_000);

    void joinWithCodeRef
      .current(pendingCode)
      .then(({ petName }) => {
        if (cancelled) return;
        window.clearTimeout(timeout);
        clearPendingCoTutorInvite();
        setInviteResolvedCode(pendingCode);
        setInviteNotice({
          type: "success",
          message: `Acceso confirmado. Ya tenés acceso a ${petName}.`,
        });
        window.setTimeout(() => {
          setInviteNotice((current) => (current?.type === "success" ? null : current));
        }, 5000);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        window.clearTimeout(timeout);
        if (!timedOut) {
          clearPendingCoTutorInvite();
          setInviteResolvedCode(pendingCode);
        }
        const msg = (error as any)?.message || "";
        // Errors that are expected / non-actionable: own pet, already joined.
        const silent =
          msg.includes("propia mascota") ||
          msg.includes("ya sos") ||
          msg.includes("ya fue utilizado") ||
          msg.includes("Ya sos tutor");
        if (!silent) {
          setInviteNotice({
            type: "error",
            message: msg || "No se pudo completar la invitación de co-tutor.",
          });
          window.setTimeout(() => {
            setInviteNotice((current) => (current?.type === "error" ? null : current));
          }, 5000);
        } else {
          setInviteNotice(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          window.clearTimeout(timeout);
          setInviteJoiningCode("");
        }
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
    // inviteResolvedCode intentionally in deps: changing it means the user
    // cleared the post-success notice, and we should NOT re-run for the same code.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, inviteResolvedCode]);

  return { inviteNotice, inviteJoiningCode, inviteResolvedCode, setInviteResolvedCode };
}
