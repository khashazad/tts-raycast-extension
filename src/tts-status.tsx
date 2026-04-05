import { LaunchType, MenuBarExtra, launchCommand } from "@raycast/api";
import type { ReactElement } from "react";
import { useEffect, useState } from "react";

import { MENU_BAR_REFRESH_MS, STATE_FILE_PATH } from "./lib/constants";
import { getCurrentOffset } from "./lib/playback";
import { readActiveState } from "./lib/state";
import type { TTSState } from "./lib/types";
import { findLastWordAtOrBefore, findWordForElapsedTime } from "./lib/words";

/**
 * Renders the menu bar status for active TTS playback.
 *
 * @returns {ReactElement | null} Visible menu bar item, or `null` when idle.
 */
export default function Command(): ReactElement | null {
  const { state, isLoading } = useTtsMenuState();
  if (!state) {
    return null;
  }

  return (
    <MenuBarExtra title={buildMenuBarTitle(state)} tooltip="TTS Status" isLoading={isLoading}>
      <MenuBarExtra.Item title="Pause/Resume" onAction={() => void triggerCommand("pause-resume")} />
      <MenuBarExtra.Item title="Stop" onAction={() => void triggerCommand("stop")} />
    </MenuBarExtra>
  );
}

/**
 * Polls shared state for menu bar rendering.
 *
 * @returns {{ state: TTSState | null; isLoading: boolean }} Current state and loading flag.
 */
function useTtsMenuState(): { state: TTSState | null; isLoading: boolean } {
  const [state, setState] = useState<TTSState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      const nextState = await readActiveState(STATE_FILE_PATH);
      if (cancelled) {
        return;
      }
      setState(nextState);
      setIsLoading(false);
    };

    void refresh();
    const intervalHandle = setInterval(() => {
      void refresh();
    }, MENU_BAR_REFRESH_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalHandle);
    };
  }, []);

  return { state, isLoading };
}

/**
 * Builds the compact menu bar title for current playback state.
 *
 * @param {TTSState} state - Shared playback state.
 * @returns {string} Display title with icon and current word.
 */
function buildMenuBarTitle(state: TTSState): string {
  if (state.status === "generating") {
    return "🔊 …";
  }

  if (state.status === "playing") {
    const elapsed = getCurrentOffset({ startedAt: state.startedAt, offset: state.offset });
    const word = findWordForElapsedTime(state.words, elapsed);
    return `🔊 ${word?.word ?? "…"}`;
  }

  if (state.status === "paused") {
    const word = findLastWordAtOrBefore(state.words, state.offset);
    return `⏸ ${word?.word ?? "…"}`;
  }

  return "🔊";
}

/**
 * Launches another no-view command from the menu bar.
 *
 * @param {string} name - Command identifier to launch.
 * @returns {Promise<void>} Nothing.
 * @throws {Error} When command cannot be launched.
 */
async function triggerCommand(name: string): Promise<void> {
  await launchCommand({ name, type: LaunchType.UserInitiated });
}
