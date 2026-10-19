export function setupScrollEffects() {
  const elements = [...document.querySelectorAll(".reveal")];
  const motionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  let observer;
  const revealEverything = () => {
    elements.forEach((element) => element.classList.add("is-visible"));
    observer?.disconnect();
    document.body.classList.remove("motion-ready");
  };

  if (!motionQuery?.matches && "IntersectionObserver" in window) {
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -20px 0px" },
    );
    elements.forEach((element) => observer.observe(element));
    document.body.classList.add("motion-ready");
  } else {
    revealEverything();
  }

  motionQuery?.addEventListener?.("change", (event) => {
    if (event.matches) revealEverything();
  });
  // Keyboard navigation must reveal a focused section before the observer fires.
  document.addEventListener("focusin", (event) => {
    event.target.closest?.(".reveal")?.classList.add("is-visible");
  });

  const progress = document.querySelector("[data-scroll-progress]");
  if (!progress) return;
  let pendingFrame = false;
  function updateProgress() {
    pendingFrame = false;
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const fraction = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0;
    progress.style.transform = `scaleX(${fraction})`;
  }
  function queueProgress() {
    if (pendingFrame) return;
    pendingFrame = true;
    window.requestAnimationFrame(updateProgress);
  }
  window.addEventListener("scroll", queueProgress, { passive: true });
  window.addEventListener("resize", queueProgress, { passive: true });
  document.addEventListener("invitation:opened", queueProgress);
  updateProgress();
}

// Guests who pause anywhere before the end of the invitation are nudged to keep scrolling.
const SCROLL_PROMPT_IDLE_MS = 4000;
// Near the footer there is nothing left to discover.
const SCROLL_PROMPT_END_MARGIN = 120;

export function setupScrollPrompt() {
  const prompt = document.querySelector("[data-scroll-prompt]");
  if (!prompt) return;
  const motionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  let idleTimer;
  let hideTimer;

  const remaining = () =>
    document.documentElement.scrollHeight - (window.scrollY + window.innerHeight);

  function hide() {
    if (prompt.hidden) return;
    prompt.classList.remove("is-visible");
    // Wait for the fade before removing it from the accessibility tree.
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => (prompt.hidden = true), motionQuery?.matches ? 0 : 400);
  }

  function show() {
    if (document.hidden || remaining() < SCROLL_PROMPT_END_MARGIN) return;
    window.clearTimeout(hideTimer);
    prompt.hidden = false;
    window.requestAnimationFrame(() => prompt.classList.add("is-visible"));
  }

  function restartIdleTimer() {
    window.clearTimeout(idleTimer);
    if (!document.hidden) idleTimer = window.setTimeout(show, SCROLL_PROMPT_IDLE_MS);
  }

  function onScroll() {
    hide();
    restartIdleTimer();
  }

  prompt.addEventListener("click", () => {
    window.scrollBy({
      top: window.innerHeight * 0.8,
      behavior: motionQuery?.matches ? "auto" : "smooth",
    });
    hide();
  });
  document.addEventListener(
    "invitation:opened",
    () => {
      window.addEventListener("scroll", onScroll, { passive: true });
      document.addEventListener("visibilitychange", restartIdleTimer);
      restartIdleTimer();
    },
    { once: true },
  );
}

export function setupPetals() {
  const container = document.querySelector("[data-petals]");
  if (!container) return;
  const motionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  let opened = document.body.classList.contains("invitation-open");
  let created = false;

  function synchronize() {
    const paused = !opened || document.hidden || Boolean(motionQuery?.matches);
    container.hidden = paused;
    container.classList.toggle("is-paused", paused);
    if (!opened || motionQuery?.matches || created) return;

    const fragment = document.createDocumentFragment();
    for (let index = 0; index < 14; index += 1) {
      const petal = document.createElement("span");
      petal.className = "petal";
      petal.setAttribute("aria-hidden", "true");
      petal.style.setProperty("--left", `${(index * 37 + 4) % 100}%`);
      petal.style.setProperty("--size", `${7 + (index % 5)}px`);
      petal.style.setProperty("--delay", `${-index * 2.3}s`);
      petal.style.setProperty("--duration", `${16 + (index % 7) * 2}s`);
      petal.style.setProperty("--drift", `${index % 2 ? -70 : 70}px`);
      petal.style.setProperty("--rotation", `${index * 43}deg`);
      fragment.appendChild(petal);
    }
    container.appendChild(fragment);
    created = true;
  }

  document.addEventListener(
    "invitation:opened",
    () => {
      opened = true;
      synchronize();
    },
    { once: true },
  );
  document.addEventListener("visibilitychange", synchronize);
  motionQuery?.addEventListener?.("change", synchronize);
  synchronize();
}
