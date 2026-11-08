import { useState, type FormEvent } from "react";

import { importAdminCatalogFile, type AdminFailure } from "#/admin/api";
import { message } from "#/i18n/messages";
import type { Locale } from "#/i18n/types";

const fieldClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";
const primaryClass =
  "cursor-pointer rounded-md border-0 bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:cursor-default disabled:opacity-60";

const maxArchiveBytes = 25_000_000;

function importError(locale: Locale, error: AdminFailure | null): string | null {
  if (error === "invalid-input") return message(locale, "importFailed");
  if (error === "reserved-id") return message(locale, "reservedId");
  if (error === "duplicate") return message(locale, "duplicateBook");
  if (error === null) return null;
  return message(locale, "actionFailed");
}

async function fileBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const size = 0x8000;
  for (let index = 0; index < bytes.length; index += size) {
    binary += String.fromCharCode(...bytes.subarray(index, index + size));
  }
  return btoa(binary);
}

export function CatalogImport({
  locale,
  disabled,
  onImported,
}: {
  locale: Locale;
  disabled: boolean;
  onImported: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<AdminFailure | null>(null);
  const locked = disabled || pending;
  const errorMessage = importError(locale, error);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked) return;
    const input = event.currentTarget.elements.namedItem("catalog-import");
    const file = input instanceof HTMLInputElement ? input.files?.[0] : undefined;
    if (!file || file.size < 1 || file.size > maxArchiveBytes) {
      setError("invalid-input");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await importAdminCatalogFile({ data: { fileBase64: await fileBase64(file) } });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (input instanceof HTMLInputElement) input.value = "";
      await onImported();
    } catch {
      setError("unavailable");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-3">
      <label
        htmlFor="catalog-import"
        className="flex flex-col gap-1.5 text-sm font-medium text-foreground"
      >
        {message(locale, "importFile")}
        <input
          id="catalog-import"
          name="catalog-import"
          type="file"
          accept=".2books"
          disabled={locked}
          className={fieldClass}
        />
      </label>
      <p className="text-sm text-muted-foreground">{message(locale, "importHint")}</p>
      {errorMessage ? (
        <p role="alert" className="text-sm text-foreground">
          {errorMessage}
        </p>
      ) : null}
      <div>
        <button type="submit" disabled={locked} className={primaryClass}>
          {message(locale, "importFile")}
        </button>
      </div>
    </form>
  );
}
