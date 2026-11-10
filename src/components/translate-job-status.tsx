import { cn } from "cn";

import { Button } from "#/components/ui/button";
import { Notice } from "#/components/ui/notice";
import { ProgressBar } from "#/components/ui/progress-bar";
import type { OwnedUploadNotice } from "#/dictionary/translate-upload";
import { message, translateBookSkipped, translateProgress } from "#/i18n/messages";
import type { Locale } from "#/i18n/types";

function TranslateJobStatus({
  locale,
  again,
  running,
  progress,
  notice,
  onStart,
  onCancel,
  className,
}: {
  locale: Locale;
  again: boolean;
  running: boolean;
  progress: { done: number; total: number } | null;
  notice: OwnedUploadNotice | null;
  onStart: () => void;
  onCancel?: () => void;
  className?: string;
}) {
  const skipped =
    notice && (notice.kind === "saved" || notice.kind === "pending") && notice.skipped > 0
      ? notice.skipped
      : 0;
  const known = progress !== null && progress.total > 0;
  return (
    <div className={cn("flex flex-col items-start gap-2", className)}>
      <Button type="button" disabled={running} busy={running} onClick={onStart}>
        {message(locale, again ? "translateBookAgain" : "translateBook")}
      </Button>
      {running && !known ? (
        <p className="text-sm text-muted-foreground">{message(locale, "preparingTranslation")}</p>
      ) : null}
      {known && progress ? (
        <ProgressBar
          value={progress.done}
          max={progress.total}
          label={translateProgress(locale, progress.done, progress.total)}
        />
      ) : null}
      {running && onCancel ? (
        <Button type="button" variant="secondary" onClick={onCancel}>
          {message(locale, "cancelAction")}
        </Button>
      ) : null}
      {notice?.kind === "need-key" ? (
        <Notice tone="warning">{message(locale, "translateBookNeedKey")}</Notice>
      ) : null}
      {notice?.kind === "saved" ? (
        <Notice tone="success">{message(locale, "translateBookSaved")}</Notice>
      ) : null}
      {notice?.kind === "pending" ? (
        <Notice tone="info">{message(locale, "translateBookPending")}</Notice>
      ) : null}
      {notice?.kind === "none" ? <Notice tone="info">{message(locale, "translateBookNone")}</Notice> : null}
      {notice?.kind === "anonymous" ? <Notice tone="warning">{message(locale, "anonymous")}</Notice> : null}
      {notice?.kind === "rejected" ? (
        <Notice tone="danger">{message(locale, "translateKeyRejected")}</Notice>
      ) : null}
      {notice?.kind === "quota" ? <Notice tone="danger">{message(locale, "translateQuota")}</Notice> : null}
      {notice?.kind === "failed" ? <Notice tone="danger">{message(locale, "actionFailed")}</Notice> : null}
      {skipped > 0 ? <Notice tone="warning">{translateBookSkipped(locale, skipped)}</Notice> : null}
    </div>
  );
}

export { TranslateJobStatus };
