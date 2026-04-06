export const STATE_FILE_PATH = "/tmp/raycast-tts-state.json";
export const AUDIO_FILE_PREFIX = "/tmp/raycast-tts-audio";
export const AUDIO_FILE_EXTENSION = ".mp3";
export const MENU_BAR_REFRESH_MS = 5_000;
const SESSION_ID_PATTERN = /^[A-Za-z0-9-]+$/;

/**
 * Checks whether a session identifier is valid for managed audio paths.
 *
 * @param {string} sessionId - Session identifier to validate.
 * @returns {boolean} `true` when identifier matches managed-path constraints.
 */
export function isValidSessionId(sessionId: string): boolean {
  return SESSION_ID_PATTERN.test(sessionId);
}

/**
 * Builds a session-scoped audio file path.
 *
 * @param {string} sessionId - Unique playback session identifier.
 * @returns {string} Absolute path for the session audio file.
 * @throws {Error} When session identifier contains unsupported characters.
 */
export function getAudioFilePath(sessionId: string): string {
  if (!isValidSessionId(sessionId)) {
    throw new Error("Invalid session id");
  }

  return `${AUDIO_FILE_PREFIX}-${sessionId}${AUDIO_FILE_EXTENSION}`;
}

/**
 * Checks whether an audio path belongs to extension-managed session files.
 *
 * @param {string} audioPath - Candidate audio file path.
 * @returns {boolean} `true` when path maps to a valid managed session file.
 */
export function isManagedAudioPath(audioPath: string): boolean {
  const requiredPrefix = `${AUDIO_FILE_PREFIX}-`;
  if (!audioPath.startsWith(requiredPrefix) || !audioPath.endsWith(AUDIO_FILE_EXTENSION)) {
    return false;
  }

  const sessionId = audioPath.slice(requiredPrefix.length, -AUDIO_FILE_EXTENSION.length);
  return isValidSessionId(sessionId);
}
