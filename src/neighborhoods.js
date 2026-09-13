// Layout bonuses are derived from the current map, never from rendering or elapsed wall time.
// The host owns weekly settlement. weekIncome() is a read-only quote, not a payment.
export const NEIGHBORHOOD_INCOME_CAP = 250;
export const NEIGHBORHOOD_FIRST_REWARD = 600;
const INCOME_BY_STARS = [0, 35, 55, 75];
const MAX_BUILDINGS = 324;
const MAX_COORDINATE = 1023;
const BUILDING_TYPES = new Set(['residential', 'commercial', 'industrial', 'park', 'school', 'fire', 'power', 'water', 'plaza', 'station', 'lantern']);

export const NEIGHBORHOOD_THEMES = Object.freeze([
  Object.freeze({ id: 'garden', title: '花园里巷', anchor: 'park', anchorName: '公园', description: '把绿地留在家门口，让工坊远离休息的街巷。', rules: Object.freeze(['公园 3 格内有 2 座住宅；中心与住宅 3 格内无工业', '再有第 3 座住宅和 3 格内另一座公园', '再有第 4 座住宅和 4 格内的小广场']) }),
  Object.freeze({ id: 'market', title: '商店街', anchor: 'plaza', anchorName: '小广场', description: '围着广场布置小店，再用灯光或车站迎接访客。', rules: Object.freeze(['小广场 3 格内有 2 间商业；广场 2 格内无工业', '再有第 3 间商业和 3 格内的住宅', '再有第 4 间商业和 3 格内的祭典灯或小车站']) }),
  Object.freeze({ id: 'school', title: '书香街坊', anchor: 'school', anchorName: '学校', description: '学校、公园和广场，串起步行可达的放学时光。', rules: Object.freeze(['学校 4 格内有 2 座住宅；中心与住宅 3 格内无工业', '再有第 3 座住宅和学校 3 格内的公园', '再有第 4 座住宅和学校 4 格内的小广场']) }),
  Object.freeze({ id: 'workshop', title: '匠人街区', anchor: 'industrial', anchorName: '工业工坊', description: '让工坊靠近展售的小店，把生产与住宅分开。', rules: Object.freeze(['工业工坊 3 格内有商业；参与工坊距所有住宅至少 4 格', '中心 3 格内再有另一间符合隔离条件的工坊', '中心 4 格内再有消防站和小车站']) }),
]);

const themeById = id => NEIGHBORHOOD_THEMES.find(theme => theme.id === id);
const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
const validCoordinate = value => Number.isInteger(value) && value >= 0 && value <= MAX_COORDINATE;
const yen = value => `¥${Math.round(value).toLocaleString('zh-CN')}`;
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

/** An optional, independent save field. Missing/old/malformed fields become safe defaults. */
export function normalizeNeighborhoods(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  // Iterate the four known IDs rather than unbounded imported arrays. Unknown reward IDs cannot pay.
  const claimed = NEIGHBORHOOD_THEMES.map(theme => theme.id).filter(id => Array.isArray(source.claimed) && source.claimed.includes(id));
  return { version: 1, claimed, focus: themeById(source.focus) ? source.focus : null };
}

