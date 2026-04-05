import { describe, expect, it } from "vitest";

import { clampOffset, getCurrentOffset, getPlaybackInvocation } from "./playback";

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

describe("getPlaybackInvocation", () => {
  it("uses afplay for zero offset playback", () => {
    expect(getPlaybackInvocation("/tmp/audio.mp3", 0)).toEqual({
      command: "afplay",
      args: ["/tmp/audio.mp3"],
    });
  });

  it("uses ffplay with -ss for resumed/skipped playback", () => {
    expect(getPlaybackInvocation("/tmp/audio.mp3", 12.5)).toEqual({
      command: "ffplay",
      args: ["-nodisp", "-autoexit", "-loglevel", "quiet", "-ss", "12.5", "-i", "/tmp/audio.mp3"],
    });
  });
});
