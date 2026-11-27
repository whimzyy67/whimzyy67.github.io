/* Runs only on the Whimzyy website. Lets the Detox page talk to the extension. */
(function () {
  "use strict";

  const PAGE = "whimzyy-page", EXT = "whimzyy-ext";

  function reply(type, payload) {
    window.postMessage(Object.assign({ source: EXT, type: type }, payload || {}), window.location.origin);
  }

  window.addEventListener("message", async (event) => {
    const msg = event.data;
    if (event.source !== window || !msg || msg.source !== PAGE) { return; }

    try {
      if (msg.type === "ping") {
        reply("pong", { version: chrome.runtime.getManifest().version });
      } else if (msg.type === "set-settings") {
        await chrome.storage.local.set({ settings: msg.settings });
        reply("saved");
      } else if (msg.type === "get") {
        const data = await chrome.storage.local.get(["settings", "usage", "history", "snoozeCount"]);
        reply("data", { data: data });
      }
    } catch (e) {
      /* the extension was reloaded: the page will ping again and show the "not connected" note */
    }
  });

  reply("pong", { version: chrome.runtime.getManifest().version });
})();
