const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  page.gameErrors = [];
  page.on('pageerror', error => page.gameErrors.push(error.message));
  await page.goto('/?test=1');
  await page.waitForFunction(() => window.sunnyTownTest?.life);
  await page.evaluate(() => {
    const g = window.sunnyTownTest;
    const types = [
      ['power', 4, 8, 3], ['power', 5, 8, 3], ['water', 4, 10, 3], ['water', 5, 10, 3],
      ['park', 6, 8, 1], ['residential', 7, 8, 1], ['residential', 8, 8, 1],
      ['commercial', 9, 8, 1], ['commercial', 10, 8, 1], ['park', 11, 8, 1],
      ['commercial', 6, 10, 1], ['commercial', 11, 10, 1],
      ['school', 7, 10, 1], ['fire', 8, 10, 1], ['plaza', 9, 10, 1], ['lantern', 10, 10, 1],
    ];
    g.loadSave({ version: 3, city: {
      week: 1, population: 40, money: 30000, demo: { scenario: 'harbor' },
      tiles: Array.from({ length: 12 }, (_, i) => ({ x: i + 3, z: 9, roadTier: 'avenue' })),
      buildings: types.map(([type, x, z, level], i) => ({ id: `life-${i}`, type, x, z, level })),
      settings: { muted: true, music: false, performance: 'eco' },
    } });
    if (!g.getState().paused) document.getElementById('pauseButton').click();
    window.sunnyTownUI.activatePanel('life');
    window.finishSeason = () => {
      if (!g.life.start(0)) throw new Error(`Cannot start: ${JSON.stringify(g.life.getState())}`);
      g.advanceWeek(2);
      if (!g.life.claim()) throw new Error(`Activity did not qualify: ${JSON.stringify({ life: g.life.getState(), stats: g.getState().stats })}`);
    };
  });
});

test.afterEach(async ({ page }) => {
  expect(page.gameErrors).toEqual([]);
  expect(await page.locator('#scene').evaluate(c => c.getContext('webgl2').isContextLost())).toBe(false);
});

test('activities charge once, count only qualifying simulation weeks and persist an unclaimed reward', async ({ page }) => {
  const result = await page.evaluate(() => {
    const g = window.sunnyTownTest;
    const before = g.getState().stats.money;
    const started = g.life.start(0);
    const afterStart = g.getState().stats.money;
    const repeated = g.life.start(1);
    for (let i = 0; i < 4; i++) g.recompute();
    const unchanged = g.life.getState();
    g.advanceWeek();
    const half = g.life.getState();
    const saved = g.serializeGame();
    g.loadSave(saved);
    const restored = g.life.getState();
    g.advanceWeek();
    const ready = g.life.getState();
    const readySave = g.serializeGame();
    g.loadSave(readySave);
    const rewardMoney = g.getState().stats.money;
    const claimed = g.life.claim();
    const afterClaim = g.getState().stats.money;
    const duplicate = g.life.claim();
    const repeatSeason = g.life.start(0);
    return { before, started, afterStart, repeated, unchanged, half, restored, ready, rewardMoney, claimed, afterClaim, duplicate, repeatSeason, final: g.life.getState() };
  });
  expect(result.started).toBe(true);
  expect(result.afterStart).toBe(result.before - 600);
  expect(result.repeated).toBe(false);
  expect(result.unchanged.active.progress).toBe(0);
  expect(result.half.active.progress).toBe(1);
  expect(result.restored.active).toEqual(result.half.active);
  expect(result.ready.active.progress).toBe(2);
  expect(result.claimed).toBe(true);
  expect(result.afterClaim).toBe(result.rewardMoney + 1400);
  expect(result.duplicate).toBe(false);
  expect(result.repeatSeason).toBe(false);
  expect(result.final).toMatchObject({ reputation: 2, completed: 1, souvenirs: ['picnic'], active: null });
  await expect(page.locator('#townMemories')).toContainText('樱花书签');
});

test('missing services block progress; deadline and cancellation recover without duplicate offers', async ({ page }) => {
  const result = await page.evaluate(() => {
    const g = window.sunnyTownTest;
    g.life.start(0);
    for (const b of g.getState().buildings.filter(b => b.type === 'water')) g.place('bulldoze', b.x, b.z);
    g.advanceWeek(5);
    const beforeDeadline = g.life.getState();
    g.advanceWeek();
    const afterDeadline = g.life.getState();
    const claimed = g.life.claim(), duplicate = g.life.start(0);
    g.advanceWeek(6);
    const nextSeason = g.life.getState();
    const accepted = g.life.start(0);
    const afterStartMoney = g.getState().stats.money;
    const cancelled = g.life.cancel(), repeatedCancel = g.life.cancel();
    return { beforeDeadline, afterDeadline, claimed, duplicate, nextSeason, accepted, cancelled, repeatedCancel, afterStartMoney, money: g.getState().stats.money };
  });
  expect(result.beforeDeadline.active.progress).toBe(0);
  expect(result.afterDeadline.active).toBeNull();
  expect(result.afterDeadline.memories.at(-1).outcome).toBe('missed');
  expect(result.claimed).toBe(false);
  expect(result.duplicate).toBe(false);
  expect(result.nextSeason.offer).toBe('market');
  expect(result.accepted).toBe(true);
  expect(result.cancelled).toBe(true);
  expect(result.repeatedCancel).toBe(false);
  expect(result.money).toBe(result.afterStartMoney);
});

