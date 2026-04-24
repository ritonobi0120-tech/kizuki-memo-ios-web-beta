export function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

export function bindDialogStateEvents({ dialogs, onSync }) {
  for (const dialog of Object.values(dialogs)) {
    dialog.addEventListener("close", onSync);
    dialog.addEventListener("cancel", onSync);
  }
}

export function syncDialogBodyState({ dialogs, body = globalThis.document?.body } = {}) {
  const anyOpen = Object.values(dialogs).some((dialog) => dialog.open);
  body?.classList?.toggle("dialog-open", anyOpen);
}

export function resolveDialogPresentation({
  userAgent = globalThis.navigator?.userAgent ?? "",
  maxTouchPoints = globalThis.navigator?.maxTouchPoints ?? 0,
  innerWidth = globalThis.window?.innerWidth ?? 1024,
} = {}) {
  const isIPhoneSafari =
    /iPhone/i.test(userAgent) &&
    /Safari/i.test(userAgent) &&
    !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(userAgent);
  return isIPhoneSafari && maxTouchPoints > 0 && innerWidth <= 520 ? "sheet" : "modal";
}

export function showPreparedDialog(
  dialog,
  {
    dialogs,
    body = globalThis.document?.body,
    presentation = resolveDialogPresentation(),
  } = {},
) {
  resetDialogScroll(dialog);
  dialog.dataset.presentation = presentation;
  if (!dialog.open) {
    if (presentation === "sheet" && typeof dialog.show === "function") {
      dialog.show();
    } else {
      dialog.showModal();
    }
  }
  if (dialogs) {
    syncDialogBodyState({ dialogs, body });
  }
}

export function resetDialogScroll(dialog) {
  const content = dialog.querySelector(".sheet-content");
  if (content) {
    content.scrollTop = 0;
  }
}

export function bindLongPress(
  node,
  onLongPress,
  onTap,
  {
    setTimeoutImpl = globalThis.setTimeout,
    clearTimeoutImpl = globalThis.clearTimeout,
    delayMs = 420,
  } = {},
) {
  let timer = null;
  let longPressed = false;
  node.addEventListener("pointerdown", () => {
    longPressed = false;
    timer = setTimeoutImpl(() => {
      longPressed = true;
      onLongPress();
    }, delayMs);
  });
  const cancel = () => {
    clearTimeoutImpl(timer);
  };
  node.addEventListener("pointerup", () => {
    if (!longPressed) {
      onTap();
    }
    cancel();
  });
  node.addEventListener("pointerleave", cancel);
  node.addEventListener("pointercancel", cancel);
  node.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    onLongPress();
  });
}

export function buildRefreshUrl(currentUrl, timestamp, baseUrl = currentUrl) {
  const url = new URL(currentUrl, baseUrl);
  url.searchParams.set("update", String(timestamp));
  return url.toString();
}
