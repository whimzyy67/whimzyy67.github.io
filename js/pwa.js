/* Whimzyy PWA helper. ONE script tag per page makes the site installable:
     root pages (index.html, home.html):   <script src="js/pwa.js"></script>
     pages inside /html/:                  <script src="../js/pwa.js"></script>
   It adds the manifest + phone colour tags, registers the service worker,
   and shows a small "Install app" pill when the browser allows installing. */
(function () {
  "use strict";
  var here = document.currentScript && document.currentScript.src;
  if (!here) { return; }
  var root = new URL("../", here).href; // site root, wherever this page lives

  function head(tag, attrs) {
    var el = document.createElement(tag);
    Object.keys(attrs).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    document.head.appendChild(el);
  }
  head("link", { rel: "manifest", href: root + "pwa/manifest.json" });
  head("meta", { name: "theme-color", content: "#2E0A10" });
  head("meta", { name: "mobile-web-app-capable", content: "yes" });
  head("meta", { name: "apple-mobile-web-app-capable", content: "yes" });
  head("meta", { name: "apple-mobile-web-app-title", content: "Whimzyy" });
  head("link", { rel: "apple-touch-icon", href: root + "pwa/icons/apple-touch-icon.png" });

  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register(root + "sw.js").catch(function () {});
    });
  }

  // ---- Install pill ----
  var DISMISS = "whimzyy-install-dismissed";
  var deferred = null;
  function dismissed() { try { return localStorage.getItem(DISMISS) === "1"; } catch (e) { return false; } }
  function standalone() {
    return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  }

  function showPill(text, onClick) {
    if (standalone() || dismissed() || document.getElementById("pwaPill")) { return; }
    var box = document.createElement("div");
    box.id = "pwaPill";
    box.style.cssText = "position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:9999;" +
      "display:flex;align-items:center;gap:8px;padding:8px 10px 8px 16px;border-radius:999px;" +
      "background:var(--gold,#E8B86D);color:var(--bg,#1F0508);font:700 14px 'DM Sans',Arial,sans-serif;" +
      "box-shadow:0 6px 24px rgba(0,0,0,.45)";
    var b = document.createElement("button");
    b.type = "button"; b.textContent = text;
    b.style.cssText = "all:unset;cursor:pointer";
    b.addEventListener("click", function () { onClick(); });
    var x = document.createElement("button");
    x.type = "button"; x.textContent = "✕"; x.setAttribute("aria-label", "Dismiss");
    x.style.cssText = "all:unset;cursor:pointer;padding:2px 8px;opacity:.7";
    x.addEventListener("click", function () {
      try { localStorage.setItem(DISMISS, "1"); } catch (e) {}
      box.remove();
    });
    box.appendChild(b); box.appendChild(x);
    document.body.appendChild(box);
  }

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferred = e;
    showPill("Install Whimzyy 📲", function () {
      deferred.prompt();
      deferred.userChoice.then(function () {
        deferred = null;
        var p = document.getElementById("pwaPill"); if (p) { p.remove(); }
      });
    });
  });

  window.addEventListener("appinstalled", function () {
    var p = document.getElementById("pwaPill"); if (p) { p.remove(); }
  });

  // iPhone/iPad Safari has no install prompt, so show how to do it by hand.
  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (isIOS && !standalone()) {
    window.addEventListener("load", function () {
      setTimeout(function () {
        showPill("Add to Home Screen: tap Share ⬆️ then “Add to Home Screen”", function () {});
      }, 2500);
    });
  }
})();
