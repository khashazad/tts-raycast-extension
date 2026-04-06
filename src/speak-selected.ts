import { getSelectedText, showHUD } from "@raycast/api";
import { writeFile } from "node:fs/promises";

import { synthesizeWithTimestamps } from "./lib/elevenlabs";
import { AfplayNotFoundError, spawnPlayback, stopProcessWithEscalation } from "./lib/playback";
import { getPreferences, parseSpeed } from "./lib/preferences";
import { clearState, readState, writeState } from "./lib/state";
import { STATE_FILE_PATH, getAudioFilePath } from "./lib/constants";
import {
  createGeneratingState,
  createSessionId,
  isCurrentSession,
  removeAudioFile,
  toErrorMessage,
} from "./lib/command-utils";

/**
 * Reads currently selected text, synthesizes speech, and starts detached playback.
 *
 * @returns {Promise<void>} Nothing.
 */
export default async function command(): Promise<void> {
  const sessionId = createSessionId();
  const audioPath = getAudioFilePath(sessionId);
  let selectedText: string;

  try {
    selectedText = await getSelectedText();
  } catch {
    await showHUD("No text selected");
    return;
  }

  try {
    await stopExistingPlayback();
    await writeState(STATE_FILE_PATH, createGeneratingState(audioPath, sessionId));

    const preferences = getPreferences();
    const synthesis = await synthesizeWithTimestamps({
      apiKey: preferences.apiKey,
      voiceId: preferences.voiceId,
      text: selectedText,
      modelId: preferences.modelId,
      speed: parseSpeed(preferences.speed),
    });

    await writeFile(audioPath, synthesis.audioBuffer);
    if (!(await hasSessionOwnership(sessionId))) {
      await removeAudioFile(audioPath);
      return;
    }

    const pid = await spawnPlayback(audioPath, 0);
    if (!(await hasSessionOwnership(sessionId))) {
      await stopProcessWithEscalation(pid);
      await removeAudioFile(audioPath);
      return;
    }

    await writeState(STATE_FILE_PATH, {
      sessionId,
      status: "playing",
      startedAt: Date.now(),
      offset: 0,
      pid,
      audioPath,
      audioDuration: synthesis.audioDuration,
      words: synthesis.words,
    });
  } catch (error) {
    const ownsSession = await hasSessionOwnership(sessionId);
    if (!ownsSession) {
      await removeAudioFile(audioPath);
      return;
    }

    await clearState(STATE_FILE_PATH);
    await removeAudioFile(audioPath);

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

  await stopProcessWithEscalation(state.pid);

  await clearState(STATE_FILE_PATH);
  await removeAudioFile(state.audioPath);
}

/**
 * Checks whether the persisted state still belongs to the current command run.
 *
 * @param {string} sessionId - Session identifier to verify.
 * @returns {Promise<boolean>} `true` when command still owns state.
 */
async function hasSessionOwnership(sessionId: string): Promise<boolean> {
  const state = await readState(STATE_FILE_PATH);
  return isCurrentSession(state, sessionId);
}
