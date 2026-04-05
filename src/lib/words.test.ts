import { describe, expect, it } from "vitest";

import { mapCharacterAlignmentToWords } from "./words";

describe("mapCharacterAlignmentToWords", () => {
  it("groups consecutive non-whitespace characters into words", () => {
    const words = mapCharacterAlignmentToWords({
      characters: ["H", "e", "l", "l", "o", " ", "w", "o", "r", "l", "d"],
      character_start_times_seconds: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
      character_end_times_seconds: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1],
    });

    expect(words).toEqual([
      { word: "Hello", start: 0, end: 0.5 },
      { word: "world", start: 0.6, end: 1.1 },
    ]);
  });

  it("skips repeated whitespace and handles trailing words", () => {
    const words = mapCharacterAlignmentToWords({
      characters: [" ", "A", " ", " ", "B"],
      character_start_times_seconds: [0, 0.2, 0.3, 0.31, 0.5],
      character_end_times_seconds: [0.1, 0.3, 0.31, 0.4, 0.8],
    });

    expect(words).toEqual([
      { word: "A", start: 0.2, end: 0.3 },
      { word: "B", start: 0.5, end: 0.8 },
    ]);
  });
});