test('earned reputation unlocks mutually exclusive projects with real service and fiscal effects', async ({ page }) => {
  const result = await page.evaluate(() => {
    const g = window.sunnyTownTest;
    const locked = g.life.chooseProject('coast', 0);
    window.finishSeason();
    const before = g.getState();
    const baseline = g.serializeGame();
    const built = g.life.chooseProject('coast', 0);
    const shaded = g.getState();
    const duplicate = g.life.chooseProject('coast', 1);
    const saved = g.serializeGame();
    g.loadSave(saved);
    const restored = g.getState();
    g.loadSave(baseline);
    const shops = g.life.chooseProject('coast', 1);
    const trading = g.getState();
    g.setMoney(0);
    const moneyBefore = g.getState().stats.money;
    const unaffordable = g.life.start(0);
    return { locked, before, built, shaded, duplicate, restored, shops, trading, unaffordable, moneyBefore, moneyAfter: g.getState().stats.money };
  });
  expect(result.locked).toBe(false);
  expect(result.built).toBe(true);
  expect(result.shaded.stats.money).toBe(result.before.stats.money - 4000);
  expect(result.shaded.stats.servicePressure.park.capacity).toBeGreaterThan(result.before.stats.servicePressure.park.capacity);
  expect(result.duplicate).toBe(false);
  expect(result.restored.stats.servicePressure.park.capacity).toBe(result.shaded.stats.servicePressure.park.capacity);
  expect(result.shops).toBe(true);
  expect(result.trading.stats.income).toBeGreaterThan(result.before.stats.income);
  expect(result.unaffordable).toBe(false);
  expect(result.moneyAfter).toBe(result.moneyBefore);
});

test('four seasons award a collection once, and long-term memories stay bounded', async ({ page }) => {
  const result = await page.evaluate(() => {
    const g = window.sunnyTownTest;
    const claims = [];
    for (let cycle = 0; cycle < 16; cycle++) {
      const delta = cycle * 12 + 1 - g.getState().week;
      if (delta > 0) g.advanceWeek(delta);
      if (!g.life.start(0)) throw new Error(`Cannot accept cycle ${cycle}`);
      g.advanceWeek(2);
      const before = g.getState().stats.money;
      if (!g.life.claim()) throw new Error(`Cannot finish cycle ${cycle}: ${JSON.stringify(g.getState().stats)}`);
      claims.push(g.getState().stats.money - before);
    }
    const earned = g.life.getState();
    const beforeProject = g.getState();
    const recycle = g.life.chooseProject('workshop', 0);
    const afterProject = g.getState();
    const save = g.serializeGame();
    g.loadSave(save);
    return { claims, earned, beforeProject, recycle, afterProject, restored: g.life.getState(), effects: g.getState().effectCount };
  });
  expect(result.claims.slice(0, 4)).toEqual([1400, 2000, 1900, 7100]);
  expect(result.claims.slice(4, 8)).toEqual([1400, 2000, 1900, 2100]);
  expect(result.earned.souvenirs).toHaveLength(4);
  expect(result.earned.memories).toHaveLength(12);
  expect(result.earned.completed).toBe(16);
  expect(result.recycle).toBe(true);
  expect(result.afterProject.stats.maintenance).toBeLessThan(result.beforeProject.stats.maintenance);
  expect(result.restored.projects).toEqual([{ id: 'workshop', choice: 0 }]);
  expect(result.effects).toBeLessThanOrEqual(96);
});

test('activity and project controls work through the journal and confirmation dialogs', async ({ page }) => {
  await page.locator('[data-life-action="start"]').first().click();
  await expect(page.locator('#seasonActivity')).toContainText('累计达标 0/2 周');
  await page.locator('[data-life-action="cancel"]').click();
  await expect(page.locator('#demoModal')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#demoModal')).not.toBeVisible();
  await expect(page.locator('#seasonActivity')).toContainText('累计达标 0/2 周');
  await page.evaluate(() => window.sunnyTownTest.advanceWeek(2));
  await page.locator('[data-life-action="claim"]').click();
  await page.locator('[data-project="coast"]').first().click();
  await expect(page.locator('#demoModalText')).toContainText('永久采用');
  await page.locator('#demoModalActions button').filter({ hasText: '建设这个方案' }).click();
  await expect(page.locator('#communityProjects')).toContainText('已建成 · 树荫散步道');
  const frame = await page.evaluate(() => window.sunnyTownTest.getState().rendering.frames);
  await page.waitForFunction(previous => window.sunnyTownTest.getState().rendering.frames > previous + 1, frame);
  await page.screenshot({ path: 'test-results/town-life.png' });
});
