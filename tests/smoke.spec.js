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

async function viewportBoxes(page, selectors) {
  return page.evaluate((items) => {
    return items.map((selector) => {
      const node = document.querySelector(selector);
      if (!node) return { selector, found: false };
      const rect = node.getBoundingClientRect();
      return {
        selector,
        found: true,
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        inViewport: rect.left >= 0 && rect.top >= 0 && rect.right <= window.innerWidth && rect.bottom <= window.innerHeight,
      };
    });
  }, selectors);
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
  await expect(page.locator("#undoButton")).toBeVisible();
  await expect(page.locator("#muteButton")).toBeVisible();
  await expect(page.locator("#musicButton")).toBeVisible();
  await expect(page.locator("#volumeSlider")).toBeVisible();
  await expect(page.locator("#shortcutHelpButton")).toBeVisible();
  await expect(page.locator("#scene")).toBeVisible();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "test-results/sunny-town-desktop.png", fullPage: true });
  await expect(await canvasSignal(page)).toBeGreaterThan(1000);
});

test("P4 audio settings and shortcuts update the tool flow", async ({ page }) => {
  await page.goto("/?test=1");
  await page.locator("#shortcutHelpButton").click();
  await expect(page.locator("#shortcutHint")).toBeVisible();
  await page.locator("#volumeSlider").fill("20");
  await page.locator("#muteButton").click();
  let after = await state(page);
  expect(after.settings.volume).toBeCloseTo(0.2);
  expect(after.settings.muted).toBe(true);
  expect(after.musicEnabled).toBe(false);

  await page.locator("#musicButton").click();
  after = await state(page);
  expect(after.settings.music).toBe(false);
  expect(after.settings.muted).toBe(false);
  expect(after.musicEnabled).toBe(false);

  await page.keyboard.press("Digit2");
  after = await state(page);
  expect(after.selectedTool).toBe("residential");
  await page.keyboard.press("KeyB");
  after = await state(page);
  expect(after.selectedTool).toBe("bulldoze");
  await page.keyboard.press("Space");
  after = await state(page);
  expect(after.selectedTool).toBe("bulldoze");
  await expect(page.locator("#pauseButton")).toContainText("继续");
  await page.keyboard.press("KeyV");
  await expect(page.locator("#speedButton")).toContainText("速度 x2");
  await page.keyboard.press("Escape");
  after = await state(page);
  expect(after.selectedTool).toBe("road");
});

test("P4 asset manifest is exposed for texture and audio production", async ({ page }) => {
  await page.goto("/?test=1");
  await page.waitForTimeout(800);
  const { assetManifest: manifest, assetRuntime: runtime } = await state(page);
  expect(manifest.style).toBe("warm-pixel-lowpoly");
  expect(manifest.textureMode).toBe("file-png-with-canvas-fallback");
  expect(manifest.audioMode).toBe("web-audio-synth");
  expect(manifest.textureCount).toBeGreaterThanOrEqual(11);
  expect(manifest.audioCueCount).toBeGreaterThanOrEqual(8);
  expect(manifest.musicNoteCount).toBeGreaterThanOrEqual(8);
  expect(runtime.textureMode).toBe(manifest.textureMode);
  expect(runtime.cachedTextures).toBeGreaterThanOrEqual(manifest.textureCount);
  expect(runtime.loadedTextures).toBeGreaterThanOrEqual(manifest.textureCount);
  expect(runtime.failedTextures).toBe(0);
});

