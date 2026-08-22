import { TAROT_CARDS } from "/assets/cards.js";
import { mountDailyDeck3D } from "./daily-3d.js?v=20260821-mobileritual21";
import { mountSpreadDeck3D } from "./spread-deck-3d.js?v=20260822-mobilefanexit2";

const deckOrderKey = "mora:prototype:spreadDeckOrder";
const availableSpreadCards = TAROT_CARDS
  .filter((card) => card.image)
  .map((card) => ({ ...card, image: `/${card.image.replace(/^\/+/, "")}` }));
let spreadDeck = restoreSpreadDeckOrder(availableSpreadCards);
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
const readSpreadButton = document.querySelector("#read-spread");
const stage = document.querySelector(".card-stage");
const reading = document.querySelector("#reading");
const readingCopy = document.querySelector(".reading-copy");
const readingBoundaryButton = document.querySelector(".reading-boundary-hint");
const readingCloseButton = document.querySelector(".reading-close");
const readingPrevButton = document.querySelector(".reading-prev");
const readingNextButton = document.querySelector(".reading-next");
const readingSummaryHomeButton = document.querySelector(".reading-summary-home");
const chapters = [...document.querySelectorAll(".chapter")];
const readingNavItems = [...document.querySelectorAll(".reading-nav button")];
const starfield = document.querySelector("#starfield");
const dailyModeButton = document.querySelector("#daily-mode-button");
const spreadModeButton = document.querySelector("#spread-mode-button");
const brand = document.querySelector(".brand");
const loginButton = document.querySelector(".login");
const mobileMenuControl = document.querySelector(".mobile-menu-control");
const mobileMenuBackdrop = document.querySelector(".mobile-menu-backdrop");
const mobileMenuTrigger = document.querySelector(".mobile-menu-trigger");
const mobileMenu = document.querySelector("#mobile-menu");
const mobileMenuDaily = document.querySelector(".mobile-menu-daily");
const mobileMenuSpread = document.querySelector(".mobile-menu-spread");
const mobileMenuLogin = document.querySelector(".mobile-menu-login");
const mobileMenuEmail = document.querySelector(".mobile-menu-email");
const mobileMenuLogout = document.querySelector(".mobile-menu-logout");
const profileControl = document.querySelector(".profile-control");
const profileTrigger = document.querySelector(".profile-trigger");
const profileMenu = document.querySelector("#profile-menu");
const profileEmail = document.querySelector(".profile-email");
const profileLogout = document.querySelector(".profile-logout");
const loginScreen = document.querySelector("#login-screen");
const loginScreenBrand = document.querySelector(".login-screen-brand");
const loginScreenHome = document.querySelector(".login-screen-home");
const loginScreenForm = document.querySelector("#login-screen-form");
const loginScreenEmail = document.querySelector("#login-screen-email");
const guestSpreadLogin = document.querySelector(".guest-spread-login");
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
const dailyResultCopy = document.querySelector(".daily-result-copy");
const dailyResultImage = document.querySelector("#daily-result-image");
const dailyCooldownButton = document.querySelector("#daily-cooldown");
const dailyResultCard = document.querySelector(".daily-result-card");
const dailyResult = document.querySelector("#daily-result");
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
let spreadFacePreloadTimer;
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
let loginDestination = "daily";
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
let prototypeTesterPreview = false;
let testerSessionResolved = false;
let accountDailyState = null;
let accountSpreadSnapshot = null;
let prototypeNextSpreadAt = 0;
let prototypeNextDailyAt = 0;
let spreadCooldownTimer;
let dailyCooldownTimer;
let volatileFailedSpread = null;
let pendingDailySelection = null;
let visibleSpreadCardIndices = [];
let dailyActivationInFlight = false;
const clientEventTrace = crypto.randomUUID?.() || String(Date.now());
const sentClientEvents = new Set();

function reportClientEvent(event, once = true) {
  if (!testerSessionResolved || !prototypeTesterAuthenticated || prototypeTesterPreview) return;
  if (once && sentClientEvents.has(event)) return;
  sentClientEvents.add(event);
  fetch("/api/prototypes/account-state", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "client-event",
      event,
      trace: clientEventTrace,
      dailyState: accountDailyState?.status || "none",
      deckReady: dailyDeck.classList.contains("is-3d-ready"),
      deckDisabled: dailyDeck.disabled,
    }),
    keepalive: true,
  }).catch(() => {});
}

dailyDeck.classList.add("is-3d-loading");
const dailyDeck3D = mountDailyDeck3D({
  canvas: dailyDeckCanvas,
  host: dailyDeck,
  onPrepare: prepareDailyCardCandidate,
  onSelect: prepareDailyCardSelection,
  onResult: showDaily3DResult,
}).catch((error) => {
  dailyDeck.classList.remove("is-3d-loading");
  console.error("Mora daily 3D deck failed to load", error);
  return null;
});
let daily3DReady = false;
dailyDeck3D.then((controller) => {
  daily3DReady = Boolean(controller);
  if (controller && testerSessionResolved) dailyDeck.disabled = Boolean(readSavedDailyCard());
  if (controller) reportClientEvent("daily-3d-ready");
});

const savedSpreadKey = "mora:prototype:lastSpread";
const savedDailyCardKey = "mora:prototype:dailyCard";
const pendingDailyCardKey = "mora:prototype:pendingDailyCard";
const isLocalPrototype = (
  ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname)
  || /^192\.168\./.test(window.location.hostname)
  || /^10\./.test(window.location.hostname)
  || /^172\.(1[6-9]|2\d|3[01])\./.test(window.location.hostname)
);
const spreadCooldownMs = 12 * 60 * 60 * 1000;
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
const prototypeTesterSessionPromise = restorePrototypeTesterSession();
restoreSavedSpread();
const urlParams = new URLSearchParams(window.location.search);
const resetDailyMode = urlParams.get("resetDaily");
if (isLocalPrototype && (resetDailyMode === "1" || resetDailyMode === "always")) {
  window.localStorage.removeItem(savedDailyCardKey);
  window.localStorage.removeItem(pendingDailyCardKey);
  if (resetDailyMode === "1") {
    urlParams.delete("resetDaily");
    window.history.replaceState(null, "", `${window.location.pathname}?${urlParams}`.replace(/\?$/, ""));
  }
}
const startInSpreadMode = urlParams.get("mode") === "spread";
const startInLogin = urlParams.get("login") === "1";

