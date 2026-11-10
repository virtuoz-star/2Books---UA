import { SETTINGS_COOKIE, SETTINGS_STORAGE_KEY } from "#/preferences/settings";

export type AppliedPaper = "lagoon" | "ivory" | "night" | "auto";

export function paperFromStorage(raw: string | null): AppliedPaper {
  if (raw === null || raw === "") return "auto";
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return "auto";
  }
  if (typeof parsed !== "object" || parsed === null) return "auto";
  const paper = (parsed as { readingPaper?: unknown }).readingPaper;
  if (paper === "lagoon" || paper === "ivory" || paper === "night") return paper;
  return "auto";
}

export const themeColor: Record<AppliedPaper, string> = {
  auto: "#e8f0eb",
  lagoon: "#e8f0eb",
  ivory: "#fcf8ee",
  night: "#152022",
};

// Inlined in the root head, before the stylesheet, so the first paint matches storage.
export const themeFlashScript = `(function(){try{var raw=localStorage.getItem(${JSON.stringify(SETTINGS_STORAGE_KEY)});var parsed=raw?JSON.parse(raw):null;var paper=parsed&&parsed.readingPaper;if(paper!=="lagoon"&&paper!=="ivory"&&paper!=="night")paper="auto";var font=parsed&&parsed.readingFont;if(font!=="literary"&&font!=="plain"&&font!=="classic")font="literary";var size=parsed&&parsed.readingSize;if(size!=="small"&&size!=="regular"&&size!=="large")size="regular";var root=document.documentElement;root.dataset.paper=paper;root.dataset.font=font;root.dataset.size=size;var lang=parsed&&parsed.interfaceLocale;if(lang==="uk"||lang==="ru"||lang==="en")root.lang=lang;if(raw)document.cookie=${JSON.stringify(SETTINGS_COOKIE)}+"="+encodeURIComponent(raw)+"; Path=/; Max-Age=31536000; SameSite=Lax";}catch(e){var root=document.documentElement;root.dataset.paper="auto";if(!root.dataset.font)root.dataset.font="literary";if(!root.dataset.size)root.dataset.size="regular";}})();`;
