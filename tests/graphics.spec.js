const { test, expect } = require('@playwright/test');

test('the graphics context survives normal launch and a populated town reload', async ({ page }) => {
  await page.goto('/?test=1');
  await page.waitForFunction(() => window.sunnyTownTest);
  const context = () => page.locator('#scene').evaluate(c => { const gl = c.getContext('webgl2'); return { lost: gl.isContextLost(), error: gl.getError(), renderer: gl.getParameter(gl.RENDERER) }; });
  await page.waitForTimeout(350);
  expect((await context()).lost).toBe(false);
  await page.evaluate(() => window.sunnyTownTest.demo.startScenario('garden'));
  await page.waitForTimeout(350);
  expect((await context()).lost).toBe(false);
});

test('a lost graphics context exits photo mode, stops simulation, offers backup and resumes after restoration', async ({ page }) => {
  await page.goto('/?test=1');
  await page.waitForFunction(() => window.sunnyTownTest?.life);
  await page.evaluate(() => {
    window.sunnyTownTest.demo.startScenario('harbor');
    window.sunnyTownTest.photo.enter();
    window.testGraphicsExtension = document.querySelector('#scene').getContext('webgl2').getExtension('WEBGL_lose_context');
    window.testGraphicsExtension.loseContext();
  });
  await expect(page.locator('#graphicsRecovery')).toBeVisible();
  await expect(page.locator('#photoModeBar')).toBeHidden();
  const before = await page.evaluate(() => window.sunnyTownTest.getState());
  expect(before.photoMode).toBe(false);
  expect(before.paused).toBe(false); // Preserve the running state from before photo mode.
  await page.waitForTimeout(400);
  await page.keyboard.press('2');
  const after = await page.evaluate(() => window.sunnyTownTest.getState());
  expect(after.weekProgress).toBe(before.weekProgress);
  expect(after.week).toBe(before.week);
  expect(after.stats.money).toBe(before.stats.money);
  expect(after.rendering.frames).toBe(before.rendering.frames);
  const download = page.waitForEvent('download');
  await page.locator('#backupGraphics').click();
  expect((await download).suggestedFilename()).toContain('sunny-town-week-');
  await page.locator('#retryGraphics').click();
  await expect(page.locator('#graphicsRecovery')).not.toBeVisible();
  await expect.poll(async () => (await page.evaluate(() => window.sunnyTownTest.getState())).rendering.frames).toBeGreaterThan(after.rendering.frames);
  expect(await page.locator('#scene').evaluate(c => c.getContext('webgl2').isContextLost())).toBe(false);
});
