import { showHUD } from "@raycast/api";

import { STATE_FILE_PATH } from "./constants";
import {
  AfplayNotFoundError,
  clampOffset,
  getCurrentOffset,
  isProcessAlive,
  spawnPlayback,
  stopProcess,
} from "./playback";
import { getPreferences, parseSkipDuration } from "./preferences";
import { clearState, readActiveState, writeState } from "./state";

/**
 * Applies a relative skip offset and restarts playback from the new position.
 *
 * @param {number} direction - `-1` for back, `1` for forward.
 * @returns {Promise<void>} Nothing.
 */
export async function skipByDirection(direction: -1 | 1): Promise<void> {
  const state = await readActiveState(STATE_FILE_PATH);
  if (!state || (state.status !== "playing" && state.status !== "paused")) {
    return;
  }

  const preferences = getPreferences();
  const skipSeconds = parseSkipDuration(preferences.skipDuration);
  const currentOffset =
    state.status === "playing"
      ? getCurrentOffset({ startedAt: state.startedAt, offset: state.offset })
      : state.offset;
  const targetOffset = clampOffset(currentOffset + direction * skipSeconds, state.audioDuration);

  if (isProcessAlive(state.pid)) {
    stopProcess(state.pid);
  }

  if (targetOffset >= state.audioDuration) {
    await clearState(STATE_FILE_PATH);
    return;
  }

  try {
    const pid = await spawnPlayback(state.audioPath, targetOffset);
    await writeState(STATE_FILE_PATH, {
      ...state,
      status: "playing",
      startedAt: Date.now(),
      offset: targetOffset,
      pid,
    });
  } catch (error) {
    if (error instanceof AfplayNotFoundError) {
      await showHUD("afplay not found — macOS only");
    }
  }
}
