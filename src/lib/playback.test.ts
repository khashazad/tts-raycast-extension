import { describe, expect, it } from "vitest";

import { clampOffset, getCurrentOffset } from "./playback";

describe("getCurrentOffset", () => {
  it("adds elapsed runtime seconds to existing offset", () => {
    const offset = getCurrentOffset({
      startedAt: 10_000,
      offset: 3,
      now: 13_500,
    });

    expect(offset).toBe(6.5);
  });
});

describe("clampOffset", () => {
  it("keeps offset in the 0..audioDuration range", () => {
    expect(clampOffset(-3, 20)).toBe(0);
    expect(clampOffset(12, 20)).toBe(12);
    expect(clampOffset(30, 20)).toBe(20);
  });
});
