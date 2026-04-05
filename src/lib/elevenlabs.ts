import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

import { mapCharacterAlignmentToWords } from "./words";
import type { CharacterAlignment } from "./words";
import type { WordEntry } from "./types";

export interface SynthesisOptions {
  apiKey: string;
  voiceId: string;
  text: string;
  modelId: string;
  speed: number;
}

export interface SynthesisResult {
  audioBuffer: Buffer;
  words: WordEntry[];
  audioDuration: number;
}

/**
 * Resolves a usable ElevenLabs voice ID.
 *
 * @param {ElevenLabsClient} client - Initialized ElevenLabs API client.
 * @param {string} preferredVoiceId - Preferred voice ID from user preferences.
 * @returns {Promise<string>} Selected voice ID.
 * @throws {Error} When no voices are available.
 */
export async function resolveVoiceId(client: ElevenLabsClient, preferredVoiceId: string): Promise<string> {
  const trimmedVoiceId = preferredVoiceId.trim();
  if (trimmedVoiceId !== "") {
    return trimmedVoiceId;
  }

  const voicesResponse = await client.voices.getAll();
  const firstVoiceId = voicesResponse.voices[0]?.voiceId;
  if (!firstVoiceId) {
    throw new Error("No ElevenLabs voices available for this account");
  }

  return firstVoiceId;
}

/**
 * Converts text into timestamped speech and maps character alignment to words.
 *
 * @param {SynthesisOptions} options - Input text and synthesis configuration.
 * @returns {Promise<SynthesisResult>} Audio bytes plus word timing metadata.
 * @throws {Error} When synthesis fails or response payload is invalid.
 */
export async function synthesizeWithTimestamps(options: SynthesisOptions): Promise<SynthesisResult> {
  const client = new ElevenLabsClient({ apiKey: options.apiKey });
  const selectedVoiceId = await resolveVoiceId(client, options.voiceId);
  const response = await client.textToSpeech.convertWithTimestamps(selectedVoiceId, {
    text: options.text,
    modelId: options.modelId,
    outputFormat: "mp3_44100_128",
    voiceSettings: {
      speed: options.speed,
    },
  });

  const alignment = response.alignment as CharacterAlignment | undefined;
  const words = alignment ? mapCharacterAlignmentToWords(alignment) : [];
  const lastCharacterEndTime = getLastAlignmentEndTime(alignment);
  const lastWordEndTime = words.length > 0 ? words[words.length - 1].end : 0;
  const audioDuration = Math.max(lastWordEndTime, lastCharacterEndTime);
  const audioBase64 =
    (response as { audio_base64?: string; audioBase64?: string }).audio_base64 ?? response.audioBase64;
  if (!audioBase64) {
    throw new Error("ElevenLabs response did not include audio payload");
  }

  return {
    audioBuffer: Buffer.from(audioBase64, "base64"),
    words,
    audioDuration,
  };
}

/**
 * Extracts the final character end timestamp from alignment metadata.
 *
 * @param {CharacterAlignment | undefined} alignment - Character alignment metadata.
 * @returns {number} Final character end time in seconds, or `0` when unavailable.
 */
function getLastAlignmentEndTime(alignment: CharacterAlignment | undefined): number {
  if (!alignment) {
    return 0;
  }

  const endTimes = alignment.characterEndTimesSeconds ?? alignment.character_end_times_seconds ?? [];
  return endTimes.length > 0 ? endTimes[endTimes.length - 1] ?? 0 : 0;
}