dailyModeButton.addEventListener("click", () => switchMode("daily"));
brand.addEventListener("click", (event) => {
  event.preventDefault();
  if (!document.body.classList.contains("daily-mode")) switchMode("daily");
});
spreadModeButton.addEventListener("click", () => switchMode("spread"));
loginButton.addEventListener("click", () => openLoginScreen("daily"));
mobileMenuTrigger.addEventListener("click", () => {
  const open = mobileMenuTrigger.getAttribute("aria-expanded") !== "true";
  mobileMenuTrigger.setAttribute("aria-expanded", String(open));
  mobileMenu.setAttribute("aria-hidden", String(!open));
  mobileMenuBackdrop.setAttribute("aria-hidden", String(!open));
});
mobileMenuBackdrop.addEventListener("click", closeMobileMenu);
mobileMenuDaily.addEventListener("click", () => {
  closeMobileMenu();
  if (document.body.classList.contains("login-screen-open")) closeLoginScreen();
  switchMode("daily");
});
mobileMenuSpread.addEventListener("click", () => {
  closeMobileMenu();
  if (document.body.classList.contains("login-screen-open")) closeLoginScreen();
  switchMode("spread");
});
mobileMenuLogin.addEventListener("click", () => {
  closeMobileMenu();
  openLoginScreen(document.body.classList.contains("guest-spread-mode") ? "spread" : "daily");
});
mobileMenuLogout.addEventListener("click", logoutPrototypeTester);
guestSpreadLogin.addEventListener("click", () => openLoginScreen("spread"));
profileTrigger.addEventListener("click", () => {
  const open = profileTrigger.getAttribute("aria-expanded") !== "true";
  profileTrigger.setAttribute("aria-expanded", String(open));
  profileMenu.setAttribute("aria-hidden", String(!open));
});
profileLogout.addEventListener("click", logoutPrototypeTester);
document.addEventListener("click", (event) => {
  if (!profileControl.contains(event.target)) closeProfileMenu();
  if (!mobileMenuControl.contains(event.target)) closeMobileMenu();
});
loginScreenBrand.addEventListener("click", (event) => {
  event.preventDefault();
  closeLoginScreen();
});
loginScreenHome.addEventListener("click", closeLoginScreen);
loginScreenForm.addEventListener("submit", (event) => handleTesterLogin(event, loginDestination));
dailyDeck.addEventListener("click", handleDailyDeckClick);
dailyDeck.addEventListener("pointerdown", () => reportClientEvent("daily-deck-pointer"));

async function restorePrototypeTesterSession() {
  const params = new URLSearchParams(window.location.search);
  const guestPreview = isLocalPrototype && params.get("guestPreview") === "1";
  if (guestPreview) {
    setPrototypeTesterAuthenticated(false);
    testerSessionResolved = true;
    document.documentElement.classList.remove("tester-session-pending");
    return;
  }

  const localPreview = isLocalPrototype && params.get("testerPreview") === "1";
  if (localPreview) {
    prototypeTesterPreview = true;
    setPrototypeTesterAuthenticated(true, true, null, "moratest@bk.ru");
    testerSessionResolved = true;
    document.documentElement.classList.remove("tester-session-pending");
    return;
  }

  const guestDailyCard = readGuestDailyCardForAdoption();
  try {
    const response = await fetch("/api/prototypes/account-state", { cache: "no-store" });
    if (response.status === 401) {
      setPrototypeTesterAuthenticated(false);
      return;
    }
    if (!response.ok) throw new Error("Unable to load account state");
    const payload = await response.json();
    setPrototypeTesterAuthenticated(true, payload.isAdmin === true, payload.nextSpreadAt, payload.email);
    let clearGuestDaily = true;
    if (payload.daily?.status !== "drawn" && guestDailyCard) {
      const adoptionResponse = await fetch("/api/prototypes/account-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "adopt-guest-daily",
          cardId: guestDailyCard.cardId,
          variantIndex: guestDailyCard.variantIndex,
        }),
      });
      if (adoptionResponse.ok) {
        const adoption = await adoptionResponse.json();
        payload.daily = adoption.daily;
      } else {
        clearGuestDaily = false;
      }
    }
    restorePrototypeAccountState(payload, clearGuestDaily);
  } catch {
    // The public daily-card flow remains available when session lookup fails.
  } finally {
    testerSessionResolved = true;
    reportClientEvent("daily-state-resolved");
    if (daily3DReady) reportClientEvent("daily-3d-ready");
    document.documentElement.classList.remove("tester-session-pending");
    if (document.body.classList.contains("daily-mode")) showDailyMode();
    else if (prototypeTesterAuthenticated) restoreSavedSpread();
  }
}

function readGuestDailyCardForAdoption() {
  try {
    const snapshot = JSON.parse(window.localStorage.getItem(savedDailyCardKey) || "null");
    const drawnAt = Date.parse(snapshot?.drawnAt || "");
    const card = TAROT_CARDS.find((item) => item.id === snapshot?.cardId);
    const variantIndex = Number(snapshot?.variantIndex);
    if (!card?.result?.dayVariants?.[variantIndex]) return null;
    if (!Number.isFinite(drawnAt) || drawnAt + spreadCooldownMs <= Date.now()) return null;
    return { cardId: card.id, variantIndex };
  } catch {
    return null;
  }
}

function restorePrototypeAccountState(payload, clearGuestDaily = true) {
  accountDailyState = payload.daily || null;
  accountSpreadSnapshot = payload.spread || null;
  prototypeNextDailyAt = Date.parse(payload.daily?.nextDailyAt || "") || 0;
  prototypeNextSpreadAt = Date.parse(payload.nextSpreadAt || "") || 0;
  try {
    if (clearGuestDaily) {
      window.localStorage.removeItem(savedDailyCardKey);
      window.localStorage.removeItem(pendingDailyCardKey);
    }
    window.localStorage.removeItem(savedSpreadKey);
  } catch {
    // Server state remains authoritative when browser storage is unavailable.
  }
}

