import { beforeAll, expect, test } from "vite-plus/test";

const storageKey = "2books.words";
const memory = new Map<string, string>();
const storageListeners = new Set<(event: { key: string | null; storageArea: object }) => void>();

const localStorageMock = {
  getItem(key: string) {
    return memory.get(key) ?? null;
  },
  setItem(key: string, value: string) {
    memory.set(key, value);
  },
  removeItem(key: string) {
    memory.delete(key);
  },
  clear() {
    memory.clear();
  },
  key() {
    return null;
  },
  get length() {
    return memory.size;
  },
};

const windowMock = {
  addEventListener(
    type: string,
    listener: (event: { key: string | null; storageArea: object }) => void,
  ) {
    if (type === "storage") storageListeners.add(listener);
  },
  removeEventListener() {},
  dispatchEvent(event: Event & { key?: string | null; storageArea?: object }) {
    if (event.type === "storage") {
      for (const listener of storageListeners) {
        listener({
          key: event.key ?? null,
          storageArea: event.storageArea ?? localStorageMock,
        });
      }
    }
    return true;
  },
};

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  configurable: true,
});
Object.defineProperty(globalThis, "window", { value: windowMock, configurable: true });

type Sync = typeof import("./word-sync");
type Call = { method: string; body: string | null; resolve: (response: Response) => void };

let sync: Sync;

beforeAll(async () => {
  sync = await import("./word-sync");
});

function row(word: string, savedAt: number) {
  return {
    word,
    gloss: word,
    nativeLanguage: "uk" as const,
    savedAt,
    sentenceEn: `${word} sentence.`,
    sentenceNative: word,
  };
}

function body(words: ReturnType<typeof row>[]) {
  return JSON.stringify({ words, tombstones: [] });
}

function json(status: number, value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function until(check: () => boolean): Promise<void> {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > 2000) throw new Error("timed out");
    await delay(15);
  }
}

function installFetch() {
  const calls: Call[] = [];
  globalThis.fetch = (async (_input: unknown, init?: RequestInit) =>
    new Promise<Response>((resolve) => {
      calls.push({
        method: init?.method ?? "GET",
        body: typeof init?.body === "string" ? init.body : null,
        resolve,
      });
    })) as typeof fetch;
  return calls;
}

test("an in-flight put keeps a word saved in another tab", async () => {
  memory.clear();
  localStorage.setItem(storageKey, body([row("dollar", 1)]));
  const calls = installFetch();
  sync.scheduleWordSync("reader-a");
  await until(() => calls.length === 1);
  calls[0]?.resolve(json(200, { words: [], tombstones: [] }));
  await until(() => calls.length === 2);
  localStorage.setItem(storageKey, body([row("dollar", 1), row("penny", 5)]));
  window.dispatchEvent(
    Object.assign(new Event("storage"), { key: storageKey, storageArea: localStorage }),
  );
  calls[1]?.resolve(json(200, JSON.parse(calls[1]?.body ?? "null")));
  await until(() => calls.length === 3);
  expect(calls[2]?.body).toContain("penny");
  calls[2]?.resolve(json(200, JSON.parse(calls[2]?.body ?? "null")));
  await until(() => localStorage.getItem("2books.words.owner") === "reader-a");
  expect(localStorage.getItem(storageKey)).toContain("penny");
  sync.scheduleWordSync(null);
});

test("a save during a 401 is uploaded on the next attempt", async () => {
  memory.clear();
  localStorage.setItem(storageKey, body([row("dollar", 1)]));
  const calls = installFetch();
  sync.scheduleWordSync("reader-b");
  await until(() => calls.length === 1);
  localStorage.setItem(storageKey, body([row("dollar", 1), row("penny", 5)]));
  sync.bumpWordGeneration();
  sync.flushWordSync();
  calls[0]?.resolve(json(401, { error: "anonymous" }));
  await until(() => calls.length >= 2);
  expect(sync.wordSyncFailed()).toBe(false);
  expect(localStorage.getItem(storageKey)).toContain("penny");
  expect(calls[1]?.method).toBe("GET");
  calls[1]?.resolve(json(200, { words: [], tombstones: [] }));
  await until(() => calls.some((call) => call.method === "PUT"));
  const put = calls.find((call) => call.method === "PUT");
  expect(put?.body).toContain("penny");
  put?.resolve(json(200, JSON.parse(put.body ?? "null")));
  await until(() => sync.wordSyncFailed() === false);
  sync.scheduleWordSync(null);
});

