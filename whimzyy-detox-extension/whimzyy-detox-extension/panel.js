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

  function send(type, extra) {
    if (DIRECT) { direct(type, extra || {}); return; }
    window.postMessage(Object.assign({ source: "whimzyy-page", type: type }, extra || {}), window.location.origin);
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

  function ping() { send("ping"); }

  function poll() {
    if (!ext.connected) { ping(); }
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

  function usedToday() {
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

  function render(force) {
    // do not redraw while a dropdown is open (the 5-second refresh would close it)
    var open = document.activeElement && document.activeElement.tagName === "SELECT";
    if (open && !force) { return; }

    if ($("extBanner")) { $("extBanner").hidden = ext.connected; }

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
    if (!ext.connected) { line = "Extension not plugged in yet 🔌"; }
    else if (!settings.enabled) { line = "Detox mode is off. Still counting though 👀"; }
    else if (!(limit > 0)) { line = "No daily limit. Pick one if you're brave."; }
    else if (used.total >= limit) { line = "Limit hit. Your apps are locked, go touch grass 🌱"; }
    else { line = fmt(limit - used.total) + " left today. Spend it wisely."; }
    $("leftLine").textContent = line;

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
