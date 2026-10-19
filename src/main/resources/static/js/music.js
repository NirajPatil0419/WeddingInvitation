import { message as uiText } from "./messages.js";

// An original, quiet pentatonic melody provides music without a downloaded track.
const MELODY = [
  523.25,
  659.25,
  783.99,
  659.25,
  587.33,
  523.25,
  440,
  523.25,
  659.25,
  783.99,
  880,
  783.99,
  659.25,
  587.33,
  523.25,
  null,
];
const NOTE_SPACING = 0.9;

export function createMusicController() {
  const button = document.querySelector("[data-music-toggle]");
  const label = document.querySelector("[data-music-label]");
  const audio = document.querySelector("[data-music-audio]");
  const source = audio?.dataset.src?.trim();
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  let context;
  let master;
  let timer;
  let playing = false;
  let starting = false;
  let generation = 0;
  let noteIndex = 0;
  let nextNoteAt = 0;
  const activeVoices = new Set();

  function update(message) {
    if (label)
      label.textContent = message || (playing ? uiText("jsMusicOn") : uiText("jsMusicOff"));
    if (button) {
      button.setAttribute("aria-pressed", String(playing));
      button.setAttribute("aria-label", playing ? uiText("jsPauseMusic") : uiText("jsPlayMusic"));
      button.classList.toggle("is-playing", playing);
    }
  }

  function bell(frequency, when, level = 1) {
    if (!context || !master) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(0.22 * level, when + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.001, when + 2.7);
    oscillator.connect(gain);
    gain.connect(master);
    activeVoices.add(oscillator);
    oscillator.onended = () => {
      activeVoices.delete(oscillator);
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start(when);
    oscillator.stop(when + 2.8);
  }

  function schedule() {
    if (!playing || !context || context.state !== "running") return;
    // Do not catch up by playing a burst of old notes after a suspended page.
    if (nextNoteAt < context.currentTime - 0.5) nextNoteAt = context.currentTime + 0.04;
    // Schedule a short horizon rather than a whole looping composition.
    while (nextNoteAt < context.currentTime + 0.35) {
      const frequency = MELODY[noteIndex % MELODY.length];
      if (frequency) bell(frequency, nextNoteAt);
      if (noteIndex % 8 === 0) {
        bell(130.81, nextNoteAt, 0.32);
        bell(196, nextNoteAt + 0.04, 0.2);
      }
      noteIndex += 1;
      nextNoteAt += NOTE_SPACING;
    }
  }

  function pause() {
    generation += 1;
    playing = false;
    starting = false;
    window.clearInterval(timer);
    timer = undefined;
    if (audio) audio.pause();
    activeVoices.forEach((voice) => {
      try {
        voice.stop();
      } catch {
        /* An already-ended note needs no cleanup. */
      }
    });
    activeVoices.clear();
    if (context?.state === "running") context.suspend().catch(() => {});
    update();
  }

  async function start() {
    if (playing || starting || document.hidden) return;
    const attempt = ++generation;
    starting = true;
    try {
      if (source && audio) {
        if (!audio.getAttribute("src")) audio.src = source;
        audio.loop = true;
        audio.volume = 0.3;
        await audio.play();
      } else if (AudioContextClass) {
        if (!context) {
          context = new AudioContextClass();
          master = context.createGain();
          master.gain.value = 0.11;
          master.connect(context.destination);
          context.addEventListener("statechange", () => {
            if (playing && context.state !== "running") pause();
          });
        }
        await context.resume();
        if (context.state !== "running") throw new Error("Audio is waiting for a user gesture.");
      } else {
        throw new Error("Audio playback is unavailable.");
      }
      // A stale play promise must not pause a more recent user interaction.
      if (attempt !== generation) {
        if (!playing && !starting) {
          if (audio) audio.pause();
          if (context?.state === "running") context.suspend().catch(() => {});
        }
        return;
      }
      if (document.hidden) {
        pause();
        return;
      }
      playing = true;
      if (!source && context) {
        nextNoteAt = context.currentTime + 0.06;
        schedule();
        timer = window.setInterval(schedule, 200);
      }
      update();
    } catch {
      if (attempt !== generation) return;
      pause();
      update(uiText("jsTapMusic"));
    } finally {
      if (attempt === generation) starting = false;
    }
  }

  function toggle() {
    if (playing || starting) pause();
    else return start();
  }

  button?.addEventListener("click", toggle);
  audio?.addEventListener("error", () => {
    pause();
    update(uiText("jsMusicUnavailable"));
  });
  audio?.addEventListener("pause", () => {
    if (audio.paused && (playing || starting)) pause();
  });
  audio?.addEventListener("ended", pause);
  document.addEventListener("visibilitychange", () => {
    // Returning to a tab stays quiet until the guest chooses to resume.
    if (document.hidden) pause();
  });
  update();
  if (button) button.hidden = !source && !AudioContextClass;
  return { start, pause, toggle, isPlaying: () => playing };
}
