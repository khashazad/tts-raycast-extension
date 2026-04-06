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
  stopProcessWithEscalationMock,
  spawnPlaybackMock,
} = vi.hoisted(() => ({
  showHUDMock: vi.fn(),
  readActiveStateMock: vi.fn(),
  writeStateMock: vi.fn(),
  clampOffsetMock: vi.fn(),
  getCurrentOffsetMock: vi.fn(),
  stopProcessWithEscalationMock: vi.fn(),
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
    stopProcessWithEscalation: stopProcessWithEscalationMock,
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
    pid: 0,
    audioPath: "/tmp/raycast-tts-audio-session-a.mp3",
    audioDuration: 120,
    words: [{ word: "hello", start: 0, end: 0.2 }],
  };
}

/**
 * Creates a paused-state fixture that preserves a legacy non-zero PID.
 *
 * @returns {TTSState} Legacy paused state payload.
 */
function createLegacyPausedState(): TTSState {
  return {
    ...createPausedState(),
    pid: 4321,
  };
}

/**
 * Creates a playing-state fixture for pause command testing.
 *
 * @returns {TTSState} Playing state payload.
 */
function createPlayingState(): TTSState {
  return {
    sessionId: "session-a",
    status: "playing",
    startedAt: 1_000,
    offset: 5,
    pid: 1234,
    audioPath: "/tmp/raycast-tts-audio-session-a.mp3",
    audioDuration: 120,
    words: [{ word: "hello", start: 0, end: 0.2 }],
  };
}

describe("pause-resume", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stopProcessWithEscalationMock.mockResolvedValue(undefined);
  });

  it("pauses by stopping active playback and persisting a fixed offset", async () => {
    readActiveStateMock.mockResolvedValue(createPlayingState());
    getCurrentOffsetMock.mockReturnValue(16.2);
    clampOffsetMock.mockReturnValue(16.2);

    await command();

    expect(stopProcessWithEscalationMock).toHaveBeenCalledWith(1234);
    expect(writeStateMock).toHaveBeenCalledWith(STATE_FILE_PATH, {
      ...createPlayingState(),
      status: "paused",
      offset: 16.2,
      startedAt: expect.any(Number),
      pid: 0,
    });
    expect(spawnPlaybackMock).not.toHaveBeenCalled();
  });

  it("resumes by spawning playback from stored paused offset", async () => {
    readActiveStateMock.mockResolvedValue(createPausedState());
    spawnPlaybackMock.mockResolvedValue(7890);

    await command();

    expect(stopProcessWithEscalationMock).not.toHaveBeenCalled();
    expect(spawnPlaybackMock).toHaveBeenCalledWith("/tmp/raycast-tts-audio-session-a.mp3", 12);
    expect(writeStateMock).toHaveBeenCalledWith(STATE_FILE_PATH, {
      ...createPausedState(),
      status: "playing",
      startedAt: expect.any(Number),
      pid: 7890,
    });
  });

  it("stops legacy paused playback pid before respawning", async () => {
    readActiveStateMock.mockResolvedValue(createLegacyPausedState());
    spawnPlaybackMock.mockResolvedValue(7890);

    await command();

    expect(stopProcessWithEscalationMock).toHaveBeenCalledWith(4321);
    expect(spawnPlaybackMock).toHaveBeenCalledWith("/tmp/raycast-tts-audio-session-a.mp3", 12);
    expect(writeStateMock).toHaveBeenCalledWith(STATE_FILE_PATH, {
      ...createLegacyPausedState(),
      status: "playing",
      startedAt: expect.any(Number),
      pid: 7890,
    });
  });

  it("keeps state paused when ffplay is unavailable for offset resume", async () => {
    readActiveStateMock.mockResolvedValue(createPausedState());
    spawnPlaybackMock.mockRejectedValue(new SeekPlayerNotFoundError());

    await command();

    expect(readActiveStateMock).toHaveBeenCalledWith(STATE_FILE_PATH);
    expect(writeStateMock).not.toHaveBeenCalled();
    expect(showHUDMock).toHaveBeenCalledWith("ffplay not found — cannot resume paused playback");
    expect(stopProcessWithEscalationMock).not.toHaveBeenCalled();
  });
});
