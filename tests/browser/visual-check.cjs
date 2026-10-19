const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { startServer, launch, resultsDirectory } = require("./helpers.cjs");

(async () => {
  const server = await startServer();
  let browser;
  const reports = [];
  fs.mkdirSync(resultsDirectory, { recursive: true });
  try {
    browser = await launch();
    for (const [label, width, height] of [
      ["desktop", 1440, 1000],
      ["mobile", 390, 844],
      ["small", 320, 740],
    ]) {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("response", (response) => {
        if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
      });
      await page.goto(server.url, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: path.join(resultsDirectory, `${label}-intro.png`) });
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("main > section").first().getAttribute("id"), "our-date");
      assert.equal(await page.locator(".invitation-card, #couple-names").count(), 0);
      assert.equal(await page.evaluate(() => document.activeElement.id), "date-heading");
      const heading = await page.locator("#date-heading").boundingBox();
      assert.ok(
        heading.y >= 0 && heading.y + heading.height <= height,
        `${label}: Save the date is in the opening viewport`,
      );
      await page.screenshot({ path: path.join(resultsDirectory, `${label}-date.png`) });
      assert.equal(
        await page.locator("[data-local-time]").getAttribute("datetime"),
        await page.locator("[data-countdown]").getAttribute("data-date"),
      );
      assert.equal(await page.locator(".wedding-summary, .event-actions").count(), 0);
      for (const text of await page.locator(".event-time, .venue-date").allInnerTexts()) {
        assert.doesNotMatch(text, /GMT|UTC/);
      }
      const fullHeight = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < fullHeight; y += 650) {
        await page.evaluate((top) => scrollTo({ top, behavior: "instant" }), y);
        await page.waitForTimeout(70);
      }
      await page.waitForTimeout(900);
      await page.screenshot({
        path: path.join(resultsDirectory, `${label}-full.png`),
        fullPage: true,
      });
      const metrics = await page.evaluate(() => ({
        width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        brokenImages: [...document.images]
          .filter((image) => !image.complete || image.naturalWidth === 0)
          .map((image) => image.src),
        unseen: document.querySelectorAll(".reveal:not(.is-visible)").length,
        fontBytes: performance
          .getEntriesByType("resource")
          .filter((entry) => entry.name.endsWith(".woff2"))
          .reduce((sum, entry) => sum + entry.encodedBodySize, 0),
        resourceBytes: performance
          .getEntriesByType("resource")
          .reduce((sum, entry) => sum + entry.encodedBodySize, 0),
        navigationFontSize: parseFloat(
          getComputedStyle(document.querySelector(".site-header nav a")).fontSize,
        ),
      }));
      reports.push({ label, errors, ...metrics });
      assert.deepEqual(errors, [], `${label}: no browser or asset errors`);
      assert.deepEqual(metrics.brokenImages, [], `${label}: all images load`);
      assert.ok(metrics.scrollWidth <= width, `${label}: no horizontal overflow`);
      assert.equal(metrics.unseen, 0, `${label}: all content can be revealed`);
      assert.ok(metrics.navigationFontSize >= 12, `${label}: readable navigation`);
      assert.ok(
        metrics.fontBytes > 0 && metrics.fontBytes < 542680,
        "WOFF2 fonts are smaller than the original WOFF files",
      );
      await page.close();
    }
    console.log(JSON.stringify({ visualChecks: reports }, null, 2));
  } finally {
    fs.writeFileSync(
      path.join(resultsDirectory, "visual-report.json"),
      JSON.stringify(reports, null, 2),
    );
    await browser?.close();
    await server.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
