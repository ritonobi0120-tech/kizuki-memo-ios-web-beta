export const DEFAULT_SCENES = ["仕事", "生活", "会話", "予定", "体調", "連絡", "気づき", "その他"];
export const DEFAULT_FOLDER_PRESETS = [
  { icon: "📁", colorKey: "sky" },
  { icon: "📁", colorKey: "mint" },
  { icon: "📁", colorKey: "amber" },
  { icon: "📁", colorKey: "rose" },
  { icon: "📁", colorKey: "sand" },
];

export function emptyState() {
  return {
    people: [],
    folders: [],
    memos: [],
    summaries: [],
    scenes: [...DEFAULT_SCENES],
  };
}

export function createDemoState() {
  const now = Date.now();
  const folders = [
    makeFolder("すぐ話す", 0, now - 3600_000, DEFAULT_FOLDER_PRESETS[0]),
    makeFolder("あとで整理", 1, now - 3200_000, DEFAULT_FOLDER_PRESETS[2]),
  ];
  const people = [
    makePerson("田中 はる", 0, now - 1800_000, folders[0].id),
    makePerson("佐藤 あおい", 1, now - 7200_000, folders[1].id),
    makePerson("鈴木 けん", 2, now - 8600_000, null),
  ];
  return {
    people,
    folders,
    memos: [
      makeMemo(people[0].id, now - 1800_000, "朝の会で自分から話し始めていた", "会話"),
      makeMemo(people[0].id, now - 900_000, "切り替えの声かけで落ち着いて動けた", "生活"),
      makeMemo(people[1].id, now - 5400_000, "予定の変更で少し迷っていた", "予定"),
      makeMemo(people[2].id, now - 3600_000, "友だちに声をかけて一緒に片づけていた", "生活"),
    ],
    summaries: [
      {
        personId: people[0].id,
        summaryText: "最近は自分から動き始める場面が少しずつ増えている。",
        summaryUpdatedAt: new Date(now - 2400_000).toISOString(),
      },
    ],
    scenes: [...DEFAULT_SCENES],
  };
}

export function summarizeStateCounts(sourceState) {
  const normalized = normalizeImportedState(sourceState);
  return {
    people: normalized.people.length,
    folders: normalized.folders.length,
    memos: normalized.memos.length,
    summaries: normalized.summaries.length,
    scenes: normalized.scenes.length,
  };
}

export function buildImportConfirmationMessage(fileName, counts) {
  return [
    `${fileName} を読み込みます。`,
    "この beta の保存データを読み込んだ内容で置き換えます。",
    `- 名前 ${counts.people} 人`,
    `- フォルダ ${counts.folders} 個`,
    `- メモ ${counts.memos} 件`,
    `- 整理ノート ${counts.summaries} 件`,
    `- 場面 ${counts.scenes} 件`,
    "続けますか。",
  ].join("\n");
}

export function buildStateExport({
  state,
  appId,
  schemaVersion,
  exportedAt = new Date().toISOString(),
}) {
  const payload = {
    app: appId,
    schemaVersion,
    exportedAt,
    recordCounts: summarizeStateCounts(state),
    state: normalizeImportedState(state),
  };
  return {
    filename: `${appId}-${formatFilenameDate(new Date(exportedAt))}.json`,
    jsonText: JSON.stringify(payload, null, 2),
    payload,
  };
}

export function loadState({ storage, storageKey }) {
  try {
    const parsed = JSON.parse(storage.getItem(storageKey) || "null");
    if (parsed) {
      return normalizeImportedState(parsed);
    }
  } catch {
    // ignore and reseed
  }
  return emptyState();
}

export function persistState({ storage, storageKey, state }) {
  storage.setItem(storageKey, JSON.stringify(normalizeImportedState(state)));
}

export function normalizeImportedState(candidateState) {
  if (!candidateState || typeof candidateState !== "object") {
    throw new Error("invalid");
  }
  const peopleSource = Array.isArray(candidateState.people) ? candidateState.people : null;
  const memosSource = Array.isArray(candidateState.memos) ? candidateState.memos : null;
  const summariesSource = Array.isArray(candidateState.summaries) ? candidateState.summaries : null;
  if (!peopleSource || !memosSource || !summariesSource) {
    throw new Error("invalid");
  }

  const usedFolderIds = new Set();
  const folders = (Array.isArray(candidateState.folders) ? candidateState.folders : [])
    .map((folder, index) => normalizeImportedFolder(folder, index, usedFolderIds))
    .filter(Boolean);
  const folderIds = new Set(folders.map((folder) => folder.id));
  const usedPersonIds = new Set();
  const people = peopleSource
    .map((person, index) => normalizeImportedPerson(person, index, usedPersonIds, folderIds))
    .filter(Boolean);
  const personIds = new Set(people.map((person) => person.id));

  const sceneSet = new Set(DEFAULT_SCENES);
  if (Array.isArray(candidateState.scenes)) {
    candidateState.scenes.forEach((scene) => {
      const normalized = normalizeOptionalText(scene);
      if (normalized) {
        sceneSet.add(normalized);
      }
    });
  }

  const memos = memosSource.map((memo) => normalizeImportedMemo(memo, personIds)).filter(Boolean);
  memos.forEach((memo) => {
    if (memo.scene) {
      sceneSet.add(memo.scene);
    }
  });

  const summariesByPersonId = new Map();
  summariesSource
    .map((summary) => normalizeImportedSummary(summary, personIds))
    .filter(Boolean)
    .forEach((summary) => {
      const current = summariesByPersonId.get(summary.personId);
      if (!current || current.summaryUpdatedAt < summary.summaryUpdatedAt) {
        summariesByPersonId.set(summary.personId, summary);
      }
    });

  return {
    people: people.sort((a, b) => a.sortOrder - b.sortOrder),
    folders: folders.sort((a, b) => a.sortOrder - b.sortOrder),
    memos,
    summaries: [...summariesByPersonId.values()],
    scenes: [...sceneSet],
  };
}

