/* ===== 1. Greeting (changes with the time of day) ===== */

const greetingText = document.getElementById("greetingText");
const greetingSub = document.getElementById("greetingSub");
const greetingDate = document.getElementById("greetingDate");

// pick what to say for the current hour (0 to 23)
function getGreeting(hour) {
  if (hour >= 5 && hour < 12) {
    return {
      hello: "🌞 Good morning",
      sub: "Rise and shine, it's a new day, new slay!✨"
    };
  }

  if (hour >= 12 && hour < 17) {
    return {
      hello: "☀️ Good afternoon",
      sub: "Let your Dreams cook and keep dodging negativity, as always!"
    };
  }

  if (hour >= 17 && hour < 21) {
    return {
      hello: "✨ Good evening",
      sub: "Golden hour hits different, main character energy!"
    };
  }

  // 9 pm to 4:59 am
  return {
    hello: "🌙 Good night",
    sub: "Lights out, thoughts loud, but the vibe stays immaculate!"
  };
}

function updateGreeting() {
  const now = new Date();
  const greeting = getGreeting(now.getHours());

  // Settings (later) can save a display name under this key
  const name = localStorage.getItem("whimzyy-name");

  greetingText.textContent = name ? greeting.hello + ", " + name : greeting.hello;
  greetingSub.textContent = greeting.sub;
  greetingDate.textContent = now.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long"
  });
}

// run it once now, then check again every minute
updateGreeting();
setInterval(updateGreeting, 60000);

/* ===== 2. To-do list and % completed ===== */

const progressPercent = document.getElementById("progressPercent");
const progressCount = document.getElementById("progressCount");
const progressFill = document.getElementById("progressFill");
const progressBar = document.getElementById("progressBar");

// todo.js calls this every time the list is drawn
function updateProgress(tasks) {
  const total = tasks.length;
  const done = tasks.filter(function (task) {
    return task.done;
  }).length;

  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  progressPercent.textContent = percent + "%";
  progressFill.style.width = percent + "%";
  progressBar.setAttribute("aria-valuenow", percent);

  if (total === 0) {
    progressCount.textContent = "No tasks yet";
  } else {
    progressCount.textContent = done + " of " + total + " tasks done";
  }
}

setupTodo(
  document.getElementById("todoList"),
  document.getElementById("todoForm"),
  document.getElementById("todoInput"),
  updateProgress
);

/* ===== 3. Mood check-up (remembered for each day) ===== */

const moodButtons = document.querySelectorAll(".mood-btn");
const moodNote = document.getElementById("moodNote");

// today's date as YYYY-MM-DD (checked when needed, so it stays right after midnight)
function getTodayKey() {
  return new Date().toLocaleDateString("en-CA");
}

// all saved moods look like { "2026-11-03": "slay", "2026-11-04": "mid" }
function loadMoods() {
  try {
    return JSON.parse(localStorage.getItem("whimzyy-moods")) || {};
  } catch (error) {
    return {};
  }
}

// highlight the chosen mood
function showMood(value) {
  moodButtons.forEach(function (button) {
    const selected = button.dataset.mood === String(value);
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", selected);
  });
}

// the line under the buttons
function showMoodNote(button) {
  const label = button.querySelector(".mood-label").textContent.trim();
  moodNote.textContent = "Saved: " + label + " (tap another to change it)";
}

moodButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    const moods = loadMoods();
    moods[getTodayKey()] = button.dataset.mood;   // saves the word, like "slay"
    localStorage.setItem("whimzyy-moods", JSON.stringify(moods));

    showMood(button.dataset.mood);
    showMoodNote(button);
  });
});

// when the page opens, show today's saved mood (if there is one)
const savedMood = loadMoods()[getTodayKey()];
const savedButton = document.querySelector('.mood-btn[data-mood="' + savedMood + '"]');
if (savedButton) {
  showMood(savedMood);
  showMoodNote(savedButton);
}

/* ===== 4. Journal ===== */

