export const translateRequestCharLimit = 4_500;
export const translateRequestStringLimit = 128;
export const translateRequestByteLimit = 90_000;
export const maxGoogleKeyLength = 200;

const namedEntities: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

export function googleTranslateEndpoint(key: string): URL {
  const trimmed = key.trim();
  if (trimmed.length === 0 || trimmed.length > maxGoogleKeyLength) {
    throw new Error("invalid key");
  }
  const url = new URL("https://translation.googleapis.com/language/translate/v2");
  url.searchParams.set("key", trimmed);
  return url;
}

function batchFits(texts: readonly string[], indexes: readonly number[]): boolean {
  if (indexes.length > translateRequestStringLimit) return false;
  let chars = 0;
  const q: string[] = [];
  for (const index of indexes) {
    const text = texts[index] ?? "";
    chars += text.length;
    q.push(text);
  }
  if (chars > translateRequestCharLimit) return false;
  const json = JSON.stringify({ q, source: "en", target: "uk", format: "text" });
  return new TextEncoder().encode(json).byteLength <= translateRequestByteLimit;
}

export function packTranslateBatches(texts: readonly string[]): {
  batches: { indexes: number[] }[];
  unpackable: number[];
} {
  const batches: { indexes: number[] }[] = [];
  const unpackable: number[] = [];
  let current: number[] = [];
  for (let index = 0; index < texts.length; index += 1) {
    if (current.length === 0) {
      if (!batchFits(texts, [index])) {
        unpackable.push(index);
        continue;
      }
      current = [index];
      continue;
    }
    if (batchFits(texts, [...current, index])) {
      current.push(index);
      continue;
    }
    batches.push({ indexes: current });
    if (!batchFits(texts, [index])) {
      unpackable.push(index);
      current = [];
      continue;
    }
    current = [index];
  }
  if (current.length > 0) batches.push({ indexes: current });
  return { batches, unpackable };
}

function codePointText(code: number, match: string): string {
  if (!Number.isInteger(code) || code < 0 || code > 1_114_111) return match;
  try {
    return String.fromCodePoint(code);
  } catch {
    return match;
  }
}

export function decodeTranslateText(value: string): string {
  const decoded = value.replace(
    /&(?:(amp|lt|gt|quot|apos)|#(\d+)|#x([0-9a-fA-F]+));/g,
    (match, name: string | undefined, decimal: string | undefined, hex: string | undefined) => {
      if (name !== undefined) return namedEntities[name] ?? match;
      if (decimal !== undefined) return codePointText(Number(decimal), match);
      if (hex !== undefined) return codePointText(Number.parseInt(hex, 16), match);
      return match;
    },
  );
  return decoded.trim();
}

export function readTranslations(
  body: unknown,
  expected: number,
): ({ text: string } | { text: null })[] | null {
  if (typeof body !== "object" || body === null) return null;
  const data = (body as { data?: unknown }).data;
  if (typeof data !== "object" || data === null) return null;
  const translations = (data as { translations?: unknown }).translations;
  if (!Array.isArray(translations) || translations.length !== expected) return null;
  const rows: ({ text: string } | { text: null })[] = [];
  for (const item of translations) {
    if (typeof item !== "object" || item === null) return null;
    const translated = (item as { translatedText?: unknown }).translatedText;
    if (typeof translated !== "string") return null;
    const text = decodeTranslateText(translated);
    rows.push(text === "" ? { text: null } : { text });
  }
  return rows;
}