async function handleTesterLogin(event, destination) {
  event.preventDefault();
  const form = event.currentTarget;
  const emailInput = loginScreenEmail;
  if (!emailInput.reportValidity()) return;

  const pendingEmail = form.dataset.pendingEmail || "";
  const pendingMethod = form.dataset.pendingMethod || "";
  const isVerificationStep = Boolean(pendingEmail);
  const requestBody = isVerificationStep
    ? pendingMethod === "password"
      ? { email: pendingEmail, password: emailInput.value }
      : { email: pendingEmail, otp: emailInput.value }
    : { email: emailInput.value };

  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = isVerificationStep ? "Проверяем…" : "Входим…";

  try {
    const response = await fetch("/api/prototypes/tester-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Tester session failed");
    if (payload.requiresPassword) {
      form.dataset.pendingEmail = emailInput.value.trim().toLowerCase();
      form.dataset.pendingMethod = "password";
      emailInput.value = "";
      emailInput.type = "password";
      emailInput.inputMode = "text";
      emailInput.removeAttribute("pattern");
      emailInput.placeholder = "Пароль";
      emailInput.setAttribute("aria-label", "Пароль");
      submitButton.textContent = "Войти";
      emailInput.focus();
      return;
    }
    if (payload.requiresOtp) {
      form.dataset.pendingEmail = emailInput.value.trim().toLowerCase();
      form.dataset.pendingMethod = "otp";
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
    const destinationUrl = destination === "spread"
      ? `${window.location.pathname}?mode=spread`
      : window.location.pathname;
    window.location.replace(destinationUrl);
    return;
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
  delete form.dataset.pendingMethod;
  input.value = "";
  input.type = "email";
  input.inputMode = "email";
  input.removeAttribute("pattern");
  input.placeholder = "Электронная почта";
  input.setAttribute("aria-label", "Электронная почта");
}

function setPrototypeTesterAuthenticated(authenticated, isAdmin = false, nextSpreadAt = null, email = "") {
  prototypeTesterAuthenticated = authenticated;
  prototypeTesterIsAdmin = authenticated && isAdmin;
  prototypeNextSpreadAt = authenticated && !isAdmin ? Date.parse(nextSpreadAt || "") || 0 : 0;
  profileEmail.textContent = authenticated ? email : "";
  mobileMenuEmail.textContent = authenticated ? email : "";
  document.body.classList.toggle("prototype-tester", authenticated);
  document.body.classList.toggle(
    "guest-spread-mode",
    !authenticated && !document.body.classList.contains("daily-mode"),
  );
  updateNewSpreadButton();
  if (!authenticated) closeProfileMenu();
}

function closeProfileMenu() {
  profileTrigger.setAttribute("aria-expanded", "false");
  profileMenu.setAttribute("aria-hidden", "true");
}

function closeMobileMenu() {
  mobileMenuTrigger.setAttribute("aria-expanded", "false");
  mobileMenu.setAttribute("aria-hidden", "true");
  mobileMenuBackdrop.setAttribute("aria-hidden", "true");
}

async function logoutPrototypeTester() {
  profileLogout.disabled = true;
  try {
    await fetch("/api/prototypes/tester-session", { method: "DELETE" });
  } finally {
    setPrototypeTesterAuthenticated(false);
    testerSessionResolved = true;
    accountDailyState = null;
    accountSpreadSnapshot = null;
    prototypeNextDailyAt = 0;
    try {
      window.localStorage.removeItem(savedDailyCardKey);
      window.localStorage.removeItem(pendingDailyCardKey);
      window.localStorage.removeItem(savedSpreadKey);
    } catch {
      // Account data was never written to browser storage.
    }
    window.location.replace(window.location.pathname);
    profileLogout.disabled = false;
  }
}

function openLoginScreen(destination = "daily") {
  loginDestination = destination;
  loginScreen.setAttribute("aria-hidden", "false");
  document.body.classList.add("login-screen-open");
  window.setTimeout(() => loginScreenEmail.focus(), 220);
}

function closeLoginScreen() {
  loginScreen.setAttribute("aria-hidden", "true");
  document.body.classList.remove("login-screen-open");
  (loginDestination === "spread" ? guestSpreadLogin : loginButton).focus();
  loginDestination = "daily";
}

async function handleDailyDeckClick(event) {
  reportClientEvent("daily-deck-click");
  if (dailyActivationInFlight || !dailyDeck.classList.contains("is-3d-ready")) return;
  dailyActivationInFlight = true;
  try {
    const [controller] = await Promise.all([dailyDeck3D, prototypeTesterSessionPromise]);
    if (!controller || (readSavedDailyCard() && !controller.isResultActive())) return;
    const keyboard = event.detail === 0;
    if (!keyboard && !controller.hitTest(event.clientX, event.clientY)) return;
    controller.activate({ keyboard });
  } finally {
    dailyActivationInFlight = false;
  }
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
  stateTransitionInFlight = false;
  document.body.classList.remove(
    "saved-home",
    "reading-ready",
    "reading-transition",
    "reading-entering",
    "saved-to-reading",
    "saved-reading-entering",
    "reading-to-saved",
    "reading-saved-entering",
    "daily-result-ready",
    "daily-result-entering",
    "daily-3d-result",
    "daily-3d-result-entering",
    "daily-3d-error",
    "daily-3d-ritual",
    "daily-3d-animating",
  );
  document.body.classList.remove("guest-spread-mode");
  document.body.classList.add("daily-mode");
  dailyModeButton.classList.add("active");
  spreadModeButton.classList.remove("active");

  const savedDailyCard = readSavedDailyCard();
  dailyDeck.disabled = Boolean(savedDailyCard);
  daily3DResultActive = Boolean(savedDailyCard && daily3DResultActive);
  if (savedDailyCard) {
    populateDailyResult(savedDailyCard.card, savedDailyCard.variantIndex);
    document.documentElement.classList.remove("daily-saved-pending");
    document.body.classList.add("daily-result-ready");
    scheduleDailyResultScrollUpdate();
    if (daily3DResultActive) {
      dailyDeck.disabled = false;
      document.body.classList.add("daily-3d-result");
    } else if (!daily3DRestoreInFlight) {
      daily3DRestoreInFlight = true;
      document.body.classList.add("daily-3d-restoring");
      reportClientEvent("daily-restore-started", false);
      dailyDeck3D.then(async (controller) => {
        if (!controller) {
          showDaily3DError();
          reportClientEvent("daily-restore-failed", false);
          return;
        }
        await controller.restoreResult({
          ...savedDailyCard,
          imageUrl: `/${savedDailyCard.card.image.replace(/^\/+/, "")}`,
        });
        showDaily3DResult();
        reportClientEvent("daily-restore-completed", false);
      }).catch((error) => {
        console.error("Mora daily 3D result failed to restore", error);
        showDaily3DError();
        reportClientEvent("daily-restore-failed", false);
      }).finally(() => {
        daily3DRestoreInFlight = false;
      });
    }
  } else {
    document.documentElement.classList.remove("daily-saved-pending");
    daily3DResultActive = false;
    dailyDeck3D.then((controller) => {
      controller?.resetResultToIdle();
    });
  }
}

function showSpreadMode() {
  if (prototypeTesterAuthenticated) ensureSpreadDeck3D();
  dailyDeck3D.then((controller) => controller?.setActive(false));
  resetDailyResultTilt();
  document.body.classList.remove(
    "daily-mode",
    "daily-result-ready",
    "daily-result-entering",
    "daily-3d-result",
    "daily-3d-result-entering",
    "daily-3d-error",
    "daily-3d-ritual",
    "daily-3d-animating",
  );
  document.body.classList.toggle("guest-spread-mode", !prototypeTesterAuthenticated);
  dailyModeButton.classList.remove("active");
  spreadModeButton.classList.add("active");

  if (readLastSpread()) {
    restoreSavedSpread();
  }
}

function showDaily3DError() {
  document.body.classList.remove("daily-3d-restoring");
  document.body.classList.add("daily-3d-error");
}

function updateDailyResultScrollState() {
  const scroller = window.matchMedia("(max-width: 720px)").matches ? dailyResult : dailyResultCopy;
  const maxScrollTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
  const isScrollable = maxScrollTop > 2;
  [dailyResult, dailyResultCopy].forEach((element) => {
    element.classList.toggle("can-scroll-up", element === scroller && isScrollable && scroller.scrollTop > 2);
    element.classList.toggle(
      "can-scroll-down",
      element === scroller && isScrollable && scroller.scrollTop < maxScrollTop - 2,
    );
  });
}

function scheduleDailyResultScrollUpdate() {
  window.requestAnimationFrame(updateDailyResultScrollState);
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
  dailyResultTitleMain.textContent = title;
  dailyResultTitleMain.classList.toggle("has-title-meta", Boolean(titleMeta));
  dailyResultTitleMeta.textContent = titleMeta;
  populateCardTag(dailyResultSuit, dailyResultSuitLabel, dailyResultSuitIcon, card);
  dailyResultText.replaceChildren();
  dailyResultCopy.scrollTop = 0;
  dailyResult.scrollTop = 0;
  paragraphs.forEach((paragraph) => {
    const item = document.createElement("p");
    item.textContent = paragraph;
    dailyResultText.append(item);
  });
  dailyResultImage.src = `/${card.image.replace(/^\/+/, "")}`;
  dailyResultImage.alt = card.name;
  scheduleDailyResultScrollUpdate();
}

function populateCardTag(container, label, icon, card) {
  const tags = card.result.tags || [];
  const suit = tags.find((tag) => suitTags[tag]);
  const isMajorArcana = tags.includes("Старший аркан");
  const tagIcon = isMajorArcana ? `./icons/arcana-${card.num}.svg` : suitTags[suit];

  label.textContent = isMajorArcana ? "Старший аркан" : suit || tags[0] || "Таро";
  icon.hidden = !tagIcon;
  container.classList.toggle("without-icon", !tagIcon);
  if (tagIcon) icon.style.setProperty("--daily-result-tag-icon", `url("${tagIcon}")`);
}

function getLocalDayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function readSavedDailyCard() {
  try {
    if (!testerSessionResolved) return null;
    const snapshot = prototypeTesterAuthenticated
      ? accountDailyState?.status === "drawn" ? accountDailyState : null
      : JSON.parse(window.localStorage.getItem(savedDailyCardKey) || "null");
    if (!snapshot) return null;
    if (prototypeTesterAuthenticated) {
      if (prototypeNextDailyAt && prototypeNextDailyAt <= Date.now()) return null;
      const card = TAROT_CARDS.find((item) => item.id === snapshot.cardId);
      const variantIndex = Number(snapshot.variantIndex);
      return card?.result?.dayVariants?.[variantIndex] ? { card, variantIndex } : null;
    }
    const drawnAt = Date.parse(snapshot?.drawnAt || "");
    if (Number.isFinite(drawnAt) && drawnAt + spreadCooldownMs <= Date.now()) {
      window.localStorage.removeItem(savedDailyCardKey);
      return null;
    }
    const dayKey = getLocalDayKey();
    if (!Number.isFinite(drawnAt) && snapshot?.dayKey && snapshot.dayKey !== dayKey) {
      window.localStorage.removeItem(savedDailyCardKey);
      return null;
    }
    const card = TAROT_CARDS.find((item) => item.id === snapshot?.cardId);
    const variantIndex = Number(snapshot?.variantIndex);
    if (!card?.result?.dayVariants?.[variantIndex]) return null;
    if (!Number.isFinite(drawnAt)) {
      window.localStorage.setItem(
        savedDailyCardKey,
        JSON.stringify({ ...snapshot, version: 3, drawnAt: new Date().toISOString() }),
      );
    }
    return { card, variantIndex };
  } catch {
    return null;
  }
}

function readPendingDailyCard() {
  try {
    if (prototypeTesterAuthenticated) {
      const snapshot = accountDailyState?.status === "pending" ? accountDailyState : null;
      if (!snapshot) return null;
      const card = TAROT_CARDS.find((item) => item.id === snapshot.cardId);
      const variantIndex = Number(snapshot.variantIndex);
      if (!card?.result?.dayVariants?.[variantIndex]) return null;
      return { card, variantIndex, imageUrl: `/${card.image.replace(/^\/+/, "")}` };
    }
    const snapshot = JSON.parse(window.localStorage.getItem(pendingDailyCardKey) || "null");
    if (snapshot?.dayKey !== getLocalDayKey()) {
      window.localStorage.removeItem(pendingDailyCardKey);
      return null;
    }
    const card = TAROT_CARDS.find((item) => item.id === snapshot?.cardId);
    const variantIndex = Number(snapshot?.variantIndex);
    if (!card?.result?.dayVariants?.[variantIndex]) return null;
    return {
      card,
      variantIndex,
      imageUrl: `/${card.image.replace(/^\/+/, "")}`,
    };
  } catch {
    return null;
  }
}

function prepareDailyCardCandidate() {
  if (!testerSessionResolved) return;
  if (pendingDailySelection) return pendingDailySelection;
  if (dailyDrawInFlight) return;
  const savedDailyCard = readSavedDailyCard();
  if (savedDailyCard) {
    return {
      ...savedDailyCard,
      imageUrl: `/${savedDailyCard.card.image.replace(/^\/+/, "")}`,
    };
  }
  const storedCandidate = readPendingDailyCard();
  if (storedCandidate) {
    pendingDailySelection = storedCandidate;
    return pendingDailySelection;
  }
  if (prototypeTesterAuthenticated && !prototypeTesterPreview) return;
  const card = getDailyCard();
  if (!card) return;
  const variantIndex = Math.floor(Math.random() * card.result.dayVariants.length);
  pendingDailySelection = {
    card,
    variantIndex,
    imageUrl: `/${card.image.replace(/^\/+/, "")}`,
  };
  try {
    window.localStorage.setItem(
      pendingDailyCardKey,
      JSON.stringify({
        version: 1,
        dayKey: getLocalDayKey(),
        cardId: card.id,
        variantIndex,
      }),
    );
  } catch {
    // The prepared card remains stable for the current page when storage is unavailable.
  }
  return pendingDailySelection;
}

function prepareDailyCardSelection() {
  const selection = pendingDailySelection || prepareDailyCardCandidate();
  if (!selection || dailyDrawInFlight) return;
  const { card, variantIndex } = selection;
  dailyDrawInFlight = true;
  dailyDeck.disabled = true;
  populateDailyResult(card, variantIndex);
  if (prototypeTesterAuthenticated) {
    const completedAt = new Date().toISOString();
    prototypeNextDailyAt = Date.now() + spreadCooldownMs;
    accountDailyState = {
      status: "drawn",
      cardId: card.id,
      variantIndex,
      drawnAt: completedAt,
      nextDailyAt: new Date(prototypeNextDailyAt).toISOString(),
    };
    if (!prototypeTesterPreview) {
      fetch("/api/prototypes/account-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete-daily" }),
        keepalive: true,
      }).then(async (response) => {
        if (!response.ok) throw new Error("Unable to save daily card");
        const payload = await response.json();
        accountDailyState = payload.daily;
        prototypeNextDailyAt = Date.parse(payload.daily?.nextDailyAt || "") || prototypeNextDailyAt;
      }).catch((error) => console.error("Mora daily account save failed", error));
    }
  } else {
    try {
      window.localStorage.setItem(
        savedDailyCardKey,
        JSON.stringify({
          version: 3,
          cardId: card.id,
          variantIndex,
          drawnAt: new Date().toISOString(),
        }),
      );
      window.localStorage.removeItem(pendingDailyCardKey);
    } catch {
      // Guest daily state remains available in memory when storage is unavailable.
    }
  }

  pendingDailySelection = null;
  return selection;
}

