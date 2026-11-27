/* Side rail: opens when you hover over it, closes when the mouse leaves.
   On touch screens (no hover), the first tap opens it instead. */
const sideRail = document.getElementById("sidebar");
const canHover = window.matchMedia("(hover: hover)").matches;

function openSidebar() {
  document.body.classList.add("sidebar-open");
}
function closeSidebar() {
  document.body.classList.remove("sidebar-open");
}

if (canHover) {
  sideRail.addEventListener("mouseenter", openSidebar);
  sideRail.addEventListener("mouseleave", closeSidebar);
  // keyboard users: tabbing into the rail opens it too
  sideRail.addEventListener("focusin", openSidebar);
  sideRail.addEventListener("focusout", closeSidebar);
} else {
  // touch: first tap opens, second tap follows the link
  sideRail.addEventListener("click", function (event) {
    if (event.target.closest("a") && !document.body.classList.contains("sidebar-open")) {
      event.preventDefault();
      openSidebar();
    }
  });
  document.addEventListener("click", function (event) {
    if (!event.target.closest("#sidebar")) {
      closeSidebar();
    }
  });
}

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    closeSidebar();
  }
});

/* Productivity and Dayverse now live inside the Growth page, so the rail shows Growth and Search Homies instead.
   (done here so every page gets the new rail without editing each page's HTML) */
(function () {
  var list = document.querySelector("#sidebar ul");
  if (!list) { return; }
  function itemFor(name) {
    var found = null;
    list.querySelectorAll("a").forEach(function (a) {
      if (new RegExp("(^|/)" + name + "\\.html$").test(a.getAttribute("href") || "")) { found = a.closest("li"); }
    });
    return found;
  }
  var vibe = itemFor("vibe");
  var vibeLink = vibe && vibe.querySelector("a");
  var vibeImg = vibe && vibe.querySelector("img");
  var base = vibeLink ? vibeLink.getAttribute("href").replace(/vibe\.html$/, "") : "";
  var icons = vibeImg ? vibeImg.getAttribute("src").replace(/side-vibe\.png$/, "") : "stickers/";
  function make(label, file, title, icon) {
    var li = document.createElement("li");
    var a = document.createElement("a");
    a.href = base + file; a.title = title;
    var img = document.createElement("img");
    img.src = icons + icon; img.alt = label; img.className = "icon";
    a.appendChild(img); a.appendChild(document.createTextNode("\n                        " + label + "\n                    "));
    li.appendChild(a);
    return li;
  }
  var prod = itemFor("productivity"), day = itemFor("dayverse");
  var growth = make("Growth", "growth.html", "Productivity, Dayverse and your vision boards", "side-growth.png");
  var homies = make("Search Homies", "search-homies.html", "Find your friends and follow their progress", "side-search.png");
  if (prod) { prod.replaceWith(growth); } else { list.appendChild(growth); }
  if (day) { day.replaceWith(homies); } else { list.appendChild(homies); }
})();

/* Highlight the sidebar link for the page you are on */
document.querySelectorAll("#sidebar a").forEach(function (link) {
  var here = window.location.pathname;
  if (/\/(productivity|dayverse|habits)\.html$/.test(here)) { here = here.replace(/[^/]+$/, "growth.html"); }
  if (link.pathname === here) {
    link.classList.add("active");
    link.setAttribute("aria-current", "page");
  }
});