import { getPreferenceValues } from "@raycast/api";

export interface Preferences {
  apiKey: string;
  voiceId: string;
  speed: string;
  skipDuration: string;
  modelId: string;
}

/**
 * Reads extension preferences from Raycast.
 *
 * @returns {Preferences} Strongly typed preference values.
 */
export function getPreferences(): Preferences {
  return getPreferenceValues<Preferences>();
}

/**
 * Parses a speed value and falls back to `1.0` when invalid.
 *
 * @param {string | undefined} rawSpeed - Raw speed preference string.
 * @returns {number} Sanitized speed value.
 */
export function parseSpeed(rawSpeed: string | undefined): number {
  const parsed = Number.parseFloat(rawSpeed ?? "");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1.0;
}

/**
 * Parses skip duration in seconds and falls back to `10`.
 *
 * @param {string | undefined} rawSkipDuration - Raw skip duration preference string.
 * @returns {number} Sanitized skip duration in seconds.
 */
export function parseSkipDuration(rawSkipDuration: string | undefined): number {
  const parsed = Number.parseFloat(rawSkipDuration ?? "");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
}
