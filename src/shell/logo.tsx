import { Link } from "@tanstack/react-router";

import { message } from "#/i18n/messages";
import type { Locale } from "#/i18n/types";

export function LogoMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect x="5" y="8" width="16" height="18" rx="1.5" fill="#ffe08a" transform="rotate(-8 13 17)" />
      <rect x="12" y="6" width="15" height="18" rx="1.5" fill="#17635d" />
      <path d="M14 10h9M14 14h9M14 18h6" stroke="#f6fbf8" strokeWidth="1.2" />
    </svg>
  );
}

export function Logo({ locale }: { locale: Locale }) {
  return (
    <Link to="/" className="flex items-center gap-2 text-foreground no-underline">
      <LogoMark />
      <span className="display-title text-lg leading-none">{message(locale, "appName")}</span>
    </Link>
  );
}
