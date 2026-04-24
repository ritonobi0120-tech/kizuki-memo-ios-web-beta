import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const ASSET_VERSION_PATTERN = /[?&]v=20260424-safari-search/;

test("index loads versioned app shell assets so update reloads cannot reuse stale files", async () => {
  const html = await fs.readFile("index.html", "utf8");

  assert.match(html, /href="\.\/styles\.css\?v=20260424-safari-search"/);
  assert.match(html, /src="\.\/app\.js\?v=20260424-safari-search"/);
});

test("app module imports and service worker registration bypass stale module caches", async () => {
  const app = await fs.readFile("app.js", "utf8");

  for (const modulePath of [
    "./speech-support.mjs",
    "./ui-logic.mjs",
    "./storage-logic.mjs",
    "./dom-helpers.mjs",
    "./name-search.mjs",
  ]) {
    assert.match(app, new RegExp(`${escapeRegExp(modulePath)}\\?v=20260424-safari-search`));
  }
  assert.match(app, /navigator\.serviceWorker\.register\("\.\/sw\.js\?v=20260424-safari-search", \{ updateViaCache: "none" \}\)/);
});

test("service worker uses a new cache and preloads the same versioned app shell assets", async () => {
  const worker = await fs.readFile("sw.js", "utf8");

  assert.match(worker, /kizuki-ios-web-beta-v7/);
  for (const asset of [
    "./styles.css",
    "./app.js",
    "./dom-helpers.mjs",
    "./name-search.mjs",
    "./speech-support.mjs",
    "./storage-logic.mjs",
    "./ui-logic.mjs",
  ]) {
    assert.match(worker, new RegExp(`${escapeRegExp(asset)}\\?v=20260424-safari-search`));
  }
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
