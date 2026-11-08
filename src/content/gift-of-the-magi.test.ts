import { expect, test } from "vite-plus/test";

import { giftOfTheMagiOpening } from "#/content/gift-of-the-magi";

const passage = giftOfTheMagiOpening;

test("seven sentences, ids s1–s7 in order", () => {
  expect(passage.sentences).toHaveLength(7);
  expect(passage.sentences.map((sentence) => sentence.id)).toEqual([
    "s1",
    "s2",
    "s3",
    "s4",
    "s5",
    "s6",
    "s7",
  ]);
});

test("author, id, and the three titles match the spec", () => {
  expect(passage.id).toBe("gift-of-the-magi-opening");
  expect(passage.author).toBe("O. Henry");
  expect(passage.title).toEqual({
    en: "The Gift of the Magi",
    uk: "Дари волхвів",
    ru: "Дары волхвов",
  });
});

test("s5 Ukrainian and Russian match the spec", () => {
  expect(passage.sentences[4]?.uk).toBe("Делла перелічила їх тричі.");
  expect(passage.sentences[4]?.ru).toBe("Делла пересчитала их трижды.");
});

test("s1 and s6 English match", () => {
  expect(passage.sentences[0]?.en).toBe("One dollar and eighty-seven cents.");
  expect(passage.sentences[5]?.en).toBe("One dollar and eighty-seven cents.");
  expect(passage.sentences[0]?.en).toBe(passage.sentences[5]?.en);
});

test("s4 keeps the spec apostrophes", () => {
  const sentence = passage.sentences[3];
  expect(sentence?.en).toContain("one\u2019s");
  expect(sentence?.uk).toContain("м\u2019ясника");
  expect(sentence?.uk).toContain("дріб\u2019язкове");
  expect(sentence?.en.includes("\u0027")).toBe(false);
  expect(sentence?.uk.includes("\u0027")).toBe(false);
});

test("every sentence matches the spec character for character", () => {
  expect(passage.sentences).toEqual([
    {
      id: "s1",
      en: "One dollar and eighty-seven cents.",
      uk: "Один долар і вісімдесят сім центів.",
      ru: "Один доллар и восемьдесят семь центов.",
    },
    {
      id: "s2",
      en: "That was all.",
      uk: "Це було все.",
      ru: "Это было всё.",
    },
    {
      id: "s3",
      en: "And sixty cents of it was in pennies.",
      uk: "І шістдесят центів із них були одноцентовими монетами.",
      ru: "И шестьдесят центов из них были одноцентовыми монетами.",
    },
    {
      id: "s4",
      en: "Pennies saved one and two at a time by bulldozing the grocer and the vegetable man and the butcher until one’s cheeks burned with the silent imputation of parsimony that such close dealing implied.",
      uk: "Одноцентовики, відкладені по одному й по два, виторговані в бакалійника, овочівника й м’ясника, аж поки щоки пашіли від мовчазного докору в скнарості, який ховало таке дріб’язкове торгування.",
      ru: "Одноцентовики, отложенные по одному и по два, выторгованные у бакалейщика, зеленщика и мясника, пока щёки не начинали гореть от безмолвного упрёка в скаредности, который таила такая мелочная торговля.",
    },
    {
      id: "s5",
      en: "Three times Della counted it.",
      uk: "Делла перелічила їх тричі.",
      ru: "Делла пересчитала их трижды.",
    },
    {
      id: "s6",
      en: "One dollar and eighty-seven cents.",
      uk: "Один долар і вісімдесят сім центів.",
      ru: "Один доллар и восемьдесят семь центов.",
    },
    {
      id: "s7",
      en: "And the next day would be Christmas.",
      uk: "А наступного дня було Різдво.",
      ru: "А на следующий день было Рождество.",
    },
  ]);
});
