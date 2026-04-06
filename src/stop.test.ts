import { beforeEach, describe, expect, it, vi } from "vitest";

import command from "./stop";
import { STATE_FILE_PATH, getAudioFilePath } from "./lib/constants";
import type { TTSState } from "./lib/types";

const {
  stopProcessWithEscalationMock,
  removeAudioFileMock,
  clearStateMock,
  readStateMock,
} = vi.hoisted(() => ({
  stopProcessWithEscalationMock: vi.fn(),
  removeAudioFileMock: vi.fn(),
  clearStateMock: vi.fn(),
  readStateMock: vi.fn(),
}));

vi.mock("./lib/playback", async () => {
  const actual = await vi.importActual<typeof import("./lib/playback")>("./lib/playback");
  return {
    ...actual,
    stopProcessWithEscalation: stopProcessWithEscalationMock,
  };
});

vi.mock("./lib/command-utils", async () => {
  const actual = await vi.importActual<typeof import("./lib/command-utils")>("./lib/command-utils");
  return {
    ...actual,
    removeAudioFile: removeAudioFileMock,
  };
});

vi.mock("./lib/state", () => ({
  clearState: clearStateMock,
  readState: readStateMock,
}));

/**
 * Creates a minimal valid state fixture for stop command tests.
 *
 * @param {string} sessionId - Session identifier for state ownership checks.
 * @returns {TTSState} Valid playback state.
 */
function createState(sessionId: string): TTSState {
  return {
    sessionId,
    status: "playing",
    startedAt: 1_000,
    offset: 2,
    pid: 1234,
    audioPath: getAudioFilePath(sessionId),
    audioDuration: 5,
    words: [{ word: "Hello", start: 0, end: 1 }],
  };
}

describe("stop command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stopProcessWithEscalationMock.mockResolvedValue(undefined);
    removeAudioFileMock.mockResolvedValue(undefined);
    clearStateMock.mockResolvedValue(undefined);
  });

  it("returns early when there is no persisted state", async () => {
    readStateMock.mockResolvedValueOnce(null);

    await command();

    expect(readStateMock).toHaveBeenCalledTimes(1);
    expect(readStateMock).toHaveBeenCalledWith(STATE_FILE_PATH);
    expect(stopProcessWithEscalationMock).not.toHaveBeenCalled();
    expect(removeAudioFileMock).not.toHaveBeenCalled();
    expect(clearStateMock).not.toHaveBeenCalled();
  });

  it("avoids clearing state when session ownership changed", async () => {
    const originalState = createState("session-a");
    readStateMock.mockResolvedValueOnce(originalState).mockResolvedValueOnce(createState("session-b"));

    await command();

    expect(stopProcessWithEscalationMock).toHaveBeenCalledWith(1234);
    expect(removeAudioFileMock).not.toHaveBeenCalled();
    expect(clearStateMock).not.toHaveBeenCalled();
  });

  it("cleans up when session ownership still matches", async () => {
    const originalState = createState("session-a");
    readStateMock.mockResolvedValueOnce(originalState).mockResolvedValueOnce(createState("session-a"));

    await command();

    expect(stopProcessWithEscalationMock).toHaveBeenCalledWith(1234);
    expect(removeAudioFileMock).toHaveBeenCalledWith(originalState.audioPath);
    expect(clearStateMock).toHaveBeenCalledWith(STATE_FILE_PATH);
  });
});
