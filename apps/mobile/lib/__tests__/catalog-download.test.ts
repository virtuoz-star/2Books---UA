import { expect, test } from "bun:test";

import {
  catalogDownloadName,
  downloadLengthDecision,
  resultAfterImport,
} from "../catalog-download";

test("Magi cache name keeps the catalog id", () => {
  expect(catalogDownloadName("gift-of-the-magi")).toBe("gift-of-the-magi.2books");
});

test("unsafe catalog ids are not file names", () => {
  expect(catalogDownloadName("../x")).toBeNull();
  expect(catalogDownloadName("Gift")).toBeNull();
});

test("a finished import stays saved when the screen aborts", () => {
  expect(resultAfterImport({ ok: true, id: "gift-of-the-magi-reader" }, true)).toEqual({
    ok: true,
    id: "gift-of-the-magi-reader",
  });
  expect(resultAfterImport({ ok: false, error: "invalid-input" }, true)).toEqual({
    ok: false,
    error: "http",
  });
  expect(resultAfterImport({ ok: false, error: "io" }, false)).toEqual({
    ok: false,
    error: "io",
  });
});

test("download length decides read, reject, or missing", () => {
  expect(downloadLengthDecision(25_000_000)).toBe("read");
  expect(downloadLengthDecision(25_000_001)).toBe("reject");
  expect(downloadLengthDecision(null)).toBe("missing");
});
