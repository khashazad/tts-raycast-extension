import { access, readFile, rename, rm, writeFile } from "node:fs/promises";
import { constants as fileConstants } from "node:fs";

import { STATE_FILE_PATH } from "./constants";
import { isProcessAlive } from "./playback";
import type { TTSState } from "./types";

/**
 * Reads persisted extension state from disk.
 *
 * @param {string} statePath - Path to the shared state file.
 * @returns {Promise<TTSState | null>} Parsed state, or `null` when missing/invalid.
 */
export async function readState(statePath: string = STATE_FILE_PATH): Promise<TTSState | null> {
  try {
    await access(statePath, fileConstants.F_OK);
  } catch {
    return null;
  }

  try {
    const raw = await readFile(statePath, "utf8");
    const parsed = JSON.parse(raw) as TTSState;
    if (!isStateShapeValid(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Writes extension state atomically to disk using temp-file rename.
 *
 * @param {string} statePath - Path to the shared state file.
 * @param {TTSState} state - State payload to persist.
 * @returns {Promise<void>} Nothing.
 */
export async function writeState(statePath: string, state: TTSState): Promise<void> {
  const temporaryStatePath = `${statePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryStatePath, JSON.stringify(state), "utf8");
  await rename(temporaryStatePath, statePath);
}

/**
 * Deletes the shared state file if it exists.
 *
 * @param {string} statePath - Path to the shared state file.
 * @returns {Promise<void>} Nothing.
 */
export async function clearState(statePath: string = STATE_FILE_PATH): Promise<void> {
  await rm(statePath, { force: true });
}

/**
 * Reads state and clears it when playback PID has already exited.
 *
 * @param {string} statePath - Path to the shared state file.
 * @returns {Promise<TTSState | null>} Active state or `null`.
 */
export async function readActiveState(statePath: string = STATE_FILE_PATH): Promise<TTSState | null> {
  const state = await readState(statePath);
  if (!state) {
    return null;
  }

  if (state.status === "playing" && !isProcessAlive(state.pid)) {
    await clearState(statePath);
    return null;
  }

  return state;
}

/**
 * Performs minimal runtime validation for deserialized state payloads.
 *
 * @param {value} value - Untrusted value parsed from JSON.
 * @returns {boolean} `true` when value matches the expected state shape.
 */
function isStateShapeValid(value: unknown): value is TTSState {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<TTSState>;
  return (
    typeof candidate.status === "string" &&
    typeof candidate.startedAt === "number" &&
    typeof candidate.offset === "number" &&
    typeof candidate.pid === "number" &&
    typeof candidate.audioPath === "string" &&
    typeof candidate.audioDuration === "number" &&
    Array.isArray(candidate.words)
  );
}
