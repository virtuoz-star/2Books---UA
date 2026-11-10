export type SentenceRowModel<T> = {
  key: string;
  sentence: T;
  index: number;
  paragraphEnd: boolean;
};

function paragraphValue(sentence: { paragraph?: number }): number | null {
  if (
    typeof sentence.paragraph !== "number" ||
    !Number.isInteger(sentence.paragraph) ||
    sentence.paragraph < 0
  ) {
    return null;
  }
  return sentence.paragraph;
}

/** One row per sentence, so a mark can land on a later sentence in the same paragraph. */
export function sentenceRows<T extends { id: string; paragraph?: number }>(
  sentences: readonly T[],
): SentenceRowModel<T>[] {
  const rows: SentenceRowModel<T>[] = [];
  for (let index = 0; index < sentences.length; index += 1) {
    const sentence = sentences[index];
    if (!sentence) continue;
    const next = sentences[index + 1];
    const current = paragraphValue(sentence);
    const following = next ? paragraphValue(next) : null;
    const paragraphEnd = current !== null && following !== null && current !== following;
    rows.push({
      key: sentence.id,
      sentence,
      index,
      paragraphEnd,
    });
  }
  return rows;
}

export function visibleSentence(
  offset: number,
  header: number,
  rows: readonly { id: string; index: number; height: number }[],
): { sentenceId: string; sentenceIndex: number } | null {
  let cursor = header;
  const edge = offset + 4;
  for (const row of rows) {
    if (row.height > 0 && cursor + row.height > edge) {
      return { sentenceId: row.id, sentenceIndex: row.index };
    }
    cursor += row.height;
  }
  return null;
}

/** Null when a row above the sentence has not been measured yet. */
export function scrollOffsetForSentence(
  header: number,
  heights: readonly number[],
  index: number,
): number | null {
  let offset = header;
  for (let row = 0; row < index; row += 1) {
    const height = heights[row] ?? 0;
    if (height <= 0) return null;
    offset += height;
  }
  return Math.max(0, offset - 8);
}
