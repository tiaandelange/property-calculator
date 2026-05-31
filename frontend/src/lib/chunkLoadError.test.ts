import { describe, expect, it } from "vitest";
import { isChunkLoadError } from "./chunkLoadError";

describe("isChunkLoadError", () => {
  it("detects ChunkLoadError by name", () => {
    expect(isChunkLoadError(new Error("x"))).toBe(false);
    const err = new Error("Loading chunk 123 failed.");
    err.name = "ChunkLoadError";
    expect(isChunkLoadError(err)).toBe(true);
  });

  it("detects dynamic import failure messages", () => {
    expect(isChunkLoadError(new Error("Failed to fetch dynamically imported module"))).toBe(true);
    expect(isChunkLoadError(new Error("error loading dynamically imported module"))).toBe(true);
    expect(isChunkLoadError(new Error("Importing a module script failed."))).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    expect(isChunkLoadError(new Error("Network request failed"))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });
});
