import {
  composeDraftText,
  detectSpeechSupport,
  mapSpeechErrorMessage,
} from "./speech-support.mjs";
import {
  BOARD_FILTERS,
  applyBoardFilter,
  buildBoardSummary,
  buildBulkAiExport,
  buildHandoffBundle as buildUiHandoffBundle,
  nextMemosForHandoff,
  parseBulkAiResponse,
} from "./ui-logic.mjs";
import {
  DEFAULT_FOLDER_PRESETS,
  buildImportConfirmationMessage,
  buildStateExport,
  createDemoState as createDemoStorageState,
  emptyState as buildEmptyState,
  loadAuxJson,
  loadState as loadStoredState,
  normalizeImportedState,
  persistAuxJson,
  persistState as persistStoredState,
  summarizeStateCounts as summarizeStoredStateCounts,
} from "./storage-logic.mjs";
import {
  bindDialogStateEvents as bindDialogStateEventsHelper,
  bindLongPress as bindLongPressHelper,
  buildRefreshUrl as buildRefreshUrlHelper,
  escapeHtml as escapeHtmlHelper,
  showPreparedDialog as showPreparedDialogHelper,
  syncDialogBodyState as syncDialogBodyStateHelper,
} from "./dom-helpers.mjs";
import { matchesPersonSearch } from "./name-search.mjs";

const STORAGE_KEY = "kizuki-ios-web-beta-v1";
const BULK_AI_SESSION_KEY = "kizuki-ios-web-beta-bulk-ai-session-v1";
const STORAGE_SCHEMA_VERSION = 1;
const WEB_BETA_BUILD_LABEL = "2026-04-22 フォルダ必須導線補完";
const PUBLIC_WEB_BETA_URL = "https://ritonobi0120-tech.github.io/kizuki-memo-ios-web-beta/";
const FOLDER_COLOR_CHOICES = [
  { colorKey: "sky", label: "青", color: "#1A73E8" },
  { colorKey: "mint", label: "緑", color: "#188038" },
  { colorKey: "amber", label: "黄", color: "#F29900" },
  { colorKey: "rose", label: "赤", color: "#D93025" },
  { colorKey: "sand", label: "紫", color: "#8E63CE" },
];
const dialogForms = {
  person: document.querySelector("#person-dialog form"),
  capture: document.querySelector("#capture-dialog form"),
  handoff: document.querySelector("#handoff-dialog form"),
};
const dialogs = {
  person: document.getElementById("person-dialog"),
  capture: document.getElementById("capture-dialog"),
  discardCapture: document.getElementById("discard-capture-dialog"),
  preview: document.getElementById("preview-dialog"),
  moveFolder: document.getElementById("move-folder-dialog"),
  handoff: document.getElementById("handoff-dialog"),
  bulkAi: document.getElementById("bulk-ai-dialog"),
  discardHandoff: document.getElementById("discard-handoff-dialog"),
  settings: document.getElementById("settings-dialog"),
};

const elements = {
  installCard: document.getElementById("install-card"),
  boardSearchInput: document.getElementById("board-search-input"),
  boardSummary: document.getElementById("board-summary"),
  folderFilterBar: document.getElementById("folder-filter-bar"),
  folderManageCard: document.getElementById("folder-manage-card"),
  folderManageTitle: document.getElementById("folder-manage-title"),
  folderManageCaption: document.getElementById("folder-manage-caption"),
  renameFolderButton: document.getElementById("rename-folder-button"),
  changeFolderColorButton: document.getElementById("change-folder-color-button"),
  deleteFolderButton: document.getElementById("delete-folder-button"),
  boardFilterBar: document.getElementById("board-filter-bar"),
  peopleGrid: document.getElementById("people-grid"),
  emptyState: document.getElementById("empty-state"),
  selectionCountLabel: document.getElementById("selection-count-label"),
  selectModeButton: document.getElementById("select-mode-button"),
  moveSelectedButton: document.getElementById("move-selected-button"),
  cancelSelectionButton: document.getElementById("cancel-selection-button"),
  addPersonButton: document.getElementById("add-person-button"),
  addFolderButton: document.getElementById("add-folder-button"),
  openBulkAiButton: document.getElementById("open-bulk-ai-button"),
  openSettingsButton: document.getElementById("open-settings-button"),
  personDialogTitle: document.getElementById("person-dialog-title"),
  personNameInput: document.getElementById("person-name-input"),
  capturePersonName: document.getElementById("capture-person-name"),
  captureAutosaveStatus: document.getElementById("capture-autosave-status"),
  captureDraft: document.getElementById("capture-draft"),
  captureCloseButton: document.getElementById("capture-close-button"),
  speechToggleButton: document.getElementById("speech-toggle-button"),
  speechStatus: document.getElementById("speech-status"),
  speechPreview: document.getElementById("speech-preview"),
  discardCaptureCancelButton: document.getElementById("discard-capture-cancel-button"),
  discardCaptureConfirmButton: document.getElementById("discard-capture-confirm-button"),
  previewPersonName: document.getElementById("preview-person-name"),
  previewSummaryText: document.getElementById("preview-summary-text"),
  previewFolderChips: document.getElementById("preview-folder-chips"),
  previewCreateFolderButton: document.getElementById("preview-create-folder-button"),
  previewMemoList: document.getElementById("preview-memo-list"),
  previewAiSummary: document.getElementById("preview-ai-summary"),
  previewCopyAiButton: document.getElementById("preview-copy-ai-button"),
  previewQuickRecord: document.getElementById("preview-quick-record"),
  previewAiButton: document.getElementById("preview-ai-button"),
  previewCloseButton: document.getElementById("preview-close-button"),
  moveFolderSummary: document.getElementById("move-folder-summary"),
  moveFolderOptions: document.getElementById("move-folder-options"),
  moveFolderNewButton: document.getElementById("move-folder-new-button"),
  moveFolderCancelButton: document.getElementById("move-folder-cancel-button"),
  handoffPersonName: document.getElementById("handoff-person-name"),
  handoffPendingCount: document.getElementById("handoff-pending-count"),
  handoffCopyBlock: document.getElementById("handoff-copy-block"),
  copyHandoffButton: document.getElementById("copy-handoff-button"),
  handoffImportText: document.getElementById("handoff-import-text"),
  handoffCloseButton: document.getElementById("handoff-close-button"),
  handoffCancelButton: document.getElementById("handoff-cancel-button"),
  bulkAiSummary: document.getElementById("bulk-ai-summary"),
  bulkAiCloseButton: document.getElementById("bulk-ai-close-button"),
  bulkAiCopyButton: document.getElementById("bulk-ai-copy-button"),
  bulkAiActiveWarning: document.getElementById("bulk-ai-active-warning"),
  bulkAiPeople: document.getElementById("bulk-ai-people"),
  bulkAiResponseText: document.getElementById("bulk-ai-response-text"),
  bulkAiReviewButton: document.getElementById("bulk-ai-review-button"),
  bulkAiApplyButton: document.getElementById("bulk-ai-apply-button"),
  bulkAiPreviewMeta: document.getElementById("bulk-ai-preview-meta"),
  bulkAiPreviewList: document.getElementById("bulk-ai-preview-list"),
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
  toast: document.getElementById("toast"),
  toastMessage: document.getElementById("toast-message"),
  toastAction: document.getElementById("toast-action"),
};