test("P4 desktop visual frame keeps core controls inside 16:9 viewports", async ({ page }) => {
  const selectors = [
    ".top-hud",
    ".build-panel",
    ".advisor-panel",
    ".bottom-bar",
    "#pauseButton",
    "#speedButton",
    "#undoButton",
    "#zoomOutButton",
    "#zoomInButton",
    "#centerCameraButton",
    "#muteButton",
    "#musicButton",
    "#volumeSlider",
    "#shortcutHelpButton",
    "#currentTool",
  ];

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1366, height: 768 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/?test=1");
    await page.waitForTimeout(900);
    const boxes = await viewportBoxes(page, selectors);
    for (const box of boxes) {
      expect(box, `${box.selector} missing at ${viewport.width}x${viewport.height}`).toMatchObject({ found: true });
      expect(box.inViewport, `${box.selector} overflows at ${viewport.width}x${viewport.height}: ${JSON.stringify(box)}`).toBe(true);
      expect(box.width, `${box.selector} width collapsed at ${viewport.width}x${viewport.height}`).toBeGreaterThan(0);
      expect(box.height, `${box.selector} height collapsed at ${viewport.width}x${viewport.height}`).toBeGreaterThan(0);
    }
    await expect(await canvasSignal(page)).toBeGreaterThan(1000);
  }
});

test("P4 one-step undo restores the last build action", async ({ page }) => {
  await page.goto("/?test=1");
  const before = await state(page);
  await page.evaluate(() => {
    window.sunnyTownTest.place("road", 3, 3, { tier: "lane" });
    window.sunnyTownTest.place("residential", 3, 4);
  });
  let after = await state(page);
  expect(after.roadCount).toBe(before.roadCount + 1);
  expect(after.buildingCount).toBe(before.buildingCount + 1);
  expect(after.undoDepth).toBe(2);
  expect(after.undoLabel).toContain("住宅");
  await expect(page.locator("#undoButton")).toBeEnabled();

  await page.locator("#undoButton").click();
  after = await state(page);
  expect(after.roadCount).toBe(before.roadCount + 1);
  expect(after.buildingCount).toBe(before.buildingCount);
  expect(after.undoDepth).toBe(1);
  expect(after.messages[0]).toContain("已撤销");

  await page.keyboard.press("KeyU");
  after = await state(page);
  expect(after.roadCount).toBe(before.roadCount);
  expect(after.buildingCount).toBe(before.buildingCount);
  expect(after.undoDepth).toBe(0);
});

test("P4 camera controls zoom, recenter and clamp panning", async ({ page }) => {
  await page.goto("/?test=1");
  const cameraState = () =>
    page.evaluate(() => window.sunnyTownTest.getState().camera);

  const before = await cameraState();
  await page.locator("#zoomInButton").click();
  let after = await cameraState();
  expect(after.zoom).toBeGreaterThan(before.zoom);

  await page.keyboard.press("Minus");
  after = await cameraState();
  expect(after.zoom).toBeCloseTo(before.zoom, 1);

  await page.locator("#scene").dispatchEvent("pointerdown", { clientX: 700, clientY: 450, pointerId: 1 });
  await page.locator("#scene").dispatchEvent("pointermove", { clientX: -1200, clientY: -1200, pointerId: 1 });
  await page.locator("#scene").dispatchEvent("pointerup", { clientX: -1200, clientY: -1200, pointerId: 1 });
  after = await cameraState();
  expect(Math.abs(after.target.x)).toBeLessThanOrEqual(after.limit);
  expect(Math.abs(after.target.z)).toBeLessThanOrEqual(after.limit);

  await page.keyboard.press("KeyC");
  after = await cameraState();
  expect(after.zoom).toBeCloseTo(1, 2);
  expect(Math.abs(after.target.x)).toBeLessThan(0.01);
  expect(Math.abs(after.target.z)).toBeLessThan(0.01);
});

