export const PREVIEW_MIN_HEIGHT = 300;
export const PREVIEW_MAX_HEIGHT = 12000;

export function previewHeight(value) {
  const height = Number(value);
  return Number.isFinite(height) && height > 0 ? Math.min(PREVIEW_MAX_HEIGHT, Math.max(PREVIEW_MIN_HEIGHT, Math.ceil(height))) : 420;
}

/** A frame document is prepared once. Resizing never replaces its React host. */
export function preparePreviewDocument(frame, parentDocument) {
  const document = frame?.contentDocument;
  if (!document?.head || !document?.body) return null;
  document.documentElement.lang = "zh-CN";
  document.documentElement.dataset.theme = parentDocument.documentElement.dataset.theme || "light";
  document.body.className = parentDocument.body.className;
  let root = document.getElementById("reading-preview-root");
  if (!root) {
    const base = document.createElement("base");
    base.href = parentDocument.location.href;
    document.head.appendChild(base);
    for (const sheet of parentDocument.head.querySelectorAll('style, link[rel="stylesheet"]')) {
      const copy = sheet.cloneNode(true);
      copy.dataset.previewStyle = "true";
      document.head.appendChild(copy);
    }
    const style = document.createElement("style");
    style.dataset.previewReset = "true";
    style.textContent = "html,body{margin:0!important;padding:0!important;min-height:0!important;overflow-x:hidden;background:#fff!important;}#reading-preview-root{width:100%;min-width:0;}*{scroll-behavior:auto!important;}";
    document.head.appendChild(style);
    root = document.createElement("div");
    root.id = "reading-preview-root";
    document.body.appendChild(root);
  }
  return { document, root };
}

/** Each subscription belongs to one live frame document and one React host. */
export function observePreviewSize({ frame, document, root, onHeight, onError }) {
  const view = document.defaultView || frame.ownerDocument.defaultView;
  const parentView = frame.ownerDocument.defaultView;
  let active = true, queued = null, queueKind = "";
  const current = () => active && frame.isConnected && root.isConnected && frame.contentDocument === document && document.getElementById("reading-preview-root") === root;
  function measure() {
    queued = null;
    if (!current()) return;
    try {
      const measured = Math.max(Number(root.getBoundingClientRect().height) || 0, Number(root.scrollHeight) || 0);
      onHeight(previewHeight(measured), measured > PREVIEW_MAX_HEIGHT);
    } catch (error) { if (active) onError?.(error); }
  }
  function schedule() {
    if (!current() || queued !== null) return;
    if (typeof view.requestAnimationFrame === "function") {
      queueKind = "frame"; queued = view.requestAnimationFrame(measure);
    } else {
      queueKind = "timer"; queued = view.setTimeout(measure, 0);
    }
  }
  const Observer = view.ResizeObserver || parentView?.ResizeObserver;
  const observer = Observer ? new Observer(schedule) : null;
  observer?.observe(root);
  const MutationObserver = view.MutationObserver || parentView?.MutationObserver;
  const mutations = MutationObserver ? new MutationObserver(schedule) : null;
  mutations?.observe(root, { childList: true, subtree: true, characterData: true });
  // Capturing load covers images inserted after the portal was attached too.
  document.addEventListener("load", schedule, true);
  document.addEventListener("error", schedule, true);
  view.addEventListener("resize", schedule);
  if (parentView && parentView !== view) parentView.addEventListener("resize", schedule);
  document.fonts?.ready?.then(schedule, schedule);
  schedule();
  return {
    schedule,
    dispose() {
      active = false;
      observer?.disconnect(); mutations?.disconnect();
      if (queued !== null) {
        if (queueKind === "frame") view.cancelAnimationFrame?.(queued);
        else view.clearTimeout(queued);
        queued = null;
      }
      document.removeEventListener("load", schedule, true);
      document.removeEventListener("error", schedule, true);
      view.removeEventListener("resize", schedule);
      if (parentView && parentView !== view) parentView.removeEventListener("resize", schedule);
    },
  };
}
