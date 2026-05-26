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

async function state(page) {
  return page.evaluate(() => window.sunnyTownTest.getState());
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
});

test("sunny town renders the desktop 3D builder and traffic HUD", async ({ page }) => {
  await page.goto("/?test=1");
  await expect(page.locator("h1")).toContainText("阳光小镇物语");
  await expect(page.locator("[data-tool='road']")).toBeVisible();
  await expect(page.locator("[data-road-tier='lane']")).toBeVisible();
  await expect(page.locator("[data-road-tier='avenue']")).toBeVisible();
  await expect(page.locator("#trafficSummary")).toBeVisible();
  await expect(page.locator("#chapterTitle")).toContainText("第一章");
  await expect(page.locator("#saveButton")).toBeVisible();
  await expect(page.locator("#upgradeButton")).toBeVisible();
  await expect(page.locator("#scene")).toBeVisible();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "test-results/sunny-town-desktop.png", fullPage: true });
  await expect(await canvasSignal(page)).toBeGreaterThan(1000);
});

test("lane roads and sakura avenues can both be placed", async ({ page }) => {
  await page.goto("/?test=1");
  await page.evaluate(() => {
    window.sunnyTownTest.place("road", 1, 1, { tier: "lane" });
    window.sunnyTownTest.place("road", 2, 1, { tier: "avenue" });
  });
  const roads = (await state(page)).roads;
  const lane = roads.find((road) => road.x === 1 && road.z === 1);
  const avenue = roads.find((road) => road.x === 2 && road.z === 1);
  expect(lane.tier).toBe("lane");
  expect(avenue.tier).toBe("avenue");
  expect(avenue.capacity).toBeGreaterThan(lane.capacity);
});

test("road masks update for straight, corner, T and cross layouts", async ({ page }) => {
  await page.goto("/?test=1");
  await page.evaluate(() => {
    const t = window.sunnyTownTest;
    t.place("road", 2, 2, { tier: "lane" });
    t.place("road", 3, 2, { tier: "lane" });
    t.place("road", 4, 2, { tier: "lane" });
    t.place("road", 6, 6, { tier: "lane" });
    t.place("road", 7, 6, { tier: "lane" });
    t.place("road", 7, 7, { tier: "lane" });
    t.place("road", 10, 2, { tier: "lane" });
    t.place("road", 9, 2, { tier: "lane" });
    t.place("road", 11, 2, { tier: "lane" });
    t.place("road", 10, 1, { tier: "lane" });
    t.place("road", 14, 4, { tier: "lane" });
    t.place("road", 13, 4, { tier: "lane" });
    t.place("road", 15, 4, { tier: "lane" });
    t.place("road", 14, 3, { tier: "lane" });
    t.place("road", 14, 5, { tier: "lane" });
  });
  const roads = (await state(page)).roads;
  const at = (x, z) => roads.find((road) => road.x === x && road.z === z).mask;
  expect(at(3, 2)).toBe(10);
  expect(at(7, 6)).toBe(12);
  expect(at(10, 2)).toBe(11);
  expect(at(14, 4)).toBe(15);
});

test("residents receive road routes and animated commuters stay capped", async ({ page }) => {
  await page.goto("/?test=1");
  await page.evaluate(() => {
    const t = window.sunnyTownTest;
    t.place("road", 1, 12, { tier: "lane" });
    t.place("road", 2, 12, { tier: "lane" });
    t.place("road", 3, 12, { tier: "lane" });
    t.place("road", 4, 12, { tier: "lane" });
    t.place("road", 5, 12, { tier: "lane" });
    t.place("residential", 1, 13);
    t.place("commercial", 5, 13);
    t.place("industrial", 4, 13);
    t.place("power", 2, 13);
    t.place("water", 3, 13);
    t.advanceWeek(8);
  });
  const after = await state(page);
  expect(after.stats.population).toBeGreaterThan(0);
  expect(after.stats.income).toBeGreaterThan(0);
  expect(after.residents.some((resident) => resident.routeLength > 0)).toBe(true);
  expect(after.visualAgentCount).toBeGreaterThan(0);
  expect(after.visualAgentCount).toBeLessThanOrEqual(60);
});

