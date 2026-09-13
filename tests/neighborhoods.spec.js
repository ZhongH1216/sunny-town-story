const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

// These pure computation/controller tests deliberately request no browser fixtures.
// The game uses browser ESM in a CommonJS tool repository; a data URL imports the exact source.
let neighborhoods;
test.beforeAll(async () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/neighborhoods.js'), 'utf8');
  neighborhoods = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
});

const building = (type, x, z, extra = {}) => ({ id: `${type}-${x}-${z}`, type, x, z, ...extra });
const allConnected = () => true;
const stars = (buildings, id, connected = allConnected) => neighborhoods.analyzeNeighborhoods(buildings, connected).districts.find(district => district.id === id).stars;
function layout(id, level = 3, offset = 0) {
  const b = (type, x, z) => building(type, x + offset, z);
  if (id === 'workshop') return [b('industrial', 5, 5), b('commercial', 5, 4), ...(level >= 2 ? [b('industrial', 6, 5)] : []), ...(level >= 3 ? [b('fire', 5, 7), b('station', 7, 5)] : [])];
  if (id === 'market') return [b('plaza', 5, 5), b('commercial', 5, 4), b('commercial', 5, 6), ...(level >= 2 ? [b('commercial', 4, 5), b('residential', 6, 5)] : []), ...(level >= 3 ? [b('commercial', 4, 4), b('lantern', 7, 5)] : [])];
  return [b(id === 'garden' ? 'park' : 'school', 5, 5), b('residential', 5, 4), b('residential', 5, 6), ...(level >= 2 ? [b('residential', 4, 5), b('park', 6, 5)] : []), ...(level >= 3 ? [b('residential', 4, 4), b('plaza', 7, 5)] : [])];
}

for (const id of ['garden', 'market', 'school', 'workshop']) {
  test(`${id} requires cumulative spatial conditions for each star`, () => {
    for (const level of [1, 2, 3]) expect(stars(layout(id, level), id)).toBe(level);
    const buildings = layout(id, 3);
    const anchor = buildings[0];
    // Detached supporting buildings and an isolated anchor cannot earn its former stars.
    expect(stars(buildings, id, b => b.type === anchor.type)).toBe(0);
    expect(stars(buildings, id, () => false)).toBe(0);
    if (id !== 'workshop') {
      const sparse = layout(id, 1);
      const spreadOut = sparse.map((b, index) => index === 0 ? b : { ...b, x: b.x + 20 });
      expect(stars(spreadOut, id)).toBe(0);
    }
  });
}

test('orthogonal distances and physical pollution cannot be bypassed by a disconnected factory', () => {
  const garden = [building('park', 5, 5), building('residential', 7, 6), building('residential', 5, 2)];
  expect(stars(garden, 'garden')).toBe(1); // Both homes exactly three orthogonal steps away.
  expect(stars([garden[0], { ...garden[1], x: 8 }, garden[2]], 'garden')).toBe(0);
  const factory = building('industrial', 8, 6, { active: false });
  expect(stars([...garden, factory], 'garden', b => b.type !== 'industrial')).toBe(0);
  expect(stars([...layout('school', 1), building('industrial', 5, 2)], 'school')).toBe(0);
  expect(stars([...layout('market', 1), building('industrial', 7, 5)], 'market')).toBe(0);
});

test('workshop isolation measures every home and drops before the fourth grid step', () => {
  const base = layout('workshop', 1);
  const connected = b => b.type !== 'residential';
  expect(stars([...base, building('residential', 5, 8)], 'workshop', connected)).toBe(0);
  expect(stars([...base, building('residential', 5, 9)], 'workshop', connected)).toBe(1);
  // An extra factory near a home cannot be used to gain the second star.
  expect(stars([...base, building('industrial', 6, 5), building('residential', 8, 6)], 'workshop', connected)).toBe(1);
});

