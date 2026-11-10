export type ResumePoint = {
  chapterId: string;
  sentenceId: string | null;
};

export type ResumeChoice = ResumePoint & {
  source: "route" | "position" | "reading";
};

export type ContinueDraft = {
  chapterId: string;
  chapterIndex: number;
  chapterCount: number;
  sentenceId: string | null;
  sentenceIndex: number;
  ratio: number;
};

function firstParam(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === "string" ? first : undefined;
}

/** Route params from Continue. An empty sentence means the start of that part. */
export function routeResume(
  chapterId: string | string[] | undefined,
  sentenceId: string | string[] | undefined,
): ResumePoint | null {
  const chapter = firstParam(chapterId);
  if (chapter === undefined || chapter.length === 0) return null;
  const sentence = firstParam(sentenceId);
  return {
    chapterId: chapter,
    sentenceId: sentence === undefined || sentence.length === 0 ? null : sentence,
  };
}

function knownChapter(chapters: readonly { id: string }[], chapterId: string): boolean {
  return chapters.some((chapter) => chapter.id === chapterId);
}

/** Route, then position.json, then the newer reading.json mark whose part is in this book. */
export function resumeLocalReading(input: {
  chapters: readonly { id: string }[];
  route: ResumePoint | null;
  position: ResumePoint | null;
  readingMarks: readonly (ResumePoint & { updatedAt: number })[];
}): ResumeChoice | null {
  if (input.route && knownChapter(input.chapters, input.route.chapterId)) {
    return { ...input.route, source: "route" };
  }
  if (input.position && knownChapter(input.chapters, input.position.chapterId)) {
    return {
      chapterId: input.position.chapterId,
      sentenceId: input.position.sentenceId,
      source: "position",
    };
  }
  let best: (ResumePoint & { updatedAt: number }) | null = null;
  for (const mark of input.readingMarks) {
    if (!knownChapter(input.chapters, mark.chapterId)) continue;
    if (!best || mark.updatedAt > best.updatedAt) best = mark;
  }
  if (!best) return null;
  return { chapterId: best.chapterId, sentenceId: best.sentenceId, source: "reading" };
}

export function readingRatio(
  counts: readonly number[],
  chapterIndex: number,
  sentenceIndex: number,
): number {
  const total = counts.reduce((sum, count) => sum + Math.max(0, count), 0);
  if (total <= 0) return 0;
  let before = 0;
  for (let index = 0; index < chapterIndex && index < counts.length; index += 1) {
    before += Math.max(0, counts[index] ?? 0);
  }
  const chapterCount = Math.max(0, counts[chapterIndex] ?? 0);
  const within =
    chapterCount === 0 ? 0 : Math.min(chapterCount, Math.max(0, sentenceIndex)) / chapterCount;
  return Math.min(1, Math.max(0, (before + within * chapterCount) / total));
}

/**
 * A Continue card synthesized from position.json.
 * A known sentence does not pretend to be 0% or part 1; ratio is NaN until the reader measures it.
 */
export function continueFromPosition(input: {
  chapters: readonly { id: string; sentenceCount: number }[];
  position: ResumePoint;
}): ContinueDraft | null {
  const chapterIndex = input.chapters.findIndex((chapter) => chapter.id === input.position.chapterId);
  if (chapterIndex < 0) return null;
  const sentenceKnown = input.position.sentenceId !== null;
  return {
    chapterId: input.position.chapterId,
    chapterIndex,
    chapterCount: input.chapters.length,
    sentenceId: input.position.sentenceId,
    sentenceIndex: 0,
    ratio: sentenceKnown
      ? Number.NaN
      : readingRatio(
          input.chapters.map((chapter) => chapter.sentenceCount),
          chapterIndex,
          0,
        ),
  };
}
