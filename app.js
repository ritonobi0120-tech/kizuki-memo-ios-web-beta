import {
  composeDraftText,
  detectSpeechSupport,
  mapSpeechErrorMessage,
} from "./speech-support.mjs";

const STORAGE_KEY = "kizuki-ios-web-beta-v1";
const STORAGE_SCHEMA_VERSION = 1;
const DEFAULT_SCENES = ["仕事", "生活", "会話", "予定", "体調", "連絡", "気づき", "その他"];
const WEB_BETA_BUILD_LABEL = "2026-04-15 更新導線 hardening";
const PUBLIC_WEB_BETA_URL = "https://ritonobi0120-tech.github.io/kizuki-memo-ios-web-beta/";
const dialogForms = {
  person: document.querySelector("#person-dialog form"),
  capture: document.querySelector("#capture-dialog form"),
  handoff: document.querySelector("#handoff-dialog form"),
  confirmDelete: document.querySelector("#confirm-delete-dialog form"),
};
const dialogs = {
  person: document.getElementById("person-dialog"),
  capture: document.getElementById("capture-dialog"),
  discardCapture: document.getElementById("discard-capture-dialog"),
  preview: document.getElementById("preview-dialog"),
  handoff: document.getElementById("handoff-dialog"),
  discardHandoff: document.getElementById("discard-handoff-dialog"),
  settings: document.getElementById("settings-dialog"),
  confirmDelete: document.getElementById("confirm-delete-dialog"),
};

const elements = {
  installCard: document.getElementById("install-card"),
  searchInput: document.getElementById("search-input"),
  peopleGrid: document.getElementById("people-grid"),
  emptyState: document.getElementById("empty-state"),
  addPersonButton: document.getElementById("add-person-button"),
  openSettingsButton: document.getElementById("open-settings-button"),
  personDialogTitle: document.getElementById("person-dialog-title"),
  personNameInput: document.getElementById("person-name-input"),
  capturePersonName: document.getElementById("capture-person-name"),
  captureObservedAt: document.getElementById("capture-observed-at"),
  captureDraft: document.getElementById("capture-draft"),
  captureScene: document.getElementById("capture-scene"),
  captureCloseButton: document.getElementById("capture-close-button"),
  captureCancelButton: document.getElementById("capture-cancel-button"),
  focusDraftButton: document.getElementById("focus-draft-button"),
  speechToggleButton: document.getElementById("speech-toggle-button"),
  speechStatus: document.getElementById("speech-status"),
  discardCaptureCancelButton: document.getElementById("discard-capture-cancel-button"),
  discardCaptureConfirmButton: document.getElementById("discard-capture-confirm-button"),
  previewPersonName: document.getElementById("preview-person-name"),
  previewSummaryText: document.getElementById("preview-summary-text"),
  previewMemoList: document.getElementById("preview-memo-list"),
  previewQuickRecord: document.getElementById("preview-quick-record"),
  previewAiButton: document.getElementById("preview-ai-button"),
  previewCloseButton: document.getElementById("preview-close-button"),
  handoffPersonName: document.getElementById("handoff-person-name"),
  handoffPendingCount: document.getElementById("handoff-pending-count"),
  handoffCopyBlock: document.getElementById("handoff-copy-block"),
  copyHandoffButton: document.getElementById("copy-handoff-button"),
  handoffImportText: document.getElementById("handoff-import-text"),
  handoffCloseButton: document.getElementById("handoff-close-button"),
  handoffCancelButton: document.getElementById("handoff-cancel-button"),
  discardHandoffCancelButton: document.getElementById("discard-handoff-cancel-button"),
  discardHandoffConfirmButton: document.getElementById("discard-handoff-confirm-button"),
  settingsCloseButton: document.getElementById("settings-close-button"),
  webBuildLabel: document.getElementById("web-build-label"),
  refreshAppButton: document.getElementById("refresh-app-button"),
  openPublicBetaButton: document.getElementById("open-public-beta-button"),
  exportJsonButton: document.getElementById("export-json-button"),
  importJsonInput: document.getElementById("import-json-input"),
  seedDemoButton: document.getElementById("seed-demo-button"),
  resetDataButton: document.getElementById("reset-data-button"),
  confirmDeleteButton: document.getElementById("confirm-delete-button"),
  toast: document.getElementById("toast"),
};

