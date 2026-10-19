import { message as uiText } from "./messages.js";

export function remainingTime(targetTime, now = Date.now()) {
  const milliseconds = typeof targetTime === "number" ? targetTime : Date.parse(targetTime);
  if (!Number.isFinite(milliseconds) || !Number.isFinite(now)) return null;
  const totalSeconds = Math.max(0, Math.ceil((milliseconds - now) / 1000));
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor(totalSeconds / 3600) % 24,
    minutes: Math.floor(totalSeconds / 60) % 60,
    seconds: totalSeconds % 60,
    complete: totalSeconds === 0,
  };
}

export function setupCountdown() {
  const root = document.querySelector("[data-countdown]");
  if (!root) return;
  const targetTime = Date.parse(root.dataset.date);
  const message =
    root.querySelector("[data-countdown-message]") ||
    document.querySelector("[data-countdown-message]");
  const fields = Object.fromEntries(
    ["days", "hours", "minutes", "seconds"].map((key) => [
      key,
      root.querySelector(`[data-${key}]`),
    ]),
  );
  let interval;
  let complete = false;

  function stop() {
    window.clearInterval(interval);
    interval = undefined;
  }

  function tick() {
    const remaining = remainingTime(targetTime);
    if (!remaining) {
      Object.values(fields).forEach((field) => {
        if (field) field.textContent = "—";
      });
      if (message) message.textContent = uiText("jsCountdownFallback");
      complete = true;
      stop();
      return;
    }
    Object.entries(fields).forEach(([key, field]) => {
      if (field) field.textContent = String(remaining[key]).padStart(2, "0");
    });
    if (remaining.complete) {
      complete = true;
      root.classList.add("is-complete");
      if (message) message.textContent = uiText("jsCountdownComplete");
      stop();
    }
  }

  function resume() {
    stop();
    tick();
    if (!document.hidden && !complete) interval = window.setInterval(tick, 1000);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else resume();
  });
  resume();
  return { refresh: tick, stop };
}