test("broken road networks create unreachable commuter advice", async ({ page }) => {
  await page.goto("/?test=1");
  await page.evaluate(() => {
    const t = window.sunnyTownTest;
    t.place("road", 1, 15, { tier: "lane" });
    t.place("residential", 1, 16);
    t.place("road", 6, 15, { tier: "lane" });
    t.place("commercial", 6, 16);
    t.place("power", 2, 15);
    t.place("water", 2, 16);
    t.advanceWeek(8);
  });
  const after = await state(page);
  expect(after.residents.some((resident) => resident.routeLength === 0)).toBe(true);
  expect(after.advisor.map((item) => `${item.title} ${item.text}`).join("\n")).toMatch(/到不了目的地|断路/);
  await expect(page.locator("#advisorList")).toContainText(/到不了目的地|断路/);
});

test("busy commutes raise lane congestion and lower traffic score", async ({ page }) => {
  await page.goto("/?test=1");
  await page.evaluate(() => {
    const t = window.sunnyTownTest;
    t.place("road", 1, 4, { tier: "lane" });
    t.place("road", 2, 4, { tier: "lane" });
    t.place("road", 3, 4, { tier: "lane" });
    t.place("road", 4, 4, { tier: "lane" });
    t.place("road", 5, 4, { tier: "lane" });
    t.place("road", 6, 4, { tier: "lane" });
    t.place("residential", 1, 5);
    t.place("residential", 2, 5);
    t.place("residential", 3, 5);
    t.place("commercial", 5, 5);
    t.place("industrial", 6, 5);
    t.place("power", 2, 3);
    t.place("water", 3, 3);
    t.advanceWeek(12);
  });
  const after = await state(page);
  const busyLane = after.roads.find((road) => road.tier === "lane" && road.load > road.capacity);
  expect(busyLane).toBeTruthy();
  expect(busyLane.congestion).toBeGreaterThan(0);
  expect(after.stats.traffic).toBeLessThan(100);
});

test("avenues carry the same sampled load with lower congestion than lanes", async ({ page }) => {
  await page.goto("/?test=1");
  await page.evaluate(() => {
    const t = window.sunnyTownTest;
    t.place("road", 1, 1, { tier: "lane" });
    t.place("road", 2, 1, { tier: "avenue" });
    t.advanceWeek(1);
  });
  const roads = (await state(page)).roads;
  const lane = roads.find((road) => road.x === 1 && road.z === 1);
  const avenue = roads.find((road) => road.x === 2 && road.z === 1);
  const sameLoad = Math.max(lane.load, avenue.load, 10);
  expect(sameLoad / avenue.capacity).toBeLessThan(sameLoad / lane.capacity);
});

test("save data restores roads, buildings, chapters and upgrades", async ({ page }) => {
  await page.goto("/?test=1");
  const save = await page.evaluate(() => {
    const t = window.sunnyTownTest;
    t.setMoney(80000);
    t.place("road", 1, 1, { tier: "lane" });
    t.place("power", 1, 0);
    t.place("water", 2, 1);
    t.place("residential", 1, 2);
    t.advanceWeek(8);
    t.setSelectedTile(1, 2);
    t.upgradeSelectedBuilding();
    t.advanceWeek(2);
    return t.serializeGame();
  });

  await page.evaluate((snapshot) => {
    window.sunnyTownTest.startNewGame({ keepStorage: true });
    window.sunnyTownTest.loadSave(snapshot);
  }, save);

  const after = await state(page);
  expect(after.roads.some((road) => road.x === 1 && road.z === 1)).toBe(true);
  const home = after.buildings.find((building) => building.x === 1 && building.z === 2);
  expect(home).toBeTruthy();
  expect(home.level).toBe(2);
  expect(after.week).toBe(save.city.week);
});

