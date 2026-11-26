/* mobile-nav.js  -  the footer bar for phones and tablets.
   Home | Detox | Focus | Work Space (special) | More
   "More" opens a sheet: My Day, Wellness, Productivity, Dayverse, Vibe, About Us.
   No hover anywhere: every item shows its name, and everything works by tap.

   rewards.js loads this file on every page, so you do not add it to the pages yourself.
   On laptops and desktops the bar stays hidden (css/responsive.css decides), so nothing changes there. */
(function () {
  "use strict";
  if (window.__wzMobileNav) { return; }
  window.__wzMobileNav = true;

  var src = (document.currentScript && document.currentScript.getAttribute("src")) || "js/mobile-nav.js";
  var ROOT = src.replace(/js\/mobile-nav\.js.*$/, "");        // "" on home.html, "../" inside /html/

  var here = (location.pathname.split("/").pop() || "").replace(/\.html$/, "");
  if (here === "" || here === "index" || here === "offline" || here === "privacy") { return; }

  // Set the class right away (before the page paints) so phones never flash the laptop layout,
  // then pull in the phone stylesheet and the little "View" dropdown script.
  document.documentElement.classList.add("has-tabbar");
  try {
    document.write('<link rel="stylesheet" href="' + ROOT + 'css/phone.css">');
    document.write('<script src="' + ROOT + 'js/phone-ui.js"><\/script>');
  } catch (e) { /* the footer bar still works without them */ }

  var TABS = [
    { id: "home",       label: "Home",       href: ROOT + "home.html",          icon: "stickers/nav-home.png" },
    { id: "detox",      label: "Detox",      href: ROOT + "html/detox.html",    icon: "stickers/side-detox.png" },
    { id: "focus",      label: "Focus",      href: ROOT + "html/focus.html",    icon: "stickers/side-focus.png" },
    { id: "work-space", label: "Work Space", href: ROOT + "html/work-space.html", icon: "stickers/nav-work.png", special: true }
  ];
  var MORE = [
    { id: "my-day",       label: "My Day",       sub: "Plan your day and write your journal", href: ROOT + "html/my-day.html",       icon: "stickers/side-myday.png" },
    { id: "wellness",     label: "Wellness",     sub: "Check in, stretch and drink water",    href: ROOT + "html/wellness.html",     icon: "stickers/side-wellness.png" },
    { id: "productivity", label: "Productivity", sub: "See your progress and patterns",       href: ROOT + "html/productivity.html", icon: "stickers/side-productivity.png" },
    { id: "dayverse",     label: "Dayverse",     sub: "Your slice of life",                   href: ROOT + "html/dayverse.html",     icon: "stickers/side-dayverse.png" },
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
    var inMore = MORE.some(function (m) { return m.id === here; });

    /* ---- the bar ---- */
    var bar = el("nav", "wz-tabbar");
    bar.setAttribute("aria-label", "Main");

    TABS.forEach(function (t) {
      var a = el("a", "wz-tab" + (t.special ? " wz-special" : ""));
      a.href = t.href;
      a.appendChild(img(t.icon));
      a.appendChild(el("span", "wz-lbl", t.label));
      if (t.id === here) { a.classList.add("active"); a.setAttribute("aria-current", "page"); }
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
      if (m.id === here) { a.classList.add("active"); a.setAttribute("aria-current", "page"); }
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
