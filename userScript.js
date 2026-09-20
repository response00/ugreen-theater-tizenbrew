(() => {
  "use strict";

  const THEATER_MODULE_ID = "com.ugreen.videomgr";
  const CHECK_EVERY_MS = 1000;
  const MAX_ATTEMPTS = 180; // wait up to ~3 minutes for UGOS to load

  let attempts = 0;
  let launched = false;

  function tryLaunchTheater() {
    if (launched) return;

    attempts += 1;

    try {
      const el = document.querySelector(
        `[moduleId="${THEATER_MODULE_ID}"]`
      );

      const vue = el && el.__vue__;
      const item = vue && vue.$props && vue.$props.item;

      if (vue && item) {
        console.log("[UGREEN Theater] Found Theater:", item.module_id);
        vue.$emit("click", item);
        launched = true;
        clearInterval(timer);
        console.log("[UGREEN Theater] Launch command sent.");
        return;
      }
    } catch (err) {
      console.error("[UGREEN Theater] Launch attempt failed:", err);
    }

    if (attempts >= MAX_ATTEMPTS) {
      clearInterval(timer);
      console.error(
        "[UGREEN Theater] Theater was not found. " +
        "Make sure UGOS Pro loaded and you are signed in."
      );
    }
  }

  const timer = setInterval(tryLaunchTheater, CHECK_EVERY_MS);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      setTimeout(tryLaunchTheater, 500);
    }, { once: true });
  } else {
    setTimeout(tryLaunchTheater, 500);
  }
})();
