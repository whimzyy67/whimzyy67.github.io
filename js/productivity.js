/* ===== 1. Settings, page elements and helpers ===== */

const SESSIONS_KEY = "whimzyy-sessions";
const TASKS_KEY = "whimzyy-tasks";
const GOAL_KEY = "whimzyy-goal";
const RANGE_KEY = "whimzyy-prod-range";
const DAY_MS = 86400000;
const MODES = ["pomodoro", "timer", "stopwatch"];

const summaryLine = document.getElementById("summaryLine");
const rangeTabs = document.querySelectorAll(".range-tab");
const statFocus = document.getElementById("statFocus");
const statFocusDelta = document.getElementById("statFocusDelta");
const statSessions = document.getElementById("statSessions");
const statSessionsDelta = document.getElementById("statSessionsDelta");
const statTasks = document.getElementById("statTasks");
const statTasksDelta = document.getElementById("statTasksDelta");
const statStreak = document.getElementById("statStreak");
const statStreakBest = document.getElementById("statStreakBest");
const chartTitle = document.getElementById("chartTitle");
const barsBox = document.getElementById("bars");
const labelsBox = document.getElementById("barLabels");
const goalLine = document.getElementById("goalLine");
const goalLineText = document.getElementById("goalLineText");
const goalRing = document.getElementById("goalRing");
const goalDone = document.getElementById("goalDone");
const goalOf = document.getElementById("goalOf");
const goalNote = document.getElementById("goalNote");
const goalInput = document.getElementById("goalInput");
const donutTotal = document.getElementById("donutTotal");
const partRows = document.querySelectorAll(".part-row");
const topTasks = document.getElementById("topTasks");
const statStars = document.getElementById("statStars");
const statStarsDelta = document.getElementById("statStarsDelta");

// the ring lengths come from the circles themselves, and the goal ring starts EMPTY
const GOAL_LENGTH = 2 * Math.PI * goalRing.r.baseVal.value;
goalRing.style.strokeDasharray = GOAL_LENGTH;
goalRing.style.strokeDashoffset = GOAL_LENGTH;

const DONUT_LENGTH = 2 * Math.PI * document.getElementById("seg-pomodoro").r.baseVal.value;

// what the page is showing right now
let rangeDays = Number(localStorage.getItem(RANGE_KEY)) || 7;     // 1 = Today, 7 = Week, 30 = Month
if ([1, 7, 30].indexOf(rangeDays) === -1) {
  rangeDays = 7;
}

let goalMinutes = Number(localStorage.getItem(GOAL_KEY)) || 120;

// reads a saved list (or an empty list if nothing is saved)
function loadList(key) {
  try {
    const list = JSON.parse(localStorage.getItem(key));
    return Array.isArray(list) ? list : [];
  } catch (error) {
    return [];
  }
}

// midnight at the start of the day that contains this time
function startOfDay(ms) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// the same time, n days later (or earlier if n is negative)
function addDays(ms, n) {
  const d = new Date(ms);
  d.setDate(d.getDate() + n);
  return d.getTime();
}

// 4500 seconds becomes "1 h 15 min"
function formatDuration(totalSeconds) {
  const minutes = Math.round(totalSeconds / 60);
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 ? h + " h" : h + " h " + m + " min";
  }
  return minutes + " min";
}

// 1 day, 3 days
function plural(n, word) {
  return n + " " + word + (n === 1 ? "" : "s");
}

function sumSeconds(list) {
  let total = 0;
  list.forEach(function (session) {
    total += session.seconds;
  });
  return total;
}

// how many tasks were ticked between two times
function countDone(tasks, from, to) {
  return tasks.filter(function (task) {
    return task.done && task.doneAt >= from && task.doneAt < to;
  }).length;
}

/* ===== 2. The four number cards ===== */

