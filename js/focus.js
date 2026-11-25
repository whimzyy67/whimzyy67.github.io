/* ===== 1. Alert sound (a soft 2-second chime made by the browser, no audio file needed) ===== */

let audioCtx = null;

// browsers only allow sound after a click, so we "unlock" it when Start is pressed
function unlockAudio() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

// loudness chosen on the Vibe page (master x chime), from 0 to 1
function chimeLoudness() {
  try {
    const v = JSON.parse(localStorage.getItem("whimzyy-volumes")) || {};
    const master = (v.master === undefined ? 100 : v.master) / 100;
    const chime = (v.chime === undefined ? 100 : v.chime) / 100;
    return master * chime;
  } catch (error) {
    return 1;
  }
}

// four notes, half a second each = 2 seconds
function playAlert() {
  if (!audioCtx) {
    return;
  }

  const notes = [659.25, 783.99, 1046.5, 783.99];
  const begin = audioCtx.currentTime + 0.05;

  notes.forEach(function (frequency, i) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const t = begin + i * 0.5;

    osc.type = "sine";
    osc.frequency.value = frequency;

    // fade in and out so it sounds soft, not harsh
    gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, 0.25 * chimeLoudness()), t + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.48);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.5);
  });
}

/* ===== 2. Things the page needs ===== */

const BLOCK_MS = 25 * 60 * 1000;          // Stopwatch: one turn of the ring = 25 minutes

const PHASE_NAMES = { focus: "Focus", short: "Short break", long: "Long break" };
const MODE_NAMES = { timer: "Timer", stopwatch: "Stopwatch", pomodoro: "Pomodoro" };

const dial = document.getElementById("dial");
const ringProgress = document.getElementById("ringProgress");

/* FIX 1: the ring's length is read from the circle itself, and the ring starts EMPTY.
   (Before, the dash length was never set, so the ring always looked full.) */
const RING_LENGTH = 2 * Math.PI * ringProgress.r.baseVal.value;
ringProgress.style.strokeDasharray = RING_LENGTH;
ringProgress.style.strokeDashoffset = RING_LENGTH;

const dialLabel = document.getElementById("dialLabel");
const dialTime = document.getElementById("dialTime");
const statusNote = document.getElementById("statusNote");
const nextUp = document.getElementById("nextUp");
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const skipBtn = document.getElementById("skipBtn");
const modeTabs = document.querySelectorAll(".mode-tab");
const modeParts = document.querySelectorAll("[data-show]");
const lockables = document.querySelectorAll(".chip, .lockable");
const chips = document.querySelectorAll(".chip");
const customInput = document.getElementById("customMinutes");
const blocksInfo = document.getElementById("blocksInfo");
const taskSelect = document.getElementById("taskSelect");
const roundDots = document.getElementById("roundDots");
const roundText = document.getElementById("roundText");
const studyInput = document.getElementById("pomoStudy");
const restInput = document.getElementById("pomoRest");
const longInput = document.getElementById("pomoLong");
const roundsInput = document.getElementById("pomoRounds");
const parkingInput = document.getElementById("parkingInput");
const todayCount = document.getElementById("todayCount");
const todayTime = document.getElementById("todayTime");
const sessionList = document.getElementById("sessionList");

// what is happening right now
let mode = "timer";           // "timer", "stopwatch" or "pomodoro"
let running = false;
let startedAt = 0;            // when the current run began (ms)
let savedMs = 0;              // time counted before the current run (ms)
let sessionStart = 0;         // when this session first started (shown in History)
let announcedBlocks = 0;      // Stopwatch: how many 25-minute blocks already rang
let tickId = null;

let timerMinutes = Number(localStorage.getItem("whimzyy-focus-timer")) || 25;

// Pomodoro
let phase = "focus";          // "focus", "short" (short break) or "long" (long break)
let round = 1;
const pomo = { study: 25, rest: 5, longRest: 15, rounds: 4 };

// 83 seconds becomes "01:23"
function formatTime(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? h + ":" + mm + ":" + ss : mm + ":" + ss;
}

// 4500 seconds becomes "1 h 15 min"
function formatDuration(totalSeconds) {
  const minutes = Math.round(totalSeconds / 60);
  if (minutes >= 60) {
    return Math.floor(minutes / 60) + " h " + (minutes % 60) + " min";
  }
  return minutes + " min";
}

