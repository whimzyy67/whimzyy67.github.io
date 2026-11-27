/* Hides YouTube Shorts (shelves, menu entry, search results) and sends /shorts/ links to the normal player. */
(function () {
  "use strict";

  const css =
    "ytd-rich-shelf-renderer[is-shorts], ytd-reel-shelf-renderer, ytm-reel-shelf-renderer," +
    "ytd-guide-entry-renderer:has(a[title='Shorts']), ytd-mini-guide-entry-renderer[aria-label='Shorts']," +
    "ytd-rich-item-renderer:has(a[href^='/shorts/']), ytd-video-renderer:has(a[href^='/shorts/'])," +
    "grid-shelf-view-model:has(a[href^='/shorts/']), ytm-shorts-lockup-view-model," +
    "yt-tab-shape[tab-title='Shorts'] { display: none !important; }";

  let style = null;
  let cfg = { enabled: true, shorts: true, mode: "hide" };

  function apply() {
    const on = cfg.enabled !== false && cfg.shorts !== false;

    if (on && !style) {
      style = document.createElement("style");
      style.textContent = css;
      document.documentElement.appendChild(style);
    }
    if (!on && style) { style.remove(); style = null; }

    if (on && location.pathname.indexOf("/shorts/") === 0) {
      const id = location.pathname.split("/")[2] || "";
      if (cfg.mode === "message") {
        chrome.runtime.sendMessage({ type: "block-page", why: "shorts", back: "https://www.youtube.com/" });
      } else if (id) {
        location.replace("/watch?v=" + encodeURIComponent(id));
      } else {
        location.replace("/");
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
  setInterval(apply, 700);                       // YouTube changes pages without reloading
})();