// writes the change line: "▲ 18% vs previous 7 days"
function setDelta(el, now, before, asPercent, label) {
  let text;
  let kind;

  if (now === before) {
    text = "no change";
    kind = "same";
  } else {
    const up = now > before;
    kind = up ? "up" : "down";

    if (asPercent) {
      text = (before === 0) ? "new" : Math.round(Math.abs(now - before) / before * 100) + "%";
    } else {
      text = String(Math.abs(now - before));
    }
    text = (up ? "▲ " : "▼ ") + text;
  }

  el.textContent = text + " " + label;
  el.className = "delta " + kind;
}

// current streak (days in a row, up to today) and best streak ever
function calcStreaks(sessions) {
  const days = new Set();
  sessions.forEach(function (session) {
    days.add(startOfDay(session.start));
  });

  // current streak: if today has no session yet, count from yesterday
  const today = startOfDay(Date.now());
  let day = days.has(today) ? today : addDays(today, -1);
  let current = 0;
  while (days.has(day)) {
    current += 1;
    day = addDays(day, -1);
  }

  // best streak: walk through all days in order
  const sorted = Array.from(days).sort(function (a, b) {
    return a - b;
  });
  let best = 0;
  let run = 0;
  let previous = null;
  sorted.forEach(function (d) {
    run = (previous !== null && d === addDays(previous, 1)) ? run + 1 : 1;
    if (run > best) {
      best = run;
    }
    previous = d;
  });

  return { current: current, best: best };
}

/* ===== 3. Bar chart, summary line and daily goal ===== */

// one bar per hour (Today) or one bar per day (Week, Month)
function buildBars(list, from) {
  const bars = [];

  if (rangeDays === 1) {
    const nowHour = new Date().getHours();

    for (let h = 0; h < 24; h++) {
      const hour12 = (h % 12 === 0) ? 12 : h % 12;
      bars.push({
        seconds: 0,
        label: (h % 3 === 0) ? hour12 + (h < 12 ? "a" : "p") : "",
        name: hour12 + (h < 12 ? " am" : " pm"),
        now: (h === nowHour)
      });
    }

    list.forEach(function (session) {
      bars[new Date(session.start).getHours()].seconds += session.seconds;
    });
  } else {
    for (let i = 0; i < rangeDays; i++) {
      const date = new Date(addDays(from, i));
      let label = "";

      if (rangeDays === 7) {
        label = date.toLocaleDateString("en-IN", { weekday: "short" });
      } else if (i % 5 === 0 || i === rangeDays - 1) {
        label = String(date.getDate());
      }

      bars.push({
        seconds: 0,
        label: label,
        name: date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }),
        now: (i === rangeDays - 1)
      });
    }

    list.forEach(function (session) {
      const i = Math.round((startOfDay(session.start) - from) / DAY_MS);
      if (bars[i]) {
        bars[i].seconds += session.seconds;
      }
    });
  }

  return bars;
}

function renderBars(bars) {
  barsBox.textContent = "";
  labelsBox.textContent = "";

  const goalSeconds = goalMinutes * 60;
  const showGoal = rangeDays > 1;      // a goal line per hour would make no sense

  // the tallest bar sets the scale (the goal counts too, so the line always fits)
  let max = 1;
  bars.forEach(function (bar) {
    if (bar.seconds > max) {
      max = bar.seconds;
    }
  });
  if (showGoal && goalSeconds > max) {
    max = goalSeconds;
  }

  bars.forEach(function (bar) {
    const col = document.createElement("div");
    col.className = "bar-col";
    col.title = bar.name + ": " + formatDuration(bar.seconds);

    const fill = document.createElement("div");
    fill.className = "bar-fill";
    fill.style.height = (bar.seconds / max * 100) + "%";
    if (bar.seconds > 0) {
      fill.style.minHeight = "3px";
    }
    if (bar.now) {
      fill.classList.add("now");
    }

    col.appendChild(fill);
    barsBox.appendChild(col);

    const label = document.createElement("span");
    label.className = "bar-label";
    label.textContent = bar.label;
    labelsBox.appendChild(label);
  });

  goalLine.hidden = !showGoal;
  if (showGoal) {
    goalLine.style.bottom = (goalSeconds / max * 100) + "%";
    goalLineText.textContent = "Goal " + formatDuration(goalSeconds);
  }

  if (rangeDays === 1) {
    chartTitle.textContent = "Focus time by hour";
  } else {
    chartTitle.textContent = "Focus time per day";
  }
}