let state = loadState();
let ui = {
  searchText: "",
  editingPersonId: null,
  capturePersonId: null,
  captureObservedAt: new Date().toISOString(),
  previewPersonId: null,
  handoffPersonId: null,
  handoffPreparedMemoIds: [],
  pendingDeleteMemoId: null,
  captureDiscardRequested: false,
  handoffDiscardRequested: false,
};

const speech = {
  support: detectSpeechSupport(),
  recognition: null,
  active: false,
  manuallyStopped: false,
  baseText: "",
  confirmedText: "",
  lastErrorMessage: "",
};

boot();

function boot() {
  bindEvents();
  ensureSeeded();
  render();
  syncDialogBodyState();
  bindDialogStateEvents();
  registerServiceWorker();
}

function bindEvents() {
  elements.searchInput.addEventListener("input", (event) => {
    ui.searchText = event.target.value;
    render();
  });

  elements.addPersonButton.addEventListener("click", () => {
    openPersonDialog();
  });

  elements.openSettingsButton.addEventListener("click", () => {
    showPreparedDialog(dialogs.settings);
  });
  elements.settingsCloseButton.addEventListener("click", () => dialogs.settings.close());

  dialogForms.person.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = elements.personNameInput.value.trim();
    if (!name) return;
    const { personId, created } = savePerson(name);
    dialogs.person.close("saved");
    if (created && personId) {
      openCapture(personId);
    }
  });

  dialogs.capture.addEventListener("close", () => {
    if (dialogs.capture.returnValue === "saved") return;
    if (ui.captureDiscardRequested) {
      ui.captureDiscardRequested = false;
      return;
    }
    clearCaptureDraft();
  });
  dialogs.capture.addEventListener("cancel", (event) => {
    event.preventDefault();
    requestCaptureClose();
  });
  dialogs.handoff.addEventListener("close", () => {
    if (dialogs.handoff.returnValue === "saved") return;
    if (ui.handoffDiscardRequested) {
      ui.handoffDiscardRequested = false;
      return;
    }
    clearHandoffDraft();
  });
  dialogs.handoff.addEventListener("cancel", (event) => {
    event.preventDefault();
    requestHandoffClose();
  });

  dialogForms.capture.addEventListener("submit", (event) => {
    event.preventDefault();
    saveMemoFromCapture();
    dialogs.capture.close("saved");
  });

  elements.focusDraftButton.addEventListener("click", () => {
    elements.captureDraft.focus();
  });
  elements.captureCloseButton.addEventListener("click", requestCaptureClose);
  elements.captureCancelButton.addEventListener("click", requestCaptureClose);

  elements.speechToggleButton.addEventListener("click", () => {
    if (speech.active) {
      stopSpeechRecognition({ manual: true });
      return;
    }
    startSpeechRecognition();
  });

  elements.previewQuickRecord.addEventListener("click", () => {
    const personId = ui.previewPersonId;
    dialogs.preview.close();
    if (personId) openCapture(personId);
  });

  elements.previewAiButton.addEventListener("click", () => {
    const personId = ui.previewPersonId;
    dialogs.preview.close();
    if (personId) openHandoff(personId);
  });

  elements.previewCloseButton.addEventListener("click", () => dialogs.preview.close());
  elements.handoffCloseButton.addEventListener("click", requestHandoffClose);
  elements.handoffCancelButton.addEventListener("click", requestHandoffClose);

  elements.copyHandoffButton.addEventListener("click", async () => {
    if (!ui.handoffPersonId) return;
    const bundle = buildHandoffBundle(ui.handoffPersonId);
    try {
      await writeTextToClipboard(bundle.copyText);
      ui.handoffPreparedMemoIds = [...bundle.includedMemoIds];
      renderHandoff();
      toast("AI に送る文をコピーしました");
    } catch {
      toast("コピーできませんでした。長押しでコピーしてください。");
    }
  });

  dialogForms.handoff.addEventListener("submit", (event) => {
    event.preventDefault();
    saveSummaryFromHandoff();
  });

  elements.refreshAppButton.addEventListener("click", refreshAppVersion);
  elements.openPublicBetaButton.addEventListener("click", openPublicBetaPage);
  elements.exportJsonButton.addEventListener("click", exportStateAsJson);
  elements.importJsonInput.addEventListener("change", importStateFromJson);
  elements.seedDemoButton.addEventListener("click", () => {
    state = createDemoState();
    persistState();
    render();
    toast("デモデータを入れました");
  });
  elements.resetDataButton.addEventListener("click", () => {
    if (!window.confirm("この beta の保存データを消します。よろしいですか。")) return;
    state = emptyState();
    persistState();
    render();
    dialogs.settings.close();
    toast("保存データを消しました");
  });

  dialogForms.confirmDelete.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!ui.pendingDeleteMemoId) return;
    deleteMemo(ui.pendingDeleteMemoId);
    ui.pendingDeleteMemoId = null;
    dialogs.confirmDelete.close("confirm");
  });

  dialogs.confirmDelete.addEventListener("close", () => {
    if (dialogs.confirmDelete.returnValue === "confirm") return;
    ui.pendingDeleteMemoId = null;
  });

  elements.discardCaptureCancelButton.addEventListener("click", () => dialogs.discardCapture.close());
  elements.discardCaptureConfirmButton.addEventListener("click", () => {
    dialogs.discardCapture.close("confirm");
    forceCloseCapture();
  });
  elements.discardHandoffCancelButton.addEventListener("click", () => dialogs.discardHandoff.close());
  elements.discardHandoffConfirmButton.addEventListener("click", () => {
    dialogs.discardHandoff.close("confirm");
    forceCloseHandoff();
  });
}

