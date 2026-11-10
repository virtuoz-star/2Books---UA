import {
  mergeWordStores,
  parseSavedWordStore,
  type SavedWordStore,
} from "../../../src/dictionary/saved-words";

export type SyncPlan =
  | { action: "skip" }
  | { action: "write-local" | "put"; merged: SavedWordStore };

function sameStore(left: SavedWordStore, right: SavedWordStore): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/** Skip the PUT when the merge already matches the server, and the file write when it matches disk. */
export function syncPlan(local: SavedWordStore, remote: SavedWordStore): SyncPlan {
  const merged = mergeWordStores(local, remote);
  const sameRemote = sameStore(merged, parseSavedWordStore(remote));
  const sameLocal = sameStore(merged, parseSavedWordStore(local));
  if (sameRemote && sameLocal) return { action: "skip" };
  if (sameRemote) return { action: "write-local", merged };
  return { action: "put", merged };
}