// the friendly sentence under the heading
function buildSummary(seconds, count, bars, list) {
  if (count === 0) {
    return "No focus sessions in this period yet. Start one in Focus and this page comes alive.";
  }

  let text = formatDuration(seconds) + " of focus in " + plural(count, "session") + ".";

  if (rangeDays > 1) {
    let best = 0;
    bars.forEach(function (bar, i) {
      if (bar.seconds > bars[best].seconds) {
        best = i;
      }
    });
    text += " Your best day was " + bars[best].name + " (" + formatDuration(bars[best].seconds) + ").";
  } else if (count > 1) {
    let longest = 0;
    list.forEach(function (session) {
      if (session.seconds > longest) {
        longest = session.seconds;
      }
    });
    text += " Your longest session was " + formatDuration(longest) + ".";
  }

  return text;
}

// the daily goal ring (always about TODAY, whichever tab is chosen)
function renderGoal(todaySeconds) {
  const goalSeconds = goalMinutes * 60;
  const fraction = Math.min(1, todaySeconds / goalSeconds);

  goalRing.style.strokeDashoffset = GOAL_LENGTH * (1 - fraction);
  goalRing.style.opacity = (fraction > 0) ? "1" : "0";

  goalDone.textContent = formatDuration(todaySeconds);
  goalOf.textContent = "of " + formatDuration(goalSeconds);

  if (todaySeconds >= goalSeconds) {
    goalNote.textContent = "Goal reached. Well done!";
  } else {
    goalNote.textContent = formatDuration(goalSeconds - todaySeconds) + " to go";
  }
}

/* ===== 4. The three insight cards ===== */

// Tools used: the donut ring and its legend
function renderTools(list) {
  const seconds = { pomodoro: 0, timer: 0, stopwatch: 0 };
  list.forEach(function (session) {
    if (seconds[session.mode] !== undefined) {
      seconds[session.mode] += session.seconds;
    }
  });

  const total = seconds.pomodoro + seconds.timer + seconds.stopwatch;
  donutTotal.textContent = formatDuration(total);

  let used = 0;   // how much of the ring is already taken by earlier segments
  MODES.forEach(function (mode) {
    const seg = document.getElementById("seg-" + mode);
    const length = total ? seconds[mode] / total * DONUT_LENGTH : 0;

    seg.style.strokeDasharray = length + " " + DONUT_LENGTH;
    seg.style.strokeDashoffset = -used;
    used += length;

    const percent = total ? Math.round(seconds[mode] / total * 100) : 0;
    document.getElementById("val-" + mode).textContent = percent + "%";
  });
}

// Best time of day: morning, afternoon, evening, night
function renderParts(list) {
  const seconds = [0, 0, 0, 0];

  list.forEach(function (session) {
    const hour = new Date(session.start).getHours();
    let index;
    if (hour >= 5 && hour < 12) {
      index = 0;
    } else if (hour >= 12 && hour < 17) {
      index = 1;
    } else if (hour >= 17 && hour < 21) {
      index = 2;
    } else {
      index = 3;
    }
    seconds[index] += session.seconds;
  });

  const max = Math.max.apply(null, seconds);

  partRows.forEach(function (row, i) {
    row.querySelector(".part-fill").style.width = (max ? seconds[i] / max * 100 : 0) + "%";
    row.querySelector(".part-val").textContent = formatDuration(seconds[i]);
    row.classList.toggle("best", max > 0 && seconds[i] === max);
  });
}

