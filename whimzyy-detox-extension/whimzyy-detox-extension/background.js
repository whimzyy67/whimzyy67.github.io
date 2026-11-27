/* background.js: counts screen time, enforces limits, opens the "time's up" page.
   Plain JavaScript, no libraries. Everything is stored in chrome.storage.local on this computer. */

const WHIMZYY_URL = "https://whimzyy-555.netlify.app/html/detox.html";   // change if you get your own domain
const IDLE_SECONDS = 300;      // no mouse/keyboard for 5 min = not counted (playing audio/video still counts)
const MAX_GAP = 120;           // never add more than 2 minutes for one gap (the worker may have been asleep)
const KEEP_DAYS = 45;

const DEFAULTS = {
  enabled: true,
  dailyLimitMin: 120,
  reels: true,
  shorts: true,
  mode: "hide",                                   // "hide" = quietly send you away, "message" = show the blocked page
  quiet: { on: false, from: "22:00", to: "07:00" },
  apps: [
    { id: "instagram", name: "Instagram", hosts: ["instagram.com"], limitMin: 30 },
    { id: "youtube",   name: "YouTube",   hosts: ["youtube.com", "youtu.be"], limitMin: 45 },
    { id: "facebook",  name: "Facebook",  hosts: ["facebook.com", "fb.com"], limitMin: 20 },
    { id: "x",         name: "X / Twitter", hosts: ["x.com", "twitter.com"], limitMin: 15 },
    { id: "reddit",    name: "Reddit",    hosts: ["reddit.com"], limitMin: 20 }
  ]
};

function dayKey(d) {
  d = d || new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + m + "-" + dd;
}

function matchApp(host, apps) {
  host = String(host || "").toLowerCase();
  for (const app of apps) {
    for (const h of app.hosts || []) {
      if (host === h || host.endsWith("." + h)) { return app; }
    }
  }
  return null;
}

function inQuiet(q, now) {
  if (!q || !q.on) { return false; }
  const toMin = (t) => { const p = String(t).split(":"); return (+p[0]) * 60 + (+p[1] || 0); };
  const cur = now.getHours() * 60 + now.getMinutes();
  const from = toMin(q.from), to = toMin(q.to);
  return from <= to ? (cur >= from && cur < to) : (cur >= from || cur < to);
}

/* ---------- the one function that does the work ---------- */

async function tick() {
  const data = await chrome.storage.local.get(["settings", "usage", "history", "state", "snooze"]);
  const settings = Object.assign({}, DEFAULTS, data.settings || {});
  settings.quiet = Object.assign({}, DEFAULTS.quiet, settings.quiet || {});
  if (!Array.isArray(settings.apps)) { settings.apps = DEFAULTS.apps; }

  const now = Date.now();
  const today = dayKey();
  let usage = data.usage || { day: today, total: 0, apps: {} };
  const history = data.history || {};

  // a new day: file yesterday away and start from zero
  if (usage.day !== today) {
    history[usage.day] = {
      total: Math.round(usage.total / 60),
      limit: settings.dailyLimitMin,
      on: settings.enabled,
      apps: Object.fromEntries(Object.entries(usage.apps || {}).map(([k, v]) => [k, Math.round(v / 60)]))
    };
    const keys = Object.keys(history).sort();
    while (keys.length > KEEP_DAYS) { delete history[keys.shift()]; }
    usage = { day: today, total: 0, apps: {} };
  }

  // add the time since the last tick to whatever was being watched
  const st = data.state || {};
  if (st.ts && st.active) {
    const secs = Math.min((now - st.ts) / 1000, MAX_GAP);
    usage.total += secs;
    if (st.app) { usage.apps[st.app] = (usage.apps[st.app] || 0) + secs; }
  }

  // what is happening right now?
  let tab = null, app = null, active = false;
  try {
    const win = await chrome.windows.getLastFocused();
    if (win && win.focused) {
      const tabs = await chrome.tabs.query({ active: true, windowId: win.id });
      tab = tabs[0] || null;
    }
  } catch (e) { /* no window */ }

  if (tab && /^https?:/i.test(tab.url || "")) {
    let host = "";
    try { host = new URL(tab.url).hostname; } catch (e) { /* ignore */ }
    app = matchApp(host, settings.apps);
    const idle = await chrome.idle.queryState(IDLE_SECONDS);
    active = idle === "active" || Boolean(tab.audible);
  }

  await chrome.storage.local.set({
    usage, history,
    state: { ts: now, app: app ? app.id : null, active }
  });

  // limits
  if (active && app && settings.enabled && tab && tab.id) {
    const snoozeUntil = (data.snooze || {})[app.id] || 0;
    if (snoozeUntil < now) {
      let why = null;
      if (inQuiet(settings.quiet, new Date(now))) { why = "quiet"; }
      else if (app.limitMin > 0 && (usage.apps[app.id] || 0) >= app.limitMin * 60) { why = "app"; }
      else if (settings.dailyLimitMin > 0 && usage.total >= settings.dailyLimitMin * 60) { why = "daily"; }

      if (why) { openBlocked(tab.id, why, app, tab.url); }
    }
  }
}

