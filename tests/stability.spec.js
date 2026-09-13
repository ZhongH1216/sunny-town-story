const { test, expect } = require("@playwright/test");

// Reuse one page/WebGL context for this suite. The parent runner executes it
// serially, and every case starts from the same small, valid neighborhood.
test.describe.configure({ mode: "serial" });
let page;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto("/?test=1");
  await page.waitForFunction(() => Boolean(window.sunnyTownTest?.serializeGame));
});

test.afterAll(async () => {
  await page?.close();
});

test.beforeEach(async () => {
  const loaded = await page.evaluate(() => {
    const game = window.sunnyTownTest;
    game.setSettings({ muted: true, performance: "eco" });
    const pause = document.getElementById("pauseButton");
    if (pause.textContent.includes("暂停")) pause.click();
    document.getElementById("centerCameraButton").click();
    const snapshot = game.serializeGame();
    snapshot.city = {
      ...snapshot.city,
      tiles: Array.from({ length: 10 }, (_, index) => ({ x: index + 4, z: 9, roadTier: "lane" })),
      buildings: [
        ...[6, 7, 8, 9].map((x) => ({ id: `stability-home-${x}`, type: "residential", x, z: 8, level: 1, age: 1 })),
        { id: "stability-shop-10", type: "commercial", x: 10, z: 8, level: 1, age: 1 },
        { id: "stability-shop-11", type: "commercial", x: 11, z: 8, level: 1, age: 1 },
        { id: "stability-power", type: "power", x: 8, z: 10, level: 1, age: 1 },
        { id: "stability-water", type: "water", x: 9, z: 10, level: 1, age: 1 },
      ],
      week: 7,
      population: 0,
      money: 24000,
      demo: null,
      chapterIndex: 0,
      completedChapters: [],
      activeEvents: [],
      eventCooldowns: {},
      unlockedAchievements: [],
      appliedBonuses: [],
      modifiers: { upgradeDiscount: 0, trafficBonus: 0, happinessBonus: 0 },
      history: [],
      manualSaveCount: 0,
      upgradeCount: 0,
      completed: false,
      messages: ["稳定性回归街区"],
      settings: { muted: true, music: false, volume: 0.45, performance: "eco", helpOpen: false, shortcutHelp: false },
    };
    return game.loadSave(snapshot);
  });
  expect(loaded).toBe(true);
});

test("paused recomputes and save reloads preserve population; only a weekly tick grows it", async () => {
  await expect(page.locator("#pauseButton")).toContainText("继续");
  const result = await page.evaluate(() => {
    const game = window.sunnyTownTest;
    const sample = () => {
      const current = game.getState();
      return { population: current.stats.population, capacity: current.stats.capacity, week: current.week };
    };
    const initial = sample();
    const recomputes = [];
    for (let index = 0; index < 4; index += 1) {
      game.recompute();
      recomputes.push(sample());
    }
    const snapshot = game.serializeGame();
    const reloads = [];
    for (let index = 0; index < 3; index += 1) {
      reloads.push({ accepted: game.loadSave(snapshot), ...sample() });
    }
    game.advanceWeek();
    const afterWeek = sample();
    game.recompute();
    const afterRecompute = sample();
    const weeklySave = game.serializeGame();
    const restored = game.loadSave(weeklySave);
    return { initial, recomputes, reloads, afterWeek, afterRecompute, restored, afterRestore: sample() };
  });
  expect(result.initial).toMatchObject({ population: 0, week: 7 });
  expect(result.initial.capacity).toBeGreaterThan(0);
  for (const current of result.recomputes) expect(current).toMatchObject({ population: 0, week: 7 });
  for (const current of result.reloads) expect(current).toMatchObject({ accepted: true, population: 0, week: 7 });
  expect(result.afterWeek.week).toBe(8);
  expect(result.afterWeek.population).toBeGreaterThan(0);
  expect(result.afterWeek.population).toBeLessThanOrEqual(result.afterWeek.capacity);
  expect(result.afterRecompute.population).toBe(result.afterWeek.population);
  expect(result.restored).toBe(true);
  expect(result.afterRestore.population).toBe(result.afterWeek.population);
  expect(result.afterRestore.week).toBe(8);
});

test("a construction undo cannot roll back completed weeks, treasury or financial history", async () => {
  const result = await page.evaluate(() => {
    const game = window.sunnyTownTest;
    const placed = game.place("road", 14, 9);
    const beforeWeek = game.getState();
    game.advanceWeek(2);
    const settled = game.getState();
    const undone = game.undo();
    const afterUndo = game.getState();
    return {
      placed, undone,
      beforeWeek: { week: beforeWeek.week, undoDepth: beforeWeek.undoDepth },
      settled: { week: settled.week, money: settled.stats.money, history: settled.history, roadCount: settled.roadCount, undoDepth: settled.undoDepth },
      afterUndo: { week: afterUndo.week, money: afterUndo.stats.money, history: afterUndo.history, roadCount: afterUndo.roadCount, undoDepth: afterUndo.undoDepth },
    };
  });
  expect(result.placed).toBe(true);
  expect(result.beforeWeek.undoDepth).toBeGreaterThan(0);
  expect(result.settled.week).toBe(result.beforeWeek.week + 2);
  expect(result.settled.history).toHaveLength(2);
  expect(result.settled.undoDepth).toBe(0);
  expect(result.undone).toBe(false);
  expect(result.afterUndo).toEqual(result.settled);
});

