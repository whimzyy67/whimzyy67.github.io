/* detox.js (html/detox.html)
   The control panel for the Whimzyy Detox Chrome extension.
   - settings live in localStorage ("whimzyy-detox") and are pushed to the extension
   - screen time numbers come FROM the extension (it is the only thing that can see other sites)
   - each finished day under the limit gives stars (Rewards.onDetoxDay) */
(function () {
  "use strict";

  var KEY = "whimzyy-detox";
  var HKEY = "whimzyy-detox-history";
  var DAILY_CHOICES = [30, 60, 90, 120, 180, 240, 300, 0];            // 0 = no limit
  var APP_CHOICES = [5, 10, 15, 20, 30, 45, 60, 90, 120, 0];

  var DEFAULTS = {
    enabled: true,
    dailyLimitMin: 120,
    reels: true,
    shorts: true,
    mode: "hide",
    quiet: { on: false, from: "22:00", to: "07:00" },
    apps: [
      { id: "instagram", name: "Instagram", hosts: ["instagram.com"], limitMin: 30 },
      { id: "youtube", name: "YouTube", hosts: ["youtube.com", "youtu.be"], limitMin: 45 },
      { id: "facebook", name: "Facebook", hosts: ["facebook.com", "fb.com"], limitMin: 20 },
      { id: "x", name: "X / Twitter", hosts: ["x.com", "twitter.com"], limitMin: 15 },
      { id: "reddit", name: "Reddit", hosts: ["reddit.com"], limitMin: 20 }
    ]
  };

  var $ = function (id) { return document.getElementById(id); };
  var settings = loadSettings();
  var ext = { connected: false, usage: null, history: {} };


  /* ---------- storage ---------- */

  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  function normalize(saved) {
    var s = Object.assign(clone(DEFAULTS), saved || {});
    s.quiet = Object.assign({}, DEFAULTS.quiet, (saved && saved.quiet) || {});
    if (!Array.isArray(s.apps)) { s.apps = clone(DEFAULTS.apps); }
    return s;
  }

  function loadSettings() {
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem(KEY)); } catch (e) { saved = null; }
    return normalize(saved);
  }

  function saveSettings() {
    try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) { /* storage full or blocked */ }
    send("set-settings", { settings: settings });
    render(true);
  }

  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HKEY)) || {}; } catch (e) { return {}; }
  }
  function saveHistory(h) {
    try { localStorage.setItem(HKEY, JSON.stringify(h)); } catch (e) { /* ignore */ }
  }

  function dayKey(d) {
    d = d || new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }


  /* ---------- talking to the extension ---------- */

  // Inside the extension's own page we can talk to the extension directly. On the website we use the bridge.
  var DIRECT = Boolean(window.chrome && chrome.storage && chrome.runtime && chrome.runtime.id);

  /* On the website the page can reach the extension two ways:
     1) straight through Chrome (needs the extension id below, which never changes, because the
        extension has a fixed "key" in its manifest). This works in Chrome, Edge, Brave and other
        Chromium browsers once the extension is installed in that browser.
     2) through a helper script the extension adds to the page (the older way, kept as a backup). */
  var EXT_ID = "pppkaphnimhbodklbghhpndchgofnkgi";
  var CAN_REACH = !DIRECT && Boolean(window.chrome && chrome.runtime && typeof chrome.runtime.sendMessage === "function");
  var lastWhy = "";

  function viaPage(type, extra) {
    window.postMessage(Object.assign({ source: "whimzyy-page", type: type }, extra || {}), window.location.origin);
  }

  function send(type, extra) {
    if (DIRECT) { direct(type, extra || {}); return; }

    if (!CAN_REACH) {
      lastWhy = "this browser does not let the page reach extensions (use Chrome, Edge or Brave on a computer)";
      viaPage(type, extra);
      return;
    }

    try {
      chrome.runtime.sendMessage(EXT_ID, Object.assign({ type: type }, extra || {}), function (reply) {
        var problem = chrome.runtime.lastError;      // reading it also silences the console warning
        if (problem || !reply || reply.type === "error") {
          lastWhy = problem ? problem.message : "the extension did not answer";
          viaPage(type, extra);                      // try the older way too
          return;
        }
        lastWhy = "";
        onMessage(reply);
      });
    } catch (e) {
      lastWhy = String(e && e.message || e);
      viaPage(type, extra);
    }
  }

  function direct(type, extra) {
    if (type === "ping") {
      setTimeout(function () { onMessage({ type: "pong" }); }, 0);
    } else if (type === "set-settings") {
      chrome.storage.local.set({ settings: extra.settings });
    } else if (type === "get") {
      chrome.storage.local.get(["settings", "usage", "history"], function (d) { onMessage({ type: "data", data: d }); });
    }
  }

  window.addEventListener("message", function (event) {
    var msg = event.data;
    if (DIRECT || event.source !== window || !msg || msg.source !== "whimzyy-ext") { return; }
    onMessage(msg);
  });

  function onMessage(msg) {
    if (msg.type === "pong") {
      if (!ext.connected) {
        ext.connected = true;
        send("set-settings", { settings: settings });     // this page is the boss of the settings
        send("get");
        render();
      }
    } else if (msg.type === "data") {
      var d = msg.data || {};
      ext.usage = d.usage || null;
      ext.history = d.history || {};
      mergeHistory();
      awardStars();
      render();
    }
  }

  var told = false;
  function ping() {
    send("ping");
    if (!told) {
      told = true;
      setTimeout(function () {
        if (!ext.connected && window.console) {
          console.info("[Whimzyy Detox] extension not connected. Reason: " + (lastWhy || "no answer yet") +
            ". Install it in THIS browser, then refresh the page.");
        }
      }, 2500);
    }
  }

  function poll() {
    if (!ext.connected) { ping(); foldManual(); awardStars(); }
    else if (!document.hidden) { send("get"); }
  }


  /* ---------- numbers ---------- */

  function mergeHistory() {
    var h = loadHistory();
    Object.keys(ext.history).forEach(function (day) { h[day] = ext.history[day]; });
    // the extension files a day away only when the next day starts, so a stale "usage" is that day's result
    if (ext.usage && ext.usage.day && ext.usage.day !== dayKey()) {
      h[ext.usage.day] = {
        total: Math.round(ext.usage.total / 60),
        limit: settings.dailyLimitMin,
        on: settings.enabled,
        apps: {}
      };
    }
    saveHistory(h);
  }

  /* ---------- typed-in screen time (phones, or any browser without the extension) ---------- */

  var MKEY = "whimzyy-detox-manual";          // { "2026-11-22": { limit, on, apps: { id: minutes } } }

  function loadManual() {
    try { return JSON.parse(localStorage.getItem(MKEY)) || {}; } catch (e) { return {}; }
  }
  function saveManual(m) {
    try { localStorage.setItem(MKEY, JSON.stringify(m)); } catch (e) { /* ignore */ }
  }
  function sumApps(apps) {
    return Object.keys(apps || {}).reduce(function (t, id) { return t + (apps[id] || 0); }, 0);
  }
  function manualToday() {
    var e = loadManual()[dayKey()];
    return e ? { total: sumApps(e.apps), apps: Object.assign({}, e.apps) } : { total: 0, apps: {} };
  }
  function logManual(appId, minutes) {
    var m = loadManual(), key = dayKey();
    var e = m[key] || { apps: {} };
    e.apps[appId] = Math.max(0, (e.apps[appId] || 0) + minutes);
    if (!e.apps[appId]) { delete e.apps[appId]; }
    e.limit = settings.dailyLimitMin;
    e.on = settings.enabled;
    e.last = minutes > 0 ? { id: appId, min: minutes } : undefined;
    m[key] = e;
    saveManual(m);
    render(true);
  }
  function undoManual() {
    var m = loadManual(), key = dayKey();
    if (!m[key] || !m[key].last) { return; }
    var l = m[key].last;
    m[key].apps[l.id] = Math.max(0, (m[key].apps[l.id] || 0) - l.min);
    if (!m[key].apps[l.id]) { delete m[key].apps[l.id]; }
    delete m[key].last;
    saveManual(m);
    render(true);
  }
  // finished days that were typed in count as history (the extension's own numbers win when it has them)
  function foldManual() {
    var m = loadManual(), h = loadHistory(), today = dayKey(), changed = false;
    Object.keys(m).forEach(function (day) {
      if (day >= today) { return; }
      if (h[day] && !h[day].manual) { return; }
      var total = Math.round(sumApps(m[day].apps));
      if (!h[day] || h[day].total !== total) {
        h[day] = { total: total, limit: m[day].limit, on: m[day].on, apps: m[day].apps, manual: true };
        changed = true;
      }
    });
    if (changed) { saveHistory(h); }
  }

  function usedToday() {
    if (!ext.connected) { return manualToday(); }
    if (!ext.usage || ext.usage.day !== dayKey()) { return { total: 0, apps: {} }; }
    var apps = {};
    Object.keys(ext.usage.apps || {}).forEach(function (id) { apps[id] = ext.usage.apps[id] / 60; });
    return { total: ext.usage.total / 60, apps: apps };
  }

  function awardStars() {
    if (!window.Rewards || !window.Rewards.onDetoxDay) { return; }
    var h = loadHistory(), today = dayKey();
    Object.keys(h).sort().forEach(function (day) {
      var e = h[day];
      if (day < today && e.on !== false && e.limit > 0 && e.total > 0 && e.total <= e.limit) {
        Rewards.onDetoxDay(day);
      }
    });
  }

  function streak() {
    var h = loadHistory();
    var d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - 1);                                     // finished days only
    var n = 0;
    for (;;) {
      var e = h[dayKey(d)];
      if (!e || e.on === false || !(e.limit > 0) || !(e.total <= e.limit)) { break; }
      n += 1;
      d.setDate(d.getDate() - 1);
    }
    return n;
  }

  function fmt(min) {
    min = Math.round(min);
    if (min >= 60) { return Math.floor(min / 60) + " h" + (min % 60 ? " " + (min % 60) + " m" : ""); }
    return min + " min";
  }

  function limitText(min) { return min > 0 ? fmt(min) : "No limit"; }

  function level(used, limit) {
    if (!(limit > 0)) { return ""; }
    if (used >= limit) { return "over"; }
    return used >= limit * 0.8 ? "warn" : "";
  }


  /* ---------- drawing ---------- */

  function switchState(el, on) { el.setAttribute("aria-checked", on ? "true" : "false"); }

  function fillSelect(sel, choices, current) {
    sel.textContent = "";
    var list = choices.slice();
    if (list.indexOf(current) === -1) { list.push(current); list.sort(function (a, b) { return (a || 1e9) - (b || 1e9); }); }
    list.forEach(function (m) {
      var o = document.createElement("option");
      o.value = String(m);
      o.textContent = limitText(m);
      if (m === current) { o.selected = true; }
      sel.appendChild(o);
    });
    var custom = document.createElement("option");
    custom.value = "custom";
    custom.textContent = "Custom…";
    sel.appendChild(custom);
  }

  function askCustom(sel, current) {
    var answer = prompt("Limit in minutes (0 = no limit):", current || 30);
    var n = parseInt(answer, 10);
    if (isNaN(n) || n < 0 || n > 1440) { return null; }
    return n;
  }

  /* ---------- the "log your time" card (only when the extension is not connected) ---------- */

  var manualBox = null;

  function buildManual() {
    var style = document.createElement("style");
    style.textContent =
      ".dx-manual{margin-top:6px;border-top:1px dashed rgba(255,255,255,.25);padding-top:12px;display:flex;flex-direction:column;gap:12px}" +
      ".dx-manual[hidden]{display:none}" +
      ".dx-manual p{margin:0;opacity:.85}" +
      ".dx-m-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}" +
      ".dx-m-row select{flex:1 1 150px;min-width:0}" +
      ".dx-m-quick{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}" +
      ".dx-m-quick button,.dx-m-row button{min-height:44px;cursor:pointer;font:inherit;font-weight:700;border-radius:12px;" +
        "border:1px solid var(--gold,#c9a45c);background:transparent;color:inherit}" +
      ".dx-m-quick button:active,.dx-m-row button:active{background:var(--wine-soft,rgba(255,255,255,.12))}" +
      ".dx-m-undo{font-size:.9em;opacity:.8}";
    document.head.appendChild(style);

    manualBox = document.createElement("section");
    manualBox.className = "dx-manual";
    manualBox.id = "manualCard";
    manualBox.hidden = true;

    var h = document.createElement("h2");
    h.textContent = "Log your phone time ✍️";
    h.style.fontSize = "16px";
    var p = document.createElement("p");
    p.textContent = "No extension here, so you tell me. Open your phone's Screen Time / Digital Wellbeing, then add the minutes here. " +
      "It counts toward your ring, your week and your stars just like the extension would.";

    var row = document.createElement("div");
    row.className = "dx-m-row";
    var sel = document.createElement("select");
    sel.id = "manualApp";
    sel.setAttribute("aria-label", "Which app");
    row.appendChild(sel);

    var quick = document.createElement("div");
    quick.className = "dx-m-quick";
    [5, 15, 30, 60].forEach(function (n) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = "+" + n;
      b.addEventListener("click", function () { logManual(sel.value, n); });
      quick.appendChild(b);
    });

    var custom = document.createElement("button");
    custom.type = "button";
    custom.textContent = "Other amount…";
    custom.addEventListener("click", function () {
      var n = parseInt(prompt("Minutes to add (or a negative number to take some off):", "10"), 10);
      if (isNaN(n) || n === 0 || Math.abs(n) > 1440) { return; }
      logManual(sel.value, n);
    });
    var undo = document.createElement("button");
    undo.type = "button";
    undo.className = "dx-m-undo";
    undo.id = "manualUndo";
    undo.textContent = "↩ Undo last";
    undo.addEventListener("click", undoManual);
    var row2 = document.createElement("div");
    row2.className = "dx-m-row";
    row2.append(custom, undo);

    manualBox.append(h, p, row, quick, row2);
    document.querySelector(".dx-today-info").appendChild(manualBox);
  }

  function renderManual() {
    if (!manualBox) { buildManual(); }
    manualBox.hidden = ext.connected;
    if (ext.connected) { return; }

    var sel = $("manualApp"), keep = sel.value;
    if (document.activeElement !== sel) {
      sel.textContent = "";
      settings.apps.concat([{ id: "other", name: "Other apps / games" }]).forEach(function (a) {
        var o = document.createElement("option");
        o.value = a.id;
        o.textContent = a.name;
        sel.appendChild(o);
      });
      if (keep) { sel.value = keep; }
    }
    var e = loadManual()[dayKey()];
    $("manualUndo").hidden = !(e && e.last);
  }

  function render(force) {
    // do not redraw while a dropdown is open (the 5-second refresh would close it)
    var open = document.activeElement && document.activeElement.tagName === "SELECT";
    if (open && !force) { return; }

    var onPhone = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
      Boolean(window.matchMedia && matchMedia("(pointer:coarse)").matches);
    if ($("extBanner")) { $("extBanner").hidden = ext.connected || onPhone; }   // phones cannot install it

    // master + blockers
    switchState($("masterOn"), settings.enabled);
    switchState($("reelsOn"), settings.reels);
    switchState($("shortsOn"), settings.shorts);
    document.querySelectorAll("input[name='mode']").forEach(function (r) { r.checked = (r.value === settings.mode); });

    // ring
    var used = usedToday();
    var limit = settings.dailyLimitMin;
    var pct = limit > 0 ? Math.min(used.total / limit, 1) : 0;
    var fill = $("ringFill");
    fill.style.strokeDashoffset = String(326.7 * (1 - pct));
    fill.setAttribute("class", "dx-ring-fill " + level(used.total, limit));
    $("ringUsed").textContent = fmt(used.total);
    $("ringOf").textContent = limit > 0 ? "of " + fmt(limit) : "no limit set";

    var line;
    if (!ext.connected && !used.total) { line = "Nothing logged yet. Add your phone time below ✍️"; }
    else if (!ext.connected && !(limit > 0)) { line = "No daily limit. Pick one if you're brave."; }
    else if (!ext.connected && used.total >= limit) { line = "Over your limit today. Tomorrow is a fresh start 🌱"; }
    else if (!ext.connected) { line = fmt(limit - used.total) + " left today. Spend it wisely."; }
    else if (!settings.enabled) { line = "Detox mode is off. Still counting though 👀"; }
    else if (!(limit > 0)) { line = "No daily limit. Pick one if you're brave."; }
    else if (used.total >= limit) { line = "Limit hit. Your apps are locked, go touch grass 🌱"; }
    else { line = fmt(limit - used.total) + " left today. Spend it wisely."; }
    $("leftLine").textContent = line;

    renderManual();

    var dailySel = $("dailySel");
    fillSelect(dailySel, DAILY_CHOICES, limit);

    // quiet hours
    switchState($("quietOn"), settings.quiet.on);
    $("quietFrom").value = settings.quiet.from;
    $("quietTo").value = settings.quiet.to;

    renderApps(used);
    renderWeek(used);
    $("streak").textContent = String(streak());
  }

  function renderApps(used) {
    var box = $("appList");
    box.textContent = "";

    settings.apps.forEach(function (app, i) {
      var spent = used.apps[app.id] || 0;
      var row = document.createElement("div");
      row.className = "dx-app";

      var name = document.createElement("div");
      name.className = "dx-app-name";
      name.textContent = app.name;

      var usedText = document.createElement("span");
      usedText.className = "dx-app-used";
      usedText.textContent = fmt(spent) + " / " + limitText(app.limitMin);

      var sel = document.createElement("select");
      sel.setAttribute("aria-label", "Limit for " + app.name);
      fillSelect(sel, APP_CHOICES, app.limitMin);
      sel.addEventListener("change", function () {
        var v = sel.value === "custom" ? askCustom(sel, app.limitMin) : parseInt(sel.value, 10);
        if (v === null) { render(true); return; }
        settings.apps[i].limitMin = v;
        saveSettings();
      });

      var x = document.createElement("button");
      x.type = "button";
      x.className = "dx-x";
      x.textContent = "✕";
      x.title = "Remove " + app.name;
      x.addEventListener("click", function () {
        if (confirm("Take " + app.name + " off the list?")) {
          settings.apps.splice(i, 1);
          saveSettings();
        }
      });

      var left = document.createElement("div");
      left.append(name, usedText);
      left.style.display = "flex";
      left.style.flexDirection = "column";

      var bar = document.createElement("div");
      bar.className = "dx-app-bar";
      var inner = document.createElement("i");
      inner.style.width = (app.limitMin > 0 ? Math.min(spent / app.limitMin, 1) * 100 : 0) + "%";
      inner.className = level(spent, app.limitMin);
      bar.appendChild(inner);

      row.append(left, sel, x, bar);
      box.appendChild(row);
    });

    if (!settings.apps.length) {
      var empty = document.createElement("p");
      empty.textContent = "Nothing here. Add a site below, or bring the starter list back.";
      box.appendChild(empty);
      var back = document.createElement("button");
      back.type = "button";
      back.className = "dx-btn";
      back.textContent = "Bring back the starter list";
      back.addEventListener("click", function () {
        settings.apps = clone(DEFAULTS.apps);
        saveSettings();
      });
      box.appendChild(back);
    }
  }

  function renderWeek(used) {
    var h = loadHistory();
    var chart = $("weekChart");
    chart.textContent = "";

    var days = [];
    var d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - 6);
    for (var i = 0; i < 7; i++) {
      var key = dayKey(d);
      var isToday = key === dayKey();
      var total = isToday ? used.total : (h[key] ? h[key].total : 0);
      var lim = isToday ? settings.dailyLimitMin : (h[key] ? h[key].limit : settings.dailyLimitMin);
      days.push({ label: "SMTWTFS".charAt(d.getDay()), total: total, limit: lim, key: key });
      d.setDate(d.getDate() + 1);
    }

    var top = Math.max(60, settings.dailyLimitMin || 0);
    days.forEach(function (day) { top = Math.max(top, day.total); });

    days.forEach(function (day) {
      var bar = document.createElement("div");
      bar.className = "dx-bar";
      bar.title = day.key + ": " + fmt(day.total);
      var fill = document.createElement("i");
      fill.style.height = (day.total / top * 100) + "%";
      if (day.limit > 0 && day.total > day.limit) { fill.className = "over"; }
      var label = document.createElement("span");
      label.textContent = day.label;
      bar.append(fill, label);
      chart.appendChild(bar);
    });

    if (settings.dailyLimitMin > 0) {
      var line = document.createElement("div");
      line.className = "dx-limit-line";
      line.style.bottom = "calc(22px + (100% - 22px) * " + (settings.dailyLimitMin / top) + ")";
      chart.appendChild(line);
    }

    var under = days.filter(function (day) { return day.total > 0 && day.limit > 0 && day.total <= day.limit; }).length;
    $("weekLine").textContent = under
      ? under + " of the last 7 days under your limit. Ate 🎉"
      : (ext.connected ? "Your week fills in as you browse." : "Plug in the extension to see your week.");
  }


  /* ---------- events ---------- */

  function toggle(id, apply) {
    $(id).addEventListener("click", function () {
      apply();
      saveSettings();
    });
  }

  toggle("masterOn", function () { settings.enabled = !settings.enabled; });
  toggle("reelsOn", function () { settings.reels = !settings.reels; });
  toggle("shortsOn", function () { settings.shorts = !settings.shorts; });
  toggle("quietOn", function () { settings.quiet.on = !settings.quiet.on; });

  $("dailySel").addEventListener("change", function () {
    var v = this.value === "custom" ? askCustom(this, settings.dailyLimitMin) : parseInt(this.value, 10);
    if (v === null) { render(true); return; }
    settings.dailyLimitMin = v;
    saveSettings();
  });

  document.querySelectorAll("input[name='mode']").forEach(function (r) {
    r.addEventListener("change", function () { settings.mode = r.value; saveSettings(); });
  });

  $("quietFrom").addEventListener("change", function () { settings.quiet.from = this.value || "22:00"; saveSettings(); });
  $("quietTo").addEventListener("change", function () { settings.quiet.to = this.value || "07:00"; saveSettings(); });

  $("addForm").addEventListener("submit", function (event) {
    event.preventDefault();
    var name = $("addName").value.trim();
    var host = $("addHost").value.trim().toLowerCase()
      .replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
    if (!name || !host || host.indexOf(".") === -1) {
      alert("Drop a real website, like netflix.com");
      return;
    }
    var id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Date.now().toString(36);
    settings.apps.push({ id: id, name: name, hosts: [host], limitMin: 30 });
    $("addName").value = "";
    $("addHost").value = "";
    saveSettings();
  });

  window.addEventListener("rewards:change", function () { /* stars changed elsewhere: nothing to redraw here */ });


  /* ---------- start ---------- */

  function start() {
    if ($("originText")) { $("originText").textContent = location.origin; }
    foldManual();
    awardStars();
    render();
    ping();
    setTimeout(ping, 600);
    setTimeout(ping, 1500);
    setInterval(poll, 5000);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) { poll(); } });
  }

  if (DIRECT) {
    // in the extension the saved settings live in chrome.storage: read them first
    chrome.storage.local.get("settings", function (d) {
      if (d.settings) { settings = normalize(d.settings); }
      start();
    });
  } else {
    start();
  }
})();
