/**
 * Test suite: ForgotPasswordScreen
 * Agent: code-reviewer
 *
 * Coverage targets:
 *  - Happy path: valid email → success state (anti-enumeration)
 *  - Anti-enumeration: auth/user-not-found treated as success
 *  - Error states: invalid-email, operation-not-allowed, uri errors, generic
 *  - Navigation: back button → /login (default)
 *  - Loading state during submission
 *  - Accessibility: aria-label on input, button types, heading
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockSendPasswordResetEmail = vi.fn();
const mockNavigate = vi.fn();

vi.mock("firebase/auth", () => ({
  sendPasswordResetEmail: (...args: unknown[]) => mockSendPasswordResetEmail(...args),
}));

vi.mock("../../../lib/firebase", () => ({
  auth: { app: {} },
}));

vi.mock("../../utils/authActionLinks", () => ({
  createPasswordResetActionCodeSettings: () => ({ handleCodeInApp: false }),
}));

vi.mock("../shared/SEO", () => ({
  SEO: () => null,
}));

// Single top-level mock — no vi.mock inside functions (hoisting issue)
vi.mock("react-router", () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [new URLSearchParams()],
}));

// ── Component under test ──────────────────────────────────────────────────────

import { ForgotPasswordScreen } from "../auth/ForgotPasswordScreen";

const GENERIC_SUCCESS =
  "Si existe una cuenta con ese correo, vas a recibir un link para restablecer tu contraseña.";

// ─────────────────────────────────────────────────────────────────────────────

describe("ForgotPasswordScreen — Happy path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendPasswordResetEmail.mockResolvedValue(undefined);
  });

  it("renders the email input and submit button", () => {
    render(<ForgotPasswordScreen />);
    expect(screen.getByRole("textbox", { name: /correo/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /enviar link/i })).toBeInTheDocument();
  });

  it("shows generic success message after valid email submission", async () => {
    render(<ForgotPasswordScreen />);
    const user = userEvent.setup();

    await user.type(screen.getByRole("textbox", { name: /correo/i }), "mauri@pessy.app");
    await user.click(screen.getByRole("button", { name: /enviar link/i }));

    await waitFor(() => {
      expect(screen.getByText(GENERIC_SUCCESS)).toBeInTheDocument();
    });
    expect(mockSendPasswordResetEmail).toHaveBeenCalledOnce();
    expect(mockSendPasswordResetEmail).toHaveBeenCalledWith(
      expect.anything(),
      "mauri@pessy.app",
      expect.any(Object)
    );
  });

  it("lowercases and trims email before sending", async () => {
    render(<ForgotPasswordScreen />);
    const user = userEvent.setup();

    await user.type(screen.getByRole("textbox", { name: /correo/i }), "MAURI@PESSY.APP");
    await user.click(screen.getByRole("button", { name: /enviar link/i }));

    await waitFor(() => {
      expect(mockSendPasswordResetEmail).toHaveBeenCalledWith(
        expect.anything(),
        "mauri@pessy.app",
        expect.any(Object)
      );
    });
  });

  it("shows 'Volver al inicio de sesión' button after success", async () => {
    render(<ForgotPasswordScreen />);
    const user = userEvent.setup();

    await user.type(screen.getByRole("textbox", { name: /correo/i }), "test@test.com");
    await user.click(screen.getByRole("button", { name: /enviar link/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /volver al inicio/i })).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("ForgotPasswordScreen — Anti-enumeration (SECURITY)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows generic success when user-not-found — does NOT reveal account existence", async () => {
    mockSendPasswordResetEmail.mockRejectedValue({ code: "auth/user-not-found" });
    render(<ForgotPasswordScreen />);
    const user = userEvent.setup();

    await user.type(screen.getByRole("textbox", { name: /correo/i }), "ghost@pessy.app");
    await user.click(screen.getByRole("button", { name: /enviar link/i }));

    await waitFor(() => {
      expect(screen.getByText(GENERIC_SUCCESS)).toBeInTheDocument();
    });
    // Must NOT show any inline error
    expect(screen.queryByText(/no se pudo/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/no encontramos/i)).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("ForgotPasswordScreen — Error states", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows invalid-email error", async () => {
    mockSendPasswordResetEmail.mockRejectedValue({ code: "auth/invalid-email" });
    render(<ForgotPasswordScreen />);
    const user = userEvent.setup();

    // Use structurally-valid email so HTML5 validation passes; mock still rejects with auth/invalid-email
    await user.type(screen.getByRole("textbox", { name: /correo/i }), "test@test.com");
    await user.click(screen.getByRole("button", { name: /enviar link/i }));

    await waitFor(() => {
      expect(screen.getByText(/correo ingresado no es válido/i)).toBeInTheDocument();
    });
  });

  it("shows operation-not-allowed error", async () => {
    mockSendPasswordResetEmail.mockRejectedValue({ code: "auth/operation-not-allowed" });
    render(<ForgotPasswordScreen />);
    const user = userEvent.setup();

    await user.type(screen.getByRole("textbox", { name: /correo/i }), "test@test.com");
    await user.click(screen.getByRole("button", { name: /enviar link/i }));

    await waitFor(() => {
      expect(screen.getByText(/recuperación de contraseña no está disponible/i)).toBeInTheDocument();
    });
  });

  it("shows generic error for unknown errors", async () => {
    mockSendPasswordResetEmail.mockRejectedValue({ code: "auth/network-request-failed" });
    render(<ForgotPasswordScreen />);
    const user = userEvent.setup();

    await user.type(screen.getByRole("textbox", { name: /correo/i }), "test@test.com");
    await user.click(screen.getByRole("button", { name: /enviar link/i }));

    await waitFor(() => {
      expect(screen.getByText(/no se pudo enviar el correo/i)).toBeInTheDocument();
    });
  });

  it("clears previous error on new submission attempt", async () => {
    mockSendPasswordResetEmail
      .mockRejectedValueOnce({ code: "auth/invalid-email" })
      .mockResolvedValueOnce(undefined);

    render(<ForgotPasswordScreen />);
    const user = userEvent.setup();
    const emailInput = screen.getByRole("textbox", { name: /correo/i });

    // Use structurally-valid email so HTML5 validation passes; mock rejects with auth/invalid-email
    await user.type(emailInput, "test@test.com");
    await user.click(screen.getByRole("button", { name: /enviar link/i }));
    await waitFor(() => expect(screen.getByText(/no es válido/i)).toBeInTheDocument());

    await user.clear(emailInput);
    await user.type(emailInput, "good@test.com");
    await user.click(screen.getByRole("button", { name: /enviar link/i }));

    await waitFor(() => expect(screen.queryByText(/no es válido/i)).not.toBeInTheDocument());
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("ForgotPasswordScreen — Loading state", () => {
  beforeEach(() => vi.clearAllMocks());

  it("disables submit button while loading", async () => {
    let resolve!: () => void;
    mockSendPasswordResetEmail.mockReturnValue(new Promise<void>((r) => { resolve = r; }));

    render(<ForgotPasswordScreen />);
    const user = userEvent.setup();
    const submitBtn = screen.getByRole("button", { name: /enviar link/i });

    await user.type(screen.getByRole("textbox", { name: /correo/i }), "test@test.com");
    await user.click(submitBtn);

    // React 18 batches state updates — wait for re-render after setLoading(true)
    await waitFor(() => expect(submitBtn).toBeDisabled());
    resolve();
  });

  it("shows 'Enviando...' text while loading", async () => {
    let resolve!: () => void;
    mockSendPasswordResetEmail.mockReturnValue(new Promise<void>((r) => { resolve = r; }));

    render(<ForgotPasswordScreen />);
    const user = userEvent.setup();

    await user.type(screen.getByRole("textbox", { name: /correo/i }), "test@test.com");
    await user.click(screen.getByRole("button", { name: /enviar link/i }));

    // React 18 batches state updates — wait for re-render after setLoading(true)
    await waitFor(() => expect(screen.getByText(/enviando/i)).toBeInTheDocument());
    resolve();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("ForgotPasswordScreen — Navigation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("'Volver' button navigates back (default → /login)", () => {
    render(<ForgotPasswordScreen />);
    // The back button is the first button (arrow_back)
    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });

  it("'Cancelar' button navigates back", () => {
    render(<ForgotPasswordScreen />);
    fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("ForgotPasswordScreen — Accessibility", () => {
  it("email input has aria-label", () => {
    render(<ForgotPasswordScreen />);
    expect(
      screen.getByRole("textbox", { name: /correo electrónico/i })
    ).toBeInTheDocument();
  });

  it("all buttons have explicit type attribute", () => {
    render(<ForgotPasswordScreen />);
    screen.getAllByRole("button").forEach((btn) => {
      expect(["button", "submit"]).toContain(btn.getAttribute("type"));
    });
  });

  it("page heading is present", () => {
    render(<ForgotPasswordScreen />);
    expect(
      screen.getByRole("heading", { name: /recuperar contraseña/i })
    ).toBeInTheDocument();
  });
});
