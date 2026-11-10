import { useState, type FormEvent } from "react";

import { createAdminCatalogBook, type AdminFailure } from "#/admin/api";
import { Button } from "#/components/ui/button";
import { Field, Input, Textarea } from "#/components/ui/field";
import { Notice } from "#/components/ui/notice";
import { message } from "#/i18n/messages";
import type { Locale } from "#/i18n/types";
import { alignedSentenceLines, catalogLimits, prepareCatalogBook } from "#/library/catalog-draft";

type ChapterDraft = {
  title: { uk: string; ru: string; en: string };
  en: string;
  uk: string;
  ru: string;
};
type CatalogFormError = "invalid-input" | "reserved-id" | "duplicate" | "unavailable" | "forbidden";

function emptyChapter(): ChapterDraft {
  return {
    title: { uk: "", ru: "", en: "" },
    en: "",
    uk: "",
    ru: "",
  };
}

function chapterDraft(chapter: ChapterDraft): {
  title: ChapterDraft["title"];
  sentences: { en: string; uk: string; ru: string }[];
} | null {
  const aligned = alignedSentenceLines(chapter.en, chapter.uk, chapter.ru);
  if (!aligned.ok) return null;
  return { title: chapter.title, sentences: aligned.sentences };
}

function catalogErrorMessage(locale: Locale, error: CatalogFormError | null): string | null {
  if (error === "invalid-input") return message(locale, "invalidCatalog");
  if (error === "reserved-id") return message(locale, "reservedId");
  if (error === "duplicate") return message(locale, "duplicateBook");
  if (error === "unavailable" || error === "forbidden") return message(locale, "actionFailed");
  return null;
}