function render() {
  renderSettingsMeta();
  renderInstallCard();
  renderPeople();
  renderCapture();
  renderPreview();
  renderHandoff();
  renderSpeechStatus();
}

function renderInstallCard() {
  const standalone = window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
  elements.installCard.hidden = standalone || state.people.length >= 3;
}

function renderSettingsMeta() {
  elements.webBuildLabel.textContent = `現在の版: ${WEB_BETA_BUILD_LABEL}`;
}

function renderPeople() {
  const visiblePeople = state.people
    .filter((person) => person.name.includes(ui.searchText.trim()))
    .sort((a, b) => {
      const aTime = a.lastAccessedAt ?? "";
      const bTime = b.lastAccessedAt ?? "";
      return bTime.localeCompare(aTime) || a.sortOrder - b.sortOrder;
    });

  elements.peopleGrid.innerHTML = "";
  elements.emptyState.hidden = visiblePeople.length > 0;

  for (const person of visiblePeople) {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "person-tile";
    tile.innerHTML = `
      <div class="tile-top">
        <strong>${escapeHtml(person.name)}</strong>
        ${pendingMemoCount(person.id) > 0 ? `<span class="badge">${pendingMemoCount(person.id)}</span>` : ""}
      </div>
      <div class="tile-meta">${person.lastAccessedAt ? formatDateTime(person.lastAccessedAt) : "まだ記録なし"}</div>
    `;
    bindLongPress(tile, () => openPreview(person.id), () => openCapture(person.id));
    elements.peopleGrid.appendChild(tile);
  }
}

function renderCapture() {
  if (!ui.capturePersonId) return;
  const person = findPerson(ui.capturePersonId);
  if (!person) return;
  elements.capturePersonName.textContent = person.name;
  elements.captureObservedAt.textContent = formatDateTime(ui.captureObservedAt);
  fillSceneSelect();
  renderSpeechStatus();
}

function renderSpeechStatus(message = null, tone = "default") {
  const fallbackMessage = speech.support.available
    ? "大きいマイクボタンを押すと音声入力を試せます。うまくいかない時はキーボードのマイクへ切り替えます。"
    : "この iPhone ではボタン音声入力が使いにくいので、メモ欄を開いてキーボードのマイクを使ってください。";
  const activeMessage = "聞き取り中です。話し終わったらもう一度押すか、そのまま待ってください。";
  elements.speechToggleButton.textContent = speech.active ? "音声入力を止める" : "マイクで話す";
  elements.speechStatus.textContent = message || (speech.active ? activeMessage : fallbackMessage);
  elements.speechStatus.classList.toggle("is-active", tone === "active");
  elements.speechStatus.classList.toggle("is-warning", tone === "warning");
}

function renderPreview() {
  if (!ui.previewPersonId) return;
  const person = findPerson(ui.previewPersonId);
  if (!person) return;
  elements.previewPersonName.textContent = person.name;
  elements.previewSummaryText.textContent = summaryFor(person.id)?.summaryText || "整理ノートはまだありません";
  elements.previewMemoList.innerHTML = "";
  const memos = memosFor(person.id);
  if (memos.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.hidden = false;
    empty.innerHTML = "<p>まだ記録はありません。ここからそのまま音声記録を始められます。</p>";
    elements.previewMemoList.appendChild(empty);
    return;
  }
  for (const memo of memos) {
    elements.previewMemoList.appendChild(createSwipeMemoCard(memo));
  }
}