function showDaily3DResult() {
  const restoring = document.body.classList.contains("daily-3d-restoring");
  daily3DResultActive = true;
  dailyDeck.disabled = false;
  document.documentElement.classList.remove("daily-saved-pending");
  document.body.classList.remove("daily-3d-ritual", "daily-3d-animating", "daily-3d-restoring", "daily-3d-error");
  document.body.classList.add("daily-3d-result");
  scheduleDailyResultScrollUpdate();
  updateDailyCooldownButton();
  if (!restoring) document.body.classList.add("daily-3d-result-entering");
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
  scheduleDailyResultScrollUpdate();

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
const spreadDeckSpacing = () => (window.innerWidth <= 720 ? 70 : 98);
const spreadDeckCurve = () => (window.innerWidth <= 720 ? 1.38 : 2);

for (let index = 0; index < deckCardCount; index += 1) {
  const tarotCard = spreadDeck[index];
  const card = document.createElement("button");
  card.type = "button";
  card.className = "deck-card";
  card.dataset.cardId = tarotCard.id;
  card.setAttribute("aria-label", `Выбрать карту ${index + 1}`);
  card.addEventListener("click", pickCard);
  card.addEventListener("pointerdown", (event) => {
    const currentCard = spreadDeck.find((item) => item.id === card.dataset.cardId);
    if (currentCard) spreadDeck3DController?.preloadFace(currentCard.image);
    startCardDrag(event);
  });
  card.addEventListener("pointerenter", () => {
    const currentCard = spreadDeck.find((item) => item.id === card.dataset.cardId);
    if (currentCard) spreadDeck3DController?.preloadFace(currentCard.image);
    if (window.innerWidth > 720) spreadDeck3DController?.setHovered(index);
  });
  card.addEventListener("pointerleave", () => spreadDeck3DController?.setHovered(null));
  card.addEventListener("focus", () => {
    if (window.innerWidth > 720) spreadDeck3DController?.setHovered(index);
  });
  card.addEventListener("blur", () => spreadDeck3DController?.setHovered(null));
  deck.append(card);
  deckCards.push(card);
}

startInSpreadMode ? showSpreadMode() : showDailyMode();
if (startInSpreadMode) window.history.replaceState(null, "", window.location.pathname);
if (startInLogin) {
  prototypeTesterSessionPromise.then(() => {
    if (!prototypeTesterAuthenticated) openLoginScreen("daily");
    window.history.replaceState(null, "", window.location.pathname);
  });
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
      scheduleVisibleSpreadFaces();
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
  const spacing = spreadDeckSpacing();
  const visibleCardIndices = [];
  const visibleLimit = window.innerWidth / 2 + 320;
  deckCards.forEach((card, index) => {
    const offset = index - (deckCardCount - 1) / 2 + deckScroll / spacing;
    card.style.top = `${offset ** 2 * spreadDeckCurve()}px`;
    card.style.transform = `translateX(calc(-50% + ${offset * spacing}px)) rotate(${offset * 1.88}deg)`;
    card.style.zIndex = String(index);
    if (Math.abs(offset * spacing) <= visibleLimit) visibleCardIndices.push(index);
  });
  visibleCardIndices.sort((left, right) => (
    Math.abs(left - (deckCardCount - 1) / 2 + deckScroll / spacing)
    - Math.abs(right - (deckCardCount - 1) / 2 + deckScroll / spacing)
  ));
  visibleSpreadCardIndices = visibleCardIndices;
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
  const spacing = spreadDeckSpacing();
  const target = -Math.min(((deckCardCount - visibleDeckCards) * spacing) / 2, 5 * spacing);
  const duration = 1050;

  function moveDeck(now) {
    const progress = Math.min(1, (now - startedAt) / duration);
    deckScroll = target * (1 - (1 - progress) ** 3);
    renderDeck();
    if (progress < 1) {
      deckDiscoveryFrame = window.requestAnimationFrame(moveDeck);
    } else {
      deck.classList.remove("is-discovering");
      scheduleVisibleSpreadFaces();
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
    const limit = ((deckCardCount - visibleDeckCards) * spreadDeckSpacing()) / 2;
    deckScroll = Math.max(-limit, Math.min(limit, deckScroll - delta));
    renderDeck();
    scheduleVisibleSpreadFaces();
  },
  { passive: false },
);

let mobileFanSwipe = null;
let suppressMobileFanClick = false;
let mobileFanInertiaFrame;

deck.addEventListener("pointerdown", (event) => {
  if (window.innerWidth > 720 || ritual.dataset.step !== "choose" || event.button !== 0) return;
  stopDeckDiscoveryMotion();
  stopMobileFanInertia();
  spreadDeck3DController?.setHovered(null);
  mobileFanSwipe = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    startScroll: deckScroll,
    moved: false,
    horizontal: false,
    lastX: event.clientX,
    lastTime: performance.now(),
    velocity: 0,
  };
  event.stopPropagation();
  window.addEventListener("pointermove", moveMobileFan);
  window.addEventListener("pointerup", endMobileFanSwipe);
  window.addEventListener("pointercancel", endMobileFanSwipe);
}, true);

deck.addEventListener("click", (event) => {
  if (!suppressMobileFanClick) return;
  suppressMobileFanClick = false;
  event.preventDefault();
  event.stopImmediatePropagation();
}, true);

function moveMobileFan(event) {
  if (!mobileFanSwipe || event.pointerId !== mobileFanSwipe.pointerId) return;
  const deltaX = event.clientX - mobileFanSwipe.startX;
  const deltaY = event.clientY - mobileFanSwipe.startY;
  if (Math.hypot(deltaX, deltaY) > 6) mobileFanSwipe.moved = true;
  if (!mobileFanSwipe.moved || Math.abs(deltaX) < Math.abs(deltaY)) return;
  event.preventDefault();
  mobileFanSwipe.horizontal = true;
  const now = performance.now();
  const elapsed = Math.max(1, now - mobileFanSwipe.lastTime);
  const instantVelocity = (event.clientX - mobileFanSwipe.lastX) / elapsed;
  mobileFanSwipe.velocity = mobileFanSwipe.velocity * 0.55 + instantVelocity * 0.45;
  mobileFanSwipe.lastX = event.clientX;
  mobileFanSwipe.lastTime = now;
  const limit = ((deckCardCount - visibleDeckCards) * spreadDeckSpacing()) / 2;
  deckScroll = Math.max(-limit, Math.min(limit, mobileFanSwipe.startScroll + deltaX));
  renderDeck();
}

function endMobileFanSwipe(event) {
  if (!mobileFanSwipe || event.pointerId !== mobileFanSwipe.pointerId) return;
  const { moved, horizontal, velocity } = mobileFanSwipe;
  suppressMobileFanClick = moved;
  mobileFanSwipe = null;
  window.removeEventListener("pointermove", moveMobileFan);
  window.removeEventListener("pointerup", endMobileFanSwipe);
  window.removeEventListener("pointercancel", endMobileFanSwipe);
  if (horizontal && event.type !== "pointercancel") startMobileFanInertia(velocity);
  else scheduleVisibleSpreadFaces();
}

function stopMobileFanInertia() {
  window.cancelAnimationFrame(mobileFanInertiaFrame);
  mobileFanInertiaFrame = undefined;
}

function startMobileFanInertia(initialVelocity) {
  stopMobileFanInertia();
  if (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
    || Math.abs(initialVelocity) < 0.04
  ) {
    scheduleVisibleSpreadFaces();
    return;
  }

  let velocity = Math.max(-2.4, Math.min(2.4, initialVelocity));
  let previousTime = performance.now();
  const limit = ((deckCardCount - visibleDeckCards) * spreadDeckSpacing()) / 2;

  function coast(now) {
    const elapsed = Math.min(32, now - previousTime);
    previousTime = now;
    const nextScroll = Math.max(-limit, Math.min(limit, deckScroll + velocity * elapsed));
    const reachedEdge = nextScroll === deckScroll;
    deckScroll = nextScroll;
    velocity *= 0.95 ** (elapsed / 16.67);
    renderDeck();
    if (!reachedEdge && Math.abs(velocity) >= 0.015) {
      mobileFanInertiaFrame = window.requestAnimationFrame(coast);
      return;
    }
    mobileFanInertiaFrame = undefined;
    scheduleVisibleSpreadFaces();
  }

  mobileFanInertiaFrame = window.requestAnimationFrame(coast);
}

topics.forEach((topic) => {
  topic.addEventListener("click", () => {
    currentTopic = topic.dataset.topic;
    selectedTopic.innerHTML = topic.innerHTML;
    ritual.dataset.step = "choose";
    showDeckHint();
    playDeckDiscoveryMotion();
    preloadVisibleSpreadFaces();
  });
});

async function preloadVisibleSpreadFaces() {
  const paths = visibleSpreadCardIndices
    .slice(0, 10)
    .map((index) => spreadDeck[index]?.image)
    .filter(Boolean);
  for (let index = 0; index < paths.length; index += 2) {
    await Promise.allSettled(paths.slice(index, index + 2).map((path) => (
      spreadDeck3DController?.preloadFace(path)
    )));
  }
}

function scheduleVisibleSpreadFaces() {
  window.clearTimeout(spreadFacePreloadTimer);
  spreadFacePreloadTimer = window.setTimeout(preloadVisibleSpreadFaces, 80);
}

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
    if (window.innerWidth <= 720 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      window.setTimeout(beginReadingGeneration, 120);
      return;
    }
    beginReadingGeneration();
  }
}

