import { describe, expect, it } from "vitest";
import { searchWorkspace } from "./workspaceSearchSupabase";

describe("searchWorkspace", () => {
  it("returns empty for short queries without calling RPC", async () => {
    await expect(searchWorkspace("a")).resolves.toEqual([]);
  });
});
