import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { crc32 } from "node:zlib";

import { expect, test } from "vite-plus/test";

import { giftOfTheMagi } from "#/content/gift-of-the-magi";
import type { Book } from "#/content/catalog";
import { parseTwoBooks } from "#/library/two-books";
import { downloadSlug, writeTwoBooks, writeTwoBooksPrefer } from "#/library/two-books-write";

function readU16(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);
}

function readU32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) |
      ((bytes[offset + 1] ?? 0) << 8) |
      ((bytes[offset + 2] ?? 0) << 16) |
      ((bytes[offset + 3] ?? 0) << 24)) >>>
    0
  );
}

function assertZip(bytes: Uint8Array): void {
  let cursor = 0;
  const entries: { name: string; method: number; crc: number; data: Uint8Array }[] = [];
  while (cursor + 4 <= bytes.length && readU32(bytes, cursor) === 0x04034b50) {
    const flags = readU16(bytes, cursor + 6);
    const method = readU16(bytes, cursor + 8);
    const crc = readU32(bytes, cursor + 14);
    const compressedSize = readU32(bytes, cursor + 18);
    const uncompressedSize = readU32(bytes, cursor + 22);
    const nameLength = readU16(bytes, cursor + 26);
    const extraLength = readU16(bytes, cursor + 28);
    const nameStart = cursor + 30;
    const name = new TextDecoder().decode(bytes.subarray(nameStart, nameStart + nameLength));
    const dataStart = nameStart + nameLength + extraLength;
    const data = bytes.subarray(dataStart, dataStart + compressedSize);
    expect(flags).toBe(0);
    expect(crc).not.toBe(0);
    expect(uncompressedSize).toBeGreaterThan(0);
    if (name.endsWith(".json.gz")) {
      expect(method).toBe(0);
      expect(compressedSize).toBe(uncompressedSize);
      expect(crc).toBe(crc32(data) >>> 0);
      expect(data[0]).toBe(0x1f);
      expect(data[1]).toBe(0x8b);
    } else {
      expect(method).toBe(8);
    }
    entries.push({ name, method, crc, data });
    cursor = dataStart + compressedSize;
  }
  expect(entries.map((entry) => entry.name)).toContain("meta.json");
  expect(entries.some((entry) => entry.name.endsWith(".json.gz"))).toBe(true);
  const directory = mkdtempSync(join(tmpdir(), "two-books-"));
  const file = join(directory, "book.2books");
  try {
    writeFileSync(file, bytes);
    execFileSync("python3", [
      "-c",
      "import sys, zipfile; z = zipfile.ZipFile(sys.argv[1]); bad = z.testzip(); assert bad is None, bad; meta = z.read('meta.json'); assert meta.startswith(b'{')",
      file,
    ]);
    execFileSync("unzip", ["-t", file], { stdio: "pipe" });
    const opened = execFileSync("python3", [
      "-c",
      "import sys, zipfile; z = zipfile.ZipFile(sys.argv[1]); print('\\n'.join(info.filename + ' ' + format(info.CRC, '08x') for info in z.infolist()))",
      file,
    ])
      .toString()
      .trim()
      .split("\n");
    for (const line of opened) {
      const [name, crc] = line.split(" ");
      const entry = entries.find((item) => item.name === name);
      expect(entry).toBeDefined();
      expect(crc).toBe(entry?.crc.toString(16).padStart(8, "0"));
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

const redBoat: Book = {
  id: "red-boat",
  author: "A. Writer",
  title: { en: "Red Boat", uk: "Червоний човен", ru: "Красная лодка" },
  chapters: [
    {
      id: "c1",
      title: { en: "Gate", uk: "Брама", ru: "Ворота" },
      sentences: [
        { id: "s1", en: "Hello there.", uk: "Привіт там.", ru: "Привет там.", paragraph: 0 },
        { id: "s2", en: "Skip me.", uk: "", ru: "", paragraph: 0 },
        { id: "s3", en: "Next line.", uk: "Далі рядок.", ru: "Дальше строка.", paragraph: 1 },
      ],
    },
  ],
};

test("a downloaded book keeps English and the chosen translation", async () => {
  const bytes = await writeTwoBooks(redBoat, "uk");
  expect(bytes).not.toBeNull();
  if (bytes === null) return;
  const parsed = await parseTwoBooks(bytes);
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) return;
  expect(parsed.book.id).toBe("red-boat");
  expect(parsed.book.author).toBe("A. Writer");
  expect(parsed.book.title).toEqual({
    en: "Red Boat",
    uk: "Червоний човен",
    ru: "Red Boat",
  });
  expect(parsed.book.chapters[0]?.sentences).toEqual([
    {
      id: "s1",
      en: "Hello there.",
      uk: "Привіт там.",
      ru: "",
      paragraph: 0,
    },
    {
      id: "s2",
      en: "Next line.",
      uk: "Далі рядок.",
      ru: "",
      paragraph: 1,
    },
  ]);
  const russianOnly: Book = {
    ...redBoat,
    chapters: [
      {
        id: "c1",
        title: redBoat.chapters[0]?.title ?? redBoat.title,
        sentences: [{ id: "s1", en: "Gate.", uk: "", ru: "Брама.", paragraph: 0 }],
      },
    ],
  };
  expect(await writeTwoBooks(russianOnly, "uk")).toBeNull();
  const fallback = await writeTwoBooksPrefer(russianOnly, "uk");
  expect(fallback).not.toBeNull();
  if (fallback === null) return;
  const fallbackBook = await parseTwoBooks(fallback);
  expect(fallbackBook.ok).toBe(true);
  if (!fallbackBook.ok) return;
  expect(fallbackBook.book.chapters[0]?.sentences[0]).toEqual({
    id: "s1",
    en: "Gate.",
    uk: "",
    ru: "Брама.",
    paragraph: 0,
  });
});

test("the bundled book downloads under a slug the reader can import", async () => {
  expect(downloadSlug("gift-of-the-magi")).toBe("gift-of-the-magi-reader");
  expect(downloadSlug("Not a slug")).toBeNull();
  const bytes = await writeTwoBooks(giftOfTheMagi, "ru");
  expect(bytes).not.toBeNull();
  if (bytes === null) return;
  const parsed = await parseTwoBooks(bytes);
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) return;
  const original = giftOfTheMagi.chapters.flatMap((chapter) => chapter.sentences);
  const exported = parsed.book.chapters.flatMap((chapter) => chapter.sentences);
  expect(parsed.book.id).toBe("gift-of-the-magi-reader");
  expect(parsed.book.author).toBe(giftOfTheMagi.author);
  expect(parsed.book.title.en).toBe(giftOfTheMagi.title.en);
  expect(parsed.book.title.ru).toBe(giftOfTheMagi.title.ru);
  expect(parsed.book.title.uk).toBe(giftOfTheMagi.title.en);
  expect(exported).toHaveLength(original.length);
  expect(exported[0]).toEqual({
    id: "s1",
    en: original[0]?.en,
    uk: "",
    ru: original[0]?.ru,
    paragraph: 0,
  });
  expect(exported.at(-1)?.en).toBe(original.at(-1)?.en);
  expect(exported.at(-1)?.ru).toBe(original.at(-1)?.ru);
  expect(parsed.book.chapters).toHaveLength(giftOfTheMagi.chapters.length);
  expect(parsed.book.chapters[0]?.title.en).toBe(giftOfTheMagi.chapters[0]?.title.en);
  assertZip(bytes);
});

test("a long chapter is split with a running size and the archive is a real zip", async () => {
  const sentence = "A".repeat(5_000);
  const translation = "Б".repeat(5_000);
  const book: Book = {
    id: "long-chapter",
    author: "A. Writer",
    title: { en: "Long", uk: "Довгий", ru: "Длинный" },
    chapters: [
      {
        id: "c1",
        title: { en: "Part", uk: "Частина", ru: "Часть" },
        sentences: Array.from({ length: 100 }, (_, index) => ({
          id: `s${index + 1}`,
          en: `${sentence} ${index}.`,
          uk: `${translation} ${index}.`,
          ru: `${translation} ${index}.`,
          paragraph: 0,
        })),
      },
    ],
  };
  const bytes = await writeTwoBooks(book, "uk");
  expect(bytes).not.toBeNull();
  if (bytes === null) return;
  assertZip(bytes);
  const parsed = await parseTwoBooks(bytes);
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) return;
  expect(parsed.book.chapters.length).toBeGreaterThan(1);
  expect(parsed.book.chapters.flatMap((chapter) => chapter.sentences)).toHaveLength(100);
});
