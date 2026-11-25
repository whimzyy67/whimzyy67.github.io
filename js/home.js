/* ===== 1. Live clock ===== */

// find the two text elements in the time box
const clock = document.querySelector(".clock");
const dateText = document.querySelector(".today-date");

// write the current time and date into them
function updateClock() {
  const now = new Date();

  clock.textContent = now.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit"
  });

  dateText.textContent = now.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long"
  });
}

// run it once now, then again every second
updateClock();
setInterval(updateClock, 1000);

/* ===== 2. Quote slider ===== */

// find everything the slider needs
const slider = document.querySelector(".slider");
const slides = document.querySelectorAll(".slide");
const dots = document.querySelectorAll(".dot");
const prevBtn = document.querySelector(".slider-arrow.prev");
const nextBtn = document.querySelector(".slider-arrow.next");

let current = 0;   // which quote is showing (0 is the first)
let timer;         // will hold the auto-change timer

// show one quote: give "active" to it, take it away from the rest
function showSlide(index) {
  current = (index + slides.length) % slides.length;

  slides.forEach(function (slide, i) {
    slide.classList.toggle("active", i === current);
  });

  dots.forEach(function (dot, i) {
    dot.classList.toggle("active", i === current);
  });
}

// move to the next quote every 6 seconds
function startTimer() {
  clearInterval(timer);
  timer = setInterval(function () {
    showSlide(current + 1);
  }, 6000);
}

// arrows
prevBtn.addEventListener("click", function () {
  showSlide(current - 1);
});

nextBtn.addEventListener("click", function () {
  showSlide(current + 1);
});

// dots: clicking dot number i shows quote number i
dots.forEach(function (dot, i) {
  dot.addEventListener("click", function () {
    showSlide(i);
  });
});

// pause while the mouse is over the slider
slider.addEventListener("mouseenter", function () {
  clearInterval(timer);
});
slider.addEventListener("mouseleave", startTimer);

// start
showSlide(0);
startTimer();

/* ===== 3. To-do list ===== */

setupTodo(
  document.getElementById("todoList"),
  document.getElementById("todoForm"),
  document.getElementById("todoInput")
);

/* ===== 4. How was your day (remembered for each day) ===== */

const dayForm = document.getElementById("dayForm");
const dayAnswer = document.getElementById("dayAnswer");
const saveNote = document.getElementById("saveNote");

// today's date as YYYY-MM-DD, used in the saved name
const todayKey = new Date().toLocaleDateString("en-CA");
const answerKey = "whimzyy-answer-" + todayKey;

// when the page opens, show today's saved answer (if there is one)
const savedAnswer = localStorage.getItem(answerKey);
if (savedAnswer) {
  dayAnswer.value = savedAnswer;
  saveNote.textContent = "Saved for today.";
}

// when Save is pressed
dayForm.addEventListener("submit", function (event) {
  event.preventDefault();

  const text = dayAnswer.value.trim();
  if (text === "") {
    saveNote.textContent = "Write a little something first.";
    return;
  }

  localStorage.setItem(answerKey, text);
  saveNote.textContent = "Saved. See you tomorrow.";
});

/* ===== 5. Stars ===== */

Rewards.bindStrip(document.getElementById("starStrip"));