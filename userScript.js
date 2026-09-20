(() => {
  "use strict";

  const THEATER_MODULE_ID = "com.ugreen.videomgr";
  const CHECK_EVERY_MS = 700;
  const MAX_THEATER_ATTEMPTS = 260;

  let theaterAttempts = 0;
  let theaterLaunched = false;

  let loginControls = [];
  let selectedIndex = 0;
  let imeMode = false;
  let highlightedEl = null;
  let originalOutline = "";
  let helper = null;

  const isVisible = (el) => {
    if (!el) return false;
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return s.display !== "none" &&
           s.visibility !== "hidden" &&
           Number(s.opacity || 1) > 0 &&
           r.width > 2 &&
           r.height > 2;
  };

  const isTextInput = (el) =>
    !!el && (
      el.tagName === "TEXTAREA" ||
      (el.tagName === "INPUT" &&
       !["button","submit","checkbox","radio","hidden"].includes((el.type || "").toLowerCase()))
    );

  function getLoginControls() {
    const pass = [...document.querySelectorAll('input[type="password"]')].find(isVisible);
    if (!pass) return [];

    const user = [...document.querySelectorAll(
      'input:not([type]),input[type="text"],input[type="email"],input[type="tel"]'
    )].find(el => isVisible(el));

    // Prefer controls in the nearest form/container that contains the password field.
    let root = pass.closest("form");
    if (!root) {
      let p = pass.parentElement;
      while (p && p !== document.body) {
        const r = p.getBoundingClientRect();
        if (r.width >= 220 && r.width <= 800 && r.height >= 180 && r.height <= 850) {
          const buttons = p.querySelectorAll('button,[role="button"],[tabindex],a');
          if (buttons.length) { root = p; break; }
        }
        p = p.parentElement;
      }
    }
    root = root || document;

    const candidates = [
      ...(user ? [user] : []),
      pass,
      ...root.querySelectorAll(
        'button,[role="button"],a[href],[tabindex]:not([tabindex="-1"]),input[type="submit"],input[type="button"]'
      )
    ].filter(isVisible);

    // Deduplicate while preserving order.
    return [...new Set(candidates)];
  }

  function ensureHelper() {
    if (helper && document.contains(helper)) return;
    helper = document.createElement("div");
    helper.id = "ugreen-tizen-remote-helper";
    helper.textContent = "↑ ↓ ← → избор   •   OK потвърждение";
    Object.assign(helper.style, {
      position: "fixed",
      left: "50%",
      bottom: "28px",
      transform: "translateX(-50%)",
      zIndex: "2147483647",
      background: "rgba(0,0,0,.78)",
      color: "#fff",
      padding: "12px 18px",
      borderRadius: "10px",
      fontSize: "18px",
      fontFamily: "Arial, sans-serif",
      pointerEvents: "none",
      boxShadow: "0 2px 12px rgba(0,0,0,.4)"
    });
    document.documentElement.appendChild(helper);
  }

  function removeHelper() {
    if (helper) helper.remove();
    helper = null;
  }

  function clearHighlight() {
    if (highlightedEl) {
      highlightedEl.style.outline = originalOutline;
      highlightedEl.style.outlineOffset = "";
    }
    highlightedEl = null;
    originalOutline = "";
  }

  function highlight(index) {
    loginControls = getLoginControls();
    if (!loginControls.length) {
      clearHighlight();
      removeHelper();
      return;
    }

    selectedIndex = (index + loginControls.length) % loginControls.length;
    const el = loginControls[selectedIndex];

    clearHighlight();
    highlightedEl = el;
    originalOutline = el.style.outline || "";
    el.style.outline = "4px solid #ffd400";
    el.style.outlineOffset = "4px";
    el.scrollIntoView?.({block: "nearest", inline: "nearest"});

    ensureHelper();
  }

  function refreshLoginNavigation() {
    const newControls = getLoginControls();

    if (!newControls.length) {
      loginControls = [];
      clearHighlight();
      removeHelper();
      imeMode = false;
      return false;
    }

    const current = loginControls[selectedIndex];
    loginControls = newControls;

    if (!highlightedEl || !document.contains(highlightedEl)) {
      const idx = current ? loginControls.indexOf(current) : -1;
      highlight(idx >= 0 ? idx : 0);
    }

    return true;
  }

  function activateSelected() {
    refreshLoginNavigation();
    const el = loginControls[selectedIndex];
    if (!el) return;

    if (isTextInput(el)) {
      el.focus({preventScroll: true});
      try { el.click(); } catch (_) {}
      imeMode = true;
      return;
    }

    try {
      el.focus({preventScroll: true});
      el.click();
    } catch (_) {
      try {
        const r = el.getBoundingClientRect();
        el.dispatchEvent(new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: r.left + r.width / 2,
          clientY: r.top + r.height / 2
        }));
      } catch (_) {}
    }
  }

  function onRemoteKey(ev) {
    if (!getLoginControls().length) return;

    const code = ev.keyCode || ev.which;

    // When Samsung IME is open, let the IME handle ordinary arrows/typing.
    if (imeMode) {
      if (code === 65376) { // IME Done
        imeMode = false;
        document.activeElement?.blur?.();
        highlight(selectedIndex + 1);
        ev.preventDefault();
        ev.stopPropagation();
      } else if (code === 65385 || code === 10009) { // IME Cancel / Back
        imeMode = false;
        document.activeElement?.blur?.();
      }
      return;
    }

    if ([37, 38].includes(code)) { // Left / Up
      ev.preventDefault();
      ev.stopPropagation();
      highlight(selectedIndex - 1);
      return;
    }

    if ([39, 40].includes(code)) { // Right / Down
      ev.preventDefault();
      ev.stopPropagation();
      highlight(selectedIndex + 1);
      return;
    }

    if (code === 13) { // Enter / OK
      ev.preventDefault();
      ev.stopPropagation();
      activateSelected();
    }
  }

  window.addEventListener("keydown", onRemoteKey, true);

  function tryLaunchTheater() {
    if (theaterLaunched) return;

    // If login is visible, wait for the user to log in.
    if (refreshLoginNavigation()) return;

    theaterAttempts += 1;

    try {
      const el = document.querySelector(`[moduleId="${THEATER_MODULE_ID}"]`);
      const vue = el && el.__vue__;
      const item = vue && vue.$props && vue.$props.item;

      if (vue && item) {
        console.log("[UGREEN Theater] Found:", item.module_id);
        vue.$emit("click", item);
        theaterLaunched = true;
        console.log("[UGREEN Theater] Launch command sent.");
      }
    } catch (err) {
      console.error("[UGREEN Theater] Launch attempt failed:", err);
    }

    if (theaterAttempts >= MAX_THEATER_ATTEMPTS) {
      console.error("[UGREEN Theater] Timed out waiting for UGOS/Theater.");
    }
  }

  const timer = setInterval(() => {
    if (theaterLaunched || theaterAttempts >= MAX_THEATER_ATTEMPTS) {
      clearInterval(timer);
      return;
    }
    tryLaunchTheater();
  }, CHECK_EVERY_MS);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      setTimeout(tryLaunchTheater, 300);
    }, {once: true});
  } else {
    setTimeout(tryLaunchTheater, 300);
  }
})();
