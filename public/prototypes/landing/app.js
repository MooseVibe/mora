const welcomeKey = "mora:prototype:welcomeCompleted";
const spreadUrl = "../spread/index.html";

try {
  if (window.localStorage.getItem(welcomeKey) === "1") {
    window.location.replace(spreadUrl);
  }
} catch {
  // Without browser storage the welcome screen remains repeatable.
}

function enterMora(destination = spreadUrl) {
  try {
    window.localStorage.setItem(welcomeKey, "1");
  } catch {
    // Navigation still works when browser storage is unavailable.
  }
  window.location.replace(destination);
}

document.querySelector(".ritual-action").addEventListener("click", () => enterMora());
document.querySelector(".login").addEventListener("click", () => enterMora(`${spreadUrl}?login=1`));
