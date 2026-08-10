import { TAROT_CARDS } from "/assets/cards.js";
import { mountDailyDeck3D } from "./daily-3d.js?v=20260810-entrance1";
import { mountSpreadDeck3D } from "./spread-deck-3d.js?v=20260810-entrance1";

const deckOrderKey = "mora:prototype:spreadDeckOrder";
const availableSpreadCards = TAROT_CARDS
  .filter((card) => card.image)
  .map((card) => ({ ...card, image: `/${card.image.replace(/^\/+/, "")}` }));
const spreadDeck = restoreSpreadDeckOrder(availableSpreadCards);
const selectedCards = [];
const spreadSize = 3;

const ritual = document.querySelector(".ritual-screen");
const topics = document.querySelectorAll(".topic");
const selectedTopic = document.querySelector("#selected-topic");
const slots = [...document.querySelectorAll(".slot")];
const deckHint = document.querySelector("#deck-hint");
const deck = document.querySelector("#deck");
const savedTopic = document.querySelector("#saved-topic");
const savedCards = document.querySelector("#saved-cards");
const savedSpread = document.querySelector("#saved-spread");
const newSpreadButton = document.querySelector("#new-spread");
const stage = document.querySelector(".card-stage");
const readingTopic = document.querySelector("#reading-topic");
const reading = document.querySelector("#reading");
const readingCopy = document.querySelector(".reading-copy");
const readingBoundaryButton = document.querySelector(".reading-boundary-hint");
const chapters = [...document.querySelectorAll(".chapter")];
const readingNavItems = [...document.querySelectorAll(".reading-nav button")];
const starfield = document.querySelector("#starfield");
const dailyModeButton = document.querySelector("#daily-mode-button");
const spreadModeButton = document.querySelector("#spread-mode-button");
const loginButton = document.querySelector(".login");
const profileControl = document.querySelector(".profile-control");
const profileTrigger = document.querySelector(".profile-trigger");
const profileMenu = document.querySelector("#profile-menu");
const profileLogout = document.querySelector(".profile-logout");
const loginScreen = document.querySelector("#login-screen");
const loginScreenBrand = document.querySelector(".login-screen-brand");
const loginScreenForm = document.querySelector("#login-screen-form");
const loginScreenEmail = document.querySelector("#login-screen-email");
const authGate = document.querySelector("#auth-gate");
const authGateForm = document.querySelector("#auth-gate-form");
const authGateEmail = document.querySelector("#auth-gate-email");
const authGateClose = document.querySelector(".auth-gate-close");
const dailyDeck = document.querySelector("#daily-deck");
const dailyDeckCanvas = document.querySelector("#daily-deck-canvas");
const spreadDeck3DHost = document.querySelector("#spread-deck-3d");
const spreadDeck3DCanvas = document.querySelector("#spread-deck-3d-canvas");
const dailyResultTitleMain = document.querySelector("#daily-result-title-main");
const dailyResultTitleMeta = document.querySelector("#daily-result-title-meta");
const dailyResultSuit = document.querySelector("#daily-result-suit");
const dailyResultSuitIcon = document.querySelector("#daily-result-suit-icon");
const dailyResultSuitLabel = document.querySelector("#daily-result-suit-label");
const dailyResultText = document.querySelector("#daily-result-text");
const dailyResultImage = document.querySelector("#daily-result-image");
const dailyResultCard = document.querySelector(".daily-result-card");
const dailyResultCardTilt = document.querySelector(".daily-result-card-tilt");
const readingStatusCopy = document.querySelector(".status-copy");
let picked = 0;
let activeChapter = 0;
let wheelGestureActive = false;
let wheelGestureDirection = 0;
let wheelGesturePeak = 0;
let wheelGestureDecayed = false;
let wheelLastDelta = 0;
let wheelLastNavigation = 0;
let wheelGestureTimer;
let scrollSettleTimer;
let deckPromptTimer;
let deckDiscoveryFrame;
let dragState = null;
let deckScroll = 0;
let selectionInFlight = false;
let currentTopic = "";
let dailyDrawInFlight = false;
let daily3DResultActive = false;
let daily3DRestoreInFlight = false;
let modeSwitchInFlight = false;
let stateTransitionInFlight = false;
let touchStartY = 0;
let touchStartedOnFirstChapter = false;
let touchStartedOnLastChapter = false;
let savedTouchStartY = 0;
let wheelNeedsRelease = false;
let blockedWheelDirection = 0;
let wheelReleaseTimer;
let savedReturnChapter = null;
let dailyResultTiltFrame;
let dailyResultTilt = { x: 0, y: 0 };
let savedCardTiltFrame;
let activeSavedCardTilt;
let savedCardTilt = { x: 0, y: 0 };
let spreadDeck3DController;
let spreadDeck3DPromise;
let prototypeTesterAuthenticated = false;
let prototypeTesterIsAdmin = false;
let prototypeNextSpreadAt = 0;
let spreadCooldownTimer;
let volatileFailedSpread = null;

dailyDeck.classList.add("is-3d-loading");
const dailyDeck3D = mountDailyDeck3D({
  canvas: dailyDeckCanvas,
  host: dailyDeck,
  onSelect: prepareDailyCardSelection,
  onResult: showDaily3DResult,
}).catch((error) => {
  dailyDeck.classList.remove("is-3d-loading");
  console.error("Mora daily 3D deck failed to load", error);
  return null;
});

const savedSpreadKey = "mora:prototype:lastSpread";
const savedDailyCardKey = "mora:prototype:dailyCard";
const isLocalPrototype = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
const spreadCooldownMs = 24 * 60 * 60 * 1000;
const suitTags = {
  "Пентакли": "./icons/suit-pentacles.svg",
  "Мечи": "./icons/suit-swords.svg",
  "Жезлы": "./icons/suit-wands.svg",
  "Кубки": "./icons/suit-cups.svg",
};
const topicIcons = {
  "Внутреннее состояние": "./icons/star-four.svg",
  "Работа": "./icons/bag.svg",
  "Отношения": "./icons/heart.svg",
  "Выбор": "./icons/diamonds-four.svg",
};

function shuffleCards(cards) {
  const shuffled = [...cards];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function createNextDeckOrder(cards, previousOrder = []) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const shuffled = shuffleCards(cards);
    if (!previousOrder.length || shuffled.every((card, index) => card.id !== previousOrder[index])) {
      return shuffled;
    }
  }

  const shift = 1 + Math.floor(Math.random() * (cards.length - 1));
  return cards.map((_, index) => cards[(index + shift) % cards.length]);
}

function saveSpreadDeckOrder(cards) {
  try {
    window.localStorage.setItem(deckOrderKey, JSON.stringify(cards.map((card) => card.id)));
  } catch {
    // The prototype still works when localStorage is unavailable.
  }
}

function restoreSpreadDeckOrder(cards) {
  try {
    const savedOrder = JSON.parse(window.localStorage.getItem(deckOrderKey) || "null");
    if (
      Array.isArray(savedOrder) &&
      savedOrder.length === cards.length &&
      new Set(savedOrder).size === cards.length
    ) {
      const cardsById = new Map(cards.map((card) => [card.id, card]));
      const restored = savedOrder.map((id) => cardsById.get(id));
      if (restored.every(Boolean)) return restored;
    }
  } catch {
    // A fresh order below replaces invalid or unavailable storage.
  }

  const shuffled = createNextDeckOrder(cards);
  saveSpreadDeckOrder(shuffled);
  return shuffled;
}

