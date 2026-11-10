import { apiBase, JSON_TIMEOUT_MS, syncFailureAfterUserChange, withTimeout } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { syncPlan } from "@/lib/word-sync-plan";
import {
  mergeWordStores,
  parseSavedWordStore,
  type SavedWordStore,
} from "../../../src/dictionary/saved-words";

let generation = 0;
let userId: string | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;
let failed = false;
let hold = false;
let rerun = false;
const listeners = new Set<() => void>();
const minSyncIntervalMs = 5 * 60 * 1000;
let lastSyncStarted = 0;

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

export function bumpWordGeneration(): void {
  generation += 1;
}

export function currentWordGeneration(): number {
  return generation;
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
  const changed = nextUserId !== userId;
  userId = nextUserId;
  if (changed) hold = false;
  const nextFailed = syncFailureAfterUserChange(changed, failed);
  if (nextFailed !== failed) setFailed(nextFailed);
  if (nextUserId === null) {
    clearTimer();
    return;
  }
  if (!changed && lastSyncStarted !== 0 && Date.now() - lastSyncStarted < minSyncIntervalMs) return;
  enqueue();
}

/** Foreground sync. Same account inside the minimum interval does not start another pipeline. */
export function syncOnForeground(): void {
  if (userId === null || hold) return;
  if (lastSyncStarted !== 0 && Date.now() - lastSyncStarted < minSyncIntervalMs) return;
  enqueue();
}

export function flushWordSync(): void {
  hold = false;
  lastSyncStarted = 0;
  enqueue();
}

type Loaded =
  | { ok: true; store: SavedWordStore }
  | { ok: false; status: number | "network" | "anonymous" };

async function request(method: "GET" | "PUT", store?: SavedWordStore): Promise<Loaded> {
  try {
    const cookie = await authClient.getCookie();
    const headers: Record<string, string> = { accept: "application/json" };
    if (cookie) headers.cookie = cookie;
    if (method === "PUT") headers["content-type"] = "application/json";
    const signal = withTimeout(undefined, JSON_TIMEOUT_MS);
    const response =
      method === "PUT"
        ? await fetch(`${apiBase()}/api/words`, {
            method: "PUT",
            headers,
            credentials: "omit",
            cache: "no-store",
            body: JSON.stringify(store),
            signal,
          })
        : await fetch(`${apiBase()}/api/words`, {
            method: "GET",
            headers,
            credentials: "omit",
            cache: "no-store",
            signal,
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

async function readLocal(): Promise<SavedWordStore> {
  const store = await import("@/lib/saved-words-store");
  return store.readSavedWordStore();
}

async function replaceIfCurrent(store: SavedWordStore, at: number): Promise<boolean> {
  const file = await import("@/lib/saved-words-store");
  return file.replaceSavedWordStoreIfCurrent(store, at);
}

async function runPipeline(): Promise<void> {
  if (running || userId === null || hold) return;
  running = true;
  rerun = false;
  lastSyncStarted = Date.now();
  try {
    const remote = await request("GET");
    if (userId === null) return;
    if (!remote.ok) {
      if (remote.status !== "anonymous") setFailed(true);
      return;
    }
    const local = await readLocal();
    const plan = syncPlan(local, remote.store);
    if (plan.action === "skip") {
      setFailed(false);
      rerun = false;
      return;
    }
    if (plan.action === "write-local") {
      const wrote = await replaceIfCurrent(plan.merged, generation);
      if (!wrote) rerun = true;
      else {
        setFailed(false);
        rerun = false;
      }
      return;
    }
    let payload = plan.merged;
    let puts = 0;
    while (puts < 3) {
      if (userId === null) return;
      const builtAt = generation;
      const saved = await request("PUT", payload);
      puts += 1;
      if (userId === null) return;
      if (!saved.ok) {
        if (saved.status !== "anonymous") setFailed(true);
        return;
      }
      const wrote = await replaceIfCurrent(saved.store, builtAt);
      if (!wrote) {
        if (puts >= 3) {
          hold = true;
          clearTimer();
          setFailed(true);
          return;
        }
        payload = mergeWordStores(await readLocal(), saved.store);
        continue;
      }
      setFailed(false);
      rerun = false;
      return;
    }
  } finally {
    running = false;
    const again = rerun;
    rerun = false;
    if (again && userId !== null && !hold) enqueue();
  }
}
