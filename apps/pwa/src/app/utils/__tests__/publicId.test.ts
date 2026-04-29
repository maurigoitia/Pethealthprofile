import { describe, it, expect } from "vitest";
import { generatePublicId } from "../publicId";

const ALLOWED = /^pet-[abcdefghjkmnpqrstuvwxyz23456789]{6}$/;
const FORBIDDEN = /[0Ol1i]/;

describe("generatePublicId", () => {
  it("returns the `pet-XXXXXX` shape", () => {
    const id = generatePublicId();
    expect(id).toMatch(ALLOWED);
    expect(id.startsWith("pet-")).toBe(true);
    expect(id.length).toBe(10); // "pet-" + 6 chars
  });

  it("never includes ambiguous characters (0, O, 1, l, i)", () => {
    for (let i = 0; i < 200; i++) {
      const id = generatePublicId();
      expect(id.slice(4)).not.toMatch(FORBIDDEN);
    }
  });

  it("produces high-entropy values (no trivial collisions in 1000 ids)", () => {
    const set = new Set<string>();
    for (let i = 0; i < 1000; i++) set.add(generatePublicId());
    // 32^6 ≈ 1.07B → 1000 iterations should virtually never collide.
    expect(set.size).toBe(1000);
  });
});