let state = loadState();
let bulkAiSession = loadBulkAiSession();
let bulkAiPreview = null;
let bulkAiParseError = "";
let ui = {
  searchQuery: "",
  boardFilter: "all",
  folderFilter: "all",
  editingPersonId: null,
  capturePersonId: null,
  captureObservedAt: new Date().toISOString(),
  captureMemoId: null,
  captureAutosaveTimer: 0,
  previewPersonId: null,
  selectionMode: false,
  selectedPersonIds: [],
  handoffPersonId: null,
  handoffPreparedMemoIds: [],
  lastSavedPersonId: null,
  handoffDiscardRequested: false,
};

const speech = {
  support: detectSpeechSupport(),
  recognition: null,
  active: false,
  processing: false,
  manuallyStopped: false,
  baseText: "",
  confirmedText: "",
  liveText: "",
  lastErrorMessage: "",
};

let recentSaveTimeoutId = 0;
const toastState = {
  timer: 0,
  action: null,
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
  elements.boardSearchInput.addEventListener("input", () => {
    ui.searchQuery = elements.boardSearchInput.value;
    trimSelectionToVisible();
    renderPeople();
  });
  elements.folderFilterBar.addEventListener("click", (event) => {
    const button = event.target.closest("[data-folder-filter]");
    if (!button) return;
    ui.folderFilter = button.dataset.folderFilter;
    trimSelectionToVisible();
    render();
  });
  elements.boardFilterBar.addEventListener("click", (event) => {
    const button = event.target.closest("[data-board-filter]");
    if (!button) return;
    ui.boardFilter = button.dataset.boardFilter;
    trimSelectionToVisible();
    render();
  });

  elements.selectModeButton.addEventListener("click", () => {
    ui.selectionMode = true;
    ui.selectedPersonIds = [];
    render();
  });
  elements.moveSelectedButton.addEventListener("click", () => {
    if (ui.selectedPersonIds.length === 0) return;
    openMoveFolderDialog();
  });
  elements.cancelSelectionButton.addEventListener("click", () => {
    clearSelectionMode();
    render();
  });

  elements.addPersonButton.addEventListener("click", () => {
    openPersonDialog();
  });
  elements.addFolderButton.addEventListener("click", () => {
    createFolderFromPrompt();
  });
  elements.renameFolderButton.addEventListener("click", () => {
    renameSelectedFolder();
  });
  elements.changeFolderColorButton.addEventListener("click", () => {
    changeSelectedFolderColor();
  });
  elements.deleteFolderButton.addEventListener("click", () => {
    deleteSelectedFolder();
  });
  elements.openBulkAiButton.addEventListener("click", () => {
    openBulkAiDialog();
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

  elements.captureCloseButton.addEventListener("click", requestCaptureClose);
  elements.captureDraft.addEventListener("input", () => {
    scheduleCaptureAutosave();
  });

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
  elements.previewCopyAiButton.addEventListener("click", async () => {
    if (!ui.previewPersonId) return;
    await copyHandoffBundleForPerson(ui.previewPersonId);
  });

  elements.previewAiButton.addEventListener("click", () => {
    const personId = ui.previewPersonId;
    dialogs.preview.close();
    if (personId) openHandoff(personId);
  });

  elements.previewCloseButton.addEventListener("click", () => dialogs.preview.close());
  elements.previewCreateFolderButton.addEventListener("click", () => {
    if (!ui.previewPersonId) return;
    createFolderFromPrompt(ui.previewPersonId);
  });
  elements.moveFolderCancelButton.addEventListener("click", () => dialogs.moveFolder.close());
  elements.moveFolderNewButton.addEventListener("click", () => {
    const selectedIds = [...ui.selectedPersonIds];
    dialogs.moveFolder.close("new-folder");
    createFolderFromPrompt(selectedIds, { skipConfirmAssign: true });
  });
  elements.handoffCloseButton.addEventListener("click", requestHandoffClose);
  elements.handoffCancelButton.addEventListener("click", requestHandoffClose);
  elements.bulkAiCloseButton.addEventListener("click", () => dialogs.bulkAi.close());
  elements.bulkAiCopyButton.addEventListener("click", copyBulkAiBundle);
  elements.bulkAiReviewButton.addEventListener("click", reviewBulkAiResponse);
  elements.bulkAiApplyButton.addEventListener("click", applyBulkAiPreview);

  elements.copyHandoffButton.addEventListener("click", async () => {
    if (!ui.handoffPersonId) return;
    await copyHandoffBundleForPerson(ui.handoffPersonId);
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
    bulkAiSession = null;
    bulkAiPreview = null;
    bulkAiParseError = "";
    persistState();
    persistBulkAiSession();
    render();
    toast("デモデータを入れました");
  });
  elements.resetDataButton.addEventListener("click", () => {
    if (!window.confirm("この beta の保存データを消します。よろしいですか。")) return;
    state = emptyState();
    bulkAiSession = null;
    bulkAiPreview = null;
    bulkAiParseError = "";
    persistState();
    persistBulkAiSession();
    render();
    dialogs.settings.close();
    toast("保存データを消しました");
  });
  elements.toastAction.addEventListener("click", () => {
    const action = toastState.action;
    hideToast();
    if (action) {
      action();
    }
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
  renderSelectionActions();
  renderPeople();
  renderCapture();
  renderPreview();
  renderHandoff();
  renderBulkAi();
  renderSpeechStatus();
}

function renderInstallCard() {
  const standalone = window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
  elements.installCard.hidden = standalone || state.people.length >= 3;
}

function renderSettingsMeta() {
  elements.webBuildLabel.textContent = `現在の版: ${WEB_BETA_BUILD_LABEL}`;
}

function renderSelectionActions() {
  const selectedCount = ui.selectedPersonIds.length;
  elements.selectionCountLabel.hidden = !ui.selectionMode;
  elements.selectionCountLabel.textContent = `${selectedCount}人を選択中`;
  elements.selectModeButton.hidden = ui.selectionMode;
  elements.moveSelectedButton.hidden = !ui.selectionMode;
  elements.cancelSelectionButton.hidden = !ui.selectionMode;
  elements.moveSelectedButton.disabled = selectedCount === 0;
  elements.addPersonButton.hidden = ui.selectionMode;
  elements.addFolderButton.hidden = ui.selectionMode;
  elements.openBulkAiButton.hidden = ui.selectionMode;
}

function renderPeople() {
  const visiblePeople = currentVisiblePeople();
  elements.boardSearchInput.value = ui.searchQuery;

  renderBoardSummary(
    buildBoardSummary({
      people: state.people,
      getPendingCount: pendingMemoCount,
      folderCount: state.folders.length,
    }),
  );
  renderFolderFilters();
  renderFolderManager();
  renderBoardFilters();
  elements.peopleGrid.innerHTML = "";
  elements.emptyState.hidden = visiblePeople.length > 0;
  elements.emptyState.innerHTML =
    state.people.length === 0
      ? "<p>まだ名前がありません。まずは 1 人追加してください。</p>"
      : ui.searchQuery.trim()
        ? "<p>検索に合う名前が見つかりません。ひらがなや別の呼び方でも試してください。</p>"
      : "<p>このフォルダにはまだ名前がありません。フォルダを戻すか、別の名前を入れてください。</p>";

  const showFolderMeta = ui.folderFilter === "all";
  for (const person of visiblePeople) {
    const isRecentlySaved = person.id === ui.lastSavedPersonId;
    const isSelected = ui.selectedPersonIds.includes(person.id);
    const folder = folderFor(person.folderId);
    const badgeMarkup = [
      isSelected ? '<span class="tile-badge tile-badge--selected">選択中</span>' : "",
      isRecentlySaved ? '<span class="tile-badge tile-badge--saved">今の記録</span>' : "",
      pendingMemoCount(person.id) > 0
        ? `<span class="tile-badge tile-badge--pending">${pendingMemoCount(person.id)}</span>`
        : "",
    ]
      .filter(Boolean)
      .join("");
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = `person-tile${isRecentlySaved ? " is-recently-saved" : ""}${ui.selectionMode ? " is-selection-mode" : ""}${isSelected ? " is-selected" : ""}`;
    tile.innerHTML = `
      <div class="tile-top">
        <strong>${escapeHtml(person.name)}</strong>
        ${badgeMarkup ? `<div class="tile-badges">${badgeMarkup}</div>` : ""}
      </div>
      ${showFolderMeta ? `<div class="tile-meta">${folder ? `${folderIconMarkup(folder)}${escapeHtml(folder.name)}` : "未分類"}</div>` : ""}
    `;
    if (ui.selectionMode) {
      tile.addEventListener("click", () => {
        togglePersonSelection(person.id);
      });
    } else {
      bindLongPress(tile, () => openPreview(person.id), () => openCapture(person.id));
    }
    elements.peopleGrid.appendChild(tile);
  }
}

function renderFolderManager() {
  const folder = selectedFolder();
  elements.folderManageCard.hidden = !folder;
  if (!folder) return;
  const memberCount = state.people.filter((person) => person.folderId === folder.id).length;
  elements.folderManageTitle.innerHTML = `${folderIconMarkup(folder)}${escapeHtml(folder.name)}`;
  elements.folderManageCaption.textContent = `${memberCount}人がこのフォルダに入っています`;
}

function renderCapture() {
  if (!ui.capturePersonId) return;
  const person = findPerson(ui.capturePersonId);
  if (!person) return;
  elements.capturePersonName.textContent = person.name;
  elements.captureAutosaveStatus.textContent =
    ui.captureMemoId ? "自動保存済み。このまま閉じても残ります。" : "話すか入力すると自動で保存します。";
  renderSpeechStatus();
}

function renderSpeechStatus(message = null, tone = "default") {
  const readyMessage = "スタンバイOK。押したらすぐ話せます。";
  const activeMessage = "録音中です。話し終わったらもう一度押すか、そのまま待ってください。";
  const processingMessage = "聞き取った内容をまとめています。下のメモへ追記するまで少し待ってください。";
  const resolvedMessage =
    message || (speech.processing ? processingMessage : speech.active ? activeMessage : readyMessage);
  elements.speechToggleButton.disabled = false;
  elements.speechToggleButton.textContent = speech.processing
    ? "まとめ中…"
    : speech.active
      ? "止める"
      : "スタンバイOK";
  elements.speechToggleButton.classList.toggle("is-listening", speech.active);
  elements.speechToggleButton.classList.toggle("is-busy", speech.processing);
  elements.speechToggleButton.classList.toggle("is-standby", !speech.active && !speech.processing);
  elements.speechStatus.textContent = resolvedMessage;
  elements.speechStatus.classList.toggle("is-active", tone === "active");
  elements.speechStatus.classList.toggle("is-warning", tone === "warning");
  elements.speechStatus.classList.toggle("is-success", tone === "success");
  renderSpeechPreview();
}

function renderSpeechPreview() {
  const previewText = speech.liveText.trim();
  elements.speechPreview.hidden = previewText.length === 0;
  elements.speechPreview.textContent = previewText ? `聞き取り中: ${previewText}` : "";
}

function renderPreview() {
  if (!ui.previewPersonId) return;
  const person = findPerson(ui.previewPersonId);
  if (!person) return;
  const bundle = currentHandoffBundle(person.id);
  elements.previewPersonName.textContent = person.name;
  elements.previewSummaryText.textContent = summaryFor(person.id)?.summaryText || "整理ノートはまだありません";
  renderPreviewFolders(person);
  elements.previewAiSummary.textContent =
    bundle.includedMemoIds.length > 0
      ? `未整理メモ ${bundle.includedMemoIds.length} 件をそのままコピーできます`
      : "未整理のメモはありません。必要なら整理ノートだけ見直せます。";
  elements.previewCopyAiButton.textContent = `AI 用にコピー（${bundle.includedMemoIds.length}件）`;
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

function renderPreviewFolders(person) {
  const folderButtons = [
    { id: "unassigned", label: "未分類", selected: !person.folderId },
    ...state.folders.map((folder) => ({
      id: folder.id,
      label: folder.name,
      iconMarkup: folderIconMarkup(folder),
      selected: person.folderId === folder.id,
    })),
  ];
  elements.previewFolderChips.innerHTML = folderButtons
    .map(
      (folder) => `
        <button
          type="button"
          class="filter-pill${folder.selected ? " is-active" : ""}"
          data-preview-folder-id="${escapeHtml(String(folder.id))}"
        >
          ${folder.iconMarkup || ""}${escapeHtml(folder.label)}
        </button>
      `,
    )
    .join("");
  elements.previewFolderChips.querySelectorAll("[data-preview-folder-id]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!ui.previewPersonId) return;
      const nextFolderId = button.dataset.previewFolderId;
      assignPersonFolder(ui.previewPersonId, nextFolderId === "unassigned" ? null : nextFolderId);
      renderPreview();
      renderPeople();
    });
  });
}

function renderHandoff() {
  if (!ui.handoffPersonId) return;
  const person = findPerson(ui.handoffPersonId);
  if (!person) return;
  const bundle = currentHandoffBundle(person.id);
  elements.handoffPersonName.textContent = person.name;
  elements.handoffPendingCount.textContent = `未整理メモ ${bundle.includedMemoIds.length} 件`;
  elements.handoffCopyBlock.textContent = bundle.copyText;
}

function renderBulkAi() {
  const bundle = currentBulkAiBundle();
  elements.bulkAiSummary.textContent = bundle.pendingPeople.length
    ? `${bundle.pendingPeople.length}人 / 未整理メモ ${bundle.payload.memoCount}件`
    : "未整理メモはありません。";
  elements.bulkAiPeople.innerHTML = bundle.pendingPeople.length
    ? bundle.pendingPeople
        .map(
          (person) =>
            `<span class="filter-pill">${escapeHtml(person.personName)} (${person.pendingMemos.length}件)</span>`,
        )
        .join("")
    : `<span class="subtle">未整理メモはありません。</span>`;
  elements.bulkAiActiveWarning.hidden = !bulkAiSession;
  elements.bulkAiActiveWarning.textContent = bulkAiSession
    ? `未反映の一括整理があります。${bulkAiSession.people.length}人 / ${bulkAiSession.people.reduce((sum, person) => sum + person.includedMemoIds.length, 0)}件`
    : "";
  elements.bulkAiPreviewMeta.textContent = bulkAiParseError
    ? bulkAiParseErrorToText(bulkAiParseError)
    : bulkAiPreview
      ? `反映OK ${bulkAiPreview.successEntries.length}人 / 未反映 ${bulkAiPreview.failureEntries.length}人`
      : "返答を貼って「返答を確認する」を押すと、ここに反映予定が出ます。";
  elements.bulkAiPreviewList.innerHTML = bulkAiParseError
    ? `<p class=\"subtle\">${escapeHtml(bulkAiParseErrorToText(bulkAiParseError))}</p>`
    : renderBulkAiPreviewRows();
  elements.bulkAiApplyButton.disabled = !bulkAiPreview || bulkAiPreview.successEntries.length === 0;
}

function renderBulkAiPreviewRows() {
  if (!bulkAiPreview) {
    return `<p class="subtle">まだ確認前です。</p>`;
  }
  const successRows = bulkAiPreview.successEntries.length
    ? `
      <div class="stack">
        <p class="label">反映する名前</p>
        ${bulkAiPreview.successEntries
          .map(
            (entry) =>
              `<div class="bulk-preview-row bulk-preview-row--success"><strong>反映OK</strong><span>${escapeHtml(entry.personName)}</span></div>`,
          )
          .join("")}
      </div>
    `
    : "";
  const failureRows = bulkAiPreview.failureEntries.length
    ? `
      <div class="stack">
        <p class="label">確認が必要な名前</p>
        ${bulkAiPreview.failureEntries
          .map((entry) => {
            const label = entry.personName || entry.personToken || "不明";
            return `<div class="bulk-preview-row bulk-preview-row--failure"><strong>未反映</strong><span>${escapeHtml(
              `${label} / ${bulkAiFailureReasonToText(entry.reason)}`,
            )}</span></div>`;
          })
          .join("")}
      </div>
    `
    : "";
  return [successRows, failureRows].filter(Boolean).join("") || `<p class="subtle">反映できる名前がありません。</p>`;
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
  ui.captureMemoId = null;
  ui.captureObservedAt = new Date().toISOString();
  elements.captureDraft.value = "";
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
  const preparedForSamePerson = ui.handoffPersonId === personId && ui.handoffPreparedMemoIds.length > 0;
  if (!preparedForSamePerson) {
    prepareHandoffBundle(personId);
  } else {
    ui.handoffPersonId = personId;
  }
  elements.handoffImportText.value = "";
  renderHandoff();
  showPreparedDialog(dialogs.handoff);
  markOpened(personId);
}

function openBulkAiDialog() {
  bulkAiPreview = null;
  bulkAiParseError = "";
  elements.bulkAiResponseText.value = "";
  renderBulkAi();
  showPreparedDialog(dialogs.bulkAi);
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
      folderId: ui.folderFilter !== "all" && ui.folderFilter !== "unassigned" ? ui.folderFilter : null,
      isPinned: false,
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

function clearCaptureDraft() {
  if (ui.captureAutosaveTimer) {
    window.clearTimeout(ui.captureAutosaveTimer);
    ui.captureAutosaveTimer = 0;
  }
  stopSpeechRecognition({ manual: false, preserveStatus: false });
  ui.capturePersonId = null;
  ui.captureMemoId = null;
  elements.captureDraft.value = "";
  resetSpeechSession();
}

function scheduleCaptureAutosave() {
  elements.captureAutosaveStatus.textContent = "自動保存の準備中です…";
  if (ui.captureAutosaveTimer) {
    window.clearTimeout(ui.captureAutosaveTimer);
  }
  ui.captureAutosaveTimer = window.setTimeout(() => {
    persistCaptureMemo();
  }, 650);
}

function requestCaptureClose() {
  const didPersist = persistCaptureMemo();
  dialogs.capture.close(didPersist ? "saved" : "close");
}

function persistCaptureMemo() {
  const personId = ui.capturePersonId;
  const text = elements.captureDraft.value.trim();
  if (ui.captureAutosaveTimer) {
    window.clearTimeout(ui.captureAutosaveTimer);
    ui.captureAutosaveTimer = 0;
  }
  if (!personId || !text) {
    elements.captureAutosaveStatus.textContent = "話すか入力すると自動で保存します。";
    return false;
  }

  const observedAt = ui.captureObservedAt || new Date().toISOString();
  const now = new Date().toISOString();
  if (ui.captureMemoId) {
    const existing = state.memos.find((memo) => memo.id === ui.captureMemoId);
    if (existing) {
      existing.rawText = text;
      existing.updatedAt = now;
    }
  } else {
    const memoId = crypto.randomUUID();
    state.memos.push({
      id: memoId,
      personId,
      observedAt,
      createdAt: observedAt,
      updatedAt: now,
      rawText: text,
      scene: "",
    });
    ui.captureMemoId = memoId;
  }
  const person = findPerson(personId);
  if (person) {
    person.lastAccessedAt = now;
    person.updatedAt = now;
  }
  persistState();
  elements.captureAutosaveStatus.textContent = "自動保存済み。戻ってもこのメモは残ります。";
  markRecentlySaved(personId);
  renderPeople();
  return true;
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
  const deletedMemo = state.memos.find((memo) => memo.id === memoId);
  if (!deletedMemo) return;
  state.memos = state.memos.filter((memo) => memo.id !== memoId);
  persistState();
  render();
  if (dialogs.preview.open) renderPreview();
  toast("メモを削除しました", {
    actionLabel: "もとに戻す",
    duration: 4200,
    onAction: () => {
      state.memos.push({ ...deletedMemo });
      persistState();
      render();
      if (dialogs.preview.open) renderPreview();
      toast("メモを戻しました");
    },
  });
}

function createSwipeMemoCard(memo) {
  const shell = document.createElement("div");
  shell.className = "swipe-shell";
  shell.innerHTML = `
    <div class="swipe-background">
      <div class="swipe-delete-label">削除</div>
    </div>
    <article class="memo-card">
      <div class="memo-time">${formatDateTime(memo.observedAt)}</div>
      <div class="memo-text">${escapeHtml(memo.rawText).replace(/\n/g, "<br>")}</div>
    </article>
  `;
  const card = shell.querySelector(".memo-card");
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
    if (deltaX < -72) {
      deleteMemo(memo.id);
      return;
    }
    card.style.transform = "";
  };
  card.addEventListener("pointerup", finishDrag);
  card.addEventListener("pointercancel", finishDrag);
  return shell;
}

function buildHandoffBundle(personId) {
  const person = findPerson(personId);
  const summary = summaryFor(personId);
  return buildUiHandoffBundle({
    personName: person?.name ?? "不明",
    summaryText: summary?.summaryText || "なし",
    summaryUpdatedAt: summary?.summaryUpdatedAt ?? null,
    memos: memosFor(personId),
    preparedMemoIds: ui.handoffPersonId === personId ? ui.handoffPreparedMemoIds : [],
    exportedAt: new Date().toISOString(),
    formatDateTime,
  });
}

function renderBoardSummary({ totalCount, pendingCount, folderCount }) {
  elements.boardSummary.innerHTML = [
    summaryPillMarkup("登録", totalCount),
    summaryPillMarkup("未整理あり", pendingCount),
    summaryPillMarkup("フォルダ", folderCount),
  ].join("");
}

function summaryPillMarkup(label, value) {
  return `
    <div class="summary-pill">
      <span class="summary-pill-label">${escapeHtml(label)}</span>
      <strong class="summary-pill-value">${value}</strong>
    </div>
  `;
}

function renderBoardFilters() {
  elements.boardFilterBar.innerHTML = BOARD_FILTERS.map(
    (filter) => `
      <button
        type="button"
        class="filter-pill${ui.boardFilter === filter.id ? " is-active" : ""}"
        data-board-filter="${filter.id}"
      >
        ${escapeHtml(filter.label)}
      </button>
    `,
  ).join("");
}

function renderFolderFilters() {
  const filterButtons = [
    { id: "all", label: "すべて" },
    { id: "unassigned", label: "未分類" },
    ...state.folders.map((folder) => ({
      id: folder.id,
      label: folder.name,
      iconMarkup: folderIconMarkup(folder),
    })),
  ];
  elements.folderFilterBar.innerHTML = filterButtons
    .map(
      (filter) => `
        <button
          type="button"
          class="filter-pill${ui.folderFilter === filter.id ? " is-active" : ""}"
          data-folder-filter="${escapeHtml(String(filter.id))}"
        >
          ${filter.iconMarkup || ""}${escapeHtml(filter.label)}
        </button>
      `,
    )
    .join("");
}

function selectedFolder() {
  if (ui.folderFilter === "all" || ui.folderFilter === "unassigned") return null;
  return folderFor(ui.folderFilter);
}

function createFolderFromPrompt(assignPersonIdOrIds = null, { skipConfirmAssign = false } = {}) {
  const name = window.prompt("フォルダ名を入れてください");
  if (!name || !name.trim()) return;
  const colorChoice = pickFolderColorChoice(state.folders.length % FOLDER_COLOR_CHOICES.length);
  if (!colorChoice) return;
  const preset = DEFAULT_FOLDER_PRESETS[state.folders.length % DEFAULT_FOLDER_PRESETS.length];
  const assignPersonIds = normalizeFolderAssigneeIds(assignPersonIdOrIds);
  const now = new Date().toISOString();
  const folder = {
    id: crypto.randomUUID(),
    name: name.trim(),
    icon: preset.icon,
    colorKey: colorChoice.colorKey,
    sortOrder: state.folders.length,
    createdAt: now,
    updatedAt: now,
  };
  state.folders.push(folder);
  if (assignPersonIds.length > 1) {
    const confirmAssign = skipConfirmAssign
      ? true
      : window.confirm(`今見えている ${assignPersonIds.length} 人をこのフォルダへ入れますか？`);
    if (confirmAssign) {
      assignPeopleToFolder(assignPersonIds, folder.id, { skipRender: true });
    }
  } else if (assignPersonIds.length === 1) {
    assignPersonFolder(assignPersonIds[0], folder.id, { skipRender: true });
  }
  persistState();
  if (assignPersonIds.length > 0) {
    ui.folderFilter = folder.id;
  }
  clearSelectionMode();
  render();
  toast("フォルダを作りました");
}

function changeSelectedFolderColor() {
  const folder = selectedFolder();
  if (!folder) return;
  const currentIndex = Math.max(
    0,
    FOLDER_COLOR_CHOICES.findIndex((item) => item.colorKey === folder.colorKey),
  );
  const choice = pickFolderColorChoice(currentIndex);
  if (!choice) return;
  folder.colorKey = choice.colorKey;
  folder.updatedAt = new Date().toISOString();
  persistState();
  render();
  toast("フォルダの色を変えました");
}

function renameSelectedFolder() {
  const folder = selectedFolder();
  if (!folder) return;
  const nextName = window.prompt("フォルダ名を入れてください", folder.name);
  if (!nextName || !nextName.trim()) return;
  folder.name = nextName.trim();
  folder.updatedAt = new Date().toISOString();
  persistState();
  render();
  toast("フォルダ名を変えました");
}

function deleteSelectedFolder() {
  const folder = selectedFolder();
  if (!folder) return;
  const confirmed = window.confirm(`「${folder.name}」を削除すると、中の名前は未分類へ戻ります。よろしいですか？`);
  if (!confirmed) return;
  assignPeopleToFolder(
    state.people.filter((person) => person.folderId === folder.id).map((person) => person.id),
    null,
    { skipRender: true },
  );
  state.folders = state.folders.filter((item) => item.id !== folder.id);
  ui.folderFilter = "all";
  persistState();
  render();
  toast("フォルダを削除しました");
}

function openMoveFolderDialog() {
  renderMoveFolderOptions();
  showPreparedDialog(dialogs.moveFolder);
}

function renderMoveFolderOptions() {
  const selectedCount = ui.selectedPersonIds.length;
  elements.moveFolderSummary.textContent = `${selectedCount}人をまとめて移せます`;
  const folderButtons = [
    { id: "unassigned", label: "未分類" },
    ...state.folders.map((folder) => ({
      id: folder.id,
      label: folder.name,
      iconMarkup: folderIconMarkup(folder),
    })),
  ];
  elements.moveFolderOptions.innerHTML = folderButtons
    .map(
      (folder) => `
        <button
          type="button"
          class="filter-pill"
          data-move-folder-id="${escapeHtml(String(folder.id))}"
        >
          ${folder.iconMarkup || ""}${escapeHtml(folder.label)}
        </button>
      `,
    )
    .join("");
  elements.moveFolderOptions.querySelectorAll("[data-move-folder-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextFolderId = button.dataset.moveFolderId;
      moveSelectedPeopleToFolder(nextFolderId === "unassigned" ? null : nextFolderId);
    });
  });
}

