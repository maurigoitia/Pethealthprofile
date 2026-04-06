import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockNavigate = vi.fn();
const mockRememberPending = vi.fn();
const mockSignInWithEmailLink = vi.fn();
const mockIsSignInWithEmailLink = vi.fn();

vi.mock("react-router", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ search: "?invite=ABC123", pathname: "/email-link", hash: "", state: null, key: "test" }),
}));

vi.mock("firebase/auth", () => ({
  isSignInWithEmailLink: (...args: unknown[]) => mockIsSignInWithEmailLink(...args),
  signInWithEmailLink: (...args: unknown[]) => mockSignInWithEmailLink(...args),
}));

vi.mock("../../utils/coTutorInvite", () => ({
  rememberPendingCoTutorInvite: (...args: unknown[]) => mockRememberPending(...args),
}));

vi.mock("../../../lib/firebase", () => ({
  auth: {},
}));

import { EmailLinkSignInScreen } from "../auth/EmailLinkSignInScreen";

describe("EmailLinkSignInScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSignInWithEmailLink.mockReturnValue(true);
    mockSignInWithEmailLink.mockResolvedValue(undefined);
    localStorage.clear();
  });

  it("stores the invite and delegates the join to HomeScreen after sign-in", async () => {
    const realSetTimeout = window.setTimeout.bind(window);
    const setTimeoutSpy = vi
      .spyOn(window, "setTimeout")
      .mockImplementation((handler: TimerHandler, timeout?: number, ...args: any[]) =>
        realSetTimeout(handler, timeout === 1_200 ? 0 : timeout, ...args)
      );

    render(<EmailLinkSignInScreen />);

    fireEvent.change(screen.getByPlaceholderText("tu correo"), {
      target: { value: "cotutor@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar acceso" }));

    await waitFor(() => {
      expect(mockSignInWithEmailLink).toHaveBeenCalledWith({}, "cotutor@example.com", window.location.href);
    });

    expect(mockRememberPending).toHaveBeenCalledWith("ABC123");
    expect(await screen.findByText("Sesión iniciada correctamente. Estamos validando la invitación.")).toBeTruthy();
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/home", { replace: true });
    });

    setTimeoutSpy.mockRestore();
  });
});
