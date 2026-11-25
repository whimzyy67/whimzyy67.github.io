/* Whimzyy accounts + cloud sync (Supabase).
   ONE script tag, as the FIRST script in <head> of every page:
     root pages (index.html, home.html):  <script src="js/auth.js"></script>
     pages inside /html/:                 <script src="../js/auth.js"></script>
   It loads the config, the Supabase library and the styles by itself, adds an
   Account button beside "About Us", and keeps every "whimzyy-..." key in sync. */
(function () {
  "use strict";
  var me = document.currentScript && document.currentScript.src;
  if (!me) { return; }
  var JS = new URL("./", me).href;
  var ROOT = new URL("../", me).href;

  /* ================= 1. SYNC ENGINE (installs immediately so no write is missed) ================= */
  var LS = window.localStorage;
  var origSet = Storage.prototype.setItem;
  var origRemove = Storage.prototype.removeItem;
  var PREFIX = "whimzyy-", META = "whimzyy-sync-meta", TABLE = "user_data";
  var SKIP = { "whimzyy-backup": 1, "whimzyy-sync-meta": 1, "whimzyy-install-dismissed": 1 };
  var meta = loadMeta();
  var client = null, uid = null, enabled = false, busy = false, timer = null, lastStatus = "off", lastError = "";

  function syncable(k) {
    return typeof k === "string" && k.indexOf(PREFIX) === 0 && !SKIP[k] && k.indexOf("whimzyy-ext") !== 0;
  }
  function loadMeta() {
    try { var m = JSON.parse(LS.getItem(META)); if (m && m.ts) { m.dirty = m.dirty || []; m.del = m.del || []; return m; } } catch (e) {}
    return { user: null, ts: {}, dirty: [], del: [] };
  }
  function saveMeta() { try { origSet.call(LS, META, JSON.stringify(meta)); } catch (e) {} }
  function without(list, k) { return list.filter(function (x) { return x !== k; }); }
  function status(state, err) {
    lastStatus = state;
    lastError = err ? (err.message || String(err)) : "";
    if (err) { console.warn("Whimzyy sync:", err.message || err); }
    window.dispatchEvent(new CustomEvent("whimzyy-sync-status", { detail: { state: state } }));
  }

  function touch(k, deleted) {
    meta.ts[k] = Date.now();
    if (deleted) { meta.del = without(meta.del, k).concat(k); meta.dirty = without(meta.dirty, k); }
    else { meta.dirty = without(meta.dirty, k).concat(k); meta.del = without(meta.del, k); }
    saveMeta();
    if (enabled) { clearTimeout(timer); timer = setTimeout(push, 1500); }
  }
  Storage.prototype.setItem = function (k, v) {
    origSet.call(this, k, v);
    if (this === LS && syncable(k)) { touch(k, false); }
  };
  Storage.prototype.removeItem = function (k) {
    origRemove.call(this, k);
    if (this === LS && syncable(k)) { touch(k, true); }
  };

  async function push() {
    if (!enabled || busy) { return; }
    var d = meta.dirty.slice(), x = meta.del.slice();
    if (!d.length && !x.length) { status("synced"); return; }
    busy = true; status("syncing");
    var stamp = {};
    d.concat(x).forEach(function (k) { stamp[k] = meta.ts[k]; });
    try {
      var rows = [];
      d.forEach(function (k) {
        var v = LS.getItem(k);
        if (v === null) { x.push(k); return; }
        rows.push({ user_id: uid, key: k, value: v, updated_at: new Date(meta.ts[k] || Date.now()).toISOString() });
      });
      if (rows.length) {
        var r = await client.from(TABLE).upsert(rows, { onConflict: "user_id,key" });
        if (r.error) { throw r.error; }
      }
      if (x.length) {
        var r2 = await client.from(TABLE).delete().eq("user_id", uid).in("key", x);
        if (r2.error) { throw r2.error; }
      }
      // forget only what did not change again while we were sending
      meta.dirty = meta.dirty.filter(function (k) { return !(k in stamp) || meta.ts[k] !== stamp[k]; });
      meta.del = meta.del.filter(function (k) { return !(k in stamp) || meta.ts[k] !== stamp[k]; });
      saveMeta();
      status("synced");
    } catch (e) {
      status("error", e);
      setTimeout(push, 30000);
    } finally {
      busy = false;
      if (enabled && (meta.dirty.length || meta.del.length) && lastStatus !== "error") { timer = setTimeout(push, 1500); }
    }
  }

  async function startSync(c, user) {
    if (enabled && uid === user.id) { return; }
    client = c; uid = user.id; enabled = true; status("syncing");
    var res = await client.from(TABLE).select("key,value,updated_at").eq("user_id", uid);
    if (res.error) { status("error", res.error); return; }
    var first = meta.user !== uid;          // first time THIS device meets THIS account: the cloud wins
    var remote = {}, changed = false;
    res.data.forEach(function (row) {
      if (!syncable(row.key)) { return; }
      remote[row.key] = true;
      if (meta.del.indexOf(row.key) !== -1) { return; }       // deleted here, delete will be pushed
      var rts = Date.parse(row.updated_at) || 0, lts = meta.ts[row.key] || 0;
      var has = LS.getItem(row.key) !== null;
      if (first || !has || rts > lts) {
        if (LS.getItem(row.key) !== row.value) { origSet.call(LS, row.key, row.value); changed = true; }
        meta.ts[row.key] = rts; meta.dirty = without(meta.dirty, row.key);
      } else if (lts > rts && meta.dirty.indexOf(row.key) === -1) { meta.dirty.push(row.key); }
    });
    for (var i = 0; i < LS.length; i++) {                      // local-only keys go up
      var k = LS.key(i);
      if (syncable(k) && !remote[k] && meta.dirty.indexOf(k) === -1) {
        if (!meta.ts[k]) { meta.ts[k] = Date.now(); }
        meta.dirty.push(k);
      }
    }
    meta.user = uid; saveMeta();
    if (changed) {
      var last = +sessionStorage.getItem("whimzyy-sync-reload") || 0;
      if (Date.now() - last > 15000) { sessionStorage.setItem("whimzyy-sync-reload", String(Date.now())); location.reload(); return; }
    }
    push();
  }
  function stopSync() { enabled = false; uid = null; status("off"); }
  async function flush() {
    for (var i = 0; i < 5 && enabled && (meta.dirty.length || meta.del.length); i++) {
      busy = false; await push();
      if (lastStatus === "error") { break; }
    }
  }
  function clearLocal() {   // used on log out so the next person on a shared device sees nothing
    var drop = [];
    for (var i = 0; i < LS.length; i++) { var k = LS.key(i); if (k.indexOf(PREFIX) === 0 && k !== "whimzyy-install-dismissed") { drop.push(k); } }
    drop.forEach(function (k) { origRemove.call(LS, k); });
  }
  window.WhimzyySync = { flush: flush, status: function () { return lastStatus; } };
  window.addEventListener("online", function () { push(); });
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") { push(); } });
  setInterval(function () { if (enabled && (meta.dirty.length || meta.del.length)) { push(); } }, 30000);

  /* ================= 2. ACCOUNT UI ================= */
  var cfg = window.WHIMZYY_SUPABASE;
  var modal = null, btnLabel = null, current = null, gate = false;

  // In the installed app (home-screen app / Play Store app) logging in, or choosing guest, is required.
  // The website itself stays open to everyone, and the entry page (index.html) never asks.
  function standalone() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  }
  function needsGate() {
    if (!standalone()) { return false; }
    var file = location.pathname.split("/").pop();
    return !(file === "" || file === "index.html" || file === "privacy.html" || file === "offline.html");
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (text != null) { n.textContent = text; }
    return n;
  }
  function loadScript(src, ok, fail) {
    var s = document.createElement("script");
    s.src = src; s.onload = ok; s.onerror = fail || function () { console.warn("Whimzyy: could not load " + src); };
    document.head.appendChild(s);
  }
  function boot() {
    var link = document.createElement("link");
    link.rel = "stylesheet"; link.href = new URL("../css/auth.css", me).href;
    document.head.appendChild(link);
    loadScript(JS + "supabase-config.js", function () {
      cfg = window.WHIMZYY_SUPABASE;
      if (!cfg || !cfg.url || cfg.url.indexOf("YOUR-") !== -1) {
        console.warn("Whimzyy: add your Supabase url + anon key in js/supabase-config.js");
        return;
      }
      if (window.supabase && window.supabase.createClient) { ready(); }
      else { loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/dist/umd/supabase.js", ready); }
    });
  }

  function ready() {
    client = window.supabase.createClient(cfg.url, cfg.anonKey, { auth: { persistSession: true, autoRefreshToken: true } });
    var onDom = function () {
      addButton();
      client.auth.getSession().then(function (r) { setUser(r.data && r.data.session ? r.data.session.user : null); });
      client.auth.onAuthStateChange(function (ev, session) { setUser(session ? session.user : null); });
    };
    if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", onDom); } else { onDom(); }
  }

  function who(u) {
    if (!u) { return "Account"; }
    if (u.is_anonymous) { return (u.user_metadata && u.user_metadata.display_name) || "Guest"; }
    return (u.email || "Account").split("@")[0];
  }
  function setUser(u) {
    current = u;
    if (u && gate) { gate = false; closeModal(); }
    if (!u && !gate && needsGate()) { gate = true; openModal(); }
    if (btnLabel) {
      btnLabel.textContent = who(u);
      var b = document.getElementById("acctBtn");
      if (b) { b.title = u ? who(u) : "Log in or continue as guest"; b.setAttribute("aria-label", b.title); }
    }
    if (u) { startSync(client, u); } else { stopSync(); }
    if (modal && modal.classList.contains("open")) { render(); }
  }

  function addButton() {
    if (document.getElementById("acctBtn")) { return; }
    var nav = document.querySelector(".top-nav");
    if (!nav) { return; }
    var a = el("a", "tab acct-btn");
    a.id = "acctBtn"; a.href = "#"; a.title = "Your account";
    var img = el("img", "icon"); img.src = ROOT + "stickers/accounts.png"; img.alt = "Account";
    btnLabel = el("span", "acct-sr", who(current));   // hidden text: icon only, but screen readers still get the name
    a.appendChild(img); a.appendChild(btnLabel);
    a.addEventListener("click", function (e) { e.preventDefault(); openModal(); });
    nav.appendChild(a);
  }

  function openModal() {
    if (!modal) {
      modal = el("div", "acct-overlay");
      modal.addEventListener("click", function (e) { if (e.target === modal) { closeModal(); } });
      document.body.appendChild(modal);
      document.addEventListener("keydown", function (e) { if (e.key === "Escape") { closeModal(); } });
      window.addEventListener("whimzyy-sync-status", function () { if (modal.classList.contains("open")) { paintStatus(); } });
    }
    modal.classList.add("open");
    render();
  }
  function closeModal() { if (gate) { return; } if (modal) { modal.classList.remove("open"); } }

  var mode = "choose";          // choose | login | signup
  var msg = { text: "", bad: false };

  function field(type, label, ph, auto) {
    var wrap = el("label", "acct-field");
    wrap.appendChild(el("span", "", label));
    var i = el("input"); i.type = type; i.placeholder = ph; i.autocomplete = auto;
    wrap.appendChild(i); wrap.input = i;
    return wrap;
  }
  function paintStatus() {
    var s = modal.querySelector(".acct-sync");
    if (!s) { return; }
    var t = { syncing: "Syncing…", synced: "All saved to the cloud ✓", error: "Not saved yet: " + lastError, off: "" }[lastStatus] || "";
    s.textContent = t;
  }
  function say(t, bad) { msg = { text: t, bad: !!bad }; var m = modal && modal.querySelector(".acct-msg"); if (m) { m.textContent = t; m.className = "acct-msg" + (bad ? " bad" : ""); } }

  function render() {
    modal.textContent = "";
    var card = el("div", "acct-card");
    if (!gate) {
      var x = el("button", "acct-x", "✕"); x.type = "button"; x.setAttribute("aria-label", "Close");
      x.addEventListener("click", closeModal);
      card.appendChild(x);
    }
    var isGuest = current && current.is_anonymous;
    var isGuestBox = false;

    if (current && !isGuest) {
      card.appendChild(el("h2", "", "Hey, " + who(current)));
      card.appendChild(el("p", "acct-sub", current.email));
      card.appendChild(el("p", "acct-sync", ""));
      var out = el("button", "acct-btn-main", "Log out"); out.type = "button";
      out.addEventListener("click", async function () {
        out.disabled = true; out.textContent = "Saving…";
        await flush();
        await client.auth.signOut();
        clearLocal(); location.reload();
      });
      card.appendChild(out);
    } else {
      card.appendChild(el("h2", "", isGuest ? "Hey, " + who(current) : (gate ? "Welcome to Whimzyy" : "Join Whimzyy")));
      if (isGuest) {
        card.appendChild(el("p", "acct-sub", "You're a guest. Save your progress with an email so you never lose your stars, themes and streaks."));
        card.appendChild(el("p", "acct-sync", ""));
        isGuestBox = true;
      } else if (mode === "choose") {
        card.appendChild(el("p", "acct-sub", gate ? "Log in, or jump in as a guest, to start. Your stars and progress stay with you on every device." : "Log in to keep everything synced across your devices."));
      }
      if (!current && mode === "choose") {
        var g = el("button", "acct-guest", "✨ Continue as guest"); g.type = "button";
        g.addEventListener("click", guestIn);
        var l = el("button", "acct-btn-main", "Log in"); l.type = "button";
        l.addEventListener("click", function () { mode = "login"; say(""); render(); });
        var s = el("button", "acct-btn-alt", "Create account"); s.type = "button";
        s.addEventListener("click", function () { mode = "signup"; say(""); render(); });
        card.appendChild(g); card.appendChild(l); card.appendChild(s);
      } else {
        var signup = isGuest ? mode !== "login" : mode === "signup";
        if (isGuest) { card.appendChild(el("h3", "", "Save my progress")); }
        var em = field("email", "Email", "you@example.com", "email");
        var pw = field("password", signup ? "Set a password" : "Password", "at least 6 characters", signup ? "new-password" : "current-password");
        var go = el("button", "acct-btn-main", signup ? (isGuest ? "Save my account" : "Create account") : "Log in"); go.type = "button";
        var form = el("form", "acct-form");
        form.appendChild(em); form.appendChild(pw);
        var m = el("p", "acct-msg" + (msg.bad ? " bad" : ""), msg.text);
        form.appendChild(m); form.appendChild(go);
        form.addEventListener("submit", function (e) { e.preventDefault(); submit(signup, em.input.value.trim(), pw.input.value, go); });
        go.type = "submit";
        card.appendChild(form);
        var sw = el("button", "acct-link", signup ? "I already have an account" : (isGuest ? "Save as a new account instead" : "I need an account")); sw.type = "button";
        sw.addEventListener("click", function () { mode = signup ? "login" : "signup"; say(""); render(); });
        card.appendChild(sw);
        if (isGuest && !signup) { card.appendChild(el("p", "acct-sub small", "Logging in switches to that account. Anything new you did as a guest is merged into it.")); }
        if (!current) {
          var back = el("button", "acct-link", "← Back"); back.type = "button";
          back.addEventListener("click", function () { mode = "choose"; say(""); render(); });
          card.appendChild(back);
        }
      }
    }
    if (isGuest) {
      var gout = el("button", "acct-link", "Log out of guest mode"); gout.type = "button";
      gout.addEventListener("click", async function () {
        if (!window.confirm("Log out of guest mode? Your guest progress will be lost unless you saved it with an email first.")) { return; }
        gout.textContent = "Logging out…";
        await client.auth.signOut();
        clearLocal(); location.reload();
      });
      card.appendChild(gout);
    }
    modal.appendChild(card);
    paintStatus();
  }

  async function guestIn() {
    var name = "user" + (10000 + Math.floor(Math.random() * 90000));
    var r = await client.auth.signInAnonymously({ options: { data: { display_name: name } } });
    if (r.error) { say("Guest mode isn't switched on yet: " + r.error.message, true); render(); return; }
    closeModal();
  }

  async function submit(signup, email, password, btn) {
    if (!email || password.length < 6) { say("Enter an email and a password of at least 6 characters.", true); return; }
    btn.disabled = true; say("");
    var isGuest = current && current.is_anonymous, r;
    try {
      if (signup && isGuest) {
        r = await client.auth.updateUser({ email: email, password: password, data: { display_name: email.split("@")[0] } });
        if (!r.error) { say("Saved! If asked, confirm the link we emailed you."); setUser(r.data.user); btn.disabled = false; return; }
      } else if (signup) {
        r = await client.auth.signUp({ email: email, password: password, options: { data: { display_name: email.split("@")[0] } } });
        if (!r.error && !r.data.session) { say("Check your inbox and confirm your email, then log in."); mode = "login"; btn.disabled = false; return; }
      } else {
        r = await client.auth.signInWithPassword({ email: email, password: password });
      }
      if (r.error) { say(r.error.message, true); btn.disabled = false; return; }
      closeModal();
    } catch (e) { say("Something went wrong. Check your connection.", true); btn.disabled = false; }
  }

  boot();
})();
