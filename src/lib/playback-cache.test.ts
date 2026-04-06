import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  spawnMock,
  spawnSyncMock,
  existsSyncMock,
} = vi.hoisted(() => ({
  spawnMock: vi.fn(),
  spawnSyncMock: vi.fn(),
  existsSyncMock: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  spawn: spawnMock,
  spawnSync: spawnSyncMock,
}));

vi.mock("node:fs", () => ({
  existsSync: existsSyncMock,
}));

describe("binary lookup caching", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    existsSyncMock.mockReturnValue(false);
    spawnMock.mockReturnValue({
      pid: 4321,
      unref: vi.fn(),
    });
  });

  it("re-checks ffplay availability after an initial lookup miss", async () => {
    spawnSyncMock
      .mockReturnValueOnce({ status: 1 })
      .mockReturnValueOnce({ status: 0 });

    const { SeekPlayerNotFoundError, spawnPlayback } = await import("./playback");

    await expect(spawnPlayback("/tmp/audio.mp3", 2)).rejects.toBeInstanceOf(SeekPlayerNotFoundError);
    await expect(spawnPlayback("/tmp/audio.mp3", 2)).resolves.toBe(4321);
    expect(spawnSyncMock).toHaveBeenCalledTimes(2);
  });
});
