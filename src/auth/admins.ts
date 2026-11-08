export function isListedAdmin(email: string, list: string | undefined): boolean {
  if (typeof email !== "string" || typeof list !== "string" || list.length === 0) return false;
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) return false;
  for (const part of list.split(",")) {
    if (part.trim().toLowerCase() === normalized) return true;
  }
  return false;
}

export type AdminAction = "set-role" | "ban" | "unban" | "delete" | "language";

export function adminActionAllowed(input: {
  actorId: string;
  targetId: string;
  targetRole: "admin" | "user";
  adminCount: number;
  action: AdminAction;
  nextRole?: "admin" | "user";
}): boolean {
  if (input.action === "delete" && input.actorId === input.targetId) return false;
  if (input.action === "ban" && input.actorId === input.targetId) return false;
  const removesAdmin =
    ((input.action === "delete" || input.action === "ban") && input.targetRole === "admin") ||
    (input.action === "set-role" && input.targetRole === "admin" && input.nextRole !== "admin");
  if (removesAdmin && input.adminCount <= 1) return false;
  return true;
}
