/* ===== Widgets: show or hide, date and time, personal message, to-do list ===== */

/* ----- 1. Which widgets are on, and where they sit ----- */

let shown = { clock: true };
try {
  shown = JSON.parse(localStorage.getItem("whimzyy-widgets")) || { clock: true };
} catch (error) {
  shown = { clock: true };
}

const POS_KEY = "whimzyy-widget-pos";
let positions = {};          // { clock: { x: 0.1, y: 0.2 } }  (share of the free space, 0 to 1)
try {
  positions = JSON.parse(localStorage.getItem(POS_KEY)) || {};
} catch (error) {
  positions = {};
}

// put a widget at a pixel spot, never outside the window
function setPx(widget, left, top) {
  const maxLeft = Math.max(0, window.innerWidth - widget.offsetWidth);
  const maxTop = Math.max(0, window.innerHeight - widget.offsetHeight);
  widget.style.left = Math.min(maxLeft, Math.max(0, left)) + "px";
  widget.style.top = Math.min(maxTop, Math.max(0, top)) + "px";
}

// remember where a widget is (as a share of the window, so it adapts to other screens)
function rememberPos(name, widget) {
  const freeX = window.innerWidth - widget.offsetWidth;
  const freeY = window.innerHeight - widget.offsetHeight;
  positions[name] = {
    x: freeX > 0 ? widget.offsetLeft / freeX : 0,
    y: freeY > 0 ? widget.offsetTop / freeY : 0
  };
  localStorage.setItem(POS_KEY, JSON.stringify(positions));
}

// use the saved spot, or a staggered starting spot
function placeWidget(name, widget) {
  const saved = positions[name];
  if (saved) {
    setPx(widget,
      saved.x * (window.innerWidth - widget.offsetWidth),
      saved.y * (window.innerHeight - widget.offsetHeight));
  } else {
    const k = Math.max(0, document.querySelectorAll(".widget:not([hidden])").length - 1);
    setPx(widget, 24 + k * 28, 92 + k * 28);
  }
}

function startAlign(widget) {
  widget.classList.add("aligning");
}

function finishAlign(name, widget) {
  widget.classList.remove("aligning");
  rememberPos(name, widget);
}

// adds the [✥ Align] [Done] bar and the hover ✥ button to a widget
function addAlignTools(name, widget) {
  const bar = document.createElement("div");
  bar.className = "w-bar";

  const align = document.createElement("button");
  align.type = "button";
  align.className = "w-chip w-align";
  align.textContent = "✥ Align";
  align.title = "Drag me to move this widget";

  const done = document.createElement("button");
  done.type = "button";
  done.className = "w-chip done-chip";
  done.textContent = "Done";
  done.addEventListener("click", function () {
    finishAlign(name, widget);
  });

  bar.append(align, done);
  widget.prepend(bar);

  const again = document.createElement("button");
  again.type = "button";
  again.className = "w-realign";
  again.textContent = "✥";
  again.title = "Move this widget";
  again.addEventListener("click", function () {
    startAlign(widget);
  });
  widget.appendChild(again);

  // dragging: hold the Align button and move
  align.addEventListener("pointerdown", function (event) {
    event.preventDefault();
    const box = widget.getBoundingClientRect();
    const offsetX = event.clientX - box.left;
    const offsetY = event.clientY - box.top;
    align.setPointerCapture(event.pointerId);

    function move(e) {
      setPx(widget, e.clientX - offsetX, e.clientY - offsetY);
    }
    function stop() {
      align.removeEventListener("pointermove", move);
      align.removeEventListener("pointerup", stop);
      rememberPos(name, widget);
    }
    align.addEventListener("pointermove", move);
    align.addEventListener("pointerup", stop);
  });
}

document.querySelectorAll("[data-toggle]").forEach(function (box) {
  const name = box.dataset.toggle;
  const widget = document.querySelector('[data-widget="' + name + '"]');

  if (!widget) {
    console.warn("No widget has data-widget=\"" + name + "\"");
    return;
  }

  addAlignTools(name, widget);

  box.checked = Boolean(shown[name]);
  widget.hidden = !box.checked;
  if (box.checked) {
    placeWidget(name, widget);       // already placed before: stays put
  }

  box.addEventListener("change", function () {
    widget.hidden = !box.checked;
    shown[name] = box.checked;
    localStorage.setItem("whimzyy-widgets", JSON.stringify(shown));

    if (box.checked) {
      placeWidget(name, widget);
      startAlign(widget);            // new widget: show Align and Done straight away
    } else {
      widget.classList.remove("aligning");
    }
  });
});

// keep widgets inside the window if it is resized
window.addEventListener("resize", function () {
  document.querySelectorAll("[data-toggle]").forEach(function (box) {
    const widget = document.querySelector('[data-widget="' + box.dataset.toggle + '"]');
    if (widget && !widget.hidden) {
      placeWidget(box.dataset.toggle, widget);
    }
  });
});

/* ----- 2. Date and time ----- */

const wClock = document.getElementById("wClock");
const wDate = document.getElementById("wDate");

function updateClock() {
  const now = new Date();
  wClock.textContent = now.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  wDate.textContent = now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
}

updateClock();
setInterval(updateClock, 1000);

/* ----- 3. Personal message ----- */

const messageForm = document.getElementById("messageForm");
const messageBox = document.getElementById("messageBox");
const messageText = document.getElementById("messageText");

// saved mode: show only the message
function showSavedMessage(text) {
  messageText.textContent = text;
  messageForm.hidden = true;
  messageText.hidden = false;
}

// writing mode: show the box and the Save button
function showMessageEditor() {
  messageForm.hidden = false;
  messageText.hidden = true;
  messageBox.focus();
}

// when the page opens: show the saved message, or the writing box
const savedMessage = localStorage.getItem("whimzyy-message");
if (savedMessage) {
  messageBox.value = savedMessage;
  showSavedMessage(savedMessage);
}

// Save button
messageForm.addEventListener("submit", function (event) {
  event.preventDefault();   // stops the browser from reloading the page

  const text = messageBox.value.trim();
  if (text === "") {
    messageBox.focus();
    return;
  }

  localStorage.setItem("whimzyy-message", text);
  showSavedMessage(text);
});

// clicking the saved message lets you edit it again
messageText.addEventListener("click", showMessageEditor);

/* ----- 4. To-do list (the shared list from tasks.js) ----- */

setupTodo(
  document.getElementById("wTodoList"),
  document.getElementById("wTodoForm"),
  document.getElementById("wTodoInput")
);