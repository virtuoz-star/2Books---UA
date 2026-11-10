import { expect, test } from "bun:test";

import { incomingShareAction } from "../incoming-file";

test("a share waits for a name before it is marked seen", () => {
  expect(incomingShareAction({ empty: false, isResolving: false, sawResolving: false, pass: 0 })).toBe(
    "wait",
  );
  expect(incomingShareAction({ empty: false, isResolving: true, sawResolving: true, pass: 0 })).toBe(
    "wait",
  );
  expect(incomingShareAction({ empty: false, isResolving: false, sawResolving: true, pass: 0 })).toBe(
    "enqueue",
  );
  expect(incomingShareAction({ empty: false, isResolving: false, sawResolving: false, pass: 1 })).toBe(
    "enqueue",
  );
  expect(incomingShareAction({ empty: true, isResolving: false, sawResolving: true, pass: 1 })).toBe(
    "clear",
  );
});
