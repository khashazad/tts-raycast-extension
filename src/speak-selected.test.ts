import { beforeEach, describe, expect, it, vi } from "vitest";

import command from "./speak-selected";
import { getAudioFilePath, STATE_FILE_PATH } from "./lib/constants";
import type { TTSState } from "./lib/types";

const {
  getSelectedTextMock,
  showHUDMock,
  writeFileMock,
  synthesizeWithTimestampsMock,
  spawnPlaybackMock,
  stopProcessWithEscalationMock,
  clearStateMock,
  readStateMock,
  writeStateMock,
  getPreferencesMock,
  parseSpeedMock,
  createSessionIdMock,
  removeAudioFileMock,
} = vi.hoisted(() => ({
  getSelectedTextMock: vi.fn(),
  showHUDMock: vi.fn(),
  writeFileMock: vi.fn(),
  synthesizeWithTimestampsMock: vi.fn(),
  spawnPlaybackMock: vi.fn(),
  stopProcessWithEscalationMock: vi.fn(),
  clearStateMock: vi.fn(),
  readStateMock: vi.fn(),
  writeStateMock: vi.fn(),
  getPreferencesMock: vi.fn(),
  parseSpeedMock: vi.fn(),
  createSessionIdMock: vi.fn(),
  removeAudioFileMock: vi.fn(),
}));

vi.mock("@raycast/api", () => ({
  getSelectedText: getSelectedTextMock,
  showHUD: showHUDMock,
}));

vi.mock("node:fs/promises", () => ({
  writeFile: writeFileMock,
}));

vi.mock("./lib/elevenlabs", () => ({
  synthesizeWithTimestamps: synthesizeWithTimestampsMock,
}));

vi.mock("./lib/playback", async () => {
  const actual = await vi.importActual<typeof import("./lib/playback")>("./lib/playback");
  return {
    ...actual,
    spawnPlayback: spawnPlaybackMock,
    stopProcessWithEscalation: stopProcessWithEscalationMock,
  };
});

vi.mock("./lib/state", () => ({
  clearState: clearStateMock,
  readState: readStateMock,
  writeState: writeStateMock,
}));

vi.mock("./lib/preferences", () => ({
  getPreferences: getPreferencesMock,
  parseSpeed: parseSpeedMock,
}));

vi.mock("./lib/command-utils", async () => {
  const actual = await vi.importActual<typeof import("./lib/command-utils")>("./lib/command-utils");
  return {
    ...actual,
    createSessionId: createSessionIdMock,
    removeAudioFile: removeAudioFileMock,
  };
});

/**
 * Creates a state fixture for stale-session guard tests.
 *
 * @param {string} sessionId - Session identifier for the fixture.
 * @returns {TTSState} Minimal valid state.
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

describe("speak-selected stale session guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createSessionIdMock.mockReturnValue("session-new");
    getSelectedTextMock.mockResolvedValue("Hello world");
    getPreferencesMock.mockReturnValue({
      apiKey: "key",
      voiceId: "",
      speed: "1.0",
      skipDuration: "10",
      modelId: "eleven_turbo_v2_5",
    });
    parseSpeedMock.mockReturnValue(1);
    synthesizeWithTimestampsMock.mockResolvedValue({
      audioBuffer: Buffer.from("audio"),
      words: [],
      audioDuration: 1.5,
    });
    writeFileMock.mockResolvedValue(undefined);
    writeStateMock.mockResolvedValue(undefined);
    clearStateMock.mockResolvedValue(undefined);
    removeAudioFileMock.mockResolvedValue(undefined);
  });

  it("does not spawn playback when session ownership is stale after synthesis", async () => {
    readStateMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(createState("session-other"));

    await command();

    expect(readStateMock).toHaveBeenNthCalledWith(1, STATE_FILE_PATH);
    expect(readStateMock).toHaveBeenNthCalledWith(2, STATE_FILE_PATH);
    expect(spawnPlaybackMock).not.toHaveBeenCalled();
    expect(removeAudioFileMock).toHaveBeenCalledWith(getAudioFilePath("session-new"));
    expect(showHUDMock).not.toHaveBeenCalled();
  });
});
