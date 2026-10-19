const assert = require("node:assert/strict");
const { startServer, launch } = require("./helpers.cjs");

(async () => {
  const server = await startServer();
  let browser;
  const errors = [];
  const results = [];
  try {
    browser = await launch();
    const context = await browser.newContext({ viewport: { width: 1365, height: 900 } });
    await context.addInitScript(() => {
      window.__audioContexts = [];
      const NativeAudioContext = window.AudioContext;
      if (NativeAudioContext) {
        window.AudioContext = class extends NativeAudioContext {
          constructor(...args) {
            super(...args);
            window.__audioContexts.push(this);
          }
        };
      }
      window.__activeIntervals = new Map();
      const set = window.setInterval.bind(window);
      const clear = window.clearInterval.bind(window);
      window.setInterval = (fn, delay, ...args) => {
        const id = set(fn, delay, ...args);
        window.__activeIntervals.set(id, delay);
        return id;
      };
      window.clearInterval = (id) => {
        window.__activeIntervals.delete(id);
        clear(id);
      };
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (["warning", "error"].includes(message.type()))
        errors.push(`${message.type()}: ${message.text()}`);
    });
    // Keep exercising the synthesized fallback even when the invitation uses an MP3.
    await page.route(server.url + "/", async (route) => {
      const response = await route.fetch();
      const body = (await response.text()).replace(/(data-music-audio\s+data-src=)"[^"]*"/, '$1""');
      await route.fulfill({ response, body });
    });
    await page.goto(server.url, { waitUntil: "networkidle" });
    await page.waitForSelector("#intro:not([hidden])");
    assert.equal(await page.locator("[data-music-toggle]").getAttribute("aria-pressed"), "false");
    assert.equal(await page.evaluate(() => window.__audioContexts.length), 0);
    assert.equal(await page.evaluate(() => document.querySelector("main").inert), true);
    assert.equal(
      await page
        .locator("[data-open-invitation]")
        .evaluate((button) => button === document.activeElement),
      true,
    );
    await page.keyboard.press("Shift+Tab");
    assert.equal(
      await page
        .locator("[data-skip-intro]")
        .evaluate((button) => button === document.activeElement),
      true,
    );
    await page.keyboard.press("Tab");
    assert.equal(
      await page
        .locator("[data-open-invitation]")
        .evaluate((button) => button === document.activeElement),
      true,
    );
    await page.keyboard.press("Enter");
    assert.equal(await page.locator("[data-open-invitation]").isDisabled(), true);
    assert.match(
      await page.locator("[data-intro-status]").textContent(),
      /Opening your invitation/,
    );
    await page.waitForSelector("#intro[hidden]", { state: "attached", timeout: 6500 });
    assert.equal(await page.evaluate(() => document.querySelector("main").inert), false);
    assert.equal(await page.evaluate(() => document.activeElement.id), "date-heading");
    assert.equal(await page.locator("[data-music-toggle]").getAttribute("aria-pressed"), "true");
    assert.equal(await page.evaluate(() => window.__audioContexts[0].state), "running");
    assert.equal(await page.locator("[data-petals] .petal").count(), 14);
    results.push(
      "Opening: keyboard focus stays in dialog, Enter opens, inert/focus restored; no autoplay before opening; actual AudioContext running after opening; 14 petals.",
    );

    await page.locator("[data-music-toggle]").click();
    await page.waitForFunction(() => window.__audioContexts[0].state === "suspended");
    assert.equal(await page.locator("[data-music-toggle]").getAttribute("aria-pressed"), "false");
    await page.evaluate(() => {
      document.querySelector("[data-music-toggle]").click();
      document.querySelector("[data-music-toggle]").click();
    });
    await page.waitForFunction(() => window.__audioContexts[0].state === "suspended");
    assert.equal(await page.locator("[data-music-toggle]").getAttribute("aria-pressed"), "false");
    await page.locator("[data-music-toggle]").click();
    await page.waitForFunction(() => window.__audioContexts[0].state === "running");
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForFunction(() => window.__audioContexts[0].state === "suspended");
    assert.deepEqual(await page.evaluate(() => [...window.__activeIntervals.values()]), []);
    assert.equal(await page.locator("[data-petals]").evaluate((element) => element.hidden), true);
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    assert.equal(await page.locator("[data-music-toggle]").getAttribute("aria-pressed"), "false");
    assert.deepEqual(await page.evaluate(() => [...window.__activeIntervals.values()]), [1000]);
    results.push(
      "Visibility: music, countdown timer, and petals pause; countdown alone resumes when visible.",
    );

    const canvas = page.locator("[data-scratch-canvas]").first();
    await canvas.scrollIntoViewIfNeeded();
    const box = await canvas.boundingBox();
    const before = await canvas.evaluate((element) => element.toDataURL());
    await page.mouse.move(box.x + 10, box.y + 10);
    await page.mouse.move(box.x + box.width - 10, box.y + box.height - 10, { steps: 10 });
    assert.equal(await canvas.evaluate((element) => element.toDataURL()), before);
    await page.mouse.move(box.x + 15, box.y + box.height * 0.25);
    await page.mouse.down();
    for (const [x, y] of [
      [0.85, 0.25],
      [0.15, 0.5],
      [0.85, 0.5],
      [0.15, 0.75],
      [0.85, 0.75],
    ]) {
      await page.mouse.move(box.x + box.width * x, box.y + box.height * y, { steps: 8 });
    }
    await page.mouse.up();
    assert.match(await page.locator(".scratch-card").first().getAttribute("class"), /is-revealed/);
    await page.locator("[data-reveal-date]").focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.locator(".scratch-card.is-revealed").count(), 3);
    assert.match(await page.locator(".date-reveal").getAttribute("class"), /is-complete/);
    results.push(
      "Scratch: hover does not erase; held pointer reveals; keyboard button reveals all three.",
    );

    const countdownCases = await page.evaluate(async () => {
      const { remainingTime } = await import("/js/countdown.js");
      return {
        future: remainingTime(90061000, 0),
        past: remainingTime(0, 1000),
        invalid: remainingTime("invalid date", 0),
      };
    });
    assert.deepEqual(countdownCases.future, {
      days: 1,
      hours: 1,
      minutes: 1,
      seconds: 1,
      complete: false,
    });
    assert.deepEqual(countdownCases.past, {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      complete: true,
    });
    assert.equal(countdownCases.invalid, null);
    await page.evaluate(() => {
      Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (value) => {
            window.__copiedLink = value;
          },
        },
      });
    });
    await page.locator("[data-share-invitation]").click();
    // The status appears once the asynchronous clipboard write has finished.
    await page.waitForFunction(() =>
      /copied/.test(document.querySelector("[data-share-status]").textContent),
    );
    assert.equal(
      await page.evaluate(() => window.__copiedLink),
      await page.evaluate(
        () => new URL(document.querySelector("link[rel=canonical]")?.href || location.origin).href,
      ),
    );
    results.push(
      "Countdown: future boundaries, elapsed event, and invalid date handled; clipboard sharing works.",
    );
    await context.close();

    const musicContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const musicPage = await musicContext.newPage();
    musicPage.on("pageerror", (error) => errors.push(error.message));
    const musicRequests = [];
    musicPage.on("request", (request) => {
      if (request.resourceType() === "media") musicRequests.push(request.url());
    });
    await musicPage.goto(server.url, { waitUntil: "networkidle" });
    const audio = musicPage.locator("[data-music-audio]");
    if ((await audio.getAttribute("data-src"))?.trim()) {
      assert.equal(await audio.getAttribute("src"), null);
      assert.deepEqual(musicRequests, [], "No music download before the opening gesture");
      await musicPage.locator("[data-open-invitation]").tap();
      await musicPage.waitForFunction(() => {
        const track = document.querySelector("[data-music-audio]");
        return !track.paused && track.currentTime > 0.2 && track.error === null;
      });
      assert.ok(musicRequests.length > 0);
      assert.deepEqual(
        await audio.evaluate((track) => ({ loop: track.loop, volume: track.volume })),
        { loop: true, volume: 0.3 },
      );
      await musicPage.waitForSelector("#intro[hidden]", { state: "attached", timeout: 6500 });
      assert.equal(
        await musicPage.locator("[data-music-toggle]").getAttribute("aria-pressed"),
        "true",
      );
      await musicPage.locator("[data-music-toggle]").tap();
      await musicPage.waitForFunction(() => document.querySelector("[data-music-audio]").paused);
      const pausedAt = await audio.evaluate((track) => track.currentTime);
      await musicPage.locator("[data-music-toggle]").tap();
      await musicPage.waitForFunction((time) => {
        const track = document.querySelector("[data-music-audio]");
        return !track.paused && track.currentTime > time;
      }, pausedAt);
      await musicPage.evaluate(() => {
        Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      assert.equal(await audio.evaluate((track) => track.paused), true);
      assert.equal(
        await musicPage.locator("[data-music-toggle]").getAttribute("aria-pressed"),
        "false",
      );
      await musicPage.evaluate(() => {
        Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      assert.equal(await audio.evaluate((track) => track.paused), true);
      results.push(
        "Configured music: no download before tap; real audio decodes and plays; loops at 30% volume; pause/resume and tab visibility work on mobile.",
      );
    }
    await musicContext.close();

    const openingContext = await browser.newContext();
    const openingPage = await openingContext.newPage();
    await openingPage.clock.install();
    openingPage.on("pageerror", (error) => errors.push(error.message));
    for (const action of ["skip", "escape", "reduce-motion"]) {
      await openingPage.emulateMedia({ reducedMotion: "no-preference" });
      await openingPage.goto(server.url, { waitUntil: "networkidle" });
      await openingPage.evaluate(() => {
        window.__openedCount = 0;
        document.addEventListener("invitation:opened", () => window.__openedCount++);
      });
      await openingPage.locator("[data-open-invitation]").click();
      await openingPage.waitForTimeout(1400);
      assert.equal(await openingPage.locator("#intro").isVisible(), true);
      assert.equal(await openingPage.evaluate(() => document.querySelector("main").inert), true);
      if (action === "skip") await openingPage.locator("[data-skip-intro]").click();
      if (action === "escape") await openingPage.keyboard.press("Escape");
      if (action === "reduce-motion") await openingPage.emulateMedia({ reducedMotion: "reduce" });
      // Well under the 5.3-second animation, with headroom for a busy test machine.
      await openingPage.waitForSelector("#intro[hidden]", { state: "attached", timeout: 2500 });
      assert.equal(await openingPage.evaluate(() => document.querySelector("main").inert), false);
      assert.equal(await openingPage.evaluate(() => document.activeElement.id), "date-heading");
      // Advancing past the original timer must not announce or focus the invitation a second time.
      await openingPage.clock.fastForward(5000);
      assert.equal(await openingPage.evaluate(() => window.__openedCount), 1);
    }
    results.push(
      "During the unfold: Skip, Escape, and enabling reduced motion finish immediately and restore focus exactly once.",
    );
    await openingContext.close();

    const autoContext = await browser.newContext();
    const autoPage = await autoContext.newPage();
    autoPage.on("pageerror", (error) => errors.push(error.message));
    await autoPage.goto(server.url, { waitUntil: "domcontentloaded" });
    const shownAt = Date.now();
    await autoPage.waitForSelector("#intro:not([hidden])");
    assert.equal(await autoPage.locator("#intro.is-opening").count(), 0);
    await autoPage.waitForSelector("#intro.is-opening", { state: "attached", timeout: 5000 });
    assert.ok(Date.now() - shownAt >= 2500, "Automatic opening waits about 3 seconds");
    await autoPage.waitForSelector("#intro[hidden]", { state: "attached", timeout: 7000 });
    assert.equal(await autoPage.evaluate(() => document.activeElement.id), "date-heading");
    const prompt = autoPage.locator("[data-scroll-prompt]");
    await autoPage.waitForTimeout(3000);
    assert.equal(await prompt.isVisible(), false, "Scroll prompt waits about 4 seconds");
    await autoPage.waitForSelector("[data-scroll-prompt].is-visible", { timeout: 2500 });
    if ((await autoPage.locator("[data-music-audio]").getAttribute("data-src"))?.trim()) {
      await autoPage.mouse.click(10, 300);
      await autoPage.waitForFunction(() => !document.querySelector("[data-music-audio]").paused);
    }
    await prompt.click();
    await autoPage.waitForFunction(() => window.scrollY > 100);
    await autoPage.waitForSelector("[data-scroll-prompt][hidden]", { state: "attached" });
    // Pausing again further down brings the prompt back.
    await autoPage.waitForSelector("[data-scroll-prompt].is-visible", { timeout: 5000 });
    await autoPage.mouse.wheel(0, 300);
    await autoPage.waitForSelector("[data-scroll-prompt][hidden]", { state: "attached" });
    // At the end of the invitation there is nothing left to scroll to.
    await autoPage.evaluate(() =>
      scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }),
    );
    await autoPage.waitForTimeout(4600);
    assert.equal(await prompt.isVisible(), false, "No scroll prompt at the end");
    await autoPage.goto(server.url, { waitUntil: "domcontentloaded" });
    await autoPage.waitForSelector("#intro:not([hidden])");
    await autoPage.keyboard.press("Tab");
    await autoPage.waitForTimeout(3600);
    assert.equal(await autoPage.locator("#intro.is-opening").count(), 0);
    results.push(
      "Untouched opening starts by itself after 3 seconds and music follows the next gesture; scroll prompt appears after every 4-second pause, scrolls on, and stays away at the end; keyboard use keeps the seal waiting.",
    );
    await autoContext.close();

    // Some phones report hover support; a lingering hover must not lift a photo over later ones.
    const stackContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const stackPage = await stackContext.newPage();
    stackPage.on("pageerror", (error) => errors.push(error.message));
    await stackPage.goto(server.url, { waitUntil: "networkidle" });
    await stackPage.keyboard.press("Escape");
    const photos = stackPage.locator(".polaroid");
    await photos.first().scrollIntoViewIfNeeded();
    await photos.first().hover();
    for (const index of [1, 2]) {
      await stackPage.evaluate((i) => {
        const card = document.querySelectorAll(".polaroid")[i];
        card.classList.add("is-visible");
        const stickyTop = parseFloat(getComputedStyle(card).top);
        scrollTo({ top: scrollY + card.getBoundingClientRect().top - stickyTop, behavior: "instant" });
      }, index);
      await stackPage.waitForTimeout(100);
      const onTop = await stackPage.evaluate((i) => {
        const card = document.querySelectorAll(".polaroid")[i];
        const box = card.getBoundingClientRect();
        return card.contains(document.elementFromPoint(box.left + box.width / 2, box.top + 60));
      }, index);
      assert.equal(onTop, true, `Photo ${index + 1} is stacked above the earlier photos`);
    }
    results.push("Phone gallery: each later photo stacks on top, even with a lingering hover.");
    await stackContext.close();

    const reduced = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
      isMobile: true,
      hasTouch: true,
    });
    const reducedPage = await reduced.newPage();
    reducedPage.on("pageerror", (error) => errors.push(error.message));
    await reducedPage.goto(server.url, { waitUntil: "networkidle" });
    await reducedPage.locator("[data-open-invitation]").click();
    await reducedPage.waitForSelector("#intro[hidden]", { state: "attached", timeout: 1000 });
    assert.equal(
      await reducedPage.locator("[data-petals]").evaluate((element) => element.hidden),
      true,
    );
    assert.equal(await reducedPage.locator(".reveal:not(.is-visible)").count(), 0);
    assert.equal(
      await reducedPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      true,
    );
    results.push(
      "Reduced motion on 390px viewport: immediate opening, no petals, all content revealed, no horizontal overflow.",
    );
    const touchCanvas = reducedPage.locator("[data-scratch-canvas]").first();
    await touchCanvas.scrollIntoViewIfNeeded();
    const touchBox = await touchCanvas.boundingBox();
    const session = await reduced.newCDPSession(reducedPage);
    const touchPoint = (x, y) => [
      { x: touchBox.x + touchBox.width * x, y: touchBox.y + touchBox.height * y },
    ];
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: touchPoint(0.15, 0.25),
    });
    for (const [x, y] of [
      [0.85, 0.25],
      [0.15, 0.5],
      [0.85, 0.5],
      [0.15, 0.75],
      [0.85, 0.75],
    ]) {
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: touchPoint(x, y),
      });
    }
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    assert.match(
      await reducedPage.locator(".scratch-card").first().getAttribute("class"),
      /is-revealed/,
    );
    await reducedPage.reload({ waitUntil: "networkidle" });
    await reducedPage.keyboard.press("Escape");
    assert.equal(await reducedPage.locator("#intro").isVisible(), false);
    assert.equal(
      await reducedPage.locator("[data-music-toggle]").getAttribute("aria-pressed"),
      "false",
    );
    results.push(
      "Touch gesture scratches a mobile card; Escape skips the intro without starting music.",
    );
    await reduced.close();

    const noJs = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 390, height: 844 },
    });
    const staticPage = await noJs.newPage();
    await staticPage.goto(server.url, { waitUntil: "networkidle" });
    assert.equal(await staticPage.locator("#intro").isVisible(), false);
    assert.equal(await staticPage.locator("#date-heading").isVisible(), true);
    assert.equal(await staticPage.locator("main").getAttribute("inert"), null);
    assert.equal(await staticPage.locator("[data-scratch-canvas]:visible").count(), 0);
    assert.equal(
      await staticPage
        .locator(
          "[data-music-toggle]:visible, [data-reveal-date]:visible, [data-share-invitation]:visible",
        )
        .count(),
      0,
    );
    results.push(
      "JavaScript disabled: intro stays hidden, Save the date and the invitation remain available.",
    );
    await noJs.close();

    const videoContext = await browser.newContext();
    await videoContext.addInitScript(() => {
      window.__videoMode = "play";
      Object.defineProperty(HTMLVideoElement.prototype, "src", {
        configurable: true,
        get() {
          return this.__testSource || "";
        },
        set(value) {
          this.__testSource = value;
        },
      });
      HTMLVideoElement.prototype.play = function () {
        if (window.__videoMode === "stall") return new Promise(() => {});
        if (window.__videoMode === "reject") return Promise.reject(new Error("Unavailable video"));
        return Promise.resolve();
      };
      HTMLVideoElement.prototype.pause = function () {};
      HTMLVideoElement.prototype.load = function () {};
    });
    const videoPage = await videoContext.newPage();
    videoPage.on("pageerror", (error) => errors.push(error.message));
    await videoPage.route(server.url + "/", async (route) => {
      const response = await route.fetch();
      const body = (await response.text()).replace(
        /data-intro-video\s+data-src="[^"]*"/,
        'data-intro-video data-src="assets/video/test.mp4"',
      );
      await route.fulfill({ response, body });
    });
    await videoPage.goto(server.url, { waitUntil: "networkidle" });
    await videoPage.locator("[data-open-invitation]").click();
    await videoPage.waitForTimeout(1700);
    assert.equal(await videoPage.locator("#intro").isVisible(), true);
    assert.equal(await videoPage.locator("[data-intro-video]").isVisible(), true);
    await videoPage
      .locator("[data-intro-video]")
      .evaluate((video) => video.dispatchEvent(new Event("ended")));
    assert.equal(await videoPage.locator("#intro").isVisible(), false);
    await videoPage.reload({ waitUntil: "networkidle" });
    await videoPage.evaluate(() => {
      window.__videoMode = "stall";
    });
    await videoPage.locator("[data-open-invitation]").click();
    await videoPage.waitForSelector("#intro[hidden]", { state: "attached", timeout: 5500 });
    await videoPage.reload({ waitUntil: "networkidle" });
    await videoPage.evaluate(() => {
      window.__videoMode = "reject";
    });
    await videoPage.locator("[data-open-invitation]").click();
    await videoPage.waitForSelector("#intro[hidden]", { state: "attached", timeout: 1000 });
    results.push(
      "Optional video: remains open past envelope timing; closes on ended; stalled load times out; rejected playback falls back.",
    );
    await videoContext.close();

    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed: results, pageErrors: errors }, null, 2));
  } finally {
    await browser?.close();
    await server.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
