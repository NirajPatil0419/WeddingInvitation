// Matches the two-panel opening, names, and final dissolve in intro.css.
const ENVELOPE_OPENING_MS = 5300;
// Guests who do not tap the seal see the opening start by itself after this delay.
const AUTO_OPEN_MS = 3000;

export function setupIntro({ onOpen = () => {} } = {}) {
  const intro = document.querySelector("#intro");
  const openButton = intro?.querySelector("[data-open-invitation]");
  const skipButton = intro?.querySelector("[data-skip-intro]");
  if (!intro || !openButton || !skipButton) {
    document.body.classList.add("invitation-open", "opened");
    return;
  }

  const video = intro.querySelector("[data-intro-video]");
  const status = intro.querySelector("[data-intro-status]");
  const coveredElements = [
    document.querySelector(".site-header"),
    document.querySelector("main"),
    document.querySelector("footer"),
    document.querySelector("[data-music-toggle]"),
  ].filter((element) => element && !element.contains(intro));
  const priorInert = coveredElements.map((element) => element.inert);
  const motionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  let phase = "sealed";
  let openingTimer;
  let videoDeadline;
  let autoOpenTimer;

  function scheduleAutoOpen() {
    window.clearTimeout(autoOpenTimer);
    // Count only time the invitation is actually on screen, e.g. not while a chat app preloads it.
    if (phase !== "sealed" || document.hidden) return;
    autoOpenTimer = window.setTimeout(() => open(true), AUTO_OPEN_MS);
  }

  function cancelAutoOpen() {
    window.clearTimeout(autoOpenTimer);
    document.removeEventListener("visibilitychange", scheduleAutoOpen);
  }

  function finish() {
    if (phase === "open") return;
    phase = "open";
    cancelAutoOpen();
    window.clearTimeout(openingTimer);
    window.clearTimeout(videoDeadline);
    intro.classList.remove("is-opening", "is-video-playing", "has-intro-video");
    intro.classList.add("is-open");
    intro.hidden = true;
    openButton.removeAttribute("aria-busy");
    document.body.classList.remove("intro-active");
    document.body.classList.add("invitation-open", "opened");
    coveredElements.forEach((element, index) => {
      element.inert = priorInert[index];
    });
    if (video) {
      video.pause();
      video.hidden = true;
      video.removeAttribute("src");
      video.load();
    }
    document.removeEventListener("keydown", onKeyDown);
    motionQuery?.removeEventListener?.("change", onMotionChange);
    document.querySelector("#date-heading")?.focus({ preventScroll: true });
    document.dispatchEvent(new CustomEvent("invitation:opened"));
  }

  function open(automatic = false) {
    if (phase !== "sealed") return;
    phase = "opening";
    cancelAutoOpen();
    const reducedMotion = Boolean(motionQuery?.matches);
    const videoSource = video?.dataset.src?.trim();
    intro.classList.toggle("has-intro-video", Boolean(video && videoSource && !reducedMotion));
    intro.classList.add("is-opening");
    openButton.disabled = true;
    openButton.setAttribute("aria-busy", "true");
    if (status) status.textContent = intro.dataset.openingMessage || "";
    // Music begins in the same user gesture, as required by mobile browsers.
    // An automatic opening has no gesture, so the caller may need to wait for one.
    try {
      Promise.resolve(onOpen({ automatic })).catch(() => {});
    } catch {
      /* Opening remains available. */
    }
    if (video && videoSource && !reducedMotion) {
      let hasStarted = false;
      const playVideo = () => {
        if (phase !== "opening" || hasStarted) return;
        hasStarted = true;
        window.clearTimeout(openingTimer);
        video.hidden = false;
        intro.classList.add("is-video-playing");
        videoDeadline = window.setTimeout(finish, 20000);
      };
      const videoFailed = () => {
        if (phase !== "opening") return;
        window.clearTimeout(openingTimer);
        window.clearTimeout(videoDeadline);
        video.hidden = true;
        intro.classList.remove("is-video-playing");
        finish();
      };
      video.addEventListener("playing", playVideo, { once: true });
      video.addEventListener("ended", finish, { once: true });
      video.addEventListener("error", videoFailed, { once: true });
      video.src = videoSource;
      video.muted = true;
      video.playsInline = true;
      // A missing or slow video must never hold the invitation closed.
      openingTimer = window.setTimeout(videoFailed, 4000);
      try {
        Promise.resolve(video.play()).then(playVideo).catch(videoFailed);
      } catch {
        videoFailed();
      }
      return;
    }
    // The built-in envelope needs no media request and opens without delay for reduced motion.
    openingTimer = window.setTimeout(finish, reducedMotion ? 0 : ENVELOPE_OPENING_MS);
  }

  function onMotionChange(event) {
    if (event.matches && phase === "opening") finish();
  }

  function onKeyDown(event) {
    // Keyboard and screen-reader guests are exploring the opening; let them choose when to open.
    if (phase === "sealed") cancelAutoOpen();
    if (event.key === "Escape") {
      event.preventDefault();
      finish();
      return;
    }
    if (event.key !== "Tab") return;
    const controls = [
      ...intro.querySelectorAll("button:not([disabled]), a[href], [tabindex='0']"),
    ].filter((element) => !element.hidden);
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (!first) return;
    if (
      event.shiftKey &&
      (document.activeElement === first || !intro.contains(document.activeElement))
    ) {
      event.preventDefault();
      last.focus();
    } else if (
      !event.shiftKey &&
      (document.activeElement === last || !intro.contains(document.activeElement))
    ) {
      event.preventDefault();
      first.focus();
    }
  }

  openButton.addEventListener("click", () => open());
  skipButton.addEventListener("click", finish);
  document.addEventListener("visibilitychange", scheduleAutoOpen);
  document.addEventListener("keydown", onKeyDown);
  motionQuery?.addEventListener?.("change", onMotionChange);
  coveredElements.forEach((element) => {
    element.inert = true;
  });
  intro.setAttribute("role", "dialog");
  intro.setAttribute("aria-modal", "true");
  intro.hidden = false;
  document.body.classList.add("intro-active");
  openButton.focus({ preventScroll: true });
  scheduleAutoOpen();
  return { open, skip: finish };
}