export function formatFilenameDate(value) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function makeFolder(name, sortOrder, touchedAtMs, preset = DEFAULT_FOLDER_PRESETS[0]) {
  const now = new Date(touchedAtMs).toISOString();
  return {
    id: generateId(),
    name,
    icon: preset.icon,
    colorKey: preset.colorKey,
    sortOrder,
    createdAt: now,
    updatedAt: now,
  };
}

function makePerson(name, sortOrder, lastAccessedAtMs, folderId) {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    name,
    folderId,
    sortOrder,
    createdAt: now,
    updatedAt: now,
    lastAccessedAt: new Date(lastAccessedAtMs).toISOString(),
  };
}

function makeMemo(personId, observedAtMs, rawText, scene) {
  const observedAt = new Date(observedAtMs).toISOString();
  return {
    id: generateId(),
    personId,
    observedAt,
    createdAt: observedAt,
    updatedAt: observedAt,
    rawText,
    scene,
  };
}

function normalizeImportedFolder(folder, index, usedFolderIds) {
  if (!folder || typeof folder !== "object") {
    return null;
  }
  const name = normalizeRequiredText(folder.name);
  if (!name) {
    return null;
  }
  const id = uniqueIdFrom(folder.id, usedFolderIds);
  return {
    id,
    name,
    icon: normalizeOptionalText(folder.icon) || DEFAULT_FOLDER_PRESETS[0].icon,
    colorKey: normalizeOptionalText(folder.colorKey) || DEFAULT_FOLDER_PRESETS[0].colorKey,
    sortOrder: normalizeSortOrder(folder.sortOrder, index),
    createdAt: normalizeIsoString(folder.createdAt),
    updatedAt: normalizeIsoString(folder.updatedAt),
  };
}

function normalizeImportedPerson(person, index, usedPersonIds, folderIds) {
  if (!person || typeof person !== "object") {
    return null;
  }
  const name = normalizeRequiredText(person.name);
  if (!name) {
    return null;
  }
  const id = uniqueIdFrom(person.id, usedPersonIds);
  return {
    id,
    name,
    folderId: typeof person.folderId === "string" && folderIds.has(person.folderId) ? person.folderId : null,
    sortOrder: normalizeSortOrder(person.sortOrder, index),
    createdAt: normalizeIsoString(person.createdAt),
    updatedAt: normalizeIsoString(person.updatedAt),
    lastAccessedAt: normalizeNullableIsoString(person.lastAccessedAt),
  };
}

function normalizeImportedMemo(memo, personIds) {
  if (!memo || typeof memo !== "object") {
    return null;
  }
  const personId = normalizeRequiredText(memo.personId);
  const rawText = normalizeRequiredText(memo.rawText);
  if (!personId || !personIds.has(personId) || !rawText) {
    return null;
  }
  return {
    id: normalizeRequiredText(memo.id) || generateId(),
    personId,
    observedAt: normalizeIsoString(memo.observedAt),
    createdAt: normalizeIsoString(memo.createdAt ?? memo.observedAt),
    updatedAt: normalizeIsoString(memo.updatedAt ?? memo.observedAt),
    rawText,
    scene: normalizeOptionalText(memo.scene),
  };
}

function normalizeImportedSummary(summary, personIds) {
  if (!summary || typeof summary !== "object") {
    return null;
  }
  const personId = normalizeRequiredText(summary.personId);
  if (!personId || !personIds.has(personId)) {
    return null;
  }
  return {
    personId,
    summaryText: typeof summary.summaryText === "string" ? summary.summaryText.trim() : "",
    summaryUpdatedAt: normalizeIsoString(summary.summaryUpdatedAt),
  };
}

function normalizeRequiredText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOptionalText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSortOrder(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function normalizeIsoString(value) {
  if (typeof value === "string" && !Number.isNaN(Date.parse(value))) {
    return new Date(value).toISOString();
  }
  return new Date().toISOString();
}

function normalizeNullableIsoString(value) {
  if (value == null || value === "") {
    return null;
  }
  return normalizeIsoString(value);
}

function uniqueIdFrom(value, usedIds) {
  let candidate = normalizeRequiredText(value) || generateId();
  while (usedIds.has(candidate)) {
    candidate = generateId();
  }
  usedIds.add(candidate);
  return candidate;
}

function generateId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
