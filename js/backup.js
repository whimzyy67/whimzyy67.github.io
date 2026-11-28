/* backup.js - Backup & Restore for Whimzyy accounts.
   - Live sync (in auth.js) already keeps your data in your account. Backups add SAFETY on top:
       * "restore points": snapshots saved in the cloud (a new one automatically about once a day, plus whenever you tap Back up now)
       * a backup FILE you can download and keep, and restore from later (also works to move to a new phone)
   - Needs sql/backups.sql run once in Supabase (a small "backups" table). Without it the file backup still works.
   - Pictures (Day Dump, vision boards) live in cloud storage and are not part of these backups.
   Loaded by auth.js only when it is needed. */
(function () {
  "use strict";
  if (window.WhimzyyBackup) { return; }

  var LS = window.localStorage;
  var KEEP = 10;                                   // how many restore points are kept
  var DAY = 24 * 60 * 60 * 1000;
  var MAX_BYTES = 4 * 1024 * 1024;                 // a snapshot bigger than this is not saved to the cloud
  var CHECK_KEY = "whimzyy-ext-backup-check";      // "whimzyy-ext..." is never synced, and is cleared when you log out

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (text != null) { n.textContent = text; }
    return n;
  }
  function api() { return window.WhimzyySync && window.WhimzyySync.api; }
  function client() { return api() && api().client(); }
  function uid() { return api() && api().uid(); }

  /* everything that is synced, as { key: text } */
  function collect() {
    var out = {}, a = api();
    for (var i = 0; i < LS.length; i++) {
      var k = LS.key(i);
      if (a.syncable(k)) { out[k] = LS.getItem(k); }
    }
    return out;
  }
  function count(o) { return Object.keys(o).length; }
  function bytes(o) { try { return JSON.stringify(o).length; } catch (e) { return 0; } }

  function when(iso) {
    var d = new Date(iso);
    return d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" }) + ", " + d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  function tableMissing(err) {
    var m = ((err && err.message) || "") + " " + ((err && err.code) || "");
    return /relation .*backups|does not exist|42P01|PGRST205|schema cache/i.test(m);
  }

  /* ---------- cloud restore points ---------- */
  async function listPoints() {
    var r = await client().from("backups").select("id,created_at,label,kind,item_count").eq("user_id", uid()).order("created_at", { ascending: false }).limit(KEEP + 5);
    if (r.error) { throw r.error; }
    return r.data || [];
  }
  async function prune() {
    var rows = await listPoints();
    var extra = rows.slice(KEEP).map(function (x) { return x.id; });
    if (extra.length) { await client().from("backups").delete().eq("user_id", uid()).in("id", extra); }
  }
  async function makePoint(kind, label) {
    var a = api(); if (!a || !a.enabled()) { throw new Error("You are not logged in."); }
    if (window.WhimzyySync.flush) { await window.WhimzyySync.flush(); }
    var data = collect(), n = count(data);
    if (!n) { throw new Error("There is nothing to back up yet."); }
    if (bytes(data) > MAX_BYTES) { throw new Error("Your data is too big for a cloud restore point. Download a backup file instead."); }
    var r = await client().from("backups").insert({ user_id: uid(), kind: kind, label: label, item_count: n, data: data });
    if (r.error) { throw r.error; }
    prune().catch(function () { /* pruning is a nice-to-have */ });
    return n;
  }
  async function restoreData(data) {
    var a = api(), k;
    // 1) keep a safety copy of what is here now, so a restore can itself be undone
    try { await makePoint("before-restore", "Before a restore"); } catch (e) { /* if this fails (for example no table), we still go on after asking */ }
    // 2) make this device look exactly like the backup
    var existing = Object.keys(collect());
    existing.forEach(function (key) { if (!(key in data)) { LS.removeItem(key); } });
    Object.keys(data).forEach(function (key) { if (a.syncable(key) && typeof data[key] === "string") { LS.setItem(key, data[key]); } });
    // 3) send it to the account, then reload so every page shows it
    await window.WhimzyySync.flush();
    location.reload();
  }

  /* run quietly about once a day: a restore point, so there is always a recent copy */
  async function auto() {
    try {
      var a = api(); if (!a || !a.enabled() || !client()) { return; }
      var last = Number(LS.getItem(CHECK_KEY)) || 0;
      if (Date.now() - last < 6 * 60 * 60 * 1000) { return; }
      LS.setItem(CHECK_KEY, String(Date.now()));
      var rows = await listPoints();
      var newest = rows.length ? Date.parse(rows[0].created_at) : 0;
      if (Date.now() - newest > DAY) { await makePoint("auto", "Daily backup"); }
    } catch (e) { /* no table yet, offline, or empty: silently skip */ }
  }

  /* ---------- the window ---------- */
  var overlay = null, msgBox = null, listBox = null, lastLine = null, busyBtn = null;

  function say(text, bad) { if (msgBox) { msgBox.textContent = text || ""; msgBox.className = "acct-msg" + (bad ? " bad" : ""); } }
  function close() { if (overlay) { overlay.classList.remove("open"); } }

  function button(text, cls, fn) {
    var b = el("button", cls, text); b.type = "button";
    b.addEventListener("click", function () { if (b.disabled) { return; } fn(b); });
    return b;
  }
  async function guard(b, working, fn) {
    var old = b.textContent; b.disabled = true; b.textContent = working; say("");
    try { await fn(); } catch (e) {
      say(tableMissing(e) ? "Cloud restore points need one setup step: run sql/backups.sql in Supabase. File backups work already." : (e.message || "Something went wrong. Please try again."), true);
    }
    b.disabled = false; b.textContent = old;
  }

  async function refresh() {
    listBox.textContent = "";
    try {
      var rows = await listPoints();
      lastLine.textContent = rows.length ? "Last cloud backup: " + when(rows[0].created_at) : "No cloud backup yet. Tap Back up now.";
      if (!rows.length) { listBox.appendChild(el("p", "acct-sub small", "Restore points will show here.")); return; }
      rows.slice(0, KEEP).forEach(function (p) {
        var row = el("div", "bk-row");
        var info = el("div", "bk-info");
        info.appendChild(el("b", "", when(p.created_at)));
        info.appendChild(el("span", "", (p.kind === "auto" ? "Daily backup" : p.kind === "before-restore" ? "Before a restore" : "Backup") + " · " + p.item_count + " items"));
        row.appendChild(info);
        var rb = button("Restore", "acct-btn-alt bk-small", function (b) {
          if (!window.confirm("Go back to " + when(p.created_at) + "? What you have now is saved as a restore point first, so you can undo this.")) { return; }
          guard(b, "Restoring…", async function () {
            var r = await client().from("backups").select("data").eq("id", p.id).eq("user_id", uid()).single();
            if (r.error || !r.data) { throw (r.error || new Error("That backup could not be found.")); }
            await restoreData(r.data.data || {});
          });
        });
        var db = button("🗑", "acct-link bk-del", function (b) {
          if (!window.confirm("Delete this restore point?")) { return; }
          guard(b, "…", async function () { var r = await client().from("backups").delete().eq("id", p.id).eq("user_id", uid()); if (r.error) { throw r.error; } await refresh(); });
        });
        db.title = "Delete this restore point"; db.setAttribute("aria-label", "Delete this restore point");
        row.appendChild(rb); row.appendChild(db); listBox.appendChild(row);
      });
    } catch (e) {
      lastLine.textContent = "";
      listBox.appendChild(el("p", "acct-sub small", tableMissing(e)
        ? "Cloud restore points need one setup step: run sql/backups.sql in Supabase. File backups work already."
        : "Could not load your restore points. Check your connection."));
    }
  }

  function build() {
    var st = document.createElement("style");
    st.textContent = ".bk-card{max-height:90vh;overflow-y:auto}.bk-card h3{margin:16px 0 6px;font-size:1rem}.bk-list{display:flex;flex-direction:column;gap:8px}"
      + ".bk-row{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:12px;background:rgba(128,128,128,.12)}"
      + ".bk-info{flex:1;min-width:0;display:flex;flex-direction:column;font-size:.85rem}.bk-info span{opacity:.75;font-size:.78rem}"
      + ".bk-small{width:auto!important;padding:8px 14px!important;margin:0!important}.bk-del{width:auto!important;margin:0!important;padding:6px!important}"
      + ".bk-files{display:flex;flex-direction:column;gap:8px}.bk-card .small{font-size:.8rem}.acct-msg.bad{color:#e57373}";
    document.head.appendChild(st);
    overlay = el("div", "acct-overlay"); overlay.id = "wzBackup";
    overlay.addEventListener("click", function (e) { if (e.target === overlay) { close(); } });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") { close(); } });
    document.body.appendChild(overlay);
  }
  function paint() {
    overlay.textContent = "";
    var card = el("div", "acct-card bk-card");
    var x = el("button", "acct-x", "✕"); x.type = "button"; x.setAttribute("aria-label", "Close"); x.addEventListener("click", close);
    card.appendChild(x);
    card.appendChild(el("h2", "", "Backup & restore 💾"));
    card.appendChild(el("p", "acct-sub", "Your progress is saved to your account automatically. Backups let you go back if something is deleted by mistake, or move to a new phone."));
    var sync = el("p", "acct-sync", ""); card.appendChild(sync);
    lastLine = el("p", "acct-sub small", ""); card.appendChild(lastLine);

    card.appendChild(button("Back up now", "acct-btn-main", function (b) {
      guard(b, "Backing up…", async function () { var n = await makePoint("manual", "Backup"); say("Backed up " + n + " items ✓"); await refresh(); });
    }));

    card.appendChild(el("h3", "", "Restore points"));
    listBox = el("div", "bk-list"); card.appendChild(listBox);

    card.appendChild(el("h3", "", "Your backup file"));
    card.appendChild(el("p", "acct-sub small", "Download a file and keep it anywhere. You can restore from it at any time, even on a new phone."));
    var row = el("div", "bk-files");
    row.appendChild(button("⬇ Download backup", "acct-btn-alt", function () {
      var data = collect();
      var file = { app: "whimzyy", version: 1, exported_at: new Date().toISOString(), data: data };
      var blob = new Blob([JSON.stringify(file)], { type: "application/json" });
      var url = URL.createObjectURL(blob), a = el("a");
      a.href = url; a.download = "whimzyy-backup-" + new Date().toLocaleDateString("en-CA") + ".json";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
      say("Backup file saved (" + count(data) + " items).");
    }));
    var pick = el("input"); pick.type = "file"; pick.accept = "application/json,.json"; pick.hidden = true;
    pick.addEventListener("change", function () {
      var f = pick.files && pick.files[0]; pick.value = "";
      if (!f) { return; }
      if (f.size > 12 * 1024 * 1024) { say("That file is too big to be a Whimzyy backup.", true); return; }
      var rd = new FileReader();
      rd.onload = function () {
        var file;
        try { file = JSON.parse(String(rd.result)); } catch (e) { say("That file is not a Whimzyy backup.", true); return; }
        if (!file || file.app !== "whimzyy" || !file.data || typeof file.data !== "object") { say("That file is not a Whimzyy backup.", true); return; }
        var clean = {}, a = api();
        Object.keys(file.data).forEach(function (k) { if (a.syncable(k) && typeof file.data[k] === "string") { clean[k] = file.data[k]; } });
        if (!count(clean)) { say("That backup has nothing to restore.", true); return; }
        if (!window.confirm("Restore " + count(clean) + " items from " + (file.exported_at ? when(file.exported_at) : "this file") + "? What you have now is saved as a restore point first.")) { return; }
        say("Restoring…");
        restoreData(clean).catch(function (e) { say(e.message || "Could not restore.", true); });
      };
      rd.onerror = function () { say("Could not read that file.", true); };
      rd.readAsText(f);
    });
    row.appendChild(button("⬆ Restore from file", "acct-btn-alt", function () { pick.click(); }));
    row.appendChild(pick);
    card.appendChild(row);

    msgBox = el("p", "acct-msg", ""); card.appendChild(msgBox);
    card.appendChild(el("p", "acct-sub small", "Pictures in Day Dump and your vision boards are stored safely in the cloud separately, so they are not inside these files."));
    overlay.appendChild(card);
    var st = { syncing: "Syncing…", synced: "Live sync: all saved to the cloud ✓", error: "Live sync problem: " + ((window.WhimzyySync.error && window.WhimzyySync.error()) || "will retry"), off: "" };
    sync.textContent = st[window.WhimzyySync.status()] || "";
  }

  function open() {
    var a = api();
    if (!a || !a.enabled() || !client()) { window.alert("Please log in first."); return; }
    if (!overlay) { build(); }
    paint();
    overlay.classList.add("open");
    refresh();
  }

  window.WhimzyyBackup = { open: open, auto: auto };
})();