// Top tasks: the three tasks you focused on most
function renderTopTasks(list) {
  const totals = {};
  list.forEach(function (session) {
    if (session.task) {
      totals[session.task] = (totals[session.task] || 0) + session.seconds;
    }
  });

  const top = Object.keys(totals).map(function (name) {
    return { name: name, seconds: totals[name] };
  }).sort(function (a, b) {
    return b.seconds - a.seconds;
  }).slice(0, 3);

  topTasks.textContent = "";

  top.forEach(function (item, i) {
    const li = document.createElement("li");

    const rank = document.createElement("span");
    rank.className = "rank";
    rank.textContent = i + 1;

    const name = document.createElement("span");
    name.className = "task-name";
    name.textContent = item.name;
    name.title = item.name;

    const time = document.createElement("span");
    time.className = "task-time";
    time.textContent = formatDuration(item.seconds);

    li.append(rank, name, time);
    topTasks.appendChild(li);
  });
}

/* ===== 5. Putting it all together ===== */

function render() {
  const sessions = loadList(SESSIONS_KEY);
  const tasks = loadList(TASKS_KEY);

  // the chosen period, the period before it, and today
  const todayStart = startOfDay(Date.now());
  const to = addDays(todayStart, 1);
  const from = addDays(to, -rangeDays);
  const prevFrom = addDays(from, -rangeDays);

  const current = sessions.filter(function (s) {
    return s.start >= from && s.start < to;
  });
  const previous = sessions.filter(function (s) {
    return s.start >= prevFrom && s.start < from;
  });
  const todays = sessions.filter(function (s) {
    return s.start >= todayStart && s.start < to;
  });

  const label = (rangeDays === 1) ? "vs yesterday" : "vs previous " + rangeDays + " days";

  // the four number cards
  const focusNow = sumSeconds(current);
  statFocus.textContent = formatDuration(focusNow);
  setDelta(statFocusDelta, focusNow, sumSeconds(previous), true, label);

  statSessions.textContent = current.length;
  setDelta(statSessionsDelta, current.length, previous.length, false, label);

  const doneNow = countDone(tasks, from, to);
  statTasks.textContent = doneNow;
  setDelta(statTasksDelta, doneNow, countDone(tasks, prevFrom, from), false, label);

  const streaks = calcStreaks(sessions);
  statStreak.textContent = plural(streaks.current, "day");
  statStreakBest.textContent = "Best: " + plural(streaks.best, "day");

  const starsNow = Rewards.starsBetween(from, to);
  statStars.textContent = starsNow;
  setDelta(statStarsDelta, starsNow, Rewards.starsBetween(prevFrom, from), false, label);

  // the chart, the summary line, the goal and the three insight cards
  const bars = buildBars(current, from);
  renderBars(bars);
  summaryLine.textContent = buildSummary(focusNow, current.length, bars, current);
  renderGoal(sumSeconds(todays));
  renderTools(current);
  renderParts(current);
  renderTopTasks(current);
}

// highlights the chosen tab
function updateTabs() {
  rangeTabs.forEach(function (tab) {
    const active = Number(tab.dataset.range) === rangeDays;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", active);
  });
}

rangeTabs.forEach(function (tab) {
  tab.addEventListener("click", function () {
    rangeDays = Number(tab.dataset.range);
    localStorage.setItem(RANGE_KEY, rangeDays);
    updateTabs();
    render();
  });
});

// changing the daily goal
goalInput.addEventListener("change", function () {
  const value = Number(goalInput.value);
  if (Number.isFinite(value)) {
    goalMinutes = Math.min(720, Math.max(10, Math.round(value)));
  }
  goalInput.value = goalMinutes;
  localStorage.setItem(GOAL_KEY, goalMinutes);
  render();
});

// if Focus or the to-do list changes in another tab, show it here too
window.addEventListener("storage", function (event) {
  if (event.key === SESSIONS_KEY || event.key === TASKS_KEY) {
    render();
  }
});

goalInput.value = goalMinutes;
updateTabs();
render();
setInterval(render, 60000);   // refresh once a minute if the page is left open
window.addEventListener("rewards:change", render);