function applyFolderFilter(people) {
  if (ui.folderFilter === "all") {
    return people;
  }
  if (ui.folderFilter === "unassigned") {
    return people.filter((person) => !person.folderId);
  }
  return people.filter((person) => person.folderId === ui.folderFilter);
}

function assignPersonFolder(personId, folderId, { skipRender = false } = {}) {
  const person = findPerson(personId);
  if (!person) return;
  person.folderId = folderId;
  person.updatedAt = new Date().toISOString();
  persistState();
  if (!skipRender) {
    render();
  }
}

function assignPeopleToFolder(personIds, folderId, { skipRender = false } = {}) {
  personIds.forEach((personId) => {
    const person = findPerson(personId);
    if (!person) return;
    person.folderId = folderId;
    person.updatedAt = new Date().toISOString();
  });
  persistState();
  if (!skipRender) {
    render();
  }
}

function moveSelectedPeopleToFolder(folderId) {
  if (ui.selectedPersonIds.length === 0) return;
  assignPeopleToFolder(ui.selectedPersonIds, folderId, { skipRender: true });
  ui.folderFilter = folderId || "unassigned";
  dialogs.moveFolder.close("moved");
  clearSelectionMode();
  render();
  toast("フォルダへ移しました");
}

function prepareHandoffBundle(personId) {
  ui.handoffPersonId = personId;
  ui.handoffPreparedMemoIds = [];
  const bundle = buildHandoffBundle(personId);
  ui.handoffPreparedMemoIds = [...bundle.includedMemoIds];
  return bundle;
}