function beginReadingGeneration() {
  if (picked !== spreadSize) return;
  const animateMobileLoading = (
    window.innerWidth <= 720
    && !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  ritual.dataset.step = "loading";
  spreadDeck3DController?.hideFan(animateMobileLoading ? 560 : 0);
  spreadDeck3DController?.syncResults(animateMobileLoading ? 650 : 800);
  generateReading();
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
  name.textContent = window.innerWidth <= 720 ? compactMobileCardName(text) : text;
  if (!name.isConnected) slot.append(name);
  window.requestAnimationFrame(() => name.classList.add("is-visible"));
}

function compactMobileCardName(text) {
  const ranks = {
    "Двойка": "2-ка",
    "Тройка": "3-ка",
    "Четвёрка": "4-ка",
    "Пятёрка": "5-ка",
    "Шестёрка": "6-ка",
    "Семёрка": "7-ка",
    "Восьмёрка": "8-ка",
    "Девятка": "9-ка",
    "Десятка": "10-ка",
  };
  return text.replace(/^(\S+)(.*)$/, (_, rank, rest) => (
    `${ranks[rank] || rank}${rest.toLowerCase()}`
  ));
}

function saveLastSpread(reading, source, persistedSnapshot = null) {
  const snapshot = persistedSnapshot || {
    version: 2,
    topic: currentTopic,
    cardIds: selectedCards.map((card) => card.id),
    reading,
    source,
    createdAt: new Date().toISOString(),
  };

  if (prototypeTesterAuthenticated) {
    accountSpreadSnapshot = snapshot;
  } else try {
    window.localStorage.setItem(savedSpreadKey, JSON.stringify(snapshot));
  } catch {
    // The prototype still completes when localStorage is unavailable.
  }
  volatileFailedSpread = null;
}

function readLastSpread() {
  try {
    if (!testerSessionResolved) return null;
    const value = prototypeTesterAuthenticated ? null : window.localStorage.getItem(savedSpreadKey);
    const snapshot = prototypeTesterAuthenticated
      ? accountSpreadSnapshot || volatileFailedSpread
      : value ? JSON.parse(value) : volatileFailedSpread;
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
  populateReading(snapshot.reading, snapshot.cards);
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
    caption.textContent = window.innerWidth <= 720 ? compactMobileCardName(card.name) : card.name;
    caption.title = card.name;
    cardShell.append(image);
    figure.append(cardShell, caption);
    savedCards.append(figure);
  });
  updateNewSpreadButton(snapshot);
}

