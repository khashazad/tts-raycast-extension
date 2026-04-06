import { beforeEach, describe, expect, it, vi } from "vitest";

const { rmMock } = vi.hoisted(() => ({
  rmMock: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  rm: rmMock,
}));

import { createGeneratingState, isCurrentSession, removeAudioFile } from "./command-utils";
import { getAudioFilePath } from "./constants";
import type { TTSState } from "./types";

/**
 * Creates a lightweight state fixture for session guard tests.
 *
 * @param {string} sessionId - Session identifier to place on state.
 * @returns {TTSState} Synthetic state object.
 */
function createState(sessionId: string): TTSState {
  return {
    sessionId,
    status: "generating",
    startedAt: 1_000,
    offset: 0,
    pid: 0,
    audioPath: getAudioFilePath(sessionId),
    audioDuration: 0,
    words: [],
  };
}

describe("session utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rmMock.mockResolvedValue(undefined);
  });

  it("builds unique audio paths for different session ids", () => {
    expect(getAudioFilePath("session-a")).not.toBe(getAudioFilePath("session-b"));
  });

  it("rejects invalid session ids when building audio paths", () => {
    expect(() => getAudioFilePath("session_1")).toThrowError("Invalid session id");
  });

  it("creates generating state with session ownership", () => {
    const state = createGeneratingState(getAudioFilePath("session-a"), "session-a");

    expect(state).toEqual(
      expect.objectContaining({
        sessionId: "session-a",
        status: "generating",
      }),
    );
  });

  it("rejects stale session ownership checks", () => {
    const currentState = createState("session-a");

    expect(isCurrentSession(currentState, "session-a")).toBe(true);
    expect(isCurrentSession(currentState, "session-b")).toBe(false);
    expect(isCurrentSession(null, "session-a")).toBe(false);
  });

  it("deletes only managed session audio paths", async () => {
    await removeAudioFile("/tmp/raycast-tts-audio-session-a.mp3");
    await removeAudioFile("/tmp/not-managed.mp3");

    expect(rmMock).toHaveBeenCalledTimes(1);
    expect(rmMock).toHaveBeenCalledWith("/tmp/raycast-tts-audio-session-a.mp3", { force: true });
  });
});
