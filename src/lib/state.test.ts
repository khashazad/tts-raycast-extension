import { mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { clearState, readState, writeState } from "./state";
import type { TTSState } from "./types";

const createdDirs: string[] = [];

/**
 * Creates an isolated temporary directory for state file tests.
 *
 * @returns {Promise<string>} Temporary directory path.
 */
async function createTempDir(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "tts-state-"));
  createdDirs.push(directory);
  return directory;
}

afterEach(async () => {
  const cleanupResults = await Promise.allSettled(
    createdDirs.splice(0).map(async (directory) => {
      await rm(directory, { force: true, recursive: true });
    }),
  );

  const failures = cleanupResults.filter((result): result is PromiseRejectedResult => result.status === "rejected");
  if (failures.length > 0) {
    throw new AggregateError(
      failures.map((failure) => failure.reason),
      "Failed to cleanup temporary test directory",
    );
  }
});

describe("state persistence", () => {
  it("writes then reads state from disk", async () => {
    const directory = await createTempDir();
    const statePath = path.join(directory, "state.json");
    const expected: TTSState = {
      sessionId: "session-1",
      status: "playing",
      startedAt: 1000,
      offset: 2,
      pid: 1234,
      audioPath: "/tmp/raycast-tts-audio.mp3",
      audioDuration: 5,
      words: [{ word: "Hello", start: 0, end: 1 }],
    };

    await writeState(statePath, expected);
    const actual = await readState(statePath);

    expect(actual).toEqual(expected);
  });

  it("clears the state file", async () => {
    const directory = await createTempDir();
    const statePath = path.join(directory, "state.json");
    const expected: TTSState = {
      sessionId: "session-2",
      status: "paused",
      startedAt: 1000,
      offset: 2,
      pid: 1234,
      audioPath: "/tmp/raycast-tts-audio.mp3",
      audioDuration: 5,
      words: [{ word: "Hello", start: 0, end: 1 }],
    };

    await writeState(statePath, expected);
    await clearState(statePath);

    expect(await readState(statePath)).toBeNull();
  });

  it("returns null when words contain invalid entries", async () => {
    const directory = await createTempDir();
    const statePath = path.join(directory, "state.json");
    await writeState(
      statePath,
      {
        status: "playing",
        sessionId: "session-3",
        startedAt: 1000,
        offset: 2,
        pid: 1234,
        audioPath: "/tmp/raycast-tts-audio.mp3",
        audioDuration: 5,
        words: [{ word: "Hello", start: 0, end: 1 }],
      } as TTSState,
    );

    const invalidRawState = JSON.stringify({
      status: "playing",
      sessionId: "session-3",
      startedAt: 1000,
      offset: 2,
      pid: 1234,
      audioPath: "/tmp/raycast-tts-audio.mp3",
      audioDuration: 5,
      words: [{ word: "Hello", start: 0, end: "bad-end" }],
    });
    await writeFile(statePath, invalidRawState, "utf8");

    expect(await readState(statePath)).toBeNull();
  });

  it("normalizes legacy state without sessionId", async () => {
    const directory = await createTempDir();
    const statePath = path.join(directory, "state.json");
    const legacyRawState = JSON.stringify({
      status: "playing",
      startedAt: 1000,
      offset: 2,
      pid: 1234,
      audioPath: "/tmp/raycast-tts-audio.mp3",
      audioDuration: 5,
      words: [{ word: "Hello", start: 0, end: 1 }],
    });
    await writeFile(statePath, legacyRawState, "utf8");

    const normalized = await readState(statePath);

    expect(normalized).toEqual(
      expect.objectContaining({
        sessionId: "legacy-1000-1234",
        status: "playing",
      }),
    );
  });

  it("recovers from stale lock files before writing state", async () => {
    const directory = await createTempDir();
    const statePath = path.join(directory, "state.json");
    const lockPath = `${statePath}.lock`;
    const expected: TTSState = {
      sessionId: "session-stale-lock",
      status: "playing",
      startedAt: 1000,
      offset: 2,
      pid: 1234,
      audioPath: "/tmp/raycast-tts-audio.mp3",
      audioDuration: 5,
      words: [{ word: "Hello", start: 0, end: 1 }],
    };

    await writeFile(lockPath, "", "utf8");
    const staleTimestamp = new Date(Date.now() - 10_000);
    await utimes(lockPath, staleTimestamp, staleTimestamp);

    await writeState(statePath, expected);

    expect(await readState(statePath)).toEqual(expected);
  });
});
