export function normalizeEmail(email: string): string | null {
  if (typeof email !== "string") return null;
  const normalized = email.trim().toLowerCase();
  if (normalized.length < 3 || normalized.length > 254) return null;
  if (/\s/.test(normalized)) return null;
  const at = normalized.indexOf("@");
  if (at <= 0) return null;
  if (normalized.indexOf("@", at + 1) !== -1) return null;
  const domain = normalized.slice(at + 1);
  if (domain.length < 1) return null;
  return normalized;
}