test("a 401 with no newer edit does not sync again", async () => {
  memory.clear();
  localStorage.setItem(storageKey, body([row("dollar", 1)]));
  const calls = installFetch();
  sync.scheduleWordSync("reader-c");
  await until(() => calls.length === 1);
  calls[0]?.resolve(json(401, { error: "anonymous" }));
  await delay(500);
  expect(calls.length).toBe(1);
  expect(sync.wordSyncFailed()).toBe(false);
  expect(localStorage.getItem(storageKey)).toContain("dollar");
  sync.scheduleWordSync(null);
});

test("a different account replaces local words and drops the google key", async () => {
  memory.clear();
  localStorage.setItem(
    storageKey,
    JSON.stringify({ words: [row("secret", 9)], tombstones: [], owner: "ignored" }),
  );
  localStorage.setItem("2books.words.owner", "reader-a");
  localStorage.setItem("2books.googleTranslateKey", "paid-key");
  const calls = installFetch();
  sync.scheduleWordSync("reader-b");
  await until(() => calls.length === 1);
  expect(calls[0]?.method).toBe("GET");
  expect(localStorage.getItem(storageKey) ?? "").toContain("secret");
  expect(localStorage.getItem("2books.googleTranslateKey")).toBe("paid-key");
  calls[0]?.resolve(json(200, { words: [row("beta", 2)], tombstones: [] }));
  await until(() => localStorage.getItem("2books.googleTranslateKey") === null);
  expect(localStorage.getItem(storageKey) ?? "").not.toContain("secret");
  expect(localStorage.getItem("2books.words.owner")).toBe("reader-b");
  await until(() => (localStorage.getItem(storageKey) ?? "").includes("beta"));
  await delay(400);
  expect(calls.some((call) => call.method === "PUT")).toBe(false);
  expect(localStorage.getItem(storageKey)).not.toContain("secret");
  expect(localStorage.getItem("2books.words.owner")).toBe("reader-b");
  sync.scheduleWordSync(null);
});

test("a matching remote list is not uploaded again", async () => {
  memory.clear();
  const stored = { words: [row("dollar", 1)], tombstones: [] };
  localStorage.setItem(storageKey, JSON.stringify(stored));
  const calls = installFetch();
  sync.scheduleWordSync("reader-same");
  await until(() => calls.length === 1);
  calls[0]?.resolve(json(200, stored));
  await delay(400);
  expect(calls.some((call) => call.method === "PUT")).toBe(false);
  expect(sync.wordSyncFailed()).toBe(false);
  expect(localStorage.getItem(storageKey)).toContain("dollar");
  sync.scheduleWordSync(null);
});

test("signing out clears a failed sync", async () => {
  memory.clear();
  localStorage.setItem(storageKey, body([row("dollar", 1)]));
  const calls = installFetch();
  sync.scheduleWordSync("reader-fail");
  await until(() => calls.length === 1);
  calls[0]?.resolve(json(500, { error: "unavailable" }));
  await until(() => sync.wordSyncFailed());
  sync.scheduleWordSync(null);
  expect(sync.wordSyncFailed()).toBe(false);
});

test("sign-out keeps words until a different account signs in", () => {
  memory.clear();
  localStorage.setItem(storageKey, body([row("dollar", 1)]));
  localStorage.setItem("2books.words.owner", "reader-a");
  localStorage.setItem("2books.googleTranslateKey", "paid-key");
  sync.scheduleWordSync(null);
  expect(localStorage.getItem(storageKey)).toContain("dollar");
  expect(localStorage.getItem("2books.words.owner")).toBe("reader-a");
  expect(localStorage.getItem("2books.googleTranslateKey")).toBe("paid-key");
});

test("clearLocalStudyData removes words, the owner, and the google key", () => {
  memory.clear();
  localStorage.setItem(storageKey, body([row("dollar", 1)]));
  localStorage.setItem("2books.words.owner", "reader-a");
  localStorage.setItem("2books.googleTranslateKey", "paid-key");
  sync.clearLocalStudyData();
  expect(localStorage.getItem(storageKey)).toBeNull();
  expect(localStorage.getItem("2books.words.owner")).toBeNull();
  expect(localStorage.getItem("2books.googleTranslateKey")).toBeNull();
  sync.scheduleWordSync("reader-a");
  sync.scheduleWordSync(null);
});
