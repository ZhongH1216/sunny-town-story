import * as THREE from "../node_modules/three/build/three.module.js";

const GRID_SIZE = 18;
const TILE_SIZE = 2.4;
const WEEK_SECONDS = 4;
const INITIAL_MONEY = 50000;
const MAX_VISUAL_AGENTS = 60;
const SAVE_VERSION = 2;
const SAVE_KEY = "sunny-town-story.save.v1";
const AUTO_SAVE_INTERVAL_WEEKS = 4;
const MAX_BUILDING_LEVEL = 3;
const query = new URLSearchParams(window.location.search);
const TEST_MODE = query.has("test");

const GAME_BALANCE = {
  residentialGrowthStep: 28,
  utilityNeedPerBuilding: 28,
  utilityNeedPerHome: 10,
  baseHappiness: 72,
  upgradeCostMultiplier: 0.72,
  levelMultipliers: {
    capacity: [1, 1.55, 2.25],
    tax: [1, 1.32, 1.72],
    jobs: [1, 1.45, 2.05],
    maintenance: [1, 1.45, 2.05],
    service: [1, 1.22, 1.45],
    supply: [1, 1.4, 1.9],
    pollution: [1, 1.15, 1.35],
  },
};

const ASSET_MANIFEST = {
  style: "warm-pixel-lowpoly",
  textureSize: 16,
  generated: "runtime-canvas",
  textures: {
    residential: ["#ffb8c9", "#ffe3ec", "#f68eaa", "#fff5d6"],
    commercial: ["#ffd36f", "#fff1a6", "#ffb85f", "#ffffff"],
    industrial: ["#9fc0cf", "#d4e5ec", "#7899a7", "#f2f6f7"],
    park: ["#8ddf91", "#bff0a9", "#62b96c", "#ffd0dd"],
    school: ["#ffc36e", "#ffe0a6", "#f09b50", "#ffffff"],
    fire: ["#ff8b7f", "#ffd0ca", "#e65f5d", "#ffffff"],
    power: ["#ffe47a", "#fff3b8", "#f1b84b", "#ffffff"],
    water: ["#84c9ff", "#d5f2ff", "#5aaee7", "#ffffff"],
    plaza: ["#f6d58b", "#fff0bf", "#8bcf9a", "#ffffff"],
    station: ["#b9d8f2", "#fff4c0", "#5d8ca8", "#ffffff"],
    lantern: ["#ffb1a6", "#ffe0ba", "#e95f64", "#ffffff"],
  },
};

const ROAD_TIERS = {
  lane: { name: "普通道路", cost: 80, maintenance: 2, capacity: 16, color: 0xd9cda8, speed: 1 },
  avenue: { name: "樱花大道", cost: 260, maintenance: 5, capacity: 60, color: 0xf3c3d1, speed: 1.18, happiness: 1.5 },
};

const BUILDINGS = {
  road: { name: "道路", hint: "道路会自动连接。樱花大道容量更高，也更漂亮。" },
  residential: { name: "住宅", cost: 900, maintenance: 8, tax: 38, capacity: 38, color: 0xffb8c9, unlockChapter: 0, hint: "居民会从住宅出发，沿道路前往工作或消费地点。" },
  commercial: { name: "商业", cost: 1300, maintenance: 18, tax: 72, jobs: 42, color: 0xffd36f, unlockChapter: 0, hint: "商业提供岗位和税收，也会吸引居民消费。" },
  industrial: { name: "工业", cost: 1600, maintenance: 22, tax: 92, jobs: 64, pollution: 14, color: 0x9fc0cf, unlockChapter: 0, hint: "工业岗位多、税收高，但会制造污染和交通压力。" },
  park: { name: "公园", cost: 1100, maintenance: 18, service: "park", radius: 3, color: 0x8ddf91, unlockChapter: 1, unlock: { chapter: 1, population: 120 }, hint: "公园会提升附近住宅幸福度。" },
  school: { name: "学校", cost: 2600, maintenance: 42, service: "education", radius: 4, color: 0xffc36e, unlockChapter: 1, unlock: { chapter: 1, population: 120, happiness: 58 }, hint: "学校提升教育覆盖和长期幸福度。" },
  fire: { name: "消防站", cost: 3200, maintenance: 50, service: "fire", radius: 5, color: 0xff8b7f, unlockChapter: 2, unlock: { chapter: 2, population: 240, happiness: 64, money: 3000 }, hint: "消防站降低城市风险，提高居民安心感。" },
  power: { name: "电力", cost: 3600, maintenance: 55, service: "power", radius: 6, supply: 320, color: 0xffe47a, unlockChapter: 0, hint: "电力设施为附近建筑供电。" },
  water: { name: "水塔", cost: 2800, maintenance: 45, service: "water", radius: 6, supply: 320, color: 0x84c9ff, unlockChapter: 0, hint: "水塔为附近建筑供水。" },
  plaza: { name: "小广场", cost: 4200, maintenance: 38, service: "culture", radius: 4, color: 0xf6d58b, unlockChapter: 1, unlock: { chapter: 1, population: 120, happiness: 60, money: 3000 }, landmark: true, hint: "小广场会提升周边生活气氛，并让住宅更愿意升级。" },
  station: { name: "小车站", cost: 5600, maintenance: 58, service: "transport", radius: 5, color: 0xb9d8f2, unlockChapter: 3, unlock: { chapter: 3, population: 420, traffic: 50, money: 12000 }, landmark: true, hint: "小车站缓解通勤压力，适合放在主干道路旁。" },
  lantern: { name: "祭典灯", cost: 2400, maintenance: 20, service: "culture", radius: 3, color: 0xffb1a6, unlockChapter: 2, unlock: { chapter: 2, population: 260, happiness: 68, money: 2400 }, landmark: true, hint: "祭典灯提升街区氛围，适合布置在住宅和商业之间。" },
  bulldoze: { name: "拆除", cost: 0, hint: "拆除建筑会退回少量资金，道路也可以拆。" },
};

const UPGRADE_RULES = {
  residential: {
    2: { happiness: 58, power: 60, water: 60 },
    3: { happiness: 74, power: 82, water: 82, culture: 25, education: 30 },
  },
  commercial: {
    2: { employment: 58, traffic: 62, power: 60 },
    3: { employment: 75, traffic: 76, culture: 20, money: 9000 },
  },
  industrial: {
    2: { traffic: 58, power: 70, water: 45 },
    3: { traffic: 72, fire: 35, money: 10000 },
  },
  park: {
    2: { happiness: 66 },
    3: { happiness: 76, culture: 22 },
  },
  school: {
    2: { population: 220, happiness: 64 },
    3: { population: 420, education: 55, money: 12000 },
  },
  fire: {
    2: { population: 280, money: 7000 },
    3: { population: 520, fire: 55, traffic: 70 },
  },
  power: {
    2: { population: 180, money: 6500 },
    3: { population: 430, traffic: 65 },
  },
  water: {
    2: { population: 160, money: 5500 },
    3: { population: 400, happiness: 70 },
  },
};

const CHAPTERS = [
  {
    title: "第一章：初建小镇",
    summary: "铺出主街，接上水电，让第一批居民稳定搬入。",
    reward: "解锁公园、学校与小广场，获得 ¥4,000 社区基金。",
    bonus: { id: "community_fund", money: 4000, happiness: 1, text: "社区基金到账，小镇可以更从容地补齐服务。" },
    goals: [
      { label: "道路达到 10 格", value: () => countRoads(), target: 10 },
      { label: "人口达到 120", value: () => city.stats.population, target: 120 },
      { label: "电力覆盖 70%", value: () => city.stats.power, target: 70, unit: "%" },
      { label: "供水覆盖 70%", value: () => city.stats.water, target: 70, unit: "%" },
    ],
  },
  {
    title: "第二章：基础服务",
    summary: "用公园、学校和稳定就业让小镇不只是能住，而是值得留下。",
    reward: "解锁消防站与祭典灯，获得 ¥6,000 服务基金。",
    bonus: { id: "service_fund", money: 6000, happiness: 2, text: "服务基金到账，居民对生活圈更有信心。" },
    goals: [
      { label: "人口达到 240", value: () => city.stats.population, target: 240 },
      { label: "至少 1 座公园", value: () => countBuildings("park"), target: 1 },
      { label: "至少 1 座学校", value: () => countBuildings("school"), target: 1 },
      { label: "幸福度达到 70%", value: () => city.stats.happiness, target: 70, unit: "%" },
    ],
  },
  {
    title: "第三章：商业繁荣",
    summary: "建立稳定税基，让商业、工业和居民通勤形成正循环。",
    reward: "建筑升级成本降低 12%，周报会显示事件影响。",
    bonus: { id: "upgrade_discount", money: 8000, upgradeDiscount: 0.12, text: "建设队熟练起来，后续建筑升级成本降低。" },
    goals: [
      { label: "商业达到 4 座", value: () => countBuildings("commercial"), target: 4 },
      { label: "就业率达到 78%", value: () => city.stats.employmentRate, target: 78, unit: "%" },
      { label: "资金达到 ¥60,000", value: () => city.stats.money, target: 60000, formatter: money },
      { label: "周收入达到 ¥5,000", value: () => city.stats.income, target: 5000, formatter: money },
    ],
  },
  {
    title: "第四章：交通治理",
    summary: "升级道路和服务节点，解决大城市化之前的通勤压力。",
    reward: "解锁小车站，主干交通评分永久 +4。",
    bonus: { id: "traffic_program", money: 10000, trafficBonus: 4, text: "交通治理计划生效，主干路维护效率提升。" },
    goals: [
      { label: "人口达到 520", value: () => city.stats.population, target: 520 },
      { label: "樱花大道达到 8 格", value: () => countRoads("avenue"), target: 8 },
      { label: "交通评分达到 55%", value: () => city.stats.traffic, target: 55, unit: "%" },
      { label: "至少 1 座消防站", value: () => countBuildings("fire"), target: 1 },
    ],
  },
  {
    title: "第五章：宜居城市",
    summary: "在规模、财政、幸福和污染之间取得平衡，完成 1.0 主线。",
    reward: "主线完成，进入自由建设，获得晴日港纪念基金。",
    bonus: { id: "finale_fund", money: 15000, happiness: 3, text: "晴日港进入自由建设阶段，居民准备长期留下。" },
    goals: [
      { label: "人口达到 800", value: () => city.stats.population, target: 800 },
      { label: "幸福度达到 78%", value: () => city.stats.happiness, target: 78, unit: "%" },
      { label: "污染低于 30", value: () => city.stats.pollution, target: 30, unit: "", max: true },
      { label: "资金保持为正", value: () => city.stats.money, target: 0, formatter: money },
    ],
  },
];

const TUTORIAL_TASKS = [
  { id: "main_street", chapter: 0, title: "铺出主街", text: "道路达到 10 格", check: () => countRoads() >= 10 },
  { id: "first_homes", chapter: 0, title: "安置居民", text: "住宅达到 4 座", check: () => countBuildings("residential") >= 4 },
  { id: "water_power", chapter: 0, title: "接上水电", text: "水电覆盖都达到 70%", check: () => city.stats.power >= 70 && city.stats.water >= 70 },
  { id: "first_jobs", chapter: 0, title: "安排岗位", text: "商业和工业合计达到 2 座", check: () => countBuildings("commercial") + countBuildings("industrial") >= 2 },
  { id: "service_ring", chapter: 1, title: "补齐服务", text: "建成公园和学校", check: () => countBuildings("park") >= 1 && countBuildings("school") >= 1 },
  { id: "first_upgrade_task", chapter: 1, title: "升级街区", text: "完成 1 次建筑升级", check: () => city.upgradeCount >= 1 },
  { id: "avenue_task", chapter: 1, title: "升级道路", text: "樱花大道达到 8 格", check: () => countRoads("avenue") >= 8 },
  { id: "safety_task", chapter: 2, title: "建立安全网", text: "建成消防站", check: () => countBuildings("fire") >= 1 },
  { id: "commerce_task", chapter: 2, title: "做旺商店街", text: "商业达到 4 座，周收入达到 ¥5,000", check: () => countBuildings("commercial") >= 4 && city.stats.income >= 5000 },
  { id: "culture_task", chapter: 2, title: "点亮街区", text: "地标或装饰达到 2 座", check: () => countLandmarks() >= 2 },
  { id: "station_task", chapter: 3, title: "建立通勤节点", text: "建成小车站并保持交通 50%", check: () => countBuildings("station") >= 1 && city.stats.traffic >= 50 },
  { id: "livable_task", chapter: 4, title: "稳定宜居", text: "人口 800、幸福 78%、污染低于 30", check: () => city.stats.population >= 800 && city.stats.happiness >= 78 && city.stats.pollution <= 30 },
];

