import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGenerateInviteCode = vi.fn();

vi.mock("../../contexts/PetContext", () => ({
  usePet: () => ({
    activePet: {
      id: "pet-1",
      name: "Thor",
      species: "dog",
      coTutors: [],
    },
    activePetId: "pet-1",
    generateInviteCode: (...args: unknown[]) => mockGenerateInviteCode(...args),
    sendCoTutorInviteEmail: vi.fn(),
    joinWithCode: vi.fn(),
    removeCoTutor: vi.fn(),
    leaveAsTutor: vi.fn(),
    isOwner: () => true,
    getPetAccessLevel: () => "owner",
  }),
}));

import { CoTutorModal } from "../pet/CoTutorModal";

describe("CoTutorModal", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateInviteCode.mockResolvedValue("ABC123");
  });

  it("resets generated invite state after closing and reopening", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    const { rerender } = render(<CoTutorModal isOpen onClose={onClose} />);

    await user.click(screen.getAllByRole("button", { name: /generar código de invitación/i })[0]);

    expect((await screen.findAllByText("ABC123")).length).toBeGreaterThan(0);

    rerender(<CoTutorModal isOpen={false} onClose={onClose} />);
    rerender(<CoTutorModal isOpen onClose={onClose} />);

    expect(screen.queryByText("ABC123")).toBeNull();
    expect(screen.getByRole("button", { name: /generar código de invitación/i })).toBeTruthy();
  });

  it("invalidates the visible code when the invite role changes", async () => {
    const user = userEvent.setup();

    render(<CoTutorModal isOpen onClose={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /generar código de invitación/i }));
    expect((await screen.findAllByText("ABC123")).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /guardián temporal/i }));

    expect(screen.queryByText("ABC123")).toBeNull();
    expect(screen.getAllByRole("button", { name: /generar código de invitación/i }).length).toBeGreaterThan(0);
  });
});
