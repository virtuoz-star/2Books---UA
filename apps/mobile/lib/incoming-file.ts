export type IncomingFile = {
  uri: string;
  name: string | null;
  onReadSettled?: () => void;
};

type Listener = () => void;

const queue: IncomingFile[] = [];
const listeners = new Set<Listener>();

export function enqueueIncoming(file: IncomingFile): void {
  queue.push(file);
  for (const listener of listeners) listener();
}

export function takeIncoming(): IncomingFile | null {
  return queue.shift() ?? null;
}

export function hasIncoming(): boolean {
  return queue.length > 0;
}

export function subscribeIncoming(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * A share is queued only after name resolution has been seen, or after one extra pass
 * once resolution has finished or failed. The first paint must not mark the URI seen.
 */
export function incomingShareAction(input: {
  empty: boolean;
  isResolving: boolean;
  sawResolving: boolean;
  pass: number;
}): "clear" | "wait" | "enqueue" {
  if (input.empty) return "clear";
  if (input.isResolving) return "wait";
  if (input.sawResolving || input.pass > 0) return "enqueue";
  return "wait";
}