function renderHandoff() {
  if (!ui.handoffPersonId) return;
  const person = findPerson(ui.handoffPersonId);
  if (!person) return;
  const bundle = buildHandoffBundle(person.id);
  elements.handoffPersonName.textContent = person.name;
  elements.handoffPendingCount.textContent = `未整理メモ ${bundle.includedMemoIds.length} 件`;
  elements.handoffCopyBlock.textContent = bundle.copyText;
}

function openPersonDialog(personId = null) {
  ui.editingPersonId = personId;
  const person = personId ? findPerson(personId) : null;
  elements.personDialogTitle.textContent = person ? "名前を編集" : "名前を追加";
  elements.personNameInput.value = person?.name ?? "";
  showPreparedDialog(dialogs.person);
  window.setTimeout(() => elements.personNameInput.focus(), 30);
}

function openCapture(personId) {
  const person = findPerson(personId);
  if (!person) return;
  ui.capturePersonId = personId;
  ui.captureObservedAt = new Date().toISOString();
  elements.captureDraft.value = "";
  elements.captureScene.value = "";
  resetSpeechSession();
  renderCapture();
  showPreparedDialog(dialogs.capture);
  markOpened(personId);
}

function openPreview(personId) {
  ui.previewPersonId = personId;
  renderPreview();
  showPreparedDialog(dialogs.preview);
  markOpened(personId);
}

function openHandoff(personId) {
  ui.handoffPersonId = personId;
  ui.handoffPreparedMemoIds = buildHandoffBundle(personId).includedMemoIds;
  elements.handoffImportText.value = "";
  renderHandoff();
  showPreparedDialog(dialogs.handoff);
  markOpened(personId);
}

function savePerson(name) {
  if (ui.editingPersonId) {
    const person = findPerson(ui.editingPersonId);
    if (!person) return { personId: null, created: false };
    person.name = name;
    person.updatedAt = new Date().toISOString();
    persistState();
    render();
    return { personId: person.id, created: false };
  } else {
    const now = new Date().toISOString();
    const person = {
      id: crypto.randomUUID(),
      name,
      sortOrder: state.people.length,
      createdAt: now,
      updatedAt: now,
      lastAccessedAt: null,
    };
    state.people.push(person);
    persistState();
    render();
    return { personId: person.id, created: true };
  }
}

function saveMemoFromCapture() {
  const personId = ui.capturePersonId;
  const text = elements.captureDraft.value.trim();
  if (!personId || !text) {
    clearCaptureDraft();
    return;
  }
  const observedAt = ui.captureObservedAt;
  state.memos.push({
    id: crypto.randomUUID(),
    personId,
    observedAt,
    createdAt: observedAt,
    updatedAt: observedAt,
    rawText: text,
    scene: elements.captureScene.value || "",
  });
  persistState();
  clearCaptureDraft();
  render();
  toast("メモを保存しました");
}

function clearCaptureDraft() {
  stopSpeechRecognition({ manual: false, preserveStatus: false });
  ui.capturePersonId = null;
  elements.captureDraft.value = "";
  elements.captureScene.value = "";
  resetSpeechSession();
}

function hasCaptureDraftChanges() {
  return (
    elements.captureDraft.value.trim().length > 0 ||
    elements.captureScene.value.trim().length > 0 ||
    speech.confirmedText.trim().length > 0 ||
    speech.active
  );
}

function requestCaptureClose() {
  if (hasCaptureDraftChanges()) {
    showPreparedDialog(dialogs.discardCapture);
    return;
  }
  forceCloseCapture();
}

function forceCloseCapture() {
  ui.captureDiscardRequested = true;
  dialogs.capture.close("discard");
  clearCaptureDraft();
}

function clearHandoffDraft() {
  ui.handoffPersonId = null;
  ui.handoffPreparedMemoIds = [];
  elements.handoffImportText.value = "";
}

function hasHandoffDraftChanges() {
  return elements.handoffImportText.value.trim().length > 0;
}

