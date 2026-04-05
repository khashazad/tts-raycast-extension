import { mkdtemp, rm } from "node:fs/promises";
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
  await Promise.all(
    createdDirs.splice(0).map(async (directory) => {
      await rm(directory, { force: true, recursive: true });
    }),
  );
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
});
