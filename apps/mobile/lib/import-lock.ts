type Listener = () => void;

let chain: Promise<void> = Promise.resolve();
let depth = 0;
const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function isImportLocked(): boolean {
  return depth > 0;
}

export function subscribeImportLock(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function runImport<T>(task: () => Promise<T>): Promise<T> {
  depth += 1;
  notify();
  const run = chain.then(async () => {
    try {
      return await task();
    } finally {
      depth -= 1;
      notify();
    }
  });
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
