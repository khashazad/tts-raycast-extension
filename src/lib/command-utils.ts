import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";

import { AUDIO_FILE_EXTENSION, AUDIO_FILE_PREFIX } from "./constants";
import type { TTSState } from "./types";

/**
 * Generates a unique identifier for one speak/playback session.
 *
 * @returns {string} Session identifier.
 */
export function createSessionId(): string {
  return randomUUID();
}

/**
 * Builds a minimal state payload representing active synthesis.
 *
 * @param {string} audioPath - Destination audio file path.
 * @param {string} sessionId - Unique session identifier.
 * @returns {TTSState} Generating state object.
 */
export function createGeneratingState(audioPath: string, sessionId: string): TTSState {
  return {
    sessionId,
    status: "generating",
    startedAt: Date.now(),
    offset: 0,
    pid: 0,
    audioPath,
    audioDuration: 0,
    words: [],
  };
}

/**
 * Verifies that state ownership still belongs to a specific session.
 *
 * @param {TTSState | null} state - Current persisted state snapshot.
 * @param {string} sessionId - Session identifier to verify.
 * @returns {boolean} `true` when state belongs to that session.
 */
export function isCurrentSession(state: TTSState | null, sessionId: string): boolean {
  return state !== null && state.sessionId === sessionId;
}

/**
 * Deletes a session audio file if it exists.
 *
 * @param {string} audioPath - Absolute audio file path.
 * @returns {Promise<void>} Nothing.
 */
export async function removeAudioFile(audioPath: string): Promise<void> {
  if (!isManagedAudioPath(audioPath)) {
    return;
  }

  await rm(audioPath, { force: true });
}

/**
 * Checks whether a path matches extension-managed session audio files.
 *
 * @param {string} audioPath - Candidate audio file path.
 * @returns {boolean} `true` when path is safe for managed deletion.
 */
function isManagedAudioPath(audioPath: string): boolean {
  const pattern = new RegExp(`^${AUDIO_FILE_PREFIX}-[A-Za-z0-9-]+\\${AUDIO_FILE_EXTENSION}$`);
  return pattern.test(audioPath);
}

/**
 * Converts unknown error values into user-friendly HUD messages.
 *
 * @param {unknown} error - Error value from failed operation.
 * @returns {string} Sanitized error message.
 */
export function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }

  return "Unknown error";
}
