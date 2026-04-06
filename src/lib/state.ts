import { readFile, rename, rm, writeFile } from "node:fs/promises";

import { STATE_FILE_PATH } from "./constants";
import { isProcessAlive } from "./playback";
import type { TTSState } from "./types";

interface LegacyTTSState {
  sessionId?: string;
  status: TTSState["status"];
  startedAt: number;
  offset: number;
  pid: number;
  audioPath: string;
  audioDuration: number;
  words: TTSState["words"];
}

/**
 * Reads persisted extension state from disk.
 *
 * @param {string} statePath - Path to the shared state file.
 * @returns {Promise<TTSState | null>} Parsed state, or `null` when missing/invalid.
 */
export async function readState(statePath: string = STATE_FILE_PATH): Promise<TTSState | null> {
  try {
    const raw = await readFile(statePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!isStateShapeValid(parsed)) {
      return null;
    }
    return normalizeState(parsed);
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
function isStateShapeValid(value: unknown): value is LegacyTTSState {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<LegacyTTSState>;
  return (
    (typeof candidate.sessionId === "string" || candidate.sessionId === undefined) &&
    typeof candidate.status === "string" &&
    typeof candidate.startedAt === "number" &&
    typeof candidate.offset === "number" &&
    typeof candidate.pid === "number" &&
    typeof candidate.audioPath === "string" &&
    typeof candidate.audioDuration === "number" &&
    Array.isArray(candidate.words) &&
    candidate.words.every((wordEntry) => isWordEntryShapeValid(wordEntry))
  );
}

/**
 * Validates runtime shape of a single timestamped word entry.
 *
 * @param {unknown} value - Candidate word entry.
 * @returns {boolean} `true` when value is a valid timestamped word.
 */
function isWordEntryShapeValid(value: unknown): boolean {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as { word?: unknown; start?: unknown; end?: unknown };
  if (
    typeof candidate.word !== "string" ||
    typeof candidate.start !== "number" ||
    typeof candidate.end !== "number"
  ) {
    return false;
  }

  return Number.isFinite(candidate.start) && Number.isFinite(candidate.end) && candidate.start <= candidate.end;
}

/**
 * Normalizes parsed state into the current runtime shape.
 *
 * @param {LegacyTTSState} state - Valid parsed state payload.
 * @returns {TTSState} Normalized state with a stable session identifier.
 */
function normalizeState(state: LegacyTTSState): TTSState {
  return {
    ...state,
    sessionId: getSessionId(state),
  };
}

/**
 * Selects a persisted or derived session identifier for state.
 *
 * @param {LegacyTTSState} state - Parsed state payload.
 * @returns {string} Session identifier for state ownership checks.
 */
function getSessionId(state: LegacyTTSState): string {
  const rawSessionId = state.sessionId?.trim();
  if (rawSessionId) {
    return rawSessionId;
  }

  return `legacy-${state.startedAt}-${state.pid}`;
}