function requestHandoffClose() {
  if (hasHandoffDraftChanges()) {
    showPreparedDialog(dialogs.discardHandoff);
    return;
  }
  forceCloseHandoff();
}

function forceCloseHandoff() {
  ui.handoffDiscardRequested = true;
  dialogs.handoff.close("discard");
  clearHandoffDraft();
}

function saveSummaryFromHandoff() {
  const personId = ui.handoffPersonId;
  const text = elements.handoffImportText.value.trim();
  if (!personId || !text) return;
  const now = new Date().toISOString();
  const existing = state.summaries.find((item) => item.personId === personId);
  if (existing) {
    existing.summaryText = text;
    existing.summaryUpdatedAt = now;
  } else {
    state.summaries.push({
      personId,
      summaryText: text,
      summaryUpdatedAt: now,
    });
  }
  const includedIds = [...ui.handoffPreparedMemoIds];
  state.memos = state.memos.filter((memo) => !includedIds.includes(memo.id));
  persistState();
  dialogs.handoff.close("saved");
  clearHandoffDraft();
  render();
  toast("整理ノートを保存しました");
}

function deleteMemo(memoId) {
  state.memos = state.memos.filter((memo) => memo.id !== memoId);
  persistState();
  render();
  if (dialogs.preview.open) renderPreview();
  toast("メモを削除しました");
}

function createSwipeMemoCard(memo) {
  const shell = document.createElement("div");
  shell.className = "swipe-shell";
  shell.innerHTML = `
    <div class="swipe-background">
      <button class="swipe-delete" type="button">削除</button>
    </div>
    <article class="memo-card">
      <div class="memo-time">${formatDateTime(memo.observedAt)}</div>
      <div class="memo-text">${escapeHtml(memo.rawText).replace(/\n/g, "<br>")}</div>
    </article>
  `;
  const card = shell.querySelector(".memo-card");
  const deleteButton = shell.querySelector(".swipe-delete");
  let startX = 0;
  let deltaX = 0;
  let dragging = false;

  card.addEventListener("pointerdown", (event) => {
    startX = event.clientX;
    deltaX = 0;
    dragging = true;
    card.setPointerCapture(event.pointerId);
  });
  card.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    deltaX = event.clientX - startX;
    if (deltaX < -20) {
      card.style.transform = `translateX(${Math.max(deltaX, -96)}px)`;
    }
  });
  const finishDrag = () => {
    if (!dragging) return;
    dragging = false;
    card.classList.toggle("revealed", deltaX < -72);
    card.style.transform = "";
  };
  card.addEventListener("pointerup", finishDrag);
  card.addEventListener("pointercancel", finishDrag);
  deleteButton.addEventListener("click", () => {
    ui.pendingDeleteMemoId = memo.id;
    dialogs.confirmDelete.showModal();
  });
  return shell;
}

function buildHandoffBundle(personId) {
  const person = findPerson(personId);
  const summary = summaryFor(personId);
  const includedMemos = memosFor(personId).filter((memo) => {
    if (!summary?.summaryUpdatedAt) return true;
    return memo.observedAt > summary.summaryUpdatedAt;
  });
  const exportedAt = new Date().toISOString();
  const lines = [
    "# きづきメモ",
    `- 名前: ${person?.name ?? "不明"}`,
    `- 出力日時: ${formatDateTime(exportedAt)}`,
    `- 整理ノート最終更新: ${summary?.summaryUpdatedAt ? formatDateTime(summary.summaryUpdatedAt) : "未作成"}`,
    "",
    "## 現在の整理ノート",
    summary?.summaryText || "なし",
    "",
    "## 新規メモ",
    ...(includedMemos.length
      ? includedMemos.map((memo) => `- ${formatDateTime(memo.observedAt)} ${memo.scene ? `[${memo.scene}] ` : ""}${memo.rawText}`)
      : ["- なし"]),
  ];
  const plain = lines.join("\n");
  return {
    copyText: `\`\`\`markdown\n${plain}\n\`\`\``,
    includedMemoIds: includedMemos.map((memo) => memo.id),
  };
}

function pendingMemoCount(personId) {
  return buildHandoffBundle(personId).includedMemoIds.length;
}

function memosFor(personId) {
  return state.memos
    .filter((memo) => memo.personId === personId)
    .sort((a, b) => b.observedAt.localeCompare(a.observedAt));
}

function summaryFor(personId) {
  return state.summaries.find((summary) => summary.personId === personId) || null;
}

