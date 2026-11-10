import { writeGoogleTranslateKey } from "./google-key";
import { mergeWordStores, parseSavedWordStore, type SavedWordStore } from "./saved-words";

const storageKey = "2books.words";
const ownerKey = "2books.words.owner";

let generation = 0;
let ownGeneration = 0;
let userId: string | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;
let failed = false;
let hold = false;
let rerun = false;
let listening = false;
let wiped = false;
const listeners = new Set<() => void>();

export function wordSyncFailed(): boolean {
  return failed;
}

export function subscribeWordSync(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(): void {
  for (const listener of listeners) listener();
}

function setFailed(next: boolean): void {
  if (failed === next) return;
  failed = next;
  emit();
}

function readStore(): SavedWordStore {
  try {
    return parseSavedWordStore(JSON.parse(localStorage.getItem(storageKey) ?? "null"));
  } catch {
    return parseSavedWordStore(null);
  }
}

function writeStore(store: SavedWordStore): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(store));
    window.dispatchEvent(new Event("2books-words"));
  } catch {
    // A blocked store must not reject the sync.
  }
}

function readOwner(): string | null {
  try {
    const owner = localStorage.getItem(ownerKey)?.trim() ?? "";
    return owner.length > 0 ? owner : null;
  } catch {
    return null;
  }
}

function writeOwner(owner: string): void {
  localStorage.setItem(ownerKey, owner);
}

/** Removes this device's saved words, their owner, and the Google translation key. */
export function clearLocalStudyData(): void {
  wiped = true;
  generation += 1;
  ownGeneration += 1;
  try {
    localStorage.removeItem(storageKey);
    localStorage.removeItem(ownerKey);
    writeGoogleTranslateKey("");
  } catch {
    // The device store is already unavailable.
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event("2books-words"));
}

export function bumpWordGeneration(): void {
  generation += 1;
  ownGeneration += 1;
}

function noteOtherTab(): void {
  generation += 1;
}

function onStorage(event: StorageEvent): void {
  if (
    typeof localStorage !== "undefined" &&
    event.storageArea &&
    event.storageArea !== localStorage
  ) {
    return;
  }
  if (event.key !== null && event.key !== storageKey) return;
  noteOtherTab();
}

function listenForOtherTabs(): void {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("storage", onStorage);
}

function clearTimer(): void {
  if (timer === null) return;
  clearTimeout(timer);
  timer = null;
}

function enqueue(): void {
  if (userId === null || hold) return;
  if (running) {
    rerun = true;
    return;
  }
  clearTimer();
  timer = setTimeout(() => {
    timer = null;
    void runPipeline();
  }, 300);
}

export function scheduleWordSync(nextUserId: string | null): void {
  listenForOtherTabs();
  const changed = nextUserId !== userId;
  userId = nextUserId;
  if (nextUserId !== null) wiped = false;
  if (nextUserId === null) {
    clearTimer();
    if (changed) hold = false;
    setFailed(false);
    return;
  }
  if (changed) hold = false;
  enqueue();
}

export function flushWordSync(): void {
  listenForOtherTabs();
  hold = false;
  enqueue();
}

export function settleWordSync(): Promise<void> {
  flushWordSync();
  const started = Date.now();
  return new Promise((resolve) => {
    const tick = () => {
      if ((!running && timer === null) || Date.now() - started > 4_000) resolve();
      else setTimeout(tick, 40);
    };
    tick();
  });
}

type Loaded =
  | { ok: true; store: SavedWordStore }
  | { ok: false; status: number | "network" | "anonymous" };

async function request(method: "GET" | "PUT", store?: SavedWordStore): Promise<Loaded> {
  try {
    const response =
      method === "PUT"
        ? await fetch("/api/words", {
            method: "PUT",
            credentials: "same-origin",
            cache: "no-store",
            headers: { accept: "application/json", "content-type": "application/json" },
            body: JSON.stringify(store),
          })
        : await fetch("/api/words", {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",
            headers: { accept: "application/json" },
          });
    if (response.status === 401) return { ok: false, status: "anonymous" };
    if (!response.ok) return { ok: false, status: response.status };
    const body: unknown = await response.json();
    if (!Array.isArray(body) && (typeof body !== "object" || body === null || !("words" in body))) {
      return { ok: false, status: response.status };
    }
    return { ok: true, store: parseSavedWordStore(body) };
  } catch {
    return { ok: false, status: "network" };
  }
}

async function runPipeline(): Promise<void> {
  if (running || userId === null || hold || wiped) return;
  running = true;
  rerun = false;
  const signedIn = userId;
  try {
    const switching = readOwner() !== null && readOwner() !== signedIn;
    const remote = await request("GET");
    if (userId !== signedIn || wiped) return;
    if (!remote.ok) {
      if (remote.status !== "anonymous") setFailed(true);
      return;
    }
    if (switching) {
      writeGoogleTranslateKey("");
      writeStore({ words: [], tombstones: [] });
    }
    writeOwner(signedIn);
    let payload = mergeWordStores(readStore(), remote.store);
    if (JSON.stringify(payload) === JSON.stringify(remote.store)) {
      writeStore(remote.store);
      setFailed(false);
      return;
    }
    let puts = 0;
    while (puts < 3) {
      if (userId === null) return;
      const builtAt = generation;
      const ownAt = ownGeneration;
      const saved = await request("PUT", payload);
      puts += 1;
      if (userId !== signedIn || wiped) return;
      if (!saved.ok) {
        if (saved.status !== "anonymous") setFailed(true);
        return;
      }
      // A completed PUT means this account synced, even if a newer edit still needs another pass.
      writeOwner(signedIn);
      if (generation !== builtAt) {
        if (puts >= 3 && ownGeneration !== ownAt) {
          hold = true;
          clearTimer();
          setFailed(true);
          return;
        }
        if (puts >= 3) {
          rerun = true;
          return;
        }
        payload = mergeWordStores(readStore(), saved.store);
        continue;
      }
      writeStore(saved.store);
      setFailed(false);
      rerun = false;
      return;
    }
  } finally {
    running = false;
    const switched = userId !== null && userId !== signedIn;
    const again = (rerun || switched) && !wiped;
    rerun = false;
    if (again && userId !== null && !hold) enqueue();
  }
}
