import { expect, test } from "vite-plus/test";

import { createRequestMemo } from "#/auth/request-memo";

function countingLoader<Value>(values: Value[]) {
  const calls: Request[] = [];
  const memo = createRequestMemo<Request, Value>(async (request) => {
    calls.push(request);
    const value = values[calls.length - 1];
    if (value === undefined) throw new Error("no more values");
    return value;
  });
  return { calls, memo };
}

test("one request reads the session once, however many callers ask", async () => {
  const { calls, memo } = countingLoader(["reader", "someone else"]);
  const request = new Request("http://localhost/books/emma/1");
  const [first, second] = await Promise.all([memo.read(request), memo.read(request)]);
  expect(first).toBe("reader");
  expect(second).toBe("reader");
  expect(await memo.read(request)).toBe("reader");
  expect(calls).toHaveLength(1);
});

test("two requests never share a remembered value", async () => {
  const { calls, memo } = countingLoader(["reader", "admin"]);
  const one = new Request("http://localhost/");
  const two = new Request("http://localhost/");
  expect(await memo.read(one)).toBe("reader");
  expect(await memo.read(two)).toBe("admin");
  expect(calls).toEqual([one, two]);
});

test("a forgotten request is read again, so sign-out and role changes show at once", async () => {
  const { calls, memo } = countingLoader<string | null>(["admin", null]);
  const request = new Request("http://localhost/admin");
  expect(await memo.read(request)).toBe("admin");
  memo.forget(request);
  expect(await memo.read(request)).toBeNull();
  expect(calls).toHaveLength(2);
});

test("a read that was forgotten while in flight does not come back", async () => {
  let release: (value: string) => void = () => {};
  let calls = 0;
  const memo = createRequestMemo<Request, string>((_request) => {
    calls += 1;
    if (calls > 1) return Promise.resolve("user");
    return new Promise<string>((resolve) => {
      release = resolve;
    });
  });
  const request = new Request("http://localhost/admin");
  const stale = memo.read(request);
  memo.forget(request);
  const fresh = memo.read(request);
  release("admin");
  expect(await stale).toBe("admin");
  expect(await fresh).toBe("user");
  expect(await memo.read(request)).toBe("user");
  expect(calls).toBe(2);
});

test("a failed read is not remembered", async () => {
  let calls = 0;
  const memo = createRequestMemo<Request, string>(async () => {
    calls += 1;
    if (calls === 1) throw new Error("database is away");
    return "reader";
  });
  const request = new Request("http://localhost/");
  await expect(memo.read(request)).rejects.toThrow("database is away");
  expect(await memo.read(request)).toBe("reader");
  expect(calls).toBe(2);
});

test("a loader that throws before it returns a promise still rejects", async () => {
  const memo = createRequestMemo<Request, string>(() => {
    throw new Error("no request scope");
  });
  await expect(memo.read(new Request("http://localhost/"))).rejects.toThrow("no request scope");
});
