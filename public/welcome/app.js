const welcomeKey = "mora:prototype:welcomeCompleted";
const spreadUrl = "/ritual";

window.MoraAnalytics.capture("welcome_viewed");

const heroImage = document.querySelector(".card-snake img");
const hasDesktopArtwork = window.matchMedia("(min-width: 901px)").matches;
const imageReady = hasDesktopArtwork && heroImage?.decode
  ? heroImage.decode().catch(() => undefined)
  : Promise.resolve();
const fontsReady = document.fonts?.ready ?? Promise.resolve();

Promise.all([imageReady, fontsReady]).then(() => {
  window.requestAnimationFrame(() => document.documentElement.classList.add("welcome-ready"));
});

function enterMora(destination = spreadUrl) {
  window.MoraAnalytics.capture("welcome_entered", {
    destination: destination.includes("login=1") ? "login" : "ritual",
  });
  try {
    window.localStorage.setItem(welcomeKey, "1");
  } catch {
    // Navigation still works when browser storage is unavailable.
  }
  window.location.replace(destination);
}

document.querySelector(".ritual-action").addEventListener("click", () => enterMora());
document.querySelector(".login").addEventListener("click", () => enterMora(`${spreadUrl}?login=1`));
