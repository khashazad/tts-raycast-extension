import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

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

let cachedAfplayBinary: string | null | undefined;
let cachedFfplayBinary: string | null | undefined;

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
  signalProcess(pid, "SIGTERM");
}

/**
 * Stops a process with TERM first, then escalates to KILL if needed.
 *
 * @param {number} pid - Process ID to terminate.
 * @param {number} gracePeriodMs - Milliseconds to wait before escalation.
 * @returns {Promise<void>} Nothing.
 */
export async function stopProcessWithEscalation(pid: number, gracePeriodMs: number = 250): Promise<void> {
  if (!isProcessAlive(pid)) {
    return;
  }

  stopProcess(pid);
  await sleep(Math.max(0, gracePeriodMs));

  if (isProcessAlive(pid)) {
    signalProcess(pid, "SIGKILL");
  }
}

/**
 * Sends a suspend signal to an active playback process.
 *
 * @param {number} pid - Process ID to suspend.
 * @returns {void} Nothing.
 */
export function pauseProcess(pid: number): void {
  signalProcess(pid, "SIGSTOP");
}

/**
 * Sends a continue signal to a suspended playback process.
 *
 * @param {number} pid - Process ID to resume.
 * @returns {void} Nothing.
 */
export function resumeProcess(pid: number): void {
  signalProcess(pid, "SIGCONT");
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
  const binaryPath = getBinaryPath(invocation.command);
  if (!binaryPath) {
    if (invocation.command === "afplay") {
      throw new AfplayNotFoundError();
    }

    throw new SeekPlayerNotFoundError();
  }

  const processHandle = spawn(binaryPath, invocation.args, { detached: true, stdio: "ignore" });
  processHandle.unref();

  if (!processHandle.pid) {
    throw new Error(`Failed to spawn ${invocation.command} process`);
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
 * Returns lookup candidates for a binary in priority order.
 *
 * @param {"afplay" | "ffplay"} binary - Binary to resolve.
 * @param {NodeJS.Platform} platform - Runtime platform.
 * @returns {string[]} Candidate executable names or absolute paths.
 */
export function getBinaryLookupCandidates(binary: "afplay" | "ffplay", platform: NodeJS.Platform): string[] {
  if (binary === "afplay" && platform === "darwin") {
    return ["/usr/bin/afplay", "afplay"];
  }

  if (binary === "ffplay" && platform === "darwin") {
    return ["/opt/homebrew/bin/ffplay", "/usr/local/bin/ffplay", "ffplay"];
  }

  return [binary];
}

/**
 * Resolves a runnable binary path for playback commands.
 *
 * @param {"afplay" | "ffplay"} binary - Binary to resolve.
 * @returns {string | null} Absolute or PATH-based executable string when found.
 */
function getBinaryPath(binary: "afplay" | "ffplay"): string | null {
  if (binary === "afplay" && cachedAfplayBinary !== undefined) {
    return cachedAfplayBinary;
  }
  if (binary === "ffplay" && cachedFfplayBinary !== undefined) {
    return cachedFfplayBinary;
  }

  const candidate = getBinaryLookupCandidates(binary, process.platform).find((item) => hasBinaryCandidate(item)) ?? null;

  if (candidate !== null) {
    if (binary === "afplay") {
      cachedAfplayBinary = candidate;
    } else {
      cachedFfplayBinary = candidate;
    }
  }

  return candidate;
}

/**
 * Checks whether an executable can be launched.
 *
 * @param {string} candidate - Executable candidate path or command name.
 * @returns {boolean} `true` when executable can be resolved.
 */
function hasBinaryCandidate(candidate: string): boolean {
  if (candidate.startsWith("/")) {
    return existsSync(candidate);
  }

  const result = spawnSync("command -v " + candidate, { shell: true, stdio: "ignore" });
  return result.status === 0;
}

/**
 * Sends a process signal when the process is still alive.
 *
 * @param {number} pid - Process ID to signal.
 * @param {NodeJS.Signals} signal - Signal to dispatch.
 * @returns {void} Nothing.
 */
function signalProcess(pid: number, signal: NodeJS.Signals): void {
  if (!isProcessAlive(pid)) {
    return;
  }

  try {
    process.kill(pid, signal);
  } catch {
    // Ignore race conditions where the process exits after liveness check.
  }
}

/**
 * Waits for a bounded delay between process-control steps.
 *
 * @param {number} milliseconds - Delay duration in milliseconds.
 * @returns {Promise<void>} Nothing.
 */
function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
