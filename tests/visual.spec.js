const { test, expect } = require("@playwright/test");

async function canvasSignal(page) {
  return page.locator("#scene").evaluate((canvas) => {
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!gl) return 0;
    const pixels = new Uint8Array(4 * 120 * 120);
    const x = Math.max(0, Math.floor(canvas.width / 2 - 60));
    const y = Math.max(0, Math.floor(canvas.height / 2 - 60));
    gl.readPixels(x, y, 120, 120, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let signal = 0;
    for (let i = 0; i < pixels.length; i += 4) signal += pixels[i] + pixels[i + 1] + pixels[i + 2];
    return signal;
  });
}

async function assertFrame(page, viewport, name) {
  await page.setViewportSize(viewport);
  await page.goto("/?test=1");
  await page.waitForTimeout(1400);
  await expect(page.locator(".top-hud")).toBeVisible();
  await expect(page.locator(".build-panel")).toBeVisible();
  await expect(page.locator(".advisor-panel")).toBeVisible();
  await expect(page.locator(".bottom-bar")).toBeVisible();
  await expect(page.locator("#scene")).toBeVisible();
  await page.locator("#helpButton").click();
  await expect(page.locator("#helpOverlay")).toBeVisible();
  await expect(page.locator("#helpOverlay")).toContainText("晴日建设手册");
  await expect(await canvasSignal(page)).toBeGreaterThan(1000);
  await page.screenshot({ path: `test-results/visual-${name}.png`, fullPage: true });
}

test("P4 visual regression frames render on desktop breakpoints", async ({ page }) => {
  await assertFrame(page, { width: 1440, height: 900 }, "1440x900");
  await assertFrame(page, { width: 1366, height: 768 }, "1366x768");
});