function currentHandoffBundle(personId) {
  return buildHandoffBundle(personId);
}

async function copyHandoffBundleForPerson(personId) {
  const bundle = prepareHandoffBundle(personId);
  try {
    await writeTextToClipboard(bundle.copyText);
    renderPreview();
    renderHandoff();
    toast("AI に送る文をコピーしました");
  } catch {
    toast("コピーできませんでした。長押しでコピーしてください。");
  }
}

function currentBulkAiBundle() {
  return buildBulkAiExport({
    people: state.people.slice().sort((a, b) => a.sortOrder - b.sortOrder),
    memos: state.memos,
    summaries: state.summaries,
    batchId: bulkAiSession?.batchId || crypto.randomUUID(),
    exportedAt: new Date().toISOString(),
  });
}

async function copyBulkAiBundle() {
  const bundle = currentBulkAiBundle();
  if (bundle.pendingPeople.length === 0) {
    toast("未整理メモはありません。");
    return;
  }
  if (bulkAiSession) {
    const shouldReplace = window.confirm("未反映の一括整理があります。置き換えて新しくコピーしますか。");
    if (!shouldReplace) return;
  }
  bulkAiSession = bundle.session;
  bulkAiPreview = null;
  bulkAiParseError = "";
  persistBulkAiSession();
  renderBulkAi();
  try {
    await writeTextToClipboard(bundle.copyText);
    toast("AI 用データをコピーしました");
  } catch {
    toast("コピーできませんでした。長押しでコピーしてください。");
  }
}

