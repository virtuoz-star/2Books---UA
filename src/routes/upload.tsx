import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

import { getCurrentUser } from "#/auth/session";
import { message } from "#/i18n/messages";
import { uploadText } from "#/library/api";
import { useReaderSettings } from "#/reader/use-reader-settings";

export const Route = createFileRoute("/upload")({
  loader: () => getCurrentUser(),
  component: UploadPage,
});

const fieldClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";
const buttonClass =
  "cursor-pointer rounded-md border-0 bg-primary px-3 py-2 text-sm font-medium text-primary-foreground";

type UploadError = "anonymous" | "invalid-input" | "too-long" | "unavailable" | null;

function uploadMessage(locale: Parameters<typeof message>[0], error: UploadError): string | null {
  if (error === "too-long") return message(locale, "tooLong");
  if (error === "invalid-input") return message(locale, "invalidInput");
  if (error === "anonymous") return message(locale, "anonymous");
  return null;
}

function UploadPage() {
  const user = Route.useLoaderData();
  const navigate = useNavigate();
  const { settings } = useReaderSettings();
  const locale = settings.interfaceLocale;
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState<UploadError>(null);
  const [pending, setPending] = useState(false);
  const signedOut = user === null || error === "anonymous";
  const errorMessage = uploadMessage(locale, error);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await uploadText({ data: { title, text } });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await navigate({
        to: "/books/$bookId/$chapterId",
        params: { bookId: result.bookId, chapterId: "c1" },
      });
    } catch {
      setError("invalid-input");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex w-full max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold text-foreground">{message(locale, "uploadAction")}</h1>
      {signedOut ? (
        <div className="flex flex-col gap-4">
          <p className="text-base text-foreground">{message(locale, "anonymous")}</p>
          <Link to="/sign-in" className="text-sm text-foreground underline">
            {message(locale, "signIn")}
          </Link>
        </div>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={(event) => void onSubmit(event)}>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="upload-title" className="text-sm font-medium text-foreground">
              {message(locale, "uploadTitle")}
            </label>
            <input
              id="upload-title"
              name="title"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className={fieldClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="upload-text" className="text-sm text-muted-foreground">
              {message(locale, "uploadHint")}
            </label>
            <textarea
              id="upload-text"
              name="text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              className={`${fieldClass} min-h-48`}
            />
          </div>
          {errorMessage ? (
            <p role="alert" className="text-sm text-foreground">
              {errorMessage}
            </p>
          ) : null}
          <button type="submit" disabled={pending} className={buttonClass}>
            {message(locale, "uploadAction")}
          </button>
        </form>
      )}
    </main>
  );
}
