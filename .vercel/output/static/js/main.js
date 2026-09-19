import { createMusicController } from "./music.js";
import { setupIntro } from "./intro.js";
import { setupScratchDate } from "./scratch-date.js";
import { setupCountdown } from "./countdown.js";
import { setupScrollEffects, setupPetals } from "./effects.js";
import { setupSharing } from "./sharing.js";

// Keep enhancements independent: the invitation itself is rendered by Java.
function enhance(name, initialize) {
  try {
    return initialize();
  } catch (error) {
    console.warn(`The ${name} enhancement is unavailable.`, error);
    return undefined;
  }
}

const music = enhance("music", createMusicController);
enhance("opening", () => setupIntro({ onOpen: () => music?.start() }));
enhance("date reveal", setupScratchDate);
enhance("countdown", setupCountdown);
enhance("scroll", setupScrollEffects);
enhance("petals", setupPetals);
enhance("sharing", setupSharing);
enhance("local time", () => {
  const time = document.querySelector("[data-local-time]");
  const row = document.querySelector("[data-local-time-row]");
  if (!time || !row || typeof Intl === "undefined") return;

  const date = new Date(time.getAttribute("datetime"));
  if (!Number.isFinite(date.getTime())) return;

  const formatter = new Intl.DateTimeFormat(document.documentElement.lang || undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
  time.textContent = formatter.format(date);
  row.hidden = false;
});
