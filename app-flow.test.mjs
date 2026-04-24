import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const iosBetaDir = __dirname;
const playwrightModule = await import(
  pathToFileURL("C:/Users/gan12/.codex/skills/playwright-skill/node_modules/playwright/index.mjs").href
);
const { chromium, devices } = playwrightModule;

function contentTypeFor(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js") || filePath.endsWith(".mjs")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".json") || filePath.endsWith(".webmanifest")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}

async function startServer() {
  const server = http.createServer(async (req, res) => {
    try {
      const urlPath = req.url === "/" ? "/index.html" : req.url.split("?")[0];
      const safePath = urlPath.replace(/^\/+/, "");
      const filePath = path.join(iosBetaDir, safePath);
      const body = await fs.readFile(filePath);
      res.writeHead(200, { "Content-Type": contentTypeFor(filePath) });
      res.end(body);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
    }
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}/`,
  };
}

async function withPage(run) {
  const { server, baseUrl } = await startServer();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ...devices["iPhone 13"],
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
    acceptDownloads: true,
  });
  const page = await context.newPage();

  try {
    await run(page, baseUrl);
  } finally {
    await browser.close();
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

test("dialogs are populated before the iPhone sheet opens", async () => {
  await withPage(async (page, baseUrl) => {
    await page.addInitScript(() => {
      window.__dialogOpenSnapshots = [];
      const captureSnapshot = (dialog, openKind) => {
        window.__dialogOpenSnapshots.push({
          id: dialog.id,
          openKind,
          captureName: document.getElementById("capture-person-name")?.textContent ?? "",
          captureAutosaveStatus: document.getElementById("capture-autosave-status")?.textContent ?? "",
          previewName: document.getElementById("preview-name-input")?.value ?? "",
          summaryName: document.getElementById("summary-person-name")?.textContent ?? "",
          summaryMeta: document.getElementById("summary-meta")?.textContent ?? "",
        });
      };
      const originalShowModal = HTMLDialogElement.prototype.showModal;
      const originalShow = HTMLDialogElement.prototype.show;
      HTMLDialogElement.prototype.showModal = function patchedShowModal() {
        captureSnapshot(this, "modal");
        return originalShowModal.call(this);
      };
      HTMLDialogElement.prototype.show = function patchedShow() {
        captureSnapshot(this, "sheet");
        return originalShow.call(this);
      };
    });

    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "名前を追加" }).click();
    await page.locator("#person-name-input").fill("回帰テスト");
    await page.getByRole("button", { name: "保存" }).click();

    await page.locator("#capture-dialog[open]").waitFor();
    await page.locator("#capture-draft").fill("開く前から名前と自動保存表示が入っているかの確認です。");
    await page.locator("#capture-close-button").click();
    await page.locator("#capture-dialog").waitFor({ state: "hidden" });

    await openPreviewViaLongPress(page, "回帰テスト");
    await page.getByRole("button", { name: "全文を見る / 直す" }).click();
    await page.locator("#summary-dialog[open]").waitFor();

    const snapshots = await page.evaluate(() => window.__dialogOpenSnapshots);
    const captureSnapshot = snapshots.find((item) => item.id === "capture-dialog");
    const previewSnapshot = snapshots.find((item) => item.id === "preview-dialog");
    const summarySnapshot = snapshots.find((item) => item.id === "summary-dialog");

    assert.ok(captureSnapshot, "capture dialog should open");
    assert.equal(captureSnapshot.openKind, "sheet");
    assert.equal(captureSnapshot.captureName, "回帰テスト");
    assert.match(captureSnapshot.captureAutosaveStatus, /自動で保存|自動保存済み/);

    assert.ok(previewSnapshot, "preview dialog should open");
    assert.equal(previewSnapshot.openKind, "sheet");
    assert.equal(previewSnapshot.previewName, "回帰テスト");

    assert.ok(summarySnapshot, "summary dialog should open");
    assert.equal(summarySnapshot.openKind, "sheet");
    assert.equal(summarySnapshot.summaryName, "回帰テスト");
    assert.match(summarySnapshot.summaryMeta, /整理ノート|最終更新/);
  });
});

test("settings includes update fallback and public page button", async () => {
  await withPage(async (page, baseUrl) => {
    await page.addInitScript(() => {
      window.__openedUrls = [];
      window.open = (url, target, features) => {
        window.__openedUrls.push({ url, target, features });
        return { closed: false };
      };
    });

    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "設定" }).click();
    await page.locator("#settings-dialog[open]").waitFor();
    await page.getByRole("button", { name: "最新版に更新する" }).waitFor();

    assert.match(await page.locator("#web-build-label").textContent(), /現在の版:/);

    await page.getByRole("button", { name: "公開ページを開く" }).click();
    const openedUrls = await page.evaluate(() => window.__openedUrls);
    assert.equal(openedUrls.length, 1);
    assert.equal(openedUrls[0].url, "https://ritonobi0120-tech.github.io/kizuki-memo-ios-web-beta/");
  });
});

test("manual refresh uses a cache-busted reload url", async () => {
  await withPage(async (page, baseUrl) => {
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "設定" }).click();
    await page.locator("#settings-dialog[open]").waitFor();
    await page.getByRole("button", { name: "最新版に更新する" }).click();
    await page.waitForURL(/update=/, { timeout: 2500 });

    assert.match(page.url(), /^http:\/\/127\.0\.0\.1:/);
    assert.match(page.url(), /[?&]update=/);
  });
});

test("board folder filters narrow visible names and stay active after auto-save", async () => {
  await withPage(async (page, baseUrl) => {
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.locator("#folder-filter-bar").getByRole("button", { name: /すぐ話す/ }).click();

    await assert.doesNotReject(() => page.getByRole("button", { name: /田中 はる/ }).waitFor());
    assert.equal(await page.getByRole("button", { name: /佐藤 あおい/ }).count(), 0);
    assert.equal(
      await page.locator(".person-tile", { hasText: "田中 はる" }).locator(".tile-meta").count(),
      0,
    );

    await page.getByRole("button", { name: /田中 はる/ }).click();
    await page.locator("#capture-dialog[open]").waitFor();
    await page.locator("#capture-draft").fill("フォルダを絞ったまま記録します。");
    await page.locator("#capture-close-button").click();
    await page.locator("#capture-dialog").waitFor({ state: "hidden" });

    await assert.doesNotReject(() =>
      page.locator("#folder-filter-bar .filter-pill.is-active", { hasText: "すぐ話す" }).waitFor(),
    );
    assert.equal(await page.getByRole("button", { name: /佐藤 あおい/ }).count(), 0);
    await assert.doesNotReject(() =>
      page.locator(".person-tile.is-recently-saved", { hasText: "田中 はる" }).waitFor(),
    );
  });
});

test("top search can find kanji names from hiragana input", async () => {
  await withPage(async (page, baseUrl) => {
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.getByPlaceholder("名前・呼び名・かなで検索").fill("たな");

    await assert.doesNotReject(() => page.getByRole("button", { name: /田中 はる/ }).waitFor());
    assert.equal(await page.getByRole("button", { name: /佐藤 あおい/ }).count(), 0);
  });
});

test("search shows only matching names and hides folder controls until search is cleared", async () => {
  await withPage(async (page, baseUrl) => {
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.locator("#folder-filter-bar").getByRole("button", { name: /すぐ話す/ }).click();

    await page.getByPlaceholder("名前・呼び名・かなで検索").fill("さとう");

    await assert.doesNotReject(() => page.getByRole("button", { name: /佐藤 あおい/ }).waitFor());
    assert.equal(await page.getByRole("button", { name: /田中 はる/ }).count(), 0);
    await expectHidden(page.locator("#board-actions"));
    await expectHidden(page.locator("#folder-filter-bar"));
    await expectHidden(page.locator("#board-filter-bar"));
    await expectHidden(page.locator("#folder-manage-card"));
  });
});

test("board top no longer shows count summary chips", async () => {
  await withPage(async (page, baseUrl) => {
    await page.goto(baseUrl, { waitUntil: "networkidle" });

    assert.equal(await page.locator("#board-summary .summary-pill").count(), 0);
    assert.equal(await page.locator("#board-summary").getByRole("button").count(), 0);
  });
});

test("creating a folder from the board adds the chip without auto-assigning every visible name", async () => {
  await withPage(async (page, baseUrl) => {
    await page.addInitScript(() => {
      window.prompt = () => "2組";
    });

    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.locator("#folder-filter-bar").getByRole("button", { name: "フォルダを追加" }).click();
    await assert.doesNotReject(() => page.getByRole("button", { name: "名前を追加" }).waitFor());

    await page.getByRole("button", { name: "名前を追加" }).click();
    await page.locator("#person-name-input").fill("フォルダ追加確認");
    await page.getByRole("button", { name: "保存" }).click();
    await page.locator("#capture-dialog[open]").waitFor();
    await page.locator("#capture-close-button").click();
    await page.locator("#capture-dialog").waitFor({ state: "hidden" });

    await assert.doesNotReject(() => page.getByRole("button", { name: /フォルダ追加確認/ }).waitFor());
    await page.locator("#folder-filter-bar").getByRole("button", { name: /2組/ }).click();
    assert.equal(await page.getByRole("button", { name: /フォルダ追加確認/ }).count(), 0);
  });
});

test("selected folder can be deleted from the board", async () => {
  await withPage(async (page, baseUrl) => {
    await page.addInitScript(() => {
      window.prompt = () => "消す用";
      window.confirm = () => true;
    });

    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.locator("#folder-filter-bar").getByRole("button", { name: "フォルダを追加" }).click();
    await page.locator("#folder-filter-bar").getByRole("button", { name: /消す用/ }).click();

    await page.getByRole("button", { name: "このフォルダを削除" }).click();

    await assert.doesNotReject(() =>
      page.locator("#folder-filter-bar .filter-pill.is-active", { hasText: "すべて" }).waitFor(),
    );
    assert.equal(await page.locator("#folder-filter-bar").getByRole("button", { name: /消す用/ }).count(), 0);
  });
});

test("selected folder can be renamed from the board", async () => {
  await withPage(async (page, baseUrl) => {
    await page.addInitScript(() => {
      window.__promptAnswers = ["旧フォルダ", "青", "新フォルダ"];
      window.prompt = () => window.__promptAnswers.shift() ?? "";
    });

    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.locator("#folder-filter-bar").getByRole("button", { name: "フォルダを追加" }).click();
    await page.locator("#folder-filter-bar").getByRole("button", { name: /旧フォルダ/ }).click();

    await page.getByRole("button", { name: "名前を変える" }).click();

    await assert.doesNotReject(() =>
      page.locator("#folder-filter-bar .filter-pill.is-active", { hasText: "新フォルダ" }).waitFor(),
    );
    await assert.doesNotReject(() =>
      page.locator("#folder-manage-title", { hasText: "新フォルダ" }).waitFor(),
    );
    assert.equal(await page.locator("#folder-filter-bar").getByRole("button", { name: /旧フォルダ/ }).count(), 0);
  });
});

test("selection mode moves chosen names into an existing folder", async () => {
  await withPage(async (page, baseUrl) => {
    await page.goto(baseUrl, { waitUntil: "networkidle" });

    await page.getByRole("button", { name: "選択" }).click();
    await assert.doesNotReject(() => page.getByText("0人を選択中").waitFor());

    await page.getByRole("button", { name: /鈴木 けん/ }).click();
    await assert.doesNotReject(() => page.getByText("1人を選択中").waitFor());

    await page.getByRole("button", { name: "移動" }).click();
    await page.locator("#move-folder-dialog[open]").waitFor();
    await page.locator("#move-folder-options").getByRole("button", { name: /あとで整理/ }).click();
    await page.locator("#move-folder-dialog").waitFor({ state: "hidden" });

    await assert.doesNotReject(() =>
      page.locator("#folder-filter-bar .filter-pill.is-active", { hasText: "あとで整理" }).waitFor(),
    );
    await assert.doesNotReject(() => page.getByRole("button", { name: /鈴木 けん/ }).waitFor());
    assert.equal(await page.getByText("1人を選択中").count(), 0);
  });
});

test("bulk ai handoff copies all pending people and applies summaries back", async () => {
  await withPage(async (page, baseUrl) => {
    await page.addInitScript(() => {
      window.__copiedText = "";
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (text) => {
            window.__copiedText = text;
          },
        },
      });
    });

    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "一括AI整理" }).click();
    await page.locator("#bulk-ai-dialog[open]").waitFor();

    await page.getByRole("button", { name: "AI用にまとめてコピー" }).click();
    const copiedText = await page.evaluate(() => window.__copiedText);
    assert.match(copiedText, /kizuki-batch-export-v1/);

    const responseText = await page.evaluate(() => {
      const payload = JSON.parse(window.__copiedText.replace(/^```json\n/, "").replace(/\n```$/, ""));
      return JSON.stringify(
        {
          schema: "kizuki-batch-response-v1",
          batchId: payload.batchId,
          results: payload.people.map((person, index) => ({
            personToken: person.personToken,
            summaryText: `整理ノート ${index + 1}`,
          })),
        },
        null,
        2,
      );
    });

    await page.locator("#bulk-ai-response-text").fill(responseText);
    await page.getByRole("button", { name: "返答を確認する" }).click();
    await assert.doesNotReject(() => page.getByText("反映する名前").waitFor());

    await page.getByRole("button", { name: "一括反映" }).click();
    await assert.doesNotReject(() => page.locator("#bulk-ai-result", { hasText: /人に反映しました/ }).waitFor());
    await assert.doesNotReject(() => page.locator("#bulk-ai-summary", { hasText: "未整理メモはありません。" }).waitFor());
  });
});

test("speech button shows ready, recording, and appended states when browser speech api succeeds", async () => {
  await withPage(async (page, baseUrl) => {
    await page.addInitScript(() => {
      window.__fakeSpeech = { instances: [] };
      class FakeRecognition {
        constructor() {
          this.listeners = new Map();
          window.__fakeSpeech.instances.push(this);
        }

        addEventListener(type, handler) {
          const list = this.listeners.get(type) ?? [];
          list.push(handler);
          this.listeners.set(type, list);
        }

        start() {}

        stop() {}

        emit(type, payload) {
          for (const handler of this.listeners.get(type) ?? []) {
            handler(payload);
          }
        }
      }

      window.SpeechRecognition = FakeRecognition;
      window.webkitSpeechRecognition = FakeRecognition;
    });

    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "名前を追加" }).click();
    await page.locator("#person-name-input").fill("音声確認");
    await page.getByRole("button", { name: "保存" }).click();
    await page.locator("#capture-dialog[open]").waitFor();

    await expectText(page.locator("#speech-status"), /スタンバイOK/);
    await page.locator("#speech-toggle-button").click();
    await expectText(page.locator("#speech-status"), /録音中/);
    await page.waitForFunction(() => window.__fakeSpeech.instances.length > 0);

    await page.evaluate(() => {
      const recognition = window.__fakeSpeech.instances[0];
      recognition.emit("result", {
        resultIndex: 0,
        results: [
          {
            0: { transcript: "音声で入れたメモ" },
            isFinal: true,
          },
        ],
      });
      recognition.emit("end", {});
    });

    await expectText(page.locator("#speech-status"), /追記しました|もう一度/);
    await expectText(page.locator("#capture-autosave-status"), /自動保存済み/);
    assert.match(await page.locator("#capture-draft").inputValue(), /音声で入れたメモ/);
  });
});

test("capture screen opens standby-ready with only the minimal recording controls", async () => {
  await withPage(async (page, baseUrl) => {
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "名前を追加" }).click();
    await page.locator("#person-name-input").fill("最小表示");
    await page.getByRole("button", { name: "保存" }).click();
    await page.locator("#capture-dialog[open]").waitFor();

    assert.equal(await page.locator("#capture-person-name").textContent(), "最小表示");
    await expectText(page.locator("#speech-status"), /スタンバイOK/);
    assert.equal(await page.locator("#capture-observed-at").count(), 0);
    assert.equal(await page.getByRole("button", { name: "保存する" }).count(), 0);
    assert.equal(await page.getByText("あとで整える項目").count(), 0);
    assert.equal(await page.getByText("場面").count(), 0);
  });
});

test("quick filters hide a newly added no-memo name from pending-only view", async () => {
  await withPage(async (page, baseUrl) => {
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "名前を追加" }).click();
    await page.locator("#person-name-input").fill("絞り込み確認");
    await page.getByRole("button", { name: "保存" }).click();
    await page.locator("#capture-dialog[open]").waitFor();
    await page.locator("#capture-close-button").click();
    await page.locator("#capture-dialog").waitFor({ state: "hidden" });

    await page.getByRole("button", { name: "未整理あり" }).click();

    assert.equal(await page.getByRole("button", { name: /絞り込み確認/ }).count(), 0);
    await assert.doesNotReject(() => page.getByRole("button", { name: /田中 はる/ }).waitFor());
  });
});

test("preview focuses on summary and pending timeline without per-person AI or folder controls", async () => {
  await withPage(async (page, baseUrl) => {
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await openPreviewViaLongPress(page, "田中 はる");

    await assert.doesNotReject(() => page.locator("#preview-name-input").waitFor());
    await assert.doesNotReject(() => page.getByRole("heading", { name: "今たまってる文章" }).waitFor());
    assert.equal(await page.locator("#preview-create-folder-button").count(), 0);
    assert.equal(await page.locator("#preview-copy-ai-button").count(), 0);
    assert.equal(await page.locator("#preview-ai-button").count(), 0);
  });
});

test("preview summary opens a full editor and saves the updated note", async () => {
  await withPage(async (page, baseUrl) => {
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await openPreviewViaLongPress(page, "田中 はる");

    await assert.doesNotReject(() => page.locator("#preview-summary-card").waitFor());
    await assert.doesNotReject(() => page.getByRole("button", { name: "全文を見る / 直す" }).waitFor());

    await page.getByRole("button", { name: "全文を見る / 直す" }).click();
    await page.locator("#summary-dialog[open]").waitFor();
    assert.match(await page.locator("#summary-editor").inputValue(), /最近は自分から動き始める/);

    await page.locator("#summary-editor").fill("手直しした整理ノートです。");
    await page.locator("#summary-save-button").click();

    await page.locator("#summary-dialog").waitFor({ state: "hidden" });
    await page.locator("#preview-dialog[open]").waitFor();
    await assert.doesNotReject(() =>
      page.locator("#preview-summary-card", { hasText: "手直しした整理ノートです。" }).waitFor(),
    );
  });
});

test("preview name edits autosave when the preview closes", async () => {
  await withPage(async (page, baseUrl) => {
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await openPreviewViaLongPress(page, "田中 はる");

    await page.locator("#preview-name-input").fill("田中 はる 改");
    await page.locator("#preview-close-button").click();
    await page.locator("#preview-dialog").waitFor({ state: "hidden" });

    assert.deepEqual(await visibleTileNames(page), ["田中 はる 改", "佐藤 あおい", "鈴木 けん"]);
  });
});

test("reorder mode can drag visible names into a new order", async () => {
  await withPage(async (page, baseUrl) => {
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "並び替え" }).click();
    await dragReorderHandle(page, "鈴木 けん", "田中 はる");

    assert.deepEqual(await visibleTileNames(page), ["鈴木 けん", "田中 はる", "佐藤 あおい"]);
  });
});

test("reorder mode can normalize the current visible names into gojuon order", async () => {
  await withPage(async (page, baseUrl) => {
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "並び替え" }).click();
    await dragReorderHandle(page, "鈴木 けん", "田中 はる");
    await page.getByRole("button", { name: "50音順にする" }).click();

    assert.deepEqual(await visibleTileNames(page), ["佐藤 あおい", "鈴木 けん", "田中 はる"]);
  });
});

test("swiping a memo deletes it immediately and undo restores it", async () => {
  await withPage(async (page, baseUrl) => {
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await openPreviewViaLongPress(page, "田中 はる");

    const firstMemoText = await page.locator(".memo-card .memo-text").first().textContent();
    const firstMemoCard = page.locator(".memo-card").first();
    const box = await firstMemoCard.boundingBox();
    assert.ok(box, "memo card should be visible");

    await page.mouse.move(box.x + box.width - 20, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 16, box.y + box.height / 2, { steps: 8 });
    await page.mouse.up();

    await assert.doesNotReject(() => page.locator("#toast-action", { hasText: "もとに戻す" }).waitFor());
    assert.equal(await page.locator(".memo-card .memo-text", { hasText: firstMemoText.trim() }).count(), 0);

    await page.locator("#toast-action").click();
    await assert.doesNotReject(() =>
      page.locator(".memo-card .memo-text", { hasText: firstMemoText.trim() }).waitFor(),
    );
  });
});

test("json export triggers a downloadable backup file", async () => {
  await withPage(async (page, baseUrl) => {
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "設定" }).click();
    await page.locator("#settings-dialog[open]").waitFor();

    const expectedDate = await page.evaluate(() =>
      new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date()),
    );

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "JSON を書き出す" }).click(),
    ]);

    assert.equal(download.suggestedFilename(), `kizuki-ios-web-beta-${expectedDate}.json`);
  });
});

test("install guidance collapses after roster grows", async () => {
  await withPage(async (page, baseUrl) => {
    await page.addInitScript(() => {
      window.confirm = () => true;
    });

    await page.goto(baseUrl, { waitUntil: "networkidle" });
    assert.equal(await page.locator("#install-card").evaluate((node) => node.hidden), true);

    await page.getByRole("button", { name: "設定" }).click();
    await page.locator("#settings-dialog[open]").waitFor();
    await page.getByRole("button", { name: "この beta の保存データを消す" }).click();
    await page.locator("#settings-dialog").waitFor({ state: "hidden" });
    assert.equal(await page.locator("#install-card").evaluate((node) => node.hidden), false);

    for (const name of ["一人目", "二人目", "三人目"]) {
      await page.getByRole("button", { name: "名前を追加" }).click();
      await page.locator("#person-name-input").fill(name);
      await page.getByRole("button", { name: "保存" }).click();
      await page.locator("#capture-dialog[open]").waitFor();
      await page.locator("#capture-close-button").click();
      await page.locator("#capture-dialog").waitFor({ state: "hidden" });
    }

    assert.equal(await page.locator("#install-card").evaluate((node) => node.hidden), true);
  });
});

test("capture close auto-saves the draft and does not require a discard confirmation", async () => {
  await withPage(async (page, baseUrl) => {
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "名前を追加" }).click();
    await page.locator("#person-name-input").fill("自動保存確認");
    await page.getByRole("button", { name: "保存" }).click();

    await page.locator("#capture-dialog[open]").waitFor();
    await page.locator("#capture-draft").fill("閉じても残ってほしいメモです。");
    await page.getByRole("button", { name: "閉じる" }).click();
    await page.locator("#capture-dialog").waitFor({ state: "hidden" });

    assert.equal(await page.locator("#discard-capture-dialog[open]").count(), 0);
    await openPreviewViaLongPress(page, "自動保存確認");
    await assert.doesNotReject(() =>
      page.locator(".memo-card .memo-text", { hasText: "閉じても残ってほしいメモです。" }).waitFor(),
    );
  });
});

test("json import confirms before replacing and accepts versioned backup", async () => {
  await withPage(async (page, baseUrl) => {
    await page.addInitScript(() => {
      window.__confirmMessages = [];
      window.confirm = (message) => {
        window.__confirmMessages.push(message);
        return false;
      };
    });

    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "設定" }).click();
    await page.locator("#settings-dialog[open]").waitFor();

    const replacementState = {
      schemaVersion: 1,
      exportedAt: "2026-04-15T00:00:00.000Z",
      recordCounts: { people: 1, folders: 1, memos: 1, summaries: 1, scenes: 2 },
      state: {
        folders: [
          {
            id: "folder-imported",
            name: "読み込みフォルダ",
            icon: "📁",
            colorKey: "sand",
            sortOrder: 0,
            createdAt: "2026-04-15T00:00:00.000Z",
            updatedAt: "2026-04-15T00:00:00.000Z",
          },
        ],
        people: [
          {
            id: "person-imported",
            name: "インポート確認",
            folderId: "folder-imported",
            sortOrder: 0,
            createdAt: "2026-04-15T00:00:00.000Z",
            updatedAt: "2026-04-15T00:00:00.000Z",
            lastAccessedAt: "2026-04-15T00:00:00.000Z",
          },
        ],
        memos: [
          {
            id: "memo-imported",
            personId: "person-imported",
            observedAt: "2026-04-15T00:10:00.000Z",
            createdAt: "2026-04-15T00:10:00.000Z",
            updatedAt: "2026-04-15T00:10:00.000Z",
            rawText: "確認付きで読み込みたいメモです。",
            scene: "仕事",
          },
        ],
        summaries: [
          {
            personId: "person-imported",
            summaryText: "確認付きで読み込んだ整理ノートです。",
            summaryUpdatedAt: "2026-04-15T00:20:00.000Z",
          },
        ],
        scenes: ["仕事", "その他"],
      },
    };

    await page.setInputFiles("#import-json-input", {
      name: "kizuki-import.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(replacementState), "utf-8"),
    });

    const firstConfirmMessages = await page.evaluate(() => window.__confirmMessages);
    assert.equal(firstConfirmMessages.length, 1);
    assert.match(firstConfirmMessages[0], /名前 1 人/);
    assert.match(firstConfirmMessages[0], /フォルダ 1 個/);
    assert.match(firstConfirmMessages[0], /メモ 1 件/);

    await assert.doesNotReject(() => page.getByRole("button", { name: /田中 はる/ }).waitFor());
    assert.equal(await page.getByRole("button", { name: /インポート確認/ }).count(), 0);

    await page.evaluate(() => {
      window.confirm = (message) => {
        window.__confirmMessages.push(message);
        return true;
      };
    });

    await page.setInputFiles("#import-json-input", {
      name: "kizuki-import.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(replacementState), "utf-8"),
    });

    await assert.doesNotReject(() => page.getByRole("button", { name: /インポート確認/ }).waitFor());
    assert.equal(await page.getByRole("button", { name: /田中 はる/ }).count(), 0);
    await assert.doesNotReject(() =>
      page.locator(".person-tile", { hasText: "インポート確認" }).locator(".tile-meta", { hasText: "読み込みフォルダ" }).waitFor(),
    );
  });
});

async function openPreviewViaLongPress(page, name) {
  await page.evaluate(async (targetName) => {
    const tile = Array.from(document.querySelectorAll(".person-tile")).find((node) =>
      node.textContent.includes(targetName),
    );
    tile.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 80, clientY: 80 }));
    await new Promise((resolve) => setTimeout(resolve, 520));
    tile.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientX: 80, clientY: 80 }));
  }, name);
  await page.locator("#preview-dialog[open]").waitFor();
}

async function visibleTileNames(page) {
  return await page.locator(".person-tile .tile-name").evaluateAll((nodes) =>
    nodes.map((node) => node.textContent.trim()),
  );
}

async function dragReorderHandle(page, sourceName, targetName) {
  const source = page.locator(".person-tile", { hasText: sourceName }).locator("[data-reorder-handle]");
  const target = page.locator(".person-tile", { hasText: targetName });
  await source.scrollIntoViewIfNeeded();
  await target.scrollIntoViewIfNeeded();
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  assert.ok(sourceBox, "source handle should be visible");
  assert.ok(targetBox, "target tile should be visible");

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 10 });
  await page.mouse.up();
}

async function expectText(locator, pattern) {
  await assert.doesNotReject(() => locator.waitFor());
  assert.match((await locator.textContent()) ?? "", pattern);
}

async function expectHidden(locator) {
  assert.equal(
    await locator.evaluate(
      (node) => node.hidden || globalThis.getComputedStyle(node).display === "none",
    ),
    true,
  );
}
