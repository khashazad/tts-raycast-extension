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
  writeStateIfSessionMatchesMock,
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
  writeStateIfSessionMatchesMock: vi.fn(),
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
  writeStateIfSessionMatches: writeStateIfSessionMatchesMock,
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
    writeStateIfSessionMatchesMock.mockResolvedValue(true);
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

  it("shows an error when persisting generating state fails before ownership is established", async () => {
    readStateMock.mockResolvedValueOnce(null);
    writeStateMock.mockRejectedValue(new Error("state write failed"));

    await command();

    expect(readStateMock).toHaveBeenCalledTimes(1);
    expect(spawnPlaybackMock).not.toHaveBeenCalled();
    expect(showHUDMock).toHaveBeenCalledWith("ElevenLabs: state write failed");
  });

  it("stops spawned playback when ownership changes before final state write", async () => {
    readStateMock.mockResolvedValueOnce(null).mockResolvedValueOnce(createState("session-new"));
    spawnPlaybackMock.mockResolvedValue(4321);
    writeStateIfSessionMatchesMock.mockResolvedValue(false);

    await command();

    expect(writeStateIfSessionMatchesMock).toHaveBeenCalledWith(
      STATE_FILE_PATH,
      "session-new",
      expect.objectContaining({
        sessionId: "session-new",
        status: "playing",
        pid: 4321,
      }),
    );
    expect(stopProcessWithEscalationMock).toHaveBeenCalledWith(4321);
    expect(removeAudioFileMock).toHaveBeenCalledWith(getAudioFilePath("session-new"));
  });

  it("stops spawned playback when final state write throws", async () => {
    readStateMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(createState("session-new"))
      .mockResolvedValueOnce(createState("session-new"));
    spawnPlaybackMock.mockResolvedValue(5678);
    writeStateIfSessionMatchesMock.mockRejectedValue(new Error("write failed"));

    await command();

    expect(stopProcessWithEscalationMock).toHaveBeenCalledWith(5678);
    expect(clearStateMock).toHaveBeenCalledWith(STATE_FILE_PATH);
    expect(removeAudioFileMock).toHaveBeenCalledWith(getAudioFilePath("session-new"));
    expect(showHUDMock).toHaveBeenCalledWith("ElevenLabs: write failed");
  });
});
