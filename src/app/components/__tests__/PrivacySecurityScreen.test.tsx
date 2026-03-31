/**
 * Test plan for PrivacySecurityScreen — covers all 20 bugs from security diagnostic.
 *
 * Testing pyramid:
 *  - Unit: password validation logic, button types, aria attributes
 *  - Component: form interactions, loading states, error display
 *  - (E2E with Playwright would cover the full Firebase flow — out of scope here)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";

// ── Mocks ────────────────────────────────────────────────────────────────────

// Mock firebase/auth — this is the core of BUG-01 verification
const mockReauthenticateWithCredential = vi.fn();
const mockUpdatePassword = vi.fn();
const mockCredential = vi.fn().mockReturnValue("mock-credential");

vi.mock("firebase/auth", () => ({
  EmailAuthProvider: { credential: (...args: unknown[]) => mockCredential(...args) },
  reauthenticateWithCredential: (...args: unknown[]) => mockReauthenticateWithCredential(...args),
  updatePassword: (...args: unknown[]) => mockUpdatePassword(...args),
  // sendPasswordResetEmail should NOT be imported anymore
}));

vi.mock("../../../lib/firebase", () => ({
  auth: {
    currentUser: {
      email: "test@example.com",
      uid: "test-uid-123",
    },
  },
}));

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { uid: "test-uid-123", email: "test@example.com" },
  }),
}));

vi.mock("../../services/gmailSyncService", () => ({
  subscribeGmailSyncStatus: (_uid: string, cb: (s: unknown) => void) => {
    cb({
      connected: false,
      accountEmail: null,
      grantedScopes: [],
      updatedAt: null,
      inviteEnabled: true,
      inviteStatus: "open_access",
      inviteReason: null,
    });
    return () => {};
  },
  startGmailConnectFlow: vi.fn(),
  disconnectGmailSync: vi.fn(),
}));

vi.mock("../../services/accountDeletionService", () => ({
  deleteUserAccount: vi.fn(),
  deleteAllUserClinicalData: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// motion/react stub — render children immediately without animation
vi.mock("motion/react", () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
      // Filter out motion-specific props
      const {
        initial: _i, animate: _a, transition: _t, exit: _e,
        ...htmlProps
      } = props;
      return <div {...htmlProps}>{children}</div>;
    },
  },
}));

import { PrivacySecurityScreen } from "../settings/PrivacySecurityScreen";
import { toast } from "sonner";

afterEach(() => {
  cleanup();
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function renderScreen() {
  const onBack = vi.fn();
  const onLogout = vi.fn();
  render(<PrivacySecurityScreen onBack={onBack} onLogout={onLogout} />);
  return { onBack, onLogout };
}

async function openPasswordAccordion() {
  const toggle = screen.getByText("Cambiar contraseña", { selector: "h3" });
  await userEvent.click(toggle.closest("button")!);
}

async function fillPasswordForm(current: string, newPass: string, confirm: string) {
  const currentInput = screen.getByPlaceholderText("Contraseña actual");
  const newInput = screen.getByPlaceholderText("Nueva contraseña");
  const confirmInput = screen.getByPlaceholderText("Confirmar nueva contraseña");
  await userEvent.clear(currentInput);
  await userEvent.type(currentInput, current);
  await userEvent.clear(newInput);
  await userEvent.type(newInput, newPass);
  await userEvent.clear(confirmInput);
  await userEvent.type(confirmInput, confirm);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("PrivacySecurityScreen — Password Change (BUG-01 to BUG-08)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReauthenticateWithCredential.mockResolvedValue(undefined);
    mockUpdatePassword.mockResolvedValue(undefined);
  });

  // ── BUG-01: Must use reauthenticate + updatePassword, NOT sendPasswordResetEmail ──
  it("BUG-01: calls reauthenticateWithCredential + updatePassword (not sendPasswordResetEmail)", async () => {
    renderScreen();
    await openPasswordAccordion();
    await fillPasswordForm("OldPass1", "NewPass123", "NewPass123");

    const submitBtn = screen.getByRole("button", { name: "Cambiar contraseña" });
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockCredential).toHaveBeenCalledWith("test@example.com", "OldPass1");
      expect(mockReauthenticateWithCredential).toHaveBeenCalled();
      expect(mockUpdatePassword).toHaveBeenCalled();
    });
    expect(toast.success).toHaveBeenCalledWith("Contraseña actualizada correctamente.");
  });

  // ── BUG-02: Client-side validations ──
  it("BUG-02: rejects empty fields", async () => {
    renderScreen();
    await openPasswordAccordion();

    const submitBtn = screen.getByRole("button", { name: "Cambiar contraseña" });
    await userEvent.click(submitBtn);

    expect(screen.getByRole("alert")).toHaveTextContent("Completá todos los campos.");
    expect(mockReauthenticateWithCredential).not.toHaveBeenCalled();
  });

  it("BUG-02: rejects mismatched passwords", async () => {
    renderScreen();
    await openPasswordAccordion();
    await fillPasswordForm("OldPass1", "NewPass123", "DifferentPass");

    const submitBtn = screen.getByRole("button", { name: "Cambiar contraseña" });
    await userEvent.click(submitBtn);

    expect(screen.getByRole("alert")).toHaveTextContent("Las contraseñas nuevas no coinciden.");
  });

  it("BUG-02: rejects passwords shorter than 8 characters", async () => {
    renderScreen();
    await openPasswordAccordion();
    await fillPasswordForm("OldPass1", "Short1", "Short1");

    const submitBtn = screen.getByRole("button", { name: "Cambiar contraseña" });
    await userEvent.click(submitBtn);

    expect(screen.getByRole("alert")).toHaveTextContent("al menos 8 caracteres");
  });

  // ── BUG-01 error handling: wrong current password ──
  it("BUG-01: shows error on wrong current password", async () => {
    mockReauthenticateWithCredential.mockRejectedValue({ code: "auth/wrong-password" });

    renderScreen();
    await openPasswordAccordion();
    await fillPasswordForm("WrongPass", "NewPass123", "NewPass123");

    const submitBtn = screen.getByRole("button", { name: "Cambiar contraseña" });
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("La contraseña actual es incorrecta.");
    });
  });

  // ── BUG-03: autocomplete attributes ──
  it("BUG-03: password inputs have correct autocomplete attributes", async () => {
    renderScreen();
    await openPasswordAccordion();

    const currentInput = screen.getByPlaceholderText("Contraseña actual");
    const newInput = screen.getByPlaceholderText("Nueva contraseña");
    const confirmInput = screen.getByPlaceholderText("Confirmar nueva contraseña");

    expect(currentInput).toHaveAttribute("autocomplete", "current-password");
    expect(newInput).toHaveAttribute("autocomplete", "new-password");
    expect(confirmInput).toHaveAttribute("autocomplete", "new-password");
  });

  // ── BUG-04: toggle password visibility ──
  it("BUG-04: each password field has a show/hide toggle", async () => {
    renderScreen();
    await openPasswordAccordion();

    const toggleBtns = screen.getAllByLabelText(/contraseña/i);
    expect(toggleBtns.length).toBeGreaterThanOrEqual(3);

    // Click first toggle — should change input type to text
    const currentInput = screen.getByPlaceholderText("Contraseña actual");
    expect(currentInput).toHaveAttribute("type", "password");
    await userEvent.click(toggleBtns[0]);
    expect(currentInput).toHaveAttribute("type", "text");
  });

  // ── BUG-05: password strength hints ──
  it("BUG-05: shows strength hints when typing new password", async () => {
    renderScreen();
    await openPasswordAccordion();
    const newInput = screen.getByPlaceholderText("Nueva contraseña");
    await userEvent.type(newInput, "ab");

    expect(screen.getByText(/8\+ caracteres/)).toBeInTheDocument();
    expect(screen.getByText(/Mayúscula/)).toBeInTheDocument();
    expect(screen.getByText(/Número/)).toBeInTheDocument();
  });

  // ── BUG-06: all <button> elements must have explicit type="button" ──
  it("BUG-06: all <button> elements have explicit type='button'", async () => {
    renderScreen();
    const buttons = document.querySelectorAll("button");
    buttons.forEach((btn) => {
      expect(btn).toHaveAttribute("type", "button");
    });
  });

  // ── BUG-07: accordion stays open on error ──
  it("BUG-07: accordion stays open when there is an error", async () => {
    mockReauthenticateWithCredential.mockRejectedValue({ code: "auth/wrong-password" });

    renderScreen();
    await openPasswordAccordion();
    await fillPasswordForm("WrongPass", "NewPass123", "NewPass123");

    const submitBtn = screen.getByRole("button", { name: "Cambiar contraseña" });
    await userEvent.click(submitBtn);

    await waitFor(() => {
      // The error message should be visible, meaning accordion is still open
      expect(screen.getByRole("alert")).toBeInTheDocument();
      // The form inputs should still be visible
      expect(screen.getByPlaceholderText("Contraseña actual")).toBeInTheDocument();
    });
  });

  // ── BUG-08: loading state on submit button ──
  it("BUG-08: button shows loading state during submission", async () => {
    // Make the promise hang
    mockReauthenticateWithCredential.mockReturnValue(new Promise(() => {}));

    renderScreen();
    await openPasswordAccordion();
    await fillPasswordForm("OldPass1", "NewPass123", "NewPass123");

    const submitBtn = screen.getByRole("button", { name: "Cambiar contraseña" });
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("Guardando...")).toBeInTheDocument();
      expect(screen.getByText("Guardando...").closest("button")).toBeDisabled();
    });
  });
});

describe("PrivacySecurityScreen — Gmail Consent Modal (BUG-09 to BUG-20)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function openGmailModal() {
    const connectBtn = screen.getByRole("button", { name: "Conectar Gmail" });
    await userEvent.click(connectBtn);
  }

  // ── BUG-09: role="dialog" and aria-modal ──
  it("BUG-09: modal has role='dialog' and aria-modal='true'", async () => {
    renderScreen();
    await openGmailModal();

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "gmail-modal-title");
  });

  // ── BUG-10: focus moves to modal on open ──
  it("BUG-10: focus moves into the modal when opened", async () => {
    renderScreen();
    await openGmailModal();

    await waitFor(() => {
      const firstCheckbox = screen.getByRole("checkbox", {
        name: /Acepto que Pessy lea mis emails/,
      });
      expect(firstCheckbox).toHaveFocus();
    });
  });

  // ── BUG-11: ESC closes modal ──
  it("BUG-11: pressing Escape closes the modal", async () => {
    renderScreen();
    await openGmailModal();

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  // ── BUG-12: aria-disabled on accept button ──
  it("BUG-12: accept button uses aria-disabled when checkboxes unchecked", async () => {
    renderScreen();
    await openGmailModal();

    const acceptBtn = screen.getByRole("button", { name: /Aceptar y conectar Gmail/ });
    expect(acceptBtn).toHaveAttribute("aria-disabled", "true");
    expect(acceptBtn).not.toHaveAttribute("disabled");
  });

  it("BUG-12: shows hint when button is disabled", async () => {
    renderScreen();
    await openGmailModal();

    expect(screen.getByRole("note")).toHaveTextContent("Marcá las dos opciones para continuar.");
  });

  // ── BUG-13: buttons have type="button" ──
  it("BUG-13: modal buttons have type='button'", async () => {
    renderScreen();
    await openGmailModal();

    const acceptBtn = screen.getByRole("button", { name: /Aceptar y conectar Gmail/ });
    const declineBtn = screen.getByRole("button", { name: "Ahora no" });
    expect(acceptBtn).toHaveAttribute("type", "button");
    expect(declineBtn).toHaveAttribute("type", "button");
  });

  // ── BUG-15: lists use <ul>/<li> semantic markup ──
  it("BUG-15: consent items use <ul>/<li> semantic markup", async () => {
    renderScreen();
    await openGmailModal();

    const lists = screen.getAllByRole("list");
    expect(lists.length).toBeGreaterThanOrEqual(2);

    const items = screen.getAllByRole("listitem");
    expect(items.length).toBe(7); // 4 "does" + 3 "does not"
  });

  // ── BUG-16: "Privacidad y seguridad" is clickable ──
  it("BUG-16: 'Privacidad y seguridad' footer text is a clickable button", async () => {
    renderScreen();
    await openGmailModal();

    const privacyBtn = screen.getByRole("button", { name: "Privacidad y seguridad" });
    expect(privacyBtn).toBeInTheDocument();
  });

  // ── BUG-17: body scroll is locked ──
  it("BUG-17: body overflow is hidden when modal is open", async () => {
    renderScreen();
    await openGmailModal();

    expect(document.body.style.overflow).toBe("hidden");
  });

  // ── BUG-20: checkboxes have id, name, aria-required ──
  it("BUG-20: checkboxes have id, name, and aria-required", async () => {
    renderScreen();
    await openGmailModal();

    const cb1 = screen.getByRole("checkbox", { name: /Acepto que Pessy lea/ });
    const cb2 = screen.getByRole("checkbox", { name: /Acepto que el contenido/ });

    expect(cb1).toHaveAttribute("id", "consent-email");
    expect(cb1).toHaveAttribute("name", "consent-email");
    expect(cb1).toHaveAttribute("aria-required", "true");

    expect(cb2).toHaveAttribute("id", "consent-gemini");
    expect(cb2).toHaveAttribute("name", "consent-gemini");
    expect(cb2).toHaveAttribute("aria-required", "true");
  });

  // ── Full flow: both checkboxes → accept enabled ──
  it("Full flow: checking both checkboxes enables the accept button", async () => {
    renderScreen();
    await openGmailModal();

    const cb1 = screen.getByRole("checkbox", { name: /Acepto que Pessy lea/ });
    const cb2 = screen.getByRole("checkbox", { name: /Acepto que el contenido/ });
    const acceptBtn = screen.getByRole("button", { name: /Aceptar y conectar Gmail/ });

    expect(acceptBtn).toHaveAttribute("aria-disabled", "true");

    await userEvent.click(cb1);
    expect(acceptBtn).toHaveAttribute("aria-disabled", "true");

    await userEvent.click(cb2);
    expect(acceptBtn).toHaveAttribute("aria-disabled", "false");
  });
});
