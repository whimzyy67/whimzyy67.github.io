/* habits.js: the Habits page (Growth > Habits).
   Sidebar: add habits, your list, and a donut report for the month on screen.
   Main page: the month split into week tabs, with a checkbox for every habit on every day.
   Saved in localStorage as "whimzyy-habits" ({ list:[{id,name,start}], log:{ "YYYY-MM-DD":[habitId,...] } }),
   so it syncs to your account like everything else that starts with "whimzyy-". */
(function () {
  "use strict";

  var KEY = "whimzyy-habits", MAX_HABITS = 20;
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) { n.className = cls; } if (text != null) { n.textContent = text; } return n; }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function keyOf(y, m, d) { return y + "-" + pad(m + 1) + "-" + pad(d); }
  function todayKey() { var t = new Date(); return keyOf(t.getFullYear(), t.getMonth(), t.getDate()); }
  function daysIn(y, m) { return new Date(y, m + 1, 0).getDate(); }

  /* ---------- saved data ---------- */
  function load() {
    var d = null;
    try { d = JSON.parse(localStorage.getItem(KEY)); } catch (e) { d = null; }
    if (!d || typeof d !== "object") { d = {}; }
    if (!Array.isArray(d.list)) { d.list = []; }
    if (!d.log || typeof d.log !== "object") { d.log = {}; }
    return d;
  }
  var data = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ v: 1, list: data.list, log: data.log })); } catch (e) { /* storage blocked */ } }
  function isDone(day, id) { return !!(data.log[day] && data.log[day].indexOf(id) > -1); }
  function setDone(day, id, on) {
    var a = data.log[day] || [];
    var i = a.indexOf(id);
    if (on && i < 0) { a.push(id); }
    if (!on && i > -1) { a.splice(i, 1); }
    if (a.length) { data.log[day] = a; } else { delete data.log[day]; }
    save();
  }

  /* ---------- what is on screen ---------- */
  var now = new Date();
  var view = { y: now.getFullYear(), m: now.getMonth(), week: 0 };

  function weeksOf(y, m) {
    var n = daysIn(y, m), out = [];
    for (var s = 1; s <= n; s += 7) { out.push({ from: s, to: Math.min(n, s + 6) }); }
    return out;
  }
  function currentWeekIndex() {
    var t = new Date();
    if (t.getFullYear() !== view.y || t.getMonth() !== view.m) { return 0; }
    return Math.floor((t.getDate() - 1) / 7);
  }

  /* one habit on one day: "na" (before you added it), "up" (still to come), "done" or "miss" */
  function state(h, key) {
    if (key < h.start) { return "na"; }
    if (isDone(key, h.id)) { return "done"; }
    return key > todayKey() ? "up" : "miss";
  }

  function stats(y, m, onlyHabit) {
    var s = { done: 0, miss: 0, up: 0 }, n = daysIn(y, m);
    data.list.forEach(function (h) {
      if (onlyHabit && h.id !== onlyHabit) { return; }
      for (var d = 1; d <= n; d++) {
        var st = state(h, keyOf(y, m, d));
        if (st !== "na") { s[st]++; }
      }
    });
    return s;
  }
  function pct(s) { var t = s.done + s.miss; return t ? Math.round((s.done / t) * 100) : 0; }

  /* ---------- sidebar: list ---------- */
  var armed = null, armedTimer = null;

  function renderList() {
    var ul = $("hbList");
    ul.textContent = "";
    if (!data.list.length) { ul.appendChild(el("li", "hb-none", "No habits yet.")); return; }
    data.list.forEach(function (h) {
      var li = el("li", "hb-item");
      li.appendChild(el("span", "hb-name", h.name));
      var p = el("span", "hb-pct", pct(stats(view.y, view.m, h.id)) + "%");
      p.title = "This month";
      li.appendChild(p);
      var x = el("button", "hb-del", armed === h.id ? "Sure?" : "✕");
      x.type = "button"; x.setAttribute("aria-label", "Remove " + h.name);
      if (armed === h.id) { x.classList.add("armed"); }
      x.addEventListener("click", function () {
        if (armed === h.id) { removeHabit(h.id); return; }
        armed = h.id; clearTimeout(armedTimer);
        armedTimer = setTimeout(function () { armed = null; renderList(); }, 3000);
        renderList();
      });
      li.appendChild(x);
      ul.appendChild(li);
    });
  }

  function say(t) { $("hbMsg").textContent = t || ""; }

  function addHabit(name) {
    name = name.replace(/\s+/g, " ").trim();
    if (!name) { say("Type a habit first."); return false; }
    if (data.list.length >= MAX_HABITS) { say("That's " + MAX_HABITS + " habits. Remove one to add another."); return false; }
    var lower = name.toLowerCase();
    for (var i = 0; i < data.list.length; i++) { if (data.list[i].name.toLowerCase() === lower) { say("You already have that one."); return false; } }
    data.list.push({ id: "h" + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36), name: name, start: todayKey() });
    save(); say("");
    return true;
  }
  function removeHabit(id) {
    armed = null;
    data.list = data.list.filter(function (h) { return h.id !== id; });
    Object.keys(data.log).forEach(function (k) {
      data.log[k] = data.log[k].filter(function (x) { return x !== id; });
      if (!data.log[k].length) { delete data.log[k]; }
    });
    save(); renderAll();
  }

  /* ---------- sidebar: donut report ---------- */
  function renderReport() {
    var s = stats(view.y, view.m), total = s.done + s.miss + s.up;
    var donut = $("hbDonut");
    donut.textContent = "";
    $("hbReportTitle").textContent = MONTHS[view.m] + " report";
    var R = 15.9155, parts = [["done", "var(--gold, #F2B83D)"], ["miss", "var(--wine-soft, #8A2A3A)"], ["up", "rgba(243,231,211,.22)"]];
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 42 42"); svg.setAttribute("class", "hb-donut-svg");
    var ring = document.createElementNS(svg.namespaceURI, "circle");
    ring.setAttribute("cx", "21"); ring.setAttribute("cy", "21"); ring.setAttribute("r", String(R));
    ring.setAttribute("fill", "none"); ring.setAttribute("stroke", "rgba(0,0,0,.25)"); ring.setAttribute("stroke-width", "5.5");
    svg.appendChild(ring);
    var offset = 25;                                   // start at the top
    if (total) {
      parts.forEach(function (p) {
        var share = (s[p[0]] / total) * 100;
        if (share <= 0) { return; }
        var c = document.createElementNS(svg.namespaceURI, "circle");
        c.setAttribute("cx", "21"); c.setAttribute("cy", "21"); c.setAttribute("r", String(R));
        c.setAttribute("fill", "none"); c.setAttribute("stroke", p[1]); c.setAttribute("stroke-width", "5.5");
        c.setAttribute("stroke-dasharray", share + " " + (100 - share));
        c.setAttribute("stroke-dashoffset", String(offset));
        svg.appendChild(c);
        offset -= share;
      });
    }
    donut.appendChild(svg);
    var mid = el("div", "hb-donut-mid");
    mid.appendChild(el("b", "", total ? pct(s) + "%" : "–"));
    mid.appendChild(el("span", "", total ? "done" : "no habits"));
    donut.appendChild(mid);
    donut.setAttribute("aria-label", total ? (pct(s) + " percent of habits done in " + MONTHS[view.m]) : "No habits yet");

    var lg = $("hbLegend");
    lg.textContent = "";
    [["done", "Done", s.done], ["miss", "Missed", s.miss], ["up", "To go", s.up]].forEach(function (r) {
      var li = el("li", "hb-lg-" + r[0]);
      li.appendChild(el("i"));
      li.appendChild(el("span", "", r[1]));
      li.appendChild(el("b", "", String(r[2])));
      lg.appendChild(li);
    });
  }

  /* ---------- main page: tabs and the checkbox grid ---------- */
  function renderTabs() {
    var weeks = weeksOf(view.y, view.m), box = $("hbTabs");
    if (view.week >= weeks.length) { view.week = weeks.length - 1; }
    box.textContent = "";
    weeks.forEach(function (w, i) {
      var b = el("button", "hb-tab"); b.type = "button"; b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", i === view.week ? "true" : "false");
      b.appendChild(el("b", "", "Week " + (i + 1)));
      b.appendChild(el("span", "", w.from === w.to ? String(w.from) : w.from + "–" + w.to));
      b.addEventListener("click", function () { view.week = i; renderTabs(); renderTable(); });
      box.appendChild(b);
    });
  }

  function renderTable() {
    var t = $("hbTable"), weeks = weeksOf(view.y, view.m), w = weeks[Math.min(view.week, weeks.length - 1)];
    t.textContent = "";
    $("hbEmpty").hidden = data.list.length > 0;
    t.hidden = !data.list.length;
    if (!data.list.length) { return; }
    var tk = todayKey();

    var thead = el("thead"), hr = el("tr");
    hr.appendChild(el("th", "hb-th-name", "Habit"));
    for (var d = w.from; d <= w.to; d++) {
      var key = keyOf(view.y, view.m, d), wd = WEEKDAYS[new Date(view.y, view.m, d).getDay()];
      var th = el("th", "hb-th-day" + (key === tk ? " today" : ""));
      th.appendChild(el("span", "", wd)); th.appendChild(el("b", "", String(d)));
      hr.appendChild(th);
    }
    hr.appendChild(el("th", "hb-th-sum", "Week"));
    thead.appendChild(hr); t.appendChild(thead);

    var tbody = el("tbody");
    data.list.forEach(function (h) {
      var tr = el("tr");
      tr.appendChild(el("th", "hb-td-name", h.name));
      var done = 0, possible = 0, sumCell = el("td", "hb-td-sum");
      for (var d2 = w.from; d2 <= w.to; d2++) {
        (function (day) {
          var key2 = keyOf(view.y, view.m, day), st = state(h, key2);
          var td = el("td", "hb-td" + (key2 === tk ? " today" : "")), lab = el("label", "hb-check");
          var cb = el("input"); cb.type = "checkbox"; cb.checked = (st === "done");
          cb.disabled = (st === "na" || st === "up");
          cb.setAttribute("aria-label", h.name + ", " + MONTHS[view.m] + " " + day);
          lab.appendChild(cb); lab.appendChild(el("span", "hb-box"));
          if (st === "na") { td.classList.add("na"); lab.title = "Added later"; }
          if (st === "up") { td.classList.add("up"); lab.title = "Not yet"; }
          if (st === "done") { done++; possible++; } else if (st === "miss") { possible++; }
          cb.addEventListener("change", function () {
            setDone(key2, h.id, cb.checked);
            renderWeekSums(); renderReport(); renderList();
          });
          td.appendChild(lab); tr.appendChild(td);
        })(d2);
      }
      sumCell.dataset.hid = h.id;
      tr.appendChild(sumCell);
      tbody.appendChild(tr);
    });
    t.appendChild(tbody);
    renderWeekSums();
  }

  function renderWeekSums() {
    var weeks = weeksOf(view.y, view.m), w = weeks[Math.min(view.week, weeks.length - 1)];
    Array.prototype.forEach.call(document.querySelectorAll(".hb-td-sum"), function (cell) {
      var h = data.list.filter(function (x) { return x.id === cell.dataset.hid; })[0];
      if (!h) { return; }
      var done = 0, possible = 0;
      for (var d = w.from; d <= w.to; d++) {
        var st = state(h, keyOf(view.y, view.m, d));
        if (st === "done") { done++; possible++; } else if (st === "miss") { possible++; }
      }
      cell.textContent = possible ? done + "/" + possible : "–";
    });
  }

  function renderTitle() { $("hbTitle").textContent = MONTHS[view.m] + " " + view.y; }
  function renderAll() { renderTitle(); renderTabs(); renderTable(); renderList(); renderReport(); }

  /* ---------- buttons ---------- */
  $("hbForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var input = $("hbInput");
    if (addHabit(input.value)) { input.value = ""; renderAll(); }
    input.focus();
  });
  function goMonth(delta) {
    var d = new Date(view.y, view.m + delta, 1);
    view.y = d.getFullYear(); view.m = d.getMonth(); view.week = currentWeekIndex();
    renderAll();
  }
  $("hbPrev").addEventListener("click", function () { goMonth(-1); });
  $("hbNext").addEventListener("click", function () { goMonth(1); });
  $("hbToday").addEventListener("click", function () {
    var t = new Date(); view.y = t.getFullYear(); view.m = t.getMonth(); view.week = currentWeekIndex(); renderAll();
  });

  // the sidebar is open by default; this only hides and shows it
  function setSide(open) {
    $("hbPage").classList.toggle("closed", !open);
    $("hbHide").setAttribute("aria-expanded", open ? "true" : "false");
    $("hbShow").hidden = open;
  }
  $("hbHide").addEventListener("click", function () { setSide(false); });
  $("hbShow").addEventListener("click", function () { setSide(true); });

  view.week = currentWeekIndex();
  setSide(true);
  renderAll();
})();
