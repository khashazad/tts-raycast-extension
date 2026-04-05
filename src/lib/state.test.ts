import { mkdtemp, rm, writeFile } from "node:fs/promises";
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

  cleanupResults.forEach((result) => {
    if (result.status === "rejected") {
      console.error("Failed to cleanup temporary test directory", result.reason);
    }
  });
});

describe("state persistence", () => {
  it("writes then reads state from disk", async () => {
    const directory = await createTempDir();
    const statePath = path.join(directory, "state.json");
    const expected: TTSState = {
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
});
