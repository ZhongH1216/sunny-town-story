const { test, expect } = require("@playwright/test");

// Use the public game actions. The campaign below earns its construction budget
// through weekly revenue and letters; only the explicit affordability test sets cash.
test.beforeEach(async ({ page }) => {
  await page.goto("/?test=1");
  await page.waitForFunction(() => Boolean(window.sunnyTownTest?.demo));
  await page.evaluate(() => {
    const game = window.sunnyTownTest;
    const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
    window.demoQa = {
      start(scenario = "harbor") {
        if (!game.demo.startScenario(scenario)) throw new Error(`Cannot start ${scenario}`);
        document.getElementById("pauseButton").click();
        game.setSettings({ muted: true });
        return game.getState();
      },
      build(type) {
        const current = game.getState();
        const homes = current.buildings.filter((building) => building.type === "residential");
        const coverage = { power: "power", water: "water", park: "park", school: "education", fire: "fire", plaza: "culture", station: "transport" }[type];
        const radius = { power: 6, water: 6, park: 3, school: 4, fire: 5, plaza: 4, station: 5 }[type] || 4;
        const score = (tile) => {
          if (coverage) {
            return homes.reduce((sum, home) => {
              const homeTile = current.tiles.find((candidate) => candidate.x === home.x && candidate.z === home.z);
              const potential = Math.max(0, (radius - distance(tile, home)) / radius);
              return sum + Math.max(0, potential - (homeTile.coverage[coverage] || 0));
            }, 0);
          }
          const services = Object.values(tile.coverage).reduce((sum, value) => sum + value, 0);
          return services * 8 - distance(tile, { x: 8, z: 9 }) * 0.5;
        };
        const candidates = current.tiles.filter((tile) => game.canBuild(type, tile.x, tile.z).ok)
          .sort((a, b) => score(b) - score(a) || distance(a, { x: 8, z: 9 }) - distance(b, { x: 8, z: 9 }));
        const target = candidates[0];
        return target ? game.place(type, target.x, target.z) : false;
      },
      utilities(target = 90) {
        for (let attempt = 0; attempt < 6; attempt += 1) {
          const current = game.getState();
          const type = current.stats.water < target ? "water" : current.stats.power < target ? "power" : null;
          if (!type) return true;
          if (!this.build(type)) return false;
          game.advanceWeek();
        }
        const current = game.getState();
        return current.stats.water >= target && current.stats.power >= target;
      },
      claimReady() {
        const claimed = [];
        document.querySelector('[data-panel="letters"]')?.click();
        // Re-query after every click: claiming re-renders the visible cards.
        for (let attempt = 0; attempt < 9; attempt += 1) {
          const button = [...document.querySelectorAll('#requestBoard [data-claim]')]
            .find((node) => !node.disabled && node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden');
          if (!button) break;
          const id = button.dataset.claim;
          const before = game.getState().demo.claims.length;
          button.scrollIntoView({ block: 'nearest' });
          button.click();
          if (game.getState().demo.claims.length === before) break;
          claimed.push(id);
        }
        return claimed;
      },
    };
  });
});

test("three stories start distinct towns and reset the previous story without stale scenery", async ({ page }) => {
  const towns = await page.evaluate(() => {
    const result = {};
    for (const id of ["harbor", "garden", "commerce", "harbor"]) {
      const current = window.demoQa.start(id);
      result[id] = {
        money: current.stats.money,
        layout: current.buildings.map(({ type, x, z }) => `${type}:${x},${z}`).sort(),
        demo: current.demo,
        art: current.art,
        buildingCount: current.buildingCount,
        goals: window.sunnyTownTest.demo.progress(),
      };
    }
    return result;
  });
  expect(towns.harbor.money).toBe(24000);
  expect(towns.garden.money).toBe(22000);
  expect(towns.commerce.money).toBe(28000);
  expect(towns.harbor.layout).not.toEqual(towns.garden.layout);
  expect(towns.harbor.layout).not.toEqual(towns.commerce.layout);
  expect(towns.garden.goals.find((goal) => goal.label.includes("公园")).target).toBe(4);
  expect(towns.commerce.goals.find((goal) => goal.label.includes("商店")).target).toBe(5);
  for (const [id, town] of Object.entries(towns)) {
    expect(town.demo).toMatchObject({ scenario: id, claims: [], decisions: [], festival: false });
    expect(town.buildingCount).toBeGreaterThanOrEqual(5);
    expect(town.art.decoratedBuildings).toBe(town.buildingCount);
  }
  await expect(page.locator("#demoScenarioName")).toContainText("晴日港");
  await expect(page.locator("#requestBoard")).toContainText("先让水龙头唱歌");
});

test("letters require actual services and cannot be farmed by repeated claims or undo", async ({ page }) => {
  const result = await page.evaluate(() => {
    const game = window.sunnyTownTest;
    window.demoQa.start();
    const premature = game.demo.claim("water");
    const supplied = window.demoQa.utilities(75);
    const before = game.getState();
    const claimed = game.demo.claim("water");
    const rewarded = game.getState();
    const repeated = game.demo.claim("water");
    const undoOldConstruction = game.undo();
    const afterInvalidActions = game.getState();
    const builtAfterReward = window.demoQa.build("residential");
    const undoNewConstruction = game.undo();
    const afterUndo = game.getState();
    return { premature, supplied, before, claimed, rewarded, repeated, undoOldConstruction, afterInvalidActions, builtAfterReward, undoNewConstruction, afterUndo };
  });
  expect(result.premature).toBe(false);
  expect(result.supplied).toBe(true);
  expect(result.claimed).toBe(true);
  expect(result.rewarded.stats.money - result.before.stats.money).toBe(1800);
  expect(result.rewarded.undoDepth).toBe(0);
  expect(result.repeated).toBe(false);
  expect(result.undoOldConstruction).toBe(false);
  expect(result.afterInvalidActions.stats.money).toBe(result.rewarded.stats.money);
  expect(result.builtAfterReward).toBe(true);
  expect(result.undoNewConstruction).toBe(true);
  expect(result.afterUndo.demo.claims).toEqual(["water"]);
  expect(result.afterUndo.stats.money).toBe(result.rewarded.stats.money);
  expect(result.afterUndo.buildingCount).toBe(result.rewarded.buildingCount);
});

test("municipal choices enforce affordability, consume the budget once and change actual income", async ({ page }) => {
  const result = await page.evaluate(() => {
    const game = window.sunnyTownTest;
    window.demoQa.start();
    window.demoQa.utilities();
    game.advanceWeek(24); // Let the opening neighborhood settle before comparing policy effects.
    game.setMoney(1499);
    const broke = game.demo.choose("welcome", 0);
    const brokeState = game.getState();
    const disabled = document.querySelector('[data-decision="welcome"][data-option="0"]').disabled;
    game.setMoney(10000);
    game.recompute();
    const before = game.getState();
    const accepted = game.demo.choose("welcome", 0);
    const after = game.getState();
    const repeated = game.demo.choose("welcome", 0);
    const malformed = game.demo.choose("waterfront", 0.5);
    const final = game.getState();
    return { broke, brokeState, disabled, before, accepted, after, repeated, malformed, final };
  });
  expect(result.broke).toBe(false);
  expect(result.brokeState.stats.money).toBe(1499);
  expect(result.brokeState.demo.decisions).toEqual([]);
  expect(result.disabled).toBe(true);
  expect(result.accepted).toBe(true);
  expect(result.after.stats.money).toBe(result.before.stats.money - 1500);
  expect(result.after.stats.income).toBeGreaterThan(result.before.stats.income);
  expect(result.after.stats.happiness).toBeLessThanOrEqual(result.before.stats.happiness);
  expect(result.after.demo.decisions).toEqual([{ id: "welcome", option: 0 }]);
  expect(result.after.undoDepth).toBe(0);
  expect(result.repeated).toBe(false);
  expect(result.malformed).toBe(false);
  expect(result.final.stats.money).toBe(result.after.stats.money);
});

test("version 3 saves restore story rewards, policies and map view while version 2 remains playable", async ({ page }) => {
  const result = await page.evaluate(() => {
    const game = window.sunnyTownTest;
    window.demoQa.start();
    window.demoQa.utilities(75);
    game.demo.claim("water");
    game.advanceWeek(2);
    game.demo.choose("welcome", 2);
    document.querySelector('[data-view="services"]').click();
    const snapshot = game.serializeGame();
    window.demoQa.start("garden");
    const restored = game.loadSave(snapshot);
    const current = game.getState();
    const viewActive = document.querySelector('[data-view="services"]').getAttribute("aria-pressed");
    const legacy = JSON.parse(JSON.stringify(snapshot));
    legacy.version = 2;
    delete legacy.city.demo;
    delete legacy.city.population;
    const migrated = game.loadSave(legacy);
    const afterMigration = game.getState();
    const nextSave = game.serializeGame();
    return { snapshot, restored, current, viewActive, migrated, afterMigration, nextSave };
  });
  expect(result.snapshot.version).toBe(3);
  expect(result.snapshot.city.demo.claims).toContain("water");
  expect(result.snapshot.city.demo.decisions).toEqual([{ id: "welcome", option: 2 }]);
  expect(result.restored).toBe(true);
  expect(result.current.demo).toEqual(result.snapshot.city.demo);
  expect(result.current.stats.money).toBe(result.snapshot.city.money);
  expect(result.current.week).toBe(result.snapshot.city.week);
  expect(result.current.buildingCount).toBe(result.snapshot.city.buildings.length);
  expect(result.viewActive).toBe("true");
  expect(result.migrated).toBe(true);
  expect(result.afterMigration.demo).toBeNull();
  expect(result.afterMigration.buildingCount).toBe(result.snapshot.city.buildings.length);
  expect(result.nextSave.version).toBe(3);
  expect(result.nextSave.city.demo).toBeNull();
});

test("malformed imported saves are rejected before touching the current town or stored save", async ({ page }) => {
  const attempts = await page.evaluate(() => {
    const game = window.sunnyTownTest;
    window.demoQa.start("commerce");
    const baseline = game.serializeGame();
    const storedBefore = localStorage.getItem("sunny-town-story.save.v1");
    const mutations = [
      ["unsupported version", (save) => { save.version = 99; }],
      ["non-array roads", (save) => { save.city.tiles = {}; }],
      ["duplicate occupied tile", (save) => { save.city.tiles.push({ ...save.city.tiles[0] }); }],
      ["outside map", (save) => { save.city.tiles[0].x = 18; }],
      ["fractional coordinate", (save) => { save.city.tiles[0].x = 0.5; }],
      ["unknown building", (save) => { save.city.buildings[0].type = "unregistered-building"; }],
      ["non-finite balance", (save) => { save.city.money = NaN; }],
      ["fractional week", (save) => { save.city.week = 1.5; }],
      ["unknown story", (save) => { save.city.demo.scenario = "missing-town"; }],
    ];
    return mutations.map(([name, mutate]) => {
      const invalid = JSON.parse(JSON.stringify(baseline));
      mutate(invalid);
      const accepted = game.loadSave(invalid);
      return {
        name, accepted,
        townPreserved: JSON.stringify(game.serializeGame().city) === JSON.stringify(baseline.city),
        storagePreserved: localStorage.getItem("sunny-town-story.save.v1") === storedBefore,
      };
    });
  });
  for (const attempt of attempts) {
    expect(attempt, attempt.name).toMatchObject({ accepted: false, townPreserved: true, storagePreserved: true });
  }
});

test("Escape cancels a journey confirmation without dismissing the menu or changing the paused town", async ({ page }) => {
  await page.goto("/");
  await page.locator("#startDemoButton").click();
  await expect(page.locator("#welcomeOverlay")).toBeHidden();
  await page.locator("#pauseButton").click();
  await expect(page.locator("#pauseButton")).toHaveText("继续");
  const before = await page.evaluate(() => ({
    save: localStorage.getItem("sunny-town-story.save.v1"),
    week: document.getElementById("weekLabel").textContent,
    money: document.getElementById("money").textContent,
    population: document.getElementById("population").textContent,
  }));
  await page.locator("#townMenuButton").click();
  await page.locator('[data-scenario="garden"]').click();
  await page.locator("#startDemoButton").click();
  await expect(page.locator("#demoModal")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#demoModal")).toBeHidden();
  await expect(page.locator("#welcomeOverlay")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("sunny-town-story.save.v1"))).toBe(before.save);
  await page.locator("#welcomeCloseButton").click();
  await expect(page.locator("#welcomeOverlay")).toBeHidden();
  await expect(page.locator("#pauseButton")).toHaveText("继续");
  await expect(page.locator("#demoScenarioName")).toContainText("晴日港");
  await expect(page.locator("#weekLabel")).toHaveText(before.week);
  await expect(page.locator("#money")).toHaveText(before.money);
  await expect(page.locator("#population")).toHaveText(before.population);
});

test("the actual legacy-file import clears the previous story checklist and progress UI", async ({ page }) => {
  const legacy = await page.evaluate(() => {
    window.demoQa.start("garden");
    const save = window.sunnyTownTest.serializeGame();
    save.version = 2;
    delete save.city.demo;
    delete save.city.population;
    return save;
  });
  await expect(page.locator("#demoJournal")).toContainText("春日祭典清单");
  await expect(page.locator('#demoJournal [data-demo-action="festival"]')).toHaveCount(1);
  await page.locator("#importSaveInput").setInputFiles({
    name: "legacy-town-v2.json", mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(legacy)),
  });
  await expect(page.locator("#demoModal")).toBeVisible();
  await page.locator("#demoModalActions button").filter({ hasText: "导入并继续" }).click();
  await expect(page.locator("#demoModal")).toBeHidden();
  await expect(page.locator("#demoScenarioName")).toContainText("自由建设");
  await expect(page.locator("#demoJournal")).not.toContainText("春日祭典清单");
  await expect(page.locator('#demoJournal [data-demo-action="festival"]')).toHaveCount(0);
  await expect(page.locator("#demoGoalProgress")).toHaveJSProperty("value", 0);
  const result = await page.evaluate(() => ({
    state: window.sunnyTownTest.getState(),
    saved: JSON.parse(localStorage.getItem("sunny-town-story.save.v1")),
  }));
  expect(result.state.demo).toBeNull();
  expect(result.state.week).toBe(legacy.city.week);
  expect(result.state.stats.money).toBe(legacy.city.money);
  expect(result.state.buildingCount).toBe(legacy.city.buildings.length);
  expect(result.saved.city.demo).toBeNull();
  expect(result.saved.version).toBe(3);
});

