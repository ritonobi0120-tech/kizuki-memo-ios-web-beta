import test from "node:test";
import assert from "node:assert/strict";

const {
  bindDialogStateEvents,
  bindLongPress,
  buildRefreshUrl,
  escapeHtml,
  resetDialogScroll,
  resolveDialogPresentation,
  showPreparedDialog,
  syncDialogBodyState,
} = await import("./dom-helpers.mjs");

test("buildRefreshUrl appends a cache-busting update param", () => {
  const url = buildRefreshUrl("https://example.com/app?foo=1", 12345);

  assert.equal(url, "https://example.com/app?foo=1&update=12345");
});

test("escapeHtml protects copy blocks from markup injection", () => {
  assert.equal(escapeHtml(`"<tag>" & 'quote'`), "&quot;&lt;tag&gt;&quot; &amp; &#39;quote&#39;");
});

test("syncDialogBodyState toggles the dialog-open class from dialog states", () => {
  const calls = [];
  const body = {
    classList: {
      toggle(name, value) {
        calls.push([name, value]);
      },
    },
  };

  syncDialogBodyState({
    dialogs: {
      a: { open: false },
      b: { open: true },
    },
    body,
  });

  assert.deepEqual(calls, [["dialog-open", true]]);
});

test("resolveDialogPresentation prefers sheet mode on iPhone Safari", () => {
  assert.equal(
    resolveDialogPresentation({
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      maxTouchPoints: 5,
      innerWidth: 390,
    }),
    "sheet",
  );
  assert.equal(
    resolveDialogPresentation({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
      maxTouchPoints: 0,
      innerWidth: 1280,
    }),
    "modal",
  );
});

test("showPreparedDialog resets scroll, opens modal, and resyncs body state", () => {
  let scrolled = 12;
  let openedModal = false;
  let toggled = false;
  const dialog = {
    open: false,
    dataset: {},
    querySelector(selector) {
      assert.equal(selector, ".sheet-content");
      return {
        get scrollTop() {
          return scrolled;
        },
        set scrollTop(value) {
          scrolled = value;
        },
      };
    },
    showModal() {
      openedModal = true;
      dialog.open = true;
    },
    show() {
      throw new Error("modeless show should not be used in modal presentation");
    },
  };
  const body = {
    classList: {
      toggle(name, value) {
        if (name === "dialog-open" && value === true) {
          toggled = true;
        }
      },
    },
  };

  showPreparedDialog(dialog, { dialogs: { dialog }, body, presentation: "modal" });

  assert.equal(scrolled, 0);
  assert.equal(openedModal, true);
  assert.equal(toggled, true);
  assert.equal(dialog.dataset.presentation, "modal");
});

test("showPreparedDialog can use sheet presentation without showModal", () => {
  let openedSheet = false;
  const dialog = {
    dataset: {},
    querySelector() {
      return null;
    },
    show() {
      openedSheet = true;
    },
    showModal() {
      throw new Error("showModal should not run for sheet presentation");
    },
    open: false,
  };

  showPreparedDialog(dialog, { presentation: "sheet", body: null });

  assert.equal(openedSheet, true);
  assert.equal(dialog.dataset.presentation, "sheet");
});

test("bindDialogStateEvents wires close and cancel to the shared sync callback", () => {
  const listeners = [];
  const dialog = {
    addEventListener(type, callback) {
      listeners.push({ type, callback });
    },
  };

  bindDialogStateEvents({ dialogs: { dialog }, onSync: () => {} });

  assert.deepEqual(
    listeners.map((entry) => entry.type),
    ["close", "cancel"],
  );
});

test("bindLongPress routes pointer events to tap or long press handlers", async () => {
  const listeners = {};
  const node = {
    addEventListener(type, callback) {
      listeners[type] = callback;
    },
  };
  const calls = [];
  bindLongPress(
    node,
    () => calls.push("long"),
    () => calls.push("tap"),
    {
      setTimeoutImpl: globalThis.setTimeout,
      clearTimeoutImpl: globalThis.clearTimeout,
    },
  );

  listeners.pointerdown();
  await new Promise((resolve) => setTimeout(resolve, 20));
  listeners.pointerup();
  assert.deepEqual(calls, ["tap"]);
});

test("resetDialogScroll ignores dialogs without sheet content", () => {
  const dialog = {
    querySelector() {
      return null;
    },
  };

  assert.doesNotThrow(() => resetDialogScroll(dialog));
});
