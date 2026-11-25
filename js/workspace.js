/* ===== 1. Sidebar panels ===== */

const sideItems = document.querySelectorAll(".side-item");

function closeAllPanels() {
  sideItems.forEach(function (item) {
    item.classList.remove("open");
    item.querySelector(".side-btn").setAttribute("aria-expanded", "false");
  });
}

sideItems.forEach(function (item) {
  const button = item.querySelector(".side-btn");

  // hovering a new icon closes a panel that was kept open by a click
  item.addEventListener("mouseenter", closeAllPanels);

  // clicking an icon keeps its panel open (or closes it)
  button.addEventListener("click", function () {
    const wasOpen = item.classList.contains("open");
    closeAllPanels();
    if (!wasOpen) {
      item.classList.add("open");
      button.setAttribute("aria-expanded", "true");
    }
  });

  // using something inside a panel (typing, sliding) keeps it open
  item.addEventListener("focusin", function (event) {
    if (event.target.closest(".panel")) {
      item.classList.add("open");
    }
  });
});

// clicking anywhere else closes the panels
document.addEventListener("click", function (event) {
  if (!event.target.closest(".side-item")) {
    closeAllPanels();
  }
});

// Escape closes them too
document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    closeAllPanels();
  }
});

/* ===== 2. Video switcher (the video list now lives in media.js) ===== */

const bgVideo = document.getElementById("bgVideo");
const videoThumb = document.getElementById("videoThumb");
const videoTitle = document.getElementById("videoTitle");
const videoPrev = document.getElementById("videoPrev");
const videoNext = document.getElementById("videoNext");

// start with the video chosen last time (on this page or on the Vibe page)
let videoIndex = Number(localStorage.getItem("whimzyy-video")) || 0;
if (videoIndex >= videos.length) {
  videoIndex = 0;
}

function showVideo(index) {
  videoIndex = (index + videos.length) % videos.length;
  const video = videos[videoIndex];

  bgVideo.src = video.src;
  bgVideo.play().catch(function () {});

  videoThumb.src = video.src + "#t=0.5";   // shows a still frame as the preview
  videoTitle.textContent = video.title;

  localStorage.setItem("whimzyy-video", videoIndex);
}

// (the previous / next buttons are connected further down, in stepVideo, so locked videos are skipped)

showVideo(videoIndex);

/* ===== 3. Ambience and Music (the lists now live in media.js) ===== */

// builds the option list and the player for one kind of sound
function setupSound(config) {
  const audio = new Audio();
  audio.loop = true;

  // volume = this slider x the master volume chosen on the Vibe page
  function applyVolume() {
    audio.volume = (config.volume.value / 100) * (loadVolumes().master / 100);
  }
  config.volume.value = loadVolumes()[config.group];
  applyVolume();

  // "None" first, then every sound in the list
  const choices = [{ name: "None", src: "" }].concat(config.list);
  const radios = [];

  choices.forEach(function (choice, i) {
    const label = document.createElement("label");
    label.className = "option";

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = config.group;
    radio.checked = (i === 0);
    radio.addEventListener("change", function () {
      choose(choice);
    });

    const text = document.createElement("span");
    text.textContent = choice.name;

    label.append(radio, text);
    config.options.appendChild(label);
    radios.push(radio);
  });

  function choose(choice) {
    config.note.textContent = "";

    if (choice.src === "") {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      return;
    }

    audio.src = choice.src;
    audio.play().catch(function (error) {
      if (error.name !== "AbortError") {
        config.note.textContent = "Couldn't play this one. Check the file name.";
      }
    });
  }

  // VIBE: the sound picked on the Vibe page is selected here but not started
  // (browsers only allow sound after a click, so "Play my vibe" starts it)
  const savedName = localStorage.getItem("whimzyy-" + config.group);
  const savedIndex = choices.findIndex(function (choice) {
    return choice.src !== "" && choice.name === savedName;
  });
  if (savedIndex !== -1) {
    radios[savedIndex].checked = true;
    audio.src = choices[savedIndex].src;
  }

  // volume slider: also saved, so Vibe and Work Space stay in step
  config.volume.addEventListener("input", function () {
    applyVolume();
    saveVolume(config.group, Number(config.volume.value));
  });

  return {
    hasSound: function () {
      return Boolean(audio.getAttribute("src"));
    },
    play: function () {
      audio.play().catch(function () {});
    }
  };
}

const ambiencePlayer = setupSound({
  list: ambienceList,
  group: "ambience",
  options: document.getElementById("ambienceOptions"),
  volume: document.getElementById("ambienceVolume"),
  note: document.getElementById("ambienceNote")
});

