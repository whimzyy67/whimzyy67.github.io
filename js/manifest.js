/* manifest.js
   1) My Day: the "How are you feeling?" card becomes "Manifest it" (write what you want for a day, a week, a year, any day).
   2) Wellness: the "Energy" card becomes "How are you feeling?" (the same six moods as before, saved the same way).
   Dayverse shows the manifestations (dayverse.js reads the same list).

   The old cards are kept in the page but hidden, so myday.js and wellness.js keep working without changes.
   Saved in the browser as "whimzyy-manifest" and "whimzyy-moods", so they sync with the account like everything else. */
(function () {
  "use strict";
  if (window.__wzManifest) { return; }
  window.__wzManifest = true;

  var MANIFEST_KEY = "whimzyy-manifest";   // [{ id, text, created, target: "YYYY-MM-DD" }]
  var MOODS_KEY = "whimzyy-moods";         // { "2026-11-12": "slay" }
  var MOODS = [
    { id: "slay",        emoji: "💅", label: "Slayed!" },
    { id: "butterflies", emoji: "🦋", label: "Butterflies fr" },
    { id: "lowkey",      emoji: "🤏", label: "Lowkey" },
    { id: "mid",         emoji: "😐", label: "Mid ngl" },
    { id: "complicated", emoji: "🥴", label: "It's complicated" },
    { id: "dead",        emoji: "💀", label: "Never again homiee!!" }
  ];

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (text != null) { n.textContent = text; }
    return n;
  }
  function keyOf(d) { return d.toLocaleDateString("en-CA"); }
  function readList(k) {
    try { var v = JSON.parse(localStorage.getItem(k)); return Array.isArray(v) ? v : []; } catch (e) { return []; }
  }
  function readObject(k) {
    try { return JSON.parse(localStorage.getItem(k)) || {}; } catch (e) { return {}; }
  }
  function prettyDate(key) {
    var p = key.split("-").map(Number);
    return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  }
  // hide everything the card had before (kept in the page so the old scripts do not break)
  function hideOld(card) {
    Array.prototype.slice.call(card.children).forEach(function (c) { c.classList.add("wz-old"); });
  }

  /* ---------- My Day: Manifest it ---------- */
  function buildManifest() {
    var card = document.querySelector(".mood-card");
    if (!card || card.querySelector(".mf")) { return; }
    hideOld(card);
    card.classList.add("mf-card");

    var box = el("div", "mf");
    box.appendChild(el("h2", "mf-title", "Manifest it ✨"));

    var text = el("textarea", "mf-text");
    text.rows = 2; text.maxLength = 280;
    text.placeholder = "Write it like it already happened…";
    text.setAttribute("aria-label", "What do you want to manifest?");
    box.appendChild(text);

    var row = el("div", "mf-row");
    var when = el("select", "mf-when");
    when.setAttribute("aria-label", "For when");
    [["today", "For today"], ["tomorrow", "For tomorrow"], ["week", "In a week"],
     ["month", "In a month"], ["year", "In a year"], ["pick", "Pick a day…"]].forEach(function (o) {
      var op = el("option", "", o[1]); op.value = o[0]; when.appendChild(op);
    });
    var date = el("input", "mf-date"); date.type = "date"; date.hidden = true;
    date.min = keyOf(new Date());
    date.setAttribute("aria-label", "Pick a day");
    var save = el("button", "mf-save", "Manifest"); save.type = "button";
    row.appendChild(when); row.appendChild(date); row.appendChild(save);
    box.appendChild(row);

    var note = el("p", "mf-note", "");
    note.setAttribute("aria-live", "polite");
    box.appendChild(note);
    card.appendChild(box);

    when.addEventListener("change", function () {
      date.hidden = when.value !== "pick";
      if (!date.hidden) { date.focus(); }
    });

    function targetKey() {
      var d = new Date();
      switch (when.value) {
        case "tomorrow": d.setDate(d.getDate() + 1); break;
        case "week": d.setDate(d.getDate() + 7); break;
        case "month": d.setMonth(d.getMonth() + 1); break;
        case "year": d.setFullYear(d.getFullYear() + 1); break;
        case "pick": return date.value || "";
      }
      return keyOf(d);
    }

    function say(t, bad) { note.textContent = t; note.className = "mf-note" + (bad ? " bad" : ""); }

    save.addEventListener("click", function () {
      var t = text.value.replace(/\s+\n/g, "\n").trim();
      if (t.length < 2) { say("Write what you want to manifest first.", true); text.focus(); return; }
      var target = targetKey();
      if (!target) { say("Pick a day.", true); return; }
      var list = readList(MANIFEST_KEY);
      list.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), text: t, created: Date.now(), target: target });
      try { localStorage.setItem(MANIFEST_KEY, JSON.stringify(list)); } catch (e) { say("Could not save here.", true); return; }
      text.value = "";
      say("✨ Manifested for " + (target === keyOf(new Date()) ? "today" : prettyDate(target)) + ". It's waiting on Dayverse.");
      window.dispatchEvent(new CustomEvent("whimzyy-manifest-saved"));
    });
  }

  /* ---------- Wellness: How are you feeling? ---------- */
  function buildMood() {
    var card = document.querySelector(".checkin-card");
    if (!card || card.querySelector(".wz-mood")) { return; }
    hideOld(card);
    card.classList.add("wz-mood-card");

    var box = el("div", "wz-mood");
    box.appendChild(el("h2", "wz-mood-title", "How are you feeling?"));
    var rowEl = el("div", "wz-mood-row");
    rowEl.setAttribute("role", "group");
    var note = el("p", "wz-mood-note", "Tap the one that fits today.");
    note.setAttribute("aria-live", "polite");

    var today = keyOf(new Date());
    var current = readObject(MOODS_KEY)[today];

    MOODS.forEach(function (m) {
      var b = el("button", "wz-mood-btn" + (m.id === current ? " selected" : ""));
      b.type = "button";
      b.setAttribute("aria-pressed", m.id === current ? "true" : "false");
      b.dataset.mood = m.id;
      b.appendChild(el("span", "wz-mood-emoji", m.emoji));
      b.appendChild(el("span", "wz-mood-label", m.label));
      b.addEventListener("click", function () {
        var all = readObject(MOODS_KEY);
        var day = keyOf(new Date());
        all[day] = m.id;
        try { localStorage.setItem(MOODS_KEY, JSON.stringify(all)); } catch (e) { /* ignore */ }
        Array.prototype.forEach.call(rowEl.children, function (x) {
          var on = x === b;
          x.classList.toggle("selected", on);
          x.setAttribute("aria-pressed", on ? "true" : "false");
        });
        note.textContent = "Saved: " + m.label + " ✓";
      });
      rowEl.appendChild(b);
    });
    if (current) {
      var found = MOODS.filter(function (m) { return m.id === current; })[0];
      if (found) { note.textContent = "Saved: " + found.label + " ✓"; }
    }
    box.appendChild(rowEl); box.appendChild(note);
    card.appendChild(box);
  }

  function start() {
    var page = (location.pathname.split("/").pop() || "").replace(/\.html$/, "");
    if (page === "my-day") { buildManifest(); }
    if (page === "wellness") { buildMood(); }
  }
  if (document.body) { start(); } else { document.addEventListener("DOMContentLoaded", start); }
})();