function findPerson(personId) {
  return state.people.find((person) => person.id === personId) || null;
}

function markOpened(personId) {
  const person = findPerson(personId);
  if (!person) return;
  person.lastAccessedAt = new Date().toISOString();
  person.updatedAt = person.lastAccessedAt;
  persistState();
  renderPeople();
}

function fillSceneSelect() {
  const current = elements.captureScene.value;
  elements.captureScene.innerHTML = `<option value="">選ばない</option>${state.scenes
    .map((scene) => `<option value="${escapeHtml(scene)}">${escapeHtml(scene)}</option>`)
    .join("")}`;
  elements.captureScene.value = current;
}

function exportStateAsJson() {
  const payload = {
    app: "kizuki-ios-web-beta",
    schemaVersion: STORAGE_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    recordCounts: summarizeStateCounts(state),
    state: normalizeImportedState(state),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `kizuki-ios-web-beta-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  toast("JSON を書き出しました");
}

async function importStateFromJson(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const importedState = normalizeImportedState(parsed?.state ?? parsed);
    const counts = summarizeStateCounts(importedState);
    const shouldReplace = window.confirm(buildImportConfirmationMessage(file.name, counts));
    if (!shouldReplace) {
      toast("JSON 読み込みをキャンセルしました");
      return;
    }
    state = importedState;
    persistState();
    render();
    dialogs.settings.close();
    toast(`JSON を読み込みました（${counts.people}人 / メモ ${counts.memos}件）`);
  } catch {
    toast("JSON を読み込めませんでした");
  } finally {
    event.target.value = "";
  }
}

function emptyState() {
  return {
    people: [],
    memos: [],
    summaries: [],
    scenes: [...DEFAULT_SCENES],
  };
}

function ensureSeeded() {
  if (state.people.length > 0) return;
  state = createDemoState();
  persistState();
}

function createDemoState() {
  const now = Date.now();
  const people = [
    makePerson("田中 はる", 0, now - 1800_000),
    makePerson("佐藤 あおい", 1, now - 7200_000),
    makePerson("鈴木 けん", 2, now - 8600_000),
  ];
  return {
    people,
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

function makePerson(name, sortOrder, lastAccessedAtMs) {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name,
    sortOrder,
    createdAt: now,
    updatedAt: now,
    lastAccessedAt: new Date(lastAccessedAtMs).toISOString(),
  };
}

function makeMemo(personId, observedAtMs, rawText, scene) {
  const observedAt = new Date(observedAtMs).toISOString();
  return {
    id: crypto.randomUUID(),
    personId,
    observedAt,
    createdAt: observedAt,
    updatedAt: observedAt,
    rawText,
    scene,
  };
}

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (parsed) return normalizeImportedState(parsed);
  } catch {
    // ignore and reseed
  }
  return emptyState();
}

function persistState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeImportedState(state)));
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function toast(message) {
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => {
    elements.toast.hidden = true;
  }, 2600);
}

function bindLongPress(node, onLongPress, onTap) {
  let timer = null;
  let longPressed = false;
  node.addEventListener("pointerdown", () => {
    longPressed = false;
    timer = window.setTimeout(() => {
      longPressed = true;
      onLongPress();
    }, 420);
  });
  const cancel = () => {
    window.clearTimeout(timer);
  };
  node.addEventListener("pointerup", () => {
    if (!longPressed) onTap();
    cancel();
  });
  node.addEventListener("pointerleave", cancel);
  node.addEventListener("pointercancel", cancel);
  node.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    onLongPress();
  });
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function summarizeStateCounts(sourceState) {
  const normalized = normalizeImportedState(sourceState);
  return {
    people: normalized.people.length,
    memos: normalized.memos.length,
    summaries: normalized.summaries.length,
    scenes: normalized.scenes.length,
  };
}

function buildImportConfirmationMessage(fileName, counts) {
  return [
    `${fileName} を読み込みます。`,
    "この beta の保存データを読み込んだ内容で置き換えます。",
    `- 名前 ${counts.people} 人`,
    `- メモ ${counts.memos} 件`,
    `- 整理ノート ${counts.summaries} 件`,
    `- 場面 ${counts.scenes} 件`,
    "続けますか。",
  ].join("\n");
}

function normalizeImportedState(candidateState) {
  if (!candidateState || typeof candidateState !== "object") throw new Error("invalid");
  const peopleSource = Array.isArray(candidateState.people) ? candidateState.people : null;
  const memosSource = Array.isArray(candidateState.memos) ? candidateState.memos : null;
  const summariesSource = Array.isArray(candidateState.summaries) ? candidateState.summaries : null;
  if (!peopleSource || !memosSource || !summariesSource) throw new Error("invalid");

  const usedPersonIds = new Set();
  const people = peopleSource
    .map((person, index) => normalizeImportedPerson(person, index, usedPersonIds))
    .filter(Boolean);
  const personIds = new Set(people.map((person) => person.id));

  const sceneSet = new Set(DEFAULT_SCENES);
  if (Array.isArray(candidateState.scenes)) {
    candidateState.scenes.forEach((scene) => {
      const normalized = normalizeOptionalText(scene);
      if (normalized) sceneSet.add(normalized);
    });
  }

  const memos = memosSource
    .map((memo) => normalizeImportedMemo(memo, personIds))
    .filter(Boolean);
  memos.forEach((memo) => {
    if (memo.scene) sceneSet.add(memo.scene);
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
    memos,
    summaries: [...summariesByPersonId.values()],
    scenes: [...sceneSet],
  };
}

function normalizeImportedPerson(person, index, usedPersonIds) {
  if (!person || typeof person !== "object") return null;
  const name = normalizeRequiredText(person.name);
  if (!name) return null;
  const id = uniqueIdFrom(person.id, usedPersonIds);
  return {
    id,
    name,
    sortOrder: normalizeSortOrder(person.sortOrder, index),
    createdAt: normalizeIsoString(person.createdAt),
    updatedAt: normalizeIsoString(person.updatedAt),
    lastAccessedAt: normalizeNullableIsoString(person.lastAccessedAt),
  };
}

function normalizeImportedMemo(memo, personIds) {
  if (!memo || typeof memo !== "object") return null;
  const personId = normalizeRequiredText(memo.personId);
  const rawText = normalizeRequiredText(memo.rawText);
  if (!personId || !personIds.has(personId) || !rawText) return null;
  return {
    id: normalizeRequiredText(memo.id) || crypto.randomUUID(),
    personId,
    observedAt: normalizeIsoString(memo.observedAt),
    createdAt: normalizeIsoString(memo.createdAt ?? memo.observedAt),
    updatedAt: normalizeIsoString(memo.updatedAt ?? memo.observedAt),
    rawText,
    scene: normalizeOptionalText(memo.scene),
  };
}

function normalizeImportedSummary(summary, personIds) {
  if (!summary || typeof summary !== "object") return null;
  const personId = normalizeRequiredText(summary.personId);
  if (!personId || !personIds.has(personId)) return null;
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
  if (value == null || value === "") return null;
  return normalizeIsoString(value);
}

function uniqueIdFrom(value, usedIds) {
  let candidate = normalizeRequiredText(value) || crypto.randomUUID();
  while (usedIds.has(candidate)) {
    candidate = crypto.randomUUID();
  }
  usedIds.add(candidate);
  return candidate;
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("./sw.js");
  } catch {
    // ignore
  }
}

function bindDialogStateEvents() {
  for (const dialog of Object.values(dialogs)) {
    dialog.addEventListener("close", syncDialogBodyState);
    dialog.addEventListener("cancel", syncDialogBodyState);
  }
}

function syncDialogBodyState() {
  const anyOpen = Object.values(dialogs).some((dialog) => dialog.open);
  document.body.classList.toggle("dialog-open", anyOpen);
}

function showPreparedDialog(dialog) {
  resetDialogScroll(dialog);
  dialog.showModal();
  syncDialogBodyState();
}

function resetDialogScroll(dialog) {
  const content = dialog.querySelector(".sheet-content");
  if (content) {
    content.scrollTop = 0;
  }
}

async function refreshAppVersion() {
  elements.refreshAppButton.disabled = true;
  elements.refreshAppButton.textContent = "更新を確認中…";
  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister().catch(() => {})));
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("kizuki-ios-web-beta"))
          .map((key) => caches.delete(key).catch(() => false)),
      );
    }
    toast("最新版を確認して開き直します");
    window.setTimeout(() => {
      window.location.replace(buildRefreshUrl(window.location.href, Date.now()));
    }, 180);
  } catch {
    elements.refreshAppButton.disabled = false;
    elements.refreshAppButton.textContent = "最新版に更新する";
    toast("更新に失敗しました。公開ページを開き直してください。");
  }
}

function buildRefreshUrl(currentUrl, timestamp) {
  const url = new URL(currentUrl, window.location.href);
  url.searchParams.set("update", String(timestamp));
  return url.toString();
}

function openPublicBetaPage() {
  try {
    const opened = window.open(PUBLIC_WEB_BETA_URL, "_blank", "noopener");
    if (!opened) {
      window.location.assign(PUBLIC_WEB_BETA_URL);
    }
  } catch {
    window.location.assign(PUBLIC_WEB_BETA_URL);
  }
}

function startSpeechRecognition() {
  if (!speech.support.available) {
    renderSpeechStatus(mapSpeechErrorMessage("unsupported"), "warning");
    fallbackToKeyboardMic();
    return;
  }

  try {
    resetSpeechSession();
    const recognition = new speech.support.ctor();
    speech.recognition = recognition;
    speech.baseText = elements.captureDraft.value;
    speech.confirmedText = "";
    speech.lastErrorMessage = "";
    speech.manuallyStopped = false;
    recognition.lang = "ja-JP";
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.addEventListener("result", handleSpeechResult);
    recognition.addEventListener("error", handleSpeechError);
    recognition.addEventListener("end", handleSpeechEnd);

    recognition.start();
    speech.active = true;
    renderSpeechStatus(null, "active");
  } catch {
    renderSpeechStatus(mapSpeechErrorMessage("unsupported"), "warning");
    fallbackToKeyboardMic();
  }
}

function stopSpeechRecognition({ manual, preserveStatus = true }) {
  if (!speech.recognition) {
    speech.active = false;
    if (!preserveStatus) renderSpeechStatus();
    return;
  }

  const recognition = speech.recognition;
  speech.manuallyStopped = manual;
  try {
    recognition.stop();
  } catch {
    // ignore
  }
  speech.active = false;

  if (!preserveStatus) {
    renderSpeechStatus();
  } else if (manual) {
    renderSpeechStatus("音声入力を止めました。続けたい時はもう一度押してください。");
  }
}

function handleSpeechResult(event) {
  let interimText = "";
  for (let index = event.resultIndex; index < event.results.length; index += 1) {
    const result = event.results[index];
    const transcript = result[0]?.transcript?.trim() ?? "";
    if (!transcript) continue;
    if (result.isFinal) {
      speech.confirmedText = composeDraftText(speech.confirmedText, transcript);
    } else {
      interimText = composeDraftText(interimText, transcript);
    }
  }

  const combinedFinal = composeDraftText(speech.baseText, speech.confirmedText);
  elements.captureDraft.value = composeDraftText(combinedFinal, interimText);
}

function handleSpeechError(event) {
  speech.active = false;
  speech.lastErrorMessage = mapSpeechErrorMessage(event.error);
  renderSpeechStatus(speech.lastErrorMessage, "warning");
  if (event.error === "not-allowed" || event.error === "service-not-allowed" || event.error === "unsupported") {
    fallbackToKeyboardMic();
  }
}

function handleSpeechEnd() {
  speech.active = false;
  speech.recognition = null;
  elements.captureDraft.value = composeDraftText(speech.baseText, speech.confirmedText);
  if (speech.lastErrorMessage) {
    renderSpeechStatus(speech.lastErrorMessage, "warning");
  } else if (speech.manuallyStopped) {
    renderSpeechStatus("音声入力を止めました。続けたい時はもう一度押してください。");
  } else {
    renderSpeechStatus("音声入力を終えました。必要ならもう一度押して続きを話せます。");
  }
}

function fallbackToKeyboardMic() {
  elements.captureDraft.focus();
  toast("キーボードのマイクでそのまま話せます");
}

function resetSpeechSession() {
  speech.active = false;
  speech.manuallyStopped = false;
  speech.baseText = "";
  speech.confirmedText = "";
  speech.lastErrorMessage = "";
  speech.recognition = null;
  renderSpeechStatus();
}

async function writeTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const helper = document.createElement("textarea");
  helper.value = text;
  helper.setAttribute("readonly", "true");
  helper.style.position = "fixed";
  helper.style.opacity = "0";
  document.body.appendChild(helper);
  helper.focus();
  helper.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(helper);
  if (!copied) throw new Error("copy failed");
}