export function CatalogForm({
  locale,
  disabled,
  onSaved,
}: {
  locale: Locale;
  disabled: boolean;
  onSaved: () => Promise<void>;
}) {
  const [id, setId] = useState("");
  const [author, setAuthor] = useState("");
  const [title, setTitle] = useState({ uk: "", ru: "", en: "" });
  const [chapters, setChapters] = useState<ChapterDraft[]>([emptyChapter()]);
  const [error, setError] = useState<CatalogFormError | null>(null);
  const [pending, setPending] = useState(false);
  const locked = disabled || pending;
  const errorMessage = catalogErrorMessage(locale, error);

  function setChapterTitle(chapterIndex: number, language: Locale, value: string) {
    setChapters((current) =>
      current.map((chapter, index) => {
        if (index !== chapterIndex) return chapter;
        return { ...chapter, title: { ...chapter.title, [language]: value } };
      }),
    );
  }

  function setChapterText(chapterIndex: number, field: "en" | "uk" | "ru", value: string) {
    setChapters((current) =>
      current.map((chapter, index) => {
        if (index !== chapterIndex) return chapter;
        return { ...chapter, [field]: value };
      }),
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked) return;
    const drafted = chapters.map((chapter) => chapterDraft(chapter));
    if (drafted.some((chapter) => chapter === null)) {
      setError("invalid-input");
      return;
    }
    const prepared = prepareCatalogBook({
      id,
      author,
      title,
      chapters: drafted.filter((chapter) => chapter !== null),
    });
    if (!prepared.ok) {
      setError(prepared.error);
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await createAdminCatalogBook({ data: prepared.book });
      if (!result.ok) {
        setError(formError(result.error));
        return;
      }
      setId("");
      setAuthor("");
      setTitle({ uk: "", ru: "", en: "" });
      setChapters([emptyChapter()]);
      await onSaved();
    } catch {
      setError("unavailable");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-4"
      autoComplete="off"
      onSubmit={(event) => void onSubmit(event)}
    >
      <h3 className="text-base font-semibold text-foreground">
        {message(locale, "addCatalogBook")}
      </h3>
      {errorMessage ? (
        <Notice id="catalog-error" tone="danger">
          {errorMessage}
        </Notice>
      ) : null}
      <Field
        id="catalog-book-id"
        label={message(locale, "catalogAddress")}
        hint={message(locale, "catalogAddressHint")}
      >
        <Input
          value={id}
          maxLength={catalogLimits.maxIdLength}
          disabled={locked}
          onChange={(event) => setId(event.target.value)}
        />
      </Field>
      <Field id="catalog-author" label={message(locale, "authorLabel")}>
        <Input
          value={author}
          maxLength={catalogLimits.maxTitleLength}
          disabled={locked}
          onChange={(event) => setAuthor(event.target.value)}
        />
      </Field>
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium text-foreground">
          {message(locale, "bookTitle")}
        </legend>
        <TitleFields
          idPrefix="catalog-title"
          title={title}
          disabled={locked}
          locale={locale}
          onChange={(language, value) => setTitle((current) => ({ ...current, [language]: value }))}
        />
      </fieldset>
      {chapters.map((chapter, chapterIndex) => (
        <fieldset
          key={chapterIndex}
          className="flex flex-col gap-3 rounded-lg border border-border p-4"
        >
          <legend className="px-1 text-sm font-medium text-foreground">
            {message(locale, "chapterHeading")} {chapterIndex + 1}
          </legend>
          <p className="text-sm font-medium text-foreground">{message(locale, "chapterTitle")}</p>
          <TitleFields
            idPrefix={`catalog-c-${chapterIndex}-title`}
            title={chapter.title}
            disabled={locked}
            locale={locale}
            onChange={(language, value) => setChapterTitle(chapterIndex, language, value)}
          />
          <p className="text-sm font-normal text-muted-foreground">
            {message(locale, "linesHint")}
          </p>
          <div className="grid gap-3 lg:grid-cols-3">
            <ChapterText
              id={`catalog-c-${chapterIndex}-en`}
              label={message(locale, "textEnglish")}
              value={chapter.en}
              disabled={locked}
              onChange={(value) => setChapterText(chapterIndex, "en", value)}
            />
            <ChapterText
              id={`catalog-c-${chapterIndex}-uk`}
              label={message(locale, "textUkrainian")}
              value={chapter.uk}
              disabled={locked}
              onChange={(value) => setChapterText(chapterIndex, "uk", value)}
            />
            <ChapterText
              id={`catalog-c-${chapterIndex}-ru`}
              label={message(locale, "textRussian")}
              value={chapter.ru}
              disabled={locked}
              onChange={(value) => setChapterText(chapterIndex, "ru", value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {chapters.length > 1 ? (
              <Button
                type="button"
                variant="secondary"
                disabled={locked}
                onClick={() =>
                  setChapters((current) => current.filter((_, index) => index !== chapterIndex))
                }
              >
                {message(locale, "removeChapter")}
              </Button>
            ) : null}
          </div>
        </fieldset>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          id="catalog-add-chapter"
          variant="secondary"
          disabled={locked || chapters.length >= catalogLimits.maxChapters}
          onClick={() => setChapters((current) => [...current, emptyChapter()])}
        >
          {message(locale, "addChapter")}
        </Button>
        <Button type="submit" id="catalog-publish" disabled={locked} busy={pending}>
          {message(locale, "publishBook")}
        </Button>
      </div>
    </form>
  );
}

function formError(error: AdminFailure): CatalogFormError {
  if (
    error === "invalid-input" ||
    error === "reserved-id" ||
    error === "duplicate" ||
    error === "forbidden"
  ) {
    return error;
  }
  return "unavailable";
}

function TitleFields({
  idPrefix,
  title,
  disabled,
  locale,
  onChange,
}: {
  idPrefix: string;
  title: { uk: string; ru: string; en: string };
  disabled: boolean;
  locale: Locale;
  onChange: (language: Locale, value: string) => void;
}) {
  const fields = [
    ["uk", "textUkrainian"],
    ["ru", "textRussian"],
    ["en", "textEnglish"],
  ] as const;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {fields.map(([language, label]) => (
        <Field key={language} id={`${idPrefix}-${language}`} label={message(locale, label)}>
          <Input
            value={title[language]}
            maxLength={catalogLimits.maxTitleLength}
            disabled={disabled}
            onChange={(event) => onChange(language, event.target.value)}
          />
        </Field>
      ))}
    </div>
  );
}

function lineCount(value: string): number {
  const trimmed = value.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split("\n").length;
}

function ChapterText({
  id,
  label,
  value,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Field
      id={id}
      label={
        <span className="flex items-baseline justify-between gap-3">
          {label}
          <span className="font-normal text-muted-foreground">{lineCount(value)}</span>
        </span>
      }
    >
      <Textarea
        value={value}
        rows={16}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-80 resize-y leading-relaxed"
      />
    </Field>
  );
}