const journalForm = document.getElementById("journalForm");
const journalInput = document.getElementById("journalInput");
const journalNote = document.getElementById("journalNote");
const entryList = document.getElementById("entryList");

// every entry looks like { id: 1730600000000, text: "...", created: 1730600000000, edited: 0 }
function loadEntries() {
  try {
    return JSON.parse(localStorage.getItem("whimzyy-journal")) || [];
  } catch (error) {
    return [];
  }
}

let entries = loadEntries();   // newest first
let editingId = null;          // the id of the entry being edited (none at first)

function saveEntries() {
  localStorage.setItem("whimzyy-journal", JSON.stringify(entries));
}

// "Tuesday, 3 November · 10:42 pm"
function formatEntryTime(ms) {
  const date = new Date(ms);
  const dayOptions = { weekday: "long", day: "numeric", month: "long" };

  // only show the year for entries from an earlier year
  if (date.getFullYear() !== new Date().getFullYear()) {
    dayOptions.year = "numeric";
  }

  return date.toLocaleDateString("en-IN", dayOptions) + " · " +
    date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

// makes one small button
function makeButton(text, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "entry-btn";
  button.textContent = text;
  button.setAttribute("aria-label", text + " this entry");
  button.addEventListener("click", onClick);
  return button;
}

// draw all the saved entries
function renderEntries() {
  entryList.textContent = "";
  let boxToFocus = null;

  entries.forEach(function (entry) {
    const li = document.createElement("li");
    li.className = "entry";

    // day and time
    const time = document.createElement("p");
    time.className = "entry-time";
    time.textContent = formatEntryTime(entry.created) + (entry.edited ? " (edited)" : "");
    li.appendChild(time);

    if (entry.id === editingId) {

      // edit mode: a text box with Save and Cancel
      const box = document.createElement("textarea");
      box.className = "entry-edit";
      box.rows = 4;
      box.value = entry.text;
      box.setAttribute("aria-label", "Edit entry");

      const actions = document.createElement("div");
      actions.className = "entry-actions";

      const saveButton = makeButton("Save", function () {
        const value = box.value.trim();
        if (value === "") {
          return;   // an entry can't be empty (use Delete instead)
        }
        if (value !== entry.text) {
          entry.text = value;
          entry.edited = Date.now();
        }
        editingId = null;
        saveEntries();
        renderEntries();
      });
      saveButton.classList.add("primary");

      const cancelButton = makeButton("Cancel", function () {
        editingId = null;
        renderEntries();
      });

      actions.append(saveButton, cancelButton);
      li.append(box, actions);
      boxToFocus = box;

    } else {

      // normal mode: the text with Edit and Delete
      const text = document.createElement("p");
      text.className = "entry-text";
      text.textContent = entry.text;

      const actions = document.createElement("div");
      actions.className = "entry-actions";

      const editButton = makeButton("Edit", function () {
        editingId = entry.id;
        renderEntries();
      });

      const deleteButton = makeButton("Delete", function () {
        if (confirm("Delete this entry? This can't be undone.")) {
          entries = entries.filter(function (other) {
            return other.id !== entry.id;
          });
          saveEntries();
          renderEntries();
        }
      });

      actions.append(editButton, deleteButton);
      li.append(text, actions);
    }

    entryList.appendChild(li);
  });

  // put the cursor in the edit box
  if (boxToFocus) {
    boxToFocus.focus();
  }
}

// saving a new entry
journalForm.addEventListener("submit", function (event) {
  event.preventDefault();

  const value = journalInput.value.trim();
  if (value === "") {
    journalNote.textContent = "Write a little something first.";
    return;
  }

  const now = Date.now();
  entries.unshift({ id: now, text: value, created: now, edited: 0 });   // unshift = add to the front
  saveEntries();

  journalInput.value = "";
  journalNote.textContent = "Saved.";
  renderEntries();
});

// clear the note when you start typing again
journalInput.addEventListener("input", function () {
  journalNote.textContent = "";
});

// draw the entries when the page opens
renderEntries();