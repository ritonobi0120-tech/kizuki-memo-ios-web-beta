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

    await page.getByRole("button", { name: /回帰テスト/ }).click();
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

test("settings includes a manual update button", async () => {
  await withPage(async (page, baseUrl) => {
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "設定" }).click();
    await page.locator("#settings-dialog[open]").waitFor();
    await page.getByRole("button", { name: "最新版に更新する" }).waitFor();
  });
});

test("capture close confirms before discarding unsaved draft", async () => {
  await withPage(async (page, baseUrl) => {
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "名前を追加" }).click();
    await page.locator("#person-name-input").fill("破棄確認");
    await page.getByRole("button", { name: "保存" }).click();

    await page.getByRole("button", { name: /破棄確認/ }).click();
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
