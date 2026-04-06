import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clampOffset,
  getBinaryLookupCandidates,
  getCurrentOffset,
  getPlaybackInvocation,
  pauseProcess,
  resumeProcess,
  stopProcessWithEscalation,
} from "./playback";

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

describe("getBinaryLookupCandidates", () => {
  it("prefers absolute afplay path on darwin", () => {
    expect(getBinaryLookupCandidates("afplay", "darwin")).toEqual(["/usr/bin/afplay", "afplay"]);
  });

  it("checks common macOS ffplay install locations before PATH", () => {
    expect(getBinaryLookupCandidates("ffplay", "darwin")).toEqual([
      "/opt/homebrew/bin/ffplay",
      "/usr/local/bin/ffplay",
      "ffplay",
    ]);
  });
});

describe("signal-based playback control", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("pauses alive process with SIGSTOP", () => {
    const killSpy = vi.spyOn(process, "kill").mockImplementation(() => true);

    pauseProcess(1234);

    expect(killSpy).toHaveBeenCalledWith(1234, "SIGSTOP");
  });

  it("resumes alive process with SIGCONT", () => {
    const killSpy = vi.spyOn(process, "kill").mockImplementation(() => true);

    resumeProcess(1234);

    expect(killSpy).toHaveBeenCalledWith(1234, "SIGCONT");
  });

  it("escalates from SIGTERM to SIGKILL when process remains alive", async () => {
    let isAlive = true;
    const signalsSent: NodeJS.Signals[] = [];
    const killSpy = vi.spyOn(process, "kill").mockImplementation(((pid: number, signal?: number | NodeJS.Signals) => {
      if (signal === 0) {
        if (isAlive) {
          return true;
        }

        throw new Error("ESRCH");
      }

      if (typeof signal === "string") {
        signalsSent.push(signal);
      }

      if (signal === "SIGKILL") {
        isAlive = false;
      }

      return true;
    }) as typeof process.kill);

    await stopProcessWithEscalation(1234, 0);

    expect(killSpy).toHaveBeenCalled();
    expect(signalsSent).toEqual(["SIGTERM", "SIGKILL"]);
  });

  it("does not SIGKILL when SIGTERM already stopped process", async () => {
    let isAlive = true;
    const signalsSent: NodeJS.Signals[] = [];
    const killSpy = vi.spyOn(process, "kill").mockImplementation(((pid: number, signal?: number | NodeJS.Signals) => {
      if (signal === 0) {
        if (isAlive) {
          return true;
        }

        throw new Error("ESRCH");
      }

      if (typeof signal === "string") {
        signalsSent.push(signal);
      }

      if (signal === "SIGTERM") {
        isAlive = false;
      }

      return true;
    }) as typeof process.kill);

    await stopProcessWithEscalation(1234, 0);

    expect(killSpy).toHaveBeenCalled();
    expect(signalsSent).toEqual(["SIGTERM"]);
  });
});
