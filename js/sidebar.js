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

/* Highlight the sidebar link for the page you are on */
document.querySelectorAll("#sidebar a").forEach(function (link) {
  if (link.pathname === window.location.pathname) {
    link.classList.add("active");
    link.setAttribute("aria-current", "page");
  }
});