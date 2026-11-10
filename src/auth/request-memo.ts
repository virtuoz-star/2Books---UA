export type RequestMemo<Key extends object, Value> = {
  read: (key: Key) => Promise<Value>;
  forget: (key: Key) => void;
};

// Remembers one read per key so that several callers inside one HTTP request
// share a single lookup. Keys are held weakly: the entry goes away with the
// request object, and nothing is shared between two requests.
export function createRequestMemo<Key extends object, Value>(
  load: (key: Key) => Promise<Value>,
): RequestMemo<Key, Value> {
  const reads = new WeakMap<Key, Promise<Value>>();

  function forget(key: Key): void {
    reads.delete(key);
  }

  function read(key: Key): Promise<Value> {
    const known = reads.get(key);
    if (known) return known;
    const pending = (async () => load(key))();
    reads.set(key, pending);
    // A failed read is not remembered, so the next caller tries again.
    pending.catch(() => {
      if (reads.get(key) === pending) reads.delete(key);
    });
    return pending;
  }

  return { read, forget };
}
