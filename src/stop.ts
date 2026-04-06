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
  const originalState = await readState(STATE_FILE_PATH);
  if (!originalState) {
    return;
  }

  await stopProcessWithEscalation(originalState.pid);

  const currentState = await readState(STATE_FILE_PATH);
  if (!currentState || currentState.sessionId !== originalState.sessionId) {
    return;
  }

  await removeAudioFile(originalState.audioPath);
  await clearState(STATE_FILE_PATH);
}
