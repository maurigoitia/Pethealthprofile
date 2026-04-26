import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadPessyLogo, __resetLogoCacheForTests } from "./loadLogo";

describe("loadPessyLogo", () => {
  beforeEach(() => {
    __resetLogoCacheForTests();
  });

  it("throws when SVG fetch fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as any);
    await expect(loadPessyLogo()).rejects.toThrow(/logo/i);
  });

  it("requests the SVG (not the PNG) for color recoloring", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    } as any);
    global.fetch = fetchMock;
    await expect(loadPessyLogo("white")).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledWith("/pessy-logo.svg");
  });
});
