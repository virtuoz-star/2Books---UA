const maxTranslationLength = 8_000;
const sentenceIdPattern = /^s\d+$/;

type TranslationPair = { id: string; uk: string; ru: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sentenceIds(body: Record<string, unknown>): Set<string> | null {
  if (!Array.isArray(body.chapters)) return null;
  const ids = new Set<string>();
  for (const chapter of body.chapters) {
    if (!isRecord(chapter) || !Array.isArray(chapter.sentences)) return null;
    for (const sentence of chapter.sentences) {
      if (isRecord(sentence) && typeof sentence.id === "string") ids.add(sentence.id);
    }
  }
  return ids;
}

function countFilled(body: unknown): { filled: number; remaining: number } {
  let filled = 0;
  let remaining = 0;
  if (!isRecord(body) || !Array.isArray(body.chapters)) return { filled, remaining };
  for (const chapter of body.chapters) {
    if (!isRecord(chapter) || !Array.isArray(chapter.sentences)) continue;
    for (const sentence of chapter.sentences) {
      if (!isRecord(sentence)) {
        remaining += 1;
        continue;
      }
      const uk = typeof sentence.uk === "string" ? sentence.uk.trim() : "";
      const ru = typeof sentence.ru === "string" ? sentence.ru.trim() : "";
      if (uk.length >= 1 && ru.length >= 1) filled += 1;
      else remaining += 1;
    }
  }
  return { filled, remaining };
}

export function applyUploadTranslations(
  storedBody: unknown,
  input: {
    again: boolean;
    sentences: { id: string; uk: string; ru: string }[];
  },
):
  | {
      ok: true;
      body: unknown;
      alignment: "pending" | "ready";
      filled: number;
      remaining: number;
    }
  | { ok: false; error: "invalid" } {
  void input.again;
  if (!Array.isArray(input.sentences) || input.sentences.length > 200) {
    return { ok: false, error: "invalid" };
  }
  if (!isRecord(storedBody)) return { ok: false, error: "invalid" };
  const ids = sentenceIds(storedBody);
  if (ids === null) return { ok: false, error: "invalid" };

  const seen = new Set<string>();
  const kept: TranslationPair[] = [];
  for (const pair of input.sentences) {
    if (!isRecord(pair)) return { ok: false, error: "invalid" };
    const { id, uk, ru } = pair;
    if (typeof id !== "string" || !sentenceIdPattern.test(id) || seen.has(id) || !ids.has(id)) {
      return { ok: false, error: "invalid" };
    }
    seen.add(id);
    if (typeof uk !== "string" || typeof ru !== "string") return { ok: false, error: "invalid" };
    const trimmedUk = uk.trim();
    const trimmedRu = ru.trim();
    if (trimmedUk.length === 0 || trimmedRu.length === 0) return { ok: false, error: "invalid" };
    if (trimmedUk.length > maxTranslationLength || trimmedRu.length > maxTranslationLength)
      continue;
    kept.push({ id, uk: trimmedUk, ru: trimmedRu });
  }

  const body: unknown = kept.length === 0 ? storedBody : structuredClone(storedBody);
  if (kept.length > 0 && isRecord(body) && Array.isArray(body.chapters)) {
    const byId = new Map(kept.map((pair) => [pair.id, pair]));
    for (const chapter of body.chapters) {
      if (!isRecord(chapter) || !Array.isArray(chapter.sentences)) continue;
      for (const sentence of chapter.sentences) {
        if (!isRecord(sentence) || typeof sentence.id !== "string") continue;
        const pair = byId.get(sentence.id);
        if (!pair) continue;
        sentence.uk = pair.uk;
        sentence.ru = pair.ru;
      }
    }
  }

  const { filled, remaining } = countFilled(body);
  return {
    ok: true,
    body,
    alignment: remaining === 0 ? "ready" : "pending",
    filled,
    remaining,
  };
}