const musicPlayer = setupSound({
  list: musicList,
  group: "music",
  options: document.getElementById("musicOptions"),
  volume: document.getElementById("musicVolume"),
  note: document.getElementById("musicNote")
});

// "Play my vibe": appears only if the Vibe page chose a sound
const vibePlay = document.getElementById("vibePlay");

if (ambiencePlayer.hasSound() || musicPlayer.hasSound()) {
  vibePlay.hidden = false;
}

vibePlay.addEventListener("click", function () {
  ambiencePlayer.play();
  musicPlayer.play();
  vibePlay.hidden = true;
});

/* ===== 4. Timer ===== */

const timerDisplay = document.getElementById("timerDisplay");
const timerPhase = document.getElementById("timerPhase");
const timerToggle = document.getElementById("timerToggle");
const timerReset = document.getElementById("timerReset");
const modeTabs = document.querySelectorAll(".mode-tab");
const pomoSettings = document.getElementById("pomoSettings");
const studyInput = document.getElementById("studyMin");
const breakInput = document.getElementById("breakMin");
const wTimerDisplay = document.getElementById("wTimerDisplay");
const wTimerPhase = document.getElementById("wTimerPhase");
const wTimerToggle = document.getElementById("wTimerToggle");

let timerMode = "stopwatch";   // "stopwatch" or "pomodoro"
let phase = "study";           // pomodoro only: "study" or "break"
let running = false;
let startedAt = 0;             // when the current run began (ms)
let savedMs = 0;               // time counted before the current run (ms)
let studyMin = 25;
let breakMin = 5;
let timerId;
let rewardedBlocks = 0;        // stopwatch: how many 5-minute blocks already gave a star

/* Work Space time also goes into the shared sessions list (the same one Focus uses),
   so the Productivity page counts it. One run = one saved session, updated as it grows. */
const WS_SESSIONS_KEY = "whimzyy-sessions";
let wsSessionId = 0;           // 0 = this run is not saved yet
let wsSessionStart = 0;        // when this run began (ms)

function readSessions() {
  try {
    const list = JSON.parse(localStorage.getItem(WS_SESSIONS_KEY));
    return Array.isArray(list) ? list : [];
  } catch (error) {
    return [];
  }
}

// saves (or updates) the current run. Runs shorter than a minute are ignored, like on the Focus page.
function saveWsSession(seconds, completed) {
  seconds = Math.round(seconds);
  if (seconds < 60) { return; }

  const list = readSessions();
  const modeName = (timerMode === "pomodoro") ? "pomodoro" : "stopwatch";

  if (!wsSessionId) {
    wsSessionId = Date.now();
    list.unshift({
      id: wsSessionId,
      start: wsSessionStart || Date.now() - seconds * 1000,
      seconds: seconds,
      mode: modeName,
      task: "",
      completed: completed,
      source: "workspace"
    });
  } else {
    const found = list.find(function (item) { return item.id === wsSessionId; });
    if (found) {
      found.seconds = seconds;
      found.completed = completed;
    } else {
      wsSessionId = 0;                 // it was deleted on the Focus page: start a new one next time
      return saveWsSession(seconds, completed);
    }
  }

  try {
    localStorage.setItem(WS_SESSIONS_KEY, JSON.stringify(list));
  } catch (error) {
    // storage full: the session just won't show on Productivity
  }
}

// something worth saving is running (stopwatch, or the study part of a pomodoro)
function countsAsFocus() {
  return timerMode === "stopwatch" || phase === "study";
}

// load the study and break minutes saved last time
try {
  const saved = JSON.parse(localStorage.getItem("whimzyy-pomodoro"));
  if (saved) {
    studyMin = saved.study || 25;
    breakMin = saved.rest || 5;
  }
} catch (error) {
  studyMin = 25;
  breakMin = 5;
}
studyInput.value = studyMin;
breakInput.value = breakMin;

// length of the current pomodoro phase, in milliseconds
function phaseLength() {
  return (phase === "study" ? studyMin : breakMin) * 60000;
}

// how much time has been counted so far
function elapsedMs() {
  return savedMs + (running ? Date.now() - startedAt : 0);
}

// 83 seconds becomes "01:23"
function formatTime(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? h + ":" + mm + ":" + ss : mm + ":" + ss;
}

