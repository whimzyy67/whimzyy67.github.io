/* search-homies.js: pick a @username, find friends, follow them and see their progress %.
   Tables come from sql/growth.sql (profiles, follows, and the public_profiles view). */
(function () {
  "use strict";

  var searchForm = document.getElementById("shSearchForm");
  var searchInput = document.getElementById("shSearch");
  var resultsBox = document.getElementById("shResults");
  var accountBox = document.getElementById("shAccount");
  var listBox = document.getElementById("shList");
  var tabFollowing = document.getElementById("shTabFollowing");
  var tabFollowers = document.getElementById("shTabFollowers");

  var auth = null, me = null, profile = null, tab = "following", following = {}, timer = null;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (text != null) { n.textContent = text; }
    return n;
  }
  function whenAuth(cb) {
    var t = setTimeout(function () { cb(null); }, 6000);
    function ok() { clearTimeout(t); cb(window.WhimzyyAuth); }
    if (window.WhimzyyAuth && window.WhimzyyAuth.loaded) { ok(); return; }
    window.addEventListener("whimzyy-auth", function h() {
      if (window.WhimzyyAuth && window.WhimzyyAuth.loaded) { window.removeEventListener("whimzyy-auth", h); ok(); }
    });
  }
  function note(box, text) { box.textContent = ""; box.appendChild(el("p", box === resultsBox ? "sh-hint" : "sh-empty", text)); }
  function db() { return auth.client; }
  function firstName(u) {
    var m = (u && u.user_metadata) || {};
    return (m.name_set && m.display_name) || ((u && u.email) || "Homie").split("@")[0];
  }

  /* one person as a row: avatar, name, @username, and progress (or a lock) */
  function personRow(p, extra) {
    var row = el("li", "sh-row");
    row.title = "Tap to see their Day Dump";
    row.style.cursor = "pointer";
    row.addEventListener("click", function (e) {
      if (e.target.closest("button")) { return; }
      if (window.WzDump) { window.WzDump.openGallery({ userId: p.user_id, name: p.display_name || p.username, isMe: false }); }
    });
    row.appendChild(el("div", "sh-avatar small", (p.display_name || p.username || "?").charAt(0)));
    var id = el("div", "sh-id");
    id.appendChild(el("h2", "", p.display_name || p.username));
    id.appendChild(el("p", "", "@" + p.username));
    row.appendChild(id);
    if (extra && window.WzStudy && following[p.user_id]) {
      // homies you follow get a "Study" button beside Follow: it rings them for a 1-to-1 study session
      var acts = el("div", "sh-actions");
      var sb = el("button", "wz-study-btn", "📚 Study"); sb.type = "button"; sb.title = "Study together with " + (p.display_name || p.username);
      sb.addEventListener("click", function () { window.WzStudy.invite(p); });
      acts.appendChild(sb); acts.appendChild(extra);
      row.appendChild(acts);
    } else if (extra) { row.appendChild(extra); } else { row.appendChild(el("span")); }
    var bar = el("div", "sh-bar");
    if (p.progress == null) {
      bar.appendChild(el("span", "", "🔒 Progress is private"));
    } else {
      var track = el("i"), fill = el("b"); fill.style.width = Math.max(0, Math.min(100, p.progress)) + "%"; track.appendChild(fill);
      bar.appendChild(track);
      bar.appendChild(el("span", "", p.progress + "% overall" + (p.today != null ? " · " + p.today + "% today" : "")));
    }
    row.appendChild(bar);
    return row;
  }

  function followButton(p, onChange) {
    var b = el("button", "sh-follow" + (following[p.user_id] ? " on" : ""), following[p.user_id] ? "Following" : "Follow");
    b.type = "button";
    b.addEventListener("click", async function () {
      b.disabled = true;
      if (following[p.user_id]) {
        var d = await db().from("follows").delete().eq("follower_id", me.id).eq("followee_id", p.user_id);
        if (!d.error) { delete following[p.user_id]; }
      } else {
        var r = await db().from("follows").insert({ follower_id: me.id, followee_id: p.user_id });
        if (!r.error) { following[p.user_id] = true; }
      }
      b.disabled = false;
      b.textContent = following[p.user_id] ? "Following" : "Follow";
      b.classList.toggle("on", !!following[p.user_id]);
      if (onChange) { onChange(); }
    });
    return b;
  }

  /* ---------- your account (bottom of the left side) ---------- */
  async function loadProfile() {
    var r = await db().from("profiles").select("*").eq("user_id", me.id).maybeSingle();
    if (r.error) {
      console.warn("Whimzyy profiles error:", r.error);
      note(accountBox, "Could not load your account. Run sql/growth.sql in Supabase first. (Supabase says: " + (r.error.message || r.error.code || "unknown error") + ")");
      return false;
    }
    profile = r.data || null;
    return true;
  }

  function usernameForm() {
    accountBox.textContent = "";
    var form = el("form", "sh-form");
    form.appendChild(el("h2", "", "Choose your @username"));
    form.appendChild(el("p", "", "Friends find you with it. 3 to 20 letters, numbers, dots or underscores."));
    var row = el("div", "row");
    var input = el("input"); input.placeholder = "e.g. cool.homie"; input.maxLength = 20; input.autocapitalize = "none"; input.spellcheck = false;
    input.setAttribute("aria-label", "Username");
    var go = el("button", "sh-follow", "Save"); go.type = "submit";
    row.appendChild(input); row.appendChild(go);
    var msg = el("p", "sh-msg", "");
    form.appendChild(row); form.appendChild(msg);
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      var name = input.value.trim().toLowerCase();
      if (!/^[a-z0-9_.]{3,20}$/.test(name)) { msg.textContent = "Use 3 to 20 letters, numbers, dots or underscores."; msg.className = "sh-msg bad"; return; }
      go.disabled = true;
      var p = auth.computeProgress();
      var r = await db().from("profiles").insert({ user_id: me.id, username: name, display_name: firstName(me), progress: p.overall, today: p.today, progress_public: false, dump_public: false });
      go.disabled = false;
      if (r.error) {
        msg.textContent = (r.error.code === "23505" || /duplicate|unique/i.test(r.error.message || "")) ? "That username is taken. Try another." : r.error.message;
        msg.className = "sh-msg bad"; return;
      }
      await boot();
    });
    accountBox.appendChild(form);
    setTimeout(function () { input.focus(); }, 50);
  }

  async function counts() {
    var a = await db().from("follows").select("*", { count: "exact", head: true }).eq("followee_id", me.id);
    var b = await db().from("follows").select("*", { count: "exact", head: true }).eq("follower_id", me.id);
    return { followers: a.count || 0, following: b.count || 0 };
  }

  async function paintAccount() {
    var c = await counts();
    var p = auth.computeProgress();
    accountBox.textContent = "";
    accountBox.appendChild(el("div", "sh-avatar", (profile.display_name || profile.username).charAt(0)));
    var id = el("div", "sh-id");
    id.appendChild(el("h2", "", profile.display_name || profile.username));
    id.appendChild(el("p", "", "@" + profile.username));
    accountBox.appendChild(id);
    var ring = el("div", "sh-ring"); ring.style.setProperty("--p", p.overall);
    ring.setAttribute("role", "img"); ring.setAttribute("aria-label", "Overall progress " + p.overall + " percent");
    ring.appendChild(el("b", "", p.overall + "%"));
    accountBox.appendChild(ring);

    var stats = el("div", "sh-stats");
    var s1 = el("button", "sh-stat"); s1.type = "button"; s1.appendChild(el("b", "", String(c.followers))); s1.appendChild(el("span", "", "followers"));
    var s2 = el("button", "sh-stat"); s2.type = "button"; s2.appendChild(el("b", "", String(c.following))); s2.appendChild(el("span", "", "following"));
    var s3 = el("div", "sh-stat"); s3.appendChild(el("b", "", p.today + "%")); s3.appendChild(el("span", "", "today"));
    s1.addEventListener("click", function () { setTab("followers"); });
    s2.addEventListener("click", function () { setTab("following"); });
    stats.appendChild(s1); stats.appendChild(s2); stats.appendChild(s3);
    var s4 = el("button", "sh-stat sh-dump"); s4.type = "button"; s4.appendChild(el("b", "", "📸")); s4.appendChild(el("span", "", "my day dump"));
    s4.addEventListener("click", function () { if (window.WzDump) { window.WzDump.openGallery({ userId: me.id, isMe: true }); } });
    stats.appendChild(s4);
    accountBox.appendChild(stats);

    if (window.WzStudy) {
      var st = el("button", "wz-study-btn", "📚 Study together · create or join a group room"); st.type = "button";
      st.style.alignSelf = "center"; st.style.margin = "8px 0 2px";
      st.addEventListener("click", function () { location.href = window.WzStudy.lobbyUrl; });
      accountBox.appendChild(st);
    }

    var priv = el("div", "sh-privacy");
    var sw = el("button", "sh-switch"); sw.type = "button"; sw.setAttribute("role", "switch");
    // ONE switch for everything (progress + day dump). Public only if both are on, so mixed old settings count as private.
    var isPub = !!profile.progress_public && !!profile.dump_public;
    var ON = "Public: followers can see my progress and day dump", OFF = "Private: only you see them";
    if (!isPub && (profile.progress_public || profile.dump_public)) {   // mixed old settings: make both private so the switch tells the truth
      profile.progress_public = false; profile.dump_public = false;
      db().from("profiles").update({ progress_public: false, dump_public: false }).eq("user_id", me.id).then(function () {}, function () {});
    }
    sw.setAttribute("aria-checked", isPub ? "true" : "false");
    var label = el("span", "", isPub ? ON : OFF);
    sw.addEventListener("click", async function () {
      var next = !isPub;
      sw.disabled = true;
      var r = await db().from("profiles").update({ progress_public: next, dump_public: next }).eq("user_id", me.id);
      sw.disabled = false;
      if (r.error) { label.textContent = "Could not save: " + (r.error.message || "try again"); return; }
      isPub = next; profile.progress_public = next; profile.dump_public = next;
      sw.setAttribute("aria-checked", next ? "true" : "false");
      label.textContent = next ? ON : OFF;
    });
    priv.appendChild(sw); priv.appendChild(label);
    accountBox.appendChild(priv);

    // keep the saved percentage fresh
    db().from("profiles").update({ progress: p.overall, today: p.today, updated_at: new Date().toISOString() }).eq("user_id", me.id).then(function () {}, function () {});
  }

  /* ---------- right side: following / followers ---------- */
  function setTab(name) {
    tab = name;
    tabFollowing.classList.toggle("active", name === "following"); tabFollowing.setAttribute("aria-selected", name === "following");
    tabFollowers.classList.toggle("active", name === "followers"); tabFollowers.setAttribute("aria-selected", name === "followers");
    paintList();
  }
  async function loadFollowing() {
    var r = await db().from("follows").select("followee_id").eq("follower_id", me.id);
    following = {};
    (r.data || []).forEach(function (x) { following[x.followee_id] = true; });
  }
  async function paintList() {
    listBox.textContent = "";
    var col = tab === "following" ? "follower_id" : "followee_id", other = tab === "following" ? "followee_id" : "follower_id";
    var r = await db().from("follows").select("follower_id,followee_id").eq(col, me.id);
    var ids = (r.data || []).map(function (x) { return x[other]; });
    if (!ids.length) {
      listBox.appendChild(el("li", "sh-empty", tab === "following" ? "You are not following anyone yet. Search a username above." : "No followers yet. Share your @username with friends."));
      return;
    }
    var pr = await db().from("public_profiles").select("*").in("user_id", ids);
    var rows = (pr.data || []).sort(function (a, b) { return (b.progress == null ? -1 : b.progress) - (a.progress == null ? -1 : a.progress); });
    listBox.textContent = "";
    rows.forEach(function (p) {
      listBox.appendChild(personRow(p, followButton(p, function () { if (tab === "following") { paintList(); } paintAccount(); })));
    });
  }

  /* ---------- search ---------- */
  async function runSearch() {
    var q = searchInput.value.trim().toLowerCase().replace(/^@/, "").replace(/[^a-z0-9_.]/g, "");
    if (!q) { note(resultsBox, "Type a username above to find your friends and follow them."); return; }
    note(resultsBox, "Searching…");
    var r = await db().from("public_profiles").select("*").ilike("username", q + "%").neq("user_id", me.id).limit(10);
    if (r.error) { note(resultsBox, "Search failed. Did you run sql/growth.sql in Supabase?"); return; }
    var rows = r.data || [];
    if (!rows.length) { note(resultsBox, "No one found with “" + q + "”."); return; }
    resultsBox.textContent = "";
    var ul = el("ul", "sh-list");
    rows.forEach(function (p) {
      ul.appendChild(personRow(p, followButton(p, function () { paintList(); paintAccount(); })));
    });
    resultsBox.appendChild(ul);
  }

  /* ---------- start ---------- */
  async function boot() {
    if (!(await loadProfile())) { return; }
    if (!profile) { usernameForm(); listBox.textContent = ""; return; }
    await loadFollowing();
    await paintAccount();
    await paintList();
  }

  tabFollowing.addEventListener("click", function () { setTab("following"); });
  tabFollowers.addEventListener("click", function () { setTab("followers"); });
  searchForm.addEventListener("submit", function (e) { e.preventDefault(); if (me && profile) { runSearch(); } });
  searchInput.addEventListener("input", function () {
    clearTimeout(timer);
    timer = setTimeout(function () { if (me && profile) { runSearch(); } }, 350);
  });

  whenAuth(function (a) {
    auth = a;
    if (!a || !a.client) { note(accountBox, "Cloud is not connected yet. Check js/supabase-config.js."); return; }
    me = a.user;
    if (!me) { note(accountBox, "Log in (account button) to find and follow homies."); return; }
    boot();
  });
  window.addEventListener("whimzyy-auth", function () {
    if (!auth || !auth.client) { return; }
    var u = window.WhimzyyAuth.user;
    if (u && (!me || me.id !== u.id)) { me = u; boot(); }
  });
})();
