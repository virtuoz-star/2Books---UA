import { googleTranslateEndpoint, readTranslations } from "./google-translate";

export type GoogleTranslateResult =
  | { ok: true; rows: ({ text: string } | { text: null })[] }
  | { ok: false; status: number | "network" | "aborted" };

function linkedSignal(input: {
  signal: AbortSignal;
  timeoutMs: number;
}): { signal: AbortSignal; cleanup: () => void } {
  const anySignal = AbortSignal.any;
  const timeoutSignal = AbortSignal.timeout;
  if (typeof anySignal === "function" && typeof timeoutSignal === "function") {
    return {
      signal: anySignal.call(AbortSignal, [input.signal, timeoutSignal.call(AbortSignal, input.timeoutMs)]),
      cleanup: () => {},
    };
  }
  const controller = new AbortController();
  const onAbort = () => {
    controller.abort();
  };
  if (input.signal.aborted) controller.abort();
  else input.signal.addEventListener("abort", onAbort);
  const timer = setTimeout(() => {
    controller.abort();
  }, input.timeoutMs);
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      input.signal.removeEventListener("abort", onAbort);
    },
  };
}

export async function postGoogleTranslate(input: {
  key: string;
  q: readonly string[];
  target: "uk" | "ru";
  signal: AbortSignal;
  timeoutMs: number;
}): Promise<GoogleTranslateResult> {
  let cleanup = () => {};
  try {
    const linked = linkedSignal(input);
    cleanup = linked.cleanup;
    const response = await fetch(googleTranslateEndpoint(input.key), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        q: input.q,
        source: "en",
        target: input.target,
        format: "text",
      }),
      signal: linked.signal,
    });
    if (!response.ok) {
      console.error("google-translate", response.status);
      return { ok: false, status: response.status };
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      console.error("google-translate", response.status);
      return { ok: false, status: response.status };
    }
    const rows = readTranslations(body, input.q.length);
    if (rows === null) {
      console.error("google-translate", response.status);
      return { ok: false, status: response.status };
    }
    return { ok: true, rows };
  } catch {
    if (input.signal.aborted) return { ok: false, status: "aborted" };
    console.error("google-translate", "network");
    return { ok: false, status: "network" };
  } finally {
    cleanup();
  }
}