function reviewBulkAiResponse() {
  if (!bulkAiSession) {
    bulkAiParseError = "batch_mismatch";
    bulkAiPreview = null;
    renderBulkAi();
    return;
  }
  const outcome = parseBulkAiResponse({
    responseText: elements.bulkAiResponseText.value,
    session: bulkAiSession,
  });
  bulkAiParseError = outcome.parseError || "";
  bulkAiPreview = outcome.preview;
  renderBulkAi();
}

function applyBulkAiPreview() {
  if (!bulkAiPreview || bulkAiPreview.successEntries.length === 0) return;
  const now = new Date().toISOString();
  bulkAiPreview.successEntries.forEach((entry) => {
    const existing = state.summaries.find((summary) => summary.personId === entry.personId);
    if (existing) {
      existing.summaryText = entry.summaryText;
      existing.summaryUpdatedAt = now;
    } else {
      state.summaries.push({
        personId: entry.personId,
        summaryText: entry.summaryText,
        summaryUpdatedAt: now,
      });
    }
    state.memos = state.memos.filter((memo) => !entry.includedMemoIds.includes(memo.id));
  });

  const successfulIds = new Set(bulkAiPreview.successEntries.map((entry) => entry.personId));
  if (bulkAiSession) {
    bulkAiSession = {
      ...bulkAiSession,
      people: bulkAiSession.people.filter((person) => !successfulIds.has(person.personId)),
    };
    if (bulkAiSession.people.length === 0) {
      bulkAiSession = null;
    }
  }
  bulkAiPreview = null;
  bulkAiParseError = "";
  elements.bulkAiResponseText.value = "";
  persistState();
  persistBulkAiSession();
  render();
  toast("一括で整理ノートへ反映しました");
}

