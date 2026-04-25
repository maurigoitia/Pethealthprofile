import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadPessyLogo, __resetLogoCacheForTests } from "./loadLogo";

describe("loadPessyLogo", () => {
  beforeEach(() => {
    __resetLogoCacheForTests();
  });

  it("returns a PNG data URL string", async () => {
    const mockBlob = new Blob(["fake-png-bytes"], { type: "image/png" });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
    } as any);
    const original = (global as any).FileReader;
    class FR {
      result = "data:image/png;base64,FAKE";
      onloadend: (() => void) | null = null;
      readAsDataURL() {
        setTimeout(() => this.onloadend?.(), 0);
      }
    }
    (global as any).FileReader = FR;

    const url = await loadPessyLogo();
    expect(url).toBe("data:image/png;base64,FAKE");

    (global as any).FileReader = original;
  });

  it("throws when fetch fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as any);
    await expect(loadPessyLogo()).rejects.toThrow(/logo/i);
  });
});
