/* Hides Instagram Reels (menu link, reel posts in the feed) and sends /reels/ pages away. */
(function () {
  "use strict";

  const css =
    "article:has(a[href*='/reel/']) { display: none !important; }" +
    "a[href='/reels/'], a[href^='/reels/'] { display: none !important; }";

  let style = null;
  let cfg = { enabled: true, reels: true, mode: "hide" };

  function hideMenu() {
    document.querySelectorAll("a[href^='/reels']").forEach((a) => {
      const holder = a.closest("[role='listitem'], li") || a;
      holder.style.display = "none";
    });
  }

  function apply() {
    const on = cfg.enabled !== false && cfg.reels !== false;

    if (on && !style) {
      style = document.createElement("style");
      style.textContent = css;
      document.documentElement.appendChild(style);
    }
    if (!on && style) { style.remove(); style = null; }

    if (on) {
      hideMenu();
      if (/(^|\/)reels?(\/|$)/.test(location.pathname)) {
        if (cfg.mode === "message") {
          chrome.runtime.sendMessage({ type: "block-page", why: "reels", back: "https://www.instagram.com/" });
        } else {
          location.replace("/");
        }
      }
    }
  }

  function load() {
    chrome.storage.local.get("settings", (d) => {
      cfg = Object.assign(cfg, d.settings || {});
      apply();
    });
  }

  load();
  chrome.storage.onChanged.addListener((changes) => { if (changes.settings) { load(); } });
  setInterval(apply, 700);                       // Instagram changes pages without reloading
})();
