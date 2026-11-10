import { useState, type FormEvent } from "react";

import { importAdminCatalogFile, type AdminFailure } from "#/admin/api";
import { Button } from "#/components/ui/button";
import { Field, Input } from "#/components/ui/field";
import { Notice } from "#/components/ui/notice";
import { message } from "#/i18n/messages";
import type { Locale } from "#/i18n/types";

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
      <Field
        id="catalog-import"
        label={message(locale, "importFile")}
        hint={message(locale, "importHint")}
      >
        <Input name="catalog-import" type="file" accept=".2books" disabled={locked} />
      </Field>
      {errorMessage ? <Notice tone="danger">{errorMessage}</Notice> : null}
      <div>
        <Button type="submit" disabled={locked} busy={pending}>
          {message(locale, "importAction")}
        </Button>
      </div>
    </form>
  );
}
