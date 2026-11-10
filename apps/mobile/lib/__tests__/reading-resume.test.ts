import { expect, test } from "bun:test";

import {
  continueFromPosition,
  readingRatio,
  resumeLocalReading,
  routeResume,
} from "../reading-resume";

const chapters = [{ id: "c1" }, { id: "c2" }, { id: "c3" }];

test("continue route params beat position.json and a newer reading mark", () => {
  expect(
    resumeLocalReading({
      chapters,
      route: { chapterId: "c2", sentenceId: "s2" },
      position: { chapterId: "c1", sentenceId: "s1" },
      readingMarks: [{ chapterId: "c3", sentenceId: "s3", updatedAt: 9 }],
    }),
  ).toEqual({ chapterId: "c2", sentenceId: "s2", source: "route" });
});

test("position.json wins when Continue did not pass a part", () => {
  expect(
    resumeLocalReading({
      chapters,
      route: null,
      position: { chapterId: "c2", sentenceId: "s2" },
      readingMarks: [{ chapterId: "c3", sentenceId: "s3", updatedAt: 9 }],
    }),
  ).toEqual({ chapterId: "c2", sentenceId: "s2", source: "position" });
});

test("a missing position uses the newer gift-pair reading mark", () => {
  expect(
    resumeLocalReading({
      chapters,
      route: null,
      position: null,
      readingMarks: [
        { chapterId: "c1", sentenceId: "s1", updatedAt: 1 },
        { chapterId: "c3", sentenceId: "s9", updatedAt: 5 },
      ],
    }),
  ).toEqual({ chapterId: "c3", sentenceId: "s9", source: "reading" });
});

test("a reading mark for an unknown part is skipped", () => {
  expect(
    resumeLocalReading({
      chapters,
      route: { chapterId: "missing", sentenceId: "s" },
      position: null,
      readingMarks: [
        { chapterId: "nope", sentenceId: "s", updatedAt: 9 },
        { chapterId: "c2", sentenceId: null, updatedAt: 2 },
      ],
    }),
  ).toEqual({ chapterId: "c2", sentenceId: null, source: "reading" });
});

test("an empty continue sentence means the start of that part", () => {
  expect(routeResume("c2", "")).toEqual({ chapterId: "c2", sentenceId: null });
  expect(routeResume(undefined, "s1")).toBeNull();
  expect(routeResume(["c3"], ["s8"])).toEqual({ chapterId: "c3", sentenceId: "s8" });
});

test("a later position is not reported as part 1 or 0%", () => {
  const mark = continueFromPosition({
    chapters: [
      { id: "c1", sentenceCount: 4 },
      { id: "c2", sentenceCount: 4 },
    ],
    position: { chapterId: "c2", sentenceId: "s9" },
  });
  expect(mark?.chapterIndex).toBe(1);
  expect(mark?.sentenceId).toBe("s9");
  expect(mark !== null && Number.isFinite(mark.ratio)).toBe(false);
  expect(
    continueFromPosition({
      chapters: [{ id: "c1", sentenceCount: 4 }],
      position: { chapterId: "missing", sentenceId: "s1" },
    }),
  ).toBeNull();
});

test("a position with no sentence still names its part", () => {
  const mark = continueFromPosition({
    chapters: [
      { id: "c1", sentenceCount: 4 },
      { id: "c2", sentenceCount: 4 },
    ],
    position: { chapterId: "c2", sentenceId: null },
  });
  expect(mark?.chapterIndex).toBe(1);
  expect(mark?.ratio).toBe(readingRatio([4, 4], 1, 0));
});