function pendingMemoCount(personId) {
  const summary = summaryFor(personId);
  return nextMemosForHandoff({
    memos: memosFor(personId),
    summaryUpdatedAt: summary?.summaryUpdatedAt ?? null,
  }).length;
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

function folderFor(folderId) {
  if (!folderId) return null;
  return state.folders.find((folder) => folder.id === folderId) || null;
}

function currentVisiblePeople() {
  const folderScopedPeople = applyFolderFilter(state.people)
    .filter((person) =>
      matchesPersonSearch({
        query: ui.searchQuery,
        name: person.name,
      }),
    )
    .sort((a, b) => a.sortOrder - b.sortOrder);
  return applyBoardFilter({
    people: folderScopedPeople,
    filter: ui.boardFilter,
    getPendingCount: pendingMemoCount,
  });
}

function folderColorValue(colorKey) {
  return FOLDER_COLOR_CHOICES.find((item) => item.colorKey === colorKey)?.color || FOLDER_COLOR_CHOICES[0].color;
}

function folderIconMarkup(folder) {
  const color = folderColorValue(folder.colorKey);
  return `
    <span class="folder-chip-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        <path
          d="M3 6.75C3 5.7835 3.7835 5 4.75 5H10.1C10.5878 5 11.0556 5.19819 11.3859 5.54922L12.525 6.75H19.25C20.2165 6.75 21 7.5335 21 8.5V17.25C21 18.2165 20.2165 19 19.25 19H4.75C3.7835 19 3 18.2165 3 17.25V6.75Z"
          fill="${color}"
        />
      </svg>
    </span>
  `;
}

function pickFolderColorChoice(defaultIndex = 0) {
  const defaultChoice = FOLDER_COLOR_CHOICES[defaultIndex % FOLDER_COLOR_CHOICES.length];
  const answer = window.prompt(
    "フォルダの色を選んでください: 青 / 緑 / 黄 / 赤 / 紫",
    defaultChoice.label,
  );
  if (answer == null) return null;
  const normalized = answer.trim();
  return (
    FOLDER_COLOR_CHOICES.find((item) => item.label === normalized) ||
    FOLDER_COLOR_CHOICES.find((item) => item.colorKey === normalized) ||
    defaultChoice
  );
}

function normalizeFolderAssigneeIds(assignPersonIdOrIds) {
  if (Array.isArray(assignPersonIdOrIds)) {
    return [...new Set(assignPersonIdOrIds.filter(Boolean))];
  }
  return assignPersonIdOrIds ? [assignPersonIdOrIds] : [];
}

function togglePersonSelection(personId) {
  if (ui.selectedPersonIds.includes(personId)) {
    ui.selectedPersonIds = ui.selectedPersonIds.filter((id) => id !== personId);
  } else {
    ui.selectedPersonIds = [...ui.selectedPersonIds, personId];
  }
  render();
}

function clearSelectionMode() {
  ui.selectionMode = false;
  ui.selectedPersonIds = [];
}

function trimSelectionToVisible() {
  if (!ui.selectionMode) return;
  const visibleIds = new Set(currentVisiblePeople().map((person) => person.id));
  ui.selectedPersonIds = ui.selectedPersonIds.filter((id) => visibleIds.has(id));
}

function markOpened(personId) {
  const person = findPerson(personId);
  if (!person) return;
  person.lastAccessedAt = new Date().toISOString();
  person.updatedAt = person.lastAccessedAt;
  persistState();
  renderPeople();
}

function exportStateAsJson() {
  const exported = buildStateExport({
    state,
    appId: "kizuki-ios-web-beta",
    schemaVersion: STORAGE_SCHEMA_VERSION,
  });
  const blob = new Blob([exported.jsonText], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = exported.filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
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
    bulkAiSession = null;
    bulkAiPreview = null;
    bulkAiParseError = "";
    persistState();
    persistBulkAiSession();
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
  return buildEmptyState();
}

function ensureSeeded() {
  if (state.people.length > 0) return;
  state = createDemoState();
  persistState();
}

function createDemoState() {
  return createDemoStorageState();
}

function loadState() {
  return loadStoredState({
    storage: window.localStorage,
    storageKey: STORAGE_KEY,
  });
}

function loadBulkAiSession() {
  return loadAuxJson({
    storage: window.localStorage,
    storageKey: BULK_AI_SESSION_KEY,
  });
}

function persistState() {
  persistStoredState({
    storage: window.localStorage,
    storageKey: STORAGE_KEY,
    state,
  });
}

function persistBulkAiSession() {
  persistAuxJson({
    storage: window.localStorage,
    storageKey: BULK_AI_SESSION_KEY,
    value: bulkAiSession,
  });
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function toast(message, options = {}) {
  const { actionLabel = "", onAction = null, duration = 2600 } = options;
  mountToast();
  elements.toastMessage.textContent = message;
  elements.toastAction.hidden = actionLabel.length === 0;
  elements.toastAction.textContent = actionLabel;
  toastState.action = onAction;
  elements.toast.hidden = false;
  clearTimeout(toastState.timer);
  toastState.timer = window.setTimeout(() => {
    hideToast();
  }, duration);
}

function hideToast() {
  clearTimeout(toastState.timer);
  toastState.timer = 0;
  toastState.action = null;
  elements.toast.hidden = true;
  elements.toastMessage.textContent = "";
  elements.toastAction.hidden = true;
  elements.toastAction.textContent = "";
}

function mountToast() {
  const host =
    Object.values(dialogs).find((dialog) => dialog?.open)?.querySelector(".sheet-content") || document.body;
  if (elements.toast.parentElement !== host) {
    host.appendChild(elements.toast);
  }
  elements.toast.classList.toggle("toast--in-sheet", host !== document.body);
}

function bindLongPress(node, onLongPress, onTap) {
  bindLongPressHelper(node, onLongPress, onTap);
}

function escapeHtml(value) {
  return escapeHtmlHelper(value);
}

function summarizeStateCounts(sourceState) {
  return summarizeStoredStateCounts(sourceState);
}

function bulkAiParseErrorToText(reason) {
  switch (reason) {
    case "invalid_json":
      return "返答の JSON を読み取れませんでした。";
    case "invalid_schema":
      return "返答の形式が違います。";
    case "batch_mismatch":
      return "今のコピー内容と返答の batch が一致しません。";
    case "empty_results":
      return "返答に整理結果がありません。";
    default:
      return "返答を確認できませんでした。";
  }
}

function bulkAiFailureReasonToText(reason) {
  switch (reason) {
    case "missing_result":
      return "返答がありません";
    case "duplicate_token":
      return "返答が重複しています";
    case "unknown_token":
      return "今の一括整理に含まれていません";
    case "empty_summary":
      return "整理文が空です";
    default:
      return "確認が必要です";
  }
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
  bindDialogStateEventsHelper({ dialogs, onSync: syncDialogBodyState });
}

function syncDialogBodyState() {
  syncDialogBodyStateHelper({ dialogs, body: document.body });
}

function showPreparedDialog(dialog) {
  showPreparedDialogHelper(dialog, { dialogs, body: document.body });
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
  return buildRefreshUrlHelper(currentUrl, timestamp, window.location.href);
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
    speech.liveText = "";
    speech.lastErrorMessage = "";
    speech.processing = false;
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
    speech.processing = false;
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
  speech.processing = true;

  if (!preserveStatus) {
    renderSpeechStatus();
  } else if (manual) {
    renderSpeechStatus("聞き取った内容をまとめています。下のメモへ追記するまで少し待ってください。", "active");
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
  speech.liveText = interimText;
  elements.captureDraft.value = composeDraftText(combinedFinal, interimText);
  scheduleCaptureAutosave();
  renderSpeechPreview();
}

function handleSpeechError(event) {
  speech.active = false;
  speech.processing = false;
  speech.liveText = "";
  speech.lastErrorMessage = mapSpeechErrorMessage(event.error);
  renderSpeechStatus(speech.lastErrorMessage, "warning");
  if (event.error === "not-allowed" || event.error === "service-not-allowed" || event.error === "unsupported") {
    fallbackToKeyboardMic();
  }
}

function handleSpeechEnd() {
  speech.active = false;
  speech.processing = false;
  speech.recognition = null;
  const finalizedDraft = composeDraftText(speech.baseText, speech.confirmedText);
  const hasAppendedVoice = finalizedDraft !== speech.baseText;
  speech.liveText = "";
  elements.captureDraft.value = finalizedDraft;
  if (hasAppendedVoice) {
    persistCaptureMemo();
  }
  if (speech.lastErrorMessage) {
    renderSpeechStatus(speech.lastErrorMessage, "warning");
  } else if (hasAppendedVoice) {
    renderSpeechStatus("下のメモに追記しました。続けるなら、もう一度マイクを押してください。", "success");
  } else if (speech.manuallyStopped) {
    renderSpeechStatus("音声入力を止めました。続けたい時はもう一度押してください。");
  } else {
    renderSpeechStatus("音声入力を終えました。必要ならもう一度押して続きを話せます。");
  }
}

function fallbackToKeyboardMic() {
  speech.processing = false;
  speech.liveText = "";
  elements.captureDraft.focus();
  toast("キーボードのマイクでそのまま話せます");
}

function resetSpeechSession() {
  speech.active = false;
  speech.processing = false;
  speech.manuallyStopped = false;
  speech.baseText = "";
  speech.confirmedText = "";
  speech.liveText = "";
  speech.lastErrorMessage = "";
  speech.recognition = null;
  renderSpeechStatus();
}

function markRecentlySaved(personId) {
  ui.lastSavedPersonId = personId;
  if (recentSaveTimeoutId) {
    window.clearTimeout(recentSaveTimeoutId);
  }
  recentSaveTimeoutId = window.setTimeout(() => {
    if (ui.lastSavedPersonId === personId) {
      ui.lastSavedPersonId = null;
      renderPeople();
    }
  }, 3200);
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
