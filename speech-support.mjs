export function detectSpeechSupport({ windowLike = globalThis } = {}) {
  const ctor =
    windowLike.SpeechRecognition ||
    windowLike.webkitSpeechRecognition ||
    null;

  if (!ctor) {
    return {
      available: false,
      engine: "none",
      ctor: null,
    };
  }

  return {
    available: true,
    engine: windowLike.webkitSpeechRecognition ? "webkit" : "standard",
    ctor,
  };
}

export function composeDraftText(baseText, additionText) {
  const base = (baseText || "").replace(/\s+$/u, "");
  const addition = (additionText || "").trim();

  if (!addition) return base;
  if (!base) return addition;
  return `${base}\n${addition}`;
}

export function mapSpeechErrorMessage(errorCode) {
  switch (errorCode) {
    case "not-allowed":
    case "service-not-allowed":
      return "マイクの許可がないため始められません。キーボードのマイクも確認してください。";
    case "audio-capture":
      return "マイクが使えませんでした。キーボードのマイクに切り替えてください。";
    case "network":
      return "音声入力が不安定でした。もう一度試すか、キーボードのマイクを使ってください。";
    case "no-speech":
    case "aborted":
      return "音声を取り込めませんでした。もう一度押すか、キーボードのマイクを使ってください。";
    case "unsupported":
    default:
      return "この iPhone ではボタン音声入力が使いにくいので、キーボードのマイクを使ってください。";
  }
}
