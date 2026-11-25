/* ===== 1. The four ready-made vibes ===== */

// each one sets a theme, a Work Space background, an ambience and a music (an empty "" means None)
const QUICK_VIBES = [
  { name: "Velvet Core", theme: "wine", video: "Cozy Cafe", ambience: "Birds", music: "Warm & Cozy" },
  { name: "Thunder Lore", theme: "plum", video: "London - Rainy Era", ambience: "Rain", music: "" },
  { name: "Ferny Arc", theme: "moss", video: "Hogwards Library", ambience: "Birds", music: "Gothic Choir" },
  { name: "Nocturne Grind", theme: "navy", video: "Miami - Cobalt Night", ambience: "Rain", music: "Chill Lo-fi" },
  { name: "Ember and Chorus", theme: "rose", video: "Stormy Fireplace", ambience: "Fireplace", music: "Gothic Choir" }
];

/* ===== 2. Page elements and the current choices ===== */

const vibeSummary = document.getElementById("vibeSummary");
const quickList = document.getElementById("quickList");
const themeList = document.getElementById("themeList");
const bgGrid = document.getElementById("bgGrid");
const ambienceChips = document.getElementById("ambienceChips");
const musicChips = document.getElementById("musicChips");
const resetVibe = document.getElementById("resetVibe");
const testChime = document.getElementById("testChime");

const sliders = {
  master: document.getElementById("volMaster"),
  ambience: document.getElementById("volAmbience"),
  music: document.getElementById("volMusic"),
  chime: document.getElementById("volChime")
};

const sliderTexts = {
  master: document.getElementById("valMaster"),
  ambience: document.getElementById("valAmbience"),
  music: document.getElementById("valMusic"),
  chime: document.getElementById("valChime")
};

let currentTheme = localStorage.getItem(THEME_KEY) || "wine";
if (!THEMES[currentTheme]) {
  currentTheme = "wine";
}

let currentVideo = Number(localStorage.getItem("whimzyy-video")) || 0;
if (currentVideo >= videos.length) {
  currentVideo = 0;
}

let currentAmbience = localStorage.getItem("whimzyy-ambience") || "";
let currentMusic = localStorage.getItem("whimzyy-music") || "";
let volumes = loadVolumes();

// save the four choices (Work Space reads the same names)
function saveChoices() {
  localStorage.setItem(THEME_KEY, currentTheme);
  localStorage.setItem("whimzyy-video", currentVideo);
  localStorage.setItem("whimzyy-ambience", currentAmbience);
  localStorage.setItem("whimzyy-music", currentMusic);
}

/* ===== 3. Sound previews (a short taste of a sound when you pick it) ===== */

const previews = { ambience: new Audio(), music: new Audio() };
const previewTimers = {};

// a sound's loudness = its own slider x the master slider
function previewVolume(kind) {
  return (volumes[kind] / 100) * (volumes.master / 100);
}

function preview(kind, item) {
  const audio = previews[kind];
  clearTimeout(previewTimers[kind]);

  if (item.src === "") {
    audio.pause();
    return;
  }

  audio.src = item.src;
  audio.volume = previewVolume(kind);
  audio.play().catch(function () {});

  // stop after 5 seconds
  previewTimers[kind] = setTimeout(function () {
    audio.pause();
  }, 5000);
}

function stopPreviews() {
  ["ambience", "music"].forEach(function (kind) {
    clearTimeout(previewTimers[kind]);
    previews[kind].pause();
  });
}

/* ===== 4. Building the page ===== */

// a strip of four color squares taken from a theme
function makeStrip(themeId) {
  const strip = document.createElement("span");
  strip.className = "swatch-strip";

  ["dark-cherry-red", "marron-red", "wine", "bright-deep-yellow"].forEach(function (variable) {
    const square = document.createElement("span");
    square.style.backgroundColor = THEMES[themeId].colors[variable];
    strip.appendChild(square);
  });

  return strip;
}

