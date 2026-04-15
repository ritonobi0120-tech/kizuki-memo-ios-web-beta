import test from "node:test";
import assert from "node:assert/strict";

const { matchesPersonSearch } = await import("./name-search.mjs");

test("matchesPersonSearch uses predicted hiragana for kanji names", () => {
  assert.equal(
    matchesPersonSearch({
      query: "たな",
      name: "田中 はる",
    }),
    true,
  );
});

test("matchesPersonSearch still matches explicit alias and kana", () => {
  assert.equal(
    matchesPersonSearch({
      query: "あお",
      name: "佐藤 葵",
      alias: "あおちゃん",
      kana: "さとうあおい",
    }),
    true,
  );
});
