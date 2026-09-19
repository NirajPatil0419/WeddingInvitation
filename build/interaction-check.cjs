const assert = require('node:assert/strict');
const { chromium } = require('./browser-tools/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
  });
  const errors = [];
  const results = [];
  try {
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
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (['warning', 'error'].includes(message.type())) errors.push(`${message.type()}: ${message.text()}`);
    });
    await page.goto('http://localhost:8088', { waitUntil: 'networkidle' });
    await page.waitForSelector('#intro:not([hidden])');
    assert.equal(await page.locator('[data-music-toggle]').getAttribute('aria-pressed'), 'false');
    assert.equal(await page.evaluate(() => window.__audioContexts.length), 0);
    assert.equal(await page.evaluate(() => document.querySelector('main').inert), true);
    await page.locator('[data-open-invitation]').click();
    await page.waitForSelector('#intro[hidden]', { state: 'attached', timeout: 5000 });
    assert.equal(await page.evaluate(() => document.querySelector('main').inert), false);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'couple-names');
    assert.equal(await page.locator('[data-music-toggle]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.evaluate(() => window.__audioContexts[0].state), 'running');
    assert.equal(await page.locator('[data-petals] .petal').count(), 14);
    results.push('Opening: inert/focus restored; no autoplay before tap; actual AudioContext running after tap; 14 petals.');

    await page.locator('[data-music-toggle]').click();
    await page.waitForFunction(() => window.__audioContexts[0].state === 'suspended');
    assert.equal(await page.locator('[data-music-toggle]').getAttribute('aria-pressed'), 'false');
    await page.evaluate(() => {
      document.querySelector('[data-music-toggle]').click();
      document.querySelector('[data-music-toggle]').click();
    });
    await page.waitForFunction(() => window.__audioContexts[0].state === 'suspended');
    assert.equal(await page.locator('[data-music-toggle]').getAttribute('aria-pressed'), 'false');
    await page.locator('[data-music-toggle]').click();
    await page.waitForFunction(() => window.__audioContexts[0].state === 'running');
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForFunction(() => window.__audioContexts[0].state === 'suspended');
    assert.deepEqual(await page.evaluate(() => [...window.__activeIntervals.values()]), []);
    assert.equal(await page.locator('[data-petals]').evaluate(element => element.hidden), true);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    assert.equal(await page.locator('[data-music-toggle]').getAttribute('aria-pressed'), 'false');
    assert.deepEqual(await page.evaluate(() => [...window.__activeIntervals.values()]), [1000]);
    results.push('Visibility: music, countdown timer, and petals pause; countdown alone resumes when visible.');

    const canvas = page.locator('[data-scratch-canvas]').first();
    await canvas.scrollIntoViewIfNeeded();
    const box = await canvas.boundingBox();
    const before = await canvas.evaluate(element => element.toDataURL());
    await page.mouse.move(box.x + 10, box.y + 10);
    await page.mouse.move(box.x + box.width - 10, box.y + box.height - 10, { steps: 10 });
    assert.equal(await canvas.evaluate(element => element.toDataURL()), before);
    await page.mouse.move(box.x + 15, box.y + box.height * 0.25);
    await page.mouse.down();
    for (const [x, y] of [[0.85, 0.25], [0.15, 0.5], [0.85, 0.5], [0.15, 0.75], [0.85, 0.75]]) {
      await page.mouse.move(box.x + box.width * x, box.y + box.height * y, { steps: 8 });
    }
    await page.mouse.up();
    assert.match(await page.locator('.scratch-card').first().getAttribute('class'), /is-revealed/);
    await page.locator('[data-reveal-date]').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('.scratch-card.is-revealed').count(), 3);
    assert.match(await page.locator('.date-reveal').getAttribute('class'), /is-complete/);
    results.push('Scratch: hover does not erase; held pointer reveals; keyboard button reveals all three.');

    const countdownCases = await page.evaluate(async () => {
      const { remainingTime } = await import('/js/countdown.js');
      return {
        future: remainingTime(90061000, 0),
        past: remainingTime(0, 1000),
        invalid: remainingTime('invalid date', 0),
      };
    });
    assert.deepEqual(countdownCases.future, { days: 1, hours: 1, minutes: 1, seconds: 1, complete: false });
    assert.deepEqual(countdownCases.past, { days: 0, hours: 0, minutes: 0, seconds: 0, complete: true });
    assert.equal(countdownCases.invalid, null);
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
        writeText: async value => { window.__copiedLink = value; },
      } });
    });
    await page.locator('[data-share-invitation]').click();
    assert.match(await page.locator('[data-share-status]').textContent(), /copied/);
    assert.match(await page.evaluate(() => window.__copiedLink), /^http:\/\/localhost:8088\/?$/);
    results.push('Countdown: future boundaries, elapsed event, and invalid date handled; clipboard sharing works.');
    await context.close();

    const reduced = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', isMobile: true, hasTouch: true });
    const reducedPage = await reduced.newPage();
    reducedPage.on('pageerror', error => errors.push(error.message));
    await reducedPage.goto('http://localhost:8088', { waitUntil: 'networkidle' });
    await reducedPage.locator('[data-open-invitation]').click();
    await reducedPage.waitForSelector('#intro[hidden]', { state: 'attached', timeout: 1000 });
    assert.equal(await reducedPage.locator('[data-petals]').evaluate(element => element.hidden), true);
    assert.equal(await reducedPage.locator('.reveal:not(.is-visible)').count(), 0);
    assert.equal(await reducedPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    results.push('Reduced motion on 390px viewport: immediate opening, no petals, all content revealed, no horizontal overflow.');
    const touchCanvas = reducedPage.locator('[data-scratch-canvas]').first();
    await touchCanvas.scrollIntoViewIfNeeded();
    const touchBox = await touchCanvas.boundingBox();
    const session = await reduced.newCDPSession(reducedPage);
    const touchPoint = (x, y) => [{ x: touchBox.x + touchBox.width * x, y: touchBox.y + touchBox.height * y }];
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touchPoint(0.15, 0.25) });
    for (const [x, y] of [[0.85, 0.25], [0.15, 0.5], [0.85, 0.5], [0.15, 0.75], [0.85, 0.75]]) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: touchPoint(x, y) });
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.match(await reducedPage.locator('.scratch-card').first().getAttribute('class'), /is-revealed/);
    await reducedPage.reload({ waitUntil: 'networkidle' });
    await reducedPage.keyboard.press('Escape');
    assert.equal(await reducedPage.locator('#intro').isVisible(), false);
    assert.equal(await reducedPage.locator('[data-music-toggle]').getAttribute('aria-pressed'), 'false');
    results.push('Touch gesture scratches a mobile card; Escape skips the intro without starting music.');
    await reduced.close();

    const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
    const staticPage = await noJs.newPage();
    await staticPage.goto('http://localhost:8088', { waitUntil: 'networkidle' });
    assert.equal(await staticPage.locator('#intro').isVisible(), false);
    assert.equal(await staticPage.locator('#couple-names').isVisible(), true);
    assert.equal(await staticPage.locator('main').getAttribute('inert'), null);
    assert.equal(await staticPage.locator('[data-scratch-canvas]:visible').count(), 0);
    assert.equal(await staticPage.locator('[data-music-toggle]:visible, [data-reveal-date]:visible, [data-share-invitation]:visible').count(), 0);
    results.push('JavaScript disabled: intro stays hidden, hero and date remain available.');
    await noJs.close();

    const videoContext = await browser.newContext();
    await videoContext.addInitScript(() => {
      window.__videoMode = 'play';
      Object.defineProperty(HTMLVideoElement.prototype, 'src', {
        configurable: true,
        get() { return this.__testSource || ''; },
        set(value) { this.__testSource = value; },
      });
      HTMLVideoElement.prototype.play = function () {
        if (window.__videoMode === 'stall') return new Promise(() => {});
        if (window.__videoMode === 'reject') return Promise.reject(new Error('Unavailable video'));
        return Promise.resolve();
      };
      HTMLVideoElement.prototype.pause = function () {};
      HTMLVideoElement.prototype.load = function () {};
    });
    const videoPage = await videoContext.newPage();
    videoPage.on('pageerror', error => errors.push(error.message));
    await videoPage.route('http://localhost:8088/', async route => {
      const response = await route.fetch();
      const body = (await response.text()).replace(/data-intro-video data-src="[^"]*"/, 'data-intro-video data-src="assets/video/test.mp4"');
      await route.fulfill({ response, body });
    });
    await videoPage.goto('http://localhost:8088', { waitUntil: 'networkidle' });
    await videoPage.locator('[data-open-invitation]').click();
    await videoPage.waitForTimeout(1700);
    assert.equal(await videoPage.locator('#intro').isVisible(), true);
    assert.equal(await videoPage.locator('[data-intro-video]').isVisible(), true);
    await videoPage.locator('[data-intro-video]').evaluate(video => video.dispatchEvent(new Event('ended')));
    assert.equal(await videoPage.locator('#intro').isVisible(), false);
    await videoPage.reload({ waitUntil: 'networkidle' });
    await videoPage.evaluate(() => { window.__videoMode = 'stall'; });
    await videoPage.locator('[data-open-invitation]').click();
    await videoPage.waitForSelector('#intro[hidden]', { state: 'attached', timeout: 5500 });
    await videoPage.reload({ waitUntil: 'networkidle' });
    await videoPage.evaluate(() => { window.__videoMode = 'reject'; });
    await videoPage.locator('[data-open-invitation]').click();
    await videoPage.waitForSelector('#intro[hidden]', { state: 'attached', timeout: 1000 });
    results.push('Optional video: remains open past envelope timing; closes on ended; stalled load times out; rejected playback falls back.');
    await videoContext.close();

    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed: results, pageErrors: errors }, null, 2));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
