/* ===== 0. Shared things (used by more than one section) ===== */

// today's date as YYYY-MM-DD, used in the saved names (same idea as home.js)
const todayKey = new Date().toLocaleDateString("en-CA");

// the little pop-up message at the bottom of the window
const toast = document.getElementById("toast");
let toastTimer;

// show a message for 6 seconds, then hide it again
function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;

  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () {
    toast.hidden = true;
  }, 6000);
}


/* ===== 1. Check-in: mood and energy (remembered for each day) ===== */

const moodButtons = document.querySelectorAll(".mood-btn");
const energyButtons = document.querySelectorAll(".energy-btn");
const checkinNote = document.getElementById("checkinNote");

// IMPORTANT: this name must be the same one my-day.js uses for the mood,
// so both pages share one mood. Open myday.js and match it.
const moodKey = "whimzyy-mood-" + todayKey;
const energyKey = "whimzyy-energy-" + todayKey;

let moodNow = localStorage.getItem(moodKey);        // for example "slay" (or null)
let energyNow = localStorage.getItem(energyKey);    // for example "3" (or null)

// mark the chosen button as pressed, and un-press the rest
function markPressed(buttons, attribute, chosen) {
  buttons.forEach(function (button) {
    const isChosen = button.dataset[attribute] === chosen;
    button.setAttribute("aria-pressed", isChosen ? "true" : "false");
  });
}

// write a gentle line that fits what was picked
function updateCheckinNote() {
  if (energyNow !== null && Number(energyNow) <= 2) {
    checkinNote.textContent = "Low energy? Try a stretch or a glass of water.";
  } else if (moodNow === "dead" || moodNow === "complicated") {
    checkinNote.textContent = "Rough one. A few slow breaths can help.";
  } else if (moodNow !== null || energyNow !== null) {
    checkinNote.textContent = "Checked in. Nice one.";
  } else {
    checkinNote.textContent = "Pick what fits right now.";
  }
}

// clicking a mood
moodButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    moodNow = button.dataset.mood;
    localStorage.setItem(moodKey, moodNow);
    markPressed(moodButtons, "mood", moodNow);
    updateCheckinNote();
  });
});

// clicking an energy number
energyButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    energyNow = button.dataset.energy;
    localStorage.setItem(energyKey, energyNow);
    markPressed(energyButtons, "energy", energyNow);
    updateCheckinNote();
  });
});

// when the page opens, show what was already picked today
markPressed(moodButtons, "mood", moodNow);
markPressed(energyButtons, "energy", energyNow);
updateCheckinNote();


/* ===== 2. Breathing ===== */

const breathCircle = document.getElementById("breathCircle");
const breathText = document.getElementById("breathText");
const breathBtn = document.getElementById("breathBtn");
const patternChips = document.querySelectorAll("#patternChips .chip");

// each pattern is a list of phases: the words, how many seconds, and how big the circle gets
const patterns = {
  calm: [
    { text: "Breathe in...", seconds: 4, scale: 1.6 },
    { text: "Breathe out...", seconds: 6, scale: 1 }
  ],
  box: [
    { text: "Breathe in...", seconds: 4, scale: 1.6 },
    { text: "Hold...", seconds: 4, scale: 1.6 },
    { text: "Breathe out...", seconds: 4, scale: 1 },
    { text: "Hold...", seconds: 4, scale: 1 }
  ],
  quick: [
    { text: "Breathe in...", seconds: 3, scale: 1.6 },
    { text: "Breathe out...", seconds: 3, scale: 1 }
  ]
};

let patternName = "calm";   // which pattern is chosen
let breathing = false;      // is the circle running right now?
let phaseIndex = 0;         // which phase of the pattern we are in
let breathTimer;            // will hold the timer for the next phase

// run one phase, then call itself for the next one
function runPhase() {
  const phase = patterns[patternName][phaseIndex];

  breathText.textContent = phase.text;
  breathCircle.style.transitionDuration = phase.seconds + "s";
  breathCircle.style.transform = "scale(" + phase.scale + ")";

  breathTimer = setTimeout(function () {
    phaseIndex = (phaseIndex + 1) % patterns[patternName].length;
    runPhase();
  }, phase.seconds * 1000);
}

function startBreathing() {
  breathing = true;
  phaseIndex = 0;
  breathBtn.textContent = "Stop";
  runPhase();
}

function stopBreathing() {
  breathing = false;
  clearTimeout(breathTimer);

  breathCircle.style.transitionDuration = "0.6s";
  breathCircle.style.transform = "scale(1)";
  breathText.textContent = "Ready when you are";
  breathBtn.textContent = "Start";
}

