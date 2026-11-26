/* reminders.js
   Water / stretch / rest-your-eyes reminders for every Whimzyy page.
   - Loaded automatically by rewards.js (so you do not add it to any page).
   - Uses "next reminder at" times saved in localStorage, so a reload, another page or a sleeping tab does not reset the clock.
   - Shows a pop-up inside the page, and a real desktop notification (when you allow it) so you also see it from other tabs.
   - Closed-app alerts (Web Push): when you allow notifications and are logged in, your reminder settings are copied to the cloud
     (table push_subscriptions) and a Supabase function sends the reminder even when Whimzyy is closed.
   - Settings are saved by wellness.js under "whimzyy-reminders" ({water:{on,every}, ...}). */
(function () {
  "use strict";
  if (window.Reminders) { return; }

  var SKEY = "whimzyy-reminders";
  var NKEY = "whimzyy-reminders-next";

  var TEXT = {
    water:   { title: "Hydrate or diedrate 💧",       body: "Sip some water, bestie." },
    stretch: { title: "Stand up, main character 🙆",  body: "One minute of stretching. Your spine says thanks." },
    rest:    { title: "Eyes need a break 👀",          body: "Look at something far away for 20 seconds." }
  };
  var NAMES = Object.keys(TEXT);

  function read(key, fallback) {
    try { var v = JSON.parse(localStorage.getItem(key)); return v === null ? fallback : v; } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage blocked */ }
  }

  function settings() {
    var s = read(SKEY, {}) || {};
    NAMES.forEach(function (n) {
      if (!s[n]) { s[n] = { on: false, every: n === "rest" ? 30 : 45 }; }
    });
    return s;
  }


  /* ---------- the pop-up inside the page ---------- */

  var box = null, hideTimer = null;

  function buildBox() {
    var css = document.createElement("style");
    css.textContent =
      "#wz-remind{position:fixed;left:50%;bottom:28px;transform:translate(-50%,30px);z-index:100000;max-width:min(92vw,420px);" +
      "display:flex;gap:12px;align-items:center;padding:14px 18px;border-radius:20px;background:#F2B83D;color:#3A0A12;" +
      "font-family:'DM Sans',Arial,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.45);opacity:0;pointer-events:none;transition:opacity .25s ease,transform .25s ease}" +
      "#wz-remind.show{opacity:1;transform:translate(-50%,0);pointer-events:auto}" +
      "#wz-remind b{display:block;font-size:16px}#wz-remind span{font-size:14px;font-weight:500}" +
      "#wz-remind button{margin-left:auto;border:none;background:rgba(58,10,18,.15);color:inherit;border-radius:999px;padding:6px 12px;font-weight:700;cursor:pointer;font-family:inherit}";
    document.head.appendChild(css);

    box = document.createElement("div");
    box.id = "wz-remind";
    box.setAttribute("role", "alert");
    box.innerHTML = "<div><b></b><span></span></div><button type=\"button\">Done</button>";
    box.querySelector("button").addEventListener("click", hide);
    document.body.appendChild(box);
  }

  function hide() { if (box) { box.classList.remove("show"); } }

  function popup(title, body) {
    if (!document.body) { return; }
    if (!box) { buildBox(); }
    box.querySelector("b").textContent = title;
    box.querySelector("span").textContent = body;
    box.classList.add("show");
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hide, 12000);
  }

  function beep() {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) { return; }
      var ctx = new Ctx(), osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = "sine"; osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.65);
    } catch (e) { /* the browser blocks sound until you have clicked the page once: fine */ }
  }


  /* ---------- going off ---------- */

  function permission() {
    return ("Notification" in window) ? Notification.permission : "unsupported";
  }

  function ask() {
    if (permission() !== "default") { return Promise.resolve(permission()); }
    try {
      var r = Notification.requestPermission();
      return (r && r.then) ? r : Promise.resolve(Notification.permission);
    } catch (e) { return Promise.resolve(permission()); }
  }

  function fire(name) {
    var t = TEXT[name];
    popup(t.title, t.body);
    beep();
    if (permission() === "granted" && document.hidden) {
      try {
        var n = new Notification(t.title, { body: t.body, tag: "whimzyy-" + name });
        n.onclick = function () { window.focus(); n.close(); };
      } catch (e) { /* some browsers need a service worker: the pop-up already showed */ }
    }
  }


  /* ---------- the clock ---------- */

  function tick() {
    var now = Date.now();
    var s = settings();
    var next = read(NKEY, {}) || {};
    var changed = false;
    var due = [];

    NAMES.forEach(function (n) {
      var st = s[n];
      if (!st.on) {
        if (next[n]) { delete next[n]; changed = true; }
        return;
      }
      var gap = st.every * 60000;
      if (!next[n]) { next[n] = now + gap; changed = true; return; }
      if (now >= next[n]) {
        var stale = now - next[n] > gap;                 // the browser was closed for a long time: just restart the clock
        next[n] = now + gap;
        changed = true;
        if (!stale) { due.push(n); }
      }
    });

    if (changed) { write(NKEY, next); }                 // saved BEFORE showing, so a second open tab does not repeat it
    due.forEach(fire);
  }

  /* wellness.js calls these */
  window.Reminders = {
    permission: permission,
    ask: ask,
    restart: function (name) {                           // a switch or the time was changed
      var s = settings();
      var next = read(NKEY, {}) || {};
      if (s[name] && s[name].on) { next[name] = Date.now() + s[name].every * 60000; } else { delete next[name]; }
      write(NKEY, next);
    },
    test: function (name) { fire(name || "water"); },
    timeLeft: function (name) {                          // minutes until the next one (or null if it is off)
      var next = read(NKEY, {}) || {};
      return next[name] ? Math.max(0, Math.round((next[name] - Date.now()) / 60000)) : null;
    }
  };


  /* ---------- closed-app alerts (Web Push) ---------- */

  var VAPID_PUBLIC = "BG7nJ_mMGrH1wMbiNl123qGa83S_tLr4eRQ3xAx9RzsIUjI6LwPLKroPNBGOUdiNDdJxO8Sy_QRB9bb4EbbDjPc";

  function keyBytes(b64) {
    var pad = "=".repeat((4 - b64.length % 4) % 4);
    var raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) { out[i] = raw.charCodeAt(i); }
    return out;
  }

  function withTimeout(promise, ms) {
    return Promise.race([promise, new Promise(function (resolve) { setTimeout(function () { resolve(null); }, ms); })]);
  }

  // copies your settings to the cloud so the server knows when to ping you
  function syncPush() {
    return (async function () {
      try {
        if (!("serviceWorker" in navigator) || !("PushManager" in window) || permission() !== "granted") { return; }
        var A = window.WhimzyyAuth;
        if (!A || !A.client || !A.user) { return; }
        var reg = await withTimeout(navigator.serviceWorker.ready, 5000);
        if (!reg) { return; }
        var sub = await reg.pushManager.getSubscription();
        if (!sub) { sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC) }); }
        var j = sub.toJSON(), s = settings(), db = A.client, uid = A.user.id, now = Date.now();
        var old = await db.from("push_subscriptions").select("settings,next_at").eq("user_id", uid).eq("endpoint", j.endpoint).maybeSingle();
        var prev = old && old.data, next = {};
        NAMES.forEach(function (n) {
          if (!s[n].on) { return; }
          var p = prev && prev.settings && prev.settings[n];
          var same = p && p.on && p.every === s[n].every && prev.next_at && prev.next_at[n];
          next[n] = same ? prev.next_at[n] : now + s[n].every * 60000;     // only a changed reminder restarts its clock
        });
        var row = {
          user_id: uid, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth,
          tz: (Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"), settings: s, next_at: next,
          updated_at: new Date().toISOString()
        };
        var res = prev
          ? await db.from("push_subscriptions").update(row).eq("user_id", uid).eq("endpoint", j.endpoint)
          : await db.from("push_subscriptions").insert(row);
        if (res && res.error) { console.warn("Whimzyy alerts:", res.error.message); }
      } catch (e) { console.warn("Whimzyy alerts:", (e && e.message) || e); }
    })();
  }
  var pushTimer = null;
  function schedulePush() { clearTimeout(pushTimer); pushTimer = setTimeout(syncPush, 800); }

  var baseAsk = window.Reminders.ask, baseRestart = window.Reminders.restart;
  window.Reminders.ask = function () {
    return baseAsk().then(function (p) { if (p === "granted") { schedulePush(); } return p; });
  };
  window.Reminders.restart = function (name) { baseRestart(name); schedulePush(); };
  window.Reminders.syncPush = syncPush;
  window.addEventListener("whimzyy-auth", schedulePush);
  setTimeout(schedulePush, 3000);

  tick();
  setInterval(tick, 1000);
  document.addEventListener("visibilitychange", tick);
})();