const EVENT_DEFINITIONS = [
  {
    id: "brownout",
    title: "用电紧张",
    text: "供电不足让商店缩短营业时间，本周收入效率下降。",
    duration: 3,
    cooldown: 10,
    trigger: () => city.stats.power < 65 && countBuildings("power") > 0,
    incomeMultiplier: 0.92,
    happinessDelta: -4,
  },
  {
    id: "traffic_jam",
    title: "早高峰拥堵",
    text: "主街承压，维护队需要加班疏导交通。",
    duration: 2,
    cooldown: 8,
    trigger: () => city.stats.traffic < 55 && city.stats.population > 120,
    maintenanceDelta: 180,
    happinessDelta: -3,
  },
  {
    id: "fire_drill",
    title: "消防演练",
    text: "消防覆盖不足，居民要求补充安全设施。",
    duration: 3,
    cooldown: 12,
    trigger: () => city.chapterIndex >= 2 && city.stats.fire < 35 && city.stats.population > 260,
    maintenanceDelta: 260,
    happinessDelta: -4,
  },
  {
    id: "spring_fair",
    title: "小镇集市",
    text: "居民自发举办集市，商业收入与幸福度小幅提升。",
    duration: 2,
    cooldown: 14,
    trigger: () => city.stats.happiness > 74 && city.stats.money > 0 && countBuildings("commercial") >= 2,
    incomeDelta: 900,
    happinessDelta: 3,
  },
  {
    id: "rainy_week",
    title: "梅雨周",
    text: "连续降雨让道路维护成本上升，但水塔效率临时提高。",
    duration: 2,
    cooldown: 16,
    trigger: () => city.week > 18 && city.stats.water > 75 && city.stats.population > 160,
    maintenanceDelta: 220,
    happinessDelta: -2,
  },
  {
    id: "shop_boom",
    title: "商店街热潮",
    text: "商业街迎来客流高峰，本周税收明显增长。",
    duration: 2,
    cooldown: 18,
    trigger: () => countBuildings("commercial") >= 4 && city.stats.traffic > 72,
    incomeDelta: 1600,
    happinessDelta: 2,
  },
  {
    id: "moving_wave",
    title: "搬家咨询潮",
    text: "外地居民关注晴日港，住宅容量和服务稳定时会更快入住。",
    duration: 3,
    cooldown: 20,
    trigger: () => city.stats.happiness > 78 && city.stats.power > 85 && city.stats.water > 85 && city.stats.capacity > city.stats.population + 30,
    incomeDelta: 500,
    happinessDelta: 1,
  },
  {
    id: "festival_day",
    title: "港湾祭典",
    text: "地标与街区氛围带来了周末祭典，商业税收和幸福度一起上扬。",
    duration: 2,
    cooldown: 22,
    trigger: () => city.chapterIndex >= 2 && countLandmarks() >= 2 && city.stats.culture > 35 && city.stats.happiness > 72,
    incomeDelta: 1800,
    happinessDelta: 4,
  },
  {
    id: "fire_risk",
    title: "消防隐患",
    text: "人口和工业规模上升后，消防覆盖不足开始拉高维护压力。",
    duration: 3,
    cooldown: 16,
    trigger: () => city.stats.population > 360 && city.stats.fire < 45 && countBuildings("industrial") >= 2,
    maintenanceDelta: 420,
    happinessDelta: -5,
  },
  {
    id: "industry_slowdown",
    title: "商业低迷",
    text: "通勤和就业承压，店铺客流下降，需要补充岗位或改善道路。",
    duration: 2,
    cooldown: 18,
    trigger: () => city.stats.population > 300 && (city.stats.employmentRate < 68 || city.stats.traffic < 50),
    incomeMultiplier: 0.88,
    happinessDelta: -3,
  },
];

const ACHIEVEMENTS = [
  { id: "first_save", title: "认真记账", text: "完成一次手动保存。", check: () => city.manualSaveCount > 0 },
  { id: "first_upgrade", title: "旧屋新颜", text: "完成一次建筑升级。", check: () => city.upgradeCount > 0 },
  { id: "hundred_people", title: "百人小镇", text: "人口达到 100。", check: () => city.stats.population >= 100 },
  { id: "balanced_services", title: "水电双稳", text: "电力和供水同时达到 90%。", check: () => city.stats.power >= 90 && city.stats.water >= 90 },
  { id: "first_landmark", title: "有了地标", text: "建成第一座地标或装饰建筑。", check: () => city.buildings.some((building) => BUILDINGS[building.type]?.landmark) },
  { id: "smooth_week", title: "顺畅一周", text: "人口超过 120 后仍保持交通评分 90%。", check: () => city.stats.population >= 120 && city.stats.traffic >= 90 },
  { id: "profitable_month", title: "连续盈利", text: "连续 4 次周报净收益为正。", check: () => city.history.length >= 4 && city.history.slice(-4).every((item) => item.net > 0) },
  { id: "chapter_two", title: "服务生活圈", text: "完成第二章。", check: () => city.completedChapters.includes(1) },
  { id: "builder_grade", title: "升级街区", text: "累计完成 5 次建筑升级。", check: () => city.upgradeCount >= 5 },
  { id: "festival_core", title: "节庆核心", text: "建成 2 座地标并让文化覆盖达到 35%。", check: () => countLandmarks() >= 2 && city.stats.culture >= 35 },
  { id: "transit_ready", title: "通勤节点", text: "建成小车站并让交通评分保持 50%。", check: () => countBuildings("station") >= 1 && city.stats.traffic >= 50 },
  { id: "five_hundred_people", title: "五百人的晴日港", text: "人口达到 500。", check: () => city.stats.population >= 500 },
  { id: "main_story", title: "阳光小镇", text: "完成第五章主线。", check: () => city.completed },
];

const seasons = ["春季", "初夏", "盛夏", "秋日"];
const DIRS = [
  { bit: 1, dx: 0, dz: -1, name: "北" },
  { bit: 2, dx: 1, dz: 0, name: "东" },
  { bit: 4, dx: 0, dz: 1, name: "南" },
  { bit: 8, dx: -1, dz: 0, name: "西" },
];

