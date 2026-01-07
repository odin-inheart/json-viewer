import { ui } from "./ui.js";

function applyNavbarTheme(mode) {
  const navbar = document.getElementById("main-navbar");
  if (!navbar) return;

  if (mode === "dark") {
    navbar.classList.remove("navbar-light", "bg-white");
    navbar.classList.add("navbar-dark", "bg-dark");
  } else {
    navbar.classList.remove("navbar-dark", "bg-dark");
    navbar.classList.add("navbar-light", "bg-white");
  }
}

function applyTheme(mode) {
  document.documentElement.setAttribute("data-bs-theme", mode);

  document.body.classList.toggle("bg-light", mode === "light");
  document.body.classList.toggle("bg-dark", mode === "dark");
  document.body.classList.toggle("text-light", mode === "dark");

  applyNavbarTheme(mode);
  localStorage.setItem("theme", mode);
}

export function initTheme() {
  const saved = localStorage.getItem("theme");
  let mode;

  if (saved === "light" || saved === "dark") mode = saved;
  else mode = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

  applyTheme(mode);

  ui.toggleThemeBtn?.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-bs-theme") || "light";
    applyTheme(current === "dark" ? "light" : "dark");
  });
}
