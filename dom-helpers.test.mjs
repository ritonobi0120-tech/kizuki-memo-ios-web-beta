import test from "node:test";
import assert from "node:assert/strict";

const {
  bindDialogStateEvents,
  bindLongPress,
  buildRefreshUrl,
  escapeHtml,
  resetDialogScroll,
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

test("showPreparedDialog resets scroll, opens modal, and resyncs body state", () => {
  let scrolled = 12;
  let opened = false;
  let toggled = false;
  const dialog = {
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
      opened = true;
    },
    open: true,
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

  showPreparedDialog(dialog, { dialogs: { dialog }, body });

  assert.equal(scrolled, 0);
  assert.equal(opened, true);
  assert.equal(toggled, true);
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
