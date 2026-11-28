/* study.js - Study Together: invites between homies (loaded on every page by rewards.js).
   - WzStudy.invite(person)   ask ONE homie to study together (a call-style ring, "Join" / "Not now")
   - listens for invites sent to you, on any page, and shows a small "X wants to study with you" card
   Uses Supabase Realtime "broadcast" only (no tables, no SQL). Video and chat live in html/study.html + js/study-room.js.
   Nothing here records anything: an invite is a short live message that disappears after 30 seconds. */
(function () {
  "use strict";
  if (window.WzStudy) { return; }

  var script = document.currentScript;
  var SRC = (script && script.src) || "";
  var ROOT = SRC ? new URL("../", SRC).href : "";
  var ROOM_PAGE = ROOT + "html/study.html";
  var RING_MS = 30000;                     // how long an invite rings before it counts as "offline or busy"
  var CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";   // no 0/O/1/I, so a spoken code is easy to type

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (text != null) { n.textContent = text; }
    return n;
  }
  function makeCode() {
    var r = new Uint8Array(6), s = "";
    (window.crypto || window.msCrypto).getRandomValues(r);
    for (var i = 0; i < r.length; i++) { s += CODE_CHARS.charAt(r[i] % CODE_CHARS.length); }
    return s;
  }
  function client() { return window.WhimzyyAuth && window.WhimzyyAuth.client; }
  function user() { return window.WhimzyyAuth && window.WhimzyyAuth.user; }
  function nameOf(u) {
    var m = (u && u.user_metadata) || {};
    if (u && u.is_anonymous) { return m.display_name || "Guest"; }
    return (m.name_set && m.display_name) || ((u && u.email) || "Homie").split("@")[0];
  }

  /* ---------- a little style, so every page can show the invite card and the Study buttons ---------- */
  (function css() {
    var s = document.createElement("style");
    s.textContent = [
      ".wz-st-toast{position:fixed;z-index:99999;left:50%;top:14px;transform:translateX(-50%);width:min(92vw,380px);box-sizing:border-box;",
      "  background:var(--wine,#6C1828);color:var(--warm-beige,#F3E7D3);border:2px solid var(--gold,#E8B86D);border-radius:20px;padding:14px 16px;",
      "  box-shadow:0 12px 36px rgba(0,0,0,.55);font:500 15px/1.4 'DM Sans',Arial,sans-serif;display:flex;flex-direction:column;gap:10px}",
      ".wz-st-toast b{color:var(--gold,#E8B86D)}",
      ".wz-st-row{display:flex;gap:8px;flex-wrap:wrap}",
      ".wz-st-btn{all:unset;box-sizing:border-box;cursor:pointer;text-align:center;padding:9px 16px;border-radius:999px;font:700 14px 'DM Sans',Arial,sans-serif;",
      "  background:var(--gold,#E8B86D);color:var(--bg,#1F0508)}",
      ".wz-st-btn.alt{background:transparent;color:var(--gold,#E8B86D);border:2px solid var(--gold,#E8B86D);padding:7px 14px}",
      ".wz-st-btn:focus-visible{outline:2px solid var(--warm-beige,#F3E7D3);outline-offset:2px}",
      ".wz-st-veil{position:fixed;inset:0;z-index:99998;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:16px}",
      ".wz-st-card{background:var(--wine,#6C1828);color:var(--warm-beige,#F3E7D3);border:2px solid var(--gold,#E8B86D);border-radius:24px;padding:22px 20px;",
      "  width:min(92vw,360px);box-sizing:border-box;text-align:center;display:flex;flex-direction:column;gap:12px;font:500 15px/1.45 'DM Sans',Arial,sans-serif}",
      ".wz-st-card h2{margin:0;font:700 20px 'Bricolage Grotesque','DM Sans',Arial,sans-serif;color:var(--gold,#E8B86D)}",
      ".wz-st-card p{margin:0}",
      ".wz-st-pulse{width:64px;height:64px;border-radius:50%;margin:0 auto;display:flex;align-items:center;justify-content:center;font-size:30px;",
      "  background:rgba(232,184,109,.18);animation:wzStPulse 1.4s ease-in-out infinite}",
      "@keyframes wzStPulse{0%,100%{box-shadow:0 0 0 0 rgba(232,184,109,.5)}50%{box-shadow:0 0 0 16px rgba(232,184,109,0)}}",
      "@media (prefers-reduced-motion:reduce){.wz-st-pulse{animation:none}}",
      ".sh-actions{display:flex;gap:6px;align-items:center;justify-content:flex-end;flex-wrap:wrap}",
      ".wz-study-btn{all:unset;box-sizing:border-box;cursor:pointer;padding:6px 12px;border-radius:999px;font:700 13px 'DM Sans',Arial,sans-serif;",
      "  border:2px solid var(--gold,#E8B86D);color:var(--gold,#E8B86D);white-space:nowrap}",
      ".wz-study-btn:hover{background:rgba(232,184,109,.15)}",
      ".wz-study-btn:focus-visible{outline:2px solid var(--warm-beige,#F3E7D3);outline-offset:2px}"
    ].join("\n");
    document.head.appendChild(s);
  })();

  function toast(html, buttons, ms) {
    var box = el("div", "wz-st-toast"); box.setAttribute("role", "alert");
    var p = el("div"); p.appendChild(html); box.appendChild(p);
    var row = el("div", "wz-st-row");
    (buttons || []).forEach(function (b) {
      var x = el("button", "wz-st-btn" + (b.alt ? " alt" : ""), b.text); x.type = "button";
      x.addEventListener("click", function () { remove(); if (b.fn) { b.fn(); } });
      row.appendChild(x);
    });
    if (buttons && buttons.length) { box.appendChild(row); }
    document.body.appendChild(box);
    var t = setTimeout(remove, ms || 6000);
    function remove() { clearTimeout(t); if (box.parentNode) { box.parentNode.removeChild(box); } }
    return { remove: remove };
  }
  function say(text) { return toast(document.createTextNode(text), [{ text: "OK", alt: true }], 6000); }

  /* ---------- tiny helper: send one broadcast message to a channel, then let go of it ---------- */
  function sendOnce(topic, event, payload) {
    var c = client();
    if (!c) { return; }
    var ch = c.channel(topic, { config: { broadcast: { self: false } } });
    ch.subscribe(function (status) {
      if (status === "SUBSCRIBED") {
        ch.send({ type: "broadcast", event: event, payload: payload });
        setTimeout(function () { try { c.removeChannel(ch); } catch (e) { /* ignore */ } }, 1500);
      }
    });
  }

  function goToRoom(code, mode) {
    location.href = ROOM_PAGE + "?room=" + encodeURIComponent(code) + "&mode=" + (mode === "duo" ? "duo" : "group");
  }

  /* ---------- asking someone to study: "calling..." ---------- */
  var calls = {};   // room code -> { ch, pending: { userId: { timer, name } } }

  function listenForReplies(code) {
    if (calls[code]) { return calls[code]; }
    var c = client();
    var rec = { pending: {}, ch: null };
    rec.ch = c.channel("wz-call-" + code, { config: { broadcast: { self: false } } });
    rec.ch.on("broadcast", { event: "reply" }, function (msg) {
      var p = msg && msg.payload; if (!p || !rec.pending[p.from]) { return; }
      var one = rec.pending[p.from]; clearTimeout(one.timer); delete rec.pending[p.from];
      one.done(!!p.accept, p.name);
    });
    rec.ch.subscribe();
    calls[code] = rec;
    return rec;
  }
  function stopListening(code) {
    var rec = calls[code]; if (!rec) { return; }
    if (!Object.keys(rec.pending).length) { try { client().removeChannel(rec.ch); } catch (e) { /* ignore */ } delete calls[code]; }
  }

  /* person: { user_id, display_name, username }.   opts.code = an existing room (inviting from inside a group room).
     Without opts.code this starts a 1-to-1 study: the screen rings until they answer, then both go to the room. */
  function invite(person, opts) {
    opts = opts || {};
    var me = user(), c = client();
    if (!c || !me) { say("Log in first (the account button) to invite homies."); return; }
    if (!person || !person.user_id || person.user_id === me.id) { return; }
    var group = !!opts.code;
    var code = opts.code || makeCode();
    var shownName = person.display_name || person.username || "your homie";
    var rec = listenForReplies(code);
    var veil = null;

    function finish(accepted) {
      stopListening(code);
      if (veil) { veil.remove(); veil = null; }
      if (accepted) {
        if (!group) { goToRoom(code, "duo"); }
        else { say(shownName + " is joining your room."); }
      } else {
        say(shownName + " might be offline or busy right now. Try again a bit later.");
      }
    }
    if (rec.pending[person.user_id]) { return; }
    rec.pending[person.user_id] = {
      name: shownName,
      done: function (ok) { finish(ok); },
      timer: setTimeout(function () {
        if (rec.pending[person.user_id]) { delete rec.pending[person.user_id]; finish(false); }
      }, RING_MS)
    };

    if (!group) {
      var v = el("div", "wz-st-veil"), card = el("div", "wz-st-card"); v.appendChild(card);
      card.appendChild(el("div", "wz-st-pulse", "📚"));
      card.appendChild(el("h2", "", "Calling " + shownName + "…"));
      card.appendChild(el("p", "", "Waiting for them to join a study session with you."));
      var cancel = el("button", "wz-st-btn alt", "Cancel"); cancel.type = "button";
      cancel.addEventListener("click", function () {
        if (rec.pending[person.user_id]) { clearTimeout(rec.pending[person.user_id].timer); delete rec.pending[person.user_id]; }
        stopListening(code); v.remove(); veil = null;
      });
      card.appendChild(cancel);
      document.body.appendChild(v);
      veil = v;
    }

    sendOnce("wz-inbox-" + person.user_id, "invite", {
      code: code, mode: group ? "group" : "duo", fromId: me.id, fromName: nameOf(me), at: Date.now()
    });
  }

  /* ---------- being invited: listen on your own inbox, on any page ---------- */
  var inboxCh = null, inboxFor = null, showing = null;

  function reply(code, accept) {
    var me = user();
    sendOnce("wz-call-" + code, "reply", { from: me.id, name: nameOf(me), accept: !!accept });
  }
  function onInvite(p) {
    if (!p || !p.code || !p.fromId || !/^[A-Z0-9]{4,8}$/.test(String(p.code))) { return; }
    if (Date.now() - (p.at || 0) > RING_MS + 5000) { return; }           // an old message: ignore it
    var me = user(); if (!me || p.fromId === me.id) { return; }
    var mode = p.mode === "duo" ? "duo" : "group";
    // already in a study room, or already looking at another invite: politely say "busy"
    if (window.__wzInStudyRoom || showing) { reply(p.code, false); return; }
    var msg = document.createElement("span");
    var b = el("b", "", String(p.fromName || "A homie").slice(0, 40));
    msg.appendChild(b);
    msg.appendChild(document.createTextNode(mode === "duo" ? " wants to study with you 📚" : " invited you to a group study room 📚"));
    showing = toast(msg, [
      { text: "Join", fn: function () { showing = null; reply(p.code, true); setTimeout(function () { goToRoom(p.code, mode); }, 250); } },
      { text: "Not now", alt: true, fn: function () { showing = null; reply(p.code, false); } }
    ], RING_MS);
    setTimeout(function () { showing = null; }, RING_MS);
  }
  function startInbox() {
    var u = user(), c = client();
    if (!c || !u || u.is_anonymous) { stopInbox(); return; }              // guests cannot be found by username, so no inbox
    if (inboxCh && inboxFor === u.id) { return; }
    stopInbox();
    inboxFor = u.id;
    inboxCh = c.channel("wz-inbox-" + u.id, { config: { broadcast: { self: false } } });
    inboxCh.on("broadcast", { event: "invite" }, function (m) { onInvite(m && m.payload); });
    inboxCh.subscribe();
  }
  function stopInbox() {
    if (inboxCh && client()) { try { client().removeChannel(inboxCh); } catch (e) { /* ignore */ } }
    inboxCh = null; inboxFor = null;
  }

  /* wait for the account system, then listen */
  var tries = 0;
  (function wait() {
    if (window.WhimzyyAuth && window.WhimzyyAuth.loaded) { startInbox(); return; }
    if (++tries < 80) { setTimeout(wait, 250); }
  })();
  window.addEventListener("whimzyy-auth", startInbox);

  window.WzStudy = {
    invite: invite,
    makeCode: makeCode,
    roomUrl: function (code, mode) { return ROOM_PAGE + "?room=" + encodeURIComponent(code) + "&mode=" + (mode === "duo" ? "duo" : "group"); },
    lobbyUrl: ROOM_PAGE,
    nameOf: nameOf
  };
})();