// keeps a number between a minimum and a maximum
function clampNumber(value, min, max, fallback) {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(value)));
}

// how much time has been counted so far
function elapsed() {
  return savedMs + (running ? Date.now() - startedAt : 0);
}

// how long the current Timer or Pomodoro phase lasts
function targetMs() {
  if (mode === "timer") {
    return timerMinutes * 60000;
  }
  if (phase === "focus") {
    return pomo.study * 60000;
  }
  return (phase === "short" ? pomo.rest : pomo.longRest) * 60000;
}

function showStatus(text) {
  statusNote.textContent = text;
}

/* ===== 3. Sessions: saving, Today and History ===== */

const SESSIONS_KEY = "whimzyy-sessions";

// every session looks like { id, start, seconds, mode, task, completed }
function loadSessions() {
  try {
    return JSON.parse(localStorage.getItem(SESSIONS_KEY)) || [];
  } catch (error) {
    return [];
  }
}

function saveSessions(sessions) {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

// saves a session in History (sessions shorter than a minute are ignored)
function logSession(modeName, seconds, completed, task) {
  if (seconds < 60) {
    return false;
  }

  const sessions = loadSessions();
  sessions.unshift({
    id: Date.now(),
    start: sessionStart || Date.now() - seconds * 1000,
    seconds: Math.round(seconds),
    mode: modeName,
    task: task || "",
    completed: completed
  });
  saveSessions(sessions);

  if (window.Rewards) {
    Rewards.onSession("Focus · " + MODE_NAMES[modeName], seconds, completed);
  }
  
  renderSessions();
  return true;
}

function sameDay(a, b) {
  return a.toDateString() === b.toDateString();
}

// "Today", "Yesterday" or "Mon, 2 Nov"
function dayLabel(ms) {
  const date = new Date(ms);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (sameDay(date, today)) {
    return "Today";
  }
  if (sameDay(date, yesterday)) {
    return "Yesterday";
  }
  return date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

function renderSessions() {
  const sessions = loadSessions();
  const today = new Date();

  // today's numbers
  let count = 0;
  let seconds = 0;
  sessions.forEach(function (session) {
    if (sameDay(new Date(session.start), today)) {
      count += 1;
      seconds += session.seconds;
    }
  });
  todayCount.textContent = count;
  todayTime.textContent = formatDuration(seconds);

  // the history list (newest first)
  sessionList.textContent = "";

  sessions.forEach(function (session) {
    const li = document.createElement("li");
    li.className = "session";

    // day, time and delete button
    const top = document.createElement("div");
    top.className = "session-top";

    const when = document.createElement("p");
    when.className = "session-when";
    when.textContent = dayLabel(session.start) + " · " +
      new Date(session.start).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

    const del = document.createElement("button");
    del.type = "button";
    del.className = "session-delete";
    del.textContent = "✕";
    del.title = "Delete session";
    del.setAttribute("aria-label", "Delete session");
    del.addEventListener("click", function () {
      const rest = loadSessions().filter(function (other) {
        return other.id !== session.id;
      });
      saveSessions(rest);
      renderSessions();
    });

    top.append(when, del);

    // "Pomodoro · 25 min"
    const main = document.createElement("p");
    main.className = "session-main";
    main.textContent = MODE_NAMES[session.mode] + " · " + formatDuration(session.seconds);

    li.append(top, main);

    // the task it was for
    if (session.task) {
      const task = document.createElement("p");
      task.className = "session-task";
      task.textContent = session.task;
      li.appendChild(task);
    }

    // finished or stopped early
    const status = document.createElement("span");
    status.className = "session-status " + (session.completed ? "done" : "early");
    status.textContent = session.completed ? "Completed" : "Stopped early";
    li.appendChild(status);

    sessionList.appendChild(li);
  });
}

// if another tab changes the data, show the change here too
window.addEventListener("storage", function (event) {
  if (event.key === SESSIONS_KEY) {
    renderSessions();
  }
  if (event.key === "whimzyy-tasks") {
    fillTaskOptions();
  }
});

/* ===== 4. Drawing the ring and the page ===== */

// the ring and the numbers (this runs many times a second while counting)
function render() {
  const ms = elapsed();
  let text;
  let fraction;
  let label;

  if (mode === "stopwatch") {
    text = formatTime(Math.floor(ms / 1000));
    fraction = (ms % BLOCK_MS) / BLOCK_MS;       // starts again every 25 minutes
    label = "Stopwatch";
  } else {
    const total = targetMs();
    text = formatTime(Math.ceil(Math.max(0, total - ms) / 1000));
    fraction = Math.min(1, ms / total);
    label = (mode === "timer") ? "Timer" : PHASE_NAMES[phase];
  }

  dialTime.textContent = text;
  dialLabel.textContent = label;
  ringProgress.style.strokeDashoffset = RING_LENGTH * (1 - fraction);

  /* FIX 2: hide the ring completely while it is at 0%, so no small dot shows at the top */
  ringProgress.style.opacity = (fraction > 0) ? "1" : "0";

  dial.classList.toggle("break", mode === "pomodoro" && phase !== "focus");
}

function updateBlocks() {
  if (announcedBlocks === 0) {
    blocksInfo.textContent = "No full 25-minute block yet";
  } else {
    blocksInfo.textContent = announcedBlocks + " × 25 minutes done this session";
  }
}

function updateRounds() {
  roundDots.textContent = "";

  // dots before the current round are filled
  const doneCount = (phase === "focus") ? round - 1 : round;

  for (let i = 1; i <= pomo.rounds; i++) {
    const dot = document.createElement("span");
    dot.className = "round-dot";
    if (i <= doneCount) {
      dot.classList.add("done");
    } else if (i === round && phase === "focus") {
      dot.classList.add("current");
    }
    roundDots.appendChild(dot);
  }

  roundText.textContent = "Round " + round + " of " + pomo.rounds;

  if (phase === "focus") {
    nextUp.textContent = "Next: " + (round >= pomo.rounds
      ? pomo.longRest + "-minute long break"
      : pomo.rest + "-minute break");
  } else if (phase === "short") {
    nextUp.textContent = "Next: focus round " + (round + 1);
  } else {
    nextUp.textContent = "Next: a fresh start at round 1";
  }
}

// everything that changes when you press a button (not every tick)
function updateUI() {
  modeTabs.forEach(function (tab) {
    const active = tab.dataset.mode === mode;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", active);
  });

  // show only the parts that belong to this tool
  modeParts.forEach(function (part) {
    part.hidden = (part.dataset.show !== mode);
  });

  // the Start button changes its words
  if (running) {
    startBtn.textContent = "Pause";
  } else if (savedMs > 0) {
    startBtn.textContent = "Resume";
  } else if (mode === "pomodoro") {
    startBtn.textContent = (phase === "focus") ? "Start focus" : "Start break";
  } else {
    startBtn.textContent = "Start";
  }

  resetBtn.textContent = (mode === "stopwatch") ? "Save & reset" : "Reset";
  skipBtn.hidden = !(mode === "pomodoro" && phase !== "focus");

  // lengths can only be changed when nothing is in progress
  const locked = running || savedMs > 0;
  lockables.forEach(function (item) {
    item.disabled = locked;
  });

  if (mode === "pomodoro") {
    updateRounds();
  }
  if (mode === "stopwatch") {
    updateBlocks();
  }
}

/* ===== 5. Start, pause, reset ===== */

function stopTicking() {
  running = false;
  clearInterval(tickId);
}

function startTimer() {
  unlockAudio();

  // a brand new session begins
  if (savedMs === 0) {
    sessionStart = Date.now();
    announcedBlocks = 0;
  }

  showStatus("");
  startedAt = Date.now();
  running = true;
  tickId = setInterval(tick, 250);
}

function pauseTimer() {
  savedMs = elapsed();     // keep the time before stopping
  stopTicking();
}

// stops everything, saves what was done (if it was at least a minute), starts fresh
function resetSession() {
  const seconds = Math.floor(elapsed() / 1000);
  stopTicking();

  let saved = false;
  if (mode === "timer") {
    saved = logSession("timer", seconds, false, "");
  } else if (mode === "stopwatch") {
    saved = logSession("stopwatch", seconds, true, "");
  } else if (phase === "focus") {
    saved = logSession("pomodoro", seconds, false, taskSelect.value);
  }

  savedMs = 0;
  announcedBlocks = 0;
  if (mode === "pomodoro") {
    phase = "focus";
    round = 1;
  }
  return saved;
}

// Pomodoro: move on to the next phase (focus, break, focus, ... long break)
function advancePhase() {
  stopTicking();
  savedMs = 0;

  if (phase === "focus") {
    phase = (round >= pomo.rounds) ? "long" : "short";
  } else {
    round = (phase === "long") ? 1 : round + 1;
    phase = "focus";
  }
}

// the time is up for a Timer or a Pomodoro phase
function completePhase() {
  const total = targetMs();
  stopTicking();
  playAlert();

  if (mode === "timer") {
    logSession("timer", total / 1000, true, "");
    savedMs = 0;
    showStatus("Done! " + timerMinutes + " minutes complete. Nice work.");
  } else if (phase === "focus") {
    logSession("pomodoro", total / 1000, true, taskSelect.value);
    advancePhase();
    showStatus("Focus round done! Time for a break.");
  } else {
    advancePhase();
    showStatus("Break over. Ready for the next focus round?");
  }

  updateUI();
  render();
}

// runs every quarter of a second while counting
function tick() {
  const ms = elapsed();

  if (mode === "stopwatch") {
    // every 25 minutes: the ring starts again and the chime plays
    const blocks = Math.floor(ms / BLOCK_MS);
    if (blocks > announcedBlocks) {
      announcedBlocks = blocks;
      playAlert();
      showStatus("25 minutes done! The ring starts again.");
      updateBlocks();
    }
  } else if (ms >= targetMs()) {
    completePhase();
    return;
  }

  render();
}

/* ===== 6. Buttons and tabs ===== */

startBtn.addEventListener("click", function () {
  if (running) {
    pauseTimer();
  } else {
    startTimer();
  }
  updateUI();
  render();
});

resetBtn.addEventListener("click", function () {
  const saved = resetSession();
  showStatus(saved ? "Saved to your history." : "");
  updateUI();
  render();
});

skipBtn.addEventListener("click", function () {
  advancePhase();
  showStatus("");
  updateUI();
  render();
});

modeTabs.forEach(function (tab) {
  tab.addEventListener("click", function () {
    if (tab.dataset.mode === mode) {
      return;
    }
    if (running) {
      showStatus("Pause first, then switch tools.");
      return;
    }

    const saved = resetSession();
    mode = tab.dataset.mode;
    showStatus(saved ? "Your last session was saved to History." : "");
    updateUI();
    render();
  });
});

/* ===== 7. Timer: choose how long ===== */

function setTimerMinutes(minutes) {
  timerMinutes = minutes;
  localStorage.setItem("whimzyy-focus-timer", minutes);

  customInput.value = minutes;
  chips.forEach(function (chip) {
    chip.classList.toggle("active", Number(chip.dataset.minutes) === minutes);
  });
  render();
}

chips.forEach(function (chip) {
  chip.addEventListener("click", function () {
    setTimerMinutes(Number(chip.dataset.minutes));
  });
});

customInput.addEventListener("change", function () {
  setTimerMinutes(clampNumber(Number(customInput.value), 1, 300, timerMinutes));
});

/* ===== 8. Pomodoro: settings and task ===== */

// the focus and break minutes are shared with the Work Space timer
function loadPomodoroSettings() {
  try {
    const shared = JSON.parse(localStorage.getItem("whimzyy-pomodoro"));
    if (shared) {
      pomo.study = shared.study || 25;
      pomo.rest = shared.rest || 5;
    }
    const extra = JSON.parse(localStorage.getItem("whimzyy-pomodoro-extra"));
    if (extra) {
      pomo.longRest = extra.longRest || 15;
      pomo.rounds = extra.rounds || 4;
    }
  } catch (error) {
    // if something is unreadable, the normal numbers (25, 5, 15, 4) stay
  }
}

function savePomodoroSettings() {
  localStorage.setItem("whimzyy-pomodoro", JSON.stringify({ study: pomo.study, rest: pomo.rest }));
  localStorage.setItem("whimzyy-pomodoro-extra", JSON.stringify({ longRest: pomo.longRest, rounds: pomo.rounds }));
}

function showPomodoroInputs() {
  studyInput.value = pomo.study;
  restInput.value = pomo.rest;
  longInput.value = pomo.longRest;
  roundsInput.value = pomo.rounds;
}

function applyPomodoroSettings() {
  pomo.study = clampNumber(Number(studyInput.value), 1, 180, pomo.study);
  pomo.rest = clampNumber(Number(restInput.value), 1, 60, pomo.rest);
  pomo.longRest = clampNumber(Number(longInput.value), 1, 90, pomo.longRest);
  pomo.rounds = clampNumber(Number(roundsInput.value), 1, 8, pomo.rounds);

  if (round > pomo.rounds) {
    round = pomo.rounds;
  }

  showPomodoroInputs();
  savePomodoroSettings();
  updateUI();
  render();
}

[studyInput, restInput, longInput, roundsInput].forEach(function (input) {
  input.addEventListener("change", applyPomodoroSettings);
});

// fill the "Focusing on" list with the tasks that are not done yet
function fillTaskOptions() {
  const current = taskSelect.value;

  let tasks = [];
  try {
    tasks = JSON.parse(localStorage.getItem("whimzyy-tasks")) || [];
  } catch (error) {
    tasks = [];
  }

  taskSelect.textContent = "";
  taskSelect.add(new Option("No specific task", ""));

  tasks.forEach(function (task) {
    if (!task.done) {
      taskSelect.add(new Option(task.text, task.text));
    }
  });

  // keep the earlier choice if that task is still there
  taskSelect.value = current;
  if (taskSelect.value !== current) {
    taskSelect.selectedIndex = 0;
  }
}

taskSelect.addEventListener("focus", fillTaskOptions);

/* ===== 9. Parking lot (pauses the timer while you park a thought) ===== */

const parkingBtn = document.getElementById("parkingBtn");
const parkingDialog = document.getElementById("parkingDialog");
const parkingForm = document.getElementById("parkingForm");
const parkingCancel = document.getElementById("parkingCancel");
const parkingNote = document.getElementById("parkingNote");

const PARKING_KEY = "whimzyy-parking-notes";
let resumeAfterParking = false;   // should the timer start again when the box closes?
let justParked = false;           // was a thought saved this time?

// every parked thought looks like { id, text, created, task }
function loadParked() {
  try {
    const list = JSON.parse(localStorage.getItem(PARKING_KEY));
    return Array.isArray(list) ? list : [];
  } catch (error) {
    return [];
  }
}

// open the box: pause the timer if it is running
parkingBtn.addEventListener("click", function () {
  resumeAfterParking = running;
  if (running) {
    pauseTimer();
    updateUI();
    render();
  }

  parkingInput.value = "";
  parkingNote.textContent = "";
  parkingDialog.showModal();
  parkingInput.focus();
});

// Save
parkingForm.addEventListener("submit", function (event) {
  event.preventDefault();

  const value = parkingInput.value.trim();
  if (value === "") {
    parkingNote.textContent = "Write a little something first.";
    return;
  }

  const notes = loadParked();
  notes.unshift({ id: Date.now(), text: value, created: Date.now(), task: taskSelect.value });
  localStorage.setItem(PARKING_KEY, JSON.stringify(notes));

  justParked = true;
  parkingDialog.close();
});

// Cancel
parkingCancel.addEventListener("click", function () {
  parkingDialog.close();
});

// clear the little warning when you start typing
parkingInput.addEventListener("input", function () {
  parkingNote.textContent = "";
});

// Save, Cancel and the Esc key all end here: the message disappears and you go back to focus
parkingDialog.addEventListener("close", function () {
  parkingInput.value = "";

  if (resumeAfterParking) {
    resumeAfterParking = false;
    startTimer();
    updateUI();
    render();
  }

  showStatus(justParked ? "Parked. Back to focus." : "");
  justParked = false;
});

/* ===== 10. Start the page ===== */

/* FIX 3: the page needs these calls at the very end, so everything is drawn
   once when it opens (the ring starts empty, the lists are filled). */
loadPomodoroSettings();
showPomodoroInputs();
fillTaskOptions();
renderSessions();
setTimerMinutes(timerMinutes);   // fills the custom box, highlights the chip, draws the ring
updateUI();
render();