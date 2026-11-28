/* ==========================================================
   rewards.js  (load in the <head>, right AFTER theme.js, as a plain script, NOT defer)

   The Whimzyy star system.
   - Stars are earned by: Focus sessions, Work Space time, finishing tasks,
     reaching the daily goal, and keeping a day streak.
   - Stars are spent in the shop (themes, Work Space backgrounds, titles)
     or on your own real-life treats ("one episode", "boba"...).
   - Every page can ask it questions through the global  Rewards  object.

   Everything is saved in ONE key: "whimzyy-rewards".
   (When logins arrive, only the functions load() and save() below need to change.)

   THE ORDER BELOW:
    1. Settings (what earns what, and the shop catalog)
    2. Saved data
    3. Small helpers
    4. Giving and spending stars
    5. Questions other pages ask
    6. The star pill and the little toast
    7. The shop window
    8. Share my day (a picture card)
    9. Start
   ========================================================== */

(function () {

  "use strict";

  // reminders.js (water / stretch / eyes) sits next to this file and is loaded from here, so every page gets the reminders
  (function () {
    var me = document.currentScript && document.currentScript.src;
    if (me && !window.Reminders) {
      var tag = document.createElement("script");
      tag.src = me.replace(/rewards\.js(\?.*)?$/, "reminders.js");
      tag.async = true;
      document.head.appendChild(tag);
    }
  })();

  // pagefx.js (the slide between pages), mobile-nav.js (the footer bar on phones) and study.js (study invites) are loaded from here too,
  // so every page gets them without editing each page. Each one only runs once, even if a page also has its own tag.
  (function () {
    var me = document.currentScript && document.currentScript.src;
    if (!me) { return; }
    ["pagefx.js", "mobile-nav.js", "study.js"].forEach(function (name) {
      var url = me.replace(/rewards\.js(\?.*)?$/, name);
      var attr = document.currentScript.getAttribute("src").replace(/rewards\.js(\?.*)?$/, name);
      try { document.write('<script src="' + attr + '"><\/script>'); }
      catch (e) { var t = document.createElement("script"); t.src = url; document.head.appendChild(t); }
    });
  })();

  /* ---------- 1. Settings ---------- */

  var KEY = "whimzyy-rewards";
  var GOAL_KEY = "whimzyy-goal";            // the daily goal (minutes) from Productivity

  var PER_BLOCK = 5;                        // 1 star for every 5 minutes of focus
  var FINISH_BONUS = 2;                     // extra stars for a finished session of 15+ minutes
  var CAPS = { time: 80, task: 10 };        // most stars one day can give from time / from tasks
  var GOAL_BONUS = 5;                       // reaching the daily goal (once a day)
  var DETOX_BONUS = 5;                                  // a finished day under the Detox screen time limit
  var STREAK_BONUS = { 3: 3, 7: 10, 14: 20, 30: 50 };   // day streak milestones
  var WELCOME = 10;                         // a gift the first time the system starts

  // the shop. cost 0 = free from the start.
  // Keep the backgrounds in the SAME ORDER as the videos list in media.js.
  var CATALOG = {
    theme: [
      { id: "wine", name: "Wine & Candle", cost: 0 },
      { id: "plum", name: "Midnight Plum", cost: 40 },
      { id: "moss", name: "Moss & Mist", cost: 40 },
      { id: "navy", name: "Dark Night", cost: 60 },
      { id: "rose", name: "Rose Dusk", cost: 60 },
      // special themes: shown in their own card (Main Character Drip), all over 100 stars
      { id: "sp_mint", name: "Mint Condition", cost: 120, special: true },
      { id: "sp_grape", name: "Grape Escape", cost: 120, special: true },
      { id: "sp_matcha", name: "Matcha Mood", cost: 120, special: true },
      { id: "sp_latte", name: "Cozy Latte Arc", cost: 120, special: true },
      { id: "sp_sunset", name: "Sunset Rizz", cost: 140, special: true },
      { id: "sp_oldmoney", name: "Old Money Fr", cost: 140, special: true },
      { id: "sp_stealth", name: "Stealth Mode", cost: 140, special: true },
      { id: "sp_honey", name: "Honey Aura", cost: 140, special: true },
      { id: "sp_pookie", name: "Hot Pink Pookie", cost: 160, special: true },
      { id: "sp_goblin", name: "Goblin Mode", cost: 160, special: true },
      { id: "sp_cobalt", name: "Cobalt Crashout", cost: 160, special: true },
      { id: "sp_villain", name: "Villain Arc Neon", cost: 180, special: true },
      { id: "sp_sigma", name: "Sigma Forest", cost: 180, special: true },
      { id: "sp_mauve", name: "Mauve Mafia", cost: 180, special: true },
      { id: "sp_sunkissed", name: "Sun-Kissed Slay", cost: 150, special: true },
      { id: "sp_autumn", name: "Pumpkin Spice Szn", cost: 150, special: true }
    ],
    bg: [
      { id: "0", name: "Thunder Woods", cost: 0 },
      { id: "1", name: "London - Rainy Era", cost: 0 },
      { id: "2", name: "Miami - Cobalt Night", cost: 0 },
      { id: "3", name: "Sci-Fi Capsule", cost: 25 },
      { id: "4", name: "Daylight Library", cost: 25 },
      { id: "5", name: "Cathedral Window", cost: 30 },
      { id: "6", name: "Hogwards Library", cost: 30 },
      { id: "7", name: "Autumn Cafe Haze", cost: 30 },
      { id: "8", name: "Minecraft - Daylight", cost: 40 },
      { id: "9", name: "Minecraft - Stormy Night", cost: 40 }
    ],
    title: [
      { id: "Absolute Workaholic", name: "Absolute Workaholic", cost: 20 },
      { id: "Focus Freak", name: "Focus Freak", cost: 20 },
      { id: "Grind Lord", name: "Grind Lord", cost: 30 },
      { id: "Efforlessly Elite", name:"Efforlessly Elite", cost: 30 },
      { id: "Unhinged Icon", name: "Unhinged Icon", cost: 40 },
      { id: "Ruthless Beast", name: "Ruthless Beast", cost: 40 },
      { id: "Ultimate Rizzler", name: "Ultimate Rizzler", cost: 40 },
      { id: "The GOAT-ed", name: "The GOAT-ed", cost: 60 }
    ]
  };

  var KIND_NAMES = { theme: "theme", bg: "background", title: "title" };
  var SPECIAL_TITLE = "Main Character Drip 💅";
  var SPECIAL_HINT = "Limited-edition aura. Every one costs over 100 ⭐, so grind first, flex later.";

  // the card around the special themes (added here so no extra CSS file is needed)
  (function () {
    var css = document.createElement("style");
    css.textContent =
      ".sd-special{margin:18px 0 6px;padding:4px 14px 14px;border-radius:22px;" +
      "border:2px solid var(--gold,#F2B83D);" +
      "background:linear-gradient(160deg,rgba(242,184,61,.16),rgba(242,184,61,.03));" +
      "box-shadow:0 0 18px rgba(242,184,61,.25)}" +
      ".sd-special .sd-h{color:var(--gold,#F2B83D)}" +
      ".special-card{border:2px solid var(--gold,#F2B83D);box-shadow:0 0 18px rgba(242,184,61,.25)}" +
      ".special-card .sp-hint{margin:0 0 10px;font-size:13px;opacity:.8}" +
      "@media(min-width:901px){.bg-card .bg-grid{grid-template-columns:repeat(5,minmax(0,1fr))}}" +
      ".special-card .theme-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px}";
    document.head.appendChild(css);
  })();

  var MOODS = {
    slay: ["💅", "Slayed!"], butterflies: ["🦋", "Butterflies fr"], lowkey: ["🤏", "Lowkey"],
    mid: ["😐", "Mid ngl"], complicated: ["🥴", "It's complicated"], dead: ["💀", "Never again homiee!!"]
  };
  var ENERGY = { 1: "cooked", 2: "Dry", 3: "Mid", 4: "Chill", 5: "GOAT" };


  /* ---------- 2. Saved data ---------- */

  function fresh() {
    return {
      v: 1,
      balance: 0,        // stars you have now
      lifetime: 0,       // stars ever earned
      log: [],           // [{ ts, day, amount, reason, kind }]  (amount is negative when you spend)
      owned: {},         // { "theme:plum": 1 }
      title: "",         // the title you wear
      treats: [],        // [{ id, name, cost }]
      minutes: {},       // { "2026-11-19": 45 }  focus minutes per day (Focus + Work Space)
      goalDays: {},      // days the daily goal bonus was already given
      milestones: {},    // streak bonuses already given
      welcomed: false
    };
  }

  var state = fresh();

  function load() {
    try {
      var saved = JSON.parse(localStorage.getItem(KEY));
      if (saved && typeof saved === "object") {
        return Object.assign(fresh(), saved);
      }
    } catch (error) {
      // unreadable: start clean
    }
    return fresh();
  }

  function save() {
    if (state.log.length > 1500) {
      state.log = state.log.slice(-1500);
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (error) {
      // storage full or blocked: the stars just won't be kept
    }
    refreshPill();
    window.dispatchEvent(new CustomEvent("rewards:change"));
  }

  state = load();


  /* ---------- 3. Small helpers ---------- */

  function dayKey(date) {
    return (date || new Date()).toLocaleDateString("en-CA");   // YYYY-MM-DD, like the other pages
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) { node.className = className; }
    if (text !== undefined) { node.textContent = text; }
    return node;
  }

  function goalMinutes() {
    return Number(localStorage.getItem(GOAL_KEY)) || 120;
  }

  function findItem(kind, id) {
    var list = CATALOG[kind] || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === String(id)) { return list[i]; }
    }
    return null;
  }

  function shorten(text, max) {
    return text.length > max ? text.slice(0, max - 1) + "…" : text;
  }

  // stars earned today from one kind of source
  function earnedToday(kind) {
    var today = dayKey();
    var total = 0;
    state.log.forEach(function (entry) {
      if (entry.day === today && entry.kind === kind && entry.amount > 0) {
        total += entry.amount;
      }
    });
    return total;
  }

  // how many days in a row (up to today, or up to yesterday) have focus minutes
  function streakOf(data) {
    var d = new Date();
    d.setHours(12, 0, 0, 0);                         // noon, so daylight-saving changes cannot skip a day
    if (!(data.minutes[dayKey(d)] > 0)) {
      d.setDate(d.getDate() - 1);
    }
    var n = 0;
    while (data.minutes[dayKey(d)] > 0) {
      n += 1;
      d.setDate(d.getDate() - 1);
    }
    return n;
  }


  /* ---------- 4. Giving and spending stars ---------- */

  var pending = [];   // messages to show together in one toast

  function add(amount, reason, kind) {
    state.log.push({ ts: Date.now(), day: dayKey(), amount: amount, reason: reason, kind: kind });
    state.balance += amount;
    if (amount > 0) {
      state.lifetime += amount;
      pending.push("+" + amount + " ⭐ " + reason);
    }
  }

  function flush() {
    if (pending.length) {
      showToast(pending.join("   ·   "));
      pending = [];
    }
  }

  // the daily goal bonus (once a day)
  function checkGoal() {
    var today = dayKey();
    if (!state.goalDays[today] && (state.minutes[today] || 0) >= goalMinutes()) {
      state.goalDays[today] = 1;
      add(GOAL_BONUS, "Daily goal reached 🎯", "bonus");
    }
  }

  // streak milestones (3, 7, 14, 30 days)
  function checkStreak() {
    var n = streakOf(state);
    if (!STREAK_BONUS[n]) { return; }

    var start = new Date();
    start.setHours(12, 0, 0, 0);
    start.setDate(start.getDate() - (n - 1));
    var id = dayKey(start) + ":" + n;               // a new streak can earn the same milestone again

    if (!state.milestones[id]) {
      state.milestones[id] = 1;
      add(STREAK_BONUS[n], n + "-day streak 🔥", "bonus");
    }
  }

  /* Focus and Work Space call this when time was really spent.
     source: words for the history ("Focus · Pomodoro"), seconds: how long,
     completed: true if the session was finished (not stopped early). */
  function onSession(source, seconds, completed) {
    state = load();

    var mins = Math.floor(seconds / 60);
    if (mins < 1) { return 0; }

    var today = dayKey();
    state.minutes[today] = (state.minutes[today] || 0) + mins;

    var stars = Math.floor(mins / PER_BLOCK) + (completed && mins >= 15 ? FINISH_BONUS : 0);
    stars = Math.min(stars, Math.max(0, CAPS.time - earnedToday("time")));

    if (stars > 0) {
      add(stars, source + " · " + mins + " min" + (completed ? " ✓" : ""), "time");
    }

    checkGoal();
    checkStreak();
    save();
    flush();
    return stars;
  }

  // tasks.js calls this when a task is ticked for the first time. Returns true so the task is marked.
  function onTaskDone(text) {
    state = load();

    if (earnedToday("task") < CAPS.task) {
      add(1, "Task · " + shorten(String(text || "done"), 28), "task");
    }

    save();
    flush();
    return true;
  }

  // detox.js calls this for every finished day that stayed under the screen time limit (once per day)
  function onDetoxDay(day) {
    state = load();
    var id = "detox:" + day;
    if (state.milestones[id]) { return false; }
    state.milestones[id] = 1;
    add(DETOX_BONUS, "Detox day under your limit 🌿", "bonus");
    save();
    flush();
    return true;
  }

  function isOwned(kind, id) {
    var item = findItem(kind, id);
    if (!item || item.cost === 0) { return true; }
    return Boolean(state.owned[kind + ":" + item.id]);
  }

  function buy(kind, id) {
    state = load();
    var item = findItem(kind, id);
    if (!item) { return false; }
    if (isOwned(kind, id)) { return true; }

    if (state.balance < item.cost) {
      showToast("You need " + (item.cost - state.balance) + " more ⭐ for " + item.name);
      return false;
    }

    add(-item.cost, "Unlocked " + KIND_NAMES[kind] + " · " + item.name, "spend");
    state.owned[kind + ":" + item.id] = 1;
    save();
    showToast("Unlocked " + item.name + " ✨");
    return true;
  }

  function wearTitle(id) {
    state = load();
    state.title = (state.title === id) ? "" : id;      // clicking the worn title takes it off
    save();
  }

  function addTreat(name, cost) {
    state = load();
    name = String(name || "").trim().slice(0, 40);
    cost = Math.round(Number(cost));
    if (!name || !(cost >= 1 && cost <= 500)) { return false; }

    state.treats.push({ id: Date.now(), name: name, cost: cost });
    save();
    return true;
  }

  function removeTreat(id) {
    state = load();
    state.treats = state.treats.filter(function (treat) { return treat.id !== id; });
    save();
  }

  function redeemTreat(id) {
    state = load();
    var treat = state.treats.filter(function (t) { return t.id === id; })[0];
    if (!treat) { return false; }

    if (state.balance < treat.cost) {
      showToast("You need " + (treat.cost - state.balance) + " more ⭐ for " + treat.name);
      return false;
    }

    add(-treat.cost, "Treat · " + treat.name, "spend");
    save();
    showToast("Enjoy: " + treat.name + " 🎉");
    return true;
  }


  /* ---------- 5. Questions other pages ask ---------- */

  function entriesOn(day) {
    return state.log.filter(function (entry) { return entry.day === day; });
  }

  function starsOn(day) {
    var total = 0;
    entriesOn(day).forEach(function (entry) {
      if (entry.amount > 0) { total += entry.amount; }
    });
    return total;
  }

  // stars earned between two times (from included, to excluded), in milliseconds
  function starsBetween(from, to) {
    var total = 0;
    state.log.forEach(function (entry) {
      if (entry.amount > 0 && entry.ts >= from && entry.ts < to) { total += entry.amount; }
    });
    return total;
  }

  // pages call this before using something locked. If it is locked, the shop opens on that item.
  function require(kind, id) {
    state = load();
    if (isOwned(kind, id)) { return true; }
    openShop("shop", kind + ":" + id);
    return false;
  }


  /* ---------- 6. The star pill and the toast ---------- */

  var pill = null;
  var pillCount = null;
  var toastBox = null;
  var toastTimer = null;

  function refreshPill() {
    if (!pill) { return; }
    pillCount.textContent = state.balance;
    pill.title = "Your stars. " + streakOf(state) + "-day streak. Click to open the shop.";
    pill.classList.remove("pop");
    void pill.offsetWidth;            // restarts the little bounce
    pill.classList.add("pop");
  }

  function buildPill() {
    pill = el("button", "star-pill");
    pill.type = "button";
    pill.setAttribute("aria-label", "Stars and shop");
    pill.append(el("span", "star-pill-icon", "⭐"));
    pillCount = el("span", "star-pill-count", "0");
    pill.appendChild(pillCount);
    pill.addEventListener("click", function () { openShop("shop"); });

    var bar = document.querySelector(".topbar");
    var nav = document.querySelector(".top-nav");

    var brand = bar && bar.querySelector(".brand");

    if (bar && nav) {
      pill.classList.add("in-bar");
      bar.insertBefore(pill, brand ? brand.nextSibling : nav);   // right after the Whimzyy logo
    } else {
      pill.classList.add("floating");     // Work Space has no top bar: float it in the corner
      document.body.appendChild(pill);
    }
    refreshPill();
  }

  function showToast(message) {
    if (!document.body) { return; }
    if (!toastBox) {
      toastBox = el("div", "star-toast");
      toastBox.setAttribute("role", "status");
      toastBox.setAttribute("aria-live", "polite");
      document.body.appendChild(toastBox);
    }
    toastBox.textContent = message;
    toastBox.classList.add("show");

    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastBox.classList.remove("show"); }, 4500);
  }


  /* ---------- 7. The shop window ---------- */

  var dialog = null;
  var tab = "shop";
  var highlight = "";

  function openShop(whichTab, highlightKey) {
    state = load();
    tab = whichTab || "shop";
    highlight = highlightKey || "";

    if (!dialog) {
      dialog = el("dialog", "star-dialog");
      dialog.addEventListener("click", function (event) {
        if (event.target === dialog) { dialog.close(); }       // clicking the dark area closes it
      });
      document.body.appendChild(dialog);
    }

    renderShop();
    if (!dialog.open) { dialog.showModal(); }
  }

  function renderShop() {
    dialog.textContent = "";

    /* top: balance and close */
    var head = el("div", "sd-head");
    var left = el("div");
    left.appendChild(el("p", "sd-balance", "⭐ " + state.balance));
    left.appendChild(el("p", "sd-sub", state.lifetime + " earned in total  ·  🔥 " + streakOf(state) + "-day streak"));
    var close = el("button", "sd-close", "✕");
    close.type = "button";
    close.setAttribute("aria-label", "Close");
    close.addEventListener("click", function () { dialog.close(); });
    head.append(left, close);
    dialog.appendChild(head);

    /* tabs */
    var tabs = el("div", "sd-tabs");
    [["shop", "Shop"], ["treats", "My treats"], ["history", "History"]].forEach(function (pair) {
      var button = el("button", "sd-tab" + (tab === pair[0] ? " active" : ""), pair[1]);
      button.type = "button";
      button.addEventListener("click", function () {
        tab = pair[0];
        highlight = "";
        renderShop();
      });
      tabs.appendChild(button);
    });
    dialog.appendChild(tabs);

    var body = el("div", "sd-body");
    dialog.appendChild(body);

    if (tab === "shop") { renderShopTab(body); }
    if (tab === "treats") { renderTreatsTab(body); }
    if (tab === "history") { renderHistoryTab(body); }

    if (highlight) {
      var target = dialog.querySelector('[data-key="' + highlight + '"]');
      if (target) {
        target.classList.add("flash");
        target.scrollIntoView({ block: "center" });
      }
    }
  }

  function strip(themeId) {
    var box = el("span", "sd-strip");
    if (typeof THEMES !== "undefined" && THEMES[themeId]) {
      ["dark-cherry-red", "marron-red", "wine", "bright-deep-yellow"].forEach(function (name) {
        var square = el("span");
        square.style.backgroundColor = THEMES[themeId].colors[name];
        box.appendChild(square);
      });
    }
    return box;
  }

  function itemCard(kind, item) {
    var owned = isOwned(kind, item.id);
    var worn = (kind === "title" && state.title === item.id);

    var card = el("div", "sd-item" + (owned ? " owned" : ""));
    card.dataset.key = kind + ":" + item.id;

    if (kind === "theme") { card.appendChild(strip(item.id)); }

    var text = el("div", "sd-item-text");
    text.appendChild(el("span", "sd-item-name", item.name));
    text.appendChild(el("span", "sd-item-note",
      item.cost === 0 ? "Free" : owned ? "Unlocked" : item.cost + " ⭐"));
    card.appendChild(text);

    var button = el("button", "sd-btn");
    button.type = "button";

    if (kind === "title" && owned) {
      button.textContent = worn ? "Wearing" : "Wear";
      if (worn) { button.classList.add("on"); }
      button.addEventListener("click", function () { wearTitle(item.id); renderShop(); });
    } else if (owned) {
      button.textContent = "Unlocked";
      button.disabled = true;
    } else {
      button.textContent = "Unlock";
      if (state.balance < item.cost) { button.classList.add("short"); }
      button.addEventListener("click", function () { buy(kind, item.id); renderShop(); });
    }

    card.appendChild(button);
    return card;
  }

  function renderShopTab(body) {
    [["theme", "Themes", "Pick them on the Vibe page once unlocked."],
     ["special", SPECIAL_TITLE, SPECIAL_HINT],
     ["bg", "Work Space backgrounds", "Locked videos are skipped when you change the video."],
     ["title", "Titles", "Shown on Home and on your shared day card."]].forEach(function (section) {
      var isSpecial = section[0] === "special";
      var kind = isSpecial ? "theme" : section[0];
      var items = CATALOG[kind].filter(function (item) { return kind !== "theme" || Boolean(item.special) === isSpecial; });

      var holder = body;
      if (isSpecial) {                              // its own card
        holder = el("div", "sd-special");
        body.appendChild(holder);
      }

      holder.appendChild(el("h3", "sd-h", section[1]));
      holder.appendChild(el("p", "sd-hint", section[2]));

      var grid = el("div", "sd-grid");
      items.forEach(function (item) { grid.appendChild(itemCard(kind, item)); });
      holder.appendChild(grid);
    });
  }

  function renderTreatsTab(body) {
    body.appendChild(el("p", "sd-hint",
      "Real-life rewards that you choose. Spend stars on them guilt-free."));

    if (state.treats.length === 0) {
      body.appendChild(el("p", "sd-empty", "No treats yet. Add your first one below."));
    }

    var list = el("div", "sd-list");
    state.treats.forEach(function (treat) {
      var row = el("div", "sd-item");
      var text = el("div", "sd-item-text");
      text.appendChild(el("span", "sd-item-name", treat.name));
      text.appendChild(el("span", "sd-item-note", treat.cost + " ⭐"));
      row.appendChild(text);

      var redeem = el("button", "sd-btn", "Redeem");
      redeem.type = "button";
      if (state.balance < treat.cost) { redeem.classList.add("short"); }
      redeem.addEventListener("click", function () { redeemTreat(treat.id); renderShop(); });

      var remove = el("button", "sd-x", "✕");
      remove.type = "button";
      remove.title = "Remove this treat";
      remove.setAttribute("aria-label", "Remove " + treat.name);
      remove.addEventListener("click", function () { removeTreat(treat.id); renderShop(); });

      row.append(redeem, remove);
      list.appendChild(row);
    });
    body.appendChild(list);

    var form = el("form", "sd-form");
    var name = el("input");
    name.type = "text";
    name.maxLength = 40;
    name.placeholder = "e.g. one episode, boba, 30 min of gaming";
    name.setAttribute("aria-label", "Treat name");

    var cost = el("input");
    cost.type = "number";
    cost.min = 1;
    cost.max = 500;
    cost.value = 30;
    cost.setAttribute("aria-label", "Cost in stars");

    var add = el("button", "sd-btn on", "Add");
    add.type = "submit";

    form.append(name, cost, add);
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (addTreat(name.value, cost.value)) { renderShop(); } else { name.focus(); }
    });
    body.appendChild(form);
  }

  function renderHistoryTab(body) {
    body.appendChild(el("h3", "sd-h", "How stars work"));
    var rules = el("ul", "sd-rules");
    [
      "1 ⭐ for every " + PER_BLOCK + " minutes of focus (Focus page and Work Space)",
      "+" + FINISH_BONUS + " ⭐ for finishing a session of 15 minutes or more",
      "+1 ⭐ for each task you finish (up to " + CAPS.task + " a day)",
      "+" + GOAL_BONUS + " ⭐ when you reach your daily goal",
      "+" + DETOX_BONUS + " ⭐ for each finished day under your Detox screen time limit",
      "Streak bonus: 3 days +" + STREAK_BONUS[3] + ", 7 days +" + STREAK_BONUS[7] +
        ", 14 days +" + STREAK_BONUS[14] + ", 30 days +" + STREAK_BONUS[30],
      "Time stars stop at " + CAPS.time + " a day, so quality beats grinding"
    ].forEach(function (line) { rules.appendChild(el("li", "", line)); });
    body.appendChild(rules);

    body.appendChild(el("h3", "sd-h", "Recent"));
    var recent = state.log.slice(-40).reverse();
    if (recent.length === 0) {
      body.appendChild(el("p", "sd-empty", "Nothing yet. Start a focus session!"));
    }

    var list = el("ul", "sd-log");
    recent.forEach(function (entry) {
      var li = el("li");
      var when = new Date(entry.ts);
      li.appendChild(el("span", "sd-log-when",
        when.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) + " · " +
        when.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })));
      li.appendChild(el("span", "sd-log-why", entry.reason));
      li.appendChild(el("span", "sd-log-amt " + (entry.amount > 0 ? "plus" : "minus"),
        (entry.amount > 0 ? "+" : "−") + Math.abs(entry.amount)));
      list.appendChild(li);
    });
    body.appendChild(list);
  }


  /* ---------- 8. Share my day (a picture card) ---------- */

  function readObject(name) {
    try { return JSON.parse(localStorage.getItem(name)) || {}; } catch (error) { return {}; }
  }
  function readList(name) {
    try {
      var list = JSON.parse(localStorage.getItem(name));
      return Array.isArray(list) ? list : [];
    } catch (error) { return []; }
  }

  // collects the numbers for one day
  function dayFacts(date) {
    var k = dayKey(date);

    var sessionMinutes = 0;
    readList("whimzyy-sessions").forEach(function (s) {
      if (s && dayKey(new Date(s.start)) === k) { sessionMinutes += Math.round(s.seconds / 60); }
    });

    var tasksDone = readList("whimzyy-tasks").filter(function (t) {
      return t && t.done && t.doneAt && dayKey(new Date(t.doneAt)) === k;
    }).length;

    var mood = MOODS[readObject("whimzyy-moods")[k]];
    var energy = ENERGY[localStorage.getItem("whimzyy-energy-" + k)];
    var isToday = (k === dayKey());

    return {
      key: k,
      focus: Math.max(state.minutes[k] || 0, sessionMinutes),
      tasks: tasksDone,
      stars: starsOn(k),
      water: Number(localStorage.getItem("whimzyy-water-" + k)) || 0,
      mood: mood ? mood[0] + "  " + mood[1] : "",
      energy: energy || "",
      streak: isToday ? streakOf(state) : 0,
      title: state.title
    };
  }

  function roundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function minutesText(m) {
    return m >= 60 ? Math.floor(m / 60) + " h " + (m % 60) + " min" : m + " min";
  }

  // draws the card (1080 x 1350) with the colors of the current theme
  function drawCard(facts, date, logo) {
    var W = 1080;
    var H = 1350;
    var canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    var ctx = canvas.getContext("2d");

    var css = getComputedStyle(document.documentElement);
    function color(name, fallback) {
      return (css.getPropertyValue("--" + name) || "").trim() || fallback;
    }
    var cBg = color("bg", "#1F0508");
    var cDark = color("dark-cherry-red", "#2E0A10");
    var cCard = color("marron-red", "#4A0E17");
    var cGold = color("gold", "#F2B83D");
    var cBeige = color("warm-beige", "#F3E7D3");
    var cPeach = color("peach", "#f8c9a0");
    var cSoft = color("soft-gold", "#D4A24C");

    var heading = '"Bricolage Grotesque", Arial, sans-serif';
    var body = '"DM Sans", Arial, sans-serif';

    // background
    var back = ctx.createLinearGradient(0, 0, 0, H);
    back.addColorStop(0, cBg);
    back.addColorStop(1, cDark);
    ctx.fillStyle = back;
    ctx.fillRect(0, 0, W, H);

    // the main card with a soft gold glow
    ctx.save();
    ctx.shadowColor = cSoft;
    ctx.shadowBlur = 40;
    ctx.fillStyle = cCard;
    roundedRect(ctx, 60, 60, W - 120, H - 120, 56);
    ctx.fill();
    ctx.restore();

    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";

    // logo (or the word Whimzyy)
    if (logo) {
      var h = 110;
      var w = h * (logo.naturalWidth / logo.naturalHeight);
      ctx.drawImage(logo, (W - w) / 2, 110, w, h);
    } else {
      ctx.fillStyle = cGold;
      ctx.font = "800 90px " + heading;
      ctx.fillText("Whimzyy", W / 2, 195);
    }

    // date and title
    ctx.fillStyle = cBeige;
    ctx.font = "800 54px " + heading;
    ctx.fillText(date.toLocaleDateString("en-IN", { weekday: "long" }), W / 2, 320);
    ctx.fillStyle = cPeach;
    ctx.font = "500 34px " + body;
    ctx.fillText(date.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }), W / 2, 372);

    if (facts.title) {
      ctx.fillStyle = cGold;
      ctx.font = "800 36px " + heading;
      ctx.fillText("✦ " + facts.title + " ✦", W / 2, 440);
    }

    // four stat tiles
    var tiles = [
      ["Focus", facts.focus ? minutesText(facts.focus) : "0 min"],
      ["Tasks done", String(facts.tasks)],
      ["Stars", "⭐ " + facts.stars],
      ["Water", "💧 " + facts.water + " / 8"]
    ];
    tiles.forEach(function (tile, i) {
      var x = 120 + (i % 2) * 420;
      var y = 490 + Math.floor(i / 2) * 210;
      ctx.fillStyle = "rgba(243, 231, 211, 0.09)";
      roundedRect(ctx, x, y, 390, 180, 36);
      ctx.fill();

      ctx.fillStyle = cPeach;
      ctx.font = "500 30px " + body;
      ctx.fillText(tile[0].toUpperCase(), x + 195, y + 60);
      ctx.fillStyle = cBeige;
      ctx.font = "800 58px " + heading;
      ctx.fillText(tile[1], x + 195, y + 133);
    });

    // mood and energy
    var line = [];
    if (facts.mood) { line.push(facts.mood); }
    if (facts.energy) { line.push("Energy: " + facts.energy); }
    ctx.fillStyle = cBeige;
    ctx.font = "700 42px " + body;
    ctx.fillText(line.length ? line.join("   ·   ") : "A quiet one ✨", W / 2, 990);

    if (facts.streak > 1) {
      ctx.fillStyle = cGold;
      ctx.font = "800 46px " + heading;
      ctx.fillText("🔥 " + facts.streak + "-day streak", W / 2, 1075);
    }

    // footer
    ctx.fillStyle = cSoft;
    ctx.font = "500 32px " + body;
    ctx.fillText("~ Productivity, but make it enchanted.", W / 2, 1230);

    return canvas;
  }

  function deliver(canvas, name) {
    return new Promise(function (resolve) {
      canvas.toBlob(function (blob) {
        if (!blob) { resolve(false); return; }

        var file = new File([blob], name, { type: "image/png" });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          navigator.share({ files: [file], title: "My Whimzyy day" }).catch(function () {});
        } else {
          var link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.download = name;
          document.body.appendChild(link);
          link.click();
          link.remove();
          setTimeout(function () { URL.revokeObjectURL(link.href); }, 4000);
        }
        resolve(true);
      }, "image/png");
    });
  }

  // makes the picture and shares it (or downloads it on computers)
  function shareDay(date) {
    state = load();
    date = date || new Date();
    var facts = dayFacts(date);
    var name = "whimzyy-" + facts.key + ".png";

    var fonts = (document.fonts && document.fonts.load)
      ? Promise.all([document.fonts.load('800 60px "Bricolage Grotesque"'),
                     document.fonts.load('500 30px "DM Sans"')]).catch(function () {})
      : Promise.resolve();

    return fonts.then(function () {
      var logoImg = document.querySelector(".whimzyy-logo");
      var logo = (logoImg && logoImg.complete && logoImg.naturalWidth) ? logoImg : null;

      var canvas;
      try {
        canvas = drawCard(facts, date, logo);
        canvas.toDataURL();                       // throws if the logo made the picture "tainted" (opening files directly)
      } catch (error) {
        canvas = drawCard(facts, date, null);     // try again with the text logo
      }
      return deliver(canvas, name);
    }).then(function (ok) {
      showToast(ok ? "Your day card is ready 📸" : "Couldn't make the picture");
    });
  }


  /* ---------- 8b. The stars strip on Home ---------- */

  // fills the strip and keeps it up to date:  Rewards.bindStrip(document.getElementById("starStrip"))
  function bindStrip(box) {
    if (!box) { return; }

    function draw() {
      state = load();
      var today = dayKey();
      var mins = state.minutes[today] || 0;
      var goal = goalMinutes();
      var streak = streakOf(state);

      box.textContent = "";
      box.appendChild(el("span", "ss-big", "⭐ " + starsOn(today) + " today"));
      box.appendChild(el("span", "ss-small", state.balance + " to spend" +
        (state.title ? "  ·  ✦ " + state.title : "")));
      if (streak > 0) {
        box.appendChild(el("span", "ss-small", "🔥 " + streak + "-day streak"));
      }

      var goalBox = el("div", "ss-goal");
      goalBox.appendChild(el("span", "ss-small", "Daily goal " + Math.min(mins, goal) + " / " + goal + " min"));
      var bar = el("div", "ss-bar");
      var fill = el("div", "ss-fill");
      fill.style.width = Math.min(100, Math.round(mins / goal * 100)) + "%";
      bar.appendChild(fill);
      goalBox.appendChild(bar);
      box.appendChild(goalBox);

      var shop = el("button", "ss-shop", "Shop");
      shop.type = "button";
      shop.addEventListener("click", function () { openShop("shop"); });
      box.appendChild(shop);
    }

    draw();
    window.addEventListener("rewards:change", draw);
  }


  /* ---------- 9. Start ---------- */

  window.Rewards = {
    bindStrip: bindStrip,
    onSession: onSession,
    onTaskDone: onTaskDone,
    onDetoxDay: onDetoxDay,
    isOwned: function (kind, id) { state = load(); return isOwned(kind, id); },
    require: require,
    buy: buy,
    balance: function () { state = load(); return state.balance; },
    lifetime: function () { state = load(); return state.lifetime; },
    streak: function () { state = load(); return streakOf(state); },
    title: function () { state = load(); return state.title; },
    minutesOn: function (day) { state = load(); return state.minutes[day] || 0; },
    goalMinutes: goalMinutes,
    starsOn: function (day) { state = load(); return starsOn(day); },
    entriesOn: function (day) { state = load(); return entriesOn(day); },
    starsBetween: function (from, to) { state = load(); return starsBetween(from, to); },
    openShop: openShop,
    shareDay: shareDay
  };

  // Vibe page: the special themes move out of the Themes list into their own card
  function groupSpecialThemes() {
    var list = document.getElementById("themeList");
    if (!list || typeof THEMES === "undefined") { return; }

    var specialNames = [];
    Object.keys(THEMES).forEach(function (id) {
      if (THEMES[id].special) { specialNames.push(THEMES[id].name); }
    });

    var buttons = Array.prototype.filter.call(list.children, function (button) {
      var name = button.querySelector(".theme-name");
      return name && specialNames.indexOf(name.textContent) !== -1;
    });
    var card = list.closest ? list.closest(".themes-card") : null;
    if (buttons.length === 0 || !card || !card.parentNode) { return; }

    var cols = card.closest(".vibe-cols");
    if (!cols || !cols.parentNode) { return; }

    var special = el("section", "card special-card");
    special.appendChild(el("h2", "", SPECIAL_TITLE));
    special.appendChild(el("p", "sp-hint", SPECIAL_HINT));
    var specialList = el("div", "theme-list");
    buttons.forEach(function (button) { specialList.appendChild(button); });
    special.appendChild(specialList);
    // Work Space background moves out of the right column: full width, below Themes + Sounds
    var bgCard = cols.querySelector(".bg-card");
    if (bgCard) { cols.parentNode.appendChild(bgCard); }
    // Main Character Drip stays the very last card, full width like Quick vibes
    cols.parentNode.appendChild(special);
  }

  function start() {
    buildPill();
    groupSpecialThemes();

    if (!state.welcomed) {
      state = load();
      if (!state.welcomed) {
        state.welcomed = true;
        add(WELCOME, "Welcome gift 🎁", "bonus");
        save();
        flush();
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }

  // another tab earned or spent stars: follow it here
  window.addEventListener("storage", function (event) {
    if (event.key === KEY) {
      state = load();
      refreshPill();
      if (dialog && dialog.open) { renderShop(); }
      window.dispatchEvent(new CustomEvent("rewards:change"));
    }
  });
})();
