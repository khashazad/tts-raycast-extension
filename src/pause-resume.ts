import { showHUD } from "@raycast/api";

import { STATE_FILE_PATH } from "./lib/constants";
import {
  AfplayNotFoundError,
  clampOffset,
  getCurrentOffset,
  isProcessAlive,
  spawnPlayback,
  stopProcess,
} from "./lib/playback";
import { readActiveState, writeState } from "./lib/state";

/**
 * Toggles active playback between paused and playing states.
 *
 * @returns {Promise<void>} Nothing.
 */
export default async function command(): Promise<void> {
  const state = await readActiveState(STATE_FILE_PATH);
  if (!state || (state.status !== "playing" && state.status !== "paused")) {
    return;
  }

  if (state.status === "playing") {
    const currentOffset = clampOffset(
      getCurrentOffset({ startedAt: state.startedAt, offset: state.offset }),
      state.audioDuration,
    );

    if (isProcessAlive(state.pid)) {
      stopProcess(state.pid);
    }

    await writeState(STATE_FILE_PATH, {
      ...state,
      status: "paused",
      offset: currentOffset,
      startedAt: Date.now(),
      pid: 0,
    });
    return;
  }

  try {
    const pid = await spawnPlayback(state.audioPath, state.offset);
    await writeState(STATE_FILE_PATH, {
      ...state,
      status: "playing",
      startedAt: Date.now(),
      pid,
    });
  } catch (error) {
    if (error instanceof AfplayNotFoundError) {
      await showHUD("afplay not found — macOS only");
    }
  }
}