// themes
const themeButtons = {};

Object.keys(THEMES).forEach(function (id) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "theme-btn";

  const name = document.createElement("span");
  name.className = "theme-name";
  name.textContent = THEMES[id].name;

  const check = document.createElement("span");
  check.className = "theme-check";
  check.textContent = "✓";

  button.append(makeStrip(id), name, check);

  button.addEventListener("click", function () {
    if (!Rewards.require("theme", id)) {
      return;                // STARS: locked, so the shop opens on this theme
    }
    currentTheme = id;
    applyTheme(id);          // the whole page repaints right now
    saveChoices();
    updateSelected();
  });

  themeList.appendChild(button);
  themeButtons[id] = button;
});

// background thumbnails (a still frame from each video)
const bgButtons = [];

videos.forEach(function (video, i) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "bg-btn";
  button.title = video.title;

  const thumb = document.createElement("video");
  thumb.className = "bg-thumb";
  thumb.muted = true;
  thumb.preload = "metadata";
  thumb.playsInline = true;
  thumb.src = video.src + "#t=0.5";

  const name = document.createElement("span");
  name.className = "bg-name";
  name.textContent = video.title;

  button.append(thumb, name);

  button.addEventListener("click", function () {
    if (!Rewards.require("bg", i)) {
      return;                // STARS: locked, so the shop opens on this background
    }
    currentVideo = i;
    saveChoices();
    updateSelected();
  });

  bgGrid.appendChild(button);
  bgButtons.push(button);
});

// sound chips: None first, then every sound in the list
function buildChips(box, list, kind) {
  const entries = [];

  [{ name: "None", src: "" }].concat(list).forEach(function (item) {
    const value = (item.src === "") ? "" : item.name;

    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = item.name;

    chip.addEventListener("click", function () {
      if (kind === "ambience") {
        currentAmbience = value;
      } else {
        currentMusic = value;
      }
      saveChoices();
      updateSelected();
      preview(kind, item);
    });

    box.appendChild(chip);
    entries.push({ chip: chip, value: value });
  });

  return entries;
}

const ambienceEntries = buildChips(ambienceChips, ambienceList, "ambience");
const musicEntries = buildChips(musicChips, musicList, "music");

// quick vibes
const quickButtons = [];

QUICK_VIBES.forEach(function (quick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "quick-btn";

  const name = document.createElement("span");
  name.className = "quick-name";
  name.textContent = quick.name;

  const info = document.createElement("span");
  info.className = "quick-info";
  info.textContent = THEMES[quick.theme].name + " · " + quick.video + " · " +
    (quick.ambience || "no ambience") + " · " + (quick.music || "no music");

  button.append(name, makeStrip(quick.theme), info);

  button.addEventListener("click", function () {
    applyQuick(quick);
  });

  quickList.appendChild(button);
  quickButtons.push({ button: button, quick: quick });
});

/* ===== 5. Choosing things ===== */

// does this quick vibe match what is chosen right now?
function matchesQuick(quick) {
  return quick.theme === currentTheme &&
    quick.video === videos[currentVideo].title &&
    quick.ambience === currentAmbience &&
    quick.music === currentMusic;
}

// the position of a quick vibe's video in the videos list (-1 if there is no such title)
function quickVideoIndex(quick) {
  return videos.findIndex(function (video) {
    return video.title === quick.video;
  });
}

function applyQuick(quick) {
  const index = quickVideoIndex(quick);

  // STARS: if its theme or its background is still locked, the shop opens instead
  if (!Rewards.require("theme", quick.theme)) {
    return;
  }
  if (index !== -1 && !Rewards.require("bg", index)) {
    return;
  }

  currentTheme = quick.theme;
  applyTheme(currentTheme);

  if (index !== -1) {
    currentVideo = index;
  }

  currentAmbience = quick.ambience;
  currentMusic = quick.music;

  stopPreviews();
  saveChoices();
  updateSelected();
}

