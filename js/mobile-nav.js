/* mobile-nav.js  -  the footer bar for phones and tablets.
   Home | Detox | Focus | Work Space (special) | More
   "More" opens a sheet: My Day, Wellness, Productivity, Dayverse, Vibe, About Us.
   No hover anywhere: every item shows its name, and everything works by tap.
   The little "View / Hide" dropdowns for phone cards (formerly phone-ui.js) are at the bottom of this file.

   rewards.js loads this file on every page, so you do not add it to the pages yourself.
   On laptops and desktops the bar stays hidden (css/responsive.css decides), so nothing changes there. */
(function () {
  "use strict";
  if (window.__wzMobileNav) { return; }
  window.__wzMobileNav = true;

  var src = (document.currentScript && document.currentScript.getAttribute("src")) || "js/mobile-nav.js";
  var ROOT = src.replace(/js\/mobile-nav\.js.*$/, "");        // "" on home.html, "../" inside /html/

  var here = (location.pathname.split("/").pop() || "").replace(/\.html$/, "");
  var lit = (here === "productivity" || here === "dayverse" || here === "habits") ? "growth" : here;   // productivity, dayverse and habits live inside Growth
  if (here === "" || here === "index" || here === "offline" || here === "privacy") { return; }

  // Set the class right away (before the page paints) so phones never flash the laptop layout.
  // (The phone layout rules now live at the bottom of css/responsive.css.)
  document.documentElement.classList.add("has-tabbar");

  var TABS = [
    { id: "home",       label: "Home",       href: ROOT + "home.html",          icon: "stickers/nav-home.png" },
    { id: "detox",      label: "Detox",      href: ROOT + "html/detox.html",    icon: "stickers/side-detox.png" },
    { id: "focus",      label: "Focus",      href: ROOT + "html/focus.html",    icon: "stickers/side-focus.png" },
    { id: "work-space", label: "Work Space", href: ROOT + "html/work-space.html", icon: "stickers/nav-work.png", special: true }
  ];
  var MORE = [
    { id: "my-day",       label: "My Day",       sub: "Plan your day and write your journal", href: ROOT + "html/my-day.html",       icon: "stickers/side-myday.png" },
    { id: "wellness",     label: "Wellness",     sub: "Check in, stretch and drink water",    href: ROOT + "html/wellness.html",     icon: "stickers/side-wellness.png" },
    { id: "growth",       label: "Growth",       sub: "Productivity, Dayverse and vision boards", href: ROOT + "html/growth.html",       icon: "stickers/side-growth.png" },
    { id: "search-homies", label: "Search Homies", sub: "Find friends and follow their progress", href: ROOT + "html/search-homies.html", icon: "stickers/side-search.png" },
    { id: "vibe",         label: "Vibe",         sub: "Themes, sounds and backgrounds",       href: ROOT + "html/vibe.html",         icon: "stickers/side-vibe.png" },
    { id: "about-us",     label: "About Us",     sub: "The story behind Whimzyy",             href: ROOT + "html/about-us.html",     icon: "stickers/nav-about.png" }
  ];

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (text) { n.textContent = text; }
    return n;
  }
  function img(path) {
    var i = el("img", "wz-ico");
    i.src = ROOT + path; i.alt = ""; i.draggable = false;
    return i;
  }

  function build() {
    if (document.querySelector(".wz-tabbar")) { return; }
    var inMore = MORE.some(function (m) { return m.id === lit; });

    /* ---- the bar ---- */
    var bar = el("nav", "wz-tabbar");
    bar.setAttribute("aria-label", "Main");

    TABS.forEach(function (t) {
      var a = el("a", "wz-tab" + (t.special ? " wz-special" : ""));
      a.href = t.href;
      a.appendChild(img(t.icon));
      a.appendChild(el("span", "wz-lbl", t.label));
      if (t.id === lit) { a.classList.add("active"); a.setAttribute("aria-current", "page"); }
      bar.appendChild(a);
    });

    var moreBtn = el("button", "wz-tab wz-more-btn" + (inMore ? " active" : ""));
    moreBtn.type = "button";
    moreBtn.setAttribute("aria-haspopup", "dialog");
    moreBtn.setAttribute("aria-expanded", "false");
    moreBtn.innerHTML = '<svg class="wz-ico wz-dots" viewBox="0 0 32 32" aria-hidden="true"><circle cx="7" cy="16" r="3"/><circle cx="16" cy="16" r="3"/><circle cx="25" cy="16" r="3"/></svg>';
    moreBtn.appendChild(el("span", "wz-lbl", "More"));
    bar.appendChild(moreBtn);

    /* ---- the sheet ---- */
    var wrap = el("div", "wz-more");
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-label", "More pages");
    var scrim = el("div", "wz-scrim");
    var sheet = el("div", "wz-sheet");
    sheet.appendChild(el("div", "wz-grip"));
    sheet.appendChild(el("h2", "wz-sheet-title", "More"));

    MORE.forEach(function (m) {
      var a = el("a", "wz-row");
      a.href = m.href;
      a.appendChild(img(m.icon));
      var txt = el("span", "wz-row-text");
      txt.appendChild(el("span", "wz-row-name", m.label));
      txt.appendChild(el("span", "wz-row-sub", m.sub));
      a.appendChild(txt);
      if (m.id === lit) { a.classList.add("active"); a.setAttribute("aria-current", "page"); }
      sheet.appendChild(a);
    });

    wrap.appendChild(scrim);
    wrap.appendChild(sheet);

    function setOpen(open) {
      wrap.classList.toggle("open", open);
      moreBtn.setAttribute("aria-expanded", open ? "true" : "false");
      document.documentElement.classList.toggle("wz-sheet-open", open);
    }
    moreBtn.addEventListener("click", function () { setOpen(!wrap.classList.contains("open")); });
    scrim.addEventListener("click", function () { setOpen(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") { setOpen(false); } });
    window.addEventListener("pageshow", function () { setOpen(false); });

    document.body.appendChild(wrap);
    document.body.appendChild(bar);

    /* ---- "turn your phone sideways" pop-up, shown when Work Space is tapped while holding the phone upright ---- */
    var rot = null, rotLink = null;
    function upright() {
      return window.matchMedia("(orientation: portrait)").matches && window.innerWidth < 700;
    }
    function closeRot() {
      if (rot) { rot.classList.remove("open"); }
      rotLink = null;
    }
    function goWorkSpace() {
      var link = rotLink;
      closeRot();
      if (link) { link.dataset.rotOk = "1"; link.click(); }
    }
    function openRot(link) {
      if (!rot) {
        rot = el("div", "wz-rot");
        rot.setAttribute("role", "dialog");
        rot.setAttribute("aria-label", "Rotate your screen");
        var card = el("div", "wz-rot-card");
        var ico = el("div", "wz-rot-ico", "📱");
        card.appendChild(ico);
        card.appendChild(el("h2", "", "Rotate your screen"));
        card.appendChild(el("p", "", "Turn your phone sideways for a better view while using Work Space."));
        var go = el("button", "wz-rot-go", "Open Work Space"); go.type = "button";
        go.addEventListener("click", goWorkSpace);
        var no = el("button", "wz-rot-no", "Not now"); no.type = "button";
        no.addEventListener("click", closeRot);
        card.appendChild(go); card.appendChild(no);
        rot.appendChild(card);
        rot.addEventListener("click", function (e) { if (e.target === rot) { closeRot(); } });
        document.body.appendChild(rot);
      }
      rotLink = link;
      rot.classList.add("open");
    }
    // capture phase, so this runs before the page-slide code
    document.addEventListener("click", function (e) {
      var link = e.target.closest && e.target.closest("a.wz-special");
      if (!link || link.dataset.rotOk || here === "work-space" || !upright()) { return; }
      e.preventDefault();
      e.stopPropagation();
      openRot(link);
    }, true);
    // if they turn the phone while the pop-up is open, carry on straight away
    function turned() { if (rot && rot.classList.contains("open") && !upright()) { goWorkSpace(); } }
    window.addEventListener("orientationchange", function () { setTimeout(turned, 150); });
    window.addEventListener("resize", turned);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") { closeRot(); } });
    window.addEventListener("pageshow", function () { closeRot(); if (bar.querySelector(".wz-special")) { delete bar.querySelector(".wz-special").dataset.rotOk; } });
  }

  if (document.body) { build(); }
  else { document.addEventListener("DOMContentLoaded", build); }
})();

/* ===== 'View / Hide' dropdowns on phone cards (formerly js/phone-ui.js) ===== */
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
