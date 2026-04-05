import type { TTSState } from "./types";

/**
 * Builds a minimal state payload representing active synthesis.
 *
 * @param {string} audioPath - Destination audio file path.
 * @returns {TTSState} Generating state object.
 */
export function createGeneratingState(audioPath: string): TTSState {
  return {
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
