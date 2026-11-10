import type { ComponentProps, ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { cn } from "cn";

const noticeTones = ["info", "success", "warning", "danger", "error"] as const;
type NoticeTone = (typeof noticeTones)[number];

function noticeRole(tone: NoticeTone): "alert" | "status" {
  return tone === "danger" || tone === "error" ? "alert" : "status";
}

const toneClass: Record<NoticeTone, string> = {
  info: "notice-info",
  success: "notice-success",
  warning: "notice-warning",
  danger: "notice-danger",
  error: "notice-danger",
};

function NoticeIcon({ tone }: { tone: NoticeTone }) {
  const className = "mt-0.5 size-4 shrink-0";
  if (tone === "success") return <CircleCheck className={className} aria-hidden />;
  if (tone === "warning") return <TriangleAlert className={className} aria-hidden />;
  if (tone === "danger" || tone === "error")
    return <CircleAlert className={className} aria-hidden />;
  return <Info className={className} aria-hidden />;
}

function Notice({
  tone = "info",
  role,
  className,
  children,
  ...props
}: {
  tone?: NoticeTone;
  children: ReactNode;
} & Omit<ComponentProps<"div">, "role" | "children"> & { role?: "alert" | "status" }) {
  const liveRole = role ?? noticeRole(tone);
  return (
    <div
      role={liveRole}
      aria-live={liveRole === "status" ? "polite" : undefined}
      className={cn(
        "notice flex items-start gap-2 rounded-md border border-border px-3 py-2 text-sm",
        toneClass[tone],
        className,
      )}
      {...props}
    >
      <NoticeIcon tone={tone} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export { Notice, noticeRole, noticeTones };
export type { NoticeTone };