test('only the best location per theme counts and total weekly income is capped at 250', () => {
  const buildings = ['garden', 'market', 'school', 'workshop'].flatMap((id, index) => layout(id, 3, index * 20));
  const analysis = neighborhoods.analyzeNeighborhoods(buildings, allConnected);
  expect(analysis.count).toBe(4);
  expect(analysis.totalStars).toBe(12);
  expect(analysis.rawIncome).toBe(300);
  expect(analysis.income).toBe(250);
  expect(analysis.capped).toBe(true);
  const duplicatedTheme = neighborhoods.analyzeNeighborhoods([...layout('garden', 3), ...layout('garden', 3, 20)], allConnected);
  expect(duplicatedTheme.count).toBe(1);
  expect(duplicatedTheme.income).toBe(75);
  expect(neighborhoods.analyzeNeighborhoods([...buildings].reverse(), allConnected)).toEqual(analysis);
});

test('malformed and duplicate buildings cannot inflate a layout and analysis never changes input', () => {
  const base = layout('garden', 1);
  const frozen = base.map(b => Object.freeze(b));
  Object.freeze(frozen);
  expect(stars(frozen, 'garden')).toBe(1);
  const duplicate = { ...base[1], id: 'another-id-on-the-same-tile' };
  expect(stars([base[0], base[1], duplicate, null, building('residential', NaN, 5), building('residential', 5.5, 6), building('made-up', 5, 6)], 'garden')).toBe(0);
  expect(neighborhoods.analyzeNeighborhoods(null, allConnected).income).toBe(0);
  expect(neighborhoods.analyzeNeighborhoods(base).income).toBe(0);
  expect(neighborhoods.analyzeNeighborhoods(Array.from({ length: 500 }, () => base[0]), allConnected).income).toBe(0);
});

test('old saves default safely and only four independent claimed IDs survive normalization', () => {
  const empty = { version: 1, claimed: [], focus: null };
  for (const raw of [undefined, null, [], 17, 'garden', { claimed: 'garden', focus: 'unknown' }]) expect(neighborhoods.normalizeNeighborhoods(raw)).toEqual(empty);
  const source = { version: 99, claimed: ['garden', 'garden', 'water', 'workshop', '__proto__', null], focus: 'market', money: 999999, income: 999999 };
  const copy = JSON.stringify(source);
  expect(neighborhoods.normalizeNeighborhoods(source)).toEqual({ version: 1, claimed: ['garden', 'workshop'], focus: 'market' });
  expect(JSON.stringify(source)).toBe(copy);
});

test('claim is once per theme, clears stale undo, survives rebuilding and save reload', () => {
  const city = { buildings: layout('garden', 1), stats: { money: 1000 }, undoStack: [{ money: 1000 }], demo: { claims: [] }, life: { completed: 0 } };
  let saves = 0;
  const controller = neighborhoods.createNeighborhoods({ city, isConnected: allConnected, saveGame: () => { saves += 1; } });
  expect(controller.claim('garden')).toBe(true);
  expect(city.stats.money).toBe(1600);
  expect(city.undoStack).toEqual([]);
  expect(controller.claim('garden')).toBe(false);
  expect(controller.claim('water')).toBe(false);
  city.buildings = [];
  expect(controller.weekIncome()).toBe(0);
  city.buildings = layout('garden', 3);
  city.neighborhoods = neighborhoods.normalizeNeighborhoods(JSON.parse(JSON.stringify(city.neighborhoods)));
  expect(controller.claim('garden')).toBe(false);
  expect(city.stats.money).toBe(1600);
  expect(saves).toBe(1);
  expect(city.demo).toEqual({ claims: [] });
  expect(city.life).toEqual({ completed: 0 });
});

