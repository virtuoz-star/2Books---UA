import { expect, test } from "vite-plus/test";

import {
  answerFlashCard,
  flashSummary,
  revealFlashCard,
  startFlashSession,
  type FlashCard,
} from "#/dictionary/flashcards";

function card(id: string): FlashCard {
  return {
    id,
    word: id,
    gloss: `${id} gloss`,
    sentenceEn: `See ${id}.`,
    sentenceNative: id,
  };
}

test("a session shuffles with the injected random source", () => {
  const cards = [card("a"), card("b"), card("c")];
  const session = startFlashSession(cards, () => 0);
  expect(session.queue.map((item) => item.id)).toEqual(["b", "c", "a"]);
  expect(session.total).toBe(3);
  expect(session.revealed).toBe(false);
  expect(flashSummary(session).done).toBe(false);
});

test("again returns the card before the session ends and know removes it", () => {
  let session = startFlashSession([card("a"), card("b")], () => 0.99);
  expect(session.queue.map((item) => item.id)).toEqual(["a", "b"]);
  session = answerFlashCard(session, "again");
  expect(session.queue.map((item) => item.id)).toEqual(["a", "b"]);
  session = revealFlashCard(session);
  session = answerFlashCard(session, "again");
  expect(session.queue.map((item) => item.id)).toEqual(["b", "a"]);
  expect(session.missed.map((item) => item.id)).toEqual(["a"]);
  session = revealFlashCard(session);
  session = answerFlashCard(session, "know");
  session = revealFlashCard(session);
  session = answerFlashCard(session, "know");
  expect(session.queue).toEqual([]);
  expect(flashSummary(session)).toEqual({ total: 2, again: 1, done: true });
});

test("a card answered again on its own comes back as the remaining card", () => {
  let session = revealFlashCard(startFlashSession([card("only")]));
  session = answerFlashCard(session, "again");
  expect(session.queue.map((item) => item.id)).toEqual(["only"]);
  expect(session.revealed).toBe(false);
  expect(flashSummary(session).done).toBe(false);
});
