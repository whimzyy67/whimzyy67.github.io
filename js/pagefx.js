/* pagefx.js
   Slide effect between pages. Works for the top-bar buttons on a laptop (Work Space, Home, About Us)
   and for the footer bar and the "More" sheet on a phone.
   The page content slides out, the next page slides in. The top bar, sidebar and footer bar stay put.
   The Account button is a popup, not a page, so it never slides.

   rewards.js loads this file on every page (Dayverse, Focus ... all of them), so you do not have to
   add it to each page. If a page also has its own <script src="...pagefx.js"> tag that is fine, it only runs once. */
(function () {
  "use strict";
  if (window.__wzFx) { return; }
  window.__wzFx = true;

  var root = document.documentElement;

  var NAV_ORDER = ["work-space", "home", "about-us"];                     // top bar, left to right
  var TAB_ORDER = ["home", "detox", "focus", "work-space",                // footer bar, then the More sheet
                   "my-day", "wellness", "growth", "productivity", "dayverse", "search-homies", "vibe", "about-us"];
  var KEY = "wz-slide-dir";

  // Things that must NOT slide.
  var SKIP = ":not(.topbar):not(.sidebar):not(script):not(dialog):not(.star-toast):not(.star-pill)" +
             ":not(.acct-overlay):not(#pwaPill):not(.bg-video):not(.bg-shade):not(.wz-tabbar):not(.wz-more):not(#wz-remind)";

  function rule(cls, css) { return "html." + cls + " body > *" + SKIP + "{" + css + "}"; }

  var style = document.createElement("style");
  style.textContent =
    "html.wz-fx body > *" + SKIP + "{ transition: transform .2s ease, opacity .2s ease; }" +
    rule("wz-out-left",  "transform: translateX(-60px); opacity: 0;") +
    rule("wz-out-right", "transform: translateX(60px);  opacity: 0;") +
    "@keyframes wz-slide-in-left{ from{ transform: translateX(-60px); opacity: 0; } to{ transform: none; opacity: 1; } }" +
    "@keyframes wz-slide-in-right{ from{ transform: translateX(60px); opacity: 0; } to{ transform: none; opacity: 1; } }" +
    rule("wz-in-left",   "animation: wz-slide-in-left .24s ease-out both; transition: none;") +
    rule("wz-in-right",  "animation: wz-slide-in-right .24s ease-out both; transition: none;") +
    "@media (prefers-reduced-motion: reduce){ html.wz-fx body > *{ transition: none !important; } }";
  (document.head || root).appendChild(style);
  root.classList.add("wz-fx");

  function nameOf(path) {
    return (path.split("?")[0].split("#")[0].split("/").pop() || "home").replace(/\.html$/, "") || "home";
  }

  // slide IN on arrival
  var dir = null;
  try { dir = sessionStorage.getItem(KEY); sessionStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  if (dir === "left" || dir === "right") {
    // a keyframe animation (not a transition), so it plays even when the page is slow to paint
    root.classList.add("wz-in-" + dir);
    setTimeout(function () { root.classList.remove("wz-in-" + dir); }, 450);
  }

  // slide OUT on click
  document.addEventListener("click", function (event) {
    var link = event.target.closest && event.target.closest(".top-nav a, a.brand, .wz-tabbar a, .wz-more a, a.gw-card, a.back-growth");
    if (!link || link.classList.contains("acct-btn") || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) { return; }

    var order = link.closest(".wz-tabbar, .wz-more, .gw-card, .back-growth") || link.matches(".gw-card, .back-growth") ? TAB_ORDER : NAV_ORDER;
    var from = order.indexOf(nameOf(location.pathname));
    var to = order.indexOf(nameOf(link.getAttribute("href")));
    if (to === -1 || to === from) { return; }

    event.preventDefault();
    var goingRight = to > from;
    root.classList.add(goingRight ? "wz-out-left" : "wz-out-right");
    root.classList.remove("wz-sheet-open");
    try { sessionStorage.setItem(KEY, goingRight ? "right" : "left"); } catch (e) { /* ignore */ }

    setTimeout(function () { location.href = link.href; }, 200);
  });

  // back button: never leave the page stuck half-slid
  window.addEventListener("pageshow", function () {
    root.classList.remove("wz-out-left", "wz-out-right");
  });
})();
