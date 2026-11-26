/* daydump.js: "Day Dump 📸", photos of your day.
   - My Day: the greeting card becomes the Day Dump card (add today's pics, public/private switch).
   - Dayverse: a Day dump card for the day you are looking at.
   - Search Homies: tap a friend (or your own account button) to open a day-by-day gallery.
   Pictures are squeezed in the browser, saved in the private "daydump" bucket, one row each in "day_photos".
   Run sql/daydump.sql once in Supabase. One public/private switch covers all days; only followers can see public ones. */
(function () {
  "use strict";
  if (window.WzDump) { return; }

  var BUCKET = "daydump", MAX = 6;
  var auth = null, authReady = false;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (text != null) { n.textContent = text; }
    return n;
  }
  function keyOf(d) { return d.toLocaleDateString("en-CA"); }
  function pretty(key) {
    var p = key.split("-").map(Number);
    return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  }
  function whenAuth(cb) {
    var t = setTimeout(function () { cb(null); }, 6000), done = false;
    function ok() { if (done) { return; } done = true; clearTimeout(t); cb(window.WhimzyyAuth); }
    if (window.WhimzyyAuth && window.WhimzyyAuth.loaded) { ok(); return; }
    window.addEventListener("whimzyy-auth", function h() {
      if (window.WhimzyyAuth && window.WhimzyyAuth.loaded) { window.removeEventListener("whimzyy-auth", h); ok(); }
    });
  }
  function db() { return auth.client; }
  function loggedIn() { return !!(auth && auth.client && window.WhimzyyAuth && window.WhimzyyAuth.user); }
  function me() { return window.WhimzyyAuth && window.WhimzyyAuth.user; }
  function openLogin() { var b = document.getElementById("acctBtn"); if (b) { b.click(); } }
  function friendly(err) {
    var m = (err && (err.message || err.error_description)) || "Something went wrong.";
    if (/permission denied|does not exist|day_photos|schema cache/i.test(m)) { return "Cloud is not ready for Day Dump yet. Run sql/daydump.sql in Supabase. (" + m + ")"; }
    return m;
  }

  /* ---------- pictures ---------- */
  function squeeze(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var max = 1000, w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h));
        var c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { b ? resolve(b) : reject(new Error("Could not read that picture.")); }, "image/jpeg", 0.82);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("That file is not a picture we can open.")); };
      img.src = url;
    });
  }

  /* ---------- cloud ---------- */
  async function fetchDay(uid, day) {
    var r = await db().from("day_photos").select("id,path,day,created_at").eq("user_id", uid).eq("day", day).order("created_at", { ascending: true });
    if (r.error) { throw r.error; }
    var rows = r.data || [], urls = {};
    if (rows.length) {
      var s = await db().storage.from(BUCKET).createSignedUrls(rows.map(function (x) { return x.path; }), 3600);
      if (s.error) { throw s.error; }
      (s.data || []).forEach(function (o) { if (o && o.path) { urls[o.path] = o.signedUrl; } });
    }
    return { rows: rows, urls: urls };
  }
  async function fetchDays(uid) {
    var r = await db().from("day_photos").select("day").eq("user_id", uid).order("day", { ascending: false }).limit(600);
    if (r.error) { throw r.error; }
    var seen = {}, out = [];
    (r.data || []).forEach(function (x) { if (!seen[x.day] && out.length < 60) { seen[x.day] = 1; out.push(x.day); } });
    return out;
  }
  async function addPhotos(day, files, have) {
    var uid = me().id, room = MAX - have, list = Array.prototype.slice.call(files).slice(0, Math.max(0, room));
    var added = 0;
    for (var i = 0; i < list.length; i++) {
      var blob = await squeeze(list[i]);
      var path = uid + "/" + day + "/" + Date.now() + "-" + i + ".jpg";
      var up = await db().storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg" });
      if (up.error) { throw up.error; }
      var ins = await db().from("day_photos").insert({ user_id: uid, day: day, path: path });
      if (ins.error) { await db().storage.from(BUCKET).remove([path]); throw ins.error; }
      added++;
    }
    return { added: added, skipped: files.length - list.length };
  }
  async function removePhoto(row) {
    await db().storage.from(BUCKET).remove([row.path]);
    var r = await db().from("day_photos").delete().eq("id", row.id);
    if (r.error) { throw r.error; }
  }
  async function getPublic() {
    var r = await db().from("profiles").select("dump_public").eq("user_id", me().id).maybeSingle();
    if (r.error) { throw r.error; }
    return r.data ? { has: true, value: !!r.data.dump_public } : { has: false, value: false };
  }
  async function setPublic(v) {
    var r = await db().from("profiles").update({ dump_public: v }).eq("user_id", me().id).select("user_id");
    if (r.error) { throw r.error; }
    if (!r.data || !r.data.length) { throw new Error("Pick your @username in Search Homies first, then you can go public."); }
  }

  /* ---------- little UI pieces ---------- */
  function lightbox(src) {
    var o = el("div", "dd-light");
    var img = el("img"); img.src = src; img.alt = "Day dump picture";
    o.appendChild(img);
    o.addEventListener("click", function () { o.remove(); });
    document.body.appendChild(o);
  }

  function makeSwitch(onLabel, offLabel) {
    var wrap = el("div", "dd-priv"), sw = el("button", "dd-switch"), label = el("span", "dd-priv-text");
    sw.type = "button"; sw.setAttribute("role", "switch"); sw.setAttribute("aria-checked", "false");
    wrap.appendChild(sw); wrap.appendChild(label);
    var state = { on: false, ready: false };
    function paint() { sw.setAttribute("aria-checked", state.on ? "true" : "false"); label.textContent = state.on ? onLabel : offLabel; }
    paint();
    sw.addEventListener("click", async function () {
      if (!loggedIn()) { openLogin(); return; }
      var next = !state.on; sw.disabled = true;
      try { await setPublic(next); state.on = next; paint(); wrap.dataset.err = ""; label.classList.remove("bad"); }
      catch (e) { label.textContent = friendly(e); label.classList.add("bad"); }
      sw.disabled = false;
    });
    wrap.load = async function () {
      try { var p = await getPublic(); state.on = p.value; paint(); label.classList.remove("bad"); }
      catch (e) { label.textContent = friendly(e); label.classList.add("bad"); }
    };
    return wrap;
  }

  /* a row of pictures for ONE day. opts: { getDay(), userId(), editable, onChange } */
  function makeStrip(opts) {
    var root = el("div", "dd-strip-wrap"), strip = el("div", "dd-strip"), note = el("p", "dd-note");
    var fileIn = el("input"); fileIn.type = "file"; fileIn.accept = "image/*"; fileIn.multiple = true; fileIn.hidden = true;
    root.appendChild(strip); root.appendChild(note); root.appendChild(fileIn);
    var current = { rows: [], urls: {} }, token = 0;

    function say(t, bad) { note.textContent = t || ""; note.classList.toggle("bad", !!bad); }

    function paint() {
      strip.textContent = "";
      current.rows.forEach(function (row) {
        var t = el("div", "dd-thumb"), b = el("button", "dd-pic"), img = el("img");
        b.type = "button"; b.title = "Open picture";
        img.src = current.urls[row.path] || ""; img.alt = "Day dump picture"; img.loading = "lazy";
        b.appendChild(img);
        b.addEventListener("click", function () { lightbox(img.src); });
        t.appendChild(b);
        if (opts.editable) {
          var x = el("button", "dd-del", "✕"); x.type = "button"; x.title = "Delete this picture"; x.setAttribute("aria-label", "Delete this picture");
          x.addEventListener("click", async function () {
            x.disabled = true;
            try { await removePhoto(row); await refresh(); if (opts.onChange) { opts.onChange(); } }
            catch (e) { say(friendly(e), true); x.disabled = false; }
          });
          t.appendChild(x);
        }
        strip.appendChild(t);
      });
      if (opts.editable && current.rows.length < MAX) {
        var add = el("button", "dd-add"); add.type = "button";
        add.appendChild(el("b", "", "+")); add.appendChild(el("span", "", "Add pics"));
        add.addEventListener("click", function () { if (!loggedIn()) { openLogin(); return; } fileIn.click(); });
        strip.appendChild(add);
      } else if (!current.rows.length) {
        strip.appendChild(el("p", "dd-empty", opts.emptyText || "No pictures for this day."));
      }
      if (root.onCount) { root.onCount(current.rows.length); }
    }

    async function refresh() {
      var mine = ++token;
      if (!authReady) { return; }
      if (!auth || !auth.client) { strip.textContent = ""; strip.appendChild(el("p", "dd-empty", "Cloud is not connected yet.")); return; }
      if (!loggedIn()) {
        strip.textContent = "";
        var b = el("button", "dd-login", "Log in to save your day dump 📸"); b.type = "button";
        b.addEventListener("click", openLogin);
        strip.appendChild(b); return;
      }
      var uid = opts.userId(); if (!uid) { return; }
      try {
        var res = await fetchDay(uid, opts.getDay());
        if (mine !== token) { return; }
        current = res; say(""); paint();
      } catch (e) { if (mine === token) { strip.textContent = ""; say(friendly(e), true); } }
    }

    fileIn.addEventListener("change", async function () {
      var files = Array.prototype.slice.call(fileIn.files || []); fileIn.value = "";
      if (!files || !files.length) { return; }
      say("Uploading…");
      try {
        var r = await addPhotos(opts.getDay(), files, current.rows.length);
        await refresh();
        if (r.skipped > 0) { say("Day dump holds " + MAX + " pictures a day, so " + r.skipped + " were skipped."); }
        if (opts.onChange) { opts.onChange(); }
      } catch (e) { say(friendly(e), true); }
    });

    root.refresh = refresh; root.say = say;
    return root;
  }

  /* ---------- gallery window (friend's days, or all of mine) ---------- */
  function openGallery(o) {
    var overlay = el("div", "dd-modal"), card = el("div", "dd-modal-card");
    overlay.appendChild(card);
    var head = el("div", "dd-modal-head");
    head.appendChild(el("h2", "", o.isMe ? "My Day Dump 📸" : (o.name || "Their") + "'s Day Dump 📸"));
    var close = el("button", "dd-modal-x", "✕"); close.type = "button"; close.setAttribute("aria-label", "Close");
    head.appendChild(close); card.appendChild(head);
    function shut() { overlay.remove(); document.removeEventListener("keydown", onKey); }
    function onKey(e) { if (e.key === "Escape") { shut(); } }
    close.addEventListener("click", shut);
    overlay.addEventListener("click", function (e) { if (e.target === overlay) { shut(); } });
    document.addEventListener("keydown", onKey);

    var chips = el("div", "dd-chips"), dayLabel = el("p", "dd-daylabel");
    var today = keyOf(new Date()), selected = today;
    var dateIn = null;
    if (o.isMe) {
      dateIn = el("input", "dd-date"); dateIn.type = "date"; dateIn.max = today; dateIn.value = today;
      dateIn.setAttribute("aria-label", "Pick a day");
      dateIn.addEventListener("change", function () { if (dateIn.value) { select(dateIn.value); } });
      card.appendChild(dateIn);
    }
    card.appendChild(chips); card.appendChild(dayLabel);

    var strip = makeStrip({
      editable: !!o.isMe,
      userId: function () { return o.userId; },
      getDay: function () { return selected; },
      emptyText: o.isMe ? "Nothing here yet." : "No pictures on this day.",
      onChange: loadChips
    });
    card.appendChild(strip);
    var sw = null;
    if (o.isMe) {
      sw = makeSwitch("Public: people who follow me can see my day dumps", "Private: only I can see my day dumps");
      card.appendChild(sw); sw.load();
    }
    document.body.appendChild(overlay);

    function select(day) {
      selected = day; if (dateIn) { dateIn.value = day; }
      dayLabel.textContent = day === today ? "Today · " + pretty(day) : pretty(day);
      Array.prototype.forEach.call(chips.children, function (c) { c.classList.toggle("on", c.dataset.day === day); });
      strip.refresh();
    }
    async function loadChips() {
      if (!loggedIn()) { strip.refresh(); return; }
      var days;
      try { days = await fetchDays(o.userId); } catch (e) { strip.say(friendly(e), true); return; }
      chips.textContent = "";
      if (o.isMe && days.indexOf(today) < 0) { days.unshift(today); }
      days.forEach(function (d) {
        var c = el("button", "dd-chip", d === today ? "Today" : pretty(d).replace(/^\w+, /, "").replace(/ \d{4}$/, ""));
        c.type = "button"; c.dataset.day = d;
        c.addEventListener("click", function () { select(d); });
        chips.appendChild(c);
      });
      if (!days.length) {
        chips.appendChild(el("p", "dd-empty", "Nothing to see yet. They may keep their day dump private, or just haven't posted."));
        dayLabel.textContent = ""; strip.textContent = ""; strip.appendChild(el("span")); return;
      }
      if (days.indexOf(selected) < 0 || (!o.isMe && selected === today && days[0] !== today)) { selected = days[0]; }
      select(selected);
    }
    loadChips();
  }

  /* ---------- My Day: the greeting card becomes Day Dump ---------- */
  function buildMyDay() {
    var card = document.querySelector(".greeting-card");
    if (!card || card.querySelector(".dd")) { return; }
    Array.prototype.slice.call(card.children).forEach(function (c) { c.classList.add("wz-old"); });
    card.classList.add("dd-card");
    var box = el("div", "dd");
    var top = el("div", "dd-top");
    var titles = el("div", "dd-titles");
    titles.appendChild(el("h2", "dd-title", "Day Dump 📸"));
    titles.appendChild(el("p", "dd-date-line", new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" }) + " · the pics that made today"));
    top.appendChild(titles);
    var count = el("span", "dd-count", "0/" + MAX);
    top.appendChild(count);
    box.appendChild(top);

    var strip = makeStrip({
      editable: true,
      userId: function () { return me() && me().id; },
      getDay: function () { return keyOf(new Date()); },
      emptyText: "Nothing yet. Add a pic or two."
    });
    strip.onCount = function (n) { count.textContent = n + "/" + MAX; };
    box.appendChild(strip);

    var foot = el("div", "dd-foot");
    var sw = makeSwitch("Public: followers can see", "Private: just me");
    var all = el("button", "dd-all", "All my days →"); all.type = "button";
    all.addEventListener("click", function () { if (!loggedIn()) { openLogin(); return; } openGallery({ userId: me().id, isMe: true }); });
    foot.appendChild(sw); foot.appendChild(all);
    box.appendChild(foot);
    card.appendChild(box);

    function start() { strip.refresh(); if (loggedIn()) { sw.load(); } }
    start();
    window.addEventListener("whimzyy-auth", start);
    window.addEventListener("wz-dd-ready", start);
  }

  /* ---------- Dayverse: a card for the day you are looking at ---------- */
  function buildDayverse() {
    var col = document.querySelector(".dv-col:nth-child(2)");
    var picker = document.getElementById("datePicker");
    if (!col || !picker || col.querySelector(".dv-dump")) { return; }
    var art = el("article", "dv-card dv-dump");
    art.appendChild(el("h2", "", "Day dump 📸"));
    var strip = makeStrip({
      editable: true,
      userId: function () { return me() && me().id; },
      getDay: function () { return picker.value || keyOf(new Date()); },
      emptyText: "No pictures this day."
    });
    art.appendChild(strip);
    col.insertBefore(art, col.firstChild);
    strip.refresh();
    window.addEventListener("wz-dv-day", function () { strip.refresh(); });
    window.addEventListener("whimzyy-auth", function () { strip.refresh(); });
    window.addEventListener("wz-dd-ready", function () { strip.refresh(); });
  }

  window.WzDump = { openGallery: openGallery };

  buildMyDay();
  buildDayverse();
  whenAuth(function (a) {
    auth = a; authReady = true;
    window.dispatchEvent(new CustomEvent("wz-dd-ready"));
  });
})();
