const { test, expect } = require('@playwright/test');

test('eco mode caps rendering, pause lowers it, and hidden pages stop drawing and simulation', async ({ page }) => {
  await page.goto('/?test=1');
  await page.waitForFunction(() => window.sunnyTownTest?.demo);
  const read = () => page.evaluate(() => window.sunnyTownTest.getState());
  let before = await read();
  expect(before.settings.performance).toBe('eco');
  expect(before.rendering.pixelRatio).toBeLessThanOrEqual(1);
  await page.waitForTimeout(1500);
  let after = await read();
  expect(after.rendering.frames - before.rendering.frames).toBeLessThanOrEqual(38);
  expect(after.rendering.frames - before.rendering.frames).toBeGreaterThan(0);
  await page.locator('#pauseButton').click();
  await page.waitForTimeout(180);
  before = await read();
  await page.waitForTimeout(1000);
  after = await read();
  expect(after.rendering.targetFps).toBe(10);
  expect(after.rendering.frames - before.rendering.frames).toBeLessThanOrEqual(12);
  // Emulate the browser visibility transition without another rendering process.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  before = await read();
  await page.waitForTimeout(550);
  after = await read();
  expect(after.rendering.frames).toBe(before.rendering.frames);
  expect(after.week).toBe(before.week);
  expect(after.rendering.hidden).toBe(true);
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(async () => (await read()).rendering.frames).toBeGreaterThan(after.rendering.frames);
});

test('repeated town rebuilds release old graphics and keep effect counts bounded', async ({ page }) => {
  await page.goto('/?test=1');
  await page.waitForFunction(() => window.sunnyTownTest?.demo);
  await page.evaluate(() => window.sunnyTownTest.demo.startScenario('harbor'));
  await page.waitForTimeout(1700);
  const baseline = await page.evaluate(() => window.sunnyTownTest.getState());
  await page.evaluate(() => {
    const t = window.sunnyTownTest;
    for (let i = 0; i < 12; i += 1) {
      t.place('road', 3, 9);
      t.place('residential', 3, 8);
      t.demo.startScenario('harbor');
    }
  });
  await page.waitForTimeout(1800);
  const after = await page.evaluate(() => window.sunnyTownTest.getState());
  expect(after.effectCount).toBeLessThanOrEqual(96);
  expect(after.art.decoratedBuildings).toBe(after.buildingCount);
  expect(after.rendering.geometries).toBeLessThanOrEqual(baseline.rendering.geometries + 16);
  expect(after.rendering.textures).toBeLessThanOrEqual(baseline.rendering.textures + 6);
  expect(after.rendering.calls).toBeLessThan(300);
});

test('the normal player menu confirms a new journey and resumes it at the selected power setting', async ({ page }) => {
  await page.addInitScript(() => {
    window.audioActivity = { resumes: 0, tones: 0 };
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    const resume = AudioCtor.prototype.resume;
    const createOscillator = AudioCtor.prototype.createOscillator;
    AudioCtor.prototype.resume = function (...args) {
      window.audioActivity.resumes += 1;
      return resume.apply(this, args);
    };
    AudioCtor.prototype.createOscillator = function (...args) {
      window.audioActivity.tones += 1;
      return createOscillator.apply(this, args);
    };
  });
  await page.goto('/');
  await expect(page.locator('#welcomeOverlay')).toBeVisible();
  await page.locator('#startDemoButton').click();
  await expect(page.locator('#welcomeOverlay')).toBeHidden();
  await page.locator('summary').filter({ hasText: '存档管理' }).click();
  await page.locator('#performanceSelect').selectOption('balanced');
  await page.locator('#townMenuButton').click();
  await page.locator('[data-scenario="garden"]').click();
  await page.locator('#startDemoButton').click();
  await expect(page.locator('#demoModal')).toBeVisible();
  await page.locator('#demoModalActions button').filter({ hasText: '开启新旅程' }).click();
  await expect(page.locator('#welcomeOverlay')).toBeHidden();
  await expect(page.locator('#demoScenarioName')).toContainText('花见町');
  await expect(page.locator('#pauseButton')).toContainText('暂停');
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('sunny-town-story.save.v1')));
  expect(save.city.settings.performance).toBe('balanced');
  expect(save.city.demo.scenario).toBe('garden');
  // The click queues an audio cue. Hiding in the same task must prevent that
  // deferred cue from waking WebAudio after the visibility handler suspends it.
  const hiddenAudio = await page.evaluate(() => {
    document.querySelector('#pauseButton').click();
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    return { ...window.audioActivity };
  });
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.audioActivity)).toEqual(hiddenAudio);
});