// work out what to show, and switch phase when time is up
function updateTimer() {
  let ms = elapsedMs();
  let text;
  let label;

    if (timerMode === "pomodoro") {
    if (ms >= phaseLength()) {
      if (phase === "study") {
        saveWsSession(studyMin * 60, true);
        wsSessionId = 0;
        if (window.Rewards) {
          Rewards.onSession("Work Space · Pomodoro", studyMin * 60, true);
        }
      }
      phase = (phase === "study") ? "break" : "study";
      if (phase === "study") { wsSessionStart = Date.now(); }
      savedMs = 0;
      startedAt = Date.now();
      ms = 0;
    }
    text = formatTime(Math.ceil((phaseLength() - ms) / 1000));
    label = (phase === "study") ? "Study time" : "Break time";
  } else {
    const blocks = Math.floor(ms / 300000);          // 300000 ms = 5 minutes
    if (blocks > rewardedBlocks) {
      if (window.Rewards) {
        Rewards.onSession("Work Space · Stopwatch", (blocks - rewardedBlocks) * 300, false);
      }
      rewardedBlocks = blocks;
      saveWsSession(ms / 1000, true);
    }
    text = formatTime(Math.floor(ms / 1000));
    label = "Stopwatch";
  }

  timerDisplay.textContent = text;
  wTimerDisplay.textContent = text;
  timerPhase.textContent = label;
  wTimerPhase.textContent = label;
}

function setButtons(text) {
  timerToggle.textContent = text;
  wTimerToggle.textContent = text;
}

function startTimer() {
  if (savedMs === 0) {
    wsSessionId = 0;
    wsSessionStart = Date.now();
  }
  running = true;
  startedAt = Date.now();
  timerId = setInterval(updateTimer, 250);
  setButtons("Pause");
}

function pauseTimer() {
  savedMs = elapsedMs();   // save the time before stopping
  running = false;
  clearInterval(timerId);
  setButtons("Start");
  if (countsAsFocus()) { saveWsSession(savedMs / 1000, timerMode === "stopwatch"); }
}

function resetTimer() {
  const secondsDone = Math.floor(elapsedMs() / 1000);
  if (countsAsFocus() && secondsDone >= 60) {
    saveWsSession(secondsDone, timerMode === "stopwatch");

    // stopwatch: stars for the minutes after the last full 5-minute block
    const leftover = secondsDone - rewardedBlocks * 300;
    if (timerMode === "stopwatch" && leftover >= 60 && window.Rewards) {
      Rewards.onSession("Work Space · Stopwatch", leftover, true);
    }
  }
  wsSessionId = 0;
  clearInterval(timerId);
  running = false;
  savedMs = 0;
  rewardedBlocks = 0;
  phase = "study";
  setButtons("Start");
  updateTimer();
}

function toggleTimer() {
  if (running) {
    pauseTimer();
  } else {
    startTimer();
  }
}

timerToggle.addEventListener("click", toggleTimer);
wTimerToggle.addEventListener("click", toggleTimer);
timerReset.addEventListener("click", resetTimer);

// switching between Stopwatch and Pomodoro
modeTabs.forEach(function (tab) {
  tab.addEventListener("click", function () {
    resetTimer();                    // saves the run that was going, under the tool it belonged to
    timerMode = tab.dataset.mode;
    modeTabs.forEach(function (t) {
      t.classList.toggle("active", t === tab);
    });
    pomoSettings.hidden = (timerMode !== "pomodoro");
    resetTimer();
  });
});

// changing the study and break minutes
function readSettings() {
  const study = Number(studyInput.value);
  const rest = Number(breakInput.value);
  if (study >= 1) { studyMin = study; }
  if (rest >= 1) { breakMin = rest; }
  localStorage.setItem("whimzyy-pomodoro", JSON.stringify({ study: studyMin, rest: breakMin }));
  if (!running) { updateTimer(); }
}

studyInput.addEventListener("change", readSettings);
breakInput.addEventListener("change", readSettings);

updateTimer();

// moves to the next video you own (locked ones are skipped)
function stepVideo(direction) {
  for (let i = 1; i <= videos.length; i++) {
    const index = (((videoIndex + direction * i) % videos.length) + videos.length) % videos.length;
    if (!window.Rewards || Rewards.isOwned("bg", index)) {
      showVideo(index);
      return;
    }
  }
}

videoPrev.addEventListener("click", function () { stepVideo(-1); });
videoNext.addEventListener("click", function () { stepVideo(1); });

// leaving the page (or locking the phone) while the timer runs: keep what was done so far
function saveRunningSession() {
  if (running && countsAsFocus()) {
    saveWsSession(elapsedMs() / 1000, timerMode === "stopwatch");
  }
}
window.addEventListener("pagehide", saveRunningSession);
document.addEventListener("visibilitychange", function () {
  if (document.visibilityState === "hidden") { saveRunningSession(); }
});
