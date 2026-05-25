const { test, expect } = require("@playwright/test");

async function canvasSignal(page) {
  return page.locator("#scene").evaluate((canvas) => {
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!gl) return 0;
    const pixels = new Uint8Array(4 * 90 * 90);
    const x = Math.max(0, Math.floor(canvas.width / 2 - 45));
    const y = Math.max(0, Math.floor(canvas.height / 2 - 45));
    gl.readPixels(x, y, 90, 90, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let signal = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      signal += pixels[i] + pixels[i + 1] + pixels[i + 2];
    }
    return signal;
  });
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
});

test("sunny town renders a desktop 3D city builder", async ({ page }) => {
  await page.goto("/?test=1");
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.locator("[data-tool='road']")).toBeVisible();
  await expect(page.locator("#scene")).toBeVisible();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "test-results/sunny-town-desktop.png", fullPage: true });
  await expect(await canvasSignal(page)).toBeGreaterThan(1000);
});

test("toolbar can place roads, homes, shops and parks", async ({ page }) => {
  await page.goto("/?test=1");
  const before = await page.evaluate(() => window.sunnyTownTest.getState());
  await page.evaluate(() => {
    window.sunnyTownTest.place("road", 2, 2);
    window.sunnyTownTest.place("residential", 2, 3);
    window.sunnyTownTest.place("commercial", 3, 2);
    window.sunnyTownTest.place("park", 1, 2);
  });
  const after = await page.evaluate(() => window.sunnyTownTest.getState());
  expect(after.roadCount).toBeGreaterThan(before.roadCount);
  expect(after.buildingCount).toBeGreaterThan(before.buildingCount);
});

test("residential growth near road increases population and tax base", async ({ page }) => {
  await page.goto("/?test=1");
  const before = await page.evaluate(() => window.sunnyTownTest.getState().stats);
  await page.evaluate(() => {
    window.sunnyTownTest.place("road", 4, 4);
    window.sunnyTownTest.place("power", 4, 5);
    window.sunnyTownTest.place("water", 5, 4);
    window.sunnyTownTest.place("residential", 3, 4);
    window.sunnyTownTest.place("residential", 4, 3);
    window.sunnyTownTest.advanceWeek(6);
  });
  const after = await page.evaluate(() => window.sunnyTownTest.getState().stats);
  expect(after.population).toBeGreaterThan(before.population);
  expect(after.income).toBeGreaterThan(before.income);
});

test("advisor reports missing utilities", async ({ page }) => {
  await page.goto("/?test=1");
  await expect(page.locator("#advisorList")).toContainText(/\u7535\u529b\u4e0d\u8db3|\u4f9b\u6c34\u4e0d\u8db3/);
});

test("park and school improve town happiness or coverage", async ({ page }) => {
  await page.goto("/?test=1");
  await page.evaluate(() => {
    window.sunnyTownTest.place("road", 10, 10);
    window.sunnyTownTest.place("residential", 10, 11);
    window.sunnyTownTest.place("power", 10, 9);
    window.sunnyTownTest.place("water", 9, 10);
    window.sunnyTownTest.advanceWeek(2);
  });
  const before = await page.evaluate(() => window.sunnyTownTest.getState().stats);
  await page.evaluate(() => {
    window.sunnyTownTest.place("road", 12, 10);
    window.sunnyTownTest.place("road", 8, 10);
    window.sunnyTownTest.place("park", 12, 11);
    window.sunnyTownTest.place("school", 8, 11);
    window.sunnyTownTest.advanceWeek(3);
  });
  const after = await page.evaluate(() => window.sunnyTownTest.getState().stats);
  expect(after.education).toBeGreaterThan(before.education);
  expect(after.happiness).toBeGreaterThanOrEqual(before.happiness);
});

test("expensive tools disable when money is too low", async ({ page }) => {
  await page.goto("/?test=1");
  await page.evaluate(() => window.sunnyTownTest.setMoney(100));
  await expect(page.locator("[data-tool='school']")).toBeDisabled();
  await expect(page.locator("[data-tool='road']")).toBeEnabled();
});
