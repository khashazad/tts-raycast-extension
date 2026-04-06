import { open, readFile, rename, rm, writeFile } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";

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

const STATE_LOCK_TIMEOUT_MS = 1_000;
const STATE_LOCK_RETRY_MS = 25;

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
  await withStateLock(statePath, async () => {
    await writeStateUnlocked(statePath, state);
  });
}

/**
 * Writes state only when the persisted state still belongs to an expected session.
 *
 * @param {string} statePath - Path to the shared state file.
 * @param {string} expectedSessionId - Session identifier required for ownership.
 * @param {TTSState} state - State payload to persist when ownership matches.
 * @returns {Promise<boolean>} `true` when write succeeded, otherwise `false`.
 * @throws {Error} When state lock cannot be acquired before timeout.
 */
export async function writeStateIfSessionMatches(
  statePath: string,
  expectedSessionId: string,
  state: TTSState,
): Promise<boolean> {
  return withStateLock(statePath, async () => {
    const currentState = await readState(statePath);
    if (!currentState || currentState.sessionId !== expectedSessionId) {
      return false;
    }

    await writeStateUnlocked(statePath, state);
    return true;
  });
}

/**
 * Deletes the shared state file if it exists.
 *
 * @param {string} statePath - Path to the shared state file.
 * @returns {Promise<void>} Nothing.
 */
export async function clearState(statePath: string = STATE_FILE_PATH): Promise<void> {
  await withStateLock(statePath, async () => {
    await clearStateUnlocked(statePath);
  });
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

/**
 * Writes state atomically without acquiring the shared state lock.
 *
 * @param {string} statePath - Path to the shared state file.
 * @param {TTSState} state - State payload to persist.
 * @returns {Promise<void>} Nothing.
 */
async function writeStateUnlocked(statePath: string, state: TTSState): Promise<void> {
  const temporaryStatePath = `${statePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryStatePath, JSON.stringify(state), "utf8");
  await rename(temporaryStatePath, statePath);
}

/**
 * Deletes the shared state file without acquiring the shared state lock.
 *
 * @param {string} statePath - Path to the shared state file.
 * @returns {Promise<void>} Nothing.
 */
async function clearStateUnlocked(statePath: string): Promise<void> {
  await rm(statePath, { force: true });
}

/**
 * Executes a state operation while holding the shared lock file.
 *
 * @param {string} statePath - Shared state path used to derive lock file path.
 * @param {() => Promise<T>} operation - Operation to run while lock is held.
 * @returns {Promise<T>} Operation result.
 * @throws {Error} When the lock cannot be acquired within timeout.
 */
async function withStateLock<T>(statePath: string, operation: () => Promise<T>): Promise<T> {
  const lockPath = `${statePath}.lock`;
  const lockHandle = await acquireStateLock(lockPath, STATE_LOCK_TIMEOUT_MS, STATE_LOCK_RETRY_MS);
  try {
    return await operation();
  } finally {
    await releaseStateLock(lockHandle, lockPath);
  }
}

/**
 * Acquires an exclusive lock file with retry and timeout.
 *
 * @param {string} lockPath - Lock file path.
 * @param {number} timeoutMs - Maximum wait duration in milliseconds.
 * @param {number} retryDelayMs - Delay between lock attempts in milliseconds.
 * @returns {Promise<FileHandle>} Open lock-file handle.
 * @throws {Error} When lock cannot be acquired within timeout.
 */
async function acquireStateLock(lockPath: string, timeoutMs: number, retryDelayMs: number): Promise<FileHandle> {
  const deadline = Date.now() + timeoutMs;

  while (true) {
    try {
      return await open(lockPath, "wx");
    } catch (error) {
      if (!isLockAlreadyHeldError(error)) {
        throw error;
      }

      if (Date.now() >= deadline) {
        throw new Error("Failed to acquire shared state lock");
      }

      await sleep(retryDelayMs);
    }
  }
}

/**
 * Releases a previously acquired lock file.
 *
 * @param {FileHandle} lockHandle - Open lock-file handle.
 * @param {string} lockPath - Lock file path to remove.
 * @returns {Promise<void>} Nothing.
 */
async function releaseStateLock(lockHandle: FileHandle, lockPath: string): Promise<void> {
  await lockHandle.close();
  await rm(lockPath, { force: true });
}

/**
 * Checks whether an error indicates an already-held exclusive lock.
 *
 * @param {unknown} error - Unknown error value from lock creation.
 * @returns {boolean} `true` when error code indicates EEXIST.
 */
function isLockAlreadyHeldError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "EEXIST";
}

/**
 * Waits for a bounded delay before retrying lock acquisition.
 *
 * @param {number} milliseconds - Delay duration in milliseconds.
 * @returns {Promise<void>} Nothing.
 */
function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
