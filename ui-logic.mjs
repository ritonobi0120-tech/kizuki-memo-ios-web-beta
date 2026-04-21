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
