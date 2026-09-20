(() => {
  "use strict";

  const VERSION = "1.0.2";
  const THEATER_MODULE_ID = "com.ugreen.videomgr";
  const STEP = 42;

  let theaterLaunched = false;
  let attempts = 0;
  const MAX_ATTEMPTS = 360;

  // Always-visible proof that the new userscript is actually running.
  const badge = document.createElement("div");
  badge.textContent = "UGREEN Theater v" + VERSION + " • ↑↓←→ cursor • OK click";
  Object.assign(badge.style, {
    position: "fixed",
    top: "14px",
    left: "14px",
    zIndex: "2147483647",
    background: "rgba(0,0,0,.82)",
    color: "#fff",
    border: "2px solid #44d7ff",
    borderRadius: "8px",
    padding: "8px 12px",
    font: "16px Arial, sans-serif",
    pointerEvents: "none"
  });
  document.documentElement.appendChild(badge);

  // Virtual cursor, independent of the site's own focus/navigation.
  const cursor = document.createElement("div");
  Object.assign(cursor.style, {
    position: "fixed",
    width: "22px",
    height: "22px",
    marginLeft: "-11px",
    marginTop: "-11px",
    border: "4px solid #ffd400",
    borderRadius: "50%",
    boxSizing: "border-box",
    background: "rgba(255,212,0,.22)",
    boxShadow: "0 0 8px #000",
    zIndex: "2147483647",
    pointerEvents: "none"
  });
  document.documentElement.appendChild(cursor);

  let cx = Math.round(window.innerWidth / 2);
  let cy = Math.round(window.innerHeight / 2);

  function drawCursor() {
    cx = Math.max(8, Math.min(window.innerWidth - 8, cx));
    cy = Math.max(8, Math.min(window.innerHeight - 8, cy));
    cursor.style.left = cx + "px";
    cursor.style.top = cy + "px";
  }
  drawCursor();

  function deepestAtPoint(doc, x, y) {
    let el;
    try { el = doc.elementFromPoint(x, y); } catch (_) { return null; }
    if (!el) return null;

    const tag = (el.tagName || "").toUpperCase();
    if ((tag === "IFRAME" || tag === "FRAME") && el.contentDocument) {
      try {
        const r = el.getBoundingClientRect();
        const inner = deepestAtPoint(el.contentDocument, x - r.left, y - r.top);
        return inner || el;
      } catch (_) {}
    }
    return el;
  }

  function clickAtCursor() {
    const el = deepestAtPoint(document, cx, cy);
    if (!el) return;

    try { el.focus({preventScroll: true}); } catch (_) {
      try { el.focus(); } catch (_) {}
    }

    const opts = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: cx,
      clientY: cy,
      button: 0,
      buttons: 1
    };

    try {
      if (typeof PointerEvent !== "undefined") {
        el.dispatchEvent(new PointerEvent("pointerdown", opts));
        el.dispatchEvent(new PointerEvent("pointerup", {...opts, buttons: 0}));
      }
    } catch (_) {}

    try { el.dispatchEvent(new MouseEvent("mousedown", opts)); } catch (_) {}
    try { el.dispatchEvent(new MouseEvent("mouseup", {...opts, buttons: 0})); } catch (_) {}
    try { el.click(); } catch (_) {
      try { el.dispatchEvent(new MouseEvent("click", {...opts, buttons: 0})); } catch (_) {}
    }

    // For text/password inputs, try to make the TV IME appear.
    const tag = (el.tagName || "").toUpperCase();
    if (tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable) {
      try { el.focus(); } catch (_) {}
    }
  }

  function onKey(ev) {
    if (theaterLaunched) return;

    const code = ev.keyCode || ev.which;
    let handled = true;

    switch (code) {
      case 37: cx -= STEP; break; // left
      case 38: cy -= STEP; break; // up
      case 39: cx += STEP; break; // right
      case 40: cy += STEP; break; // down
      case 13: clickAtCursor(); break; // OK/Enter
      default: handled = false;
    }

    if (handled) {
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation?.();
      drawCursor();
    }
  }

  window.addEventListener("keydown", onKey, true);

  function tryLaunchTheater() {
    if (theaterLaunched) return;
    attempts++;

    try {
      const el = document.querySelector(`[moduleId="${THEATER_MODULE_ID}"]`);
      const vue = el && el.__vue__;
      const item = vue && vue.$props && vue.$props.item;

      if (vue && item) {
        console.log("[UGREEN Theater] Found:", item.module_id);
        vue.$emit("click", item);
        theaterLaunched = true;
        badge.textContent = "UGREEN Theater v" + VERSION + " • launching Theater…";
        cursor.style.display = "none";
        setTimeout(() => badge.remove(), 2500);
        clearInterval(timer);
        return;
      }
    } catch (err) {
      console.error("[UGREEN Theater] launch attempt:", err);
    }

    if (attempts >= MAX_ATTEMPTS) {
      clearInterval(timer);
      badge.textContent = "UGREEN Theater v" + VERSION + " • Theater not found";
    }
  }

  const timer = setInterval(tryLaunchTheater, 700);
  setTimeout(tryLaunchTheater, 250);
})();