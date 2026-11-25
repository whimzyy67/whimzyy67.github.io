const feedbackForm = document.getElementById("feedbackForm");
const feedbackText = document.getElementById("feedbackText");
const feedbackNote = document.getElementById("feedbackNote");


const feedbackEmail = "whimzyy67@gmail.com";

feedbackForm.addEventListener("submit", function (event) {
  event.preventDefault();

  const message = feedbackText.value.trim();
  if (message === "") {
    feedbackNote.textContent = "Write a few words first.";
    return;
  }

  const subject = encodeURIComponent("Whimzyy feedback");
  const body = encodeURIComponent(message);

  window.location.href =
    "mailto:" + feedbackEmail + "?subject=" + subject + "&body=" + body;

  feedbackNote.textContent = "Opening your email app. Press send there to finish.";
});