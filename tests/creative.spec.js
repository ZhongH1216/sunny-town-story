const { test, expect } = require('@playwright/test');

test('photo mode pauses time, prevents construction, allows panning and restores the previous pause state', async ({ page }) => {
  await page.goto('/?test=1');
  await page.waitForFunction(() => window.sunnyTownTest?.neighborhoods);
  await page.evaluate(() => window.sunnyTownTest.demo.startScenario('harbor'));
  const read = () => page.evaluate(() => window.sunnyTownTest.getState());
  const original = await read();
  expect(original.paused).toBe(false);
  await page.locator('#photoModeButton').click();
  await expect(page.locator('#photoModeBar')).toBeVisible();
  expect(await page.locator('.game-shell').evaluate(element => element.inert)).toBe(true);
  await page.keyboard.down('p');
  await page.keyboard.down('p');
  await page.keyboard.up('p');
  // One new press exits; the repeat must not immediately re-enter.
  await expect(page.locator('#photoModeBar')).toBeHidden();
  await page.keyboard.press('p');
  const paused = await read();
  await page.keyboard.press('b');
  await page.keyboard.press('Control+z');
  await page.mouse.click(720, 430);
  await page.mouse.move(730, 420);
  await page.mouse.down();
  await page.mouse.move(800, 440, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  const viewing = await read();
  expect(viewing.paused).toBe(true);
  expect(viewing.week).toBe(paused.week);
  expect(viewing.weekProgress).toBe(paused.weekProgress);
  expect(viewing.stats.money).toBe(paused.stats.money);
  expect(viewing.roadCount).toBe(paused.roadCount);
  expect(viewing.buildingCount).toBe(paused.buildingCount);
  expect(viewing.selectedTool).toBe(paused.selectedTool);
  expect(viewing.camera.target).not.toEqual(paused.camera.target);
  await page.keyboard.press('Escape');
  await expect(page.locator('#photoModeBar')).toBeHidden();
  expect((await read()).paused).toBe(false);
  expect(await page.locator('.game-shell').evaluate(element => element.inert)).toBe(false);
  await page.locator('#pauseButton').click();
  await page.keyboard.press('p');
  await expect(page.locator('#photoModeBar')).toBeVisible();
  await page.locator('#photoModeExitButton').click();
  expect((await read()).paused).toBe(true);
});

test('clicking an upgraded roof selects and demolishes that building, not the ground behind it', async ({ page }) => {
  await page.goto('/?test=1');
  await page.waitForFunction(() => window.sunnyTownTest?.photo);
  const position = await page.evaluate(() => {
    const game = window.sunnyTownTest;
    const save = game.serializeGame();
    Object.assign(save.city, {
      demo: null, life: null, neighborhoods: null, population: 0,
      buildings: [{ id: 'roof-house', type: 'residential', x: 8, z: 8, level: 3 }],
      tiles: [{ x: 8, z: 9, roadTier: 'lane' }],
    });
    if (!game.loadSave(save)) throw new Error('Roof fixture must be valid');
    game.recompute();
    return { x: 8, z: 8 };
  });
  await page.waitForTimeout(200);
  const roof = await page.evaluate(({ x, z }) => window.sunnyTownTest.projectTile(x, z, 2.55), position);
  await page.mouse.click(roof.x, roof.y);
  expect(await page.evaluate(() => window.sunnyTownTest.getState().selectedTile)).toEqual(position);
  await expect(page.locator('#selectedTitle')).toContainText('住宅 Lv.3');
  await page.locator('[data-tool=bulldoze]').click();
  await page.mouse.click(roof.x, roof.y);
  expect(await page.evaluate(() => window.sunnyTownTest.getState().buildingCount)).toBe(0);
  expect(await page.evaluate(() => window.sunnyTownTest.getState().roadCount)).toBe(1);
});

test('a saved neighborhood keeps its one-time reward and only pays visitors during weekly settlement', async ({ page }) => {
  await page.goto('/?test=1');
  await page.waitForFunction(() => window.sunnyTownTest?.neighborhoods);
  await page.evaluate(() => {
    const game = window.sunnyTownTest;
    const save = game.serializeGame();
    Object.assign(save.city, {
      demo: null, life: null, neighborhoods: null, population: 120, chapterIndex: 2,
      activeEvents: [], buildings: [
        { id: 'park', type: 'park', x: 7, z: 8, level: 1 },
        { id: 'home1', type: 'residential', x: 6, z: 8, level: 1 },
        { id: 'home2', type: 'residential', x: 8, z: 8, level: 1 },
      ],
      tiles: Array.from({ length: 5 }, (_, i) => ({ x: 5 + i, z: 9, roadTier: 'lane' })),
    });
    game.loadSave(save);
  });
  await page.locator('#neighborhoodOpenButton').click();
  await expect(page.locator('[data-journal-page=guide]')).toBeVisible();
  await expect(page.locator('[data-neighborhood=garden] .neighborhood-stars')).toHaveAttribute('aria-label', '1 星');
  const before = await page.evaluate(() => window.sunnyTownTest.getState());
  await page.locator('[data-neighborhood-claim=garden]').click();
  const reward = await page.evaluate(() => window.sunnyTownTest.getState());
  expect(reward.stats.money - before.stats.money).toBe(600);
  await expect(page.locator('[data-neighborhood-claim=garden]')).toBeDisabled();
  const result = await page.evaluate(() => {
    const game = window.sunnyTownTest;
    const saved = game.serializeGame();
    game.loadSave(saved);
    const money = game.getState().stats.money;
    for (let i = 0; i < 6; i++) { game.neighborhoods.render(); game.neighborhoods.weekIncome(); }
    const afterReads = game.getState().stats.money;
    const claimAgain = game.neighborhoods.claim('garden');
    game.advanceWeek(1);
    return { saved: saved.city.neighborhoods, money, afterReads, claimAgain, report: game.getState().report };
  });
  expect(result.saved.claimed).toEqual(['garden']);
  expect(result.money).toBe(result.afterReads);
  expect(result.claimAgain).toBe(false);
  expect(result.report.visitors).toBe(35);
});

test('desktop creative controls remain reachable at 1280 x 720', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  await page.locator('#startDemoButton').click();
  for (const selector of ['#photoModeButton', '#neighborhoodOpenButton', '[data-tool=bulldoze]', '#pauseButton', '#saveButton']) {
    const box = await page.locator(selector).boundingBox();
    expect(box, selector).toBeTruthy();
    expect(box.x, selector).toBeGreaterThanOrEqual(0);
    expect(box.y, selector).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, selector).toBeLessThanOrEqual(1280);
    expect(box.y + box.height, selector).toBeLessThanOrEqual(720);
  }
  await page.locator('#neighborhoodOpenButton').click();
  await expect(page.locator('#neighborhoodBoard')).toBeVisible();
  const firstCard = await page.locator('[data-neighborhood=garden]').boundingBox();
  const scroller = await page.locator('.journal-pages').boundingBox();
  expect(firstCard.y + Math.min(120, firstCard.height)).toBeLessThanOrEqual(scroller.y + scroller.height);
  await page.screenshot({ path: 'test-results/demo-4-neighborhoods-1280.png' });
});
