/* ===== 1. Where each thing is saved (these match your other pages) ===== */

const ANSWER_PREFIX = "whimzyy-answer-";      // home.js: "whimzyy-answer-2026-11-12" holds one text
const MOODS_KEY = "whimzyy-moods";            // wellness page: { "2026-11-12": "slay" }
const MANIFEST_KEY = "whimzyy-manifest";      // my-day page: [{ id, text, created, target: "2026-12-01" }]
const JOURNAL_KEY = "whimzyy-journal";        // myday.js: [{ id, text, created, edited }]
const PARKING_KEY = "whimzyy-parking-notes";  // focus.js: [{ id, text, created, task }]
const TASK_LIST_KEY = "whimzyy-tasks";        // tasks.js: [{ text, done, doneAt }]

// the six moods from My Day (the saved word on the left, what to show on the right)
const MOODS = {
  slay: { emoji: "💅", label: "Slayed!" },
  butterflies: { emoji: "🦋", label: "Butterflies fr" },
  lowkey: { emoji: "🤏", label: "Lowkey" },
  mid: { emoji: "😐", label: "Mid ngl" },
  complicated: { emoji: "🥴", label: "It's complicated" },
  dead: { emoji: "💀", label: "Never again homiee!!" }
};

/* ===== 2. Page elements and helpers ===== */

const dateLabel = document.getElementById("dateLabel");
const datePicker = document.getElementById("datePicker");
const prevDay = document.getElementById("prevDay");
const nextDay = document.getElementById("nextDay");
const dayNoteBox = document.getElementById("dayNoteBox");
const moodBox = document.getElementById("moodBox");
const taskList = document.getElementById("taskList");
const energyBox = document.getElementById("energyBox");
const journalList = document.getElementById("journalList");
const parkingList = document.getElementById("parkingList");

// STARS
const starList = document.getElementById("starList");
const starTotal = document.getElementById("starTotal");
const shareDayBtn = document.getElementById("shareDay");

let viewDate = new Date();   // the day being shown (today at first)

// a date as YYYY-MM-DD, the same way the other pages write it
function keyOf(date) {
  return date.toLocaleDateString("en-CA");
}

// is the day being shown today?
function isToday() {
  return keyOf(viewDate) === keyOf(new Date());
}

// does this time (in ms) fall on the day being shown?
function onViewedDay(ms) {
  return Boolean(ms) && keyOf(new Date(ms)) === keyOf(viewDate);
}

// reads a saved list (or an empty list if nothing is saved)
function loadList(key) {
  try {
    const list = JSON.parse(localStorage.getItem(key));
    return Array.isArray(list) ? list : [];
  } catch (error) {
    return [];
  }
}

// reads a saved object (or an empty object)
function loadObject(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || {};
  } catch (error) {
    return {};
  }
}

