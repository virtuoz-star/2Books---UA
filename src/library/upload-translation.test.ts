import { expect, test } from "vite-plus/test";

import { applyUploadTranslations } from "#/library/upload-translation";

function book(sentences: { id: string; en: string; uk: string; ru: string; paragraph?: number }[]) {
  return {
    title: { uk: "Note", ru: "Note", en: "Note" },
    chapters: [
      {
        id: "c1",
        title: { uk: "Note", ru: "Note", en: "Note" },
        sentences,
      },
    ],
  };
}

const stored = book([
  { id: "s1", en: "One dollar.", uk: "", ru: "", paragraph: 0 },
  { id: "s2", en: "Two.", uk: "", ru: "Два." },
]);

test("a partial patch fills only the given ids and stays pending", () => {
  const result = applyUploadTranslations(stored, {
    again: false,
    sentences: [{ id: "s1", uk: " Один долар. ", ru: "Один долар." }],
  });
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.alignment).toBe("pending");
  expect(result.filled).toBe(1);
  expect(result.remaining).toBe(1);
  const chapters = (result.body as typeof stored).chapters;
  expect(chapters[0]?.sentences[0]).toEqual({
    id: "s1",
    en: "One dollar.",
    uk: "Один долар.",
    ru: "Один долар.",
    paragraph: 0,
  });
  expect(chapters[0]?.sentences[1]).toEqual(stored.chapters[0]?.sentences[1]);
  expect(stored.chapters[0]?.sentences[0]?.uk).toBe("");
});

test("alignment is ready only when every sentence has both languages", () => {
  const result = applyUploadTranslations(stored, {
    again: true,
    sentences: [
      { id: "s1", uk: "Один долар.", ru: "Один долар." },
      { id: "s2", uk: "Два.", ru: "Два." },
    ],
  });
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.alignment).toBe("ready");
  expect(result.filled).toBe(2);
  expect(result.remaining).toBe(0);
});

test("an empty string, unknown id, duplicate id, or a 201st update is invalid", () => {
  const empty = applyUploadTranslations(stored, {
    again: false,
    sentences: [{ id: "s1", uk: " ", ru: "Один долар." }],
  });
  const unknown = applyUploadTranslations(stored, {
    again: false,
    sentences: [{ id: "s9", uk: "А.", ru: "Б." }],
  });
  const duplicate = applyUploadTranslations(stored, {
    again: false,
    sentences: [
      { id: "s1", uk: "А.", ru: "Б." },
      { id: "s1", uk: "В.", ru: "Г." },
    ],
  });
  const tooMany = applyUploadTranslations(stored, {
    again: false,
    sentences: Array.from({ length: 201 }, (_, index) => ({
      id: `s${index + 1}`,
      uk: "А.",
      ru: "Б.",
    })),
  });
  expect(empty).toEqual({ ok: false, error: "invalid" });
  expect(unknown).toEqual({ ok: false, error: "invalid" });
  expect(duplicate).toEqual({ ok: false, error: "invalid" });
  expect(tooMany).toEqual({ ok: false, error: "invalid" });
  expect(stored.chapters[0]?.sentences[0]?.uk).toBe("");
});

test("an over-long pair is skipped and a pair of 8000 characters is kept", () => {
  const long = "а".repeat(8_001);
  const exact = "б".repeat(8_000);
  const mixed = applyUploadTranslations(stored, {
    again: false,
    sentences: [
      { id: "s1", uk: long, ru: "Один долар." },
      { id: "s2", uk: "Два.", ru: exact },
    ],
  });
  expect(mixed.ok).toBe(true);
  if (!mixed.ok) return;
  expect(mixed.body).not.toBe(stored);
  const sentences = (mixed.body as typeof stored).chapters[0]?.sentences;
  expect(sentences?.[0]).toEqual(stored.chapters[0]?.sentences[0]);
  expect(sentences?.[1]?.uk).toBe("Два.");
  expect(sentences?.[1]?.ru).toBe(exact);

  const capped = applyUploadTranslations(book([{ id: "s1", en: "One.", uk: "", ru: "" }]), {
    again: false,
    sentences: [{ id: "s1", uk: `  ${exact}  `, ru: exact }],
  });
  expect(capped.ok).toBe(true);
  if (!capped.ok) return;
  const saved = (capped.body as ReturnType<typeof book>).chapters[0]?.sentences[0];
  expect(saved?.uk).toBe(exact);
  expect(saved?.ru).toBe(exact);
  expect(capped.alignment).toBe("ready");

  const onlyLong = applyUploadTranslations(stored, {
    again: true,
    sentences: [{ id: "s1", uk: long, ru: long }],
  });
  expect(onlyLong.ok).toBe(true);
  if (!onlyLong.ok) return;
  expect(onlyLong.body).toBe(stored);
});
