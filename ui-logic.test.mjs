import test from "node:test";
import assert from "node:assert/strict";

const {
  BOARD_FILTERS,
  applyBoardFilter,
  buildBoardSummary,
  buildHandoffBundle,
  nextMemosForHandoff,
  resolveIncludedMemos,
} = await import("./ui-logic.mjs");

const samplePeople = [
  { id: "a", name: "田中", lastAccessedAt: "2026-04-17T09:00:00Z", isPinned: true },
  { id: "b", name: "佐藤", lastAccessedAt: null },
  { id: "c", name: "鈴木", lastAccessedAt: "2026-04-16T09:00:00Z" },
];

const sampleMemos = [
  { id: "m1", observedAt: "2026-04-17T10:00:00Z", rawText: "朝の記録", scene: "仕事" },
  { id: "m2", observedAt: "2026-04-17T11:00:00Z", rawText: "昼の記録", scene: "" },
  { id: "m3", observedAt: "2026-04-15T09:00:00Z", rawText: "古い記録", scene: "生活" },
];

test("BOARD_FILTERS exposes the expected home quick filters", () => {
  assert.deepEqual(
    BOARD_FILTERS.map((item) => item.id),
    ["all", "pending"],
  );
});

test("applyBoardFilter keeps only people with pending memos in pending mode", () => {
  const visible = applyBoardFilter({
    people: samplePeople,
    filter: "pending",
    getPendingCount: (personId) => (personId === "a" ? 2 : 0),
  });

  assert.deepEqual(visible.map((item) => item.id), ["a"]);
});

test("buildBoardSummary counts total, pending, and folder totals", () => {
  const summary = buildBoardSummary({
    people: samplePeople,
    getPendingCount: (personId) => (personId === "b" ? 0 : 1),
    folderCount: 2,
  });

  assert.deepEqual(summary, {
    totalCount: 3,
    pendingCount: 2,
    folderCount: 2,
  });
});

test("nextMemosForHandoff keeps only memos after the summary update", () => {
  const pending = nextMemosForHandoff({
    memos: sampleMemos,
    summaryUpdatedAt: "2026-04-16T12:00:00Z",
  });

  assert.deepEqual(pending.map((item) => item.id), ["m1", "m2"]);
});

test("resolveIncludedMemos prefers explicitly prepared ids", () => {
  const included = resolveIncludedMemos({
    memos: sampleMemos,
    summaryUpdatedAt: "2026-04-17T10:30:00Z",
    preparedMemoIds: ["m3"],
  });

  assert.deepEqual(included.map((item) => item.id), ["m3"]);
});

test("buildHandoffBundle returns copy-ready markdown for the selected memos", () => {
  const bundle = buildHandoffBundle({
    personName: "田中 はる",
    summaryText: "以前の整理ノート",
    summaryUpdatedAt: "2026-04-16T12:00:00Z",
    memos: sampleMemos,
    preparedMemoIds: ["m2"],
    exportedAt: "2026-04-17T12:00:00Z",
    formatDateTime: (value) => value,
  });

  assert.deepEqual(bundle.includedMemoIds, ["m2"]);
  assert.match(bundle.copyText, /田中 はる/);
  assert.match(bundle.copyText, /昼の記録/);
  assert.doesNotMatch(bundle.copyText, /朝の記録/);
});