initStarfield();
const testerSessionReady = restorePrototypeTesterSession();
restoreSavedSpread();
const urlParams = new URLSearchParams(window.location.search);
const resetDailyMode = urlParams.get("resetDaily");
if (isLocalPrototype && (resetDailyMode === "1" || resetDailyMode === "always")) {
  window.localStorage.removeItem(savedDailyCardKey);
  if (resetDailyMode === "1") {
    urlParams.delete("resetDaily");
    window.history.replaceState(null, "", `${window.location.pathname}?${urlParams}`.replace(/\?$/, ""));
  }
}
const startInSpreadMode = urlParams.get("mode") === "spread";
startInSpreadMode ? showSpreadMode() : showDailyMode();
if (startInSpreadMode) window.history.replaceState(null, "", window.location.pathname);
revealSiteWhenReady();

dailyModeButton.addEventListener("click", () => switchMode("daily"));
spreadModeButton.addEventListener("click", () => {
  if (prototypeTesterAuthenticated) {
    switchMode("spread");
  } else {
    openAuthGate();
  }
});
loginButton.addEventListener("click", openLoginScreen);
profileTrigger.addEventListener("click", () => {
  const open = profileTrigger.getAttribute("aria-expanded") !== "true";
  profileTrigger.setAttribute("aria-expanded", String(open));
  profileMenu.setAttribute("aria-hidden", String(!open));
});
profileLogout.addEventListener("click", logoutPrototypeTester);
document.addEventListener("click", (event) => {
  if (!profileControl.contains(event.target)) closeProfileMenu();
});
loginScreenBrand.addEventListener("click", (event) => {
  event.preventDefault();
  closeLoginScreen();
});
loginScreenForm.addEventListener("submit", (event) => handleTesterLogin(event, "daily"));
authGateClose.addEventListener("click", closeAuthGate);
authGateForm.addEventListener("submit", (event) => handleTesterLogin(event, "spread"));
dailyDeck.addEventListener("click", handleDailyDeckClick);

async function restorePrototypeTesterSession() {
  const params = new URLSearchParams(window.location.search);
  const localPreview = isLocalPrototype && params.get("testerPreview") === "1";
  if (localPreview) {
    setPrototypeTesterAuthenticated(true, true);
    document.documentElement.classList.remove("tester-session-pending");
    return;
  }

  try {
    const response = await fetch("/api/prototypes/tester-session", { cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.json();
    setPrototypeTesterAuthenticated(
      payload.authenticated === true,
      payload.isAdmin === true,
      payload.nextSpreadAt,
    );
  } catch {
    // The public daily-card flow remains available when session lookup fails.
  } finally {
    document.documentElement.classList.remove("tester-session-pending");
  }
}

function waitForBackground() {
  const image = new Image();
  image.src = "./assets/mora-background-v1.webp";
  return image.decode?.().catch(() => {}) || Promise.resolve();
}

async function revealSiteWhenReady() {
  await Promise.allSettled([testerSessionReady, dailyDeck3D, waitForBackground()]);
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => document.documentElement.classList.remove("site-loading"));
  });
}

async function handleTesterLogin(event, destination) {
  event.preventDefault();
  const form = event.currentTarget;
  const emailInput = destination === "spread" ? authGateEmail : loginScreenEmail;
  if (!emailInput.reportValidity()) return;

  const pendingEmail = form.dataset.pendingEmail || "";
  const isOtpStep = Boolean(pendingEmail);
  const requestBody = isOtpStep
    ? { email: pendingEmail, otp: emailInput.value }
    : { email: emailInput.value };

  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = isOtpStep ? "Проверяем…" : "Входим…";

  try {
    const response = await fetch("/api/prototypes/tester-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Tester session failed");
    if (payload.requiresOtp) {
      form.dataset.pendingEmail = emailInput.value.trim().toLowerCase();
      emailInput.value = "";
      emailInput.type = "text";
      emailInput.inputMode = "numeric";
      emailInput.pattern = "[0-9]{6,8}";
      emailInput.placeholder = "Код из письма";
      emailInput.setAttribute("aria-label", "Код из письма");
      submitButton.textContent = "Войти";
      emailInput.focus();
      return;
    }

    setPrototypeTesterAuthenticated(true, payload.isAdmin === true, payload.nextSpreadAt);
    resetTesterLoginForm(form, emailInput);
    if (destination === "spread") {
      closeAuthGate();
      await switchMode("spread");
    } else {
      closeLoginScreen();
      showDailyMode();
    }
  } catch {
    emailInput.setCustomValidity("Не удалось войти. Попробуй ещё раз.");
    emailInput.reportValidity();
    emailInput.addEventListener("input", () => emailInput.setCustomValidity(""), { once: true });
  } finally {
    submitButton.disabled = false;
    if (!form.dataset.pendingEmail || prototypeTesterAuthenticated) {
      submitButton.textContent = "Продолжить";
    }
  }
}

function resetTesterLoginForm(form, input) {
  delete form.dataset.pendingEmail;
  input.value = "";
  input.type = "email";
  input.inputMode = "email";
  input.removeAttribute("pattern");
  input.placeholder = "Электронная почта";
  input.setAttribute("aria-label", "Электронная почта");
}

function setPrototypeTesterAuthenticated(authenticated, isAdmin = false, nextSpreadAt = null) {
  prototypeTesterAuthenticated = authenticated;
  prototypeTesterIsAdmin = authenticated && isAdmin;
  prototypeNextSpreadAt = authenticated && !isAdmin ? Date.parse(nextSpreadAt || "") || 0 : 0;
  document.body.classList.toggle("prototype-tester", authenticated);
  updateNewSpreadButton();
  if (!authenticated) closeProfileMenu();
}

function closeProfileMenu() {
  profileTrigger.setAttribute("aria-expanded", "false");
  profileMenu.setAttribute("aria-hidden", "true");
}

async function logoutPrototypeTester() {
  profileLogout.disabled = true;
  try {
    await fetch("/api/prototypes/tester-session", { method: "DELETE" });
  } finally {
    setPrototypeTesterAuthenticated(false);
    showDailyMode();
    profileLogout.disabled = false;
  }
}

function openLoginScreen() {
  loginScreen.setAttribute("aria-hidden", "false");
  document.body.classList.add("login-screen-open");
  window.setTimeout(() => loginScreenEmail.focus(), 220);
}

function closeLoginScreen() {
  loginScreen.setAttribute("aria-hidden", "true");
  document.body.classList.remove("login-screen-open");
  loginButton.focus();
}

function openAuthGate() {
  authGate.setAttribute("aria-hidden", "false");
  document.body.classList.add("auth-gate-open");
  window.setTimeout(() => authGateEmail.focus(), 220);
}

function closeAuthGate() {
  authGate.setAttribute("aria-hidden", "true");
  document.body.classList.remove("auth-gate-open");
  spreadModeButton.focus();
}

async function handleDailyDeckClick(event) {
  const controller = await dailyDeck3D;
  if (!controller || (event.detail !== 0 && !controller.isDeckHovered())) return;
  controller.activate({ keyboard: event.detail === 0 });
}

async function switchMode(mode) {
  const targetButton = mode === "daily" ? dailyModeButton : spreadModeButton;
  if (modeSwitchInFlight || targetButton.classList.contains("active")) return;

  modeSwitchInFlight = true;
  document.body.classList.add("mode-switching");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  await new Promise((resolve) => window.setTimeout(resolve, reducedMotion ? 1 : 180));

  if (mode === "daily") {
    showDailyMode();
  } else {
    showSpreadMode();
  }

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      document.body.classList.remove("mode-switching");
      modeSwitchInFlight = false;
    });
  });
}

