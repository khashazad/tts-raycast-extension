# TTS Raycast Extension — Design Spec
**Date:** 2026-04-05

## Overview

A Raycast extension that reads selected text aloud using the ElevenLabs API. The user highlights text in any app, triggers a hotkey, and audio plays immediately. A minimal menu bar item shows the current word being read and updates live. Stop, pause, resume, and time-based skip are each bound to their own hotkeys.

---

## Commands

Six Raycast commands, each assigned a hotkey independently in Raycast's preferences UI:

| Command | Mode | Purpose |
|---|---|---|
| `speak-selected` | no-view | Main entry point — reads selected text |
| `pause-resume` | no-view | Toggles pause/resume |
| `stop` | no-view | Stops playback, clears state |
| `skip-back` | no-view | Rewinds N seconds |
| `skip-forward` | no-view | Fast-forwards N seconds |
| `tts-status` | menu-bar | Live word indicator in menu bar |

---

## Preferences

Defined in `package.json` under the extension, accessible via `getPreferenceValues<Preferences>()`:

| Name | Type | Default | Description |
|---|---|---|---|
| `apiKey` | `password` | — | ElevenLabs API key |
| `voiceId` | `dropdown` | first voice | Populated from `voices.getAll()` on load |
| `speed` | `textfield` | `"1.0"` | Speech speed, e.g. `1.15`, `0.92`. Supports 0.01 granularity. |
| `skipDuration` | `textfield` | `"10"` | Seconds per skip back/forward |
| `modelId` | `dropdown` | `eleven_turbo_v2_5` | TTS model. Options: `eleven_turbo_v2_5`, `eleven_multilingual_v2` |

---

## Shared State

All commands communicate via `/tmp/raycast-tts-state.json`. No IPC, no sockets — each command reads and writes this file atomically.

```ts
interface TTSState {
  status: "generating" | "playing" | "paused" | "idle";
  startedAt: number;      // Date.now() when current afplay was spawned
  offset: number;         // seconds already elapsed before current spawn
  pid: number;            // PID of current afplay process
  audioPath: string;      // path to /tmp/raycast-tts-audio.mp3
  audioDuration: number;  // seconds — last word's end time, used to clamp skips
  words: WordEntry[];     // full word timestamp array
}

interface WordEntry {
  word: string;
  start: number;          // seconds from audio start
  end: number;
}
```

State file is deleted on `stop` and on extension startup if the stored PID is no longer alive.

---

## Data Flow

### `speak-selected`

1. `getSelectedText()` — fails with `showHUD("No text selected")` if nothing highlighted
2. Write `status: "generating"` to state (menu bar shows `🔊 …`)
3. Call `elevenlabs.textToSpeech.convertWithTimestamps(voiceId, { text, modelId, voiceSettings: { speed: parseFloat(prefs.speed) } })`
4. Decode base64 audio → write to `/tmp/raycast-tts-audio.mp3`
5. Map character timestamps → word timestamps: group consecutive non-whitespace characters, take `start` of first char and `end` of last
6. Write full `TTSState` with `status: "playing"`, `offset: 0`, `startedAt: Date.now()`
7. Spawn `afplay /tmp/raycast-tts-audio.mp3` as a detached child process, write its PID to state
8. Exit command (Raycast unloads the command process; afplay continues independently)

### `pause-resume`

- Read state. If `status !== "playing" && status !== "paused"` → no-op.
- **Pause:** compute `currentOffset = (Date.now() - startedAt) / 1000 + offset`, kill PID, write `status: "paused"`, `offset: currentOffset`
- **Resume:** spawn `afplay /tmp/raycast-tts-audio.mp3 -t <offset>`, write `status: "playing"`, `startedAt: Date.now()`, new PID

### `stop`

- Kill PID if alive. Delete state file.

### `skip-back` / `skip-forward`

- Compute `currentOffset` (same as pause)
- Add/subtract `parseFloat(prefs.skipDuration)`, clamp to `[0, audioDuration]`
- Kill PID, spawn `afplay -t <newOffset>`, update state

### `tts-status` (menu bar, 5s refresh)

- If state file absent or `status: "idle"` → `isHidden: true` (completely invisible)
- If `status: "generating"`: show `🔊 …`
- If `status: "playing"`: compute `elapsed = (Date.now() - startedAt) / 1000 + offset`, find current word via `words.find(w => elapsed >= w.start && elapsed <= w.end)`, show `🔊 <word>`
- If `status: "paused"`: show `⏸ <lastWord>` (the word at the paused offset)
- Dropdown: two items only — **Pause/Resume** (calls `launchCommand`) and **Stop** (calls `launchCommand`)
- If stored PID is no longer alive and status is "playing" → auto-reset to hidden, delete state file (audio finished)

---

## ElevenLabs Integration

- Package: `@elevenlabs/elevenlabs-js`
- Client initialized with `apiKey` from preferences
- Model default: `eleven_turbo_v2_5` (lower latency than multilingual v2)
- `convertWithTimestamps` returns `AudioWithTimestampsResponse`:
  - `audio_base64` — full MP3 as base64
  - `alignment.characters`, `alignment.character_start_times_seconds`, `alignment.character_end_times_seconds`
- Word mapping: iterate characters, accumulate into word buffer on non-space chars, flush on space/end

---

## Error Handling

| Scenario | Behavior |
|---|---|
| No text selected | `showHUD("No text selected")` |
| ElevenLabs API error | `showHUD("ElevenLabs: <error.message>")`, clear state |
| Invalid speed value | Fall back to `1.0`, no crash |
| Invalid skip duration | Fall back to `10` seconds |
| Stop/skip/pause when idle | Silent no-op (state file absent) |
| `afplay` ends naturally | Menu bar detects dead PID on next refresh, hides itself |
| `afplay` not found | `showHUD("afplay not found — macOS only")` |

---

## Project Structure

```
tts-raycast-extension/
├── package.json                  # Raycast manifest + preferences + commands
├── src/
│   ├── speak-selected.ts         # Main speak command
│   ├── pause-resume.ts
│   ├── stop.ts
│   ├── skip-back.ts
│   ├── skip-forward.ts
│   ├── tts-status.tsx            # Menu bar command (JSX)
│   └── lib/
│       ├── state.ts              # Read/write/clear TTSState
│       ├── elevenlabs.ts         # ElevenLabs client + convertWithTimestamps wrapper
│       ├── words.ts              # Character → word timestamp mapping
│       └── playback.ts           # afplay spawn, kill, seek helpers
├── assets/
│   └── extension-icon.png
└── docs/
    └── superpowers/specs/
        └── 2026-04-05-tts-extension-design.md
```

---

## Constraints & Notes

- **macOS only** — relies on `afplay` (ships with macOS, no install needed)
- **No streaming playback** — full audio fetched before playback starts. Typical latency: 1–3s depending on text length and model
- **Menu bar refresh is 5s** — word indicator lags up to 5s behind actual speech. This is a Raycast platform limitation; cannot be made truly real-time without a polling workaround
- **One reading at a time** — invoking `speak-selected` while already playing stops the current audio and starts fresh

---

## Open Questions

None — all design decisions resolved.
