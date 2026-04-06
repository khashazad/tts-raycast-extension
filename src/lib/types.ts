export type TTSStatus = "generating" | "playing" | "paused" | "idle";

export interface WordEntry {
  word: string;
  start: number;
  end: number;
}

export interface TTSState {
  sessionId: string;
  status: TTSStatus;
  startedAt: number;
  offset: number;
  pid: number;
  audioPath: string;
  audioDuration: number;
  words: WordEntry[];
}