test("a festival finale imported while running blocks simulation and background keyboard input", async ({ page }) => {
  // A save-lifecycle fixture; the campaign tests below earn their festival.
  const finaleSave = await page.evaluate(() => {
    const game = window.sunnyTownTest;
    window.demoQa.start("harbor");
    const save = game.serializeGame();
    save.city.demo.festival = true;
    save.city.demo.continued = false;
    save.city.demo.festivalWeek = save.city.week;
    return save;
  });
  await page.locator("#pauseButton").click();
  await expect(page.locator("#pauseButton")).toHaveText("暂停");
  await page.locator("#speedButton").click();
  await page.locator("#speedButton").click();
  await page.locator("#importSaveInput").setInputFiles({
    name: "festival-finale.json", mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(finaleSave)),
  });
  await page.locator("#demoModalActions button").filter({ hasText: "导入并继续" }).click();
  await expect(page.locator("#demoFinale")).toBeVisible();
  const before = await page.evaluate(() => window.sunnyTownTest.getState());
  expect(Number.isFinite(before.weekProgress)).toBe(true);
  expect(await page.locator("#pauseButton").evaluate((button) => {
    button.focus();
    return document.activeElement === button;
  })).toBe(false);
  await page.keyboard.press("2");
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest("#demoFinale")))).toBe(true);
  // Sub-week progress catches unwanted simulation even at a blocked 1 fps.
  await page.waitForTimeout(1200);
  const after = await page.evaluate(() => window.sunnyTownTest.getState());
  expect(after.weekProgress).toBe(before.weekProgress);
  expect(after.week).toBe(before.week);
  expect(after.stats.money).toBe(before.stats.money);
  expect(after.selectedTool).toBe(before.selectedTool);
  expect(after.demo.continued).toBe(false);
  await page.locator("#keepPlayingButton").click();
  await expect(page.locator("#demoFinale")).toBeHidden();
  expect(await page.evaluate(() => window.sunnyTownTest.getState().demo.continued)).toBe(true);

  // The normal fresh-page load must restore the blocking finale as well.
  await page.evaluate((save) => localStorage.setItem("sunny-town-story.save.v1", JSON.stringify(save)), finaleSave);
  await page.goto("/");
  await page.locator("#continueDemoButton").click();
  await expect(page.locator("#demoFinale")).toBeVisible();
  expect(await page.locator("#pauseButton").evaluate((button) => {
    button.focus();
    return document.activeElement === button;
  })).toBe(false);
});