test("duplicate building identities are rejected atomically instead of corrupting demolition targets", async () => {
  const result = await page.evaluate(() => {
    const game = window.sunnyTownTest;
    game.saveGame(false);
    const baseline = game.serializeGame();
    const stored = localStorage.getItem("sunny-town-story.save.v1");
    const invalid = JSON.parse(JSON.stringify(baseline));
    invalid.city.buildings[1].id = invalid.city.buildings[0].id;
    const accepted = game.loadSave(invalid);
    return {
      accepted,
      townPreserved: JSON.stringify(game.serializeGame().city) === JSON.stringify(baseline.city),
      storagePreserved: localStorage.getItem("sunny-town-story.save.v1") === stored,
    };
  });
  expect(result).toEqual({ accepted: false, townPreserved: true, storagePreserved: true });
});

test("unknown and inherited-property road tiers are rejected without changing the running town", async () => {
  const attempts = await page.evaluate(() => {
    const game = window.sunnyTownTest;
    game.saveGame(false);
    const baseline = game.serializeGame();
    const stored = localStorage.getItem("sunny-town-story.save.v1");
    return ["constructor", "__proto__", "bogus"].map((tier) => {
      const invalid = JSON.parse(JSON.stringify(baseline));
      invalid.city.tiles[0].roadTier = tier;
      const accepted = game.loadSave(invalid);
      const current = game.getState();
      return {
        tier, accepted,
        townPreserved: JSON.stringify(game.serializeGame().city) === JSON.stringify(baseline.city),
        storagePreserved: localStorage.getItem("sunny-town-story.save.v1") === stored,
        economyFinite: [current.stats.money, current.stats.income, current.stats.maintenance, current.stats.happiness].every(Number.isFinite),
      };
    });
  });
  for (const attempt of attempts) {
    expect(attempt, attempt.tier).toMatchObject({ accepted: false, townPreserved: true, storagePreserved: true, economyFinite: true });
  }
});

test("eight real 3px mouse movements pan the map without building on release", async () => {
  await page.locator('[data-tool="road"]').click();
  const setup = await page.evaluate(async () => {
    const game = window.sunnyTownTest;
    const current = game.getState();
    const canvas = document.getElementById("scene");
    const rect = canvas.getBoundingClientRect();
    // Project a clear 3x3 grass patch using the app's public camera target and
    // existing orthographic setup. The actual gesture below uses Playwright's
    // browser mouse; it does not invoke or mock the app's pointer handlers.
    const THREE = await import("/node_modules/three/build/three.module.js");
    const viewHeight = 41;
    const aspect = rect.width / rect.height;
    const camera = new THREE.OrthographicCamera(-viewHeight * aspect / 2, viewHeight * aspect / 2, viewHeight / 2, -viewHeight / 2, 0.1, 220);
    camera.zoom = current.camera.zoom;
    camera.position.set(current.camera.target.x + 29, 34, current.camera.target.z + 34);
    camera.lookAt(current.camera.target.x, 0, current.camera.target.z);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    const candidates = current.tiles.filter((tile) => tile.x >= 6 && tile.x <= 11 && tile.z >= 5 && tile.z <= 7
      && current.tiles.filter((neighbor) => Math.abs(neighbor.x - tile.x) <= 1 && Math.abs(neighbor.z - tile.z) <= 1).every((neighbor) => neighbor.type === "grass")
      && game.canBuild("road", tile.x, tile.z).ok);
    const points = candidates.map((tile) => {
      const position = new THREE.Vector3(tile.x * 2.4 - 20.4, 0.06, tile.z * 2.4 - 20.4).project(camera);
      return { x: rect.left + (position.x + 1) * rect.width / 2, y: rect.top + (1 - position.y) * rect.height / 2 };
    }).filter((point) => document.elementFromPoint(point.x, point.y) === canvas && document.elementFromPoint(point.x + 24, point.y) === canvas)
      .sort((a, b) => Math.abs(a.x - rect.width / 2) - Math.abs(b.x - rect.width / 2));
    return {
      point: points[0] || null,
      before: { roadCount: current.roadCount, buildingCount: current.buildingCount, money: current.stats.money, undoDepth: current.undoDepth, cameraX: current.camera.target.x },
    };
  });
  expect(setup.point, "A clear central grass patch must be reachable through the canvas").not.toBeNull();
  await page.mouse.move(setup.point.x, setup.point.y);
  await page.mouse.down({ button: "left" });
  try {
    for (let step = 1; step <= 8; step += 1) await page.mouse.move(setup.point.x + step * 3, setup.point.y);
  } finally {
    await page.mouse.up({ button: "left" });
  }
  const after = await page.evaluate(() => {
    const current = window.sunnyTownTest.getState();
    return { roadCount: current.roadCount, buildingCount: current.buildingCount, money: current.stats.money, undoDepth: current.undoDepth, cameraX: current.camera.target.x };
  });
  expect(after.cameraX).toBeLessThan(setup.before.cameraX - 0.1);
  expect(after.roadCount).toBe(setup.before.roadCount);
  expect(after.buildingCount).toBe(setup.before.buildingCount);
  expect(after.money).toBe(setup.before.money);
  expect(after.undoDepth).toBe(setup.before.undoDepth);
});
