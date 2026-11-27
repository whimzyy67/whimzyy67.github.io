/* Dayverse: every card keeps its size. When its content is longer than the card, a "View more" line appears;
   it opens ONLY that card in a big panel, and "Close" puts it back. */
(function () {
  "use strict";
  var cards = [];
  var open = null;                      // { card, holder, back }

  // every card gets "View more", except Feeling check-in and Stars earned
  function wanted(card) {
    return !card.classList.contains("dv-stars") && !card.querySelector("#moodBox");
  }

  function refresh(card) {
    var btn = card.querySelector(":scope > .dv-more");
    var need = wanted(card);
    if (need && !btn) {
      btn = document.createElement("button");
      btn.type = "button"; btn.className = "dv-more"; btn.textContent = "▾ View more";
      btn.addEventListener("click", function () { expand(card); });
      card.appendChild(btn); card.classList.add("dv-has-more");
    } else if (!need && btn && !card.classList.contains("dv-expanded")) { btn.remove(); card.classList.remove("dv-has-more"); }
  }

  function expand(card) {
    if (open) { collapse(); }
    var holder = document.createElement("div");           // keeps the card's spot so nothing else jumps
    holder.className = "dv-holder"; holder.style.flex = getComputedStyle(card).flex;
    holder.style.height = card.offsetHeight + "px"; holder.style.width = card.offsetWidth + "px";
    holder.style.gridColumn = getComputedStyle(card).gridColumn;
    card.parentNode.insertBefore(holder, card);
    var back = document.createElement("div"); back.className = "dv-backdrop";
    back.addEventListener("click", collapse);
    document.body.appendChild(back);
    card.classList.add("dv-expanded");
    var more = card.querySelector(":scope > .dv-more"); if (more) { more.hidden = true; }
    var close = document.createElement("button");
    close.type = "button"; close.className = "dv-close"; close.textContent = "✕ Close";
    close.addEventListener("click", collapse);
    card.insertBefore(close, card.firstChild);
    open = { card: card, holder: holder, back: back, close: close };
  }

  function collapse() {
    if (!open) { return; }
    open.card.classList.remove("dv-expanded");
    open.holder.remove(); open.back.remove(); open.close.remove();
    var more = open.card.querySelector(":scope > .dv-more"); if (more) { more.hidden = false; }
    var c = open.card; open = null;
    setTimeout(function () { refresh(c); }, 30);
  }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") { collapse(); } });

  var queued = false;
  function refreshAll() {
    if (queued) { return; } queued = true;
    requestAnimationFrame(function () { queued = false; cards.forEach(refresh); });
  }

  function init() {
    // phones already have their own collapsed cards with View buttons
    if (window.matchMedia("(max-width: 820px), (hover: none) and (pointer: coarse) and (max-width: 1100px)").matches) { return; }
    cards = Array.prototype.slice.call(document.querySelectorAll(".dv-card"));
    if (!cards.length) { return; }
    var mo = new MutationObserver(function (list) {
      var onlyUs = list.every(function (m) { return m.target.classList && (m.target.classList.contains("dv-more") || m.target.classList.contains("dv-close")) || Array.prototype.every.call(m.addedNodes, function (n) { return n.classList && (n.classList.contains("dv-more") || n.classList.contains("dv-close")); }) && Array.prototype.every.call(m.removedNodes, function (n) { return n.classList && (n.classList.contains("dv-more") || n.classList.contains("dv-close")); }); });
      if (!onlyUs) { refreshAll(); }
    });
    cards.forEach(function (c) { mo.observe(c, { childList: true, subtree: true, characterData: true }); });
    window.addEventListener("resize", refreshAll);
    window.addEventListener("wz-dv-day", function () { setTimeout(refreshAll, 120); });
    [200, 800, 2000].forEach(function (t) { setTimeout(refreshAll, t); });
    refreshAll();
  }
  // the Day dump card is added by another script, so look again a little later too
  window.addEventListener("load", function () {
    setTimeout(function () { var extra = document.querySelectorAll(".dv-card"); if (extra.length !== cards.length) { init(); } }, 600);
  });
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", init); } else { init(); }
})();
