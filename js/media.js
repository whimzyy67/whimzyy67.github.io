/* Shared by the Vibe page and the Work Space page: the video and sound lists,
   and the saved volumes. Both pages live in the html folder, so every path starts with ../ */

const videos = [
  { title: "Thunder Woods", src: "../videos/Thunder Woods.mp4" },
  { title: "London - Rainy Era", src: "../videos/London-Rainy Era.mp4" },
  { title: "Miami - Cobalt Night", src: "../videos/Miami - Cobalt Night.mp4" },
  { title: "Sci-Fi Capsule", src: "../videos/Sci-Fi capsule.mp4" },
  { title: "Daylight Library", src: "../videos/Daylight library.mp4" },
  { title: "Cathedral Window", src: "../videos/Cathedral Window.mp4" },
  { title: "Hogwards Library", src: "../videos/Hogwards Library.mp4" },
  { title: "Autumn Cafe Haze", src: "../videos/Cafe.mp4" },
  { title: "Minecraft - Daylight", src: "../videos/minecraft-I.mp4" },
  { title: "Minecraft - Stormy Night", src: "../videos/minecraft-II.mp4" }
];

const ambienceList = [
  { name: "Rain", src: "../audio/ambience/rain.mp3" },
  { name: "Fireplace", src: "../audio/ambience/fireplace.mp3" },
  { name: "Birds", src: "../audio/ambience/birds.mp3" },
  { name: "Church bells", src: "../audio/ambience/church bells.mp3" },
  { name: "Keyboard Sounds", src: "../audio/ambience/keyboard sounds.mp3" }
];

const musicList = [
  { name: "Warm & Cozy", src: "../audio/music/Cozy Jazz.mp3" },
  { name: "Cafe Jazz", src: "../audio/music/Cafe Jazz.mp3" },
  { name: "Chill Lo-fi", src: "../audio/music/Chill Lo-fi.mp3" },
  { name: "Dark Academia", src: "../audio/music/Dark Academia.mp3" },
  { name: "Gothic Choir", src: "../audio/music/Gothic Choir.mp3" }
];

/* ----- volumes (0 to 100) ----- */

const VOLUME_KEY = "whimzyy-volumes";
const DEFAULT_VOLUMES = { master: 100, ambience: 60, music: 60, chime: 100 };

// the saved volumes, with the normal numbers filling any gap
function loadVolumes() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(VOLUME_KEY)) || {};
  } catch (error) {
    saved = {};
  }
  return Object.assign({}, DEFAULT_VOLUMES, saved);
}

// saves one volume without touching the others
function saveVolume(name, value) {
  const volumes = loadVolumes();
  volumes[name] = value;
  localStorage.setItem(VOLUME_KEY, JSON.stringify(volumes));
}