// Start / Stop button
breathBtn.addEventListener("click", function () {
  if (breathing) {
    stopBreathing();
  } else {
    startBreathing();
  }
});

// pattern chips: switch pattern (and restart if it was running)
patternChips.forEach(function (chip) {
  chip.addEventListener("click", function () {
    patternName = chip.dataset.pattern;

    patternChips.forEach(function (other) {
      other.classList.toggle("active", other === chip);
    });

    if (breathing) {
      stopBreathing();
      startBreathing();
    }
  });
});


/* ===== 3. Stretch ===== */

const stretchEmoji = document.getElementById("stretchEmoji");
const stretchName = document.getElementById("stretchName");
const stretchDesc = document.getElementById("stretchDesc");
const stretchTime = document.getElementById("stretchTime");
const stretchStart = document.getElementById("stretchStart");
const stretchNext = document.getElementById("stretchNext");
const stretchList = document.getElementById("stretchList");

const stretches = [
  { emoji: "🙆", name: "Neck",      seconds: 30, desc: "Tilt your head to one side and hold. Switch halfway." },
  { emoji: "🤷", name: "Shoulders", seconds: 30, desc: "Lift your shoulders to your ears, then let them drop." },
  { emoji: "🙌", name: "Wrists",    seconds: 30, desc: "Arms out, palms up, then down. Gently circle your wrists." },
  { emoji: "🧘", name: "Back",      seconds: 40, desc: "Sit tall, twist slowly to one side, then the other." },
  { emoji: "👀", name: "Eyes",      seconds: 30, desc: "Look away from the screen at something far away." }
];

let stretchIndex = 0;       // which stretch is showing
let stretchLeft = 0;        // seconds left on the countdown
let stretchRunning = false;
let stretchTimer;           // will hold the countdown timer

// show the current stretch and highlight it in the list
function showStretch() {
  const s = stretches[stretchIndex];

  stretchEmoji.textContent = s.emoji;
  stretchName.textContent = s.name;
  stretchDesc.textContent = s.desc;
  stretchLeft = s.seconds;
  stretchTime.textContent = stretchLeft + "s";

  document.querySelectorAll(".stretch-list button").forEach(function (button, i) {
    button.classList.toggle("current", i === stretchIndex);
  });
}

// stop the countdown (without changing which stretch is showing)
function stopStretchTimer() {
  clearInterval(stretchTimer);
  stretchRunning = false;
  stretchStart.textContent = "Start";
}

// count down one second at a time
function startStretchTimer() {
  stretchRunning = true;
  stretchStart.textContent = "Pause";

  stretchTimer = setInterval(function () {
    stretchLeft = stretchLeft - 1;
    stretchTime.textContent = stretchLeft + "s";

    if (stretchLeft <= 0) {
      stopStretchTimer();
      stretchTime.textContent = "Done!";
    }
  }, 1000);
}

// build the list of stretches
stretches.forEach(function (s, i) {
  const li = document.createElement("li");
  const button = document.createElement("button");

  button.type = "button";
  button.textContent = s.emoji + "  " + s.name;

  button.addEventListener("click", function () {
    stopStretchTimer();
    stretchIndex = i;
    showStretch();
  });

  li.appendChild(button);
  stretchList.appendChild(li);
});

// Start / Pause
stretchStart.addEventListener("click", function () {
  if (stretchRunning) {
    stopStretchTimer();
  } else {
    // if the last one finished, start it again from the top
    if (stretchLeft <= 0) {
      showStretch();
    }
    startStretchTimer();
  }
});

// Next: go to the following stretch (and back to the first after the last)
stretchNext.addEventListener("click", function () {
  stopStretchTimer();
  stretchIndex = (stretchIndex + 1) % stretches.length;
  showStretch();
});

showStretch();


/* ===== 4. Water (remembered for each day) ===== */

const glassesBox = document.getElementById("glasses");
const waterCount = document.getElementById("waterCount");
const waterPlus = document.getElementById("waterPlus");
const waterMinus = document.getElementById("waterMinus");

const waterGoal = 8;
const waterKey = "whimzyy-water-" + todayKey;

// how many glasses so far today (0 if nothing saved)
let glassesDrunk = Number(localStorage.getItem(waterKey)) || 0;

// build the 8 glasses once
for (let i = 0; i < waterGoal; i++) {
  const glass = document.createElement("button");

  glass.type = "button";
  glass.className = "glass";
  glass.textContent = "💧";
  glass.setAttribute("aria-label", "Glass " + (i + 1));

  // clicking a glass fills up to it (click the last full one to empty it)
  glass.addEventListener("click", function () {
    if (glassesDrunk === i + 1) {
      glassesDrunk = i;
    } else {
      glassesDrunk = i + 1;
    }
    updateWater();
  });

  glassesBox.appendChild(glass);
}

