import { getSelectedText, showHUD } from "@raycast/api";
import { writeFile } from "node:fs/promises";

import { synthesizeWithTimestamps } from "./lib/elevenlabs";
import { AfplayNotFoundError, isProcessAlive, spawnPlayback, stopProcess } from "./lib/playback";
import { getPreferences, parseSpeed } from "./lib/preferences";
import { clearState, readState, writeState } from "./lib/state";
import { AUDIO_FILE_PATH, STATE_FILE_PATH } from "./lib/constants";
import { createGeneratingState, toErrorMessage } from "./lib/command-utils";

/**
 * Reads currently selected text, synthesizes speech, and starts detached playback.
 *
 * @returns {Promise<void>} Nothing.
 */
export default async function command(): Promise<void> {
  let selectedText: string;

  try {
    selectedText = await getSelectedText();
  } catch {
    await showHUD("No text selected");
    return;
  }

  try {
    await stopExistingPlayback();
    await writeState(STATE_FILE_PATH, createGeneratingState(AUDIO_FILE_PATH));

    const preferences = getPreferences();
    const synthesis = await synthesizeWithTimestamps({
      apiKey: preferences.apiKey,
      voiceId: preferences.voiceId,
      text: selectedText,
      modelId: preferences.modelId,
      speed: parseSpeed(preferences.speed),
    });

    await writeFile(AUDIO_FILE_PATH, synthesis.audioBuffer);
    const pid = await spawnPlayback(AUDIO_FILE_PATH, 0);
    await writeState(STATE_FILE_PATH, {
      status: "playing",
      startedAt: Date.now(),
      offset: 0,
      pid,
      audioPath: AUDIO_FILE_PATH,
      audioDuration: synthesis.audioDuration,
      words: synthesis.words,
    });
  } catch (error) {
    await clearState(STATE_FILE_PATH);

    if (error instanceof AfplayNotFoundError) {
      await showHUD("afplay not found — macOS only");
      return;
    }

    await showHUD(`ElevenLabs: ${toErrorMessage(error)}`);
  }
}

/**
 * Stops active playback process before a new synthesis request starts.
 *
 * @returns {Promise<void>} Nothing.
 */
async function stopExistingPlayback(): Promise<void> {
  const state = await readState(STATE_FILE_PATH);
  if (!state) {
    return;
  }

  if (isProcessAlive(state.pid)) {
    stopProcess(state.pid);
  }

  await clearState(STATE_FILE_PATH);
}
