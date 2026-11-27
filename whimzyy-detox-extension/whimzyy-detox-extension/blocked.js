const WHIMZYY_URL = "https://whimzyy67.github.io/html/detox.html";   // same address as in background.js

const q = new URLSearchParams(location.search);
const why = q.get("why"), id = q.get("id"), app = q.get("app") || "this site", back = q.get("back");
const $ = (x) => document.getElementById(x);

const words = {
  app:    ["Limit hit 🚫", "You used all your " + app + " time today. Future you says thanks. Go touch grass 🌱"],
  daily:  ["Screen time maxed out", "Daily limit reached. Stretch, sip some water, look at something that isn't a screen."],
  quiet:  ["Quiet hours 🌙", app + " is sleeping and so should you. Sleep is the real main character."],
  reels:  ["Reels blocked 🙅", "You told Whimzyy no more reels. Respect. Back to real life."],
  shorts: ["Shorts blocked 🙅", "No brainrot today, you made that call. Proud of you."]
};
const pick = words[why] || ["Time is up", "Take a break."];
$("title").textContent = pick[0];
$("text").textContent = pick[1];

$("panel").addEventListener("click", () => { location.href = chrome.runtime.getURL("panel.html"); });
$("home").addEventListener("click", () => { location.href = WHIMZYY_URL; });

if (why === "reels" || why === "shorts") {
  $("more").style.display = "none";                // nothing to snooze for blockers
}

$("more").addEventListener("click", () => { $("why").style.display = "block"; $("reason").focus(); });

$("go").addEventListener("click", () => {
  if ($("reason").value.trim().length < 10) { $("reason").focus(); return; }
  chrome.runtime.sendMessage({ type: "snooze", id: id, minutes: 5 }, (res) => {
    location.replace(back || "https://www.google.com/");
  });
});

chrome.storage.local.get("snoozeCount", (d) => {
  const day = new Date();
  const key = day.getFullYear() + "-" + String(day.getMonth() + 1).padStart(2, "0") + "-" + String(day.getDate()).padStart(2, "0");
  const n = ((d.snoozeCount || {})[key]) || 0;
  $("count").textContent = n ? "Extra time requests today: " + n + ". We see you 👀" : "";
});