function money(value) {
  return `¥${Math.round(value).toLocaleString()}`;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function tileIndex(x, z) {
  return z * GRID_SIZE + x;
}

function inBounds(x, z) {
  return x >= 0 && z >= 0 && x < GRID_SIZE && z < GRID_SIZE;
}

function gridToWorld(x, z) {
  const offset = ((GRID_SIZE - 1) * TILE_SIZE) / 2;
  return { x: x * TILE_SIZE - offset, z: z * TILE_SIZE - offset };
}

function distance(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
}

function randomChoice(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function safeId(prefix = "id") {
  return globalThis.crypto?.randomUUID?.() || `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function countRoads(tier = null) {
  return city.tiles.filter((tile) => tile.road && (!tier || tile.roadTier === tier)).length;
}

function countBuildings(type = null) {
  return city.buildings.filter((building) => !type || building.type === type).length;
}

function countLandmarks() {
  return city.buildings.filter((building) => BUILDINGS[building.type]?.landmark).length;
}

function levelMultiplier(kind, level = 1) {
  const values = GAME_BALANCE.levelMultipliers[kind] || [1];
  return values[Math.max(0, Math.min(values.length - 1, level - 1))];
}

function buildingLevel(building) {
  return clamp(building?.level || 1, 1, MAX_BUILDING_LEVEL);
}

function buildingValue(building, key) {
  const config = BUILDINGS[building.type];
  const level = buildingLevel(building);
  if (key === "capacity") return Math.round((config.capacity || 0) * levelMultiplier("capacity", level));
  if (key === "jobs") return Math.round((config.jobs || 0) * levelMultiplier("jobs", level));
  if (key === "tax") return Math.round((config.tax || 0) * levelMultiplier("tax", level));
  if (key === "maintenance") return Math.round((config.maintenance || 0) * levelMultiplier("maintenance", level));
  if (key === "radius") return Math.round((config.radius || 0) * levelMultiplier("service", level));
  if (key === "supply") return Math.round((config.supply || 0) * levelMultiplier("supply", level));
  if (key === "pollution") return Math.round((config.pollution || 0) * levelMultiplier("pollution", level));
  return config[key] || 0;
}

function upgradeCost(building) {
  if (!building || buildingLevel(building) >= MAX_BUILDING_LEVEL) return 0;
  const discount = 1 - (city.modifiers.upgradeDiscount || 0);
  return Math.round(BUILDINGS[building.type].cost * GAME_BALANCE.upgradeCostMultiplier * buildingLevel(building) * discount);
}

function upgradeState(building) {
  if (!building) return { ok: false, reason: "请选择一座建筑。", cost: 0, missing: [] };
  const level = buildingLevel(building);
  if (BUILDINGS[building.type]?.landmark) return { ok: false, reason: "地标建筑目前不参与等级升级。", cost: 0, missing: [] };
  if (level >= MAX_BUILDING_LEVEL) return { ok: false, reason: "建筑已满级。", cost: 0, missing: [] };
  const nextLevel = level + 1;
  const cost = upgradeCost(building);
  const rule = UPGRADE_RULES[building.type]?.[nextLevel] || {};
  const missing = evaluateRequirements(rule).missing;
  if (city.stats.money < cost) missing.push(`资金 ${money(cost)}`);
  return {
    ok: missing.length === 0,
    cost,
    missing,
    reason: missing.length ? `升级到 Lv.${nextLevel} 还需要：${missing.join("、")}。` : "",
  };
}

function currentChapter() {
  return CHAPTERS[Math.min(city.chapterIndex, CHAPTERS.length - 1)];
}

function goalProgress(goal) {
  const raw = goal.value();
  const value = Number.isFinite(raw) ? raw : 0;
  const ratio = goal.max ? clamp(1 - value / Math.max(1, goal.target), 0, 1) : clamp(value / Math.max(1, goal.target), 0, 1);
  const complete = goal.max ? value <= goal.target : value >= goal.target;
  return { value, ratio, complete };
}

function formatGoalValue(goal, value) {
  if (goal.formatter) return goal.formatter(value);
  return `${Math.round(value)}${goal.unit || ""}`;
}

function tutorialProgress() {
  const tasks = TUTORIAL_TASKS.map((task) => ({ ...task, done: task.check() }));
  const currentIndex = tasks.findIndex((task) => !task.done && task.chapter <= city.chapterIndex);
  const activeIndex = currentIndex === -1 ? tasks.findIndex((task) => !task.done) : currentIndex;
  if (activeIndex === -1) return tasks.slice(-3);
  return tasks.slice(Math.max(0, activeIndex - 1), activeIndex + 4);
}

function metricValue(metric) {
  const map = {
    chapter: city.chapterIndex,
    population: city.stats.population,
    happiness: city.stats.happiness,
    money: city.stats.money,
    traffic: city.stats.traffic,
    power: city.stats.power,
    water: city.stats.water,
    education: city.stats.education || 0,
    fire: city.stats.fire || 0,
    culture: city.stats.culture || 0,
    transport: city.stats.transport || 0,
    employment: city.stats.employmentRate || 0,
  };
  return Number.isFinite(map[metric]) ? map[metric] : 0;
}

function requirementLabel(metric, target) {
  const labels = {
    chapter: "章节",
    population: "人口",
    happiness: "幸福",
    money: "资金",
    traffic: "交通",
    power: "电力",
    water: "供水",
    education: "教育",
    fire: "消防",
    culture: "文化",
    transport: "通勤",
    employment: "就业",
  };
  const value = metric === "chapter" ? target + 1 : target;
  const formatted = metric === "money" ? money(target) : `${Math.round(value)}${metric === "chapter" || metric === "population" ? "" : "%"}`;
  return `${labels[metric] || metric} ${formatted}`;
}

function evaluateRequirements(requirements = {}) {
  const entries = Object.entries(requirements);
  const missing = entries
    .filter(([metric, target]) => metricValue(metric) < target)
    .map(([metric, target]) => requirementLabel(metric, target));
  return { ok: missing.length === 0, missing };
}

function unlockState(tool) {
  const config = BUILDINGS[tool];
  if (!config || tool === "road" || tool === "bulldoze") return { ok: true, missing: [], label: "" };
  const requirements = config.unlock || { chapter: config.unlockChapter || 0 };
  const result = evaluateRequirements(requirements);
  return {
    ...result,
    label: result.ok ? "已解锁" : `未解锁：${result.missing.join("、")}`,
  };
}

function isToolUnlocked(tool) {
  return unlockState(tool).ok;
}

function eventImpact() {
  return city.activeEvents.reduce(
    (impact, active) => {
      const event = EVENT_DEFINITIONS.find((item) => item.id === active.id);
      if (!event) return impact;
      impact.incomeMultiplier *= event.incomeMultiplier || 1;
      impact.incomeDelta += event.incomeDelta || 0;
      impact.maintenanceDelta += event.maintenanceDelta || 0;
      impact.happinessDelta += event.happinessDelta || 0;
      return impact;
    },
    { incomeMultiplier: 1, incomeDelta: 0, maintenanceDelta: 0, happinessDelta: 0 },
  );
}

function trend(current, previous) {
  if (!Number.isFinite(previous)) return { delta: 0, label: "→0" };
  const delta = Math.round(current - previous);
  return {
    delta,
    label: `${delta > 0 ? "↑" : delta < 0 ? "↓" : "→"}${Math.abs(delta)}`,
  };
}

function impactItem(id, label, value, kind) {
  return { id, label, value: Math.round(value * 10) / 10, kind };
}

function buildResidentNeeds({
  power,
  water,
  employmentRate,
  traffic,
  education,
  fire,
  park,
  culture,
  transport,
  pollution,
  routeStats,
}) {
  const needs = [];
  if (power < 80) needs.push({ id: "power", title: "电力不稳", detail: `供电覆盖 ${Math.round(power)}%，会拖慢入住和商业效率。`, severity: 100 - power });
  if (water < 80) needs.push({ id: "water", title: "供水不足", detail: `供水覆盖 ${Math.round(water)}%，住宅容量没有完全释放。`, severity: 100 - water });
  if (employmentRate < 78 && city.stats.population > 0) needs.push({ id: "employment", title: "岗位不足", detail: `就业率 ${Math.round(employmentRate)}%，需要更多可达商业或工业。`, severity: 78 - employmentRate });
  if (traffic < 70) needs.push({ id: "traffic", title: "通勤吃力", detail: `交通评分 ${Math.round(traffic)}%，道路升级和车站能缓解压力。`, severity: 70 - traffic + routeStats.unreachableResidents });
  if (education < 35 && city.stats.population > 160) needs.push({ id: "education", title: "教育覆盖低", detail: `教育覆盖 ${Math.round(education)}%，住宅升级会更困难。`, severity: 35 - education });
  if (fire < 35 && city.stats.population > 240) needs.push({ id: "fire", title: "消防安心感不足", detail: `消防覆盖 ${Math.round(fire)}%，中型城镇需要安全网。`, severity: 35 - fire });
  if (park < 25 && city.stats.population > 120) needs.push({ id: "park", title: "休闲空间不足", detail: `公园覆盖 ${Math.round(park)}%，居民缺少日常放松空间。`, severity: 25 - park });
  if (culture < 25 && city.chapterIndex >= 1) needs.push({ id: "culture", title: "街区氛围不足", detail: `文化覆盖 ${Math.round(culture)}%，地标和祭典灯能提升归属感。`, severity: 25 - culture });
  if (transport < 18 && city.chapterIndex >= 3) needs.push({ id: "transport", title: "通勤节点不足", detail: `通勤服务 ${Math.round(transport)}%，小车站适合放在主干路旁。`, severity: 18 - transport });
  if (pollution > 24) needs.push({ id: "pollution", title: "污染靠近住宅", detail: `住宅平均污染 ${Math.round(pollution)}，工业区需要隔离或公园缓冲。`, severity: pollution - 24 });
  return needs.sort((a, b) => b.severity - a.severity).slice(0, 4);
}

const els = {
  money: document.querySelector("#money"),
  population: document.querySelector("#population"),
  happiness: document.querySelector("#happiness"),
  employment: document.querySelector("#employment"),
  traffic: document.querySelector("#traffic"),
  power: document.querySelector("#power"),
  water: document.querySelector("#water"),
  toolCost: document.querySelector("#toolCost"),
  weekLabel: document.querySelector("#weekLabel"),
  cityMood: document.querySelector("#cityMood"),
  goalCard: document.querySelector("#goalCard"),
  goalTitle: document.querySelector("#goalTitle"),
  goalText: document.querySelector("#goalText"),
  trafficSummary: document.querySelector("#trafficSummary"),
  trafficDetails: document.querySelector("#trafficDetails"),
  needsSummary: document.querySelector("#needsSummary"),
  happinessBreakdown: document.querySelector("#happinessBreakdown"),
  advisorList: document.querySelector("#advisorList"),
  selectedTitle: document.querySelector("#selectedTitle"),
  selectedInfo: document.querySelector("#selectedInfo"),
  weeklyReport: document.querySelector("#weeklyReport"),
  reportDetails: document.querySelector("#reportDetails"),
  chapterTitle: document.querySelector("#chapterTitle"),
  chapterSummary: document.querySelector("#chapterSummary"),
  questList: document.querySelector("#questList"),
  tutorialList: document.querySelector("#tutorialList"),
  unlockText: document.querySelector("#unlockText"),
  eventList: document.querySelector("#eventList"),
  achievementList: document.querySelector("#achievementList"),
  saveStatus: document.querySelector("#saveStatus"),
  saveButton: document.querySelector("#saveButton"),
  newGameButton: document.querySelector("#newGameButton"),
  resetButton: document.querySelector("#resetButton"),
  upgradeButton: document.querySelector("#upgradeButton"),
  pauseButton: document.querySelector("#pauseButton"),
  speedButton: document.querySelector("#speedButton"),
  calendar: document.querySelector("#calendar"),
  currentTool: document.querySelector("#currentTool"),
  hintText: document.querySelector("#hintText"),
  roadTierButtons: [...document.querySelectorAll("[data-road-tier]")],
  toolButtons: [...document.querySelectorAll("[data-tool]")],
};

const city = {
  tiles: Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, index) => ({
    x: index % GRID_SIZE,
    z: Math.floor(index / GRID_SIZE),
    type: "grass",
    buildingId: null,
    road: false,
    roadTier: null,
    roadMask: 0,
    trafficLoad: 0,
    trafficCapacity: 0,
    congestion: 0,
    coverage: {},
    pollution: 0,
    mesh: null,
    roadMesh: null,
  })),
  buildings: [],
  residents: [],
  visualAgents: [],
  pathCache: new Map(),
  roadVersion: 0,
  selectedTool: "road",
  selectedRoadTier: "lane",
  selectedTile: null,
  week: 1,
  weekProgress: 0,
  paused: false,
  speed: 1,
  bankruptWeeks: 0,
  completed: false,
  chapterIndex: 0,
  completedChapters: [],
  activeEvents: [],
  eventCooldowns: {},
  unlockedAchievements: [],
  appliedBonuses: [],
  modifiers: {
    upgradeDiscount: 0,
    trafficBonus: 0,
    happinessBonus: 0,
  },
  history: [],
  manualSaveCount: 0,
  upgradeCount: 0,
  lastAutoSaveWeek: 0,
  lastSaveAt: null,
  saveStatus: "尚未保存",
  report: {
    income: 0,
    maintenance: 0,
    net: 0,
    eventImpact: 0,
    taxes: 0,
    trends: {
      population: "→0",
      money: "→0",
      traffic: "→0",
      happiness: "→0",
    },
  },
  stats: {
    money: INITIAL_MONEY,
    income: 0,
    maintenance: 0,
    population: 0,
    capacity: 0,
    jobs: 0,
    reachableJobs: 0,
    employmentRate: 0,
    happiness: 68,
    traffic: 100,
    averageCongestion: 0,
    unreachableResidents: 0,
    power: 0,
    water: 0,
    education: 0,
    fire: 0,
    culture: 0,
    transport: 0,
    pollution: 0,
    happinessReasons: [],
    residentNeeds: [],
  },
  messages: ["欢迎来到晴日港。先铺道路，再建住宅和基础设施吧。"],
};

const canvas = document.querySelector("#scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa8ddff);
scene.fog = new THREE.Fog(0xa8ddff, 42, 96);

const camera = new THREE.OrthographicCamera(-32, 32, 20, -20, 0.1, 220);
camera.position.set(29, 34, 34);
camera.lookAt(0, 0, 0);

const world = new THREE.Group();
scene.add(world);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const drag = { active: false, moved: false, x: 0, y: 0 };
const cameraTarget = new THREE.Vector3(0, 0, 0);

const sun = new THREE.DirectionalLight(0xfff2c2, 3.2);
sun.position.set(-20, 42, 18);
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xdff7ff, 0xa2ce80, 1.7));

const tileGroup = new THREE.Group();
const roadGroup = new THREE.Group();
const buildingGroup = new THREE.Group();
const decoGroup = new THREE.Group();
const agentGroup = new THREE.Group();
const effectGroup = new THREE.Group();
world.add(tileGroup, roadGroup, buildingGroup, decoGroup, agentGroup, effectGroup);

const tileGeometry = new THREE.BoxGeometry(TILE_SIZE * 0.96, 0.12, TILE_SIZE * 0.96);
const grassMaterials = [
  new THREE.MeshStandardMaterial({ color: 0xbce98e, roughness: 0.85 }),
  new THREE.MeshStandardMaterial({ color: 0xcaf0a3, roughness: 0.85 }),
  new THREE.MeshStandardMaterial({ color: 0xb4e388, roughness: 0.85 }),
];
const roadMaterials = {
  lane: new THREE.MeshStandardMaterial({ color: ROAD_TIERS.lane.color, roughness: 0.86 }),
  avenue: new THREE.MeshStandardMaterial({ color: ROAD_TIERS.avenue.color, roughness: 0.78 }),
};
const pixelTextures = {};
const congestionMaterial = new THREE.MeshBasicMaterial({ color: 0xff8e72, transparent: true, opacity: 0.34 });
const hoverMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.32 });
const invalidMaterial = new THREE.MeshBasicMaterial({ color: 0xff7b7b, transparent: true, opacity: 0.42 });

const hoverMesh = new THREE.Mesh(new THREE.BoxGeometry(TILE_SIZE, 0.16, TILE_SIZE), hoverMaterial);
hoverMesh.position.y = 0.12;
hoverMesh.visible = false;
scene.add(hoverMesh);

const cloudGroup = new THREE.Group();
scene.add(cloudGroup);
const petalGroup = new THREE.Group();
scene.add(petalGroup);

function makeCloud(x, y, z, scale) {
  const cloud = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.82 });
  [0, 0.8, -0.8].forEach((offset, index) => {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.85 + index * 0.12, 16, 10), mat);
    puff.position.set(offset, Math.sin(index) * 0.15, 0);
    cloud.add(puff);
  });
  cloud.position.set(x, y, z);
  cloud.scale.setScalar(scale);
  cloudGroup.add(cloud);
}

makeCloud(-21, 18, -18, 1.8);
makeCloud(14, 22, -23, 1.35);
makeCloud(26, 16, 12, 1.55);

function createPetals() {
  const petalGeometry = new THREE.PlaneGeometry(0.16, 0.09);
  const petalMaterial = new THREE.MeshBasicMaterial({
    color: 0xffb7ce,
    transparent: true,
    opacity: 0.72,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  for (let i = 0; i < 90; i += 1) {
    const petal = new THREE.Mesh(petalGeometry, petalMaterial.clone());
    petal.userData.seed = Math.random() * Math.PI * 2;
    petal.userData.speed = 0.55 + Math.random() * 0.7;
    petal.userData.drift = 0.25 + Math.random() * 0.55;
    petal.position.set(Math.random() * 62 - 31, 3 + Math.random() * 18, Math.random() * 54 - 27);
    petal.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    petalGroup.add(petal);
  }
}

function createTiles() {
  city.tiles.forEach((tile) => {
    const { x, z } = gridToWorld(tile.x, tile.z);
    const mesh = new THREE.Mesh(tileGeometry, grassMaterials[(tile.x + tile.z) % grassMaterials.length]);
    mesh.position.set(x, 0, z);
    mesh.userData.tile = tile;
    tile.mesh = mesh;
    tileGroup.add(mesh);
  });

  for (let i = 0; i < 44; i += 1) {
    const x = Math.floor(Math.random() * GRID_SIZE);
    const z = Math.floor(Math.random() * GRID_SIZE);
    if ((x > 5 && x < 13 && z > 6 && z < 12) || Math.random() < 0.26) continue;
    makeTree(x + Math.random() * 0.5 - 0.25, z + Math.random() * 0.5 - 0.25, Math.random() > 0.55);
  }
}

function makeTree(x, z, cherry = false) {
  const { x: wx, z: wz } = gridToWorld(x, z);
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.13, 0.55, 8),
    new THREE.MeshStandardMaterial({ color: 0x9f7a52, roughness: 0.8 }),
  );
  const crown = new THREE.Mesh(
    new THREE.SphereGeometry(0.46, 14, 10),
    new THREE.MeshStandardMaterial({ color: cherry ? 0xffb7ce : 0x79c86b, roughness: 0.8 }),
  );
  trunk.position.set(wx, 0.38, wz);
  crown.position.set(wx, 0.88, wz);
  crown.userData.sway = Math.random() * Math.PI * 2;
  decoGroup.add(trunk, crown);
}

function getTile(x, z) {
  return inBounds(x, z) ? city.tiles[tileIndex(x, z)] : null;
}

function neighbors(tile) {
  return DIRS.map((dir) => getTile(tile.x + dir.dx, tile.z + dir.dz)).filter(Boolean);
}

function roadNeighbors(tile) {
  return DIRS.map((dir) => ({ dir, tile: getTile(tile.x + dir.dx, tile.z + dir.dz) })).filter((item) => item.tile?.road);
}

function hasAdjacentRoad(tile) {
  return neighbors(tile).some((item) => item.road);
}

function adjacentRoads(tile) {
  return neighbors(tile).filter((item) => item.road);
}

function buildingById(id) {
  return city.buildings.find((building) => building.id === id);
}

function refreshRoadMasks() {
  city.tiles.forEach((tile) => {
    if (!tile.road) {
      tile.roadMask = 0;
      tile.trafficCapacity = 0;
      tile.congestion = 0;
      return;
    }
    tile.roadMask = roadNeighbors(tile).reduce((mask, item) => mask | item.dir.bit, 0);
    tile.trafficCapacity = ROAD_TIERS[tile.roadTier].capacity;
  });
}

function createRoadMesh(tile) {
  if (tile.roadMesh) roadGroup.remove(tile.roadMesh);
  if (!tile.road) {
    tile.roadMesh = null;
    return;
  }

  const group = new THREE.Group();
  const material = roadMaterials[tile.roadTier];
  const width = tile.roadTier === "avenue" ? 1.15 : 0.82;
  const center = new THREE.Mesh(new THREE.BoxGeometry(width, 0.09, width), material);
  center.position.y = 0.11;
  group.add(center);

  roadNeighbors(tile).forEach(({ dir }) => {
    const horizontal = dir.dx !== 0;
    const segment = new THREE.Mesh(
      new THREE.BoxGeometry(horizontal ? TILE_SIZE : width, 0.08, horizontal ? width : TILE_SIZE),
      material,
    );
    segment.position.set((dir.dx * TILE_SIZE) / 4, 0.1, (dir.dz * TILE_SIZE) / 4);
    group.add(segment);
  });

  if (tile.roadTier === "avenue") {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(width * 0.16, 0.1, width * 0.16), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }));
    stripe.position.y = 0.17;
    group.add(stripe);
  }

  const { x, z } = gridToWorld(tile.x, tile.z);
  group.position.set(x, 0, z);
  group.userData.tile = tile;
  tile.roadMesh = group;
  roadGroup.add(group);
}

function refreshRoadMeshes() {
  refreshRoadMasks();
  city.tiles.forEach(createRoadMesh);
}

function invalidateRoadNetwork() {
  city.roadVersion += 1;
  city.pathCache.clear();
  refreshRoadMeshes();
}

function buildingHeight(type) {
  return { residential: 0.9, commercial: 1.05, industrial: 1.15, park: 0.25, school: 1.0, fire: 1.0, power: 1.25, water: 1.45, plaza: 0.22, station: 0.8, lantern: 0.9 }[type] || 0.8;
}

function createRoof(width, depth, color) {
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(Math.max(width, depth) * 0.75, 0.45, 4),
    new THREE.MeshStandardMaterial({ color, roughness: 0.7 }),
  );
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 0.45;
  return roof;
}

function makePixelTexture(type) {
  if (pixelTextures[type]) return pixelTextures[type];
  const palette = ASSET_MANIFEST.textures[type] || ["#ffffff", "#e5e5e5", "#cccccc", "#999999"];
  const canvas = document.createElement("canvas");
  canvas.width = ASSET_MANIFEST.textureSize;
  canvas.height = ASSET_MANIFEST.textureSize;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = palette[0];
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < canvas.height; y += 4) {
    for (let x = 0; x < canvas.width; x += 4) {
      const index = Math.abs((x * 3 + y * 5 + type.length) % palette.length);
      ctx.fillStyle = palette[index];
      ctx.fillRect(x, y, 4, 4);
    }
  }
  ctx.fillStyle = palette[3] || "#ffffff";
  for (let x = 2; x < canvas.width; x += 6) ctx.fillRect(x, 5, 2, 3);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  pixelTextures[type] = texture;
  return texture;
}

function buildingMaterial(type, color) {
  return new THREE.MeshStandardMaterial({
    color,
    map: makePixelTexture(type),
    roughness: 0.78,
  });
}

function createBuildingMesh(type) {
  const config = BUILDINGS[type];
  const group = new THREE.Group();
  const baseColor = config.color;

  if (type === "park") {
    const mound = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 0.92, 0.22, 16), buildingMaterial(type, 0x91db7b));
    mound.position.y = 0.18;
    group.add(mound);
    for (let i = 0; i < 4; i += 1) {
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.26, 8), new THREE.MeshStandardMaterial({ color: 0x9b7046 }));
      const crown = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), new THREE.MeshStandardMaterial({ color: i % 2 ? 0xffb4ca : 0x69bf68 }));
      trunk.position.y = 0.31;
      crown.position.y = 0.53;
      tree.position.set(i % 2 ? 0.28 : -0.28, 0, i < 2 ? 0.25 : -0.25);
      tree.add(trunk, crown);
      group.add(tree);
    }
    return group;
  }

  if (type === "water") {
    const tank = new THREE.Mesh(new THREE.SphereGeometry(0.46, 18, 12), buildingMaterial(type, baseColor));
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.1, 12), new THREE.MeshStandardMaterial({ color: 0x8db7cf }));
    tank.position.y = 1.15;
    stem.position.y = 0.58;
    group.add(stem, tank);
    return group;
  }

  if (type === "power") {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.48, 1.2, 12), buildingMaterial(type, baseColor));
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffd66d, emissiveIntensity: 0.35 }));
    body.position.y = 0.68;
    cap.position.y = 1.42;
    group.add(body, cap);
    return group;
  }

  const height = buildingHeight(type);
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.22, height, 1.16), buildingMaterial(type, baseColor));
  body.position.y = height / 2 + 0.08;
  group.add(body);
  const roofColor = type === "industrial" ? 0x7d9cab : type === "fire" ? 0xe96767 : type === "school" ? 0xf09b50 : 0xf58cab;
  const roof = createRoof(1.3, 1.2, roofColor);
  roof.position.y = height + 0.36;
  group.add(roof);

  if (type === "commercial") {
    const awning = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.12, 0.18), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    awning.position.set(0, 0.55, 0.68);
    group.add(awning);
  }

  if (type === "plaza") {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.96, 0.18, 8), buildingMaterial(type, baseColor));
    base.position.y = 0.17;
    const fountain = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.18, 16), new THREE.MeshStandardMaterial({ color: 0x84c9ff, roughness: 0.42, emissive: 0x245577, emissiveIntensity: 0.08 }));
    fountain.position.y = 0.36;
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.82, 0.08), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }));
    flag.position.set(-0.42, 0.66, -0.32);
    group.add(base, fountain, flag);
    return group;
  }

  if (type === "station") {
    const platform = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.18, 0.78), buildingMaterial(type, baseColor));
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.16, 0.86), new THREE.MeshStandardMaterial({ color: 0x5d8ca8, roughness: 0.7 }));
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.3, 0.08), new THREE.MeshStandardMaterial({ color: 0xfff4c0, roughness: 0.55 }));
    platform.position.y = 0.18;
    roof.position.y = 0.9;
    sign.position.set(0, 0.62, 0.45);
    group.add(platform, roof, sign);
    return group;
  }

  if (type === "lantern") {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.25, 8), new THREE.MeshStandardMaterial({ color: 0x7b5650, roughness: 0.72 }));
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.4, emissive: 0xff7a5e, emissiveIntensity: 0.28 }));
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.16, 10), buildingMaterial(type, 0xffe0ba));
    base.position.y = 0.16;
    pole.position.y = 0.68;
    lamp.position.y = 1.28;
    group.add(base, pole, lamp);
    return group;
  }
  return group;
}

function setBuildingLevelVisual(building) {
  if (!building?.mesh) return;
  const level = buildingLevel(building);
  building.mesh.userData.level = level;
  building.mesh.scale.setScalar(1 + (level - 1) * 0.12);
  let upgradeCrown = building.mesh.userData.upgradeCrown;
  if (!upgradeCrown) {
    upgradeCrown = new THREE.Group();
    const trimMaterial = new THREE.MeshStandardMaterial({ color: 0xfff2a8, emissive: 0xffb85f, emissiveIntensity: 0.12, roughness: 0.48 });
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.18), trimMaterial);
    const right = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.18), trimMaterial);
    const center = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.16), trimMaterial);
    left.position.set(-0.36, 0, 0);
    right.position.set(0.36, 0, 0);
    center.position.set(0, 0.02, 0);
    upgradeCrown.add(left, right, center);
    upgradeCrown.position.set(0, buildingHeight(building.type) + 0.78, 0.42);
    building.mesh.add(upgradeCrown);
    building.mesh.userData.upgradeCrown = upgradeCrown;
  }
  upgradeCrown.visible = level > 1 && !BUILDINGS[building.type]?.landmark;
  upgradeCrown.scale.set(1 + (level - 2) * 0.24, 1 + (level - 2) * 0.18, 1);

  let extraFloor = building.mesh.userData.extraFloor;
  if (!extraFloor && level >= 3 && !BUILDINGS[building.type]?.landmark) {
    extraFloor = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.34, 0.86), buildingMaterial(building.type, BUILDINGS[building.type].color));
    extraFloor.position.y = buildingHeight(building.type) + 0.42;
    building.mesh.add(extraFloor);
    building.mesh.userData.extraFloor = extraFloor;
  }
  if (extraFloor) extraFloor.visible = level >= 3;
  let badge = building.mesh.userData.badge;
  if (!badge) {
    badge = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.24, 0.07, 6),
      new THREE.MeshStandardMaterial({ color: 0xfff2a8, emissive: 0xffb85f, emissiveIntensity: 0.18 }),
    );
    badge.position.set(0.52, buildingHeight(building.type) + 0.8, -0.48);
    building.mesh.add(badge);
    building.mesh.userData.badge = badge;
  }
  badge.visible = level > 1;
  badge.scale.setScalar(0.8 + level * 0.16);
}

function canBuild(type, tile) {
  if (!tile) return { ok: false, reason: "请选择地图格子。" };
  if (type === "bulldoze") return tile.road || tile.buildingId ? { ok: true } : { ok: false, reason: "这里没有可拆除的内容。" };
  const unlock = unlockState(type);
  if (!unlock.ok) return { ok: false, reason: `${BUILDINGS[type].name}尚未解锁。还需要：${unlock.missing.join("、")}。` };
  if (type === "road" && tile.road) {
    if (tile.roadTier === "lane" && city.selectedRoadTier === "avenue") {
      const upgradePrice = ROAD_TIERS.avenue.cost - Math.round(ROAD_TIERS.lane.cost * 0.25);
      return city.stats.money >= upgradePrice ? { ok: true, upgradePrice } : { ok: false, reason: `升级为樱花大道需要 ${money(upgradePrice)}。` };
    }
    return { ok: false, reason: "这里已经有道路了。可选择樱花大道升级普通道路。" };
  }
  if (tile.buildingId || tile.road) return { ok: false, reason: "这个格子已经被占用了。" };
  const cost = type === "road" ? ROAD_TIERS[city.selectedRoadTier].cost : BUILDINGS[type].cost;
  if (city.stats.money < cost) return { ok: false, reason: "资金不足，先等待税收或拆除低效建筑。" };
  if (type !== "road" && !hasAdjacentRoad(tile)) return { ok: false, reason: "建筑必须贴近道路才会运行。" };
  return { ok: true };
}

function addMessage(message) {
  city.messages.unshift(message);
  city.messages = city.messages.slice(0, 4);
  els.weeklyReport.textContent = city.messages[0];
}

function applyChapterBonus(chapterIndex, chapter) {
  const bonus = chapter.bonus;
  if (!bonus || city.appliedBonuses.includes(bonus.id)) return;
  city.appliedBonuses.push(bonus.id);
  if (bonus.money) {
    city.stats.money += bonus.money;
    spawnBubble(`+${money(bonus.money)}`, 9, 9, 0xffb85f);
  }
  if (bonus.happiness) city.modifiers.happinessBonus += bonus.happiness;
  if (bonus.upgradeDiscount) city.modifiers.upgradeDiscount = Math.max(city.modifiers.upgradeDiscount, bonus.upgradeDiscount);
  if (bonus.trafficBonus) city.modifiers.trafficBonus += bonus.trafficBonus;
  addMessage(`${chapter.title}奖励：${bonus.text || chapter.reward}`);
}

function updateAchievements() {
  ACHIEVEMENTS.forEach((achievement) => {
    if (city.unlockedAchievements.includes(achievement.id) || !achievement.check()) return;
    city.unlockedAchievements.push(achievement.id);
    addMessage(`成就解锁：${achievement.title}。${achievement.text}`);
  });
}

function maybeCompleteChapter() {
  const chapter = currentChapter();
  if (!chapter || city.completed) return;
  if (!chapter.goals.every((goal) => goalProgress(goal).complete)) return;
  const completedTitle = chapter.title;
  if (!city.completedChapters.includes(city.chapterIndex)) city.completedChapters.push(city.chapterIndex);
  applyChapterBonus(city.chapterIndex, chapter);
  spawnChapterCelebration(completedTitle);
  if (city.chapterIndex < CHAPTERS.length - 1) {
    city.chapterIndex += 1;
    addMessage(`${completedTitle}完成！${chapter.reward}`);
  } else {
    city.completed = true;
    addMessage("主线完成！阳光小镇已经成为宜居、繁荣又有秩序的港湾。");
  }
}

function updateEvents() {
  city.activeEvents = city.activeEvents
    .map((active) => ({ ...active, weeksLeft: active.weeksLeft - 1 }))
    .filter((active) => active.weeksLeft > 0);

  Object.keys(city.eventCooldowns).forEach((id) => {
    city.eventCooldowns[id] -= 1;
    if (city.eventCooldowns[id] <= 0) delete city.eventCooldowns[id];
  });

  EVENT_DEFINITIONS.forEach((event) => {
    if (city.activeEvents.some((active) => active.id === event.id) || city.eventCooldowns[event.id]) return;
    if (!event.trigger()) return;
    city.activeEvents.push({ id: event.id, weeksLeft: event.duration });
    city.eventCooldowns[event.id] = event.cooldown;
    addMessage(`事件：${event.title}。${event.text}`);
  });
}

function serializeGame() {
  return {
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    city: {
      tiles: city.tiles
        .filter((tile) => tile.road)
        .map((tile) => ({ x: tile.x, z: tile.z, roadTier: tile.roadTier })),
      buildings: city.buildings.map((building) => ({
        id: building.id,
        type: building.type,
        x: building.x,
        z: building.z,
        age: building.age || 0,
        level: buildingLevel(building),
        active: building.active !== false,
      })),
      week: city.week,
      money: city.stats.money,
      chapterIndex: city.chapterIndex,
      completedChapters: [...city.completedChapters],
      activeEvents: city.activeEvents.map((event) => ({ ...event })),
      eventCooldowns: { ...city.eventCooldowns },
      unlockedAchievements: [...city.unlockedAchievements],
      appliedBonuses: [...city.appliedBonuses],
      modifiers: { ...city.modifiers },
      history: city.history.map((item) => ({ ...item })),
      manualSaveCount: city.manualSaveCount,
      upgradeCount: city.upgradeCount,
      completed: city.completed,
      messages: [...city.messages],
    },
  };
}

function migrateSave(rawSave) {
  if (!rawSave || typeof rawSave !== "object") return null;
  if (rawSave.version === SAVE_VERSION) return rawSave;
  if (rawSave.version === 1 && rawSave.city) return { ...rawSave, version: SAVE_VERSION };
  if (!rawSave.version && rawSave.city) return { ...rawSave, version: SAVE_VERSION };
  return null;
}

function clearCityContent() {
  city.tiles.forEach((tile) => {
    tile.type = "grass";
    tile.buildingId = null;
    tile.road = false;
    tile.roadTier = null;
    tile.roadMask = 0;
    tile.trafficLoad = 0;
    tile.trafficCapacity = 0;
    tile.congestion = 0;
    tile.coverage = {};
    tile.pollution = 0;
    if (tile.roadMesh) {
      roadGroup.remove(tile.roadMesh);
      tile.roadMesh = null;
    }
  });
  buildingGroup.clear();
  agentGroup.clear();
  effectGroup.clear();
  city.buildings = [];
  city.residents = [];
  city.visualAgents = [];
  city.pathCache.clear();
  city.roadVersion += 1;
}

function applySave(save) {
  const migrated = migrateSave(save);
  if (!migrated) return false;
  const data = migrated.city || {};
  clearCityContent();
  city.week = Math.max(1, data.week || 1);
  city.weekProgress = 0;
  city.stats.money = Number.isFinite(data.money) ? data.money : INITIAL_MONEY;
  city.chapterIndex = clamp(data.chapterIndex || 0, 0, CHAPTERS.length - 1);
  city.completedChapters = Array.isArray(data.completedChapters) ? [...data.completedChapters] : [];
  city.activeEvents = Array.isArray(data.activeEvents) ? data.activeEvents.map((event) => ({ ...event })) : [];
  city.eventCooldowns = data.eventCooldowns && typeof data.eventCooldowns === "object" ? { ...data.eventCooldowns } : {};
  city.unlockedAchievements = Array.isArray(data.unlockedAchievements) ? [...data.unlockedAchievements] : [];
  city.appliedBonuses = Array.isArray(data.appliedBonuses) ? [...data.appliedBonuses] : [];
  city.modifiers = {
    upgradeDiscount: clamp(data.modifiers?.upgradeDiscount || 0, 0, 0.5),
    trafficBonus: data.modifiers?.trafficBonus || 0,
    happinessBonus: data.modifiers?.happinessBonus || 0,
  };
  city.history = Array.isArray(data.history) ? data.history.slice(-24).map((item) => ({ ...item })) : [];
  city.manualSaveCount = data.manualSaveCount || 0;
  city.upgradeCount = data.upgradeCount || 0;
  city.completed = Boolean(data.completed);
  city.messages = Array.isArray(data.messages) && data.messages.length ? [...data.messages].slice(0, 4) : ["存档已读取，欢迎回到晴日港。"];

  (data.tiles || []).forEach((road) => {
    const tile = getTile(road.x, road.z);
    if (!tile) return;
    tile.road = true;
    tile.roadTier = ROAD_TIERS[road.roadTier] ? road.roadTier : "lane";
    tile.type = "road";
  });
  refreshRoadMeshes();

  (data.buildings || []).forEach((item) => {
    if (!BUILDINGS[item.type] || item.type === "road" || item.type === "bulldoze") return;
    const tile = getTile(item.x, item.z);
    if (!tile || tile.road || tile.buildingId) return;
    const mesh = createBuildingMesh(item.type);
    const { x: wx, z: wz } = gridToWorld(item.x, item.z);
    mesh.position.set(wx, 0.1, wz);
    mesh.userData.tile = tile;
    mesh.userData.birth = performance.now() / 1000 - 1;
    const building = {
      id: item.id || safeId("building"),
      type: item.type,
      x: item.x,
      z: item.z,
      age: item.age || 0,
      level: clamp(item.level || 1, 1, MAX_BUILDING_LEVEL),
      active: item.active !== false,
      mesh,
    };
    tile.buildingId = building.id;
    tile.type = building.type;
    city.buildings.push(building);
    buildingGroup.add(mesh);
    setBuildingLevelVisual(building);
  });

  computeStats();
  refreshVisualAgents();
  updateAchievements();
  city.saveStatus = `已读取 ${new Date(migrated.savedAt || Date.now()).toLocaleString()}`;
  city.lastSaveAt = migrated.savedAt || null;
  return true;
}

function saveGame(manual = false) {
  if (manual) city.manualSaveCount += 1;
  const save = serializeGame();
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    city.lastSaveAt = save.savedAt;
    city.lastAutoSaveWeek = city.week;
    city.saveStatus = `${manual ? "手动保存" : "自动保存"}：第 ${city.week} 周`;
    if (manual) {
      updateAchievements();
      addMessage("游戏已保存。继续建设时可以放心试错。");
    }
    renderUI();
    return true;
  } catch (error) {
    city.saveStatus = "保存失败：浏览器存储不可用";
    addMessage("保存失败，请检查浏览器本地存储权限。");
    renderUI();
    return false;
  }
}

function loadGameFromStorage() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    return applySave(JSON.parse(raw));
  } catch (error) {
    city.saveStatus = "存档损坏，已开启新游戏";
    localStorage.removeItem(SAVE_KEY);
    return false;
  }
}

function resetMetaState() {
  city.selectedTool = "road";
  city.selectedRoadTier = "lane";
  city.selectedTile = null;
  city.week = 1;
  city.weekProgress = 0;
  city.bankruptWeeks = 0;
  city.completed = false;
  city.chapterIndex = 0;
  city.completedChapters = [];
  city.activeEvents = [];
  city.eventCooldowns = {};
  city.unlockedAchievements = [];
  city.appliedBonuses = [];
  city.modifiers = {
    upgradeDiscount: 0,
    trafficBonus: 0,
    happinessBonus: 0,
  };
  city.history = [];
  city.manualSaveCount = 0;
  city.upgradeCount = 0;
  city.lastAutoSaveWeek = 0;
  city.lastSaveAt = null;
  city.saveStatus = "新游戏";
  city.stats = {
    ...city.stats,
    money: INITIAL_MONEY,
    income: 0,
    maintenance: 0,
    population: 0,
    capacity: 0,
    jobs: 0,
    reachableJobs: 0,
    employmentRate: 0,
    happiness: 68,
    traffic: 100,
    averageCongestion: 0,
    unreachableResidents: 0,
    power: 0,
    water: 0,
    education: 0,
    fire: 0,
    pollution: 0,
  };
  city.report = {
    income: 0,
    maintenance: 0,
    net: 0,
    eventImpact: 0,
    taxes: 0,
    trends: { population: "→0", money: "→0", traffic: "→0", happiness: "→0" },
  };
  city.messages = ["欢迎来到晴日港。先铺道路，再建住宅和基础设施吧。"];
}

function startNewGame({ keepStorage = false } = {}) {
  clearCityContent();
  resetMetaState();
  if (!keepStorage) localStorage.removeItem(SAVE_KEY);
  seedTown();
  computeStats();
  refreshVisualAgents();
  maybeCompleteChapter();
  updateAchievements();
  renderUI();
}

function spawnBubble(text, x, z, color = 0xffb85f) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  ctx.font = "bold 34px Microsoft YaHei, sans-serif";
  ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 10;
  ctx.strokeText(text, 18, 58);
  ctx.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
  ctx.fillText(text, 18, 58);
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
  const worldPos = gridToWorld(x, z);
  sprite.position.set(worldPos.x, 2.4, worldPos.z);
  sprite.scale.set(3.5, 1.3, 1);
  sprite.userData.age = 0;
  effectGroup.add(sprite);
}

function spawnChapterCelebration(title) {
  spawnBubble("章节完成", 9, 9, 0xffb85f);
  spawnBubble(title.includes("：") ? title.split("：").pop() : title, 8, 10, 0x5aa27d);
  cameraTarget.set(0, 0, 0);
  for (let i = 0; i < 10; i += 1) {
    window.setTimeout(() => {
      const x = 5 + Math.random() * 8;
      const z = 6 + Math.random() * 6;
      spawnBubble("★", x, z, i % 2 ? 0xffadc6 : 0xffd36f);
    }, i * 80);
  }
}

function place(type, x, z, options = {}) {
  const tile = getTile(x, z);
  const previousTier = city.selectedRoadTier;
  if (options.tier) city.selectedRoadTier = options.tier;
  const check = canBuild(type, tile);
  city.selectedRoadTier = previousTier;
  city.selectedTile = tile;

  if (!check.ok) {
    addMessage(check.reason);
    renderUI();
    return false;
  }

  if (type === "bulldoze") {
    bulldoze(tile);
    renderUI();
    return true;
  }

  if (type === "road") {
    const tier = options.tier || city.selectedRoadTier;
    if (tile.road && tile.roadTier === "lane" && tier === "avenue") {
      const upgradePrice = ROAD_TIERS.avenue.cost - Math.round(ROAD_TIERS.lane.cost * 0.25);
      city.stats.money -= upgradePrice;
      tile.roadTier = "avenue";
      invalidateRoadNetwork();
      spawnBubble("道路升级", x, z, 0xffb85f);
      addMessage("普通道路升级为樱花大道，容量和幸福加成提升。");
      maybeCompleteChapter();
      renderUI();
      return true;
    }
    city.stats.money -= ROAD_TIERS[tier].cost;
    tile.road = true;
    tile.roadTier = tier;
    tile.type = "road";
    invalidateRoadNetwork();
    addMessage(`${ROAD_TIERS[tier].name}铺好了，居民有了新的通勤路线。`);
    maybeCompleteChapter();
    renderUI();
    return true;
  }

  const config = BUILDINGS[type];
  city.stats.money -= config.cost;
  const mesh = createBuildingMesh(type);
  const { x: wx, z: wz } = gridToWorld(x, z);
  mesh.position.set(wx, 0.1, wz);
  mesh.scale.setScalar(0.1);
  mesh.userData.tile = tile;
  mesh.userData.birth = performance.now() / 1000;
  const building = {
    id: safeId("building"),
    type,
    x,
    z,
    age: 0,
    level: 1,
    active: true,
    mesh,
  };
  setBuildingLevelVisual(building);
  tile.buildingId = building.id;
  tile.type = type;
  city.buildings.push(building);
  buildingGroup.add(mesh);
  spawnBubble(`+${config.name}`, x, z, 0x5aa27d);
  addMessage(`${config.name}建好了。居民会根据道路可达性决定是否使用它。`);
  maybeCompleteChapter();
  updateAchievements();
  renderUI();
  return true;
}

function bulldoze(tile) {
  if (tile.buildingId) {
    const building = buildingById(tile.buildingId);
    if (building) {
      const config = BUILDINGS[building.type];
      city.stats.money += Math.round(config.cost * 0.35);
      buildingGroup.remove(building.mesh);
      city.buildings = city.buildings.filter((item) => item.id !== building.id);
      city.residents = city.residents.filter((resident) => resident.homeId !== building.id && resident.destinationId !== building.id);
      spawnBubble("拆除", tile.x, tile.z, 0xee6b6e);
      addMessage(`${config.name}已拆除，回收了一部分资金。`);
    }
  } else if (tile.road) {
    city.stats.money += Math.round(ROAD_TIERS[tile.roadTier].cost * 0.25);
    tile.road = false;
    tile.roadTier = null;
    tile.roadMask = 0;
    tile.trafficLoad = 0;
    tile.trafficCapacity = 0;
    tile.congestion = 0;
    invalidateRoadNetwork();
    spawnBubble("道路拆除", tile.x, tile.z, 0xee6b6e);
    addMessage("道路已拆除，通勤路线会重新计算。");
  }
  tile.buildingId = null;
  tile.type = "grass";
  tile.coverage = {};
  tile.pollution = 0;
  maybeCompleteChapter();
  updateAchievements();
}

function upgradeSelectedBuilding() {
  const tile = city.selectedTile;
  const building = tile?.buildingId ? buildingById(tile.buildingId) : null;
  const state = upgradeState(building);
  if (!state.ok) {
    addMessage(state.reason);
    renderUI();
    return false;
  }
  city.stats.money -= state.cost;
  building.level = buildingLevel(building) + 1;
  city.upgradeCount += 1;
  setBuildingLevelVisual(building);
  spawnBubble(`Lv.${building.level}`, building.x, building.z, 0xffb85f);
  addMessage(`${BUILDINGS[building.type].name}升级到 ${building.level} 级，容量、产出或服务能力提升。`);
  computeStats();
  maybeCompleteChapter();
  updateAchievements();
  renderUI();
  return true;
}

function clearCoverageAndTraffic() {
  city.tiles.forEach((tile) => {
    tile.coverage = {};
    tile.pollution = 0;
    tile.trafficLoad = 0;
    tile.congestion = 0;
  });
}

function spreadCoverage() {
  clearCoverageAndTraffic();
  city.buildings.forEach((building) => {
    const config = BUILDINGS[building.type];
    const radius = buildingValue(building, "radius");
    if (config.service && radius) {
      city.tiles.forEach((tile) => {
        const reach = Math.max(0, radius - distance(building, tile));
        if (reach > 0) tile.coverage[config.service] = Math.max(tile.coverage[config.service] || 0, reach / radius);
      });
    }
    if (config.pollution) {
      city.tiles.forEach((tile) => {
        const reach = Math.max(0, 4 - distance(building, tile));
        tile.pollution += reach * buildingValue(building, "pollution");
      });
    }
  });
}

function nearestRoadForBuilding(building) {
  const tile = getTile(building.x, building.z);
  return adjacentRoads(tile).sort((a, b) => ROAD_TIERS[b.roadTier].capacity - ROAD_TIERS[a.roadTier].capacity)[0] || null;
}

function pathKey(start, end) {
  return `${city.roadVersion}:${start.x},${start.z}->${end.x},${end.z}`;
}

function findPath(start, end) {
  if (!start || !end) return null;
  const key = pathKey(start, end);
  if (city.pathCache.has(key)) return city.pathCache.get(key);

  const open = [{ tile: start, g: 0, f: distance(start, end), parent: null }];
  const best = new Map([[`${start.x},${start.z}`, 0]]);
  const closed = new Set();

  while (open.length) {
    open.sort((a, b) => a.f - b.f);
    const current = open.shift();
    const id = `${current.tile.x},${current.tile.z}`;
    if (closed.has(id)) continue;
    closed.add(id);

    if (current.tile === end) {
      const route = [];
      let node = current;
      while (node) {
        route.unshift(node.tile);
        node = node.parent;
      }
      city.pathCache.set(key, route);
      return route;
    }

    roadNeighbors(current.tile).forEach(({ tile }) => {
      const nextId = `${tile.x},${tile.z}`;
      const cost = current.g + (tile.roadTier === "avenue" ? 0.8 : 1);
      if (best.has(nextId) && best.get(nextId) <= cost) return;
      best.set(nextId, cost);
      open.push({ tile, g: cost, f: cost + distance(tile, end), parent: current });
    });
  }

  city.pathCache.set(key, null);
  return null;
}

function syncResidents(targetPopulation, homes) {
  const validHomeIds = new Set(homes.map((home) => home.id));
  city.residents = city.residents.filter((resident) => validHomeIds.has(resident.homeId));

  while (city.residents.length < targetPopulation) {
    const home = homes[city.residents.length % Math.max(1, homes.length)];
    if (!home) break;
    city.residents.push({
      id: safeId("resident"),
      homeId: home.id,
      destinationId: null,
      route: null,
      commuteTime: 0,
      happiness: 65,
    });
  }

  if (city.residents.length > targetPopulation) {
    city.residents.length = targetPopulation;
  }
}

function assignResidentRoutes(homes, destinations) {
  let reachable = 0;
  let totalCommute = 0;
  const destinationPool = destinations.length ? destinations : homes;

  city.residents.forEach((resident, index) => {
    const home = buildingById(resident.homeId);
    const destination = destinationPool[index % destinationPool.length];
    const start = home ? nearestRoadForBuilding(home) : null;
    const end = destination ? nearestRoadForBuilding(destination) : null;
    const route = findPath(start, end);
    resident.destinationId = destination?.id || null;
    resident.route = route;
    resident.commuteTime = route ? route.length : 0;
    resident.happiness = route ? clamp(82 - route.length * 1.4) : 35;
    if (route) {
      reachable += 1;
      totalCommute += route.length;
      route.forEach((tile) => {
        tile.trafficLoad += 1;
      });
    }
  });

  return {
    reachableResidents: reachable,
    averageCommute: reachable ? totalCommute / reachable : 0,
    unreachableResidents: city.residents.length - reachable,
  };
}

function updateTrafficStats() {
  const roads = city.tiles.filter((tile) => tile.road);
  roads.forEach((tile) => {
    tile.trafficCapacity = ROAD_TIERS[tile.roadTier].capacity;
    tile.congestion = tile.trafficCapacity ? clamp(tile.trafficLoad / tile.trafficCapacity, 0, 2) : 0;
  });
  const avg = roads.length ? roads.reduce((sum, tile) => sum + tile.congestion, 0) / roads.length : 0;
  city.stats.averageCongestion = avg;
  city.stats.traffic = clamp(100 - avg * 40);
}

function computeStats() {
  spreadCoverage();
  refreshRoadMasks();
  const activeBuildings = city.buildings.filter((building) => hasAdjacentRoad(getTile(building.x, building.z)));
  const roads = city.tiles.filter((tile) => tile.road);
  const residential = activeBuildings.filter((building) => building.type === "residential");
  const commercial = activeBuildings.filter((building) => building.type === "commercial");
  const industrial = activeBuildings.filter((building) => building.type === "industrial");
  const destinations = [...commercial, ...industrial];

  const capacity = residential.reduce((sum, building) => {
    const tile = getTile(building.x, building.z);
    const utilities = ((tile.coverage.power || 0) + (tile.coverage.water || 0)) / 2;
    return sum + Math.round(buildingValue(building, "capacity") * (0.35 + utilities * 0.65));
  }, 0);

  const utilityNeed = Math.max(1, activeBuildings.filter((building) => building.type !== "park").length * GAME_BALANCE.utilityNeedPerBuilding + residential.length * GAME_BALANCE.utilityNeedPerHome);
  const powerSupply = activeBuildings.filter((building) => building.type === "power").reduce((sum, building) => sum + buildingValue(building, "supply"), 0);
  const waterSupply = activeBuildings.filter((building) => building.type === "water").reduce((sum, building) => sum + buildingValue(building, "supply"), 0);
  const power = clamp((powerSupply / utilityNeed) * 100);
  const water = clamp((waterSupply / utilityNeed) * 100);

  const baseHappiness = city.stats.happiness || 68;
  const targetPopulation = Math.round(capacity * clamp((baseHappiness - 22) / 68, 0.08, 1));
  const populationStep = Math.sign(targetPopulation - city.stats.population) * Math.min(Math.abs(targetPopulation - city.stats.population), GAME_BALANCE.residentialGrowthStep);
  const nextPopulation = Math.max(0, city.stats.population + populationStep);
  syncResidents(nextPopulation, residential);

  const routeStats = assignResidentRoutes(residential, destinations);
  updateTrafficStats();

  const jobs = [...commercial, ...industrial].reduce((sum, building) => sum + buildingValue(building, "jobs"), 0);
  const reachableJobs = Math.min(routeStats.reachableResidents, jobs);
  const employmentRate = city.residents.length ? clamp((reachableJobs / city.residents.length) * 100) : 0;

  const coverageAverage = (key) => {
    if (!residential.length) return 0;
    return (
      residential.reduce((sum, building) => {
        const tile = getTile(building.x, building.z);
        return sum + (tile.coverage[key] || 0);
      }, 0) /
      residential.length
    ) * 100;
  };

  const education = coverageAverage("education");
  const fire = coverageAverage("fire");
  const park = coverageAverage("park");
  const culture = coverageAverage("culture");
  const transport = coverageAverage("transport");
  const pollution = residential.length
    ? residential.reduce((sum, building) => sum + getTile(building.x, building.z).pollution, 0) / residential.length
    : industrial.length * 4;
  const avenueBoost = roads.filter((tile) => tile.roadTier === "avenue").length * ROAD_TIERS.avenue.happiness;
  const serviceBoost = park * 0.16 + education * 0.09 + fire * 0.07 + culture * 0.08;
  const utilityPenalty = Math.max(0, 100 - power) * 0.09 + Math.max(0, 100 - water) * 0.09;
  const jobPenalty = city.residents.length > 0 ? Math.max(0, 78 - employmentRate) * 0.2 : 4;
  const transportRelief = transport * 0.08 + city.modifiers.trafficBonus;
  const trafficPenalty = Math.max(0, 76 - city.stats.traffic - transportRelief) * 0.24 + routeStats.unreachableResidents * 0.45;
  const pollutionPenalty = Math.min(24, pollution * 0.16);
  const impact = eventImpact();
  const happinessReasons = [
    impactItem("base", "基础生活", GAME_BALANCE.baseHappiness, "positive"),
    impactItem("service", "服务与公园", serviceBoost, "positive"),
    impactItem("avenue", "樱花大道", Math.min(8, avenueBoost), "positive"),
    impactItem("bonus", "章节奖励", city.modifiers.happinessBonus, "positive"),
    impactItem("event", "城市事件", impact.happinessDelta, impact.happinessDelta >= 0 ? "positive" : "negative"),
    impactItem("utility", "水电缺口", -utilityPenalty, "negative"),
    impactItem("employment", "就业压力", -jobPenalty, "negative"),
    impactItem("traffic", "通勤压力", -trafficPenalty, "negative"),
    impactItem("pollution", "污染影响", -pollutionPenalty, "negative"),
  ].filter((item) => Math.abs(item.value) >= 0.1);
  const happiness = clamp(happinessReasons.reduce((sum, item) => sum + item.value, 0), 18, 100);
  const residentNeeds = buildResidentNeeds({
    power,
    water,
    employmentRate,
    traffic: city.stats.traffic,
    education,
    fire,
    park,
    culture,
    transport,
    pollution,
    routeStats,
  });

  const incomeEfficiency = clamp(0.55 + city.stats.traffic / 180, 0.45, 1);
  const residentialTax = routeStats.reachableResidents * BUILDINGS.residential.tax * (residential.length ? residential.reduce((sum, building) => sum + levelMultiplier("tax", buildingLevel(building)), 0) / residential.length : 1);
  const income =
    residentialTax +
    commercial.reduce((sum, building) => sum + buildingValue(building, "tax") * 8 * incomeEfficiency, 0) +
    industrial.reduce((sum, building) => sum + buildingValue(building, "tax") * 8 * incomeEfficiency, 0);
  const roadMaintenance = roads.reduce((sum, tile) => sum + ROAD_TIERS[tile.roadTier].maintenance, 0);
  const maintenance = roadMaintenance + activeBuildings.reduce((sum, building) => sum + buildingValue(building, "maintenance"), 0);
  const adjustedIncome = income * impact.incomeMultiplier + impact.incomeDelta;
  const adjustedMaintenance = maintenance + impact.maintenanceDelta;

  city.stats.population = city.residents.length;
  city.stats.capacity = capacity;
  city.stats.jobs = jobs;
  city.stats.reachableJobs = reachableJobs;
  city.stats.employmentRate = employmentRate;
  city.stats.happiness = happiness;
  city.stats.power = power;
  city.stats.water = water;
  city.stats.education = education;
  city.stats.fire = fire;
  city.stats.culture = culture;
  city.stats.transport = transport;
  city.stats.pollution = pollution;
  city.stats.happinessReasons = happinessReasons;
  city.stats.residentNeeds = residentNeeds;
  city.stats.unreachableResidents = routeStats.unreachableResidents;
  city.stats.averageCommute = routeStats.averageCommute;
  city.stats.income = Math.round(adjustedIncome);
  city.stats.maintenance = Math.round(adjustedMaintenance);
  city.report = {
    income: Math.round(adjustedIncome),
    maintenance: Math.round(adjustedMaintenance),
    net: Math.round(adjustedIncome - adjustedMaintenance),
    eventImpact: Math.round(adjustedIncome - income - (adjustedMaintenance - maintenance)),
    taxes: Math.round(income),
    trends: city.report?.trends || { population: "→0", money: "→0", traffic: "→0", happiness: "→0" },
  };
  return { income: adjustedIncome, maintenance: adjustedMaintenance };
}

function advanceWeek(count = 1) {
  for (let i = 0; i < count; i += 1) {
    const previousMoney = city.stats.money;
    const previousPopulation = city.stats.population;
    const previousTraffic = city.stats.traffic;
    const previousHappiness = city.stats.happiness;
    const { income, maintenance } = computeStats();
    city.stats.money += Math.round(income - maintenance);
    city.report.trends = {
      population: trend(city.stats.population, previousPopulation).label,
      money: trend(city.stats.money, previousMoney).label,
      traffic: trend(city.stats.traffic, previousTraffic).label,
      happiness: trend(city.stats.happiness, previousHappiness).label,
    };
    city.history.push({
      week: city.week,
      population: city.stats.population,
      money: Math.round(city.stats.money),
      traffic: Math.round(city.stats.traffic),
      happiness: Math.round(city.stats.happiness),
      net: Math.round(income - maintenance),
    });
    city.history = city.history.slice(-24);
    city.week += 1;
    city.bankruptWeeks = city.stats.money < -10000 ? city.bankruptWeeks + 1 : 0;
    if (city.stats.money > previousMoney) spawnBubble(`+${money(city.stats.money - previousMoney)}`, 9, 9, 0xffb85f);
    if (city.stats.population > previousPopulation) spawnBubble(`+${city.stats.population - previousPopulation} 人`, 8, 8, 0x5aa27d);

    if (city.bankruptWeeks >= 6) {
      addMessage("财政连续赤字太久，小镇进入托管状态。拆除高维护设施或等待税收恢复。");
    } else {
      addMessage(`第 ${city.week} 周结算：收入 ${money(income)}，维护 ${money(maintenance)}。`);
    }
    updateEvents();
    maybeCompleteChapter();
    updateAchievements();
    if (!TEST_MODE && city.week - city.lastAutoSaveWeek >= AUTO_SAVE_INTERVAL_WEEKS) saveGame(false);
  }
  refreshVisualAgents();
  renderUI();
}

function advisorMessages() {
  const messages = [];
  (city.stats.residentNeeds || []).slice(0, 2).forEach((need) => messages.push({ title: need.title, text: need.detail }));
  if (city.stats.unreachableResidents > 0) messages.push({ title: "有人到不了目的地", text: `${city.stats.unreachableResidents} 位居民找不到可达路线。检查住宅、商业和工业之间的道路连接。` });
  if (city.stats.traffic < 70) messages.push({ title: "道路开始拥堵", text: "通勤变慢了。可以铺设樱花大道或增加支路分流。" });
  if (city.stats.power < 80) messages.push({ title: "电力不足", text: "住宅和商店需要稳定供电。建一座电力设施并靠近道路。" });
  if (city.stats.water < 80) messages.push({ title: "供水不足", text: "水塔覆盖不足会限制人口成长。" });
  if (city.stats.culture < 30 && city.chapterIndex >= 1 && city.stats.population > 150) messages.push({ title: "街区氛围不足", text: "小广场和祭典灯能提升生活气氛，也能帮助住宅升级。" });
  if (city.stats.transport < 25 && city.chapterIndex >= 3 && city.stats.traffic < 78) messages.push({ title: "需要通勤节点", text: "小车站能缓解主街通勤压力，适合放在樱花大道旁。" });
  if (city.stats.employmentRate < 72 && city.stats.population > 80) messages.push({ title: "岗位不可达", text: "增加商业/工业，并确保居民能沿道路到达岗位。" });
  if (city.stats.pollution > 38) messages.push({ title: "污染偏高", text: "工业区离住宅太近了，可以用公园缓冲。" });
  if (city.stats.education < 35 && city.stats.population > 150) messages.push({ title: "教育覆盖低", text: "学校会让居民更安心，也能提升长期幸福度。" });
  if (messages.length === 0) messages.push({ title: "道路很顺畅", text: "居民的通勤路线清晰，小镇正在轻快运转。" });
  return messages.slice(0, 4);
}

function selectedDescription() {
  const tile = city.selectedTile;
  if (!tile) return { title: "未选择", text: "点击地图格子来建造、查看或拆除。" };
  if (tile.road) {
    const dirs = DIRS.filter((dir) => tile.roadMask & dir.bit).map((dir) => dir.name).join("、") || "无连接";
    return {
      title: `${ROAD_TIERS[tile.roadTier].name} (${tile.x + 1}, ${tile.z + 1})`,
      text: `连接：${dirs}。流量 ${tile.trafficLoad}/${tile.trafficCapacity}，拥堵率 ${Math.round(tile.congestion * 100)}%。`,
    };
  }
  if (tile.buildingId) {
    const building = buildingById(tile.buildingId);
    const config = BUILDINGS[building.type];
    const road = nearestRoadForBuilding(building);
    const residents = city.residents.filter((resident) => resident.homeId === building.id || resident.destinationId === building.id);
    const active = road ? "道路可达" : "未连接道路";
    const nextCost = upgradeCost(building);
    const upgradeText = buildingLevel(building) >= MAX_BUILDING_LEVEL ? "已满级" : `升级需 ${money(nextCost)}`;
    const coverageText =
      building.type === "residential"
        ? `水电 ${Math.round(((tile.coverage.power || 0) + (tile.coverage.water || 0)) * 50)}%，教育 ${Math.round((tile.coverage.education || 0) * 100)}%，消防 ${Math.round((tile.coverage.fire || 0) * 100)}%，污染 ${Math.round(tile.pollution)}。`
        : config.service
          ? `服务半径 ${buildingValue(building, "radius")} 格，覆盖会影响附近住宅。`
          : "";
    return { title: `${config.name} Lv.${buildingLevel(building)} (${active})`, text: `${config.hint} 关联居民/通勤 ${residents.length}。${coverageText} ${upgradeText}。` };
  }
  return { title: `草地 (${tile.x + 1}, ${tile.z + 1})`, text: "可以在这里规划新的道路或建筑。" };
}

function renderUI() {
  const stats = city.stats;
  const chapter = currentChapter();
  els.money.textContent = money(stats.money);
  els.population.textContent = `${Math.round(stats.population)} / ${stats.capacity}`;
  els.happiness.textContent = `${Math.round(stats.happiness)}%`;
  els.employment.textContent = `${Math.round(stats.employmentRate)}%`;
  els.traffic.textContent = `${Math.round(stats.traffic)}%`;
  els.power.textContent = `${Math.round(stats.power)}%`;
  els.water.textContent = `${Math.round(stats.water)}%`;
  els.weekLabel.textContent = `第 ${city.week} 周`;
  els.calendar.textContent = `${seasons[Math.floor((city.week - 1) / 13) % seasons.length]} 第 ${city.week} 周`;
  els.cityMood.textContent = city.completed ? "庆祝达成" : stats.traffic < 65 ? "交通承压" : stats.happiness > 78 ? "晴朗成长" : stats.happiness > 50 ? "稳步建设" : "需要关照";
  els.goalCard.classList.toggle("is-complete", city.completed);
  els.goalTitle.textContent = city.completed ? "阳光小镇已成型" : chapter.title;
  els.goalText.textContent = city.completed ? "主线目标已达成，但你仍可以继续扩建，让晴日港变得更可爱。" : chapter.summary;
  els.trafficSummary.textContent = stats.traffic < 65 ? "通勤拥堵" : stats.unreachableResidents > 0 ? "道路断点" : "道路通畅";
  els.trafficDetails.textContent = `平均通勤 ${Math.round(stats.averageCommute || 0)} 格，平均拥堵 ${Math.round((stats.averageCongestion || 0) * 100)}%，移动体 ${city.visualAgents.length}/${MAX_VISUAL_AGENTS}。`;
  els.trafficSummary.closest(".traffic-card").classList.toggle("is-congested", stats.traffic < 70 || stats.unreachableResidents > 0);
  els.needsSummary.textContent = stats.residentNeeds?.length ? stats.residentNeeds[0].title : stats.population > 0 ? "居民需求稳定" : "等待居民入住";
  els.happinessBreakdown.innerHTML = [
    ...(stats.happinessReasons || [])
      .filter((item) => item.id !== "base")
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
      .slice(0, 5)
      .map((item) => `<span class="${item.value >= 0 ? "positive" : "negative"}"><b>${item.value >= 0 ? "+" : ""}${item.value}</b>${item.label}</span>`),
    ...(stats.residentNeeds || []).slice(0, 3).map((need) => `<em>${need.title}：${need.detail}</em>`),
  ].join("");

  const selected = selectedDescription();
  els.selectedTitle.textContent = selected.title;
  els.selectedInfo.textContent = selected.text;
  const selectedBuilding = city.selectedTile?.buildingId ? buildingById(city.selectedTile.buildingId) : null;
  const selectedUpgrade = upgradeState(selectedBuilding);
  els.upgradeButton.disabled = !selectedUpgrade.ok;
  els.upgradeButton.textContent = selectedBuilding
    ? buildingLevel(selectedBuilding) >= MAX_BUILDING_LEVEL
      ? "建筑已满级"
      : `升级建筑 ${money(selectedUpgrade.cost)}`
    : "升级建筑";
  els.upgradeButton.title = selectedUpgrade.reason;
  els.currentTool.textContent = city.selectedTool === "road" ? `当前：${ROAD_TIERS[city.selectedRoadTier].name}` : `当前：${BUILDINGS[city.selectedTool].name}`;
  els.hintText.textContent = BUILDINGS[city.selectedTool].hint;
  els.toolCost.textContent =
    city.selectedTool === "road"
      ? `${ROAD_TIERS[city.selectedRoadTier].name} ${money(ROAD_TIERS[city.selectedRoadTier].cost)}`
      : city.selectedTool === "bulldoze"
        ? "拆除工具"
        : `${BUILDINGS[city.selectedTool].name} ${money(BUILDINGS[city.selectedTool].cost)}`;
  els.pauseButton.textContent = city.paused ? "继续" : "暂停";
  els.speedButton.textContent = `速度 x${city.speed}`;

  els.roadTierButtons.forEach((button) => button.classList.toggle("active", button.dataset.roadTier === city.selectedRoadTier));
  els.toolButtons.forEach((button) => {
    const tool = button.dataset.tool;
    const cost = tool === "road" ? ROAD_TIERS[city.selectedRoadTier].cost : BUILDINGS[tool].cost;
    const unlock = unlockState(tool);
    button.classList.toggle("active", tool === city.selectedTool);
    button.disabled = (tool !== "bulldoze" && city.stats.money < cost) || !unlock.ok;
    button.classList.toggle("is-locked", !unlock.ok);
    button.title = unlock.ok ? "" : unlock.label;
  });

  els.advisorList.innerHTML = advisorMessages()
    .map((item, index) => `<li class="${index === 0 && item.title !== "道路很顺畅" ? "is-warning" : ""}"><strong>${item.title}</strong><p>${item.text}</p></li>`)
    .join("");
  els.chapterTitle.textContent = chapter.title;
  els.chapterSummary.textContent = chapter.summary;
  els.questList.innerHTML = chapter.goals
    .map((goal) => {
      const progress = goalProgress(goal);
      return `<article class="quest-item">
        <header><span>${goal.label}</span><b>${formatGoalValue(goal, progress.value)} / ${formatGoalValue(goal, goal.target)}</b></header>
        <div class="quest-bar" style="--progress:${Math.round(progress.ratio * 100)}%"><i></i></div>
      </article>`;
    })
    .join("");
  els.tutorialList.innerHTML = tutorialProgress()
    .map(
      (task) => `<article class="tutorial-item ${task.done ? "is-done" : "is-active"}">
        <b>${task.done ? "✓" : "→"}</b>
        <span><strong>${task.title}</strong><small>${task.text}</small></span>
      </article>`,
    )
    .join("");
  const lockedTools = els.toolButtons
    .map((button) => button.dataset.tool)
    .filter((tool) => !unlockState(tool).ok)
    .map((tool) => `${BUILDINGS[tool].name}（${unlockState(tool).missing.join("、")}）`);
  els.unlockText.textContent = city.completed
    ? "主线完成：进入自由建设。"
    : lockedTools.length
      ? `${chapter.reward} 待解锁：${lockedTools.slice(0, 3).join("；")}`
      : `${chapter.reward} 当前阶段建筑已全部开放。`;
  els.eventList.innerHTML = city.activeEvents.length
    ? city.activeEvents
        .map((active) => {
          const event = EVENT_DEFINITIONS.find((item) => item.id === active.id);
          return `<span class="event-pill"><strong>${event?.title || active.id}</strong><em>剩余 ${active.weeksLeft} 周</em><small>${event?.text || ""}</small></span>`;
        })
        .join("")
    : "暂无事件";
  els.achievementList.innerHTML = city.unlockedAchievements.length
    ? city.unlockedAchievements
        .map((id) => {
          const achievement = ACHIEVEMENTS.find((item) => item.id === id);
          return `<span class="achievement-pill">${achievement?.title || id}</span>`;
        })
        .join("")
    : "暂无成就";
  els.saveStatus.textContent = city.saveStatus;
  els.reportDetails.textContent = `收入 ${money(city.report.income)} / 维护 ${money(city.report.maintenance)} / 净收益 ${money(city.report.net)} / 人口 ${city.report.trends.population} / 资金 ${city.report.trends.money} / 交通 ${city.report.trends.traffic} / 幸福 ${city.report.trends.happiness}。`;
}

function updateHover() {
  if (!city.selectedTile) {
    hoverMesh.visible = false;
    return;
  }
  const { x, z } = gridToWorld(city.selectedTile.x, city.selectedTile.z);
  const check = canBuild(city.selectedTool, city.selectedTile);
  hoverMesh.material = check.ok ? hoverMaterial : invalidMaterial;
  hoverMesh.position.set(x, 0.18, z);
  hoverMesh.visible = true;
}

function setTool(tool) {
  city.selectedTool = tool;
  renderUI();
  updateHover();
}

function setRoadTier(tier) {
  city.selectedRoadTier = tier;
  city.selectedTool = "road";
  renderUI();
  updateHover();
}

function pickTile(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(tileGroup.children, false);
  return hits[0]?.object.userData.tile || null;
}

function createAgentMesh(kind) {
  const group = new THREE.Group();
  if (kind === "car") {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.22, 0.34), new THREE.MeshStandardMaterial({ color: randomChoice([0xff9aa8, 0x8fc7ff, 0xffd36f, 0x9be28d]), roughness: 0.7 }));
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.26), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }));
    body.position.y = 0.36;
    top.position.y = 0.55;
    group.add(body, top);
  } else {
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshStandardMaterial({ color: randomChoice([0x5aa27d, 0xff8cad, 0x67b8ff, 0xffb85f]), roughness: 0.8 }));
    body.position.y = 0.42;
    group.add(body);
  }
  return group;
}

function refreshVisualAgents() {
  agentGroup.clear();
  city.visualAgents = city.residents
    .filter((resident) => resident.route?.length > 1)
    .slice(0, MAX_VISUAL_AGENTS)
    .map((resident, index) => {
      const kind = resident.route.length > 4 ? "car" : "walker";
      const mesh = createAgentMesh(kind);
      agentGroup.add(mesh);
      return {
        residentId: resident.id,
        route: resident.route,
        mesh,
        kind,
        offset: Math.random(),
        speed: (kind === "car" ? 0.22 : 0.12) * (0.8 + (index % 5) * 0.08),
      };
    });
}

function updateVisualAgents(delta) {
  city.visualAgents.forEach((agent) => {
    if (!agent.route?.length) return;
    agent.offset = (agent.offset + delta * agent.speed * clamp(city.stats.traffic / 100, 0.25, 1.2)) % 1;
    const scaled = agent.offset * (agent.route.length - 1);
    const index = Math.floor(scaled);
    const progress = scaled - index;
    const a = agent.route[index];
    const b = agent.route[Math.min(index + 1, agent.route.length - 1)];
    const aw = gridToWorld(a.x, a.z);
    const bw = gridToWorld(b.x, b.z);
    agent.mesh.position.set(THREE.MathUtils.lerp(aw.x, bw.x, progress), 0.22, THREE.MathUtils.lerp(aw.z, bw.z, progress));
    agent.mesh.rotation.y = Math.atan2(bw.x - aw.x, bw.z - aw.z);
  });
}

function updateEffects(delta) {
  for (let i = effectGroup.children.length - 1; i >= 0; i -= 1) {
    const item = effectGroup.children[i];
    item.userData.age += delta;
    item.position.y += delta * 0.9;
    item.material.opacity = Math.max(0, 1 - item.userData.age * 0.8);
    if (item.userData.age > 1.3) effectGroup.remove(item);
  }
}

function updateRoadCongestionVisuals() {
  city.tiles.forEach((tile) => {
    if (!tile.roadMesh) return;
    let overlay = tile.roadMesh.userData.overlay;
    if (!overlay) {
      overlay = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.04, 1.28), congestionMaterial.clone());
      overlay.position.y = 0.2;
      tile.roadMesh.add(overlay);
      tile.roadMesh.userData.overlay = overlay;
    }
    overlay.visible = tile.congestion > 0.75;
    overlay.material.opacity = clamp((tile.congestion - 0.6) * 0.45, 0.08, 0.42);
  });
}

canvas.addEventListener("pointerdown", (event) => {
  drag.active = true;
  drag.moved = false;
  drag.x = event.clientX;
  drag.y = event.clientY;
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointermove", (event) => {
  const tile = pickTile(event);
  if (tile) {
    city.selectedTile = tile;
    updateHover();
    const selected = selectedDescription();
    els.selectedTitle.textContent = selected.title;
    els.selectedInfo.textContent = selected.text;
  }

  if (!drag.active) return;
  const dx = event.clientX - drag.x;
  const dy = event.clientY - drag.y;
  if (Math.abs(dx) + Math.abs(dy) > 5) drag.moved = true;
  cameraTarget.x -= dx * 0.035;
  cameraTarget.z -= dy * 0.035;
  drag.x = event.clientX;
  drag.y = event.clientY;
});

canvas.addEventListener("pointerup", (event) => {
  const tile = pickTile(event);
  if (tile && !drag.moved) place(city.selectedTool, tile.x, tile.z);
  drag.active = false;
  canvas.releasePointerCapture(event.pointerId);
});

canvas.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    const zoom = event.deltaY > 0 ? 1.08 : 0.92;
    camera.zoom = clamp(camera.zoom / zoom, 0.62, 1.45);
    camera.updateProjectionMatrix();
  },
  { passive: false },
);

els.toolButtons.forEach((button) => button.addEventListener("click", () => setTool(button.dataset.tool)));
els.roadTierButtons.forEach((button) => button.addEventListener("click", () => setRoadTier(button.dataset.roadTier)));
els.pauseButton.addEventListener("click", () => {
  city.paused = !city.paused;
  renderUI();
});
els.speedButton.addEventListener("click", () => {
  city.speed = city.speed === 1 ? 2 : city.speed === 2 ? 4 : 1;
  renderUI();
});
els.saveButton.addEventListener("click", () => saveGame(true));
els.newGameButton.addEventListener("click", () => {
  if (!window.confirm("开始新游戏会覆盖当前未保存进度，确定继续吗？")) return;
  startNewGame();
  saveGame(true);
});
els.resetButton.addEventListener("click", () => {
  if (!window.confirm("清除本地存档并重新开始？")) return;
  startNewGame();
  addMessage("本地存档已清除，已开启新的晴日港。");
  renderUI();
});
els.upgradeButton.addEventListener("click", () => upgradeSelectedBuilding());

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const aspect = width / height;
  const viewHeight = 41;
  camera.left = (-viewHeight * aspect) / 2;
  camera.right = (viewHeight * aspect) / 2;
  camera.top = viewHeight / 2;
  camera.bottom = -viewHeight / 2;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

function animateScene(elapsed, delta) {
  camera.position.x += (cameraTarget.x + 29 - camera.position.x) * 0.08;
  camera.position.z += (cameraTarget.z + 34 - camera.position.z) * 0.08;
  camera.lookAt(cameraTarget.x, 0, cameraTarget.z);
  cloudGroup.children.forEach((cloud, index) => {
    cloud.position.x += 0.003 * (index + 1);
    if (cloud.position.x > 34) cloud.position.x = -34;
  });
  decoGroup.children.forEach((mesh) => {
    if (mesh.geometry?.type === "SphereGeometry") {
      mesh.scale.setScalar(1 + Math.sin(elapsed * 1.8 + mesh.userData.sway) * 0.025);
    }
  });
  petalGroup.children.forEach((petal) => {
    const seed = petal.userData.seed;
    petal.position.y -= delta * petal.userData.speed;
    petal.position.x += Math.sin(elapsed * 1.2 + seed) * delta * petal.userData.drift;
    petal.position.z += Math.cos(elapsed * 0.9 + seed) * delta * 0.18;
    petal.rotation.x += delta * 1.8;
    petal.rotation.z += delta * 1.2;
    if (petal.position.y < 0.25) {
      petal.position.y = 16 + Math.random() * 6;
      petal.position.x = Math.random() * 62 - 31;
      petal.position.z = Math.random() * 54 - 27;
    }
  });
  buildingGroup.children.forEach((mesh, index) => {
    const age = Math.max(0, elapsed - (mesh.userData.birth || 0));
    const bounce = age < 0.65 ? 1 + Math.sin(age * Math.PI * 4) * (1 - age / 0.65) * 0.18 : 1;
    mesh.scale.lerp(new THREE.Vector3(bounce, bounce, bounce), 0.18);
    mesh.position.y = 0.1 + Math.sin(elapsed * 1.4 + index) * 0.008;
  });
  updateVisualAgents(delta);
  updateEffects(delta);
  updateRoadCongestionVisuals();
}

function seedTown() {
  clearCityContent();
  for (let x = 5; x <= 12; x += 1) place("road", x, 9, { tier: x >= 7 && x <= 10 ? "avenue" : "lane" });
  place("road", 8, 8);
  place("road", 8, 10);
  place("residential", 7, 8);
  place("commercial", 9, 8);
  city.stats.money = INITIAL_MONEY - ROAD_TIERS.lane.cost * 6 - ROAD_TIERS.avenue.cost * 4 - 900 - 1300;
  computeStats();
  refreshVisualAgents();
  addMessage("晴日港有了一条主街。接下来补上电力、水塔和更多住宅吧。");
}

function bootGame() {
  createPetals();
  createTiles();
  const loaded = !TEST_MODE && loadGameFromStorage();
  if (!loaded) startNewGame({ keepStorage: TEST_MODE });
  renderUI();
  exposeTestApi();
}

function exposeTestApi() {
  if (!TEST_MODE) return;
  window.sunnyTownTest = {
    place,
    advanceWeek,
    saveGame,
    loadSave: applySave,
    serializeGame,
    startNewGame,
    upgradeSelectedBuilding,
    setSelectedTile: (x, z) => {
      city.selectedTile = getTile(x, z);
      renderUI();
    },
    findPathByRoads: (a, b) => findPath(getTile(a.x, a.z), getTile(b.x, b.z))?.map((tile) => ({ x: tile.x, z: tile.z })) || null,
    getState: () => ({
      stats: { ...city.stats },
      week: city.week,
      chapterIndex: city.chapterIndex,
      completed: city.completed,
      saveStatus: city.saveStatus,
      activeEvents: city.activeEvents.map((event) => ({ ...event })),
      achievements: [...city.unlockedAchievements],
      appliedBonuses: [...city.appliedBonuses],
      modifiers: { ...city.modifiers },
      history: city.history.map((item) => ({ ...item })),
      report: { ...city.report },
      unlocks: Object.fromEntries(Object.keys(BUILDINGS).map((tool) => [tool, unlockState(tool)])),
      tutorial: tutorialProgress().map((task) => ({ id: task.id, title: task.title, text: task.text, done: task.done })),
      tutorialAll: TUTORIAL_TASKS.map((task) => ({ id: task.id, title: task.title, text: task.text, done: task.check() })),
      selectedTool: city.selectedTool,
      selectedRoadTier: city.selectedRoadTier,
      roadVersion: city.roadVersion,
      buildingCount: city.buildings.length,
      landmarkCount: countLandmarks(),
      residentCount: city.residents.length,
      visualAgentCount: city.visualAgents.length,
      roadCount: city.tiles.filter((tile) => tile.road).length,
      buildings: city.buildings.map((building) => ({ id: building.id, type: building.type, x: building.x, z: building.z, level: buildingLevel(building) })),
      roads: city.tiles
        .filter((tile) => tile.road)
        .map((tile) => ({ x: tile.x, z: tile.z, tier: tile.roadTier, mask: tile.roadMask, load: tile.trafficLoad, capacity: tile.trafficCapacity, congestion: tile.congestion })),
      residents: city.residents.map((resident) => ({ id: resident.id, routeLength: resident.route?.length || 0, commuteTime: resident.commuteTime, happiness: resident.happiness })),
      messages: [...city.messages],
      advisor: advisorMessages(),
    }),
    canBuild: (type, x, z) => canBuild(type, getTile(x, z)),
    upgradeState: (x, z) => {
      const tile = getTile(x, z);
      const building = tile?.buildingId ? buildingById(tile.buildingId) : null;
      return upgradeState(building);
    },
    setMoney: (amount) => {
      city.stats.money = amount;
      renderUI();
    },
  };
}

window.addEventListener("resize", resize);
resize();
bootGame();

const clock = new THREE.Clock();

function animate() {
  const delta = Math.min(clock.getDelta(), 0.1);
  const elapsed = clock.elapsedTime;
  if (!city.paused) {
    city.weekProgress += delta * city.speed;
    if (city.weekProgress >= WEEK_SECONDS) {
      city.weekProgress -= WEEK_SECONDS;
      advanceWeek();
    }
  }
  animateScene(elapsed, delta);
  updateHover();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();
