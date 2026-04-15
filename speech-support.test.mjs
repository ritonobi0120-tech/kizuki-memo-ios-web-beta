import test from "node:test";
import assert from "node:assert/strict";

import {
  composeDraftText,
  detectSpeechSupport,
  mapSpeechErrorMessage,
} from "./speech-support.mjs";

test("detectSpeechSupport prefers webkit speech recognition on iPhone-like window", () => {
  const support = detectSpeechSupport({
    windowLike: {
      webkitSpeechRecognition: function FakeRecognition() {},
    },
  });

  assert.equal(support.available, true);
  assert.equal(support.engine, "webkit");
});

test("detectSpeechSupport reports unavailable when no browser speech api exists", () => {
  const support = detectSpeechSupport({
    windowLike: {},
  });

  assert.equal(support.available, false);
  assert.equal(support.engine, "none");
});

test("composeDraftText keeps existing memo and appends final or partial transcript cleanly", () => {
  assert.equal(composeDraftText("朝の記録", "追加の内容"), "朝の記録\n追加の内容");
  assert.equal(composeDraftText("", "追加の内容"), "追加の内容");
  assert.equal(composeDraftText("朝の記録\n", "追加の内容"), "朝の記録\n追加の内容");
});

test("mapSpeechErrorMessage returns keyboard fallback guidance for unsupported environments", () => {
  assert.match(mapSpeechErrorMessage("unsupported"), /キーボードのマイク/);
  assert.match(mapSpeechErrorMessage("not-allowed"), /許可/);
});
