const storageKey = "2books.googleTranslateKey";

export function readGoogleTranslateKey(): string {
  try {
    if (typeof localStorage === "undefined") return "";
    return (localStorage.getItem(storageKey) ?? "").trim();
  } catch {
    return "";
  }
}

export function writeGoogleTranslateKey(trimmed: string): boolean {
  try {
    if (trimmed.length === 0) localStorage.removeItem(storageKey);
    else localStorage.setItem(storageKey, trimmed);
    if (typeof window !== "undefined") window.dispatchEvent(new Event("2books-google-key"));
    return true;
  } catch {
    return false;
  }
}
