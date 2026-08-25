const welcomeKey = "mora:prototype:welcomeCompleted";
const spreadUrl = "/ritual";

window.MoraAnalytics.capture("welcome_viewed");

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
