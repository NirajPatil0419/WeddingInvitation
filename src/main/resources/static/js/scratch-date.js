import { message as uiText } from "./messages.js";

const GRID_COLUMNS = 24;
const GRID_ROWS = 16;
const REVEAL_THRESHOLD = 0.35;

export function setupScratchDate() {
  const cards = [...document.querySelectorAll(".scratch-card")];
  const revealButton = document.querySelector("[data-reveal-date]");
  const section = document.querySelector(".date-reveal");
  if (!cards.length) return;
  const revealers = [];
  let revealed = 0;

  function onRevealed() {
    revealed += 1;
    if (revealed !== cards.length) return;
    section?.classList.add("is-complete");
    if (revealButton) {
      revealButton.textContent = uiText("jsDateRevealed");
      revealButton.disabled = true;
    }
    const status = document.querySelector("[data-date-status]");
    if (status) status.textContent = uiText("jsDateStatus");
    document.dispatchEvent(new CustomEvent("invitation:date-revealed"));
  }

  cards.forEach((card) => {
    const canvas = card.querySelector("[data-scratch-canvas]");
    let isRevealed = false;
    let resizeObserver;
    let pointerId = null;
    let lastPoint = null;
    const coverage = new Uint8Array(GRID_COLUMNS * GRID_ROWS);
    let erasedCells = 0;
    let width = 0;
    let height = 0;

    function reveal() {
      if (isRevealed) return;
      isRevealed = true;
      card.classList.add("is-revealed");
      if (canvas) canvas.style.pointerEvents = "none";
      resizeObserver?.disconnect();
      onRevealed();
    }
    revealers.push(reveal);

    let context;
    try {
      context = canvas?.getContext("2d");
    } catch {
      /* Date remains available. */
    }
    if (!canvas || !context || !("PointerEvent" in window)) {
      reveal();
      return;
    }

    function paint() {
      if (isRevealed) return;
      const bounds = canvas.getBoundingClientRect();
      const nextWidth = bounds.width || card.clientWidth;
      const nextHeight = bounds.height || card.clientHeight;
      if (!nextWidth || !nextHeight) return;
      if (width === nextWidth && height === nextHeight) return;
      // A rotation or responsive resize should never erase a guest's progress.
      if (erasedCells > 0) {
        reveal();
        return;
      }
      width = nextWidth;
      height = nextHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const gradient = context.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, "#c69a58");
      gradient.addColorStop(0.45, "#ecd6a5");
      gradient.addColorStop(1, "#b48259");
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);
      context.strokeStyle = "rgba(255, 250, 229, 0.22)";
      context.lineWidth = 1;
      for (let offset = -height; offset < width; offset += 12) {
        context.beginPath();
        context.moveTo(offset, 0);
        context.lineTo(offset + height, height);
        context.stroke();
      }
      context.fillStyle = "#654226";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.font = `${Math.max(15, Math.min(24, width / 7))}px Georgia, serif`;
      context.fillText("✦", width / 2, height * 0.34);
      context.font = `${Math.max(10, Math.min(14, width / 11))}px Arial, sans-serif`;
      context.fillText(uiText("jsScratchHere"), width / 2, height * 0.64);
      context.globalCompositeOperation = "destination-out";
      context.lineCap = "round";
      context.lineJoin = "round";
    }

    function markCoverage(point, radius) {
      const cellWidth = width / GRID_COLUMNS;
      const cellHeight = height / GRID_ROWS;
      const minColumn = Math.max(0, Math.floor((point.x - radius) / cellWidth));
      const maxColumn = Math.min(GRID_COLUMNS - 1, Math.floor((point.x + radius) / cellWidth));
      const minRow = Math.max(0, Math.floor((point.y - radius) / cellHeight));
      const maxRow = Math.min(GRID_ROWS - 1, Math.floor((point.y + radius) / cellHeight));
      for (let row = minRow; row <= maxRow; row += 1) {
        for (let column = minColumn; column <= maxColumn; column += 1) {
          const index = row * GRID_COLUMNS + column;
          const dx = (column + 0.5) * cellWidth - point.x;
          const dy = (row + 0.5) * cellHeight - point.y;
          if (!coverage[index] && dx * dx + dy * dy <= radius * radius) {
            coverage[index] = 1;
            erasedCells += 1;
          }
        }
      }
    }

    function scratch(event) {
      if (isRevealed || !width || !height) return;
      const bounds = canvas.getBoundingClientRect();
      const point = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
      const radius = Math.max(16, Math.min(width, height) * 0.12);
      const previous = lastPoint || point;
      context.lineWidth = radius * 2;
      context.beginPath();
      context.moveTo(previous.x, previous.y);
      context.lineTo(point.x, point.y);
      context.stroke();
      context.beginPath();
      context.arc(point.x, point.y, radius, 0, Math.PI * 2);
      context.fill();
      const distance = Math.hypot(point.x - previous.x, point.y - previous.y);
      const steps = Math.max(1, Math.ceil(distance / (radius / 2)));
      for (let step = 0; step <= steps; step += 1) {
        const progress = step / steps;
        markCoverage(
          {
            x: previous.x + (point.x - previous.x) * progress,
            y: previous.y + (point.y - previous.y) * progress,
          },
          radius,
        );
      }
      lastPoint = point;
      if (erasedCells / coverage.length >= REVEAL_THRESHOLD) reveal();
    }

    canvas.hidden = false;
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.touchAction = "none";
    card.classList.add("scratch-ready");
    canvas.addEventListener("pointerdown", (event) => {
      if (isRevealed || event.button !== 0 || pointerId !== null) return;
      pointerId = event.pointerId;
      lastPoint = null;
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        /* Capture is optional. */
      }
      scratch(event);
    });
    canvas.addEventListener("pointermove", (event) => {
      if (event.pointerId !== pointerId) return;
      if ((event.buttons & 1) === 0) {
        pointerId = null;
        lastPoint = null;
        return;
      }
      scratch(event);
    });
    const finishStroke = (event) => {
      if (event.pointerId === pointerId) {
        pointerId = null;
        lastPoint = null;
      }
    };
    canvas.addEventListener("pointerup", finishStroke);
    canvas.addEventListener("pointercancel", finishStroke);
    canvas.addEventListener("lostpointercapture", finishStroke);
    paint();
    if ("ResizeObserver" in window) {
      resizeObserver = new ResizeObserver(paint);
      resizeObserver.observe(card);
    } else {
      window.addEventListener("resize", paint, { passive: true });
    }
  });

  revealButton?.addEventListener("click", () => revealers.forEach((reveal) => reveal()));
  if (revealButton) revealButton.hidden = revealed === cards.length;
  return { revealAll: () => revealers.forEach((reveal) => reveal()) };
}
