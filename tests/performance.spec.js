const { test, expect } = require('@playwright/test');

test('loading an existing power preference preserves it and old saves without one use balanced', async ({ page }) => {
  await page.goto('/?test=1');
  await page.waitForFunction(() => window.sunnyTownTest?.demo);
  const modes = await page.evaluate(() => {
    const game = window.sunnyTownTest;
    const results = [];
    for (const mode of ['eco', 'smooth', undefined]) {
      const save = game.serializeGame();
      save.city.settings.performance = mode;
      const accepted = game.loadSave(save);
      results.push({ accepted, mode: game.getState().settings.performance });
    }
    return results;
  });
  expect(modes).toEqual([{ accepted: true, mode: 'eco' }, { accepted: true, mode: 'smooth' }, { accepted: true, mode: 'balanced' }]);
});

test('new towns default to balanced 30 fps, pause lowers it, and hidden pages stop drawing and simulation', async ({ page }) => {
  await page.goto('/?test=1');
  await page.waitForFunction(() => window.sunnyTownTest?.demo);
  const read = () => page.evaluate(() => window.sunnyTownTest.getState());
  // Keep both observations and the clock in the page: CDP round trips and a
  // delayed timer otherwise make a nominal one-second window longer in CI.
  const sample = (durationMs) => page.evaluate(async (duration) => {
    const snapshot = () => {
      const state = window.sunnyTownTest.getState();
      return {
        now: performance.now(), frames: state.rendering.frames,
        targetFps: state.rendering.targetFps, hidden: state.rendering.hidden,
        paused: state.paused, week: state.week, weekProgress: state.weekProgress,
      };
    };
    const before = snapshot();
    await new Promise(resolve => setTimeout(resolve, duration));
    const after = snapshot();
    return { before, after, elapsedMs: after.now - before.now, frames: after.frames - before.frames };
  }, durationMs);
  const expectCapped = (measured, fps) => {
    // An arbitrary sampling window can include one partial frame interval.
    // The rate remains 30/10 fps; the budget follows actual elapsed time.
    const frameBudget = Math.floor(measured.elapsedMs * fps / 1000) + 1;
    const detail = `${measured.frames} frames over ${measured.elapsedMs.toFixed(1)} ms at ${fps} fps (budget ${frameBudget})`;
    expect(measured.before.targetFps, detail).toBe(fps);
    expect(measured.after.targetFps, detail).toBe(fps);
    expect(measured.frames, detail).toBeGreaterThan(0);
    expect(measured.frames, detail).toBeLessThanOrEqual(frameBudget);
    console.log(`[render acceptance] ${detail}`);
  };
  const initial = await read();
  expect(initial.settings.performance).toBe('balanced');
  expect(initial.rendering.pixelRatio).toBeLessThanOrEqual(1.25);
  await page.waitForFunction(() => window.sunnyTownTest.getState().rendering.targetFps === 30);
  expectCapped(await sample(1500), 30);
  await page.locator('#pauseButton').click();
  // Pointer interaction intentionally boosts rendering for 220 ms. Observe
  // the completed transition instead of sampling after only a fixed 180 ms.
  await page.waitForFunction(() => {
    const state = window.sunnyTownTest.getState();
    return state.paused && state.rendering.targetFps === 10;
  });
  const paused = await sample(1000);
  expectCapped(paused, 10);
  expect(paused.before.paused).toBe(true);
  expect(paused.after.paused).toBe(true);
  // Emulate the browser visibility transition without another rendering process.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const hidden = await sample(550);
  expect(hidden.frames).toBe(0);
  expect(hidden.after.week).toBe(hidden.before.week);
  expect(hidden.after.weekProgress).toBe(hidden.before.weekProgress);
  expect(hidden.before.hidden).toBe(true);
  expect(hidden.after.hidden).toBe(true);
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(async () => (await read()).rendering.frames).toBeGreaterThan(hidden.after.frames);
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

test('a dense town and its service layer keep rendering submissions bounded', async ({ page }) => {
  await page.goto('/?test=1');
  await page.waitForFunction(() => window.sunnyTownTest?.demo);
  const loaded = await page.evaluate(() => {
    const game = window.sunnyTownTest;
    if (!game.getState().paused) document.getElementById('pauseButton').click();
    const save = game.serializeGame();
    const roads = [], buildings = [];
    for (let z = 1; z <= 16; z += 1) for (let x = 1; x <= 16; x += 1) {
      if (z % 3 === 2 || x === 1) roads.push({ x, z, roadTier: x % 3 === 0 ? 'avenue' : 'lane' });
      else buildings.push({ id: `performance-${x}-${z}`, type: ['residential', 'commercial', 'park', 'water', 'power'][(x + z) % 5], x, z, level: 1, age: 10 });
    }
    Object.assign(save.city, { tiles: roads, buildings, population: 400, week: 51, demo: null, life: null, completed: true });
    return game.loadSave(save);
  });
  expect(loaded).toBe(true);
  await page.waitForTimeout(300);
  const normal = await page.evaluate(() => window.sunnyTownTest.getState());
  expect(normal.buildingCount).toBeGreaterThan(100);
  expect(normal.rendering.calls).toBeLessThan(400);
  await page.locator('[data-view="services"]').click();
  await page.waitForTimeout(200);
  const services = await page.evaluate(() => window.sunnyTownTest.getState());
  expect(services.rendering.calls).toBeLessThan(normal.rendering.calls + 10);
  expect(services.rendering.geometries).toBeLessThan(450);
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
  await page.locator('#performanceSelect').selectOption('eco');
  await page.locator('#townMenuButton').click();
  await page.locator('[data-scenario="garden"]').click();
  await page.locator('#startDemoButton').click();
  await expect(page.locator('#demoModal')).toBeVisible();
  await page.locator('#demoModalActions button').filter({ hasText: '开启新旅程' }).click();
  await expect(page.locator('#welcomeOverlay')).toBeHidden();
  await expect(page.locator('#demoScenarioName')).toContainText('花见町');
  await expect(page.locator('#pauseButton')).toContainText('暂停');
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('sunny-town-story.save.v1')));
  expect(save.city.settings.performance).toBe('eco');
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
