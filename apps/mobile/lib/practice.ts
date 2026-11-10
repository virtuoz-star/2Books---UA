import type { NativeLanguage } from "@/lib/types";

export type PracticeCard = {
  word: string;
  gloss: string;
  nativeLanguage: NativeLanguage;
  sentenceEn: string;
  sentenceNative: string;
};

export type PracticeAnswer = "again" | "know";

export type PracticeState = {
  queue: readonly PracticeCard[];
  revealed: boolean;
  missed: readonly PracticeCard[];
  cards: number;
};

export type PracticeSummary = {
  done: boolean;
  cards: number;
  again: number;
  missed: readonly PracticeCard[];
};

function roll(random: () => number, span: number): number {
  if (span <= 1) return 0;
  const value = random();
  if (!Number.isFinite(value) || value <= 0) return 0;
  const scaled = Math.floor(value * span);
  if (scaled >= span) return span - 1;
  return scaled;
}

function shuffleCards(cards: readonly PracticeCard[], random: () => number): PracticeCard[] {
  const next = cards.slice();
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = roll(random, index + 1);
    const current = next[index] as PracticeCard;
    next[index] = next[swap] as PracticeCard;
    next[swap] = current;
  }
  return next;
}

export function practiceKey(card: PracticeCard): string {
  return `${card.nativeLanguage}:${card.word}`;
}

/** Gloss, then the translated sentence. Empty parts are left out. */
export function practiceAnswerText(card: PracticeCard): string {
  const parts = [card.gloss.trim(), card.sentenceNative.trim()].filter((part) => part.length > 0);
  return parts.join(". ");
}

/**
 * What a screen reader meets, in order.
 * The answer is absent until the card is revealed, and the word stays first.
 */
export function practiceReading(card: PracticeCard, revealed: boolean): readonly string[] {
  if (!revealed) return [card.word];
  const answer = practiceAnswerText(card);
  return answer === "" ? [card.word] : [card.word, answer];
}

export function startPractice(
  cards: readonly PracticeCard[],
  random: () => number = Math.random,
): PracticeState {
  return {
    queue: shuffleCards(cards, random),
    revealed: false,
    missed: [],
    cards: cards.length,
  };
}

export function revealPractice(state: PracticeState): PracticeState {
  if (state.revealed || state.queue.length === 0) return state;
  return { ...state, revealed: true };
}

export function answerPractice(state: PracticeState, answer: PracticeAnswer): PracticeState {
  if (!state.revealed || state.queue.length === 0) return state;
  const current = state.queue[0];
  if (current === undefined) return state;
  const rest = state.queue.slice(1);
  if (answer === "know") return { ...state, queue: rest, revealed: false };
  const key = practiceKey(current);
  const missed = state.missed.some((card) => practiceKey(card) === key)
    ? state.missed
    : [...state.missed, current];
  return { ...state, queue: [...rest, current], revealed: false, missed };
}

export function practiceSummary(state: PracticeState): PracticeSummary {
  return {
    done: state.queue.length === 0,
    cards: state.cards,
    again: state.missed.length,
    missed: state.missed,
  };
}