test('analyze, rendering, preview and repeated income quotes never settle money or grant rewards', () => {
  const city = { buildings: [building('park', 5, 5), building('residential', 5, 4)], stats: { money: 1000 }, neighborhoods: neighborhoods.normalizeNeighborhoods() };
  const controller = neighborhoods.createNeighborhoods({ city, isConnected: allConnected });
  const before = JSON.stringify(city);
  for (let i = 0; i < 20; i += 1) {
    expect(controller.weekIncome()).toBe(0);
    controller.analyze();
    controller.render();
    const preview = controller.preview('residential', 5, 6);
    expect(preview.incomeDelta).toBe(35);
    expect(preview.changes).toContainEqual({ id: 'garden', title: '花园里巷', fromStars: 0, toStars: 1 });
  }
  expect(JSON.stringify(city)).toBe(before);
  expect(controller.claim('garden')).toBe(false);
});

test('preview exposes lost stars from pollution and demolition, and refuses occupied locations', () => {
  const city = { buildings: layout('garden', 1), stats: { money: 1000 } };
  const controller = neighborhoods.createNeighborhoods({ city, isConnected: allConnected });
  const before = JSON.stringify(city);
  const polluted = controller.preview('industrial', 6, 5);
  expect(polluted.incomeDelta).toBe(-35);
  expect(polluted.text).toContain('至少隔开 4 格');
  expect(controller.preview('bulldoze', 5, 5).incomeDelta).toBe(-35);
  expect(controller.preview('commercial', 5, 5).valid).toBe(false);
  expect(controller.preview('road', 6, 5).estimated).toBe(true);
  expect(JSON.stringify(city)).toBe(before);
});

test('revision caching avoids repeated neighbor work and refreshes ghost connectivity after road edits', () => {
  let revision = 1;
  let ghostConnected = false;
  let calls = 0;
  const city = { buildings: [building('park', 5, 5), building('residential', 5, 4)], stats: { money: 1000 } };
  const controller = neighborhoods.createNeighborhoods({ city, getRevision: () => revision, isConnected: b => { calls += 1; return b.id !== 'neighborhood-preview' || ghostConnected; } });
  const first = controller.analyze();
  const analyzedCalls = calls;
  for (let i = 0; i < 20; i += 1) expect(controller.analyze()).toBe(first);
  expect(calls).toBe(analyzedCalls);
  expect(controller.preview('residential', 5, 6).incomeDelta).toBe(0);
  const previewCalls = calls;
  for (let i = 0; i < 20; i += 1) expect(controller.preview('residential', 5, 6).incomeDelta).toBe(0);
  expect(calls).toBe(previewCalls);
  ghostConnected = true;
  revision += 1;
  expect(controller.preview('residential', 5, 6).incomeDelta).toBe(35);
});

test('claim rechecks the actual connected map even if the host has not yet bumped its revision', () => {
  let connected = true;
  const city = { buildings: layout('garden', 1), stats: { money: 1000 } };
  const controller = neighborhoods.createNeighborhoods({ city, getRevision: () => 1, isConnected: () => connected });
  expect(controller.analyze().income).toBe(35);
  connected = false;
  expect(controller.claim('garden')).toBe(false);
  expect(city.stats.money).toBe(1000);
});

test('focus is free guidance and cannot alter placement permissions or weekly income', () => {
  const city = { buildings: layout('garden', 1), stats: { money: 1000 }, selectedTool: 'commercial', undoStack: [{ id: 'construction' }] };
  const controller = neighborhoods.createNeighborhoods({ city, isConnected: allConnected, canBuild: type => ({ ok: type !== 'industrial' }) });
  expect(controller.focus('workshop')).toBe(true);
  expect(city.neighborhoods.focus).toBe('workshop');
  expect(controller.weekIncome()).toBe(35);
  expect(city.stats.money).toBe(1000);
  expect(city.selectedTool).toBe('commercial');
  expect(city.undoStack).toHaveLength(1);
  expect(controller.preview('industrial', 8, 8).valid).toBe(false);
  expect(controller.preview('residential', 8, 8).valid).toBe(true);
  expect(controller.focus('unknown')).toBe(false);
  expect(controller.focus(null)).toBe(true);
  expect(city.neighborhoods.focus).toBe(null);
});
