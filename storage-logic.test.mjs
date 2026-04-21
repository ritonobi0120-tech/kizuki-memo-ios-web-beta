import test from "node:test";
import assert from "node:assert/strict";

const {
  buildImportConfirmationMessage,
  buildStateExport,
  createDemoState,
  emptyState,
  loadState,
  normalizeImportedState,
  persistState,
  summarizeStateCounts,
} = await import("./storage-logic.mjs");

test("emptyState starts with built-in scenes and no records", () => {
  const state = emptyState();

  assert.equal(state.people.length, 0);
  assert.equal(state.folders.length, 0);
  assert.equal(state.memos.length, 0);
  assert.equal(state.summaries.length, 0);
  assert.ok(state.scenes.includes("その他"));
});

test("createDemoState seeds copy-ready sample records", () => {
  const state = createDemoState();

  assert.equal(state.people.length, 3);
  assert.equal(state.folders.length, 2);
  assert.equal(state.memos.length, 4);
  assert.equal(state.summaries.length, 1);
  assert.equal(state.people[0].sortOrder, 0);
});

test("normalizeImportedState drops invalid rows and keeps latest summary per person", () => {
  const normalized = normalizeImportedState({
    folders: [
      { id: "folder-a", name: "1組", icon: "📁", colorKey: "sand", sortOrder: 0 },
    ],
    people: [
      { id: "person-a", name: "田中", sortOrder: 1, folderId: "folder-a" },
      { id: "person-a", name: "重複ID", sortOrder: 9 },
      { id: "", name: "  " },
    ],
    memos: [
      { id: "memo-1", personId: "person-a", rawText: "朝のメモ", observedAt: "2026-04-17T10:00:00Z", scene: "仕事" },
      { id: "memo-2", personId: "missing", rawText: "無効", observedAt: "2026-04-17T11:00:00Z" },
    ],
    summaries: [
      { personId: "person-a", summaryText: "古い", summaryUpdatedAt: "2026-04-16T08:00:00Z" },
      { personId: "person-a", summaryText: "新しい", summaryUpdatedAt: "2026-04-17T08:00:00Z" },
    ],
    scenes: ["会話", "仕事", ""],
  });

  assert.equal(normalized.folders.length, 1);
  assert.equal(normalized.people.length, 2);
  assert.equal(normalized.memos.length, 1);
  assert.equal(normalized.summaries.length, 1);
  assert.equal(normalized.summaries[0].summaryText, "新しい");
  assert.equal(normalized.people[0].folderId, "folder-a");
  assert.ok(normalized.scenes.includes("仕事"));
  assert.ok(normalized.scenes.includes("その他"));
});

test("summarizeStateCounts reports normalized record totals", () => {
  const counts = summarizeStateCounts(createDemoState());

  assert.deepEqual(counts, {
    people: 3,
    folders: 2,
    memos: 4,
    summaries: 1,
    scenes: 8,
  });
});

test("buildImportConfirmationMessage stays operator-friendly", () => {
  const message = buildImportConfirmationMessage("sample.json", {
    people: 4,
    folders: 2,
    memos: 12,
    summaries: 3,
    scenes: 9,
  });

  assert.match(message, /sample\.json/);
  assert.match(message, /名前 4 人/);
  assert.match(message, /フォルダ 2 個/);
  assert.match(message, /メモ 12 件/);
});

test("buildStateExport returns a timestamped filename and normalized payload", () => {
  const exported = buildStateExport({
    state: createDemoState(),
    appId: "kizuki-ios-web-beta",
    schemaVersion: 2,
    exportedAt: "2026-04-18T00:00:00Z",
  });

  assert.equal(exported.payload.app, "kizuki-ios-web-beta");
  assert.equal(exported.payload.schemaVersion, 2);
  assert.match(exported.filename, /^kizuki-ios-web-beta-\d{4}-\d{2}-\d{2}\.json$/);
  assert.deepEqual(exported.payload.recordCounts, summarizeStateCounts(createDemoState()));
});

test("loadState falls back to empty state when stored JSON is broken", () => {
  const storage = {
    getItem() {
      return "{broken";
    },
  };

  const loaded = loadState({ storage, storageKey: "demo" });

  assert.deepEqual(loaded.people, []);
  assert.deepEqual(loaded.memos, []);
});

test("persistState writes normalized state JSON", () => {
  let writtenKey = "";
  let writtenValue = "";
  const storage = {
    setItem(key, value) {
      writtenKey = key;
      writtenValue = value;
    },
  };

  persistState({
    storage,
    storageKey: "demo",
    state: {
      people: [{ id: "person-a", name: "田中", sortOrder: 0 }],
      folders: [],
      memos: [],
      summaries: [],
      scenes: [],
    },
  });

  assert.equal(writtenKey, "demo");
  assert.equal(JSON.parse(writtenValue).people[0].name, "田中");
  assert.ok(JSON.parse(writtenValue).scenes.includes("その他"));
});
