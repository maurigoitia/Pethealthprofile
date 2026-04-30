/**
 * Test suite: LoginScreen
 * Agent: code-reviewer
 *
 * Coverage targets:
 *  - Render: email/password inputs, submit button, Google sign-in
 *  - Email+password login: success → /home, error messages per code
 *  - "¿Olvidaste tu contraseña?" → navigates to /forgot-password (NOT opens modal)
 *  - "Crear cuenta" → navigates to /register-user
 *  - Loading state during login
 *  - Accessibility: button types, password field type
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockSignInWithEmailAndPassword = vi.fn();
const mockSignInWithPopup = vi.fn();
const mockGetRedirectResult = vi.fn().mockResolvedValue(null);
const mockNavigate = vi.fn();

vi.mock("firebase/auth", () => ({
  signInWithEmailAndPassword: (...a: unknown[]) => mockSignInWithEmailAndPassword(...a),
  GoogleAuthProvider: class { addScope() {} },
  signInWithPopup: (...a: unknown[]) => mockSignInWithPopup(...a),
  signInWithRedirect: vi.fn(),
  getRedirectResult: (...a: unknown[]) => mockGetRedirectResult(...a),
}));

vi.mock("../../../lib/firebase", () => ({ auth: { app: {} } }));

vi.mock("../shared/SEO", () => ({ SEO: () => null }));
vi.mock("./AuthPageShell", () => ({
  AuthPageShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../../utils/runtimeFlags", () => ({ isNativeAppContext: () => false }));
vi.mock("../../utils/coTutorInvite", () => ({
  normalizeCoTutorInviteCode: () => null,
  rememberPendingCoTutorInvite: vi.fn(),
}));
vi.mock("../../utils/acquisitionTracking", () => ({
  persistAcquisitionSource: vi.fn(),
  resolveAcquisitionSource: () => null,
  trackAcquisitionEvent: vi.fn(),
}));

vi.mock("react-router", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ search: "", pathname: "/login" }),
  Navigate: ({ to }: { to: string }) => <div data-testid="navigate" data-to={to} />,
}));

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ user: null, loading: false, userName: null }),
}));

// ── Component ─────────────────────────────────────────────────────────────────

import { LoginScreen } from "../auth/LoginScreen";

// ─────────────────────────────────────────────────────────────────────────────

describe("LoginScreen — Render", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders email input", () => {
    render(<LoginScreen />);
    expect(screen.getByPlaceholderText(/correo/i)).toBeInTheDocument();
  });

  it("renders password input", () => {
    render(<LoginScreen />);
    expect(screen.getByPlaceholderText(/contraseña/i)).toBeInTheDocument();
  });

  it("renders 'Ingresar' submit button", () => {
    render(<LoginScreen />);
    expect(screen.getByRole("button", { name: /ingresar/i })).toBeInTheDocument();
  });

  it("renders 'Google' sign-in button", () => {
    render(<LoginScreen />);
    expect(screen.getByRole("button", { name: /google/i })).toBeInTheDocument();
  });

  it("renders '¿Olvidaste tu contraseña?' button", () => {
    render(<LoginScreen />);
    expect(screen.getByRole("button", { name: /olvidaste tu contraseña/i })).toBeInTheDocument();
  });

  it("renders 'Crear cuenta' button", () => {
    render(<LoginScreen />);
    expect(screen.getByRole("button", { name: /crear cuenta/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("LoginScreen — Email/password login", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls signInWithEmailAndPassword with trimmed+lowercased email", async () => {
    mockSignInWithEmailAndPassword.mockResolvedValue({ user: { uid: "123" } });
    render(<LoginScreen />);
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText(/correo/i), "MAURI@PESSY.APP");
    await user.type(screen.getByPlaceholderText(/contraseña/i), "secret123");
    await user.click(screen.getByRole("button", { name: /ingresar/i }));

    await waitFor(() => {
      expect(mockSignInWithEmailAndPassword).toHaveBeenCalledWith(
        expect.anything(),
        "mauri@pessy.app",
        "secret123"
      );
    });
  });

  it("shows error for wrong-password", async () => {
    mockSignInWithEmailAndPassword.mockRejectedValue({ code: "auth/wrong-password" });
    render(<LoginScreen />);
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText(/correo/i), "mauri@pessy.app");
    await user.type(screen.getByPlaceholderText(/contraseña/i), "wrong");
    await user.click(screen.getByRole("button", { name: /ingresar/i }));

    await waitFor(() => {
      // Use specific regex to avoid matching "¿Olvidaste tu contraseña?" button
      expect(screen.getByText(/correo o contraseña incorrectos/i)).toBeInTheDocument();
    });
  });

  it("shows error for user-not-found", async () => {
    mockSignInWithEmailAndPassword.mockRejectedValue({ code: "auth/user-not-found" });
    render(<LoginScreen />);
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText(/correo/i), "ghost@test.com");
    await user.type(screen.getByPlaceholderText(/contraseña/i), "pass");
    await user.click(screen.getByRole("button", { name: /ingresar/i }));

    await waitFor(() => {
      expect(screen.getByText(/no encontramos|correo o contraseña|no hay cuenta/i)).toBeInTheDocument();
    });
  });

  it("shows network error", async () => {
    mockSignInWithEmailAndPassword.mockRejectedValue({ code: "auth/network-request-failed" });
    render(<LoginScreen />);
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText(/correo/i), "mauri@pessy.app");
    await user.type(screen.getByPlaceholderText(/contraseña/i), "pass");
    await user.click(screen.getByRole("button", { name: /ingresar/i }));

    await waitFor(() => {
      expect(screen.getByText(/conexión|internet|red/i)).toBeInTheDocument();
    });
  });

  it("disables submit button while loading", async () => {
    let resolve!: (v: unknown) => void;
    mockSignInWithEmailAndPassword.mockReturnValue(new Promise((r) => { resolve = r; }));

    render(<LoginScreen />);
    const user = userEvent.setup();
    const submitBtn = screen.getByRole("button", { name: /ingresar/i });

    await user.type(screen.getByPlaceholderText(/correo/i), "mauri@pessy.app");
    await user.type(screen.getByPlaceholderText(/contraseña/i), "pass");
    await user.click(submitBtn);

    expect(submitBtn).toBeDisabled();
    resolve({ user: { uid: "123" } });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("LoginScreen — Forgot password (no modal — REGRESIÓN)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("navigates to /forgot-password — NOT a modal", () => {
    render(<LoginScreen />);
    fireEvent.click(screen.getByRole("button", { name: /olvidaste tu contraseña/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/forgot-password");
  });

  it("no dialog/modal appears after clicking forgot password", () => {
    render(<LoginScreen />);
    fireEvent.click(screen.getByRole("button", { name: /olvidaste tu contraseña/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // No inline reset form should appear
    expect(screen.queryByRole("button", { name: /enviar link/i })).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("LoginScreen — Registration navigation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("'Crear cuenta' navigates to /register-user", () => {
    render(<LoginScreen />);
    fireEvent.click(screen.getByRole("button", { name: /crear cuenta/i }));
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining("/register-user")
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("LoginScreen — Accessibility", () => {
  it("all buttons have explicit type attribute", () => {
    render(<LoginScreen />);
    screen.getAllByRole("button").forEach((btn) => {
      expect(["button", "submit"]).toContain(btn.getAttribute("type"));
    });
  });

  it("password input defaults to type=password (not plain text)", () => {
    render(<LoginScreen />);
    expect(screen.getByPlaceholderText(/contraseña/i)).toHaveAttribute("type", "password");
  });
});
