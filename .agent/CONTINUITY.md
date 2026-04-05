[PLANS]
- 2026-04-05T14:56Z [USER] Implement the spec at `docs/superpowers/specs/2026-04-05-tts-extension-design.md` using superpower workflow.
- 2026-04-05T14:56Z [CODE] Executed plan by scaffolding a full Raycast extension, implementing shared TTS/playback/state modules, wiring six commands, and adding targeted unit tests for core logic.

[DECISIONS]
- 2026-04-05T14:56Z [CODE] Implemented shared state via atomic JSON file writes to `/tmp/raycast-tts-state.json` and audio output at `/tmp/raycast-tts-audio.mp3` to match cross-command coordination requirements.
- 2026-04-05T14:56Z [TOOL] Used `@elevenlabs/elevenlabs-js` typed API (`textToSpeech.convertWithTimestamps`, `voices.getAll`) and adapted to SDK camelCase response fields.
- 2026-04-05T14:56Z [TOOL] Set Raycast manifest icon to PNG and metadata validated through `npx ray lint`.
- 2026-04-05T15:20Z [USER] For review feedback triage, applied only findings still valid against current code and skipped outdated script feedback already addressed in prior commit.

[PROGRESS]
- 2026-04-05T14:56Z [TOOL] Red phase completed: tests initially failed due missing modules, then passed after implementation (`words`, `playback`, `state`).
- 2026-04-05T14:56Z [CODE] Added menu-bar command polling every 5 seconds and command-launch actions for pause/resume + stop.
- 2026-04-05T14:56Z [TOOL] Typecheck/build initially failed on React typings mismatch; fixed by aligning to React 19 types compatible with `@raycast/api`.
- 2026-04-05T14:58Z [CODE] Added `.gitignore` to exclude local artifacts (`node_modules`, `dist`, `.superpowers`) and generated Raycast typings file integration via `tsconfig.json`.
- 2026-04-05T15:12Z [USER] Requested correction to build scripts; updated npm scripts so `build` uses Raycast CLI, `lint` uses Raycast lint, and `typecheck` runs standalone `tsc --noEmit`.
- 2026-04-05T15:20Z [CODE] Reworked playback resume/skip path: offset `0` uses `afplay`; offset `>0` now uses `ffplay -ss` seeking, with cached binary availability checks.
- 2026-04-05T15:20Z [CODE] Hardened error handling in `pause-resume` and `skip` commands, strengthened state schema validation, removed `readState` TOCTOU pre-check, and isolated Vitest globals into `tsconfig.test.json`.

[DISCOVERIES]
- 2026-04-05T14:56Z [TOOL] `afplay --help` indicates `-t/--time` is a duration flag, not a seek-start flag. Current implementation follows provided spec behavior but this may limit true resume/seek fidelity in runtime.
- 2026-04-05T14:56Z [TOOL] Raycast lint enforces a resolvable author handle and PNG icon format; manifest passes after setting `author: "thomas"` and generating `assets/extension-icon.png`.
- 2026-04-05T15:20Z [TOOL] Vitest config does not expose `test.tsconfig`; test-specific tsconfig is supported under `test.typecheck.tsconfig`.

[OUTCOMES]
- 2026-04-05T14:56Z [TOOL] Verification complete: `npm test`, `npm run lint`, `npm run build`, and `npx ray lint` all pass.
- 2026-04-05T14:56Z [CODE] Extension now includes six commands, shared state/playback/ElevenLabs modules, and tests for timestamp mapping, offset math, and state persistence.
- 2026-04-05T14:58Z [TOOL] `npx ray build -e dist` completes successfully and compiles all six command entry points.
- 2026-04-05T15:12Z [TOOL] Post-script-change verification passed: `npm run test`, `npm run typecheck`, `npm run lint`, `npm run build`.
- 2026-04-05T15:20Z [TOOL] Post-review-fix verification passed: `npm run test`, `npm run typecheck`, `npm run lint`, `npm run build`.
