export const STATE_FILE_PATH = "/tmp/raycast-tts-state.json";
export const AUDIO_FILE_PREFIX = "/tmp/raycast-tts-audio";
export const AUDIO_FILE_EXTENSION = ".mp3";
export const MENU_BAR_REFRESH_MS = 5_000;

/**
 * Builds a session-scoped audio file path.
 *
 * @param {string} sessionId - Unique playback session identifier.
 * @returns {string} Absolute path for the session audio file.
 */
export function getAudioFilePath(sessionId: string): string {
  return `${AUDIO_FILE_PREFIX}-${sessionId}${AUDIO_FILE_EXTENSION}`;
}
