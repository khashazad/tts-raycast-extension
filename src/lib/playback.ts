import { spawn, spawnSync } from "node:child_process";

export interface OffsetInput {
  startedAt: number;
  offset: number;
  now?: number;
}

export class AfplayNotFoundError extends Error {
  constructor() {
    super("afplay not found");
    this.name = "AfplayNotFoundError";
  }
}

export class SeekPlayerNotFoundError extends Error {
  constructor() {
    super("ffplay not found");
    this.name = "SeekPlayerNotFoundError";
  }
}

interface PlaybackInvocation {
  command: "afplay" | "ffplay";
  args: string[];
}

let cachedAfplayAvailability: boolean | null = null;
let cachedFfplayAvailability: boolean | null = null;

/**
 * Computes current playback offset from base offset and wall-clock time.
 *
 * @param {OffsetInput} input - Offset and timing inputs.
 * @returns {number} Elapsed playback offset in seconds.
 */
export function getCurrentOffset(input: OffsetInput): number {
  const now = input.now ?? Date.now();
  const elapsedSeconds = Math.max(0, (now - input.startedAt) / 1000);
  return input.offset + elapsedSeconds;
}

/**
 * Clamps a playback offset into the `[0, duration]` range.
 *
 * @param {number} offset - Candidate offset in seconds.
 * @param {number} audioDuration - Audio duration in seconds.
 * @returns {number} Clamped offset.
 */
export function clampOffset(offset: number, audioDuration: number): number {
  return Math.min(Math.max(offset, 0), Math.max(audioDuration, 0));
}

/**
 * Checks whether an OS process is still alive.
 *
 * @param {number} pid - Process ID to probe.
 * @returns {boolean} `true` when process exists, otherwise `false`.
 */
export function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sends a termination signal to a process if the PID is valid.
 *
 * @param {number} pid - Process ID to terminate.
 * @returns {void} Nothing.
 */
export function stopProcess(pid: number): void {
  if (!isProcessAlive(pid)) {
    return;
  }

  try {
    process.kill(pid, "SIGTERM");
  } catch {
    // Ignore race conditions where the process exits after liveness check.
  }
}

/**
 * Starts detached `afplay` playback and returns the process ID.
 *
 * @param {string} audioPath - Absolute path to audio file.
 * @param {number} offset - Playback offset in seconds.
 * @returns {Promise<number>} Spawned process ID.
 * @throws {AfplayNotFoundError} When `afplay` is unavailable.
 * @throws {Error} When process spawning fails.
 */
export async function spawnPlayback(audioPath: string, offset: number): Promise<number> {
  const invocation = getPlaybackInvocation(audioPath, offset);
  if (invocation.command === "afplay" && !isAfplayAvailable()) {
    throw new AfplayNotFoundError();
  }
  if (invocation.command === "ffplay" && !isFfplayAvailable()) {
    throw new SeekPlayerNotFoundError();
  }

  const processHandle = spawn(invocation.command, invocation.args, { detached: true, stdio: "ignore" });
  processHandle.unref();

  if (!processHandle.pid) {
    throw new Error("Failed to spawn afplay process");
  }

  return processHandle.pid;
}

/**
 * Resolves the playback command and arguments for a given offset.
 *
 * @param {string} audioPath - Absolute path to audio file.
 * @param {number} offset - Playback offset in seconds.
 * @returns {PlaybackInvocation} Command and arguments to spawn.
 */
export function getPlaybackInvocation(audioPath: string, offset: number): PlaybackInvocation {
  const roundedOffset = Math.max(offset, 0);
  if (roundedOffset === 0) {
    return {
      command: "afplay",
      args: [audioPath],
    };
  }

  return {
    command: "ffplay",
    args: ["-nodisp", "-autoexit", "-loglevel", "quiet", "-ss", `${roundedOffset}`, "-i", audioPath],
  };
}

/**
 * Verifies that `afplay` is available on the current machine.
 *
 * @returns {boolean} `true` when `afplay` is installed.
 */
function isAfplayAvailable(): boolean {
  if (cachedAfplayAvailability !== null) {
    return cachedAfplayAvailability;
  }

  cachedAfplayAvailability = hasBinary("afplay");
  return cachedAfplayAvailability;
}

/**
 * Verifies that `ffplay` is available on the current machine.
 *
 * @returns {boolean} `true` when `ffplay` is installed.
 */
function isFfplayAvailable(): boolean {
  if (cachedFfplayAvailability !== null) {
    return cachedFfplayAvailability;
  }

  cachedFfplayAvailability = hasBinary("ffplay");
  return cachedFfplayAvailability;
}

/**
 * Checks whether a command exists in PATH.
 *
 * @param {"afplay" | "ffplay"} binary - Binary name to check.
 * @returns {boolean} `true` when command exists.
 */
function hasBinary(binary: "afplay" | "ffplay"): boolean {
  const result = spawnSync("which", [binary], { stdio: "ignore" });
  return result.status === 0;
}
