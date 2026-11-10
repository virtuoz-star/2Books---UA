import { expect, test } from "vite-plus/test";

import { adminActionAllowed, isListedAdmin } from "#/auth/admins";

test("admin emails match a comma-separated list, ignoring case and spaces", () => {
  const list = " Owner@Example.com, second@example.com ";
  expect(isListedAdmin("owner@example.com", list)).toBe(true);
  expect(isListedAdmin("  SECOND@example.com ", list)).toBe(true);
  expect(isListedAdmin("other@example.com", list)).toBe(false);
  expect(isListedAdmin("owner@example.com", "")).toBe(false);
  expect(isListedAdmin("owner@example.com", undefined)).toBe(false);
  expect(isListedAdmin("not-an-email", "not-an-email")).toBe(false);
});

test("the last administrator cannot be demoted, blocked, or deleted", () => {
  const last = {
    actorId: "admin-1",
    targetId: "admin-1",
    targetRole: "admin" as const,
    adminCount: 1,
  };
  expect(adminActionAllowed({ ...last, action: "set-role", nextRole: "user" })).toBe(false);
  expect(adminActionAllowed({ ...last, action: "ban" })).toBe(false);
  expect(adminActionAllowed({ ...last, action: "delete" })).toBe(false);
  expect(adminActionAllowed({ ...last, action: "set-role", nextRole: "admin" })).toBe(true);
  expect(
    adminActionAllowed({ ...last, targetId: "reader-1", targetRole: "user", action: "delete" }),
  ).toBe(true);
});

test("a banned administrator can be demoted or deleted when they are the only other admin", () => {
  expect(
    adminActionAllowed({
      actorId: "admin-1",
      targetId: "admin-2",
      targetRole: "admin",
      targetBanned: true,
      adminCount: 1,
      action: "delete",
    }),
  ).toBe(true);
  expect(
    adminActionAllowed({
      actorId: "admin-1",
      targetId: "admin-2",
      targetRole: "admin",
      targetBanned: true,
      adminCount: 1,
      action: "set-role",
      nextRole: "user",
    }),
  ).toBe(true);
});

test("an administrator can be removed when another administrator remains", () => {
  expect(
    adminActionAllowed({
      actorId: "admin-1",
      targetId: "admin-2",
      targetRole: "admin",
      adminCount: 2,
      action: "set-role",
      nextRole: "user",
    }),
  ).toBe(true);
  expect(
    adminActionAllowed({
      actorId: "admin-1",
      targetId: "admin-1",
      targetRole: "admin",
      adminCount: 2,
      action: "delete",
    }),
  ).toBe(false);
  expect(
    adminActionAllowed({
      actorId: "admin-1",
      targetId: "admin-1",
      targetRole: "admin",
      adminCount: 2,
      action: "ban",
    }),
  ).toBe(false);
});