function openBlocked(tabId, why, app, back) {
  const url = chrome.runtime.getURL("blocked.html") +
    "?why=" + encodeURIComponent(why) +
    "&id=" + encodeURIComponent(app ? app.id : "") +
    "&app=" + encodeURIComponent(app ? app.name : "") +
    "&back=" + encodeURIComponent(back || "");
  chrome.tabs.update(tabId, { url });
}

/* ---------- run tick one at a time ---------- */

let chain = Promise.resolve();
function schedule() {
  chain = chain.then(tick).catch((e) => console.error("Whimzyy Detox:", e));
}

chrome.idle.setDetectionInterval(IDLE_SECONDS);
chrome.alarms.create("tick", { periodInMinutes: 1 });

chrome.runtime.onInstalled.addListener(schedule);
chrome.runtime.onStartup.addListener(schedule);
chrome.alarms.onAlarm.addListener((a) => { if (a.name === "tick") { schedule(); } });
chrome.tabs.onActivated.addListener(schedule);
chrome.tabs.onUpdated.addListener((id, change) => { if (change.status === "loading" || change.url) { schedule(); } });
chrome.windows.onFocusChanged.addListener(schedule);
chrome.idle.onStateChanged.addListener(schedule);


/* ---------- send Reels and Shorts away (works even if the page scripts are slow) ---------- */

async function checkAddress(tabId, url) {
  if (!url) { return; }
  let u;
  try { u = new URL(url); } catch (e) { return; }

  const isInsta = /(^|\.)instagram\.com$/.test(u.hostname) && /(^|\/)reels?(\/|$)/.test(u.pathname);
  const isShort = /(^|\.)youtube\.com$/.test(u.hostname) && u.pathname.indexOf("/shorts/") === 0;
  if (!isInsta && !isShort) { return; }

  const data = await chrome.storage.local.get("settings");
  const cfg = Object.assign({}, DEFAULTS, data.settings || {});
  if (cfg.enabled === false) { return; }
  if (isInsta && cfg.reels === false) { return; }
  if (isShort && cfg.shorts === false) { return; }

  if (cfg.mode === "message") {
    const why = isInsta ? "reels" : "shorts";
    openBlocked(tabId, why, { id: why, name: isInsta ? "Instagram Reels" : "YouTube Shorts" }, isInsta ? "https://www.instagram.com/" : "https://www.youtube.com/");
  } else if (isShort) {
    const id = u.pathname.split("/")[2] || "";
    chrome.tabs.update(tabId, { url: id ? "https://www.youtube.com/watch?v=" + encodeURIComponent(id) : "https://www.youtube.com/" });
  } else {
    chrome.tabs.update(tabId, { url: "https://www.instagram.com/" });
  }
}

chrome.tabs.onUpdated.addListener((tabId, change, tab) => { checkAddress(tabId, change.url || (change.status === "loading" ? tab.url : "")); });

/* ---------- messages from the blockers and the blocked page ---------- */

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg && msg.type === "block-page" && sender.tab) {
    openBlocked(sender.tab.id, msg.why, { id: msg.why, name: msg.why === "reels" ? "Instagram Reels" : "YouTube Shorts" }, msg.back);
    return false;
  }
  if (msg && msg.type === "snooze") {
    (async () => {
      const d = await chrome.storage.local.get(["snooze", "snoozeCount"]);
      const snooze = d.snooze || {};
      snooze[msg.id] = Date.now() + (msg.minutes || 5) * 60000;
      const counts = d.snoozeCount || {};
      const day = dayKey();
      counts[day] = (counts[day] || 0) + 1;
      await chrome.storage.local.set({ snooze, snoozeCount: counts });
      reply({ ok: true, count: counts[day] });
    })();
    return true;                                   // answer comes later
  }
  return false;
});


/* ---------- toolbar icon: open (or focus) the Detox panel ---------- */

chrome.action.onClicked.addListener(async () => {
  const url = chrome.runtime.getURL("panel.html");
  const tabs = await chrome.tabs.query({ url });
  if (tabs.length) {
    await chrome.tabs.update(tabs[0].id, { active: true });
    await chrome.windows.update(tabs[0].windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url });
  }
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") { chrome.tabs.create({ url: chrome.runtime.getURL("panel.html") }); }
});


/* ---------- messages straight from the Whimzyy Detox page (no helper script needed) ----------
   The page calls chrome.runtime.sendMessage(<this extension's id>, ...). Chrome only allows it from the
   sites listed under "externally_connectable" in manifest.json. */

chrome.runtime.onMessageExternal.addListener((msg, sender, reply) => {
  (async () => {
    try {
      if (!msg || typeof msg.type !== "string") { reply({ type: "error" }); return; }

      if (msg.type === "ping") {
        reply({ type: "pong", version: chrome.runtime.getManifest().version });
      } else if (msg.type === "set-settings") {
        await chrome.storage.local.set({ settings: msg.settings });
        reply({ type: "saved" });
      } else if (msg.type === "get") {
        const data = await chrome.storage.local.get(["settings", "usage", "history", "snoozeCount"]);
        reply({ type: "data", data: data });
      } else {
        reply({ type: "error" });
      }
    } catch (e) {
      reply({ type: "error" });
    }
  })();
  return true;                                      // the answer comes later
});