// save the number and redraw the glasses and the counter
function updateWater() {
  localStorage.setItem(waterKey, glassesDrunk);

  document.querySelectorAll(".glass").forEach(function (glass, i) {
    glass.classList.toggle("full", i < glassesDrunk);
  });

  waterCount.textContent = glassesDrunk + " / " + waterGoal;
}

waterPlus.addEventListener("click", function () {
  if (glassesDrunk < waterGoal) {
    glassesDrunk = glassesDrunk + 1;
    updateWater();
  }
});

waterMinus.addEventListener("click", function () {
  if (glassesDrunk > 0) {
    glassesDrunk = glassesDrunk - 1;
    updateWater();
  }
});

updateWater();


/* ===== 5. Reminders ===== */

/* The clock that makes reminders go off lives in js/reminders.js (rewards.js loads it on every page),
   so reminders keep working on other pages and tabs too.
   This part only: shows the saved choices, saves new ones, asks for pop-up permission, and has a Test button. */

const reminderKey = "whimzyy-reminders";
const reminderNames = ["water", "stretch", "rest"];

// load the saved settings, or start with everything off
let reminderSettings = JSON.parse(localStorage.getItem(reminderKey)) || {};
reminderNames.forEach(function (name) {
  if (!reminderSettings[name]) {
    reminderSettings[name] = { on: false, every: name === "rest" ? 30 : 45 };
  }
});

const permissionNote = document.getElementById("permissionNote");
const permissionBtn = document.getElementById("permissionBtn");

// tell the person if desktop pop-ups are on
function updatePermissionNote() {
  if (!permissionNote || !window.Reminders) { return; }

  const state = Reminders.permission();
  permissionBtn.hidden = state !== "default";

  if (state === "granted") {
    permissionNote.textContent = "Pop-ups are on. You will see reminders even on other tabs.";
  } else if (state === "denied") {
    permissionNote.textContent = "Pop-ups are blocked. Click the lock next to the address, set Notifications to Allow, then refresh. Reminders still show inside Whimzyy.";
  } else if (state === "unsupported") {
    permissionNote.textContent = "This browser has no pop-ups. Reminders show inside Whimzyy.";
  } else {
    permissionNote.textContent = "Turn on pop-ups to see reminders even when Whimzyy is in another tab.";
  }
}

// connect each checkbox and dropdown
reminderNames.forEach(function (name) {
  const checkbox = document.getElementById("remind-" + name);
  const select = document.getElementById("every-" + name);
  const left = document.getElementById("left-" + name);

  // show the saved settings
  checkbox.checked = reminderSettings[name].on;
  select.value = reminderSettings[name].every;

  // when the switch or the dropdown changes: save, restart that clock, ask for pop-ups
  function onChange() {
    reminderSettings[name].on = checkbox.checked;
    reminderSettings[name].every = Number(select.value);
    localStorage.setItem(reminderKey, JSON.stringify(reminderSettings));

    if (window.Reminders) {
      Reminders.restart(name);
      if (checkbox.checked) { Reminders.ask().then(updatePermissionNote); }
    }
    showLeft();
  }

  checkbox.addEventListener("change", onChange);
  select.addEventListener("change", onChange);
});

// "next in 12 min" next to each reminder that is on
function showLeft() {
  reminderNames.forEach(function (name) {
    const left = document.getElementById("left-" + name);
    if (!left) { return; }

    const minutes = window.Reminders ? Reminders.timeLeft(name) : null;
    left.textContent = reminderSettings[name].on && minutes !== null
      ? "next in " + (minutes < 1 ? "<1" : minutes) + " min"
      : "";
  });
}

// the Test button
const testBtn = document.getElementById("reminderTest");
if (testBtn) {
  testBtn.addEventListener("click", function () {
    if (!window.Reminders) { return; }
    Reminders.ask().then(updatePermissionNote);
    Reminders.test("water");
  });
}

if (permissionBtn) {
  permissionBtn.addEventListener("click", function () {
    Reminders.ask().then(updatePermissionNote);
  });
}

// reminders.js loads a moment after the page: wait for it, then refresh the notes
const waitForReminders = setInterval(function () {
  if (window.Reminders) {
    clearInterval(waitForReminders);
    updatePermissionNote();
    showLeft();
  }
}, 200);
setInterval(showLeft, 15000);
