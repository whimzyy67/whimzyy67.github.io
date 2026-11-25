/* phone-ui.js
   Little "View / Hide" dropdowns for the phone layout (History on Focus, Previous entries on My Day,
   Stretch and Reminders on Wellness, Parking lot / Journal / Tasks on Dayverse, the two cards on About Us).
   It only adds a button to each card's heading. css/phone.css decides what is hidden, and only on phones,
   so laptops look exactly as before.
   mobile-nav.js loads this file, you do not add it to any page. */
(function () {
  "use strict";
  if (window.__wzPhoneUi) { return; }
  window.__wzPhoneUi = true;

  var page = (location.pathname.split("/").pop() || "").replace(/\.html$/, "");

  var CFG = {
    "focus":    [{ sel: ".history-card", show: "View history", hide: "Hide history" }],
    "my-day":   [{ sel: ".history-card", show: "View entries", hide: "Hide entries" }],
    "wellness": [{ sel: ".stretch-card",  show: "Open", hide: "Close" },
                 { sel: ".reminder-card", show: "Open", hide: "Close" }],
    "dayverse": [{ sel: ".dv-parking", show: "View", hide: "Hide" },
                 { sel: ".dv-soft",    show: "View", hide: "Hide" },
                 { sel: ".dv-tasks",   show: "View", hide: "Hide" }],
    "about-us": [{ sel: ".story-card", show: "View", hide: "Close ✕" },
                 { sel: ".howto-card", show: "View", hide: "Close ✕" }]
  };
  var list = CFG[page];
  if (!list) { return; }

  var PHONE = "(max-width: 820px), (hover: none) and (pointer: coarse) and (max-width: 1100px)";

  // Focus: on a phone the "Today" card lives inside the timer card (it keeps its ids, so focus.js still fills it in)
  function placeToday() {
    var today = document.querySelector(".today-card"), timer = document.querySelector(".timer-card");
    if (!today || !timer) { return; }
    if (window.matchMedia(PHONE).matches) {
      if (today.parentNode !== timer) {
        today._home = { parent: today.parentNode, next: today.nextSibling };
        timer.appendChild(today);
      }
    } else if (today._home) {
      today._home.parent.insertBefore(today, today._home.next);
      today._home = null;
    }
  }
  if (page === "focus") {
    var mq = window.matchMedia(PHONE);
    var run = function () { placeToday(); };
    if (document.body) { run(); } else { document.addEventListener("DOMContentLoaded", run); }
    if (mq.addEventListener) { mq.addEventListener("change", run); }
  }

  function closeAll(except) {
    document.querySelectorAll(".wz-coll.wz-open").forEach(function (c) {
      if (c !== except) { setOpen(c, false); }
    });
  }

  function setOpen(card, open) {
    card.classList.toggle("wz-open", open);
    var btn = card.querySelector(":scope > .wz-view, :scope > .wz-head > .wz-view");
    if (btn) {
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.textContent = open ? btn.dataset.hide : btn.dataset.show;
    }
  }

  function build() {
    list.forEach(function (c) {
      var card = document.querySelector(c.sel);
      if (!card || card.classList.contains("wz-coll")) { return; }
      var heading = card.querySelector(":scope > h1, :scope > h2");
      if (!heading) { return; }

      card.classList.add("wz-coll");
      heading.classList.add("wz-heading");

      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "wz-view";
      btn.dataset.show = c.show;
      btn.dataset.hide = c.hide;
      btn.textContent = c.show;
      btn.setAttribute("aria-expanded", "false");
      card.insertBefore(btn, heading.nextSibling);

      // a Close bar at the bottom of the opened card, so there is always an obvious way to shut it
      var close = document.createElement("button");
      close.type = "button";
      close.className = "wz-close";
      close.textContent = "✕ Close";
      card.appendChild(close);

      function toggle(e) {
        e.stopPropagation();
        var open = !card.classList.contains("wz-open");
        closeAll(card);
        setOpen(card, open);
      }
      btn.addEventListener("click", toggle);
      close.addEventListener("click", toggle);
      heading.addEventListener("click", function (e) {
        if (window.matchMedia("(max-width: 820px), (hover: none) and (pointer: coarse) and (max-width: 1100px)").matches) { toggle(e); }
      });
    });

    // a tap anywhere else closes an open card
    document.addEventListener("click", function (e) {
      if (!e.target.closest(".wz-coll.wz-open")) { closeAll(null); }
    });
  }

  if (document.body) { build(); } else { document.addEventListener("DOMContentLoaded", build); }
})();
