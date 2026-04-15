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

test("dialogs are populated before showModal is called", async () => {
  await withPage(async (page, baseUrl) => {
    await page.addInitScript(() => {
      window.__dialogOpenSnapshots = [];
      const originalShowModal = HTMLDialogElement.prototype.showModal;
      HTMLDialogElement.prototype.showModal = function patchedShowModal() {
        window.__dialogOpenSnapshots.push({
          id: this.id,
          captureName: document.getElementById("capture-person-name")?.textContent ?? "",
          captureObservedAt: document.getElementById("capture-observed-at")?.textContent ?? "",
          previewName: document.getElementById("preview-person-name")?.textContent ?? "",
          handoffName: document.getElementById("handoff-person-name")?.textContent ?? "",
          handoffPendingCount: document.getElementById("handoff-pending-count")?.textContent ?? "",
        });
        return originalShowModal.call(this);
      };
    });

    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "名前を追加" }).click();
    await page.locator("#person-name-input").fill("回帰テスト");
    await page.getByRole("button", { name: "保存" }).click();

    await page.locator("#capture-dialog[open]").waitFor();
    await page.locator("#capture-draft").fill("開く前から内容が入っているかの確認です。");
    await page.getByRole("button", { name: "保存する" }).click();

    await page.evaluate(async () => {
      const tile = Array.from(document.querySelectorAll(".person-tile")).find((node) =>
        node.textContent.includes("回帰テスト"),
      );
      tile.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 80, clientY: 80 }));
      await new Promise((resolve) => setTimeout(resolve, 520));
      tile.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientX: 80, clientY: 80 }));
    });
    await page.locator("#preview-dialog[open]").waitFor();
    await page.getByRole("button", { name: "AI 用に整理する" }).click();
    await page.locator("#handoff-dialog[open]").waitFor();

    const snapshots = await page.evaluate(() => window.__dialogOpenSnapshots);
    const captureSnapshot = snapshots.find((item) => item.id === "capture-dialog");
    const previewSnapshot = snapshots.find((item) => item.id === "preview-dialog");
    const handoffSnapshot = snapshots.find((item) => item.id === "handoff-dialog");

    assert.ok(captureSnapshot, "capture dialog should open");
    assert.notEqual(captureSnapshot.captureName, "名前");
    assert.notEqual(captureSnapshot.captureObservedAt, "");

    assert.ok(previewSnapshot, "preview dialog should open");
    assert.equal(previewSnapshot.previewName, "回帰テスト");

    assert.ok(handoffSnapshot, "handoff dialog should open");
    assert.equal(handoffSnapshot.handoffName, "回帰テスト");
    assert.match(handoffSnapshot.handoffPendingCount, /未整理メモ/);
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

test("search finds kanji names from hiragana input", async () => {
  await withPage(async (page, baseUrl) => {
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.locator("#search-input").fill("たな");

    await assert.doesNotReject(() => page.getByRole("button", { name: /田中 はる/ }).waitFor());
    assert.equal(await page.getByRole("button", { name: /佐藤 あおい/ }).count(), 0);
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

test("capture close confirms before discarding unsaved draft", async () => {
  await withPage(async (page, baseUrl) => {
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "名前を追加" }).click();
    await page.locator("#person-name-input").fill("破棄確認");
    await page.getByRole("button", { name: "保存" }).click();

    await page.locator("#capture-dialog[open]").waitFor();
    await page.locator("#capture-draft").fill("保存前に閉じたら確認が必要です。");

    await page.getByRole("button", { name: "閉じる" }).click();
    await page.locator("#discard-capture-dialog[open]").waitFor();
    await page.locator("#discard-capture-cancel-button").click();
    await page.locator("#capture-dialog[open]").waitFor();
    await assert.doesNotReject(() => page.locator("#capture-draft").waitFor());

    await page.getByRole("button", { name: "閉じる" }).click();
    await page.locator("#discard-capture-dialog[open]").waitFor();
    await page.locator("#discard-capture-confirm-button").click();
    await page.locator("#capture-dialog").waitFor({ state: "hidden" });
  });
});

test("handoff close confirms before discarding pasted summary", async () => {
  await withPage(async (page, baseUrl) => {
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /田中 はる/ }).click();
    await page.locator("#capture-dialog[open]").waitFor();
    await page.locator("#capture-draft").fill("AI 整理前のメモです。");
    await page.getByRole("button", { name: "保存する" }).click();

    await page.evaluate(async () => {
      const tile = Array.from(document.querySelectorAll(".person-tile")).find((node) =>
        node.textContent.includes("田中 はる"),
      );
      tile.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 80, clientY: 80 }));
      await new Promise((resolve) => setTimeout(resolve, 520));
      tile.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientX: 80, clientY: 80 }));
    });
    await page.locator("#preview-dialog[open]").waitFor();
    await page.getByRole("button", { name: "AI 用に整理する" }).click();
    await page.locator("#handoff-dialog[open]").waitFor();
    await page.locator("#handoff-import-text").fill("貼り戻し文を保存前に閉じます。");

    await page.locator("#handoff-close-button").click();
    await page.locator("#discard-handoff-dialog[open]").waitFor();
    await page.locator("#discard-handoff-cancel-button").click();
    await page.locator("#handoff-dialog[open]").waitFor();
    await assert.doesNotReject(() => page.locator("#handoff-import-text").waitFor());
    assert.equal(await page.locator("#handoff-import-text").inputValue(), "貼り戻し文を保存前に閉じます。");

    await page.locator("#handoff-close-button").click();
    await page.locator("#discard-handoff-dialog[open]").waitFor();
    await page.locator("#discard-handoff-confirm-button").click();
    await page.locator("#handoff-dialog").waitFor({ state: "hidden" });
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
      recordCounts: { people: 1, memos: 1, summaries: 1, scenes: 2 },
      state: {
        people: [
          {
            id: "person-imported",
            name: "インポート確認",
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
    assert.match(firstConfirmMessages[0], /1 人/);
    assert.match(firstConfirmMessages[0], /1 件/);

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
  });
});
