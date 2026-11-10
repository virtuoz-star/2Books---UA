import { apiBase, DOWNLOAD_IDLE_TIMEOUT_MS, startIdleTimeout } from "@/lib/api";
import { ARCHIVE_LIMIT } from "@/lib/local-plan";

const catalogId = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function catalogDownloadName(bookId: string): string | null {
  if (bookId.length < 1 || bookId.length > 80 || !catalogId.test(bookId)) return null;
  return `${bookId}.2books`;
}

type DownloadFailure = {
  ok: false;
  error: "http" | "oversize" | "invalid-input" | "reserved-id" | "io";
};

export function resultAfterImport(
  imported: { ok: true; id: string } | DownloadFailure,
  aborted: boolean,
): { ok: true; id: string } | DownloadFailure {
  if (imported.ok) return imported;
  if (aborted) return { ok: false, error: "http" };
  return imported;
}

export function downloadLengthDecision(
  contentLength: number | null,
): "read" | "reject" | "missing" {
  if (contentLength === null || !Number.isFinite(contentLength)) return "missing";
  if (contentLength > ARCHIVE_LIMIT) return "reject";
  return "read";
}

export async function downloadCatalogBook(input: {
  bookId: string;
  lang: "uk" | "ru";
  signal: AbortSignal;
}): Promise<
  | { ok: true; id: string }
  | { ok: false; error: "http" | "oversize" | "invalid-input" | "reserved-id" | "io" }
> {
  const name = catalogDownloadName(input.bookId);
  if (name === null) return { ok: false, error: "http" };
  if (input.signal.aborted) return { ok: false, error: "http" };
  const idle = startIdleTimeout(DOWNLOAD_IDLE_TIMEOUT_MS);
  const signal = AbortSignal.any([input.signal, idle.signal]);
  try {
    let response: Response;
    try {
      response = await fetch(
        `${apiBase()}/api/books/${encodeURIComponent(input.bookId)}/download?lang=${input.lang}`,
        {
          method: "GET",
          credentials: "omit",
          cache: "no-store",
          headers: { accept: "application/octet-stream" },
          signal,
        },
      );
      idle.activity();
    } catch {
      if (input.signal.aborted) return { ok: false, error: "http" };
      console.error("catalog-download", "http");
      return { ok: false, error: "http" };
    }
    if (input.signal.aborted) {
      await cancelBody(response);
      return { ok: false, error: "http" };
    }
    if (response.status !== 200) {
      await cancelBody(response);
      console.error("catalog-download", "http");
      return { ok: false, error: "http" };
    }
    const bytes = await readBounded(response, signal, input.signal, idle.activity);
    if (bytes === "aborted") return { ok: false, error: "http" };
    if (bytes === "http" || bytes === "oversize") return { ok: false, error: bytes };
    if (input.signal.aborted) return { ok: false, error: "http" };
    try {
      const { File, Paths } = await import("expo-file-system");
      const { importLocalBook } = await import("@/lib/local-library");
      const file = new File(Paths.cache, name);
      if (file.exists) file.delete();
      file.create({ intermediates: true });
      await file.write(bytes);
      if (input.signal.aborted) {
        if (file.exists) file.delete();
        return { ok: false, error: "http" };
      }
      const imported = await importLocalBook({
        uri: file.uri,
        name,
        size: bytes.byteLength,
        deleteAfter: true,
      });
      return resultAfterImport(imported, input.signal.aborted);
    } catch {
      if (input.signal.aborted) return { ok: false, error: "http" };
      return { ok: false, error: "io" };
    }
  } finally {
    idle.stop();
  }
}

async function cancelBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // The caller already chose the result.
  }
}

function headerLength(response: Response): number | null {
  const raw = response.headers.get("content-length");
  if (raw === null) return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  return value;
}

async function readBounded(
  response: Response,
  signal: AbortSignal,
  userSignal: AbortSignal,
  activity: () => void,
): Promise<Uint8Array | "http" | "oversize" | "aborted"> {
  const decision = downloadLengthDecision(headerLength(response));
  if (decision === "reject") {
    await cancelBody(response);
    console.error("catalog-download", "oversize");
    return "oversize";
  }
  const stopped = (): "aborted" | "http" => (userSignal.aborted ? "aborted" : "http");
  const body = response.body;
  if (body !== null && typeof body.getReader === "function") {
    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      for (;;) {
        if (signal.aborted) {
          await reader.cancel();
          return stopped();
        }
        activity();
        const step = await reader.read();
        activity();
        if (step.done) break;
        total += step.value.byteLength;
        if (total > ARCHIVE_LIMIT) {
          await reader.cancel();
          console.error("catalog-download", "oversize");
          return "oversize";
        }
        chunks.push(step.value);
      }
    } catch {
      if (userSignal.aborted) return "aborted";
      console.error("catalog-download", "http");
      return "http";
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  }
  if (decision === "missing") {
    console.error("catalog-download", "http");
    return "http";
  }
  try {
    activity();
    const buffer = await response.arrayBuffer();
    activity();
    if (userSignal.aborted) return "aborted";
    if (signal.aborted) return stopped();
    if (buffer.byteLength > ARCHIVE_LIMIT) {
      console.error("catalog-download", "oversize");
      return "oversize";
    }
    return new Uint8Array(buffer);
  } catch {
    if (userSignal.aborted) return "aborted";
    console.error("catalog-download", "http");
    return "http";
  }
}
