export type FlashCard = {
  id: string;
  word: string;
  gloss: string;
  sentenceEn: string;
  sentenceNative: string;
};

export type FlashAnswer = "again" | "know";

export type FlashSession = {
  queue: FlashCard[];
  missed: FlashCard[];
  known: number;
  revealed: boolean;
  total: number;
};

export function startFlashSession(
  cards: readonly FlashCard[],
  random: () => number = Math.random,
): FlashSession {
  return {
    queue: shuffle(cards, random),
    missed: [],
    known: 0,
    revealed: false,
    total: cards.length,
  };
}

export function revealFlashCard(session: FlashSession): FlashSession {
  if (session.queue.length === 0 || session.revealed) return session;
  return { ...session, revealed: true };
}

/** "Again" puts the card back later in this session. "Know" removes it. */
export function answerFlashCard(session: FlashSession, answer: FlashAnswer): FlashSession {
  if (!session.revealed || session.queue.length === 0) return session;
  const [current, ...rest] = session.queue;
  if (current === undefined) return session;
  if (answer === "know") {
    return { ...session, queue: rest, known: session.known + 1, revealed: false };
  }
  const missed = session.missed.some((card) => card.id === current.id)
    ? session.missed
    : [...session.missed, current];
  return { ...session, queue: [...rest, current], missed, revealed: false };
}

export function flashSummary(session: FlashSession): {
  total: number;
  again: number;
  done: boolean;
} {
  return {
    total: session.total,
    again: session.missed.length,
    done: session.queue.length === 0,
  };
}

function shuffle<T>(cards: readonly T[], random: () => number): T[] {
  const next = [...cards];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.min(index, Math.max(0, Math.floor(random() * (index + 1))));
    const current = next[index];
    next[index] = next[swap] as T;
    next[swap] = current as T;
  }
  return next;
}