function formatCooldown(remaining) {
  const totalSeconds = Math.max(0, Math.ceil(remaining / 1000));
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function updateDailyCooldownButton() {
  window.clearInterval(dailyCooldownTimer);
  let cooldownEndsAt = prototypeNextDailyAt;

  if (!cooldownEndsAt && !prototypeTesterAuthenticated) {
    try {
      const snapshot = JSON.parse(window.localStorage.getItem(savedDailyCardKey) || "null");
      const drawnAt = Date.parse(snapshot?.drawnAt || "");
      cooldownEndsAt = Number.isFinite(drawnAt) ? drawnAt + spreadCooldownMs : 0;
    } catch {
      cooldownEndsAt = 0;
    }
  }

  const render = () => {
    const remaining = cooldownEndsAt - Date.now();
    dailyCooldownButton.textContent = `Новая карта через ${formatCooldown(remaining)}`;
    if (remaining <= 0) {
      window.clearInterval(dailyCooldownTimer);
      dailyCooldownTimer = undefined;
      if (document.body.classList.contains("daily-mode")) showDailyMode();
    }
  };

  render();
  if (cooldownEndsAt > Date.now()) dailyCooldownTimer = window.setInterval(render, 1000);
}

function refreshDailyStateAfterBackground() {
  if (
    document.visibilityState !== "visible"
    || !testerSessionResolved
    || !document.body.classList.contains("daily-mode")
  ) return;
  if (readSavedDailyCard()) updateDailyCooldownButton();
  else showDailyMode();
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

    newSpreadButton.textContent = `Новый расклад через ${formatCooldown(remaining)}`;
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
  if (stateTransitionInFlight || document.body.classList.contains("daily-mode")) return;
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
    window.requestAnimationFrame(() => {
      if (!document.body.classList.contains("daily-mode")) {
        document.body.classList.add("saved-reading-entering");
      }
    });
  });

  window.setTimeout(() => {
    if (document.body.classList.contains("daily-mode")) return;
    document.body.classList.remove("saved-home", "saved-to-reading", "saved-reading-entering");
    document.body.classList.add("reading-ready");
    resetReadingScroll(targetChapter);
    stateTransitionInFlight = false;
  }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : 700);
}

