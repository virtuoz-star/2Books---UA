import { expect, test } from "bun:test";

import {
  applySessionResult,
  isDegradedCatalog,
  nextCachedList,
  resolveApiBase,
  sessionErrorStatus,
  startIdleTimeout,
  syncFailureAfterUserChange,
  withTimeout,
  type SessionView,
} from "../api";

const signedIn: SessionView = {
  phase: "in",
  account: { id: "user-a", email: "a@example.com" },
  checkFailed: false,
};

function releaseMessage(configured: string | undefined): string {
  try {
    resolveApiBase({ release: true, configured });
    return "";
  } catch (error) {
    return error instanceof Error ? error.message : "";
  }
}

test("a release build refuses a missing or cleartext API URL", () => {
  expect(resolveApiBase({ release: false, configured: undefined })).toBe("http://localhost:3001");
  expect(resolveApiBase({ release: false, configured: "http://10.0.2.2:3001/" })).toBe(
    "http://10.0.2.2:3001",
  );
  expect(releaseMessage(undefined).includes("https")).toBe(true);
  expect(releaseMessage("http://localhost:3001").includes("https")).toBe(true);
  expect(resolveApiBase({ release: true, configured: "https://books.example/" })).toBe(
    "https://books.example",
  );
});

test("a network or 5xx session check keeps the last account", () => {
  expect(sessionErrorStatus(null)).toBeNull();
  expect(sessionErrorStatus({ status: 401 })).toBe(401);
  expect(sessionErrorStatus({ status: 503 })).toBe(503);
  expect(sessionErrorStatus(new Error("offline"))).toBe("network");
  const offline = applySessionResult(signedIn, {
    user: null,
    errorStatus: "network",
    pending: false,
  });
  expect(offline).toEqual({ ...signedIn, checkFailed: true });
  const server = applySessionResult(signedIn, { user: null, errorStatus: 500, pending: false });
  expect(server.phase).toBe("in");
  expect(server.account?.id).toBe("user-a");
  expect(applySessionResult(signedIn, { user: null, errorStatus: 401, pending: false })).toEqual({
    phase: "out",
    account: null,
    checkFailed: false,
  });
  expect(
    applySessionResult(
      { phase: "unknown", account: null, checkFailed: false },
      { user: null, errorStatus: null, pending: true },
    ).phase,
  ).toBe("unknown");
  expect(
    applySessionResult(
      { phase: "unknown", account: null, checkFailed: false },
      { user: null, errorStatus: null, pending: false },
    ).phase,
  ).toBe("out");
});

test("sign-out clears the sync failure and a new user does too", () => {
  expect(syncFailureAfterUserChange(true, true)).toBe(false);
  expect(syncFailureAfterUserChange(false, true)).toBe(true);
});

test("a degraded catalog does not replace the last good list", () => {
  expect(
    isDegradedCatalog({
      status: 200,
      degradedHeader: null,
      body: { degraded: true, books: [{ id: "gift-of-the-magi" }] },
    }),
  ).toBe(true);
  expect(
    isDegradedCatalog({
      status: 200,
      degradedHeader: "1",
      body: [{ id: "gift-of-the-magi" }],
    }),
  ).toBe(true);
  expect(
    isDegradedCatalog({
      status: 200,
      degradedHeader: null,
      body: [{ id: "gift-of-the-magi" }],
    }),
  ).toBe(false);
  const previous = ["red-boat", "gift-of-the-magi"];
  expect(nextCachedList(previous, { degraded: true, list: ["gift-of-the-magi"] })).toEqual(
    previous,
  );
  expect(nextCachedList(null, { degraded: true, list: ["gift-of-the-magi"] })).toBeNull();
  expect(nextCachedList(previous, { degraded: false, list: ["red-boat"] })).toEqual(["red-boat"]);
});

test("json calls time out and a download idle timer resets on activity", async () => {
  const signal = withTimeout(undefined, 20);
  await new Promise((resolve) => {
    signal.addEventListener("abort", () => resolve(undefined), { once: true });
  });
  expect(signal.aborted).toBe(true);
  const caller = new AbortController();
  const combined = withTimeout(caller.signal, 60_000);
  caller.abort();
  expect(combined.aborted).toBe(true);

  const idle = startIdleTimeout(40);
  await new Promise((resolve) => setTimeout(resolve, 20));
  idle.activity();
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(idle.signal.aborted).toBe(false);
  idle.stop();
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(idle.signal.aborted).toBe(false);

  const stalled = startIdleTimeout(20);
  await new Promise((resolve) => {
    stalled.signal.addEventListener("abort", () => resolve(undefined), { once: true });
  });
  expect(stalled.signal.aborted).toBe(true);
  stalled.stop();
});
