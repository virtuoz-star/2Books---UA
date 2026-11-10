import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";

import { googleSignInReady } from "#/auth/session";
import { SignInPanel } from "#/auth/sign-in-panel";
import { Button } from "#/components/ui/button";
import { Field, Input, Textarea } from "#/components/ui/field";
import { Notice } from "#/components/ui/notice";
import { PageHeader } from "#/components/ui/page-header";
import { characterMeter, documentTitle, message, sentenceMeter } from "#/i18n/messages";
import { uploadText } from "#/library/api";
import { maxSentences, maxTextLength, maxTitleLength, measureUpload } from "#/library/upload-input";
import { useReaderSettings } from "#/reader/use-reader-settings";
import { useNativeLanguage } from "#/shell/app-header";

export const Route = createFileRoute("/upload")({
  head: ({ match }) => ({
    meta: [
      {
        title: documentTitle(message(match.context.settings.interfaceLocale, "uploadTitle")),
      },
    ],
  }),
  loader: () => googleSignInReady(),
  component: UploadPage,
});

type UploadError = "anonymous" | "invalid-input" | "too-long" | "quota" | "rate" | "unavailable" | null;

function uploadMessage(locale: Parameters<typeof message>[0], error: UploadError): string | null {
  if (error === "too-long") return message(locale, "tooLong");
  if (error === "invalid-input") return message(locale, "invalidInput");
  if (error === "anonymous") return message(locale, "anonymous");
  if (error === "quota") return message(locale, "uploadQuota");
  if (error === "rate") return message(locale, "uploadRate");
  if (error === "unavailable") return message(locale, "uploadSaveFailed");
  return null;
}

function UploadPage() {
  const { user } = Route.useRouteContext();
  const ready = Route.useLoaderData();
  const navigate = useNavigate();
  const router = useRouter();
  const { settings } = useReaderSettings();
  const nativeLanguage = useNativeLanguage();
  const locale = settings.interfaceLocale;
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState<UploadError>(null);
  const [pending, setPending] = useState(false);
  const signedOut = user === null || error === "anonymous";
  const errorMessage = uploadMessage(locale, error);
  const measured = useMemo(() => measureUpload(text), [text]);

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
      void router.invalidate({ filter: (match) => match.routeId === "/" });
      await navigate({
        to: "/books/$bookId/$chapterId",
        params: { bookId: result.bookId, chapterId: "c1" },
      });
    } catch {
      setError("unavailable");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeader title={message(locale, "uploadTitle")} />
      {signedOut ? (
        <SignInPanel
          locale={locale}
          nativeLanguage={nativeLanguage}
          ready={ready}
          authError={false}
          redirectTo="/upload"
        />
      ) : (
        <form className="flex flex-col gap-4" onSubmit={(event) => void onSubmit(event)}>
          <Field
            id="upload-title"
            label={message(locale, "uploadTitleLabel")}
            error={error === "invalid-input" ? errorMessage ?? undefined : undefined}
          >
            <Input
              name="title"
              type="text"
              required
              maxLength={maxTitleLength}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </Field>
          <Field
            id="upload-text"
            label={message(locale, "uploadTextLabel")}
            hint={
              <>
                {message(locale, "uploadHint")} {sentenceMeter(locale, measured.sentences, maxSentences)}
                {" · "}
                {characterMeter(locale, measured.characters, maxTextLength)}
              </>
            }
            error={error === "too-long" ? errorMessage ?? undefined : undefined}
          >
            <Textarea
              name="text"
              required
              value={text}
              onChange={(event) => setText(event.target.value)}
              className="min-h-48"
            />
          </Field>
          {errorMessage && error !== "invalid-input" && error !== "too-long" ? (
            <Notice tone="danger">{errorMessage}</Notice>
          ) : null}
          <Button type="submit" busy={pending}>
            {message(locale, pending ? "uploadSaving" : "uploadAction")}
          </Button>
        </form>
      )}
    </div>
  );
}
