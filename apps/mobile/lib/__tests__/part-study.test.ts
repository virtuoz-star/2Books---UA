import { expect, test } from "bun:test";

import { emptyPartStudy, noteSavedWord, noteTranslation } from "../part-study";

test("opened translations and saved words count once, in first-seen order", () => {
  let study = emptyPartStudy();
  study = noteTranslation(study, "s1");
  expect(noteTranslation(study, "s1")).toBe(study);
  expect(noteTranslation(study, "")).toBe(study);
  study = noteTranslation(study, "s2");
  study = noteSavedWord(study, "uk:pennies");
  expect(noteSavedWord(study, "uk:pennies")).toBe(study);
  expect(noteSavedWord(study, "")).toBe(study);
  expect(study.translations).toEqual(["s1", "s2"]);
  expect(study.words).toEqual(["uk:pennies"]);
  study = noteSavedWord(study, "ru:hope");
  expect(study.words).toEqual(["uk:pennies", "ru:hope"]);
  expect(study.translations).toEqual(["s1", "s2"]);
});
