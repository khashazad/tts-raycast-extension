import type { WordEntry } from "./types";

export interface CharacterAlignment {
  characters: string[];
  characterStartTimesSeconds?: number[];
  characterEndTimesSeconds?: number[];
  character_start_times_seconds?: number[];
  character_end_times_seconds?: number[];
}

/**
 * Converts character-level timestamp alignment into word-level timestamps.
 *
 * @param {CharacterAlignment} alignment - Character alignment from ElevenLabs.
 * @returns {WordEntry[]} Array of timestamped words in speech order.
 */
export function mapCharacterAlignmentToWords(alignment: CharacterAlignment): WordEntry[] {
  const startTimes = alignment.characterStartTimesSeconds ?? alignment.character_start_times_seconds ?? [];
  const endTimes = alignment.characterEndTimesSeconds ?? alignment.character_end_times_seconds ?? [];
  const words: WordEntry[] = [];

  let currentWord = "";
  let currentStart: number | null = null;
  let currentEnd: number | null = null;

  for (let index = 0; index < alignment.characters.length; index += 1) {
    const character = alignment.characters[index] ?? "";
    const start = startTimes[index];
    const end = endTimes[index];

    if (/\s/.test(character)) {
      if (currentWord !== "" && currentStart !== null && currentEnd !== null) {
        words.push({ word: currentWord, start: currentStart, end: currentEnd });
      }
      currentWord = "";
      currentStart = null;
      currentEnd = null;
      continue;
    }

    currentWord += character;
    currentStart ??= start ?? 0;
    currentEnd = end ?? currentStart;
  }

  if (currentWord !== "" && currentStart !== null && currentEnd !== null) {
    words.push({ word: currentWord, start: currentStart, end: currentEnd });
  }

  return words;
}

/**
 * Returns the spoken word that contains a specific elapsed offset.
 *
 * @param {WordEntry[]} words - Ordered word timestamps.
 * @param {number} elapsedSeconds - Elapsed seconds in audio playback.
 * @returns {WordEntry | null} Matching word when found, otherwise `null`.
 */
export function findWordForElapsedTime(words: WordEntry[], elapsedSeconds: number): WordEntry | null {
  for (const word of words) {
    if (elapsedSeconds >= word.start && elapsedSeconds <= word.end) {
      return word;
    }
  }

  return null;
}

/**
 * Returns the last fully or partially spoken word at a given offset.
 *
 * @param {WordEntry[]} words - Ordered word timestamps.
 * @param {number} elapsedSeconds - Offset in seconds.
 * @returns {WordEntry | null} Last spoken word at the provided offset.
 */
export function findLastWordAtOrBefore(words: WordEntry[], elapsedSeconds: number): WordEntry | null {
  let lastWord: WordEntry | null = null;

  for (const word of words) {
    if (word.start <= elapsedSeconds) {
      lastWord = word;
      continue;
    }
    break;
  }

  return lastWord;
}