// 1730600000000 becomes "10:42 pm"
function timeText(ms) {
  return new Date(ms).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

// the message shown inside a box when nothing was saved
function showEmpty(box, message) {
  box.textContent = "";
  const p = document.createElement("p");
  p.className = "dv-empty";
  p.textContent = message;
  box.appendChild(p);
}

// adds one entry (text, and a small line under it) to a list
function addEntry(list, text, small, extraClass) {
  const li = document.createElement("li");
  li.className = "dv-entry" + (extraClass ? " " + extraClass : "");

  const p = document.createElement("p");
  p.className = "dv-text";
  p.textContent = text;
  li.appendChild(p);

  if (small) {
    const time = document.createElement("span");
    time.className = "dv-time";
    time.textContent = small;
    li.appendChild(time);
  }

  list.appendChild(li);
}

// adds the "nothing here" message to a list
function addEmpty(list, message) {
  const li = document.createElement("li");
  li.className = "dv-empty";
  li.textContent = message;
  list.appendChild(li);
}

/* ===== 3. Drawing the page ===== */

function render() {
  const key = keyOf(viewDate);

  // date bar
  dateLabel.textContent = viewDate.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
  datePicker.value = key;
  window.dispatchEvent(new CustomEvent("wz-dv-day", { detail: key }));
  datePicker.max = keyOf(new Date());
  nextDay.disabled = isToday();

  /* --- How was your day (Home saves one answer per day) --- */
  const answer = localStorage.getItem(ANSWER_PREFIX + key);
  if (answer) {
    dayNoteBox.textContent = "";
    const p = document.createElement("p");
    p.className = "dv-text";
    p.textContent = answer;
    dayNoteBox.appendChild(p);
  } else {
    showEmpty(dayNoteBox, "Nothing written about this day ✨");
  }

  /* --- Feeling check-in (My Day saves one mood per day) --- */
  const mood = MOODS[loadObject(MOODS_KEY)[key]];
  if (mood) {
    moodBox.textContent = "";

    const emoji = document.createElement("span");
    emoji.className = "dv-big";
    emoji.textContent = mood.emoji;

    const label = document.createElement("p");
    label.className = "dv-text";
    label.textContent = mood.label;

    moodBox.append(emoji, label);
  } else {
    showEmpty(moodBox, "No feeling checked in this day");
  }

  /* --- Tasks completed --- */
  const tasks = loadList(TASK_LIST_KEY);

  const doneToday = tasks.filter(function (task) {
    return task && task.done && onViewedDay(task.doneAt);
  }).sort(function (a, b) {
    return a.doneAt - b.doneAt;
  });

  // tasks still waiting are only shown for today
  const waiting = isToday() ? tasks.filter(function (task) {
    return task && !task.done;
  }) : [];

  taskList.textContent = "";
  doneToday.forEach(function (task) {
    addEntry(taskList, "✔ " + task.text, timeText(task.doneAt));
  });
  waiting.forEach(function (task) {
    addEntry(taskList, "○ " + task.text, "", "pending");
  });
  if (doneToday.length === 0 && waiting.length === 0) {
    addEmpty(taskList, "No tasks completed this day");
  }

  /* --- Manifestation (written on My Day) --- */
  const manifests = loadList(MANIFEST_KEY).filter(function (m) {
    return m && m.text && (onViewedDay(m.created) || m.target === key);
  }).sort(function (a, b) {
    return b.created - a.created;   // newest first
  });

  if (manifests.length > 0) {
    energyBox.textContent = "";
    const ul = document.createElement("ul");
    ul.className = "dv-mf";
    manifests.forEach(function (m) {
      const li = document.createElement("li");
      li.className = "dv-mf-item";

      const p = document.createElement("p");
      p.className = "dv-text";
      const forThisDay = m.target === key;
      p.textContent = (forThisDay ? "🌙 " : "✨ ") + m.text;
      li.appendChild(p);

      const small = document.createElement("span");
      small.className = "dv-time";
      if (forThisDay && !onViewedDay(m.created)) {
        small.textContent = "written " + new Date(m.created).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
      } else {
        const t = m.target.split("-").map(Number);
        small.textContent = m.target === key ? "for this day" :
          "for " + new Date(t[0], t[1] - 1, t[2]).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
      }
      li.appendChild(small);
      ul.appendChild(li);
    });
    energyBox.appendChild(ul);
    if (manifests.length > 1) {
      const more = document.createElement("span");
      more.className = "dv-mf-more";
      more.textContent = "+" + (manifests.length - 1) + " more";
      energyBox.appendChild(more);
    }
  } else {
    showEmpty(energyBox, "Nothing manifested this day ✨");
  }

  /* --- Journal (oldest entry first, so the day reads like a story) --- */
  const entries = loadList(JOURNAL_KEY).filter(function (entry) {
    return entry && onViewedDay(entry.created);
  }).sort(function (a, b) {
    return a.created - b.created;
  });

  journalList.textContent = "";
  entries.forEach(function (entry) {
    addEntry(journalList, entry.text, timeText(entry.created) + (entry.edited ? " (edited)" : ""));
  });
  if (entries.length === 0) {
    addEmpty(journalList, "No journal entries this day");
  }

  /* --- Parking lot --- */
  const parked = loadList(PARKING_KEY).filter(function (note) {
    return note && onViewedDay(note.created);
  }).sort(function (a, b) {
    return a.created - b.created;
  });

  parkingList.textContent = "";
  parked.forEach(function (note) {
    addEntry(parkingList, note.text,
      timeText(note.created) + (note.task ? " · while working on: " + note.task : ""));
  });
  if (parked.length === 0) {
    addEmpty(parkingList, "Nothing parked this day ✨");
  }

  /* --- Stars earned (and spent) --- */
  const starEntries = window.Rewards ? Rewards.entriesOn(key) : [];

  starList.textContent = "";
  starEntries.forEach(function (entry) {
    addEntry(starList,
      (entry.amount > 0 ? "+" : "−") + Math.abs(entry.amount) + " ⭐  " + entry.reason,
      timeText(entry.ts));
  });
  if (starEntries.length === 0) {
    addEmpty(starList, "No stars this day");
  }
  starTotal.textContent = window.Rewards ? "⭐ " + Rewards.starsOn(key) : "";
}

/* ===== 4. Moving between days ===== */

// the cards slide out, the new day is drawn, then the cards slide in (direction: 1 = forward in time, -1 = back)
let sliding = false;
function slideDay(direction, change) {
  const cards = Array.from(document.querySelectorAll(".dv-card"));
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || sliding || cards.length === 0 || !cards[0].animate) {
    change();
    return;
  }
  sliding = true;
  const away = -direction * 48;
  const out = cards.map(function (card) {
    return card.animate(
      [{ transform: "translateX(0)", opacity: 1 }, { transform: "translateX(" + away + "px)", opacity: 0 }],
      { duration: 150, easing: "ease-in", fill: "forwards" }
    );
  });
  Promise.all(out.map(function (a) { return a.finished; })).catch(function () {}).then(function () {
    change();
    cards.forEach(function (card) {
      card.getAnimations().forEach(function (a) { a.cancel(); });
      card.animate(
        [{ transform: "translateX(" + (-away) + "px)", opacity: 0 }, { transform: "translateX(0)", opacity: 1 }],
        { duration: 220, easing: "ease-out" }
      );
    });
    sliding = false;
  });
}

function moveDay(n) {
  slideDay(n > 0 ? 1 : -1, function () {
    viewDate.setDate(viewDate.getDate() + n);
    render();
  });
}

prevDay.addEventListener("click", function () {
  moveDay(-1);
});

nextDay.addEventListener("click", function () {
  if (!isToday()) {
    moveDay(1);
  }
});

// picking a date in the calendar box
datePicker.addEventListener("change", function () {
  if (datePicker.value === "") {
    return;
  }

  const parts = datePicker.value.split("-").map(Number);
  const picked = new Date(parts[0], parts[1] - 1, parts[2]);

  // no days in the future
  const target = picked > new Date() ? new Date() : picked;
  slideDay(target >= viewDate ? 1 : -1, function () {
    viewDate = target;
    render();
  });
});

// the picture card of the day being shown
shareDayBtn.addEventListener("click", function () {
  Rewards.shareDay(viewDate);
});

// if something is saved in another open tab, show it here too
window.addEventListener("storage", render);

// stars earned or spent: redraw
window.addEventListener("rewards:change", render);

/* ===== 5. Start the page ===== */

render();

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
