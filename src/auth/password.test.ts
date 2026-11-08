import { expect, test } from "vite-plus/test";

import { hashPassword, passwordAcceptable, verifyPassword } from "#/auth/password";

test("hash then verify succeeds and a wrong password fails", async () => {
  const stored = await hashPassword("correct-horse");
  expect(stored.startsWith("100000$")).toBe(true);
  expect(stored.split("$")).toHaveLength(3);
  expect(await verifyPassword("correct-horse", stored)).toBe(true);
  expect(await verifyPassword("wrong-password", stored)).toBe(false);
});

test("hashes of the same password use different salts", async () => {
  const [first, second] = await Promise.all([
    hashPassword("correct-horse"),
    hashPassword("correct-horse"),
  ]);
  expect(first.split("$")[1]).not.toBe(second.split("$")[1]);
  expect(await verifyPassword("correct-horse", first)).toBe(true);
  expect(await verifyPassword("correct-horse", second)).toBe(true);
});

test("empty password is rejected", () => {
  expect(passwordAcceptable("")).toBe(false);
  expect(passwordAcceptable("1234567")).toBe(false);
  expect(passwordAcceptable("12345678")).toBe(true);
});