test("P4 construction, upgrade, tax and population feedback spawn effects", async ({ page }) => {
  await page.goto("/?test=1");
  const before = await state(page);
  await page.evaluate(() => {
    const t = window.sunnyTownTest;
    t.place("road", 3, 3, { tier: "lane" });
    t.place("residential", 3, 4);
  });
  let after = await state(page);
  expect(after.effectCount).toBeGreaterThan(before.effectCount);

  await page.evaluate(() => {
    const t = window.sunnyTownTest;
    t.place("road", 4, 5, { tier: "avenue" });
    t.place("road", 5, 5, { tier: "avenue" });
    t.place("road", 6, 5, { tier: "avenue" });
    t.place("residential", 4, 6);
    t.place("power", 5, 6);
    t.place("water", 6, 6);
    t.setMoney(80000);
    t.advanceWeek(10);
    t.setSelectedTile(4, 6);
    t.upgradeSelectedBuilding();
  });
  after = await state(page);
  expect(after.effectCount).toBeGreaterThan(0);
  expect(after.buildings.find((building) => building.x === 4 && building.z === 6).level).toBeGreaterThanOrEqual(2);

  await page.evaluate(() => window.sunnyTownTest.advanceWeek(2));
  after = await state(page);
  expect(after.effectCount).toBeGreaterThan(0);
  expect(after.report.trends.population).toMatch(/[↑↓→]/);
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

test("tutorial task chain surfaces the next useful town step", async ({ page }) => {
  await page.goto("/?test=1");
  const opening = await state(page);
  expect(opening.tutorial.some((task) => task.id === "first_homes" && !task.done)).toBe(true);
  await expect(page.locator("#tutorialList")).toContainText("安置居民");

  await page.evaluate(() => {
    const t = window.sunnyTownTest;
    t.place("power", 7, 10);
    t.place("water", 9, 10);
    t.place("residential", 6, 8);
    t.place("residential", 10, 8);
    t.place("residential", 6, 10);
    t.advanceWeek(6);
  });

  const after = await state(page);
  expect(after.tutorialAll.some((task) => task.id === "first_homes" && task.done)).toBe(true);
  expect(after.tutorial.some((task) => task.id === "water_power")).toBe(true);
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

test("P3 resident needs explain low happiness causes", async ({ page }) => {
  await page.goto("/?test=1");
  await page.evaluate(() => {
    const t = window.sunnyTownTest;
    t.place("road", 1, 15, { tier: "lane" });
    t.place("residential", 1, 16);
    t.place("road", 6, 15, { tier: "lane" });
    t.place("commercial", 6, 16);
    t.advanceWeek(8);
  });

  const after = await state(page);
  const needs = after.stats.residentNeeds.map((need) => need.title).join(" ");
  const reasons = after.stats.happinessReasons.map((reason) => reason.label).join(" ");
  expect(needs).toMatch(/电力|供水|通勤|岗位/);
  expect(reasons).toMatch(/水电缺口|通勤压力|就业压力/);
  await expect(page.locator("#needsSummary")).toContainText(/电力|供水|通勤|岗位/);
  await expect(page.locator("#happinessBreakdown")).toContainText(/水电缺口|通勤压力|就业压力/);
});

test("P3 residential tile details show service coverage and pollution", async ({ page }) => {
  await page.goto("/?test=1");
  await page.evaluate(() => {
    const t = window.sunnyTownTest;
    t.setMoney(150000);
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
    t.place("park", 6, 5);
    t.place("school", 9, 5);
    t.advanceWeek(4);
    t.setSelectedTile(10, 5);
  });

  const after = await state(page);
  expect(after.chapterIndex).toBeGreaterThanOrEqual(1);
  expect(after.stats.education).toBeGreaterThan(0);
  expect(after.stats.pollution).toBeGreaterThan(0);
  expect(after.stats.happinessReasons.some((reason) => reason.id === "service")).toBe(true);
  await expect(page.locator("#selectedInfo")).toContainText("水电");
  await expect(page.locator("#selectedInfo")).toContainText("教育");
  await expect(page.locator("#selectedInfo")).toContainText("消防");
  await expect(page.locator("#selectedInfo")).toContainText("污染");
});

test("P3 services require road reachability to cover homes", async ({ page }) => {
  await page.goto("/?test=1");
  await page.evaluate(() => {
    const t = window.sunnyTownTest;
    t.setMoney(180000);
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
    t.place("road", 2, 6, { tier: "avenue" });
    t.place("school", 2, 5);
    t.advanceWeek(2);
    t.setSelectedTile(4, 5);
  });

  const disconnected = await state(page);
  const homeBefore = disconnected.tiles.find((tile) => tile.x === 4 && tile.z === 5);
  expect(homeBefore.coverage.education || 0).toBe(0);
  await expect(page.locator("#selectedInfo")).toContainText("教育 0%");

  await page.evaluate(() => {
    const t = window.sunnyTownTest;
    t.place("road", 3, 6, { tier: "avenue" });
    t.advanceWeek(1);
    t.setSelectedTile(4, 5);
  });
  const connected = await state(page);
  const homeAfter = connected.tiles.find((tile) => tile.x === 4 && tile.z === 5);
  expect(homeAfter.coverage.education).toBeGreaterThan(0);
  await expect(page.locator("#selectedInfo")).toContainText(/教育 [1-9]/);
});

test("P3 service capacity pressure reduces coverage and creates resident needs", async ({ page }) => {
  await page.goto("/?test=1");
  await page.evaluate(() => {
    const t = window.sunnyTownTest;
    t.setMoney(900000);
    for (const z of [2, 4, 6, 8, 10, 12, 14, 16]) {
      for (let x = 2; x <= 15; x += 1) t.place("road", x, z, { tier: "avenue" });
    }
    for (const x of [2, 5, 8, 11, 14]) {
      for (let z = 2; z <= 16; z += 1) t.place("road", x, z, { tier: "avenue" });
    }
    [
      ["power", 2, 3],
      ["water", 3, 3],
      ["power", 4, 3],
      ["power", 6, 3],
      ["water", 7, 3],
      ["power", 10, 3],
      ["water", 11, 3],
      ["power", 14, 3],
      ["water", 15, 3],
      ["power", 2, 15],
      ["water", 5, 15],
      ["power", 8, 15],
      ["water", 11, 15],
      ["power", 14, 15],
      ["water", 15, 15],
      ["power", 2, 17],
      ["water", 5, 17],
      ["power", 8, 17],
      ["water", 11, 17],
      ["power", 14, 17],
    ].forEach(([type, x, z]) => t.place(type, x, z));
    const reserved = new Set(["6,5", "9,5", "12,5", "6,7", "9,7", "12,7", "6,9", "9,9", "12,9", "6,11", "9,11", "12,11"]);
    const homes = [];
    for (const z of [5, 7, 9, 11, 13]) {
      for (const x of [3, 4, 6, 7, 9, 10, 12, 13]) {
        if (!reserved.has(`${x},${z}`)) homes.push([x, z]);
      }
    }
    homes.slice(0, 32).forEach(([x, z]) => t.place("residential", x, z));
    [[3, 15], [4, 15], [6, 15], [7, 15], [9, 15], [10, 15]].forEach(([x, z]) => t.place("commercial", x, z));
    [[15, 5], [15, 7], [15, 9]].forEach(([x, z]) => t.place("industrial", x, z));
    t.advanceWeek(36);
    t.place("school", 9, 5);
    t.advanceWeek(12);
  });

  const after = await state(page);
  expect(after.stats.servicePressure.education.score).toBeLessThan(1);
  expect(after.stats.residentNeeds.some((need) => need.id === "education_capacity")).toBe(true);
  await expect(page.locator("#happinessBreakdown")).toContainText("学校容量吃紧");
});

test("P3 residential zoning rewards services and penalizes nearby industry", async ({ page }) => {
  await page.goto("/?test=1");
  await page.evaluate(() => {
    const t = window.sunnyTownTest;
    t.setMoney(260000);
    for (let x = 2; x <= 14; x += 1) t.place("road", x, 6, { tier: "avenue" });
    t.place("power", 3, 7);
    t.place("water", 4, 7);
    t.place("power", 12, 7);
    t.place("water", 13, 7);
    t.place("residential", 5, 5);
    t.place("residential", 6, 5);
    t.place("residential", 7, 5);
    t.place("residential", 8, 5);
    t.place("residential", 10, 5);
    t.place("commercial", 10, 7);
    t.place("industrial", 9, 5);
    t.advanceWeek(18);
    t.place("park", 5, 7);
    t.place("school", 6, 7);
    t.advanceWeek(4);
    t.setSelectedTile(10, 5);
  });

  const mixed = await state(page);
  const mixedCapacity = mixed.stats.capacity;
  const mixedScore = mixed.stats.zoning.residential;
  expect(mixed.stats.happinessReasons.some((reason) => reason.id === "zoning")).toBe(true);
  await expect(page.locator("#selectedInfo")).toContainText("区位");

  await page.evaluate(() => {
    const t = window.sunnyTownTest;
    t.place("bulldoze", 9, 5);
    t.place("industrial", 14, 5);
    t.advanceWeek(2);
    t.setSelectedTile(10, 5);
  });
  const separated = await state(page);
  expect(separated.stats.zoning.residential).toBeGreaterThan(mixedScore);
  expect(separated.stats.capacity).toBeGreaterThan(mixedCapacity);
});

test("P3 commercial and industrial zoning affects tax income", async ({ page }) => {
  await page.goto("/?test=1");
  await page.evaluate(() => {
    const t = window.sunnyTownTest;
    t.setMoney(240000);
    for (let x = 2; x <= 14; x += 1) t.place("road", x, 6, { tier: "lane" });
    t.place("power", 3, 7);
    t.place("water", 4, 7);
    t.place("power", 12, 7);
    t.place("water", 13, 7);
    t.place("residential", 5, 5);
    t.place("residential", 6, 5);
    t.place("residential", 7, 5);
    t.place("residential", 8, 5);
    t.place("commercial", 12, 5);
    t.place("industrial", 13, 5);
    t.advanceWeek(14);
    t.setSelectedTile(12, 5);
  });

  const weak = await state(page);
  const weakIncome = weak.stats.income;
  await expect(page.locator("#selectedInfo")).toContainText("商业区位");

  await page.evaluate(() => {
    const t = window.sunnyTownTest;
    for (let x = 5; x <= 13; x += 1) t.place("road", x, 6, { tier: "avenue" });
    t.place("bulldoze", 12, 5);
    t.place("commercial", 7, 7);
    t.advanceWeek(2);
    t.setSelectedTile(7, 7);
  });
  const strong = await state(page);
  expect(strong.stats.zoning.commercial).toBeGreaterThan(weak.stats.zoning.commercial);
  expect(strong.stats.income).toBeGreaterThan(weakIncome);
  await expect(page.locator("#selectedInfo")).toContainText("商业区位");
});

test("P3 fiscal health explains deficits and reserve pressure", async ({ page }) => {
  await page.goto("/?test=1");
  await page.evaluate(() => {
    const t = window.sunnyTownTest;
    t.setMoney(32000);
    for (let x = 2; x <= 14; x += 1) t.place("road", x, 6, { tier: "avenue" });
    t.place("power", 3, 7);
    t.place("water", 4, 7);
    t.place("residential", 5, 5);
    t.place("residential", 6, 5);
    t.place("commercial", 7, 7);
    t.advanceWeek(18);
    t.place("park", 8, 7);
    t.place("school", 9, 7);
    t.place("plaza", 10, 7);
    t.advanceWeek(6);
    t.place("fire", 11, 7);
    t.place("lantern", 12, 7);
    t.place("station", 13, 7);
    t.setMoney(-18000);
    t.advanceWeek(8);
  });

  const after = await state(page);
  expect(after.stats.fiscal.score).toBeLessThan(55);
  expect(after.stats.happinessReasons.some((reason) => reason.id === "fiscal" && reason.value < 0)).toBe(true);
  expect(after.stats.residentNeeds.some((need) => ["fiscal", "deficit"].includes(need.id))).toBe(true);
  await expect(page.locator("#happinessBreakdown")).toContainText(/财政安全|连续赤字|财政安全不足/);
  await expect(page.locator("#reportDetails")).toContainText("财政");
});

test("P3 300-week balanced simulation stays finite and playable", async ({ page }) => {
  await page.goto("/?test=1");
  await page.evaluate(() => {
    const t = window.sunnyTownTest;
    t.setMoney(1200000);
    for (const z of [2, 4, 6, 8, 10, 12, 14, 16]) {
      for (let x = 2; x <= 15; x += 1) t.place("road", x, z, { tier: "avenue" });
    }
    for (const x of [2, 5, 8, 11, 14]) {
      for (let z = 2; z <= 16; z += 1) t.place("road", x, z, { tier: "avenue" });
    }
    [
      ["power", 2, 3], ["water", 3, 3], ["power", 4, 3], ["water", 6, 3],
      ["power", 7, 3], ["water", 9, 3], ["power", 10, 3], ["water", 12, 3],
      ["power", 13, 3], ["water", 15, 3], ["power", 2, 15], ["water", 5, 15],
      ["power", 8, 15], ["water", 11, 15], ["power", 14, 15], ["water", 15, 15],
      ["power", 2, 17], ["water", 5, 17], ["power", 8, 17], ["water", 11, 17],
      ["power", 14, 17],
    ].forEach(([type, x, z]) => t.place(type, x, z));
    const reserved = new Set(["6,5", "9,5", "12,5", "6,7", "9,7", "12,7", "6,9", "9,9", "12,9", "6,11", "9,11", "12,11", "12,13"]);
    const homes = [];
    for (const z of [1, 5, 7, 9, 11, 13, 17]) {
      for (const x of [3, 4, 6, 7, 9, 10, 12, 13]) {
        if (!reserved.has(`${x},${z}`)) homes.push([x, z]);
      }
    }
    homes.slice(0, 46).forEach(([x, z]) => t.place("residential", x, z));
    [[3, 15], [4, 15], [6, 15], [7, 15], [9, 15], [10, 15], [12, 15], [13, 15]].forEach(([x, z]) => t.place("commercial", x, z));
    [[15, 5], [15, 7], [15, 9]].forEach(([x, z]) => t.place("industrial", x, z));
    t.advanceWeek(40);
    [["park", 6, 5], ["park", 6, 7], ["park", 6, 9], ["school", 9, 5], ["school", 9, 7], ["school", 9, 9], ["fire", 12, 9], ["fire", 12, 11], ["plaza", 12, 5], ["plaza", 12, 7], ["station", 12, 13], ["lantern", 9, 11]].forEach(([type, x, z]) => t.place(type, x, z));
    t.advanceWeek(260);
  });

  const after = await state(page);
  const numericStats = Object.values(after.stats).filter((value) => typeof value === "number");
  expect(numericStats.every(Number.isFinite)).toBe(true);
  expect(after.history.length).toBeGreaterThan(0);
  expect(after.history.every((item) => Number.isFinite(item.population) && Number.isFinite(item.money) && Number.isFinite(item.net))).toBe(true);
  expect(after.stats.population).toBeGreaterThan(500);
  expect(after.stats.happiness).toBeGreaterThan(45);
  expect(after.stats.money).toBeGreaterThan(-10000);
  expect(after.stats.fiscal.score).toBeGreaterThan(35);
  expect(after.residents.every((resident) => Number.isFinite(resident.commuteTime))).toBe(true);
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

test("P2 long-run town can complete all five chapters within 200 weeks", async ({ page }) => {
  await page.goto("/?test=1");
  await page.evaluate(() => {
    const t = window.sunnyTownTest;
    t.setMoney(900000);

    for (const z of [2, 4, 6, 8, 10, 12, 14, 16]) {
      for (let x = 2; x <= 15; x += 1) t.place("road", x, z, { tier: "avenue" });
    }
    for (const x of [2, 5, 8, 11, 14]) {
      for (let z = 2; z <= 16; z += 1) t.place("road", x, z, { tier: "avenue" });
    }

    [
      ["power", 2, 3],
      ["water", 3, 3],
      ["power", 4, 3],
      ["water", 6, 3],
      ["power", 7, 3],
      ["water", 9, 3],
      ["power", 10, 3],
      ["water", 12, 3],
      ["power", 13, 3],
      ["water", 15, 3],
      ["power", 2, 15],
      ["water", 5, 15],
      ["power", 2, 1],
      ["water", 5, 1],
      ["power", 8, 1],
      ["water", 11, 1],
      ["power", 14, 1],
      ["water", 8, 15],
      ["power", 11, 15],
      ["water", 14, 15],
      ["power", 2, 17],
      ["water", 5, 17],
      ["power", 8, 17],
      ["water", 11, 17],
      ["power", 14, 17],
    ].forEach(([type, x, z]) => t.place(type, x, z));

    const reserved = new Set(["4,1", "6,1", "9,1", "6,5", "9,5", "12,5", "6,7", "9,7", "12,7", "6,9", "9,9", "12,9", "6,11", "9,11", "12,11", "12,13"]);
    const homes = [];
    for (const z of [1, 5, 7, 9, 11, 13, 17]) {
      for (const x of [3, 4, 6, 7, 9, 10, 12, 13]) {
        if (!reserved.has(`${x},${z}`)) homes.push([x, z]);
      }
    }
    homes.slice(0, 42).forEach(([x, z]) => t.place("residential", x, z));

    [
      [3, 15],
      [4, 15],
      [6, 15],
      [7, 15],
      [9, 15],
      [10, 15],
      [12, 15],
      [13, 15],
      [15, 15],
      [4, 1],
      [6, 1],
      [9, 1],
    ].forEach(([x, z]) => t.place("commercial", x, z));
    [
      [15, 5],
      [15, 7],
      [15, 9],
      [15, 11],
    ].forEach(([x, z]) => t.place("industrial", x, z));

    t.advanceWeek(36);
    [
      ["park", 6, 5],
      ["park", 6, 7],
      ["park", 6, 9],
      ["school", 9, 5],
      ["school", 9, 7],
      ["school", 9, 9],
      ["plaza", 12, 5],
      ["plaza", 12, 7],
    ].forEach(([type, x, z]) => t.place(type, x, z));
    t.setSelectedTile(homes[0][0], homes[0][1]);
    t.upgradeSelectedBuilding();

    t.advanceWeek(12);
    homes.slice(0, 20).forEach(([x, z]) => {
      t.setSelectedTile(x, z);
      t.upgradeSelectedBuilding();
    });
    [
      ["fire", 12, 9],
      ["fire", 12, 11],
      ["lantern", 6, 11],
      ["lantern", 9, 11],
    ].forEach(([type, x, z]) => t.place(type, x, z));

    t.advanceWeek(12);
    t.place("station", 12, 13);
    t.advanceWeek(120);
  });

  const after = await state(page);
  expect(after.completed).toBe(true);
  expect(after.chapterIndex).toBe(4);
  expect(after.appliedBonuses).toContain("finale_fund");
  expect(after.stats.population).toBeGreaterThanOrEqual(800);
  expect(after.stats.happiness).toBeGreaterThanOrEqual(78);
  expect(after.stats.pollution).toBeLessThanOrEqual(30);
  expect(after.stats.money).toBeGreaterThan(0);
  expect(after.history.every((item) => Number.isFinite(item.population) && Number.isFinite(item.money))).toBe(true);
  expect(after.tutorialAll.some((task) => task.id === "station_task" && task.done)).toBe(true);
  expect(after.tutorial.some((task) => task.id === "livable_task" && task.done)).toBe(true);
});

test("manual saves unlock an achievement and update save status", async ({ page }) => {
  await page.goto("/?test=1");
  await page.evaluate(() => window.sunnyTownTest.saveGame(true));
  const after = await state(page);
  expect(after.achievements).toContain("first_save");
  expect(after.saveStatus).toContain("手动保存");
  await expect(page.locator("#saveStatus")).toContainText("手动保存");
});
