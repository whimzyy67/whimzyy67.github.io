/* study-room.js - the Study Together room: video (no voice) + text chat + a shared study timer.

   How it works (no database, no SQL):
   - Everyone in a room joins one Supabase Realtime channel called "wz-study-<CODE>".
   - The channel carries the list of people (presence), chat messages, the shared timer, and the
     little "signal" messages that two browsers use to set up a direct video link (WebRTC).
   - Video goes straight between the browsers. Only the camera is used: the microphone is never asked for.

   Rooms: ?room=CODE&mode=group  (up to 4 people)   or   ?room=CODE&mode=duo  (1-to-1, up to 2 people).
   No ?room=  shows the lobby (create a room, or join with a code). */
(function () {
  "use strict";

  var MAX = { group: 4, duo: 2 };
  var ICE = window.WHIMZYY_ICE || [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }];

  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (text != null) { n.textContent = text; }
    return n;
  }

  /* ---------- the page address ---------- */
  var q = new URLSearchParams(location.search);
  var roomCode = (q.get("room") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  var mode = q.get("mode") === "duo" ? "duo" : "group";

  /* ---------- who am I ---------- */
  var auth = null, client = null, account = false, me = { id: "", name: "" };
  var peerId = Math.random().toString(36).slice(2, 8);      // my id inside the room (one per tab)

  function whenAuth(cb) {
    var done = false, t = setTimeout(function () { if (!done) { done = true; cb(window.WhimzyyAuth || null); } }, 6000);
    function ok() { if (done) { return; } done = true; clearTimeout(t); cb(window.WhimzyyAuth); }
    if (window.WhimzyyAuth && window.WhimzyyAuth.loaded) { ok(); return; }
    window.addEventListener("whimzyy-auth", function h() {
      if (window.WhimzyyAuth && window.WhimzyyAuth.loaded) { window.removeEventListener("whimzyy-auth", h); ok(); }
    });
  }
  function guestId() {
    try {
      var g = sessionStorage.getItem("wz-study-gid");
      if (!g) { g = "g" + Math.random().toString(36).slice(2, 10); sessionStorage.setItem("wz-study-gid", g); }
      return g;
    } catch (e) { return "g" + Math.random().toString(36).slice(2, 10); }
  }
  function show(id) {
    ["stLobby", "stJoin", "stRoom"].forEach(function (x) { $(x).hidden = (x !== id); });
    if (typeof needLandscape === "function") { needLandscape(id !== "stLobby"); }
    scene(id !== "stLobby");
  }
  var toastTimer = null;
  function toast(text) {
    var t = $("stToast"); t.textContent = text; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 4500);
  }
  function copy(text, okMsg) {
    function fallback() {
      var a = el("textarea"); a.value = text; a.setAttribute("readonly", ""); a.style.position = "fixed"; a.style.opacity = "0";
      document.body.appendChild(a); a.select();
      try { document.execCommand("copy"); toast(okMsg); } catch (e) { toast("Could not copy. Select and copy it by hand: " + text); }
      a.remove();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(function () { toast(okMsg); }, fallback); }
    else { fallback(); }
  }
  function linkFor(code) {
    var u = new URL(location.href); u.search = "?room=" + code + "&mode=group"; u.hash = "";
    return u.toString();
  }

  /* ---------- camera (video only, never audio) ---------- */
  var localStream = null, camWanted = true;

  function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { return Promise.resolve(null); }
    return navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 30 }, facingMode: "user" },
      audio: false
    }).then(function (s) { localStream = s; return s; }, function () { localStream = null; return null; });
  }
  function stopCamera() {
    if (localStream) { localStream.getTracks().forEach(function (t) { t.stop(); }); }
    localStream = null;
  }
  function localTrack() { return localStream ? localStream.getVideoTracks()[0] || null : null; }

  /* ---------- 1. LOBBY ---------- */
  function lobby() {
    show("stLobby");
    $("stCreate").addEventListener("click", function () {
      var code = window.WzStudy ? window.WzStudy.makeCode() : Math.random().toString(36).slice(2, 8).toUpperCase();
      location.href = "study.html?room=" + code + "&mode=group";
    });
    $("stJoinForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var c = $("stCodeIn").value.toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (c.length < 4) { $("stLobbyMsg").textContent = "Type the room code your homie sent you."; return; }
      location.href = "study.html?room=" + c + "&mode=group";
    });
  }

  /* ---------- 2. JOIN SCREEN (name + camera check) ---------- */
  function joinScreen() {
    show("stJoin");
    $("stJoinTitle").textContent = mode === "duo" ? "Study with your homie" : "Join the study room";
    $("stJoinSub").textContent = mode === "duo" ? "A quiet 1-to-1 study session." : "Room code: " + roomCode;
    $("stName").value = me.name || "";
    var video = $("stPreview"), off = $("stPreviewOff"), tog = $("stCamToggle"), msg = $("stJoinMsg");

    function paint() {
      var on = !!localStream;
      video.srcObject = on ? localStream : null;
      off.hidden = on; video.hidden = !on;
      tog.textContent = on ? "Turn camera off" : "Turn camera on";
    }
    function tryCam() {
      msg.textContent = "";
      startCamera().then(function (s) {
        if (!s) { msg.textContent = "No camera access. You can still join and chat, or allow the camera in your browser and try again."; }
        paint();
      });
    }
    tog.addEventListener("click", function () {
      if (localStream) { stopCamera(); camWanted = false; paint(); } else { camWanted = true; tryCam(); }
    });
    $("stJoinBtn").addEventListener("click", function () {
      var n = $("stName").value.replace(/\s+/g, " ").trim().slice(0, 24);
      if (!n) { msg.textContent = "Please type your name so others know who you are."; $("stName").focus(); return; }
      me.name = n;
      enterRoom();
    });
    $("stJoinBack").addEventListener("click", function () { stopCamera(); location.href = account ? "search-homies.html" : "study.html"; });
    paint();
    tryCam();
  }

  /* ---------- 3. THE ROOM ---------- */
  var ch = null, peers = {}, joinedAt = Date.now(), checkUntil = 0, left = false;
  var timerEnd = 0, timerTick = null, chatOpen = false, unread = 0, lastSend = 0;

  function makeTile(id, name, isMe) {
    var t = el("div", "st-tile" + (isMe ? " me" : "")), v = el("video");
    v.autoplay = true; v.playsInline = true; v.muted = true; v.setAttribute("playsinline", ""); v.setAttribute("muted", "");
    t.appendChild(v);
    t.appendChild(el("div", "st-off", "Camera off"));
    t.appendChild(el("div", "st-conn", "Connecting…"));
    t.appendChild(el("div", "st-name", name));
    t.dataset.id = id;
    var mv = el("button", "st-mv", "✥"); mv.type = "button"; mv.title = "Move or resize the friends panel"; mv.setAttribute("aria-label", "Move or resize the friends panel");
    mv.addEventListener("click", function () { startAlign(); });
    t.appendChild(mv);
    $("stVideos").appendChild(t);
    return t;
  }
  function paintTiles() {
    var all = $("stVideos"), n = all.querySelectorAll(".st-tile").length;
    all.dataset.count = String(n);
    all.classList.toggle("duo", mode === "duo");
    var w = $("stWait");
    if (n <= 1) {
      if (!w) { w = el("p", "st-wait", mode === "duo" ? "Waiting for your homie to join…" : "You are the first one here. Share the code or link so others can join."); w.id = "stWait"; all.appendChild(w); }
    } else if (w) { w.remove(); }
  }
  function setTileCam(tile, on) { tile.classList.toggle("cam-off", !on); }

  var myTile = null;
  function paintMine() {
    if (!myTile) { return; }
    var v = myTile.querySelector("video");
    v.srcObject = localStream || null;
    setTileCam(myTile, !!localStream);
    myTile.querySelector(".st-conn").hidden = true;
    $("stCamLbl").textContent = localStream ? "Camera on" : "Camera off";
    $("stCam").classList.toggle("off", !localStream);
  }
  function publish() {
    if (ch) { ch.track({ name: me.name, cam: !!localStream, at: joinedAt }); }
  }
  function sendTo(to, kind, data) {
    ch.send({ type: "broadcast", event: "sig", payload: { to: to, from: peerId, kind: kind, data: data } });
  }

  function getPeer(id, name) {
    var p = peers[id];
    if (!p) {
      p = peers[id] = { id: id, name: name || "Homie", pc: null, queue: [], tile: makeTile(id, name || "Homie", false), cam: true };
      p.tile.classList.add("cam-off");
      paintTiles();
    }
    if (name) { p.name = name; p.tile.querySelector(".st-name").textContent = name; }
    return p;
  }
  function makePc(p) {
    if (p.pc) { return p.pc; }
    var pc = p.pc = new RTCPeerConnection({ iceServers: ICE });
    pc.onicecandidate = function (e) { if (e.candidate) { sendTo(p.id, "ice", e.candidate.toJSON ? e.candidate.toJSON() : e.candidate); } };
    pc.ontrack = function (e) {
      var v = p.tile.querySelector("video");
      v.srcObject = (e.streams && e.streams[0]) || new MediaStream([e.track]);
      p.tile.querySelector(".st-conn").hidden = true;
      var play = v.play(); if (play && play.catch) { play.catch(function () { /* autoplay can wait for a tap */ }); }
    };
    pc.onconnectionstatechange = function () {
      var s = pc.connectionState;
      if (s === "connected") { p.tile.querySelector(".st-conn").hidden = true; }
      if (s === "failed" || s === "disconnected") {
        p.tile.querySelector(".st-conn").hidden = false;
        p.tile.querySelector(".st-conn").textContent = s === "failed" ? "Connection problem" : "Reconnecting…";
        if (s === "failed" && peerId < p.id) { offer(p, true); }
      }
    };
    return pc;
  }
  function videoSenders(pc) {
    return pc.getTransceivers().filter(function (t) { return t.receiver && t.receiver.track && t.receiver.track.kind === "video"; });
  }
  function offer(p, restart) {
    var pc = makePc(p);
    if (!videoSenders(pc).length) { pc.addTransceiver("video", { direction: "sendrecv" }); }
    videoSenders(pc).forEach(function (t) { t.sender.replaceTrack(localTrack()).catch(function () {}); });
    return pc.createOffer(restart ? { iceRestart: true } : undefined)
      .then(function (o) { return pc.setLocalDescription(o); })
      .then(function () { sendTo(p.id, "offer", { type: pc.localDescription.type, sdp: pc.localDescription.sdp }); })
      .catch(function (e) { console.warn("study offer failed", e); });
  }
  function flush(p) {
    var list = p.queue; p.queue = [];
    list.forEach(function (c) { p.pc.addIceCandidate(c).catch(function () {}); });
  }
  function onSig(m) {
    var s = m && m.payload; if (!s || s.to !== peerId || !s.from) { return; }
    var p = getPeer(s.from), pc;
    if (s.kind === "offer") {
      pc = makePc(p);
      pc.setRemoteDescription(s.data).then(function () {
        videoSenders(pc).forEach(function (t) { t.direction = "sendrecv"; t.sender.replaceTrack(localTrack()).catch(function () {}); });
        flush(p);
        return pc.createAnswer();
      }).then(function (a) { return pc.setLocalDescription(a); })
        .then(function () { sendTo(p.id, "answer", { type: pc.localDescription.type, sdp: pc.localDescription.sdp }); })
        .catch(function (e) { console.warn("study answer failed", e); });
    } else if (s.kind === "answer" && p.pc) {
      p.pc.setRemoteDescription(s.data).then(function () { flush(p); }).catch(function (e) { console.warn("study answer apply failed", e); });
    } else if (s.kind === "ice") {
      if (p.pc && p.pc.remoteDescription) { p.pc.addIceCandidate(s.data).catch(function () {}); } else { p.queue.push(s.data); }
    }
  }
  function dropPeer(id) {
    var p = peers[id]; if (!p) { return; }
    try { if (p.pc) { p.pc.close(); } } catch (e) { /* ignore */ }
    p.tile.remove(); delete peers[id];
    paintTiles();
  }

  /* who is in the room right now (called when the list changes) */
  function onSync() {
    var state = ch.presenceState(), list = [];
    Object.keys(state).forEach(function (k) {
      var m = state[k] && state[k][0]; if (m) { list.push({ id: k, name: m.name, cam: m.cam, at: m.at || 0 }); }
    });
    list.sort(function (a, b) { return (a.at - b.at) || (a.id < b.id ? -1 : 1); });

    // Room size: in my first moments here, if the room already has the maximum number of OTHER people, I step out.
    if (Date.now() < checkUntil && list.filter(function (x) { return x.id !== peerId; }).length >= MAX[mode]) {
      leave("This room is full (" + MAX[mode] + " people at most)."); return;
    }
    var present = {};
    list.forEach(function (x) {
      if (x.id === peerId) { return; }
      present[x.id] = true;
      var p = getPeer(x.id, x.name);
      setTileCam(p.tile, !!x.cam);
      if (!p.pc && peerId < x.id) { offer(p); }          // the smaller id always starts the call, so two people never both start
    });
    Object.keys(peers).forEach(function (id) { if (!present[id]) { dropPeer(id); } });
  }

  /* ---------- chat ---------- */
  function addMsg(name, text, mine, sys) {
    var li = el("li", "st-msg" + (mine ? " mine" : "") + (sys ? " sys" : ""));
    if (!sys) { li.appendChild(el("b", "", name)); }
    li.appendChild(el("span", "", text));
    var box = $("stMsgs"); box.appendChild(li);
    while (box.children.length > 120) { box.removeChild(box.firstChild); }
    box.scrollTop = box.scrollHeight;
    if (!mine && !sys && !chatOpen) { unread += 1; $("stDot").hidden = false; if ($("stSideDot")) { $("stSideDot").hidden = false; } }
  }
  function setChat(open) {
    chatOpen = open;
    $("stChat").classList.toggle("open", open);
    if ($("stSideChat")) { $("stSideChat").classList.toggle("on", open); }
    if (open) { unread = 0; $("stDot").hidden = true; if ($("stSideDot")) { $("stSideDot").hidden = true; } $("stVibes").hidden = true; setTimeout(function () { $("stText").focus(); }, 50); }
  }

  /* ---------- the room sidebar and the movable friends panel ---------- */
  var sideReady = false, FPOS = "whimzyy-study-friends", SIDE = "whimzyy-study-side";
  var fpos = null;                       // { x, y, w, h }  shares of the window (so it fits other screens)
  try { fpos = JSON.parse(localStorage.getItem(FPOS) || "null"); } catch (e) { fpos = null; }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  var target = null;                     // what is being moved: { node, key, kind: "f" (friends panel) or "w" (a widget) }
  function friends() { return $("stVideos"); }
  function applyFriends() {
    var f = friends();
    if (!fpos) { f.classList.remove("floating"); f.style.cssText = ""; return; }
    var vw = window.innerWidth, vh = window.innerHeight;
    var w = clamp(fpos.w * vw, 160, vw), h = clamp(fpos.h * vh, 110, vh);
    f.classList.add("floating");
    f.style.width = w + "px"; f.style.height = h + "px";
    f.style.left = clamp(fpos.x * (vw - w), 0, Math.max(0, vw - w)) + "px";
    f.style.top = clamp(fpos.y * (vh - h), 0, Math.max(0, vh - h)) + "px";
    placeBar();
  }
  function saveFriends() {
    var f = friends(), vw = window.innerWidth, vh = window.innerHeight, w = f.offsetWidth, h = f.offsetHeight;
    fpos = { x: vw > w ? f.offsetLeft / (vw - w) : 0, y: vh > h ? f.offsetTop / (vh - h) : 0, w: w / vw, h: h / vh };
    try { localStorage.setItem(FPOS, JSON.stringify(fpos)); } catch (e) { /* ignore */ }
  }
  function placeBar() {
    var b = $("stAlignBar"); if (b.hidden || !target) { return; }
    var r = target.node.getBoundingClientRect();
    b.style.left = clamp(r.left, 4, Math.max(4, window.innerWidth - b.offsetWidth - 4)) + "px";
    b.style.top = (r.top > 44 ? r.top - 40 : r.bottom + 6) + "px";
  }
  function startAlign() {
    var f = friends(), r = f.getBoundingClientRect();
    if (!fpos) {                      // lift it out of the page exactly where it is now
      var vw = window.innerWidth, vh = window.innerHeight, w = Math.max(240, r.width), h = Math.max(160, Math.min(r.height || 240, vh * 0.6));
      fpos = { x: vw > w ? clamp(r.left, 0, vw - w) / (vw - w) : 0, y: vh > h ? clamp(r.top, 0, vh - h) / (vh - h) : 0, w: w / vw, h: h / vh };
    }
    endAlign();
    target = { node: f, key: "friends", kind: "f" };
    applyFriends(); f.classList.add("aligning"); showBar(true);
    setChat(false); $("stVibes").hidden = true;
  }
  function showBar(sizing) {
    $("stAlignBar").hidden = false; $("stSizeUp").hidden = !sizing; $("stSizeDown").hidden = !sizing; placeBar();
  }
  function endAlign() {
    var t = target; target = null; $("stAlignBar").hidden = true;
    if (!t) { return; }
    t.node.classList.remove("aligning");
    if (t.kind === "f") { saveFriends(); } else { saveWidget(t.node); }
  }

  /* widgets (clock, message, to-do, focus timer) float anywhere too; each remembers its spot */
  var WPOS = "whimzyy-study-wpos", wpos = {};
  try { wpos = JSON.parse(localStorage.getItem(WPOS) || "{}") || {}; } catch (e) { wpos = {}; }
  function widgetNodes() { return Array.prototype.slice.call(document.querySelectorAll("#stWidgets .st-w:not([hidden])")); }
  function placeWidgets() {
    var vw = window.innerWidth, vh = window.innerHeight, y = 84;           // widgets without a saved spot stack down the left side
    widgetNodes().forEach(function (n) {
      var w = n.offsetWidth, h = n.offsetHeight, sv = wpos[n.dataset.wkey], l, t;
      if (sv) { l = sv.x * Math.max(0, vw - w); t = sv.y * Math.max(0, vh - h); }
      else { l = 24; t = y; y += h + 10; }
      n.style.left = clamp(l, 0, Math.max(0, vw - w)) + "px"; n.style.top = clamp(t, 0, Math.max(0, vh - h)) + "px";
    });
    placeBar();
  }
  function saveWidget(n) {
    var vw = window.innerWidth, vh = window.innerHeight, w = n.offsetWidth, h = n.offsetHeight;
    wpos[n.dataset.wkey] = { x: vw > w ? n.offsetLeft / (vw - w) : 0, y: vh > h ? n.offsetTop / (vh - h) : 0 };
    try { localStorage.setItem(WPOS, JSON.stringify(wpos)); } catch (e) { /* ignore */ }
  }
  function moveButton(n) {
    if (n.querySelector(".st-mv")) { return; }
    var mv = el("button", "st-mv", "✥"); mv.type = "button"; mv.title = "Move this widget"; mv.setAttribute("aria-label", "Move this widget");
    mv.addEventListener("click", function () {
      endAlign(); target = { node: n, key: n.dataset.wkey, kind: "w" };
      n.classList.add("aligning"); showBar(false); setChat(false); $("stVibes").hidden = true;
    });
    n.appendChild(mv);
  }
  function setSide(open) {
    document.body.classList.toggle("st-side-closed", !open);
    $("stSideOpen").hidden = open;
    if (!open) { setChat(false); $("stVibes").hidden = true; }
    try { localStorage.setItem(SIDE, open ? "1" : "0"); } catch (e) { /* ignore */ }
  }
  function sideSetup() {
    $("stSideVibes").hidden = false;
    if (sideReady) { return; } sideReady = true;
    var closed = false; try { closed = localStorage.getItem(SIDE) === "0"; } catch (e) { /* ignore */ }
    setSide(!closed);
    $("stSideChat").addEventListener("click", function () { setChat(!chatOpen); });
    $("stSideVibes").addEventListener("click", function () {
      if (!$("stVibes").hidden) { $("stVibes").hidden = true; return; }
      setChat(false); $("stVibesBtn").click();
    });
    $("stSideClose").addEventListener("click", function () { setSide(false); });
    $("stSideOpen").addEventListener("click", function () { setSide(true); });
    $("stAlignDone").addEventListener("click", endAlign);
    $("stAlignReset").addEventListener("click", function () {
      var t = target; if (!t) { return; }
      if (t.kind === "f") { fpos = null; try { localStorage.removeItem(FPOS); } catch (e) { /* ignore */ } t.node.classList.remove("aligning"); target = null; $("stAlignBar").hidden = true; applyFriends(); }
      else { delete wpos[t.key]; try { localStorage.setItem(WPOS, JSON.stringify(wpos)); } catch (e) { /* ignore */ } t.node.classList.remove("aligning"); target = null; $("stAlignBar").hidden = true; placeWidgets(); }
    });
    function scale(k) {
      var vw = window.innerWidth, vh = window.innerHeight; if (!fpos || !target || target.kind !== "f") { return; }
      var w = clamp(fpos.w * k, 160 / vw, 1), h = clamp(fpos.h * k, 110 / vh, 1);
      fpos.w = w; fpos.h = h; applyFriends();
    }
    $("stSizeUp").addEventListener("click", function () { scale(1.15); });
    $("stSizeDown").addEventListener("click", function () { scale(0.87); });
    var grab = $("stAlignGrab");
    grab.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      if (!target) { return; }
      var f = target.node, box = f.getBoundingClientRect(), ox = e.clientX - box.left, oy = e.clientY - box.top;
      grab.setPointerCapture(e.pointerId);
      function move(ev) {
        f.style.left = clamp(ev.clientX - ox, 0, Math.max(0, window.innerWidth - f.offsetWidth)) + "px";
        f.style.top = clamp(ev.clientY - oy, 0, Math.max(0, window.innerHeight - f.offsetHeight)) + "px";
        placeBar();
      }
      function stop() { grab.removeEventListener("pointermove", move); grab.removeEventListener("pointerup", stop); if (target) { if (target.kind === "f") { saveFriends(); } else { saveWidget(target.node); } } }
      grab.addEventListener("pointermove", move); grab.addEventListener("pointerup", stop);
    });
    window.addEventListener("resize", function () { if (fpos) { applyFriends(); } placeWidgets(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") { setChat(false); } });
    applyFriends();
  }

  /* ---------- the shared timer ---------- */
  function fmt(ms) {
    var s = Math.max(0, Math.ceil(ms / 1000)), m = Math.floor(s / 60); s = s % 60;
    return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
  }
  function paintTimer() {
    var left = timerEnd - Date.now();
    if (!timerEnd) { $("stTime").textContent = "--:--"; $("stTimerStop").hidden = true; return; }
    if (left <= 0) {
      timerEnd = 0; clearInterval(timerTick); timerTick = null;
      $("stTime").textContent = "--:--"; $("stTimerStop").hidden = true;
      addMsg("", "Study session finished 🎉 Take a little break.", false, true);
      return;
    }
    $("stTime").textContent = fmt(left); $("stTimerStop").hidden = false;
  }
  function setTimer(leftMs) {
    clearInterval(timerTick); timerTick = null;
    timerEnd = leftMs > 0 ? Date.now() + leftMs : 0;
    paintTimer();
    if (timerEnd) { timerTick = setInterval(paintTimer, 500); }
  }
  function startTimer(min, by) {
    setTimer(min * 60000);
    ch.send({ type: "broadcast", event: "timer", payload: { left: min * 60000, by: me.name } });
    addMsg("", (by || "You") + " started a " + min + " minute study timer.", true, true);
  }

  /* ---------- enter / leave ---------- */
  function enterRoom() {
    show("stRoom");
    window.__wzInStudyRoom = true;
    $("stCodeShow").textContent = mode === "duo" ? "1-to-1 study" : "Room " + roomCode;
    $("stInfo").classList.toggle("duo", mode === "duo");
    $("stCopyCode").hidden = mode === "duo"; $("stCopyLink").hidden = mode === "duo";
    $("stInviteBtn").hidden = !(mode === "group" && account && window.WzStudy);
    initVibes();                 // ambience, music and widgets: everyone sets their own, in 1-to-1 and group rooms
    sideSetup();

    myTile = makeTile("me", me.name + " (you)", true);
    paintMine(); paintTiles();

    ch = client.channel("wz-study-" + roomCode, { config: { broadcast: { self: false }, presence: { key: peerId } } });
    ch.on("presence", { event: "sync" }, onSync);
    ch.on("presence", { event: "join" }, function (e) {
      if (e && e.key !== peerId && timerEnd > Date.now()) {                // tell the newcomer about the running timer
        ch.send({ type: "broadcast", event: "timer", payload: { left: timerEnd - Date.now(), by: "" } });
      }
    });
    ch.on("broadcast", { event: "sig" }, onSig);
    ch.on("broadcast", { event: "chat" }, function (m) {
      var p = m && m.payload; if (!p || typeof p.text !== "string") { return; }
      addMsg(String(p.name || "Homie").slice(0, 24), p.text.slice(0, 500), false, false);
    });
    ch.on("broadcast", { event: "timer" }, function (m) {
      var p = m && m.payload; if (!p || typeof p.left !== "number") { return; }
      var wasOff = !timerEnd;
      setTimer(p.left);
      if (p.by && wasOff && p.left > 0) { addMsg("", p.by + " started a " + Math.round(p.left / 60000) + " minute study timer.", false, true); }
      if (p.left <= 0 && !wasOff) { addMsg("", "The timer was stopped.", false, true); }
    });
    ch.subscribe(function (status) {
      if (status === "SUBSCRIBED") { joinedAt = Date.now(); checkUntil = joinedAt + 2500; publish(); }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") { toast("Could not connect. Check your internet and try again."); }
    });
  }

  function leave(message) {
    if (left) { return; } left = true;
    window.__wzInStudyRoom = false;
    clearInterval(timerTick);
    stopSounds();
    Object.keys(peers).forEach(dropPeer);
    stopCamera();
    try { if (ch) { ch.untrack(); client.removeChannel(ch); } } catch (e) { /* ignore */ }
    if (message) { try { sessionStorage.setItem("wz-study-msg", message); } catch (e) { /* ignore */ } }
    location.href = account ? "search-homies.html" : "study.html";
  }

  /* ---------- the buttons ---------- */
  function wireRoom() {
    $("stCam").addEventListener("click", function () {
      if (localStream) {
        stopCamera();
      } else {
        startCamera().then(function (s) { if (!s) { toast("No camera access. Allow the camera in your browser settings."); } afterCam(); });
        return;
      }
      afterCam();
    });
    function afterCam() {
      var t = localTrack();
      Object.keys(peers).forEach(function (id) {
        var p = peers[id]; if (!p.pc) { return; }
        videoSenders(p.pc).forEach(function (x) { x.sender.replaceTrack(t).catch(function () {}); });
      });
      paintMine(); publish();
    }
    $("stChatBtn").addEventListener("click", function () { setChat(!chatOpen); });
    $("stChatClose").addEventListener("click", function () { setChat(false); });
    $("stLeave").addEventListener("click", function () { leave(); });
    if (document.documentElement.requestFullscreen) {
      $("stFull").hidden = false;
      $("stFull").addEventListener("click", function () {
        if (document.fullscreenElement) { document.exitFullscreen(); } else { document.documentElement.requestFullscreen().catch(function () { toast("Full screen is not available here."); }); }
      });
      document.addEventListener("fullscreenchange", function () { $("stFullLbl").textContent = document.fullscreenElement ? "Exit full screen" : "Full screen"; });
    }
    $("stCopyCode").addEventListener("click", function () { copy(roomCode, "Room code copied"); });
    $("stCopyLink").addEventListener("click", function () { copy(linkFor(roomCode), "Link copied. Send it to anyone, they do not need an account."); });
    $("stSend").addEventListener("submit", function (e) {
      e.preventDefault();
      var t = $("stText").value.replace(/\s+/g, " ").trim().slice(0, 500);
      if (!t || Date.now() - lastSend < 400) { return; }
      lastSend = Date.now();
      ch.send({ type: "broadcast", event: "chat", payload: { name: me.name, text: t } });
      addMsg(me.name, t, true, false);
      $("stText").value = "";
    });
    $("stTimerBtns").addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) { return; }
      if (b.id === "stTimerStop") { setTimer(0); ch.send({ type: "broadcast", event: "timer", payload: { left: 0, by: "" } }); addMsg("", "You stopped the timer.", true, true); return; }
      var min = Number(b.getAttribute("data-min")); if (min) { startTimer(min); }
    });
    window.addEventListener("pagehide", function () { if (!left) { try { if (ch) { ch.untrack(); } } catch (e) { /* ignore */ } stopCamera(); } });

    /* invite homies (group rooms, logged-in people) */
    $("stInviteBtn").addEventListener("click", openInvite);
    $("stInviteClose").addEventListener("click", function () { $("stInvite").hidden = true; });
    $("stInvite").addEventListener("click", function (e) { if (e.target === $("stInvite")) { $("stInvite").hidden = true; } });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") { $("stInvite").hidden = true; setChat(false); } });
  }

  function openInvite() {
    var box = $("stInviteList"); box.textContent = ""; $("stInvite").hidden = false;
    box.appendChild(el("li", "st-empty", "Loading…"));
    client.from("follows").select("followee_id").eq("follower_id", me.id).then(function (r) {
      var ids = ((r && r.data) || []).map(function (x) { return x.followee_id; });
      if (!ids.length) { box.textContent = ""; box.appendChild(el("li", "st-empty", "You are not following anyone yet. Find homies in Search Homies first.")); return null; }
      return client.from("public_profiles").select("user_id,username,display_name").in("user_id", ids);
    }).then(function (r) {
      if (!r) { return; }
      var rows = r.data || []; box.textContent = "";
      if (!rows.length) { box.appendChild(el("li", "st-empty", "No homies found.")); return; }
      rows.forEach(function (p) {
        var li = el("li", "st-person");
        var who = el("div", "st-who"); who.appendChild(el("b", "", p.display_name || p.username)); who.appendChild(el("span", "", "@" + p.username));
        var b = el("button", "st-btn small", "Invite"); b.type = "button";
        b.addEventListener("click", function () { window.WzStudy.invite(p, { code: roomCode, mode: "group" }); b.textContent = "Invited"; b.disabled = true; setTimeout(function () { b.textContent = "Invite"; b.disabled = false; }, 30000); });
        li.appendChild(who); li.appendChild(b); box.appendChild(li);
      });
    }, function () { box.textContent = ""; box.appendChild(el("li", "st-empty", "Could not load your homies.")); });
  }


  /* ---------- Vibes (1-to-1 and group rooms): ambience, music and widgets, just like Work Space ---------- */
  var sounds = [];
  function makeSound(list, group, optsBox, volEl, noteEl) {
    var audio = new Audio(); audio.loop = true;
    function apply() { audio.volume = (Number(volEl.value) / 100) * (loadVolumes().master / 100); }
    volEl.value = loadVolumes()[group]; apply();
    volEl.addEventListener("input", function () { apply(); saveVolume(group, Number(volEl.value)); });
    [{ name: "None", src: "" }].concat(list).forEach(function (c, i) {
      var label = el("label", "st-opt"), r = el("input"); r.type = "radio"; r.name = "st-" + group; r.checked = (i === 0);
      r.addEventListener("change", function () {
        noteEl.textContent = "";
        if (!c.src) { audio.pause(); audio.removeAttribute("src"); audio.load(); return; }
        audio.src = c.src;
        var pr = audio.play();
        if (pr && pr.catch) { pr.catch(function (e) { if (e.name !== "AbortError") { noteEl.textContent = "Couldn't play this one."; } }); }
      });
      label.appendChild(r); label.appendChild(el("span", "", c.name)); optsBox.appendChild(label);
    });
    sounds.push(audio);
  }
  function stopSounds() { sounds.forEach(function (a) { try { a.pause(); a.removeAttribute("src"); a.load(); } catch (e) { /* ignore */ } }); }

  var WID_KEY = "whimzyy-study-widgets", widOn = { timer: true, clock: false, message: false, todo: false };
  function startOfToday() { var d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function readTasks() { try { return JSON.parse(localStorage.getItem("whimzyy-tasks")) || []; } catch (e) { return []; } }
  function writeTasks(t) { try { localStorage.setItem("whimzyy-tasks", JSON.stringify(t)); } catch (e) { /* ignore */ } }

  function paintWidgets() {
    var box = $("stWidgets");
    Array.prototype.slice.call(box.children).forEach(function (n) { if (n.id !== "stTimerW") { n.remove(); } });
    var tw = $("stTimerW"); tw.hidden = !widOn.timer; moveButton(tw);
    var any = widOn.timer || widOn.clock || widOn.message || widOn.todo; box.hidden = !any;
    if (widOn.clock) {
      var c = el("div", "st-w"), t = el("p", "st-w-time"), d = el("p", "st-w-date");
      function tick() { var n = new Date(); t.textContent = n.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); d.textContent = n.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" }); }
      tick(); c.dataset.wkey = "clock"; c.appendChild(t); c.appendChild(d); box.appendChild(c);
    }
    if (widOn.message) {
      var m = el("div", "st-w"), saved = ""; try { saved = localStorage.getItem("whimzyy-message") || ""; } catch (e) { /* ignore */ }
      var ta = el("textarea", "st-w-msg"); ta.rows = 2; ta.maxLength = 140; ta.value = saved; ta.placeholder = "Write something that keeps you motivated…"; ta.setAttribute("aria-label", "Your personal message");
      ta.addEventListener("change", function () { try { localStorage.setItem("whimzyy-message", ta.value.trim()); } catch (e) { /* ignore */ } });
      m.dataset.wkey = "message"; m.appendChild(ta); box.appendChild(m);
    }
    if (widOn.todo) {
      var w = el("div", "st-w"), ul = el("ul", "st-w-list"), f = el("form", "st-w-form"), inp = el("input", "st-w-in");
      inp.maxLength = 80; inp.placeholder = "Add a task…"; inp.setAttribute("aria-label", "New task");
      var go = el("button", "st-chip", "Add"); go.type = "submit"; f.appendChild(inp); f.appendChild(go);
      function draw() {
        ul.textContent = "";
        readTasks().forEach(function (task, i) {
          if (task && task.done && (!task.doneAt || task.doneAt < startOfToday())) { return; }   // yesterday's finished tasks stay hidden, like on My Day
          var li = el("li"), lab = el("label"), cb = el("input"); cb.type = "checkbox"; cb.checked = !!task.done;
          cb.addEventListener("change", function () { var all = readTasks(); if (all[i]) { all[i].done = cb.checked; all[i].doneAt = cb.checked ? Date.now() : null; writeTasks(all); draw(); } });
          lab.appendChild(cb); lab.appendChild(el("span", task.done ? "done" : "", String(task.text || ""))); li.appendChild(lab); ul.appendChild(li);
        });
        if (!ul.children.length) { ul.appendChild(el("li", "st-w-empty", "No tasks yet.")); }
      }
      f.addEventListener("submit", function (e) { e.preventDefault(); var v = inp.value.trim(); if (!v) { return; } var all = readTasks(); all.push({ text: v, done: false }); writeTasks(all); inp.value = ""; draw(); });
      draw(); w.dataset.wkey = "todo"; w.appendChild(el("p", "st-w-title", "To-do")); w.appendChild(ul); w.appendChild(f); box.appendChild(w);
    }
    Array.prototype.slice.call(box.querySelectorAll(".st-w")).forEach(moveButton);
    placeWidgets();
  }
  function initVibes() {
    if (typeof ambienceList === "undefined" || typeof loadVolumes === "undefined") { paintWidgets(); return; }       // media.js did not load: no vibes, but the timer still shows
    $("stVibesBtn").hidden = false;
    $("stBgPrev").addEventListener("click", function () { stepScene(-1); });
    $("stBgNext").addEventListener("click", function () { stepScene(1); });
    paintScene();
    makeSound(ambienceList, "ambience", $("stAmbOpts"), $("stAmbVol"), $("stAmbNote"));
    makeSound(musicList, "music", $("stMusOpts"), $("stMusVol"), $("stMusNote"));
    try { widOn = Object.assign(widOn, JSON.parse(localStorage.getItem(WID_KEY)) || {}); } catch (e) { /* ignore */ }
    [["timer", "Focus timer"], ["clock", "Date and time"], ["message", "Personal message"], ["todo", "To-do list"]].forEach(function (x) {
      var label = el("label", "st-opt"), cb = el("input"); cb.type = "checkbox"; cb.checked = !!widOn[x[0]];
      cb.addEventListener("change", function () { widOn[x[0]] = cb.checked; try { localStorage.setItem(WID_KEY, JSON.stringify(widOn)); } catch (e) { /* ignore */ } paintWidgets(); });
      label.appendChild(cb); label.appendChild(el("span", "", x[1])); $("stWidOpts").appendChild(label);
    });
    paintWidgets();
    $("stVibesBtn").addEventListener("click", function () { $("stVibes").hidden = false; });
    $("stVibesClose").addEventListener("click", function () { $("stVibes").hidden = true; });
    $("stVibes").addEventListener("click", function (e) { if (e.target === $("stVibes")) { $("stVibes").hidden = true; } });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") { $("stVibes").hidden = true; } });
  }

  /* ---------- the scene: full-screen background video like Work Space (same video you chose there) ---------- */
  var sceneIndex = 0;
  function dataSaver() { return !!(navigator.connection && navigator.connection.saveData) || window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
  function paintScene() {
    var bg = $("stBg");
    if (typeof videos === "undefined" || !videos.length || dataSaver()) { bg.hidden = true; return; }
    var v = videos[sceneIndex];
    if (bg.getAttribute("data-i") !== String(sceneIndex)) { bg.setAttribute("data-i", String(sceneIndex)); bg.src = v.src; }
    bg.hidden = false;
    var p = bg.play(); if (p && p.catch) { p.catch(function () { /* some phones wait for a tap */ }); }
    if ($("stBgName")) { $("stBgName").textContent = v.title; }
  }
  function scene(on) {
    document.body.classList.toggle("st-immersive", !!on);
    $("stShade").hidden = !on;
    if (!on) { $("stBg").hidden = true; $("stBg").pause(); return; }
    if (typeof videos !== "undefined" && videos.length) {
      var saved = 0; try { saved = Number(localStorage.getItem("whimzyy-video")) || 0; } catch (e) { /* ignore */ }
      sceneIndex = ((saved % videos.length) + videos.length) % videos.length;
    }
    paintScene();
  }
  function stepScene(d) {
    if (typeof videos === "undefined" || !videos.length) { return; }
    sceneIndex = (sceneIndex + d + videos.length) % videos.length;
    try { localStorage.setItem("whimzyy-video", String(sceneIndex)); } catch (e) { /* ignore */ }
    paintScene();
  }
  document.addEventListener("visibilitychange", function () {
    var bg = $("stBg"); if (!bg || bg.hidden) { return; }
    if (document.hidden) { bg.pause(); } else { var p = bg.play(); if (p && p.catch) { p.catch(function () {}); } }
  });

  /* ---------- phones: hold it sideways ---------- */
  function isPhone() {
    return window.matchMedia("(hover: none) and (pointer: coarse)").matches && Math.min(screen.width, screen.height) < 600;
  }
  function needLandscape(on) {
    document.body.classList.toggle("st-need-land", !!on && isPhone());
    if (on && isPhone() && screen.orientation && screen.orientation.lock) { screen.orientation.lock("landscape").catch(function () { /* only works in some browsers: the rotate message covers the rest */ }); }
  }

  /* ---------- start ---------- */
  whenAuth(function (a) {
    auth = a; client = a && a.client;
    var u = a && a.user;
    account = !!u && !u.is_anonymous;
    if (!account) {
      // Study Together needs a login (the login window opens by itself). Once they log in, start again.
      window.addEventListener("whimzyy-auth", function () {
        var nu = window.WhimzyyAuth && window.WhimzyyAuth.user;
        if (nu && !nu.is_anonymous) { location.reload(); }
      });
      return;
    }
    me.id = u ? u.id : guestId();
    me.name = u ? (window.WzStudy ? window.WzStudy.nameOf(u) : "Homie") : "";
    $("stBack").setAttribute("href", account ? "search-homies.html" : "study.html");
    if (!account) { $("stBack").hidden = true; }        // people with only a link have nowhere to go "back" to

    if (!client) {
      show("stLobby"); $("stLobbyMsg").textContent = "Study rooms need the cloud connection. Check js/supabase-config.js.";
      return;
    }
    wireRoom();
    var m = ""; try { m = sessionStorage.getItem("wz-study-msg") || ""; sessionStorage.removeItem("wz-study-msg"); } catch (e) { /* ignore */ }
    if (!roomCode) { lobby(); if (m) { $("stLobbyMsg").textContent = m; } else if (!window.RTCPeerConnection) { $("stLobbyMsg").textContent = "This browser cannot do video calls. Try Chrome, Edge, Safari or Firefox."; } return; }
    if (!window.RTCPeerConnection) { lobby(); $("stLobbyMsg").textContent = "This browser cannot do video calls. Try Chrome, Edge, Safari or Firefox."; return; }
    joinScreen();
  });
})();