function showDailyMode() {
  dailyDeck3D.then((controller) => controller?.setActive(true));
  resetSavedCardTilt();
  savedReturnChapter = null;
  document.body.classList.remove(
    "saved-home",
    "reading-ready",
    "reading-transition",
    "reading-entering",
    "daily-result-ready",
    "daily-result-entering",
    "daily-3d-result",
    "daily-3d-result-entering",
    "daily-3d-ritual",
    "daily-3d-animating",
  );
  document.body.classList.add("daily-mode");
  dailyModeButton.classList.add("active");
  spreadModeButton.classList.remove("active");

  const savedDailyCard = readSavedDailyCard();
  dailyDeck.disabled = Boolean(savedDailyCard);
  if (savedDailyCard) {
    populateDailyResult(savedDailyCard.card, savedDailyCard.variantIndex);
    if (daily3DResultActive) {
      dailyDeck.disabled = false;
      document.body.classList.add("daily-3d-result");
    } else if (!daily3DRestoreInFlight) {
      daily3DRestoreInFlight = true;
      document.body.classList.add("daily-3d-restoring");
      dailyDeck3D.then(async (controller) => {
        if (!controller) return;
        await controller.restoreResult({
          ...savedDailyCard,
          imageUrl: `/${savedDailyCard.card.image.replace(/^\/+/, "")}`,
        });
        showDaily3DResult();
      }).finally(() => {
        daily3DRestoreInFlight = false;
      });
    }
  } else {
    document.documentElement.classList.remove("daily-saved-pending");
  }
}

function showSpreadMode() {
  ensureSpreadDeck3D();
  dailyDeck3D.then((controller) => controller?.setActive(false));
  resetDailyResultTilt();
  document.body.classList.remove(
    "daily-mode",
    "daily-result-ready",
    "daily-result-entering",
    "daily-3d-result",
    "daily-3d-result-entering",
    "daily-3d-ritual",
    "daily-3d-animating",
  );
  dailyModeButton.classList.remove("active");
  spreadModeButton.classList.add("active");

  if (readLastSpread()) {
    restoreSavedSpread();
  }
}

function applyDailyResultTilt() {
  dailyResultTiltFrame = null;
  dailyResultCardTilt.style.setProperty("--daily-result-tilt-x", `${dailyResultTilt.x.toFixed(2)}deg`);
  dailyResultCardTilt.style.setProperty("--daily-result-tilt-y", `${dailyResultTilt.y.toFixed(2)}deg`);
}

function resetDailyResultTilt() {
  if (dailyResultTiltFrame) window.cancelAnimationFrame(dailyResultTiltFrame);
  dailyResultTiltFrame = null;
  dailyResultTilt = { x: 0, y: 0 };
  dailyResultCardTilt.classList.remove("is-tilting");
  applyDailyResultTilt();
}

function moveDailyResultTilt(event) {
  if (
    !document.body.classList.contains("daily-result-ready") ||
    !window.matchMedia("(hover: hover) and (pointer: fine)").matches ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) return;

  const rect = dailyResultCard.getBoundingClientRect();
  if (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  ) {
    if (dailyResultCardTilt.classList.contains("is-tilting")) resetDailyResultTilt();
    return;
  }
  const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
  const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
  dailyResultTilt = { x: -y * 5.8, y: x * 5.8 };
  dailyResultCardTilt.classList.add("is-tilting");
  if (dailyResultTiltFrame) window.cancelAnimationFrame(dailyResultTiltFrame);
  dailyResultTiltFrame = window.requestAnimationFrame(applyDailyResultTilt);
}

window.addEventListener("pointermove", moveDailyResultTilt, { passive: true });

function applySavedCardTilt() {
  savedCardTiltFrame = null;
  if (!activeSavedCardTilt) return;
  activeSavedCardTilt.style.setProperty("--saved-card-tilt-x", `${savedCardTilt.x.toFixed(2)}deg`);
  activeSavedCardTilt.style.setProperty("--saved-card-tilt-y", `${savedCardTilt.y.toFixed(2)}deg`);
}

function resetSavedCardTilt() {
  if (savedCardTiltFrame) window.cancelAnimationFrame(savedCardTiltFrame);
  savedCardTiltFrame = null;
  savedCardTilt = { x: 0, y: 0 };
  if (!activeSavedCardTilt) return;
  activeSavedCardTilt.classList.remove("is-tilting");
  applySavedCardTilt();
  activeSavedCardTilt = null;
}

function moveSavedCardTilt(event) {
  const activeReadingCard = (
    document.body.classList.contains("reading-ready")
    && ["0", "1", "2"].includes(stage.dataset.active)
  );
  if (
    (!document.body.classList.contains("saved-home") && !activeReadingCard) ||
    !window.matchMedia("(hover: hover) and (pointer: fine)").matches ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    if (activeSavedCardTilt) resetSavedCardTilt();
    return;
  }

  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(".tarot-card-shell");
  const stageCard = target?.closest(".stage-card");
  if (stageCard && stageCard.dataset.card !== stage.dataset.active) {
    if (activeSavedCardTilt) resetSavedCardTilt();
    return;
  }
  if (!target) {
    if (activeSavedCardTilt) resetSavedCardTilt();
    return;
  }
  if (activeSavedCardTilt && activeSavedCardTilt !== target) resetSavedCardTilt();

  activeSavedCardTilt = target;
  const rect = target.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
  const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
  savedCardTilt = { x: -y * 5.8, y: x * 5.8 };
  target.classList.add("is-tilting");
  if (savedCardTiltFrame) window.cancelAnimationFrame(savedCardTiltFrame);
  savedCardTiltFrame = window.requestAnimationFrame(applySavedCardTilt);
}

window.addEventListener("pointermove", moveSavedCardTilt, { passive: true });
window.addEventListener("pointercancel", () => {
  resetDailyResultTilt();
  resetSavedCardTilt();
});

function getDailyCard() {
  const availableCards = TAROT_CARDS.filter((card) => {
    return card?.result?.dayVariants?.length && card.image;
  });
  return availableCards[Math.floor(Math.random() * availableCards.length)];
}

function populateDailyResult(card, variantIndex) {
  const variants = card.result.dayVariants;
  const variant = variants[variantIndex];
  const paragraphs = (
    Array.isArray(variant) ? variant : variant.preview || variant.full || []
  ).slice(0, 2);
  const title = card.result.title || card.name;
  const titleMeta = card.result.titleMeta || "";
  const suit = (card.result.tags || []).find((tag) => suitTags[tag]);
  const isMajorArcana = (card.result.tags || []).includes("Старший аркан");
  const fallbackTag = (card.result.tags || [])[0] || "Таро";
  const tagIcon = isMajorArcana
    ? `./icons/arcana-${card.num}.svg`
    : suitTags[suit];
  dailyResultTitleMain.textContent = titleMeta ? `${title} — ` : title;
  dailyResultTitleMeta.textContent = titleMeta;
  dailyResultSuitLabel.textContent = isMajorArcana ? "Старший аркан" : suit || fallbackTag;
  dailyResultSuitIcon.hidden = !tagIcon;
  dailyResultSuit.classList.toggle("without-icon", !tagIcon);
  if (tagIcon) {
    dailyResultSuitIcon.style.setProperty("--daily-result-tag-icon", `url("${tagIcon}")`);
  }
  dailyResultText.replaceChildren();
  paragraphs.forEach((paragraph) => {
    const item = document.createElement("p");
    item.textContent = paragraph;
    dailyResultText.append(item);
  });
  dailyResultImage.src = `/${card.image.replace(/^\/+/, "")}`;
  dailyResultImage.alt = card.name;
}

function getLocalDayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function readSavedDailyCard() {
  try {
    const value = window.localStorage.getItem(savedDailyCardKey);
    if (!value) return null;
    const snapshot = JSON.parse(value);
    const dayKey = getLocalDayKey();
    if (snapshot?.dayKey && snapshot.dayKey !== dayKey) {
      window.localStorage.removeItem(savedDailyCardKey);
      return null;
    }
    const card = TAROT_CARDS.find((item) => item.id === snapshot?.cardId);
    const variantIndex = Number(snapshot?.variantIndex);
    if (!card?.result?.dayVariants?.[variantIndex]) return null;
    if (!snapshot?.dayKey) {
      window.localStorage.setItem(
        savedDailyCardKey,
        JSON.stringify({ ...snapshot, version: 2, dayKey }),
      );
    }
    return { card, variantIndex };
  } catch {
    return null;
  }
}

function prepareDailyCardSelection() {
  if (dailyDrawInFlight || readSavedDailyCard()) return;

  const card = getDailyCard();
  if (!card) return;
  const variantIndex = Math.floor(Math.random() * card.result.dayVariants.length);
  dailyDrawInFlight = true;
  dailyDeck.disabled = true;
  populateDailyResult(card, variantIndex);
  try {
    window.localStorage.setItem(
      savedDailyCardKey,
      JSON.stringify({
        version: 2,
        dayKey: getLocalDayKey(),
        cardId: card.id,
        variantIndex,
      }),
    );
  } catch {
    // The prototype still completes when localStorage is unavailable.
  }

  return {
    card,
    variantIndex,
    imageUrl: `/${card.image.replace(/^\/+/, "")}`,
  };
}

function showDaily3DResult() {
  daily3DResultActive = true;
  dailyDeck.disabled = false;
  document.documentElement.classList.remove("daily-saved-pending");
  document.body.classList.remove("daily-3d-ritual", "daily-3d-animating", "daily-3d-restoring");
  document.body.classList.add("daily-3d-result", "daily-3d-result-entering");
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      document.body.classList.remove("daily-3d-result-entering");
    });
  });
}

async function drawDailyCard() {
  const selection = prepareDailyCardSelection();
  if (!selection) return;
  const { card } = selection;

  const source = dailyDeck.querySelector(".daily-deck-card-top");
  const sourceRect = source.getBoundingClientRect();
  const flight = document.createElement("div");
  const inner = document.createElement("div");
  const back = document.createElement("div");
  const front = document.createElement("div");
  const image = document.createElement("img");
  flight.className = "daily-flight";
  inner.className = "daily-flight-inner";
  back.className = "daily-flight-side daily-flight-back";
  front.className = "daily-flight-side daily-flight-front";
  image.src = dailyResultImage.src;
  image.alt = "";
  front.append(image);
  inner.append(back, front);
  flight.append(inner);
  Object.assign(flight.style, {
    left: `${sourceRect.left}px`,
    top: `${sourceRect.top}px`,
    width: `${sourceRect.width}px`,
    height: `${sourceRect.height}px`,
  });
  document.body.append(flight);
  document.body.classList.add("daily-drawing");

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reducedMotion) {
    await flight.animate(
      [
        { transform: "translate3d(0, 0, 0) rotate(0deg)" },
        { transform: "translate3d(0, -34px, 0) rotate(-1deg)" },
      ],
      { duration: 520, easing: "cubic-bezier(0.22, 0.61, 0.36, 1)", fill: "forwards" },
    ).finished;
  }

  flight.classList.add("is-flipped");
  await new Promise((resolve) => window.setTimeout(resolve, reducedMotion ? 1 : 680));
  document.body.classList.add("daily-result-ready", "daily-result-entering");

  const targetRect = document.querySelector(".daily-result-card").getBoundingClientRect();
  const scale = targetRect.width / sourceRect.width;
  const offsetX = targetRect.left - sourceRect.left;
  const offsetY = targetRect.top - sourceRect.top;

  if (!reducedMotion) {
    await flight.animate(
      [
        { transform: "translate3d(0, -34px, 0) rotate(-1deg) scale(1)" },
        { transform: `translate3d(${offsetX}px, ${offsetY}px, 0) rotate(0deg) scale(${scale})` },
      ],
      { duration: 720, easing: "cubic-bezier(0.18, 0.82, 0.22, 1)", fill: "forwards" },
    ).finished;
  }

  flight.remove();
  document.body.classList.remove("daily-drawing", "daily-result-entering");
  dailyDrawInFlight = false;
}

