/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** ElevenLabs API Key - API key for ElevenLabs speech synthesis */
  "apiKey": string,
  /** Voice - Voice ID to use for text-to-speech output */
  "voiceId": "",
  /** Speed - Speech speed multiplier such as 1.0 or 1.15 */
  "speed": string,
  /** Skip Duration (Seconds) - Seconds to move backward or forward per skip command */
  "skipDuration": string,
  /** Model - ElevenLabs model used for synthesis */
  "modelId": "eleven_turbo_v2_5" | "eleven_multilingual_v2"
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `speak-selected` command */
  export type SpeakSelected = ExtensionPreferences & {}
  /** Preferences accessible in the `pause-resume` command */
  export type PauseResume = ExtensionPreferences & {}
  /** Preferences accessible in the `stop` command */
  export type Stop = ExtensionPreferences & {}
  /** Preferences accessible in the `skip-back` command */
  export type SkipBack = ExtensionPreferences & {}
  /** Preferences accessible in the `skip-forward` command */
  export type SkipForward = ExtensionPreferences & {}
  /** Preferences accessible in the `tts-status` command */
  export type TtsStatus = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `speak-selected` command */
  export type SpeakSelected = {}
  /** Arguments passed to the `pause-resume` command */
  export type PauseResume = {}
  /** Arguments passed to the `stop` command */
  export type Stop = {}
  /** Arguments passed to the `skip-back` command */
  export type SkipBack = {}
  /** Arguments passed to the `skip-forward` command */
  export type SkipForward = {}
  /** Arguments passed to the `tts-status` command */
  export type TtsStatus = {}
}