readSpreadButton.addEventListener("click", () => openSavedReading());

function closeReadingToSaved(returnChapter = null, wheelDirection = 0) {
  if (stateTransitionInFlight || document.body.classList.contains("daily-mode")) return;
  const snapshot = readLastSpread();
  if (!snapshot) return;

  savedReturnChapter = returnChapter;
  stateTransitionInFlight = true;
  blockUntilNewWheelGesture(wheelDirection);
  renderSavedSpread(snapshot);
  document.body.classList.add("reading-to-saved");

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      if (!document.body.classList.contains("daily-mode")) {
        document.body.classList.add("reading-saved-entering");
      }
    });
  });

  window.setTimeout(() => {
    if (document.body.classList.contains("daily-mode")) return;
    document.body.classList.remove("reading-ready", "reading-to-saved", "reading-saved-entering");
    document.body.classList.add("saved-home");
    stateTransitionInFlight = false;
  }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : 700);
}

newSpreadButton.addEventListener("click", () => {
  if (newSpreadButton.disabled) return;
  const previousSnapshot = accountSpreadSnapshot;
  let clearAccountSpread;
  if (prototypeTesterAuthenticated && !prototypeTesterIsAdmin) {
    accountSpreadSnapshot = null;
    clearAccountSpread = fetch("/api/prototypes/account-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clear-account-spread" }),
    }).then((response) => response.ok).catch(() => false);
  } else if (prototypeTesterAuthenticated) accountSpreadSnapshot = null;
  const nextDeck = createNextDeckOrder(spreadDeck, spreadDeck.map((card) => card.id));
  spreadDeck = nextDeck;
  saveSpreadDeckOrder(nextDeck);
  window.localStorage.removeItem(savedSpreadKey);
  volatileFailedSpread = null;
  selectedCards.length = 0;
  picked = 0;
  currentTopic = "";
  selectionInFlight = false;
  stateTransitionInFlight = false;
  ritual.dataset.step = "topic";
  selectedTopic.replaceChildren();
  slots.forEach((slot, index) => {
    slot.replaceChildren();
    slot.className = "slot";
    slot.setAttribute("aria-label", ["Первая карта", "Вторая карта", "Третья карта"][index]);
  });
  deckCards.forEach((card, index) => {
    card.dataset.cardId = spreadDeck[index].id;
    card.setAttribute("aria-label", `Выбрать карту ${index + 1}`);
    card.disabled = false;
    card.style.removeProperty("opacity");
    card.style.removeProperty("pointer-events");
    delete card.dataset.suppressClick;
  });
  spreadDeck3DController?.reset();
  deckHint.classList.add("is-hidden");
  document.body.classList.remove(
    "saved-home",
    "reading-ready",
    "reading-transition",
    "reading-entering",
    "reading-to-saved",
    "reading-saved-entering",
  );
  document.body.classList.remove("daily-mode");
  dailyModeButton.classList.remove("active");
  spreadModeButton.classList.add("active");
  deckScroll = 0;
  updateNextSlot();
  renderDeck();
  window.history.replaceState(null, "", window.location.pathname);

  clearAccountSpread?.then((cleared) => {
    if (cleared) return;
    accountSpreadSnapshot = previousSnapshot;
    restoreSavedSpread();
  });
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

  if (!moved) {
    dragState = null;
    return;
  }

  source.dataset.suppressClick = "true";
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
      context: `${["Прошлое", "Настоящее", "Будущее"][index]}: ${card.description}`,
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
    populateReading(reading, selectedCards);
    saveLastSpread(reading, source, payload.snapshot);
  } catch {
    populateReading(fallback, selectedCards);
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

function populateReading(reading, cards) {
  chapters[0].querySelector("h2").textContent = `Расклад на тему ${currentTopic || "Тема"}`;
  chapters[0].querySelector("p").textContent = reading.overview.text;

  cards.forEach((card, index) => {
    const cardReading = reading.cards[index];
    const chapter = chapters[index + 1];
    const navItem = readingNavItems[index + 1];
    chapter.querySelector("h3").textContent = card.name;
    populateCardTag(
      chapter.querySelector(".reading-card-suit"),
      chapter.querySelector(".reading-card-suit-label"),
      chapter.querySelector(".daily-result-suit-icon"),
      card,
    );
    const paragraphs = chapter.querySelectorAll("p");
    paragraphs[0].textContent = cardReading.meaning;
    paragraphs[1].textContent = cardReading.context;
    const position = ["Прошлое", "Настоящее", "Будущее"][index];
    navItem.dataset.label = `${position} · ${card.name}`;
    navItem.setAttribute("aria-label", `${position}: ${card.name}`);
    const image = stage.querySelector(`[data-card="${index}"] img`);
    image.src = card.image;
    image.alt = card.name;
    const positionImage = chapter.querySelector(".reading-position-card img");
    positionImage.src = card.image;
    positionImage.alt = card.name;
    const summaryImage = chapters[4].querySelector(`[data-summary-card="${index}"] img`);
    summaryImage.src = card.image;
    summaryImage.alt = card.name;
    const overviewCard = chapters[0].querySelector(`[data-overview-card="${index}"]`);
    const overviewImage = overviewCard.querySelector("img");
    overviewImage.src = card.image;
    overviewImage.alt = card.name;
    const displayName = window.innerWidth <= 720 ? compactMobileCardName(card.name) : card.name;
    overviewCard.querySelector(".reading-overview-card-name").textContent = displayName;
    stage.querySelector(`[data-card="${index}"] .stage-card-name`).textContent = displayName;
  });

  chapters[4].querySelector("p").textContent = reading.conclusion.text;
}

function showReading() {
  if (document.body.classList.contains("daily-mode")) return;
  readingCopy.scrollTop = 0;
  setActiveChapter(0);
  document.body.classList.add("reading-transition");

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      if (!document.body.classList.contains("daily-mode")) {
        document.body.classList.add("reading-entering");
      }
    });
  });

  window.setTimeout(
    () => {
      if (document.body.classList.contains("daily-mode")) return;
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
  reading.classList.toggle("is-overview", activeChapter === 0);
  reading.classList.toggle("is-card-chapter", activeChapter > 0 && activeChapter < 4);
  reading.classList.toggle("is-summary", activeChapter === 4);
  updateReadingTopFade();
}

function updateReadingTopFade() {
  reading.classList.toggle(
    "has-top-fade",
    window.innerWidth <= 720 && chapters[activeChapter].scrollTop > 2,
  );
}

function goToChapter(index) {
  const target = Math.max(0, Math.min(chapters.length - 1, index));
  if (target === activeChapter) return false;

  setActiveChapter(target);
  if (window.innerWidth <= 720) {
    readingCopy.scrollTop = 0;
    chapters[target].scrollTop = 0;
    updateReadingTopFade();
    return true;
  }
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
    if (window.innerWidth <= 720) return;
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
  if (window.innerWidth <= 720) return;
  touchStartY = event.touches[0].clientY;
  touchStartedOnFirstChapter = activeChapter === 0;
  touchStartedOnLastChapter = activeChapter === chapters.length - 1;
}, { passive: true });

reading.addEventListener("touchend", (event) => {
  if (window.innerWidth <= 720) return;
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

readingCloseButton.addEventListener("click", () => closeReadingToSaved(activeChapter));
readingPrevButton.addEventListener("click", () => goToChapter(activeChapter - 1));
readingNextButton.addEventListener("click", () => goToChapter(activeChapter + 1));
readingSummaryHomeButton.addEventListener("click", () => closeReadingToSaved(activeChapter));

dailyResultCopy.addEventListener("scroll", updateDailyResultScrollState, { passive: true });
dailyResult.addEventListener("scroll", updateDailyResultScrollState, { passive: true });
window.addEventListener("resize", scheduleDailyResultScrollUpdate, { passive: true });
document.addEventListener("visibilitychange", refreshDailyStateAfterBackground);
chapters.forEach((chapter) => {
  chapter.addEventListener("scroll", updateReadingTopFade, { passive: true });
});

readingCopy.addEventListener("scroll", () => {
  if (!document.body.classList.contains("reading-ready")) return;
  if (window.innerWidth <= 720) return;

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