function snapshot(buildings, connectedPredicate) {
  const seen = new Set();
  const result = [];
  for (const source of (Array.isArray(buildings) ? buildings : []).slice(0, MAX_BUILDINGS)) {
    if (!source || !BUILDING_TYPES.has(source.type) || !validCoordinate(source.x) || !validCoordinate(source.z)) continue;
    const key = `${source.x},${source.z}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      id: typeof source.id === 'string' || Number.isSafeInteger(source.id) ? source.id : key,
      type: source.type, x: source.x, z: source.z,
      connected: source.active !== false && typeof connectedPredicate === 'function' && Boolean(connectedPredicate(source)),
    });
  }
  return result.sort((a, b) => a.x - b.x || a.z - b.z || a.type.localeCompare(b.type));
}

const requirement = (label, current, target = 1) => ({ label, current, target, met: current >= target });
const presence = (label, present) => requirement(label, present ? 1 : 0);
const nearby = (buildings, anchor, radius) => anchor ? buildings.filter(building => distance(building, anchor) <= radius) : [];
const coordinates = building => building ? { id: building.id, type: building.type, x: building.x, z: building.z } : null;

function analyzeSnapshot(buildings) {
  const usable = buildings.filter(building => building.connected);
  const byType = type => usable.filter(building => building.type === type);
  // Isolation is physical: disconnected/dormant homes and factories still occupy their sites.
  const homes = buildings.filter(building => building.type === 'residential');
  const industry = buildings.filter(building => building.type === 'industrial');
  const clean = building => !industry.some(factory => distance(building, factory) <= 3);
  const cleanHomes = byType('residential').filter(clean);
  const isolatedIndustry = byType('industrial').filter(factory => !homes.some(home => distance(factory, home) <= 3));
  const parks = byType('park');
  const plazas = byType('plaza');
  const shops = byType('commercial');

  function candidate(theme, anchor) {
    const connected = presence(`已接通道路的${theme.anchorName}`, anchor?.connected);
    let tiers;
    let members = anchor ? [anchor] : [];
    if (theme.id === 'garden' || theme.id === 'school') {
      const radius = theme.id === 'garden' ? 3 : 4;
      const nearHomes = nearby(cleanHomes, anchor, radius);
      const nearParks = nearby(parks, anchor, 3).filter(park => park !== anchor);
      const nearPlazas = nearby(plazas, anchor, 4);
      const base = [connected, presence('中心 3 格内没有工业', !anchor || clean(anchor))];
      tiers = [
        [...base, requirement(`${radius} 格内的洁净住宅`, nearHomes.length, 2)],
        [...base, requirement(`${radius} 格内的洁净住宅`, nearHomes.length, 3), requirement('3 格内的另一座公园', nearParks.length)],
        [...base, requirement(`${radius} 格内的洁净住宅`, nearHomes.length, 4), requirement('3 格内的另一座公园', nearParks.length), requirement('4 格内的小广场', nearPlazas.length)],
      ];
      if (theme.id === 'school') for (const tier of tiers) for (const item of tier) if (item.label === '3 格内的另一座公园') item.label = '学校 3 格内的公园';
      members.push(...nearHomes, ...nearParks, ...nearPlazas);
    } else if (theme.id === 'market') {
      const nearShops = nearby(shops, anchor, 3);
      const nearHomes = nearby(byType('residential'), anchor, 3);
      const landmarks = nearby(usable.filter(building => ['lantern', 'station'].includes(building.type)), anchor, 3);
      const base = [connected, presence('广场 2 格内没有工业', !anchor || !industry.some(factory => distance(anchor, factory) <= 2))];
      tiers = [
        [...base, requirement('3 格内的商业', nearShops.length, 2)],
        [...base, requirement('3 格内的商业', nearShops.length, 3), requirement('3 格内的住宅', nearHomes.length)],
        [...base, requirement('3 格内的商业', nearShops.length, 4), requirement('3 格内的住宅', nearHomes.length), requirement('3 格内的祭典灯或小车站', landmarks.length)],
      ];
      members.push(...nearShops, ...nearHomes, ...landmarks);
    } else {
      const nearShops = nearby(shops, anchor, 3);
      const otherFactories = nearby(isolatedIndustry, anchor, 3).filter(factory => factory !== anchor);
      const fire = nearby(byType('fire'), anchor, 4);
      const stations = nearby(byType('station'), anchor, 4);
      const base = [connected, presence('中心工坊距所有住宅至少 4 格', !anchor || !homes.some(home => distance(home, anchor) <= 3)), requirement('3 格内的商业', nearShops.length)];
      tiers = [base, [...base, requirement('3 格内的另一间隔离工坊', otherFactories.length)], [...base, requirement('3 格内的另一间隔离工坊', otherFactories.length), requirement('4 格内的消防站', fire.length), requirement('4 格内的小车站', stations.length)]];
      members.push(...nearShops, ...otherFactories, ...fire, ...stations);
    }
    const levels = tiers.map((requirements, index) => ({ stars: index + 1, complete: requirements.every(item => item.met), requirements }));
    let stars = 0;
    for (const level of levels) { if (!level.complete) break; stars += 1; }
    const next = levels[stars];
    const missing = next ? next.requirements.filter(item => !item.met).map(item => `${item.label}（${Math.min(item.current, item.target)}/${item.target}）`) : [];
    const progress = next ? next.requirements.reduce((sum, item) => sum + Math.min(1, item.current / item.target), 0) / next.requirements.length : 1;
    members = [...new Set(members)].map(coordinates);
    return { id: theme.id, title: theme.title, stars, income: INCOME_BY_STARS[stars], anchor: coordinates(anchor), members, levels, missing, hint: stars === 3 ? '三星布局已形成，保持道路与隔离条件即可。' : `向 ${stars + 1} 星迈进：${missing.join('；')}`, progress };
  }

  const districts = NEIGHBORHOOD_THEMES.map(theme => {
    const anchors = buildings.filter(building => building.type === theme.anchor);
    const candidates = (anchors.length ? anchors : [null]).map(anchor => candidate(theme, anchor));
    // One best location per theme; adding overlapping anchors never multiplies the payout.
    candidates.sort((a, b) => b.stars - a.stars || b.progress - a.progress || (a.anchor?.x ?? 0) - (b.anchor?.x ?? 0) || (a.anchor?.z ?? 0) - (b.anchor?.z ?? 0));
    return candidates[0];
  });
  const rawIncome = districts.reduce((sum, district) => sum + district.income, 0);
  return {
    districts,
    count: districts.filter(district => district.stars > 0).length,
    totalStars: districts.reduce((sum, district) => sum + district.stars, 0),
    income: Math.min(NEIGHBORHOOD_INCOME_CAP, rawIncome), rawIncome,
    incomeCap: NEIGHBORHOOD_INCOME_CAP, capped: rawIncome > NEIGHBORHOOD_INCOME_CAP,
    hints: districts.map(district => ({ id: district.id, text: district.hint })),
  };
}

/** Pure computation. Distances are orthogonal grid steps; every contributing building must be connected. */
export function analyzeNeighborhoods(buildings, connectedPredicate) {
  return analyzeSnapshot(snapshot(buildings, connectedPredicate));
}

/**
 * Host API: {city, isConnected(building), saveGame(false), renderUI(), addMessage(text),
 * celebrate(title), toast?(text), canBuild?(type,x,z), getRevision?()}.
 * Optional isConnectedAfterPlacement(building,{type,x,z}) enables accurate road previews.
 * Save/load/reset/undo must include normalizeNeighborhoods(city.neighborhoods).
 * Call render() with ordinary UI updates, and add weekIncome() exactly once in week settlement.
 */
export function createNeighborhoods(api) {
  const { city } = api;
  let root = null;
  let renderedKey = '';
  let cachedKey = null;
  let cachedBuildings = null;
  let cachedAnalysis = null;
  let revision;
  let previewKey = '';
  let previewResult = null;
  const state = () => normalizeNeighborhoods(city.neighborhoods);

  function analyze() {
    const nextRevision = typeof api.getRevision === 'function' ? api.getRevision() : undefined;
    if (api.getRevision && cachedAnalysis && revision === nextRevision && cachedBuildings === city.buildings) return cachedAnalysis;
    const data = snapshot(city.buildings, api.isConnected);
    const key = JSON.stringify(data);
    if (key !== cachedKey || !cachedAnalysis) {
      cachedAnalysis = analyzeSnapshot(data);
      cachedKey = key;
      previewKey = '';
    }
    cachedBuildings = city.buildings;
    revision = nextRevision;
    return cachedAnalysis;
  }

  function invalidate() { cachedAnalysis = null; renderedKey = ''; previewKey = ''; }

  function changed(message) {
    renderedKey = '';
    if (message) { api.addMessage?.(message); api.toast?.(message); }
    api.saveGame?.(false);
    api.renderUI?.();
  }

  function claim(id) {
    const definition = themeById(id);
    const current = state();
    if (!definition || current.claimed.includes(id)) return false;
    // Never trust a displayed/cached entitlement when paying a reward.
    const district = analyzeNeighborhoods(city.buildings, api.isConnected).districts.find(item => item.id === id);
    const cash = city.stats?.money;
    if (!district?.stars || !Number.isFinite(cash) || Math.abs(cash) > Number.MAX_SAFE_INTEGER - NEIGHBORHOOD_FIRST_REWARD) return false;
    current.claimed.push(id);
    city.neighborhoods = current;
    city.stats.money += NEIGHBORHOOD_FIRST_REWARD;
    city.undoStack = [];
    api.celebrate?.(definition.title);
    changed(`街区灵感：${definition.title}首次成形，获得 ${yen(NEIGHBORHOOD_FIRST_REWARD)}。每种主题只可领取一次。`);
    return true;
  }

  function focus(id) {
    if (id !== null && !themeById(id)) return false;
    const current = state();
    if (current.focus === id) return true;
    current.focus = id;
    city.neighborhoods = current;
    changed();
    return true;
  }

  function preview(type, x, z) {
    const before = analyze();
    const current = state();
    const validType = BUILDING_TYPES.has(type) || ['road', 'bulldoze'].includes(type);
    if (!validType || !validCoordinate(x) || !validCoordinate(z)) return { valid: false, text: '', incomeDelta: 0, changes: [] };
    const check = api.canBuild?.(type, x, z);
    if (check === false || check?.ok === false) return { valid: false, text: '', incomeDelta: 0, changes: [] };
    const key = JSON.stringify([cachedKey, revision, current.focus, type, x, z]);
    // Without a layout revision, a new road can connect the ghost without changing existing buildings.
    // Re-evaluate that preview rather than retaining an apparently identical map signature.
    if (typeof api.getRevision === 'function' && key === previewKey && previewResult) return previewResult;
    const existing = (city.buildings || []).find(building => building.x === x && building.z === z);
    const roadChange = type === 'road' || (type === 'bulldoze' && !existing);
    if (roadChange && !api.isConnectedAfterPlacement) {
      previewKey = key;
      previewResult = { valid: true, text: '街区灵感：参与组合的建筑都要接通道路；道路变化后会重新评定星级。', incomeDelta: 0, changes: [], estimated: true };
      return previewResult;
    }
    let proposed = [...(city.buildings || [])];
    if (type === 'bulldoze') proposed = proposed.filter(building => building.x !== x || building.z !== z);
    else if (type !== 'road') {
      if (existing) return { valid: false, text: '', incomeDelta: 0, changes: [] };
      proposed.push({ id: 'neighborhood-preview', type, x, z, active: true });
    }
    const connected = api.isConnectedAfterPlacement ? building => api.isConnectedAfterPlacement(building, { type, x, z }) : api.isConnected;
    const after = analyzeNeighborhoods(proposed, connected);
    const changes = after.districts.flatMap(district => {
      const previous = before.districts.find(item => item.id === district.id);
      return district.stars === previous.stars ? [] : [{ id: district.id, title: district.title, fromStars: previous.stars, toStars: district.stars }];
    });
    const incomeDelta = after.income - before.income;
    const preferred = current.focus || ({ residential: 'garden', park: 'garden', school: 'school', plaza: 'market', commercial: 'market', industrial: 'workshop', fire: 'workshop', station: 'workshop', lantern: 'market' })[type];
    const district = after.districts.find(item => item.id === preferred) || after.districts[0];
    let text;
    if (changes.length) {
      const descriptions = changes.map(change => `${change.title} ${change.fromStars}→${change.toStars} 星`);
      text = `街区灵感：${descriptions.join('；')}。游客收入 ${incomeDelta > 0 ? '+' : incomeDelta < 0 ? '−' : ''}${yen(Math.abs(incomeDelta))}/周${after.capped ? '（全城上限 ¥250）' : ''}。`;
    } else {
      text = `街区灵感 · ${district.title}：${district.hint}`;
    }
    if (type === 'industrial' || type === 'residential') {
      const opposite = type === 'industrial' ? 'residential' : 'industrial';
      const neighbors = proposed.filter(building => building.type === opposite);
      const nearest = neighbors.length ? Math.min(...neighbors.map(building => distance(building, { x, z }))) : Infinity;
      if (nearest <= 3) text += ` 工坊与住宅相距 ${nearest} 格；至少隔开 4 格，才能满足洁净街区条件。`;
    }
    previewKey = key;
    previewResult = { valid: true, text, incomeDelta, income: after.income, changes, estimated: false };
    return previewResult;
  }

  function render() {
    if (!root) return;
    const result = analyze();
    const current = state();
    const key = JSON.stringify([cachedKey, current]);
    if (key === renderedKey) return;
    renderedKey = key;
    const openRules = new Set([...root.querySelectorAll('details[open]')].map(details => details.dataset.neighborhoodRules));
    const oldFocus = root.contains(root.ownerDocument.activeElement) ? root.ownerDocument.activeElement : null;
    const focusedAction = oldFocus?.dataset.neighborhoodClaim !== undefined ? ['neighborhoodClaim', oldFocus.dataset.neighborhoodClaim] : oldFocus?.dataset.neighborhoodFocus !== undefined ? ['neighborhoodFocus', oldFocus.dataset.neighborhoodFocus] : null;
    root.innerHTML = `<header class="neighborhood-board-header"><div><span class="eyebrow">把邻近变成风景</span><h3>街区灵感</h3></div><strong data-neighborhood-income>${yen(result.income)} / 周</strong></header><p class="neighborhood-intro">${result.count} / 4 种街区已成形。每种只计算最好的一处，全城游客收入最多 ¥250 / 周。格距按横竖步数计算，所有参与建筑都须接通道路；升星条件逐级累加。</p><div class="neighborhood-grid">${result.districts.map(district => {
      const theme = themeById(district.id);
      const claimed = current.claimed.includes(theme.id);
      const focused = current.focus === theme.id;
      return `<article class="neighborhood-card${focused ? ' is-focused' : ''}${district.stars ? ' is-formed' : ''}" data-neighborhood="${theme.id}"><div class="neighborhood-card-heading"><h4>${theme.title}</h4><span class="neighborhood-stars" aria-label="${district.stars} 星">${'★'.repeat(district.stars)}${'☆'.repeat(3 - district.stars)}</span></div><p>${theme.description}</p><details class="neighborhood-rules" data-neighborhood-rules="${theme.id}" ${openRules.has(theme.id) ? 'open' : ''}><summary>查看三星布局条件</summary><ol class="neighborhood-conditions">${theme.rules.map((rule, index) => `<li class="${district.levels[index].complete ? 'is-met' : ''}" data-met="${district.levels[index].complete}"><span>${index + 1} 星</span> ${rule}</li>`).join('')}</ol></details><p class="neighborhood-next">${escape(district.hint)}</p><div class="neighborhood-meta"><span>${district.anchor ? `中心：${district.anchor.x + 1}, ${district.anchor.z + 1}` : `先选址建${theme.anchorName}`}</span><strong>${yen(district.income)} / 周</strong></div><div class="neighborhood-actions"><button type="button" data-neighborhood-focus="${theme.id}" aria-pressed="${focused}">${focused ? '取消布局引导' : '引导这个街区'}</button><button type="button" data-neighborhood-claim="${theme.id}" ${claimed || !district.stars ? 'disabled' : ''}>${claimed ? '灵感奖励已领取' : `首次奖励 ${yen(NEIGHBORHOOD_FIRST_REWARD)}`}</button></div></article>`;
    }).join('')}</div><p class="neighborhood-footnote">布局引导免费，不限制建设。拆除、断路或靠近工业都可能降低星级；已领取的首次奖励不会再次发放。</p>`;
    if (focusedAction) [...root.querySelectorAll('button')].find(button => button.dataset[focusedAction[0]] === focusedAction[1] && !button.disabled)?.focus({ preventScroll: true });
  }

  function handleClick(event) {
    const button = event.target.closest?.('button');
    if (!button || !root?.contains(button) || button.disabled) return;
    if (button.dataset.neighborhoodClaim !== undefined) claim(button.dataset.neighborhoodClaim);
    else if (button.dataset.neighborhoodFocus !== undefined) {
      const id = button.dataset.neighborhoodFocus;
      focus(state().focus === id ? null : id);
    }
  }

  function init(elementOrId = 'neighborhoodBoard') {
    root?.removeEventListener('click', handleClick);
    root = typeof elementOrId === 'string' ? globalThis.document?.getElementById(elementOrId) : elementOrId;
    city.neighborhoods = state();
    renderedKey = '';
    root?.addEventListener('click', handleClick);
    render();
    return Boolean(root);
  }

  function destroy() { root?.removeEventListener('click', handleClick); root = null; invalidate(); }
  return { init, render, analyze, claim, focus, preview, weekIncome: () => analyze().income, invalidate, destroy };
}
