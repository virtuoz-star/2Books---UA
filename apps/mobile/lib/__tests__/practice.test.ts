import { expect, test } from "bun:test";

import {
  answerPractice,
  practiceAnswerText,
  practiceReading,
  practiceSummary,
  revealPractice,
  startPractice,
  type PracticeCard,
} from "../practice";

function card(word: string, gloss = word): PracticeCard {
  return {
    word,
    gloss,
    nativeLanguage: "uk",
    sentenceEn: `${word} in a sentence.`,
    sentenceNative: `${word} у реченні.`,
  };
}

function sequence(values: readonly number[]): () => number {
  let index = 0;
  return () => {
    const value = values[index] ?? 0;
    index += 1;
    return value;
  };
}

test("a session shuffles once and leaves the saved list alone", () => {
  const cards = [card("a"), card("b"), card("c")];
  const started = startPractice(cards, sequence([0, 0]));
  expect(cards.map((item) => item.word)).toEqual(["a", "b", "c"]);
  expect(started.queue.map((item) => item.word)).toEqual(["b", "c", "a"]);
  expect(started.revealed).toBe(false);
  expect(started.cards).toBe(3);
  expect(startPractice(cards, sequence([0, 0])).queue.map((item) => item.word)).toEqual([
    "b",
    "c",
    "a",
  ]);
});

test("an out-of-range roll still keeps every card", () => {
  const started = startPractice([card("a"), card("b"), card("c")], () => -2);
  const words = started.queue.map((item) => item.word);
  expect(words.length).toBe(3);
  expect(words.includes("a") && words.includes("b") && words.includes("c")).toBe(true);
});

test("know it is ignored until reveal and then finishes with no retries", () => {
  let state = startPractice([card("a"), card("b")], () => 0);
  expect(state.queue.map((item) => item.word)).toEqual(["b", "a"]);
  expect(answerPractice(state, "know")).toBe(state);
  state = answerPractice(revealPractice(state), "know");
  expect(state.queue.map((item) => item.word)).toEqual(["a"]);
  expect(state.revealed).toBe(false);
  state = answerPractice(revealPractice(state), "know");
  expect(practiceSummary(state)).toEqual({ done: true, cards: 2, again: 0, missed: [] });
});

test("again puts the card back before the session can end", () => {
  let state = startPractice([card("a"), card("b"), card("c")], () => 0.99);
  expect(state.queue.map((item) => item.word)).toEqual(["a", "b", "c"]);
  state = answerPractice(revealPractice(state), "again");
  expect(state.queue.map((item) => item.word)).toEqual(["b", "c", "a"]);
  expect(state.missed.map((item) => item.word)).toEqual(["a"]);
  expect(practiceSummary(state).done).toBe(false);
  state = answerPractice(revealPractice(state), "know");
  state = answerPractice(revealPractice(state), "know");
  expect(state.queue.map((item) => item.word)).toEqual(["a"]);
  expect(practiceSummary(state).done).toBe(false);
  state = answerPractice(revealPractice(state), "know");
  const summary = practiceSummary(state);
  expect(summary.done).toBe(true);
  expect(summary.cards).toBe(3);
  expect(summary.again).toBe(1);
  expect(summary.missed.map((item) => item.word)).toEqual(["a"]);
});

test("again on the last card returns it instead of ending", () => {
  let state = startPractice([card("only")], () => 0);
  state = answerPractice(revealPractice(state), "again");
  expect(state.queue.map((item) => item.word)).toEqual(["only"]);
  expect(state.revealed).toBe(false);
  expect(practiceSummary(state).done).toBe(false);
  state = answerPractice(revealPractice(state), "again");
  expect(state.queue).toHaveLength(1);
  expect(state.missed).toHaveLength(1);
  expect(practiceSummary(state).again).toBe(1);
});

test("reveal is a no-op once the answer is showing or the queue is empty", () => {
  const empty = startPractice([], () => 0);
  expect(revealPractice(empty)).toBe(empty);
  expect(answerPractice(empty, "again")).toBe(empty);
  expect(practiceSummary(empty)).toEqual({ done: true, cards: 0, again: 0, missed: [] });
  const state = startPractice([card("a")], () => 0);
  const revealed = revealPractice(state);
  expect(revealPractice(revealed)).toBe(revealed);
});

test("screen readers meet the word first and the answer only after reveal", () => {
  const item = card("pennies", "пенні");
  expect(practiceReading(item, false)).toEqual(["pennies"]);
  expect(practiceReading(item, true)).toEqual(["pennies", "пенні. pennies у реченні."]);
  expect(practiceAnswerText({ ...item, gloss: "  ", sentenceNative: "" })).toBe("");
  expect(practiceAnswerText({ ...item, gloss: "", sentenceNative: "речення" })).toBe("речення");
  expect(practiceReading({ ...item, gloss: "", sentenceNative: "" }, true)).toEqual(["pennies"]);
});
