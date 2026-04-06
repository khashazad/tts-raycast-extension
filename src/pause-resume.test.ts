import { beforeEach, describe, expect, it, vi } from "vitest";

import command from "./pause-resume";
import { STATE_FILE_PATH } from "./lib/constants";
import type { TTSState } from "./lib/types";
import { SeekPlayerNotFoundError } from "./lib/playback";

const {
  showHUDMock,
  readActiveStateMock,
  writeStateMock,
  clampOffsetMock,
  getCurrentOffsetMock,
  isProcessAliveMock,
  pauseProcessMock,
  resumeProcessMock,
  spawnPlaybackMock,
} = vi.hoisted(() => ({
  showHUDMock: vi.fn(),
  readActiveStateMock: vi.fn(),
  writeStateMock: vi.fn(),
  clampOffsetMock: vi.fn(),
  getCurrentOffsetMock: vi.fn(),
  isProcessAliveMock: vi.fn(),
  pauseProcessMock: vi.fn(),
  resumeProcessMock: vi.fn(),
  spawnPlaybackMock: vi.fn(),
}));

vi.mock("@raycast/api", () => ({
  showHUD: showHUDMock,
}));

vi.mock("./lib/state", () => ({
  readActiveState: readActiveStateMock,
  writeState: writeStateMock,
}));

vi.mock("./lib/playback", async () => {
  const actual = await vi.importActual<typeof import("./lib/playback")>("./lib/playback");
  return {
    ...actual,
    clampOffset: clampOffsetMock,
    getCurrentOffset: getCurrentOffsetMock,
    isProcessAlive: isProcessAliveMock,
    pauseProcess: pauseProcessMock,
    resumeProcess: resumeProcessMock,
    spawnPlayback: spawnPlaybackMock,
  };
});

/**
 * Creates a paused-state fixture for resume command testing.
 *
 * @returns {TTSState} Paused state payload.
 */
function createPausedState(): TTSState {
  return {
    sessionId: "session-a",
    status: "paused",
    startedAt: 1_000,
    offset: 12,
    pid: 1234,
    audioPath: "/tmp/raycast-tts-audio-session-a.mp3",
    audioDuration: 120,
    words: [{ word: "hello", start: 0, end: 0.2 }],
  };
}

describe("pause-resume resume fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readActiveStateMock.mockResolvedValue(createPausedState());
    isProcessAliveMock.mockReturnValue(false);
  });

  it("keeps state paused when ffplay is unavailable for offset resume", async () => {
    spawnPlaybackMock.mockRejectedValue(new SeekPlayerNotFoundError());

    await command();

    expect(readActiveStateMock).toHaveBeenCalledWith(STATE_FILE_PATH);
    expect(writeStateMock).not.toHaveBeenCalled();
    expect(showHUDMock).toHaveBeenCalledWith("ffplay not found — cannot resume paused playback");
    expect(resumeProcessMock).not.toHaveBeenCalled();
  });
});
