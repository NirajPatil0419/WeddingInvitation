import { createMusicController } from "./music.js";
import { setupIntro } from "./intro.js";
import { setupScratchDate } from "./scratch-date.js";
import { setupCountdown } from "./countdown.js";
import { setupScrollEffects, setupScrollPrompt, setupPetals } from "./effects.js";
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

// Browsers block sound until a gesture, so an automatic opening plays music on the next one.
function startMusicOnGesture() {
  // Only these events grant permission to play sound; the touch that starts a scroll does not.
  const events = ["pointerup", "touchend", "click", "keydown"];
  const stop = () => events.forEach((type) => document.removeEventListener(type, onGesture, true));
  const onGesture = (event) => {
    // Using the music control is a deliberate choice; let the control handle it from now on.
    if (music?.isPlaying() || event.target.closest?.("[data-music-toggle]")) {
      stop();
      return;
    }
    // Keep listening until playback really starts; a scroll gesture may not have counted.
    Promise.resolve(music?.start()).then(() => {
      if (music?.isPlaying()) stop();
    });
  };
  events.forEach((type) => document.addEventListener(type, onGesture, true));
}

const music = enhance("music", createMusicController);
enhance("opening", () =>
  setupIntro({
    onOpen: ({ automatic }) => {
      if (automatic) startMusicOnGesture();
      return music?.start();
    },
  }),
);
enhance("date reveal", setupScratchDate);
enhance("countdown", setupCountdown);
enhance("scroll", setupScrollEffects);
enhance("scroll prompt", setupScrollPrompt);
enhance("petals", setupPetals);
enhance("sharing", setupSharing);
enhance("local time", () => {
  const time = document.querySelector("[data-local-time]");
  const row = document.querySelector("[data-local-time-row]");
  if (!time || !row || typeof Intl === "undefined") return;

  const value = time.getAttribute("datetime");
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return;

  // Guests already in the wedding's time zone see the same time above, so skip the repeat.
  const offset = /([+-])(\d{2}):(\d{2})$/.exec(value);
  if (offset) {
    const weddingOffset = (offset[1] === "-" ? 1 : -1) * (Number(offset[2]) * 60 + Number(offset[3]));
    if (date.getTimezoneOffset() === weddingOffset) return;
  }

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