test("version 1 saves migrate into the P2 save format", async ({ page }) => {
  await page.goto("/?test=1");
  const legacySave = await page.evaluate(() => {
    const t = window.sunnyTownTest;
    t.place("road", 1, 1, { tier: "lane" });
    t.place("residential", 1, 2);
    t.advanceWeek(1);
    const save = t.serializeGame();
    save.version = 1;
    delete save.city.appliedBonuses;
    delete save.city.modifiers;
    delete save.city.history;
    return save;
  });

  const restored = await page.evaluate((snapshot) => {
    window.sunnyTownTest.startNewGame({ keepStorage: true });
    return window.sunnyTownTest.loadSave(snapshot);
  }, legacySave);

  const after = await state(page);
  expect(restored).toBe(true);
  expect(after.roads.some((road) => road.x === 1 && road.z === 1)).toBe(true);
  expect(after.buildings.some((building) => building.type === "residential")).toBe(true);
  expect(after.modifiers.upgradeDiscount).toBe(0);
  expect(after.history).toEqual([]);
});

test("chapter goals unlock service buildings and achievements", async ({ page }) => {
  await page.goto("/?test=1");
  const before = await state(page);
  await page.evaluate(() => {
    const t = window.sunnyTownTest;
    t.setMoney(250000);
    for (let x = 4; x <= 13; x += 1) t.place("road", x, 6, { tier: "avenue" });
    t.place("road", 8, 7, { tier: "avenue" });
    t.place("power", 5, 7);
    t.place("water", 6, 7);
    t.place("power", 12, 5);
    t.place("water", 13, 5);
    t.place("residential", 4, 5);
    t.place("residential", 5, 5);
    t.place("residential", 7, 7);
    t.place("residential", 8, 5);
    t.place("residential", 9, 7);
    t.place("residential", 10, 5);
    t.place("residential", 12, 7);
    t.place("residential", 13, 7);
    t.place("commercial", 10, 7);
    t.place("industrial", 11, 7);
    t.advanceWeek(22);
  });
  const after = await state(page);
  expect(after.chapterIndex).toBeGreaterThanOrEqual(1);
  expect(after.appliedBonuses).toContain("community_fund");
  expect(after.stats.money).toBeGreaterThan(before.stats.money);
  await expect(page.locator("[data-tool='park']")).toBeEnabled();
  await expect(page.locator("[data-tool='plaza']")).toBeEnabled();
  expect(after.achievements).toContain("hundred_people");
});

test("P2 building unlocks explain population, happiness and money requirements", async ({ page }) => {
  await page.goto("/?test=1");
  let early = await state(page);
  expect(early.unlocks.plaza.ok).toBe(false);
  expect(early.unlocks.plaza.missing.join(" ")).toContain("章节");
  await expect(page.locator("[data-tool='plaza']")).toBeDisabled();

  await page.evaluate(() => {
    const t = window.sunnyTownTest;
    t.setMoney(250000);
    for (let x = 4; x <= 13; x += 1) t.place("road", x, 6, { tier: "avenue" });
    t.place("road", 8, 7, { tier: "avenue" });
    t.place("power", 5, 7);
    t.place("water", 6, 7);
    t.place("power", 12, 5);
    t.place("water", 13, 5);
    t.place("residential", 4, 5);
    t.place("residential", 5, 5);
    t.place("residential", 7, 7);
    t.place("residential", 8, 5);
    t.place("residential", 9, 7);
    t.place("residential", 10, 5);
    t.place("residential", 12, 7);
    t.place("residential", 13, 7);
    t.place("commercial", 10, 7);
    t.place("industrial", 11, 7);
    t.advanceWeek(22);
  });

  const after = await state(page);
  expect(after.chapterIndex).toBeGreaterThanOrEqual(1);
  expect(after.unlocks.plaza.ok).toBe(true);
  expect(after.unlocks.school.ok).toBe(true);
  await expect(page.locator("[data-tool='plaza']")).toBeEnabled();
  await expect(page.locator("#unlockText")).toContainText("待解锁");
});

