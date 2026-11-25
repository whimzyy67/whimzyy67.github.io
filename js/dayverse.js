/* ===== 1. Where each thing is saved (these match your other pages) ===== */

const ANSWER_PREFIX = "whimzyy-answer-";      // home.js: "whimzyy-answer-2026-11-12" holds one text
const ENERGY_PREFIX = "whimzyy-energy-";      // wellness.js: "whimzyy-energy-2026-11-12" holds "1" to "5"
const MOODS_KEY = "whimzyy-moods";            // myday.js: { "2026-11-12": "slay" }
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

// the five energy buttons from Wellness (the saved number on the left)
const ENERGY = {
  1: { word: "cooked", note: "Drained" },
  2: { word: "Dry", note: "Low" },
  3: { word: "Mid", note: "Okay" },
  4: { word: "Chill", note: "Good" },
  5: { word: "GOAT", note: "Charged" }
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

  /* --- Energy check-up (Wellness saves one number per day) --- */
  const energy = ENERGY[localStorage.getItem(ENERGY_PREFIX + key)];
  if (energy) {
    energyBox.textContent = "";

    const word = document.createElement("span");
    word.className = "dv-big-word";
    word.textContent = energy.word;

    const note = document.createElement("span");
    note.className = "dv-time";
    note.textContent = energy.note;

    energyBox.append(word, note);
  } else {
    showEmpty(energyBox, "No energy check-up this day");
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