const storyCases = [
  { id: "harbor", openingMoney: 24000, population: 320, happiness: 78, parks: 2, shops: 3 },
  { id: "garden", openingMoney: 22000, population: 260, happiness: 86, parks: 4, shops: 3 },
  { id: "commerce", openingMoney: 28000, population: 400, happiness: 76, parks: 2, shops: 5 },
];

for (const story of storyCases) {
  test(story.id + ": visible letters and real weekly revenue fund the spring festival", async ({ page }) => {
    test.setTimeout(120000);
    const result = await page.evaluate((scenario) => {
      const game = window.sunnyTownTest;
      const qa = window.demoQa;
      qa.start(scenario.id);
      const openingMoney = game.getState().stats.money;
      const premature = game.demo.hostFestival();
      let minimumMoney = openingMoney;
      let spentOnConstruction = 0;
      let previousPopulation = game.getState().stats.population;
      let stagnantWeeks = 0;
      const milestones = [];
      const visibleClaims = [];
      const count = (state, type) => state.buildings.filter((building) => building.type === type).length;
      const recordMoney = () => { minimumMoney = Math.min(minimumMoney, game.getState().stats.money); };
      const spend = (action) => {
        const before = game.getState().stats.money;
        const succeeded = action();
        if (succeeded) spentOnConstruction += before - game.getState().stats.money;
        recordMoney();
        return succeeded;
      };
      const build = (type) => spend(() => qa.build(type));
      const upgrade = (type) => {
        const candidates = game.getState().buildings.filter((building) => building.type === type)
          .sort((a, b) => a.level - b.level);
        for (const building of candidates) {
          if (!game.upgradeState(building.x, building.z).ok) continue;
          game.setSelectedTile(building.x, building.z);
          if (spend(() => game.upgradeSelectedBuilding())) return true;
        }
        return false;
      };
      const improveRoad = () => {
        const current = game.getState();
        const lane = [...current.roads].filter((road) => road.tier === "lane").sort((a, b) => b.load - a.load)[0];
        if (lane) return spend(() => game.place("road", lane.x, lane.z, { tier: "avenue" }));
        const desired = [];
        for (const z of [5, 7, 9, 11, 13]) for (let x = 4; x <= 13; x += 1) desired.push({ x, z });
        for (const x of [4, 8, 13]) for (let z = 5; z <= 13; z += 1) desired.push({ x, z });
        const target = desired.find((candidate) => {
          if (!game.canBuild("road", candidate.x, candidate.z).ok) return false;
          const tile = current.tiles.find((item) => item.x === candidate.x && item.z === candidate.z);
          return tile.type === "grass" && current.roads.some((road) => Math.abs(road.x - tile.x) + Math.abs(road.z - tile.z) === 1);
        });
        return target ? spend(() => game.place("road", target.x, target.z, { tier: "avenue" })) : false;
      };
      const improveHappiness = (current) => {
        if (current.stats.traffic < 70 && improveRoad()) return true;
        if (current.stats.education < 35 && (upgrade("school") || build("school"))) return true;
        if (current.demo.claims.length >= 3 && current.stats.fire < 35 && (upgrade("fire") || build("fire"))) return true;
        if (current.stats.culture < 30 && count(current, "plaza") < 3 && build("plaza")) return true;
        return upgrade("park") || (count(current, "park") < 10 && build("park"));
      };

      for (let turn = 0; turn < 220; turn += 1) {
        visibleClaims.push(...qa.claimReady());
        const decision = game.demo.getState().decision;
        if (decision) {
          const option = { welcome: 1, waterfront: 0, weekend: 1, festival: 0 }[decision];
          // Use actual municipal buttons and their actual affordability guards.
          const button = document.querySelector('[data-decision="' + decision + '"][data-option="' + option + '"]');
          if (button && !button.disabled && button.getClientRects().length) {
            button.scrollIntoView({ block: "nearest" });
            button.click();
            recordMoney();
          }
        }
        const current = game.getState();
        recordMoney();
        stagnantWeeks = current.stats.population <= previousPopulation ? stagnantWeeks + 1 : 0;
        previousPopulation = current.stats.population;
        if (turn % 12 === 0) milestones.push({
          week: current.week, population: current.stats.population, capacity: current.stats.capacity,
          happiness: Math.round(current.stats.happiness), money: Math.round(current.stats.money), net: current.report.net,
          claims: [...current.demo.claims],
          visibleLetters: [...document.querySelectorAll("#requestBoard .request-card strong")].map((node) => node.textContent),
          buildings: current.buildingCount, education: Math.round(current.stats.education), culture: Math.round(current.stats.culture),
          fire: Math.round(current.stats.fire),
          types: Object.fromEntries(["residential", "commercial", "park", "school", "plaza", "fire"].map((type) => [type, count(current, type)])),
        });
        if (game.demo.progress().every((goal) => goal.value >= goal.target) && current.stats.money >= 6500) break;

        let acted = false;
        if (current.stats.water < 92) acted = upgrade("water") || build("water");
        else if (current.stats.power < 92) acted = upgrade("power") || build("power");
        else if (current.stats.traffic < 58) acted = improveRoad();
        else if (count(current, "residential") < 6) acted = build("residential");
        else if (count(current, "commercial") < scenario.shops || current.stats.employmentRate < 86) acted = upgrade("commercial") || build("commercial");
        else if (count(current, "park") < scenario.parks) acted = build("park");
        else if (count(current, "school") < 1) acted = build("school");
        else if (count(current, "plaza") < 1) acted = build("plaza");
        else if (current.roads.filter((road) => road.tier === "avenue").length < 12 || current.stats.traffic < 65) acted = improveRoad();
        else if (current.stats.population < scenario.population) {
          // Wait for ordinary weekly growth when homes have room. Add capacity
          // if the town has stopped filling; purchases never advance population.
          if (current.stats.population >= current.stats.capacity * 0.78 || stagnantWeeks >= 3) {
            acted = upgrade("residential") || build("residential");
          }
          if (!acted && current.stats.happiness < scenario.happiness) acted = improveHappiness(current);
        } else if (current.stats.happiness < scenario.happiness) acted = improveHappiness(current);
        else if (current.demo.claims.length < 6 && current.stats.education < 35) acted = upgrade("school") || build("school");
        else if (current.demo.claims.length < 6 && current.demo.claims.length >= 3 && current.stats.fire < 35) acted = upgrade("fire") || build("fire");
        else if (current.demo.claims.length < 6) acted = upgrade("residential") || upgrade("school");

        if (!acted && current.stats.money > 6500 && current.buildingCount < 60 && stagnantWeeks >= 3) improveRoad();
        // Only normal weekly simulation: no injected money, population,
        // happiness, stamps or completed municipal decisions.
        game.advanceWeek();
        recordMoney();
      }
      visibleClaims.push(...qa.claimReady());
      const beforeFestival = game.getState();
      const goals = game.demo.progress();
      document.querySelector('[data-panel="letters"]')?.click();
      const festivalButton = document.querySelector('[data-demo-action="festival"]');
      const canHostThroughUi = Boolean(festivalButton && !festivalButton.disabled && festivalButton.getClientRects().length);
      if (canHostThroughUi) {
        festivalButton.scrollIntoView({ block: "nearest" });
        festivalButton.click();
      }
      const afterFestival = game.getState();
      recordMoney();
      const repeatFestival = game.demo.hostFestival();
      const afterRepeat = game.getState();
      const save = game.serializeGame();
      return { openingMoney, premature, minimumMoney, spentOnConstruction, milestones, visibleClaims, goals, canHostThroughUi, repeatFestival, beforeFestival, afterFestival, afterRepeat, save };
    }, story);

    console.log("[demo acceptance] " + story.id + ": week " + result.afterFestival.week +
      "; population " + result.afterFestival.stats.population + "; happiness " + Math.round(result.afterFestival.stats.happiness) +
      "; minimum balance " + Math.round(result.minimumMoney) + "; visible letters " + result.visibleClaims.join(",") + "; no injected funds.");
    const diagnostics = JSON.stringify({ scenario: story.id, goals: result.goals, milestones: result.milestones });
    expect(result.premature).toBe(false);
    expect(result.openingMoney).toBe(story.openingMoney);
    expect(result.minimumMoney, diagnostics).toBeGreaterThanOrEqual(0);
    expect(result.spentOnConstruction).toBeGreaterThan(result.openingMoney);
    expect(result.goals.every((goal) => goal.value >= goal.target), diagnostics).toBe(true);
    expect(result.beforeFestival.stats.population).toBeGreaterThanOrEqual(story.population);
    expect(result.beforeFestival.stats.happiness).toBeGreaterThanOrEqual(story.happiness);
    expect(result.beforeFestival.buildings.filter((building) => building.type === "park").length).toBeGreaterThanOrEqual(story.parks);
    expect(result.beforeFestival.buildings.filter((building) => building.type === "commercial").length).toBeGreaterThanOrEqual(story.shops);
    expect(new Set(result.visibleClaims).size).toBe(result.visibleClaims.length);
    expect(result.visibleClaims).toEqual(result.beforeFestival.demo.claims);
    expect(result.canHostThroughUi, diagnostics).toBe(true);
    expect(result.afterFestival.stats.money).toBe(result.beforeFestival.stats.money - 6500);
    expect(result.afterFestival.demo.festival).toBe(true);
    expect(result.afterFestival.demo.festivalWeek).toBe(result.beforeFestival.week);
    expect(result.repeatFestival).toBe(false);
    expect(result.afterRepeat.stats.money).toBe(result.afterFestival.stats.money);
    expect(result.save.city.demo.festival).toBe(true);
    expect(result.afterFestival.art.decoratedBuildings).toBe(result.afterFestival.buildingCount);
    await expect(page.locator("#demoFinale")).toBeVisible();
    await expect(page.locator("#demoFinaleSummary")).toContainText("春日祭典");
    await page.screenshot({ path: "test-results/demo-" + story.id + "-festival.png" });
    await page.locator("#keepPlayingButton").click();
    await expect(page.locator("#demoFinale")).toBeHidden();
    await page.screenshot({ path: "test-results/demo-" + story.id + "-town.png" });
    require('node:fs').writeFileSync('test-results/demo-' + story.id + '-save.json', JSON.stringify(await page.evaluate(() => window.sunnyTownTest.serializeGame()), null, 2));
    await page.locator('#neighborhoodOpenButton').click();
    await page.screenshot({ path: 'test-results/demo-' + story.id + '-neighborhoods.png' });
    await page.locator('#photoModeButton').click();
    await expect(page.locator('#photoModeBar')).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/demo-' + story.id + '-photo.png' });
    await page.keyboard.press('Escape');
    await expect(page.locator('#photoModeBar')).toBeHidden();
  });
}