test("P2 upgrade rules block immature districts and unlock after services improve", async ({ page }) => {
  await page.goto("/?test=1");
  await page.evaluate(() => {
    const t = window.sunnyTownTest;
    t.setMoney(300000);
    for (let x = 2; x <= 12; x += 1) t.place("road", x, 4, { tier: "avenue" });
    t.place("power", 2, 5);
    t.place("water", 3, 5);
    t.place("residential", 4, 5);
    t.setSelectedTile(4, 5);
  });
  const blocked = await page.evaluate(() => window.sunnyTownTest.upgradeState(4, 5));
  expect(blocked.ok).toBe(false);
  expect(blocked.missing.join(" ")).toMatch(/幸福|电力|供水/);

  await page.evaluate(() => {
    const t = window.sunnyTownTest;
    t.place("residential", 5, 5);
    t.place("residential", 6, 5);
    t.place("residential", 7, 5);
    t.place("commercial", 8, 5);
    t.place("industrial", 9, 5);
    t.advanceWeek(22);
    t.place("residential", 10, 5);
    t.place("park", 3, 5);
    t.place("school", 11, 5);
    t.place("plaza", 12, 5);
    t.advanceWeek(10);
    t.setSelectedTile(4, 5);
  });

  const ready = await page.evaluate(() => window.sunnyTownTest.upgradeState(4, 5));
  expect(ready.ok).toBe(true);
  expect(await page.evaluate(() => window.sunnyTownTest.upgradeSelectedBuilding())).toBe(true);
  const upgraded = await state(page);
  expect(upgraded.buildings.find((building) => building.x === 4 && building.z === 5).level).toBe(2);
  expect(upgraded.achievements).toContain("first_upgrade");
});

test("P2 landmarks, chapter rewards and weekly trends are visible", async ({ page }) => {
  await page.goto("/?test=1");
  await page.evaluate(() => {
    const t = window.sunnyTownTest;
    t.setMoney(300000);
    for (let x = 4; x <= 14; x += 1) t.place("road", x, 6, { tier: "avenue" });
    t.place("road", 8, 7, { tier: "avenue" });
    t.place("power", 5, 7);
    t.place("water", 6, 7);
    t.place("power", 12, 5);
    t.place("water", 13, 5);
    t.place("residential", 4, 5);
    t.place("residential", 5, 5);
    t.place("residential", 7, 7);
    t.place("residential", 8, 5);
    t.place("residential", 9, 7);
    t.place("residential", 10, 5);
    t.place("residential", 12, 7);
    t.place("residential", 13, 7);
    t.place("commercial", 10, 7);
    t.place("industrial", 11, 7);
    t.advanceWeek(24);
    t.place("plaza", 14, 7);
    t.advanceWeek(1);
  });

  const after = await state(page);
  expect(after.landmarkCount).toBeGreaterThanOrEqual(1);
  expect(after.achievements).toContain("first_landmark");
  expect(after.history.length).toBeGreaterThan(0);
  expect(after.report.trends.population).toMatch(/[↑↓→]/);
  await expect(page.locator("#reportDetails")).toContainText("人口");
  await expect(page.locator("#achievementList")).toContainText("有了地标");
});

test("manual saves unlock an achievement and update save status", async ({ page }) => {
  await page.goto("/?test=1");
  await page.evaluate(() => window.sunnyTownTest.saveGame(true));
  const after = await state(page);
  expect(after.achievements).toContain("first_save");
  expect(after.saveStatus).toContain("手动保存");
  await expect(page.locator("#saveStatus")).toContainText("手动保存");
});
