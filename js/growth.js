/* growth.js: vision boards on the Growth page.
   Pictures are squeezed small in the browser, saved in your private Supabase storage ("vision" bucket),
   and each board is one row in the "vision_boards" table (run sql/growth.sql once to create them). */
(function () {
  "use strict";

  var MIN = 8, MAX = 10, BUCKET = "vision";

  var createBtn = document.getElementById("gwCreate");
  var strip = document.getElementById("gwStrip");
  var emptyNote = document.getElementById("gwEmpty");
  var previewBox = document.getElementById("gwPreview");

  var auth = null, boards = [];

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (text != null) { n.textContent = text; }
    return n;
  }
  function whenAuth(cb) {
    var timer = setTimeout(function () { cb(null); }, 6000);
    function ok() { clearTimeout(timer); cb(window.WhimzyyAuth); }
    if (window.WhimzyyAuth && window.WhimzyyAuth.loaded) { ok(); return; }
    window.addEventListener("whimzyy-auth", function h() {
      if (window.WhimzyyAuth && window.WhimzyyAuth.loaded) { window.removeEventListener("whimzyy-auth", h); ok(); }
    });
  }
  function newId() {
    if (window.crypto && crypto.randomUUID) { return crypto.randomUUID(); }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 3 | 8)).toString(16);
    });
  }

  /* shrink a picture to about 1000px wide and make a small JPEG (keeps uploads light) */
  function squeeze(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var max = 1000, w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h));
        var c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (blob) { blob ? resolve(blob) : reject(new Error("Could not read that picture.")); }, "image/jpeg", 0.82);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("That file is not a picture we can open.")); };
      img.src = url;
    });
  }

  /* ---------- the "create" pop-up ---------- */
  var modal = null, state = null;

  function buildModal() {
    modal = el("div", "gw-modal");
    modal.setAttribute("role", "dialog"); modal.setAttribute("aria-label", "Create a vision board");
    var sheet = el("div", "gw-sheet");
    sheet.appendChild(el("h2", "", "Create a vision board"));
    sheet.appendChild(el("p", "", "Add 8 to 10 pictures. Tag each one with a word or two about it (travel, calm, my dream room)."));

    var title = el("input", "gw-field"); title.placeholder = "Name your board (optional)"; title.maxLength = 40;
    title.setAttribute("aria-label", "Board name");
    sheet.appendChild(title);

    var count = el("p", "gw-count", "");
    sheet.appendChild(count);
    var tiles = el("div", "gw-tiles");
    sheet.appendChild(tiles);

    var file = el("input"); file.type = "file"; file.accept = "image/*"; file.multiple = true; file.hidden = true;
    sheet.appendChild(file);

    sheet.appendChild(el("p", "gw-collage-title", "Your collage"));
    var collage = el("div", "gw-collage");
    sheet.appendChild(collage);

    var status = el("p", "gw-status", ""); status.setAttribute("aria-live", "polite");
    sheet.appendChild(status);
    var actions = el("div", "gw-actions");
    var cancel = el("button", "gw-btn ghost", "Cancel"); cancel.type = "button";
    var save = el("button", "gw-btn", "Save vision board"); save.type = "button";
    actions.appendChild(cancel); actions.appendChild(save);
    sheet.appendChild(actions);
    modal.appendChild(sheet);
    document.body.appendChild(modal);

    state = { items: [], busy: false, tiles: tiles, collage: collage, count: count, save: save, status: status, title: title, file: file };

    file.addEventListener("change", function () { addFiles(Array.prototype.slice.call(file.files)); file.value = ""; });
    cancel.addEventListener("click", closeModal);
    modal.addEventListener("click", function (e) { if (e.target === modal) { closeModal(); } });
    save.addEventListener("click", saveBoard);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && modal.classList.contains("open") && !state.busy) { closeModal(); } });
  }

  function say(text, bad) { state.status.textContent = text || ""; state.status.className = "gw-status" + (bad ? " bad" : ""); }

  function addFiles(files) {
    var room = MAX - state.items.length;
    var picked = files.filter(function (f) { return /^image\//.test(f.type); }).slice(0, room);
    if (files.length > picked.length) { say("A board holds at most " + MAX + " pictures.", true); } else { say(""); }
    picked.reduce(function (chain, f) {
      return chain.then(function () {
        return squeeze(f).then(function (blob) {
          state.items.push({ blob: blob, url: URL.createObjectURL(blob), tag: "" });
          paintModal();
        }).catch(function (err) { say(err.message, true); });
      });
    }, Promise.resolve());
  }

  function paintModal() {
    var n = state.items.length;
    state.count.textContent = n + " of " + MAX + " pictures" + (n < MIN ? " (add at least " + (MIN - n) + " more)" : " ✓");
    state.count.className = "gw-count" + (n >= MIN ? " ok" : "");
    state.save.disabled = n < MIN || state.busy;

    state.tiles.textContent = "";
    state.items.forEach(function (it, i) {
      var tile = el("div", "gw-tile");
      var img = el("img"); img.src = it.url; img.alt = it.tag || "Picture " + (i + 1);
      var x = el("button", "gw-x", "✕"); x.type = "button"; x.setAttribute("aria-label", "Remove picture " + (i + 1));
      x.addEventListener("click", function () { URL.revokeObjectURL(it.url); state.items.splice(i, 1); paintModal(); });
      var tag = el("input"); tag.placeholder = "Tag: e.g. travel"; tag.maxLength = 30; tag.value = it.tag;
      tag.setAttribute("aria-label", "Tag for picture " + (i + 1));
      tag.addEventListener("input", function () { it.tag = tag.value; paintCollage(); });
      tile.appendChild(img); tile.appendChild(x); tile.appendChild(tag);
      state.tiles.appendChild(tile);
    });
    if (n < MAX) {
      var add = el("button", "gw-add"); add.type = "button";
      add.appendChild(el("span", "", "+")); add.appendChild(document.createTextNode("Add pictures"));
      add.addEventListener("click", function () { state.file.click(); });
      state.tiles.appendChild(add);
    }
    paintCollage();
  }

  function paintCollage() {
    state.collage.textContent = "";
    state.items.forEach(function (it) {
      var fig = el("figure", "gw-piece");
      var img = el("img"); img.src = it.url; img.alt = it.tag || "";
      fig.appendChild(img);
      if (it.tag.trim()) { fig.appendChild(el("figcaption", "", it.tag.trim())); }
      state.collage.appendChild(fig);
    });
  }

  function openModal() {
    if (!auth || !auth.client) { alert("Cloud saving is not connected yet. Check js/supabase-config.js."); return; }
    if (!auth.user) {
      alert("Log in first (the account button), so your vision boards are saved to your account.");
      var b = document.getElementById("acctBtn"); if (b) { b.click(); }
      return;
    }
    if (!modal) { buildModal(); }
    state.items.forEach(function (it) { URL.revokeObjectURL(it.url); });
    state.items = []; state.title.value = ""; say("");
    paintModal();
    modal.classList.add("open");
  }
  function closeModal() { if (modal) { modal.classList.remove("open"); } }

  async function saveBoard() {
    if (state.busy || state.items.length < MIN) { return; }
    state.busy = true; state.save.disabled = true;
    var client = auth.client, uid = auth.user.id, id = newId(), paths = [];
    try {
      var items = [];
      for (var i = 0; i < state.items.length; i++) {
        say("Uploading picture " + (i + 1) + " of " + state.items.length + "…");
        var path = uid + "/" + id + "/" + (i + 1) + ".jpg";
        var up = await client.storage.from(BUCKET).upload(path, state.items[i].blob, { contentType: "image/jpeg", upsert: false });
        if (up.error) { throw up.error; }
        paths.push(path);
        items.push({ path: path, tag: state.items[i].tag.trim() });
      }
      say("Saving your board…");
      var ins = await client.from("vision_boards").insert({ id: id, user_id: uid, title: state.title.value.trim() || null, items: items });
      if (ins.error) { throw ins.error; }
      closeModal();
      await loadBoards();
    } catch (err) {
      if (paths.length) { client.storage.from(BUCKET).remove(paths).then(function () {}, function () {}); }
      say("Could not save: " + (err && err.message ? err.message : "something went wrong") + ". Did you run sql/growth.sql in Supabase?", true);
    }
    state.busy = false; paintModal();
  }

  /* ---------- the saved boards ---------- */
  async function signed(items) {
    var r = await auth.client.storage.from(BUCKET).createSignedUrls(items.map(function (x) { return x.path; }), 3600);
    var map = {};
    (r.data || []).forEach(function (d) { if (d && d.signedUrl) { map[d.path] = d.signedUrl; } });
    return map;
  }

  async function loadBoards() {
    if (!auth || !auth.client || !auth.user) { return; }
    var r = await auth.client.from("vision_boards").select("*").order("created_at", { ascending: false });
    if (r.error) { emptyNote.textContent = "Could not load your boards. Run sql/growth.sql in Supabase first."; return; }
    boards = r.data || [];
    var all = [];
    boards.forEach(function (b) { (b.items || []).forEach(function (x) { all.push(x); }); });
    var urls = all.length ? await signed(all) : {};
    boards.forEach(function (b) { b._urls = urls; });
    paintStrip();
    paintPreview(urls);
  }

  function dateText(iso) { return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }

  function paintStrip() {
    Array.prototype.slice.call(strip.querySelectorAll(".gw-board")).forEach(function (n) { n.remove(); });
    emptyNote.hidden = boards.length > 0;
    boards.forEach(function (b) {
      var card = el("button", "gw-board"); card.type = "button";
      var grid = el("div", "gw-board-grid");
      (b.items || []).slice(0, 8).forEach(function (x) {
        var img = el("img"); img.loading = "lazy"; img.alt = ""; img.src = b._urls[x.path] || ""; grid.appendChild(img);
      });
      card.appendChild(grid);
      card.appendChild(el("p", "gw-board-title", b.title || "Vision board"));
      card.appendChild(el("p", "gw-board-date", dateText(b.created_at)));
      card.addEventListener("click", function () { openBoard(b); });
      strip.appendChild(card);
    });
  }

  function paintPreview(urls) {
    previewBox.textContent = "";
    if (!boards.length) { return; }
    (boards[0].items || []).slice(0, 8).forEach(function (x) {
      var img = el("img"); img.alt = ""; img.src = urls[x.path] || ""; previewBox.appendChild(img);
    });
  }

  var viewer = null;
  function openBoard(b) {
    if (!viewer) {
      viewer = el("div", "gw-modal");
      viewer.setAttribute("role", "dialog"); viewer.setAttribute("aria-label", "Vision board");
      viewer.addEventListener("click", function (e) { if (e.target === viewer) { viewer.classList.remove("open"); } });
      document.addEventListener("keydown", function (e) { if (e.key === "Escape") { viewer.classList.remove("open"); } });
      document.body.appendChild(viewer);
    }
    viewer.textContent = "";
    var sheet = el("div", "gw-sheet");
    sheet.appendChild(el("h2", "", b.title || "Vision board"));
    sheet.appendChild(el("p", "", "Made on " + dateText(b.created_at)));
    var collage = el("div", "gw-collage");
    (b.items || []).forEach(function (x) {
      var fig = el("figure", "gw-piece");
      var img = el("img"); img.alt = x.tag || ""; img.src = b._urls[x.path] || "";
      fig.appendChild(img);
      if (x.tag) { fig.appendChild(el("figcaption", "", x.tag)); }
      collage.appendChild(fig);
    });
    sheet.appendChild(collage);
    var actions = el("div", "gw-actions");
    var del = el("button", "gw-btn danger", "Delete board"); del.type = "button";
    var close = el("button", "gw-btn", "Close"); close.type = "button";
    close.addEventListener("click", function () { viewer.classList.remove("open"); });
    del.addEventListener("click", async function () {
      if (!window.confirm("Delete this vision board? This cannot be undone.")) { return; }
      del.disabled = true;
      await auth.client.storage.from(BUCKET).remove((b.items || []).map(function (x) { return x.path; }));
      await auth.client.from("vision_boards").delete().eq("id", b.id);
      viewer.classList.remove("open");
      await loadBoards();
    });
    actions.appendChild(del); actions.appendChild(close);
    sheet.appendChild(actions);
    viewer.appendChild(sheet);
    viewer.classList.add("open");
  }

  /* ---------- start ---------- */
  createBtn.addEventListener("click", openModal);
  whenAuth(function (a) {
    auth = a;
    if (!a || !a.client) { emptyNote.textContent = "Cloud saving is not connected yet. Check js/supabase-config.js."; return; }
    if (!a.user) { emptyNote.textContent = "Log in (account button) to see and make vision boards."; }
    loadBoards();
    window.addEventListener("whimzyy-auth", function () { auth = window.WhimzyyAuth; if (auth.user) { loadBoards(); } else { boards = []; paintStrip(); } });
  });
})();
