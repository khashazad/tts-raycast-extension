import { STATE_FILE_PATH } from "./lib/constants";
import { isProcessAlive, stopProcess } from "./lib/playback";
import { clearState, readState } from "./lib/state";

/**
 * Stops active playback and clears persisted extension state.
 *
 * @returns {Promise<void>} Nothing.
 */
export default async function command(): Promise<void> {
  const state = await readState(STATE_FILE_PATH);
  if (state && isProcessAlive(state.pid)) {
    stopProcess(state.pid);
  }

  await clearState(STATE_FILE_PATH);
}
