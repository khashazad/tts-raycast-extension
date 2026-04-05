import { skipByDirection } from "./lib/skip";

/**
 * Rewinds playback by configured skip duration.
 *
 * @returns {Promise<void>} Nothing.
 */
export default async function command(): Promise<void> {
  await skipByDirection(-1);
}