function initStarfield() {
  const gl = starfield.getContext("webgl", {
    alpha: true,
    antialias: false,
    powerPreference: "low-power",
  });
  if (!gl) {
    starfield.hidden = true;
    return;
  }

  const vertexShader = `
    attribute vec2 position;
    void main() {
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;
  const fragmentShader = `
    precision highp float;

    uniform vec2 resolution;
    uniform float time;

    float hash(vec2 point) {
      point = fract(point * vec2(123.34, 456.21));
      point += dot(point, point + 45.32);
      return fract(point.x * point.y);
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / resolution.xy;
      vec2 gridSize = vec2(42.0, 24.0);
      vec2 cell = floor(uv * gridSize);
      vec2 local = fract(uv * gridSize) - 0.5;

      float seed = hash(cell);
      vec2 offset = vec2(hash(cell + 2.7), hash(cell + 8.1)) - 0.5;
      local -= offset * 0.62;

      float rare = step(0.86, seed);
      float sizeSeed = pow(hash(cell + 17.0), 2.4);
      float radius = mix(0.02, 0.072, sizeSeed);
      float distanceToStar = length(local);
      float core = smoothstep(radius, radius * 0.08, distanceToStar);
      float star = core * rare;

      float speed = mix(0.42, 0.9, hash(cell + 4.0));
      float phase = hash(cell + 11.0) * 6.28318;
      float pulse = 0.28 + 0.72 * (0.5 + 0.5 * sin(time * speed + phase));
      float vignette = smoothstep(0.0, 0.28, uv.x) *
        smoothstep(0.0, 0.28, 1.0 - uv.x) *
        smoothstep(0.0, 0.2, uv.y) *
        smoothstep(0.0, 0.2, 1.0 - uv.y);

      vec3 starColor = vec3(0.94, 0.88, 0.74) * star * pulse * vignette;
      float alpha = clamp(star * pulse * vignette * 0.82, 0.0, 1.0);
      gl_FragColor = vec4(starColor, alpha);
    }
  `;

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  }

  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexShader));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentShader));
  gl.linkProgram(program);
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );

  const position = gl.getAttribLocation(program, "position");
  const resolution = gl.getUniformLocation(program, "resolution");
  const time = gl.getUniformLocation(program, "time");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let lastStarfieldFrame = -Infinity;

  function resize() {
    const scale = Math.min(window.devicePixelRatio || 1, 1.25);
    starfield.width = Math.round(window.innerWidth * scale);
    starfield.height = Math.round(window.innerHeight * scale);
    gl.viewport(0, 0, starfield.width, starfield.height);
    gl.uniform2f(resolution, starfield.width, starfield.height);
  }

  function render(now = 0) {
    if (now - lastStarfieldFrame >= 1000 / 30) {
      lastStarfieldFrame = now;
      gl.uniform1f(time, now * 0.001);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    if (!reducedMotion) window.requestAnimationFrame(render);
  }

  resize();
  window.addEventListener("resize", resize);
  render();
}

const deckCardCount = spreadDeck.length;
const visibleDeckCards = Math.min(10, spreadDeck.length);
const deckCards = [];

for (let index = 0; index < deckCardCount; index += 1) {
  const tarotCard = spreadDeck[index];
  const card = document.createElement("button");
  card.type = "button";
  card.className = "deck-card";
  card.dataset.cardId = tarotCard.id;
  card.setAttribute("aria-label", `Выбрать карту ${index + 1}`);
  card.addEventListener("click", pickCard);
  card.addEventListener("pointerdown", startCardDrag);
  card.addEventListener("pointerenter", () => spreadDeck3DController?.setHovered(index));
  card.addEventListener("pointerleave", () => spreadDeck3DController?.setHovered(null));
  card.addEventListener("focus", () => spreadDeck3DController?.setHovered(index));
  card.addEventListener("blur", () => spreadDeck3DController?.setHovered(null));
  deck.append(card);
  deckCards.push(card);
}

function ensureSpreadDeck3D() {
  if (spreadDeck3DPromise) return spreadDeck3DPromise;
  spreadDeck3DPromise = mountSpreadDeck3D({
    canvas: spreadDeck3DCanvas,
    host: spreadDeck3DHost,
    cardElements: deckCards,
  })
    .then((controller) => {
      spreadDeck3DController = controller;
      renderDeck();
      ritual.classList.add("spread-deck-3d-ready");
      return controller;
    })
    .catch((error) => {
      spreadDeck3DHost?.classList.add("is-failed");
      console.error("Mora spread 3D deck failed to load", error);
      return null;
    });
  return spreadDeck3DPromise;
}

function renderDeck() {
  const visibleCardIndices = [];
  const visibleLimit = window.innerWidth / 2 + 320;
  deckCards.forEach((card, index) => {
    const offset = index - (deckCardCount - 1) / 2 + deckScroll / 98;
    card.style.top = `${offset ** 2 * 2}px`;
    card.style.transform = `translateX(calc(-50% + ${offset * 98}px)) rotate(${offset * 1.88}deg)`;
    card.style.zIndex = String(index);
    if (Math.abs(offset * 98) <= visibleLimit) visibleCardIndices.push(index);
  });
  spreadDeck3DController?.setVisibleIndices(visibleCardIndices);
}

function stopDeckDiscoveryMotion() {
  window.cancelAnimationFrame(deckDiscoveryFrame);
  deck.classList.remove("is-discovering");
}

function playDeckDiscoveryMotion() {
  stopDeckDiscoveryMotion();
  deckScroll = 0;
  renderDeck();
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  deck.classList.add("is-discovering");
  const startedAt = performance.now();
  const target = -Math.min(((deckCardCount - visibleDeckCards) * 98) / 2, 5 * 98);
  const duration = 1050;

  function moveDeck(now) {
    const progress = Math.min(1, (now - startedAt) / duration);
    deckScroll = target * (1 - (1 - progress) ** 3);
    renderDeck();
    if (progress < 1) {
      deckDiscoveryFrame = window.requestAnimationFrame(moveDeck);
    } else {
      deck.classList.remove("is-discovering");
    }
  }

  deckDiscoveryFrame = window.requestAnimationFrame(moveDeck);
}

renderDeck();
window.addEventListener("resize", renderDeck);

ritual.addEventListener(
  "wheel",
  (event) => {
    if (ritual.dataset.step !== "choose") return;

    event.preventDefault();
    stopDeckDiscoveryMotion();
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    const limit = ((deckCardCount - visibleDeckCards) * 98) / 2;
    deckScroll = Math.max(-limit, Math.min(limit, deckScroll - delta));
    renderDeck();
  },
  { passive: false },
);

topics.forEach((topic) => {
  topic.addEventListener("click", () => {
    currentTopic = topic.dataset.topic;
    selectedTopic.innerHTML = topic.innerHTML;
    readingTopic.textContent = `Расклад · ${currentTopic.toLowerCase()}`;
    ritual.dataset.step = "choose";
    showDeckHint();
    playDeckDiscoveryMotion();
  });
});

slots.forEach((slot, slotIndex) => {
  slot.addEventListener("click", () => {
    if (slot.classList.contains("is-3d-filled")) {
      spreadDeck3DController?.spinResult(slotIndex);
      return;
    }
    if (ritual.dataset.step === "choose" && !slot.classList.contains("filled")) {
      showDeckHint();
      promptDeck();
    }
  });
  slot.addEventListener("pointermove", (event) => {
    if (!slot.classList.contains("is-3d-filled")) return;
    const rect = slot.getBoundingClientRect();
    spreadDeck3DController?.setResultTilt(
      slotIndex,
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      ((event.clientY - rect.top) / rect.height) * 2 - 1,
    );
  });
  slot.addEventListener("pointerleave", () => {
    if (slot.classList.contains("is-3d-filled")) spreadDeck3DController?.clearResultTilt(slotIndex);
  });
});

selectedTopic.addEventListener("click", () => {
  if (picked > 0) return;
  ritual.dataset.step = "topic";
});

function showDeckHint() {
  if (picked > 0) return;
  deckHint.classList.remove("is-hidden", "is-animating");
  void deckHint.offsetWidth;
  deckHint.classList.add("is-animating");
}

function promptDeck() {
  window.clearTimeout(deckPromptTimer);
  deck.classList.add("is-prompted");
  deckPromptTimer = window.setTimeout(() => {
    deck.classList.remove("is-prompted");
  }, 900);
}

function pickCard(event) {
  if (event.currentTarget.dataset.suppressClick === "true") {
    delete event.currentTarget.dataset.suppressClick;
    return;
  }

  flyCardToNextSlot(event.currentTarget);
}

async function flyCardToNextSlot(source) {
  if (selectionInFlight || picked >= spreadSize) return;

  selectionInFlight = true;
  deckHint.classList.add("is-hidden");
  deck.classList.remove("is-prompted");
  window.clearTimeout(deckPromptTimer);

  const target = slots[picked];
  const card = spreadDeck.find((item) => item.id === source.dataset.cardId);
  if (!card) {
    selectionInFlight = false;
    return;
  }
  if (spreadDeck3DController) {
    try {
      const selected = await spreadDeck3DController.drawToSlot({
        index: deckCards.indexOf(source),
        slotIndex: picked,
        imageUrl: card.image,
        targetElement: target,
        onTextReveal: () => revealSlotName(target, card.name),
        onCover: () => target.classList.add("is-3d-covered"),
      });
      if (selected) commitCard(source, card, { threeD: true });
      else target.classList.remove("is-3d-covered");
    } catch (error) {
      target.classList.remove("is-3d-covered");
      console.error("Mora spread 3D card flight failed", error);
    } finally {
      selectionInFlight = false;
    }
    return;
  }
  const sourceRect = source.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const sourceWidth = source.offsetWidth;
  const sourceHeight = source.offsetHeight;
  const sourceAngle = Number(source.style.transform.match(/rotate\(([-\d.]+)deg\)/)?.[1] || 0);
  const startX = sourceRect.left + sourceRect.width / 2 - sourceWidth / 2;
  const startY = sourceRect.top + sourceRect.height / 2 - sourceHeight / 2;
  const endX = targetRect.left + targetRect.width / 2 - sourceWidth / 2;
  const endY = targetRect.top + targetRect.height / 2 - sourceHeight / 2;
  const endScale = targetRect.width / sourceWidth;
  const flyingCard = document.createElement("div");
  const flyingCardFace = document.createElement("img");
  flyingCard.className = "dragging-card flying-card is-visible is-revealing";
  flyingCard.style.width = `${sourceWidth}px`;
  flyingCard.style.height = `${sourceHeight}px`;
  flyingCardFace.className = "flying-card-face";
  flyingCardFace.src = card.image;
  flyingCardFace.alt = "";
  flyingCard.append(flyingCardFace);
  document.body.append(flyingCard);

  source.style.opacity = "0";
  source.style.pointerEvents = "none";

  const animation = flyingCard.animate(
    [
      {
        transform: `translate3d(${startX}px, ${startY}px, 0) rotate(${sourceAngle}deg) scale(1)`,
      },
      {
        offset: 0.72,
        transform: `translate3d(${endX}px, ${endY - 10}px, 0) rotate(0deg) scale(${endScale * 1.03})`,
      },
      {
        transform: `translate3d(${endX}px, ${endY}px, 0) rotate(0deg) scale(${endScale})`,
      },
    ],
    {
      duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : 680,
      easing: "cubic-bezier(0.22, 0.61, 0.36, 1)",
      fill: "forwards",
    },
  );

  try {
    await animation.finished;
  } finally {
    commitCard(source, card);
    flyingCard.remove();
    selectionInFlight = false;
  }
}

function commitCard(
  source,
  card = spreadDeck.find((item) => item.id === source.dataset.cardId),
  { threeD = false } = {},
) {
  if (picked >= spreadSize || !card) return;

  deckHint.classList.add("is-hidden");
  const slot = slots[picked];
  const name = slot.querySelector(".slot-name") || createSlotName(card.name);

  source.disabled = true;
  source.style.opacity = "0";
  source.style.pointerEvents = "none";
  if (threeD) {
    slot.append(name);
    slot.classList.remove("is-3d-covered");
    slot.classList.add("is-3d-filled");
  } else {
    const image = document.createElement("img");
    image.src = card.image;
    image.alt = card.name;
    slot.append(image, name);
  }
  slot.classList.add("filled");
  slot.setAttribute("aria-label", card.name);
  if (!threeD) revealSlotName(slot, card.name);
  selectedCards.push(card);
  picked += 1;
  updateNextSlot();

  if (picked === spreadSize) {
    ritual.dataset.step = "loading";
    spreadDeck3DController?.hideFan();
    spreadDeck3DController?.syncResults(800);
    generateReading();
  }
}

function createSlotName(text) {
  const name = document.createElement("span");
  name.className = "slot-name";
  name.setAttribute("aria-label", text);
  return name;
}

function revealSlotName(slot, text) {
  if (slot.querySelector(".slot-name.is-visible")) return;
  const name = slot.querySelector(".slot-name") || createSlotName(text);
  name.textContent = text;
  if (!name.isConnected) slot.append(name);
  window.requestAnimationFrame(() => name.classList.add("is-visible"));
}

function saveLastSpread(reading, source) {
  const snapshot = {
    version: 2,
    topic: currentTopic,
    cardIds: selectedCards.map((card) => card.id),
    reading,
    source,
    createdAt: new Date().toISOString(),
  };

  try {
    window.localStorage.setItem(savedSpreadKey, JSON.stringify(snapshot));
  } catch {
    // The prototype still completes when localStorage is unavailable.
  }
  volatileFailedSpread = null;
}

function readLastSpread() {
  try {
    const value = window.localStorage.getItem(savedSpreadKey);
    const snapshot = value ? JSON.parse(value) : volatileFailedSpread;
    if (!snapshot) return null;
    const cardIds = Array.isArray(snapshot.cardIds)
      ? snapshot.cardIds
      : snapshot.cards?.map((savedCard) => (
          TAROT_CARDS.find((card) => (
            card.image.replace(/^\/+/, "") === savedCard.image.replace(/^\/+/, "")
          ))?.id
        ));
    const cards = cardIds?.map((id) => spreadDeck.find((card) => card.id === id));
    if (!snapshot?.topic || cards?.length !== spreadSize || cards.some((card) => !card)) return null;
    return {
      ...snapshot,
      cards,
      reading: snapshot.reading || buildFallbackReading(snapshot.topic, cards),
      source: snapshot.source || "fallback",
    };
  } catch {
    return null;
  }
}

function restoreSavedSpread() {
  const snapshot = readLastSpread();
  if (!snapshot) return;

  renderSavedSpread(snapshot);
  document.body.classList.add("saved-home");
}

function renderSavedSpread(snapshot) {
  resetSavedCardTilt();
  currentTopic = snapshot.topic;
  populateReading(snapshot.reading, snapshot.cards, snapshot.source);
  savedTopic.replaceChildren();
  const icon = document.createElement("img");
  const label = document.createElement("span");
  icon.src = topicIcons[snapshot.topic] || topicIcons["Внутреннее состояние"];
  icon.alt = "";
  label.textContent = snapshot.topic;
  savedTopic.append(icon, label);

  savedCards.replaceChildren();
  snapshot.cards.forEach((card) => {
    const figure = document.createElement("figure");
    const cardShell = document.createElement("div");
    const image = document.createElement("img");
    const caption = document.createElement("figcaption");
    figure.className = "saved-card";
    cardShell.className = "tarot-card-shell saved-card-shell";
    image.src = card.image;
    image.alt = card.name;
    caption.textContent = card.name;
    cardShell.append(image);
    figure.append(cardShell, caption);
    savedCards.append(figure);
  });
  updateNewSpreadButton(snapshot);
}

function updateNewSpreadButton(snapshot = readLastSpread()) {
  window.clearInterval(spreadCooldownTimer);
  spreadCooldownTimer = undefined;

  const createdAt = Date.parse(snapshot?.createdAt || "");
  const localCooldownEndsAt = Number.isFinite(createdAt) ? createdAt + spreadCooldownMs : 0;
  const cooldownEndsAt = Math.max(localCooldownEndsAt, prototypeNextSpreadAt);

  const render = () => {
    const remaining = cooldownEndsAt - Date.now();
    const locked = prototypeTesterAuthenticated && !prototypeTesterIsAdmin && remaining > 0;
    newSpreadButton.disabled = locked;

    if (!locked) {
      newSpreadButton.textContent = "Ещё расклад";
      if (spreadCooldownTimer) window.clearInterval(spreadCooldownTimer);
      spreadCooldownTimer = undefined;
      return;
    }

    const totalSeconds = Math.ceil(remaining / 1000);
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    newSpreadButton.textContent = `Новый расклад через ${hours}:${minutes}:${seconds}`;
  };

  render();
  if (newSpreadButton.disabled) spreadCooldownTimer = window.setInterval(render, 1000);
}

function blockUntilNewWheelGesture(direction = 0) {
  wheelNeedsRelease = true;
  blockedWheelDirection = direction;
  window.clearTimeout(wheelReleaseTimer);
  wheelReleaseTimer = window.setTimeout(() => {
    wheelNeedsRelease = false;
    blockedWheelDirection = 0;
  }, 220);
}

function absorbCurrentWheelGesture(direction) {
  if (!wheelNeedsRelease) return false;
  if (blockedWheelDirection && direction !== blockedWheelDirection) {
    wheelNeedsRelease = false;
    blockedWheelDirection = 0;
    window.clearTimeout(wheelReleaseTimer);
    return false;
  }
  blockUntilNewWheelGesture(blockedWheelDirection);
  return true;
}

function resetReadingScroll(chapterIndex = 0) {
  readingCopy.classList.add("is-resetting");
  readingCopy.scrollTop = chapterIndex * readingCopy.clientHeight;
  void readingCopy.offsetHeight;
  readingCopy.classList.remove("is-resetting");
}

function openSavedReading(chapterIndex = 0, wheelDirection = 0) {
  if (stateTransitionInFlight) return;
  const snapshot = readLastSpread();
  if (!snapshot) return;

  resetSavedCardTilt();
  const targetChapter = Math.max(0, Math.min(chapters.length - 1, chapterIndex));
  savedReturnChapter = null;
  stateTransitionInFlight = true;
  blockUntilNewWheelGesture(wheelDirection);
  setActiveChapter(targetChapter);
  document.body.classList.add("saved-to-reading");
  resetReadingScroll(targetChapter);

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => document.body.classList.add("saved-reading-entering"));
  });

  window.setTimeout(() => {
    document.body.classList.remove("saved-home", "saved-to-reading", "saved-reading-entering");
    document.body.classList.add("reading-ready");
    resetReadingScroll(targetChapter);
    stateTransitionInFlight = false;
  }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : 700);
}

function closeReadingToSaved(returnChapter = null, wheelDirection = 0) {
  if (stateTransitionInFlight) return;
  const snapshot = readLastSpread();
  if (!snapshot) return;

  savedReturnChapter = returnChapter;
  stateTransitionInFlight = true;
  blockUntilNewWheelGesture(wheelDirection);
  renderSavedSpread(snapshot);
  document.body.classList.add("reading-to-saved");

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => document.body.classList.add("reading-saved-entering"));
  });

  window.setTimeout(() => {
    document.body.classList.remove("reading-ready", "reading-to-saved", "reading-saved-entering");
    document.body.classList.add("saved-home");
    stateTransitionInFlight = false;
  }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : 700);
}

newSpreadButton.addEventListener("click", () => {
  if (newSpreadButton.disabled) return;
  try {
    const nextDeck = createNextDeckOrder(spreadDeck, spreadDeck.map((card) => card.id));
    saveSpreadDeckOrder(nextDeck);
    window.localStorage.removeItem(savedSpreadKey);
    volatileFailedSpread = null;
  } finally {
    window.location.href = "./index.html?mode=spread";
  }
});

function updateNextSlot() {
  slots.forEach((slot, index) => {
    slot.classList.toggle("is-next", index === picked && picked < spreadSize);
    if (index !== picked) {
      slot.classList.remove("is-target", "is-magnetized");
    }
  });
}

function startCardDrag(event) {
  if (selectionInFlight || picked >= spreadSize || event.button !== 0) return;

  stopDeckDiscoveryMotion();
  const source = event.currentTarget;
  const target = slots[picked];
  const cardIndex = deckCards.indexOf(source);

  dragState = {
    source,
    target,
    cardIndex,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    moved: false,
    magnetized: false,
  };

  window.addEventListener("pointermove", moveCardDrag);
  window.addEventListener("pointerup", endCardDrag);
  window.addEventListener("pointercancel", cancelCardDrag);
}

function moveCardDrag(event) {
  if (!dragState || event.pointerId !== dragState.pointerId) return;

  const distanceFromStart = Math.hypot(
    event.clientX - dragState.startX,
    event.clientY - dragState.startY,
  );
  if (distanceFromStart > 6 && !dragState.moved) {
    dragState.moved = true;
    deckHint.classList.add("is-hidden");
    spreadDeck3DController?.startDrag(dragState.cardIndex);
    dragState.target.classList.add("is-target");
  }

  const targetRect = dragState.target.getBoundingClientRect();
  const targetX = targetRect.left + targetRect.width / 2;
  const targetY = targetRect.top + targetRect.height / 2;
  const distanceToTarget = Math.hypot(event.clientX - targetX, event.clientY - targetY);
  const magnetized = distanceToTarget < Math.max(targetRect.width, targetRect.height) * 0.72;

  dragState.magnetized = magnetized;
  dragState.target.classList.toggle("is-magnetized", magnetized);
  if (dragState.moved) {
    spreadDeck3DController?.moveDrag(
      dragState.cardIndex,
      magnetized ? targetX : event.clientX,
      magnetized ? targetY : event.clientY,
      Math.min(1, distanceFromStart / 80),
      magnetized ? dragState.target : null,
    );
  }
}

async function endCardDrag(event) {
  if (!dragState || event.pointerId !== dragState.pointerId) return;

  const { source, target, cardIndex, magnetized, moved } = dragState;
  cleanupDragListeners(source);
  target.classList.remove("is-target", "is-magnetized");

  if (moved) source.dataset.suppressClick = "true";
  if (magnetized && spreadDeck3DController) {
    selectionInFlight = true;
    const card = spreadDeck.find((item) => item.id === source.dataset.cardId);
    target.classList.add("is-3d-covered");
    try {
      const selected = await spreadDeck3DController.drawToSlot({
        index: cardIndex,
        slotIndex: picked,
        imageUrl: card.image,
        targetElement: target,
        onTextReveal: () => revealSlotName(target, card.name),
        onCover: () => target.classList.add("is-3d-covered"),
      });
      if (selected) commitCard(source, card, { threeD: true });
      else showDeckHint();
    } finally {
      selectionInFlight = false;
    }
  } else {
    selectionInFlight = true;
    try {
      await spreadDeck3DController?.cancelDrag();
    } finally {
      selectionInFlight = false;
      showDeckHint();
    }
  }

  dragState = null;
}

async function cancelCardDrag(event) {
  if (!dragState || event.pointerId !== dragState.pointerId) return;

  const { source, target } = dragState;
  cleanupDragListeners(source);
  target.classList.remove("is-target", "is-magnetized");
  await spreadDeck3DController?.cancelDrag();
  showDeckHint();
  dragState = null;
}

function cleanupDragListeners(source) {
  window.removeEventListener("pointermove", moveCardDrag);
  window.removeEventListener("pointerup", endCardDrag);
  window.removeEventListener("pointercancel", cancelCardDrag);
}

updateNextSlot();

function buildFallbackReading(topic, cards) {
  return {
    version: 1,
    overview: {
      title: "Полное чтение не загрузилось",
      text: `Карты для темы «${topic.toLowerCase()}» сохранились. Ниже показаны только их базовые значения — это не готовый расклад.`,
    },
    cards: cards.map((card, index) => ({
      cardId: card.id,
      title: card.name,
      meaning: `На карте видно: ${card.visualHint}.`,
      context: `${["Сейчас", "Что мешает", "Что делать"][index]}: ${card.description}`,
    })),
    conclusion: {
      title: "Это техническая заглушка",
      text: "Gemini и GigaChat не вернули готовое чтение. Не оценивай по этому тексту качество расклада Mora.",
    },
  };
}

async function generateReading() {
  const fallback = buildFallbackReading(currentTopic, selectedCards);
  const startedAt = Date.now();
  const longResponseTimer = window.setTimeout(() => {
    readingStatusCopy.firstChild.textContent = "Смотрим глубже";
  }, 8000);

  try {
    const response = await fetch("/api/prototypes/spread-reading", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: currentTopic,
        cardIds: selectedCards.map((card) => card.id),
      }),
    });
    if (!response.ok) throw new Error("Gemini is unavailable");
    const payload = await response.json();
    const reading = payload.reading;
    const source = payload.source || "ai";
    prototypeNextSpreadAt = Date.parse(payload.nextSpreadAt || "") || prototypeNextSpreadAt;
    populateReading(reading, selectedCards, source);
    saveLastSpread(reading, source);
  } catch {
    populateReading(fallback, selectedCards, "fallback");
    volatileFailedSpread = {
      version: 2,
      topic: currentTopic,
      cardIds: selectedCards.map((card) => card.id),
      reading: fallback,
      source: "fallback",
      completed: false,
    };
  } finally {
    window.clearTimeout(longResponseTimer);
    readingStatusCopy.firstChild.textContent = "Раскладываем";
  }

  const remainingRitual = Math.max(0, 1500 - (Date.now() - startedAt));
  window.setTimeout(showReading, remainingRitual);
}

function populateReading(reading, cards, source = "fallback") {
  const sourceLabel = { gemini: "Gemini", gigachat: "GigaChat", fallback: "Fallback", ai: "AI" }[source] || source;
  readingTopic.textContent = `1 из 5 · Общий рисунок · ${currentTopic || "тема"} · ${sourceLabel}`;
  chapters[0].querySelector("h2").textContent = reading.overview.title;
  chapters[0].querySelector("p").textContent = reading.overview.text;

  cards.forEach((card, index) => {
    const cardReading = reading.cards[index];
    const chapter = chapters[index + 1];
    const navItem = readingNavItems[index + 1];
    chapter.querySelector("h3").textContent = card.name;
    const paragraphs = chapter.querySelectorAll("p");
    paragraphs[0].textContent = cardReading.meaning;
    paragraphs[1].textContent = cardReading.context;
    const position = ["Сейчас", "Что мешает", "Что делать"][index];
    navItem.dataset.label = `${position} · ${card.name}`;
    navItem.setAttribute("aria-label", `${position}: ${card.name}`);
    const image = stage.querySelector(`[data-card="${index}"] img`);
    image.src = card.image;
    image.alt = card.name;
  });

  chapters[4].querySelector("h3").textContent = reading.conclusion.title;
  chapters[4].querySelector("p").textContent = reading.conclusion.text;
}

function showReading() {
  readingCopy.scrollTop = 0;
  setActiveChapter(0);
  document.body.classList.add("reading-transition");

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      document.body.classList.add("reading-entering");
    });
  });

  window.setTimeout(
    () => {
      document.body.classList.add("reading-ready");
      document.body.classList.remove("reading-transition", "reading-entering");
    },
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : 700,
  );
}

function setActiveChapter(index) {
  activeChapter = Math.max(0, Math.min(chapters.length - 1, index));
  const chapter = chapters[activeChapter];
  const navChapter = Math.min(activeChapter, readingNavItems.length - 1);

  chapters.forEach((item) => item.classList.toggle("is-active", item === chapter));
  readingNavItems.forEach((item, itemIndex) => item.classList.toggle("is-active", itemIndex === navChapter));
  stage.dataset.active = chapter.dataset.active;
  reading.classList.toggle("is-at-end", activeChapter === chapters.length - 1);
}

function goToChapter(index) {
  const target = Math.max(0, Math.min(chapters.length - 1, index));
  if (target === activeChapter) return false;

  setActiveChapter(target);
  readingCopy.scrollTo({
    top: activeChapter * readingCopy.clientHeight,
    behavior: "smooth",
  });
  return true;
}

reading.addEventListener(
  "wheel",
  (event) => {
    if (!document.body.classList.contains("reading-ready")) return;
    event.preventDefault();

    const direction = Math.sign(event.deltaY);
    const delta = Math.abs(event.deltaY);
    const now = Date.now();
    if (!direction || absorbCurrentWheelGesture(direction)) return;

    window.clearTimeout(wheelGestureTimer);
    wheelGestureTimer = window.setTimeout(() => {
      wheelGestureActive = false;
      wheelGestureDirection = 0;
      wheelGesturePeak = 0;
      wheelGestureDecayed = false;
      wheelLastDelta = 0;
    }, 180);

    if (delta < 6) return;

    const target = Math.max(0, Math.min(chapters.length - 1, activeChapter + direction));
    if (target === activeChapter) {
      if (direction > 0 && activeChapter === chapters.length - 1 && !wheelGestureActive) {
        closeReadingToSaved(activeChapter, direction);
      }
      if (direction < 0 && activeChapter === 0 && !wheelGestureActive) {
        closeReadingToSaved(null, direction);
      }
      return;
    }

    const changedDirection = wheelGestureActive &&
      direction !== wheelGestureDirection &&
      delta >= 12;
    const restartedGesture = wheelGestureActive &&
      direction === wheelGestureDirection &&
      wheelGestureDecayed &&
      now - wheelLastNavigation > 220 &&
      delta > Math.max(12, wheelLastDelta * 1.65);

    if (!wheelGestureActive || changedDirection || restartedGesture) {
      goToChapter(target);
      wheelGestureActive = true;
      wheelGestureDirection = direction;
      wheelGesturePeak = delta;
      wheelGestureDecayed = false;
      wheelLastNavigation = now;
    } else {
      wheelGesturePeak = Math.max(wheelGesturePeak, delta);
      if (delta < wheelGesturePeak * 0.35) wheelGestureDecayed = true;
    }

    wheelLastDelta = delta;
  },
  { passive: false },
);

reading.addEventListener("touchstart", (event) => {
  touchStartY = event.touches[0].clientY;
  touchStartedOnFirstChapter = activeChapter === 0;
  touchStartedOnLastChapter = activeChapter === chapters.length - 1;
}, { passive: true });

reading.addEventListener("touchend", (event) => {
  const distance = touchStartY - event.changedTouches[0].clientY;
  if (touchStartedOnLastChapter && distance > 48) closeReadingToSaved(activeChapter);
  if (touchStartedOnFirstChapter && distance < -48) closeReadingToSaved();
}, { passive: true });

savedSpread.addEventListener("wheel", (event) => {
  if (!document.body.classList.contains("saved-home") || Math.abs(event.deltaY) <= 12) return;
  const direction = Math.sign(event.deltaY);
  const returnChapter = direction < 0 ? savedReturnChapter : 0;
  if (returnChapter === null) return;
  event.preventDefault();
  if (absorbCurrentWheelGesture(direction)) return;
  openSavedReading(returnChapter, direction);
}, { passive: false });

savedSpread.addEventListener("touchstart", (event) => {
  savedTouchStartY = event.touches[0].clientY;
}, { passive: true });

savedSpread.addEventListener("touchend", (event) => {
  const distance = savedTouchStartY - event.changedTouches[0].clientY;
  if (distance > 48) openSavedReading();
  if (distance < -48 && savedReturnChapter !== null) openSavedReading(savedReturnChapter);
}, { passive: true });

readingNavItems.forEach((item) => {
  item.addEventListener("click", () => {
    goToChapter(Number(item.dataset.chapter));
  });
});

readingBoundaryButton.addEventListener("click", () => {
  if (activeChapter === chapters.length - 1) closeReadingToSaved(activeChapter);
});

readingCopy.addEventListener("scroll", () => {
  if (!document.body.classList.contains("reading-ready")) return;

  window.clearTimeout(scrollSettleTimer);
  scrollSettleTimer = window.setTimeout(() => {
    const settledChapter = Math.round(readingCopy.scrollTop / readingCopy.clientHeight);
    if (settledChapter !== activeChapter) setActiveChapter(settledChapter);
  }, 120);
});

window.addEventListener("keydown", (event) => {
  if (!document.body.classList.contains("reading-ready")) return;

  const nextKeys = ["ArrowDown", "PageDown", " "];
  const previousKeys = ["ArrowUp", "PageUp"];
  if (![...nextKeys, ...previousKeys, "Home", "End"].includes(event.key)) return;

  event.preventDefault();
  if (nextKeys.includes(event.key)) {
    if (activeChapter === chapters.length - 1) closeReadingToSaved(activeChapter);
    else goToChapter(activeChapter + 1);
  }
  if (previousKeys.includes(event.key)) {
    if (activeChapter === 0) closeReadingToSaved();
    else goToChapter(activeChapter - 1);
  }
  if (event.key === "Home") goToChapter(0);
  if (event.key === "End") goToChapter(chapters.length - 1);
});

window.addEventListener("keydown", (event) => {
  if (!document.body.classList.contains("saved-home")) return;
  if (event.target.closest?.("button")) return;
  const opensFromStart = ["ArrowDown", "PageDown", " ", "Enter"].includes(event.key);
  const returnsToChapter = ["ArrowUp", "PageUp"].includes(event.key) && savedReturnChapter !== null;
  if (!opensFromStart && !returnsToChapter) return;
  event.preventDefault();
  openSavedReading(returnsToChapter ? savedReturnChapter : 0);
});
