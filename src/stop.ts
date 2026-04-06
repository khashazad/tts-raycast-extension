import { STATE_FILE_PATH } from "./lib/constants";
import { stopProcessWithEscalation } from "./lib/playback";
import { removeAudioFile } from "./lib/command-utils";
import { clearState, readState } from "./lib/state";

/**
 * Stops active playback and clears persisted extension state.
 *
 * @returns {Promise<void>} Nothing.
 */
export default async function command(): Promise<void> {
  const state = await readState(STATE_FILE_PATH);

  try {
    if (state) {
      await stopProcessWithEscalation(state.pid);
    }
  } finally {
    if (state) {
      await removeAudioFile(state.audioPath);
    }

    await clearState(STATE_FILE_PATH);
  }
}
