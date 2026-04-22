export const BOARD_FILTERS = [
  { id: "all", label: "すべて" },
  { id: "pending", label: "未整理あり" },
];

export function applyBoardFilter({
  people,
  filter,
  getPendingCount,
  isPinned = (person) => Boolean(person.isPinned),
}) {
  switch (filter) {
    case "pending":
      return people.filter((person) => getPendingCount(person.id) > 0);
    case "pinned":
      return people.filter(isPinned);
    default:
      return people;
  }
}

export function buildBoardSummary({
  people,
  getPendingCount,
  folderCount = 0,
}) {
  return {
    totalCount: people.length,
    pendingCount: people.filter((person) => getPendingCount(person.id) > 0).length,
    folderCount,
  };
}

export function nextMemosForHandoff({ memos, summaryUpdatedAt }) {
  return memos.filter((memo) => {
    if (!summaryUpdatedAt) return true;
    return memo.observedAt > summaryUpdatedAt;
  });
}

export function resolveIncludedMemos({
  memos,
  summaryUpdatedAt,
  preparedMemoIds = [],
}) {
  return preparedMemoIds.length > 0
    ? memos.filter((memo) => preparedMemoIds.includes(memo.id))
    : nextMemosForHandoff({ memos, summaryUpdatedAt });
}

export function buildHandoffBundle({
  personName,
  summaryText,
  summaryUpdatedAt,
  memos,
  preparedMemoIds = [],
  exportedAt,
  formatDateTime,
}) {
  const includedMemos = resolveIncludedMemos({
    memos,
    summaryUpdatedAt,
    preparedMemoIds,
  });
  const lines = [
    "# きづきメモ",
    `- 名前: ${personName || "不明"}`,
    `- 出力日時: ${formatDateTime(exportedAt)}`,
    `- 整理ノート最終更新: ${summaryUpdatedAt ? formatDateTime(summaryUpdatedAt) : "未作成"}`,
    "",
    "## 現在の整理ノート",
    summaryText || "なし",
    "",
    "## 新規メモ",
    ...(includedMemos.length
      ? includedMemos.map((memo) => `- ${formatDateTime(memo.observedAt)} ${memo.scene ? `[${memo.scene}] ` : ""}${memo.rawText}`)
      : ["- なし"]),
  ];
  const plain = lines.join("\n");
  return {
    plain,
    copyText: `\`\`\`markdown\n${plain}\n\`\`\``,
    includedMemoIds: includedMemos.map((memo) => memo.id),
  };
}

export function buildBulkAiExport({
  people,
  memos,
  summaries,
  batchId,
  exportedAt,
}) {
  const summaryByPersonId = new Map(summaries.map((summary) => [summary.personId, summary]));
  const memosByPersonId = new Map();
  memos.forEach((memo) => {
    const list = memosByPersonId.get(memo.personId) ?? [];
    list.push(memo);
    memosByPersonId.set(memo.personId, list);
  });

  const pendingPeople = people
    .map((person) => {
      const summary = summaryByPersonId.get(person.id);
      const pendingMemos = nextMemosForHandoff({
        memos: (memosByPersonId.get(person.id) ?? []).slice().sort((left, right) => left.observedAt.localeCompare(right.observedAt)),
        summaryUpdatedAt: summary?.summaryUpdatedAt ?? null,
      });
      if (pendingMemos.length === 0) return null;
      return {
        personId: person.id,
        personName: person.name,
        currentSummary: summary?.summaryText ?? "",
        pendingMemos,
      };
    })
    .filter(Boolean);

  const payload = {
    schema: "kizuki-batch-export-v1",
    batchId,
    exportedAt,
    personCount: pendingPeople.length,
    memoCount: pendingPeople.reduce((sum, person) => sum + person.pendingMemos.length, 0),
    people: pendingPeople.map((person, index) => ({
      personToken: `P${String(index + 1).padStart(2, "0")}`,
      currentSummary: person.currentSummary,
      pendingMemos: person.pendingMemos.map((memo) => ({
        observedAt: memo.observedAt,
        rawText: memo.rawText,
        scene: memo.scene || undefined,
      })),
    })),
  };

  return {
    pendingPeople,
    payload,
    copyText: `\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``,
    session: {
      batchId,
      createdAt: exportedAt,
      people: pendingPeople.map((person, index) => ({
        personToken: `P${String(index + 1).padStart(2, "0")}`,
        personId: person.personId,
        personName: person.personName,
        includedMemoIds: person.pendingMemos.map((memo) => memo.id),
      })),
    },
  };
}

export function parseBulkAiResponse({ responseText, session }) {
  const jsonText = extractJsonObject(responseText);
  if (!jsonText) {
    return { parseError: "invalid_json", preview: null };
  }

  let payload;
  try {
    payload = JSON.parse(jsonText);
  } catch {
    return { parseError: "invalid_json", preview: null };
  }

  if (payload?.schema !== "kizuki-batch-response-v1") {
    return { parseError: "invalid_schema", preview: null };
  }
  if (payload?.batchId !== session?.batchId) {
    return { parseError: "batch_mismatch", preview: null };
  }
  if (!Array.isArray(payload?.results) || payload.results.length === 0) {
    return { parseError: "empty_results", preview: null };
  }

  const resultsByToken = new Map();
  payload.results.forEach((result) => {
    const list = resultsByToken.get(result.personToken) ?? [];
    list.push(result);
    resultsByToken.set(result.personToken, list);
  });

  const successes = [];
  const failures = [];
  const knownTokens = new Set(session.people.map((person) => person.personToken));

  [...resultsByToken.keys()]
    .filter((token) => !knownTokens.has(token))
    .forEach((token) => {
      failures.push({ personToken: token, personId: null, personName: null, reason: "unknown_token" });
    });

  session.people.forEach((person) => {
    const results = resultsByToken.get(person.personToken) ?? [];
    if (results.length === 0) {
      failures.push({
        personToken: person.personToken,
        personId: person.personId,
        personName: person.personName,
        reason: "missing_result",
      });
      return;
    }
    if (results.length > 1) {
      failures.push({
        personToken: person.personToken,
        personId: person.personId,
        personName: person.personName,
        reason: "duplicate_token",
      });
      return;
    }
    const summaryText = String(results[0].summaryText ?? "").trim();
    if (!summaryText) {
      failures.push({
        personToken: person.personToken,
        personId: person.personId,
        personName: person.personName,
        reason: "empty_summary",
      });
      return;
    }
    successes.push({
      personToken: person.personToken,
      personId: person.personId,
      personName: person.personName,
      summaryText,
      includedMemoIds: [...person.includedMemoIds],
    });
  });

  return {
    parseError: null,
    preview: {
      batchId: session.batchId,
      successEntries: successes,
      failureEntries: failures,
    },
  };
}

function extractJsonObject(rawText) {
  const fenced = rawText.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  if (fenced) return fenced;
  const trimmed = rawText.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  const firstBrace = rawText.indexOf("{");
  const lastBrace = rawText.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace <= firstBrace) return "";
  return rawText.slice(firstBrace, lastBrace + 1).trim();
}