// marks the chosen items and rewrites the summary line
function updateSelected() {

  // STARS: locked themes, backgrounds and quick vibes get a lock
  Object.keys(themeButtons).forEach(function (id) {
    themeButtons[id].classList.toggle("locked", !Rewards.isOwned("theme", id));
  });

  bgButtons.forEach(function (button, i) {
    button.classList.toggle("locked", !Rewards.isOwned("bg", i));
  });

  quickButtons.forEach(function (entry) {
    const index = quickVideoIndex(entry.quick);
    entry.button.classList.toggle("locked",
      !Rewards.isOwned("theme", entry.quick.theme) ||
      (index !== -1 && !Rewards.isOwned("bg", index)));
  });

  // the normal marks
  Object.keys(themeButtons).forEach(function (id) {
    themeButtons[id].classList.toggle("selected", id === currentTheme);
  });

  bgButtons.forEach(function (button, i) {
    button.classList.toggle("selected", i === currentVideo);
  });

  ambienceEntries.forEach(function (entry) {
    entry.chip.classList.toggle("selected", entry.value === currentAmbience);
  });

  musicEntries.forEach(function (entry) {
    entry.chip.classList.toggle("selected", entry.value === currentMusic);
  });

  quickButtons.forEach(function (entry) {
    entry.button.classList.toggle("selected", matchesQuick(entry.quick));
  });

  vibeSummary.textContent = "Right now: " + THEMES[currentTheme].name + " · " +
    videos[currentVideo].title + " · " +
    (currentAmbience || "no ambience") + " · " +
    (currentMusic || "no music");
}

/* ===== 6. Volumes ===== */

function showVolumes() {
  Object.keys(sliders).forEach(function (name) {
    sliders[name].value = volumes[name];
    sliderTexts[name].textContent = volumes[name] + "%";
  });
}

Object.keys(sliders).forEach(function (name) {
  sliders[name].addEventListener("input", function () {
    volumes[name] = Number(sliders[name].value);
    sliderTexts[name].textContent = volumes[name] + "%";
    saveVolume(name, volumes[name]);

    // a preview that is playing follows the slider
    previews.ambience.volume = previewVolume("ambience");
    previews.music.volume = previewVolume("music");
  });
});

// the Test button plays the same soft chime the Focus timer uses
let chimeContext = null;

testChime.addEventListener("click", function () {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return;
  }
  if (!chimeContext) {
    chimeContext = new AudioContextClass();
  }
  if (chimeContext.state === "suspended") {
    chimeContext.resume();
  }

  const level = Math.max(0.0001, 0.25 * (volumes.chime / 100) * (volumes.master / 100));
  const notes = [659.25, 783.99, 1046.5, 783.99];
  const begin = chimeContext.currentTime + 0.05;

  notes.forEach(function (frequency, i) {
    const osc = chimeContext.createOscillator();
    const gain = chimeContext.createGain();
    const t = begin + i * 0.5;

    osc.type = "sine";
    osc.frequency.value = frequency;

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(level, t + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.48);

    osc.connect(gain);
    gain.connect(chimeContext.destination);
    osc.start(t);
    osc.stop(t + 0.5);
  });
});

/* ===== 7. Reset ===== */

resetVibe.addEventListener("click", function () {
  [THEME_KEY, "whimzyy-video", "whimzyy-ambience", "whimzyy-music", VOLUME_KEY].forEach(function (key) {
    localStorage.removeItem(key);
  });

  currentTheme = "wine";
  currentVideo = 0;
  currentAmbience = "";
  currentMusic = "";
  volumes = loadVolumes();

  applyTheme(currentTheme);
  stopPreviews();
  showVolumes();
  updateSelected();
});

/* ===== 8. Start the page ===== */

showVolumes();
updateSelected();

// STARS: unlocking something in the shop updates the locks on this page
window.addEventListener("rewards:change", updateSelected);