import * as THREE from "../node_modules/three/build/three.module.js";
import { ASSET_MANIFEST, assetManifestSummary } from "./asset-manifest.js";
import { createDemoController, normalizeDemoState, demoEconomy, demoUnlock } from "./demo.js";
import { createWorldArt } from "./world-art.js";
import { createTownLife, normalizeTownLife, townLifeEffects } from "./town-life.js";
import { createNeighborhoods, normalizeNeighborhoods } from "./neighborhoods.js";
import { createCreativeControls } from "./creative-controls.js";

let demoController = null;
let worldArt = null;
let townLife = null;
let neighborhoods = null;
let creativeControls = null;
let layoutRevision = 0;
let lastNeighborhoodFocus = null;
let lifeEffects = townLifeEffects(null);
let graphicsLost = false;
let viewMode = 'normal';
let pointerOnMap = false;
let ghost = null;
let ghostType = null;
const PERFORMANCE_MODES = { eco: { fps: 24, resolution: 1 }, balanced: { fps: 30, resolution: 1.25 }, smooth: { fps: 60, resolution: 1.5 } };
const DEFAULT_PERFORMANCE = 'balanced';
const frameStats = { frames: 0, cpuMs: 0, simulationMs: 0, targetFps: 30, hidden: false };
let renderLoopReady = false;
let frameExecuting = false;
let interactionUntil = 0;
let computationLookup = null;

const GRID_SIZE = 18;
const TILE_SIZE = 2.4;
const WEEK_SECONDS = 4;
const INITIAL_MONEY = 50000;
const MAX_VISUAL_AGENTS = 60;
const GAME_VERSION = "1.0.0-demo.4";
const SAVE_VERSION = 3;
const SAVE_KEY = "sunny-town-story.save.v1";
const AUTO_SAVE_INTERVAL_WEEKS = 4;
const MAX_BUILDING_LEVEL = 3;
const CAMERA_LIMIT = GRID_SIZE * TILE_SIZE * 0.42;
const CAMERA_MIN_ZOOM = 0.62;
const CAMERA_MAX_ZOOM = 1.45;
const query = new URLSearchParams(window.location.search);
const TEST_MODE = query.has("test");

const GAME_BALANCE = {
  residentialGrowthStep: 28,
  utilityNeedPerBuilding: 28,
  utilityNeedPerHome: 10,
  baseHappiness: 72,
  serviceLoad: {
    park: 0.8,
    education: 0.34,
    fire: 0.55,
    culture: 0.48,
    transport: 0.5,
  },
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

const ROAD_TIERS = {
  lane: { name: "普通道路", cost: 80, maintenance: 2, capacity: 16, color: 0xd9cda8, speed: 1 },
  avenue: { name: "樱花大道", cost: 260, maintenance: 5, capacity: 60, color: 0xf3c3d1, speed: 1.18, happiness: 1.5 },
};

const BUILDINGS = {
  road: { name: "道路", hint: "道路会自动连接。樱花大道容量更高，也更漂亮。" },
  residential: { name: "住宅", cost: 900, maintenance: 8, tax: 38, capacity: 38, color: 0xffb8c9, unlockChapter: 0, hint: "居民会从住宅出发，沿道路前往工作或消费地点。" },
  commercial: { name: "商业", cost: 1300, maintenance: 18, tax: 72, jobs: 42, color: 0xffd36f, unlockChapter: 0, hint: "商业提供岗位和税收，也会吸引居民消费。" },
  industrial: { name: "工业", cost: 1600, maintenance: 22, tax: 92, jobs: 64, pollution: 14, color: 0x9fc0cf, unlockChapter: 0, hint: "工业岗位多、税收高，但会制造污染和交通压力。" },
  park: { name: "公园", cost: 1100, maintenance: 18, service: "park", radius: 3, serviceCapacity: 180, color: 0x8ddf91, unlockChapter: 1, unlock: { chapter: 1, population: 120 }, hint: "公园会提升附近住宅幸福度。" },
  school: { name: "学校", cost: 2600, maintenance: 42, service: "education", radius: 4, serviceCapacity: 220, color: 0xffc36e, unlockChapter: 1, unlock: { chapter: 1, population: 120, happiness: 58 }, hint: "学校提升教育覆盖和长期幸福度。" },
  fire: { name: "消防站", cost: 3200, maintenance: 50, service: "fire", radius: 5, serviceCapacity: 380, color: 0xff8b7f, unlockChapter: 2, unlock: { chapter: 2, population: 240, happiness: 64, money: 3000 }, hint: "消防站降低城市风险，提高居民安心感。" },
  power: { name: "电力", cost: 3600, maintenance: 55, service: "power", radius: 6, supply: 320, color: 0xffe47a, unlockChapter: 0, hint: "电力设施为附近建筑供电。" },
  water: { name: "水塔", cost: 2800, maintenance: 45, service: "water", radius: 6, supply: 320, color: 0x84c9ff, unlockChapter: 0, hint: "水塔为附近建筑供水。" },
  plaza: { name: "小广场", cost: 4200, maintenance: 38, service: "culture", radius: 4, serviceCapacity: 260, color: 0xf6d58b, unlockChapter: 1, unlock: { chapter: 1, population: 120, happiness: 60, money: 3000 }, landmark: true, hint: "小广场会提升周边生活气氛，并让住宅更愿意升级。" },
  station: { name: "小车站", cost: 5600, maintenance: 58, service: "transport", radius: 5, serviceCapacity: 420, color: 0xb9d8f2, unlockChapter: 3, unlock: { chapter: 3, population: 420, traffic: 50, money: 12000 }, landmark: true, hint: "小车站缓解通勤压力，适合放在主干道路旁。" },
  lantern: { name: "祭典灯", cost: 2400, maintenance: 20, service: "culture", radius: 3, serviceCapacity: 120, color: 0xffb1a6, unlockChapter: 2, unlock: { chapter: 2, population: 260, happiness: 68, money: 2400 }, landmark: true, hint: "祭典灯提升街区氛围，适合布置在住宅和商业之间。" },
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

const seasons = ["春季", "夏季", "秋季", "冬季"];
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
  return Number.isInteger(x) && Number.isInteger(z) && x >= 0 && z >= 0 && x < GRID_SIZE && z < GRID_SIZE;
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
  if (key === "tax") return Math.round((config.tax || 0) * levelMultiplier("tax", level) * (building.type === 'commercial' ? lifeEffects.commercial : 1));
  if (key === "maintenance") return Math.round((config.maintenance || 0) * levelMultiplier("maintenance", level));
  if (key === "radius") return Math.round((config.radius || 0) * levelMultiplier("service", level));
  if (key === "serviceCapacity") return Math.round((config.serviceCapacity || 0) * levelMultiplier("service", level) * (lifeEffects[config.service] || 1));
  if (key === "supply") return Math.round((config.supply || 0) * levelMultiplier("supply", level) * lifeEffects.utilities);
  if (key === "pollution") return Math.round((config.pollution || 0) * levelMultiplier("pollution", level) * lifeEffects.pollution);
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
  if (demoUnlock(tool, city.demo)) return { ok: true, missing: [], label: "居民建设计划已开放" };
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

function ensureAudio() {
  if (graphicsLost || document.hidden || city.settings.muted || city.settings.volume <= 0) return null;
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return null;
  if (!audioContext) audioContext = new AudioCtor();
  if (audioContext.state === "suspended") audioContext.resume();
  return audioContext;
}

function playTone({ frequency = 440, duration = 0.12, type = "sine", gain = 0.18, slide = 0 }) {
  if (TEST_MODE) return;
  const context = ensureAudio();
  if (!context) return;
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  const now = context.currentTime;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  if (slide) oscillator.frequency.exponentialRampToValueAtTime(Math.max(60, frequency + slide), now + duration);
  envelope.gain.setValueAtTime(0.0001, now);
  envelope.gain.exponentialRampToValueAtTime(gain * city.settings.volume, now + 0.018);
  envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(envelope);
  envelope.connect(context.destination);
  oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
  oscillator.start(now);
  oscillator.stop(now + duration + 0.03);
}

function playSound(name) {
  if (TEST_MODE || document.hidden) return;
  const cues = ASSET_MANIFEST.audioCues;
  (cues[name] || cues.ui).forEach((sound, index) => window.setTimeout(() => playTone(sound), index * 70));
}

function stopMusic() {
  if (musicTimer) window.clearInterval(musicTimer);
  musicTimer = null;
}

function playMusicStep() {
  if (document.hidden || TEST_MODE || city.settings.muted || !city.settings.music || city.settings.volume <= 0) return;
  const loop = ASSET_MANIFEST.musicLoop;
  const note = loop.notes[musicStep % loop.notes.length];
  const bass = loop.bass[musicStep % loop.bass.length];
  playTone({ frequency: note, duration: 0.28, type: "triangle", gain: loop.gain });
  if (musicStep % 2 === 0) playTone({ frequency: bass, duration: 0.34, type: "sine", gain: loop.gain * 0.55 });
  musicStep += 1;
}

function syncMusic() {
  stopMusic();
  if (graphicsLost || document.hidden || TEST_MODE || city.settings.muted || !city.settings.music || city.settings.volume <= 0) return;
  ensureAudio();
  playMusicStep();
  musicTimer = window.setInterval(playMusicStep, ASSET_MANIFEST.musicLoop.tempoMs);
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

function fiscalHealth({ money: currentMoney, income, maintenance }) {
  const net = income - maintenance;
  const reserveWeeks = maintenance > 0 ? currentMoney / Math.max(1, maintenance) : 24;
  const netRatio = income > 0 ? net / income : currentMoney > 0 ? 0.1 : -1;
  const recentDeficits = city.history.slice(-4).filter((item) => item.net < 0).length;
  const score = clamp(58 + netRatio * 42 + Math.min(18, reserveWeeks * 1.6) - recentDeficits * 8 + (currentMoney < 0 ? currentMoney / 850 : 0), 0, 115);
  const happiness = clamp((score - 58) * 0.08, -8, 5);
  return {
    score,
    net,
    reserveWeeks,
    deficitWeeks: recentDeficits,
    happiness,
  };
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
  servicePressure,
  zoning,
  fiscal,
}) {
  const needs = [];
  if (power < 80) needs.push({ id: "power", title: "电力不稳", detail: `供电覆盖 ${Math.round(power)}%，会拖慢入住和商业效率。`, severity: 100 - power });
  if (water < 80) needs.push({ id: "water", title: "供水不足", detail: `供水覆盖 ${Math.round(water)}%，住宅容量没有完全释放。`, severity: 100 - water });
  if (employmentRate < 78 && city.stats.population > 0) needs.push({ id: "employment", title: "岗位不足", detail: `就业率 ${Math.round(employmentRate)}%，需要更多可达商业或工业。`, severity: 78 - employmentRate });
  if (traffic < 70) needs.push({ id: "traffic", title: "通勤吃力", detail: `交通评分 ${Math.round(traffic)}%，道路升级和车站能缓解压力。`, severity: 70 - traffic + routeStats.unreachableResidents });
  if (servicePressure?.education?.score < 0.9 && education > 0) needs.push({ id: "education_capacity", title: "学校容量吃紧", detail: `教育容量 ${Math.round(servicePressure.education.capacity)}/${Math.round(servicePressure.education.demand)}，升级或新增学校可稳定升级路线。`, severity: 18 + (1 - servicePressure.education.score) * 42 });
  if (servicePressure?.fire?.score < 0.9 && fire > 0) needs.push({ id: "fire_capacity", title: "消防容量吃紧", detail: `消防容量 ${Math.round(servicePressure.fire.capacity)}/${Math.round(servicePressure.fire.demand)}，高密度街区需要更多消防站。`, severity: 16 + (1 - servicePressure.fire.score) * 38 });
  if (servicePressure?.park?.score < 0.9 && park > 0) needs.push({ id: "park_capacity", title: "公园承载不足", detail: `休闲容量 ${Math.round(servicePressure.park.capacity)}/${Math.round(servicePressure.park.demand)}，住宅密集区需要更多休闲空间。`, severity: 12 + (1 - servicePressure.park.score) * 28 });
  if (education < 35 && city.stats.population > 160) needs.push({ id: "education", title: "教育覆盖低", detail: `教育覆盖 ${Math.round(education)}%，住宅升级会更困难。`, severity: 35 - education });
  if (fire < 35 && city.stats.population > 240) needs.push({ id: "fire", title: "消防安心感不足", detail: `消防覆盖 ${Math.round(fire)}%，中型城镇需要安全网。`, severity: 35 - fire });
  if (park < 25 && city.stats.population > 120) needs.push({ id: "park", title: "休闲空间不足", detail: `公园覆盖 ${Math.round(park)}%，居民缺少日常放松空间。`, severity: 25 - park });
  if (culture < 25 && city.chapterIndex >= 1) needs.push({ id: "culture", title: "街区氛围不足", detail: `文化覆盖 ${Math.round(culture)}%，地标和祭典灯能提升归属感。`, severity: 25 - culture });
  if (transport < 18 && city.chapterIndex >= 3) needs.push({ id: "transport", title: "通勤节点不足", detail: `通勤服务 ${Math.round(transport)}%，小车站适合放在主干路旁。`, severity: 18 - transport });
  if (servicePressure?.transport?.score < 0.9 && transport > 0) needs.push({ id: "transport_capacity", title: "车站承载不足", detail: `通勤容量 ${Math.round(servicePressure.transport.capacity)}/${Math.round(servicePressure.transport.demand)}，交通节点过少会削弱缓堵效果。`, severity: 14 + (1 - servicePressure.transport.score) * 30 });
  if (zoning?.residentialScore < 62 && city.stats.population > 100) needs.push({ id: "residential_zoning", title: "住宅区位一般", detail: `住宅区位 ${Math.round(zoning.residentialScore)}%，靠近服务、远离工业会提高入住稳定性。`, severity: 62 - zoning.residentialScore });
  if (zoning?.commercialScore < 62 && countBuildings("commercial") >= 3) needs.push({ id: "commercial_zoning", title: "商圈客流不足", detail: `商业区位 ${Math.round(zoning.commercialScore)}%，商业贴近主干路和住宅会提高税收。`, severity: 62 - zoning.commercialScore });
  if (zoning?.industrialScore < 58 && countBuildings("industrial") >= 2) needs.push({ id: "industrial_zoning", title: "工业区位低效", detail: `工业区位 ${Math.round(zoning.industrialScore)}%，工业适合靠主干路并和住宅保持距离。`, severity: 58 - zoning.industrialScore });
  if (fiscal?.score < 50) needs.push({ id: "fiscal", title: "财政安全不足", detail: `财政评分 ${Math.round(fiscal.score)}%，周净收益 ${money(fiscal.net)}，优先减少维护费或提高税基。`, severity: 50 - fiscal.score + fiscal.deficitWeeks * 3 });
  if (fiscal?.deficitWeeks >= 3) needs.push({ id: "deficit", title: "连续赤字", detail: `最近 ${fiscal.deficitWeeks} 周出现赤字，现金储备约 ${Math.max(0, Math.round(fiscal.reserveWeeks))} 周维护费。`, severity: 18 + fiscal.deficitWeeks * 4 });
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
  versionLabel: document.querySelector("#versionLabel"),
  upgradeButton: document.querySelector("#upgradeButton"),
  pauseButton: document.querySelector("#pauseButton"),
  speedButton: document.querySelector("#speedButton"),
  undoButton: document.querySelector("#undoButton"),
  zoomOutButton: document.querySelector("#zoomOutButton"),
  zoomInButton: document.querySelector("#zoomInButton"),
  centerCameraButton: document.querySelector("#centerCameraButton"),
  muteButton: document.querySelector("#muteButton"),
  musicButton: document.querySelector("#musicButton"),
  volumeSlider: document.querySelector("#volumeSlider"),
  shortcutHelpButton: document.querySelector("#shortcutHelpButton"),
  shortcutHint: document.querySelector("#shortcutHint"),
  helpButton: document.querySelector("#helpButton"),
  helpOverlay: document.querySelector("#helpOverlay"),
  helpCloseButton: document.querySelector("#helpCloseButton"),
  helpVersion: document.querySelector("#helpVersion"),
  calendar: document.querySelector("#calendar"),
  currentTool: document.querySelector("#currentTool"),
  hintText: document.querySelector("#hintText"),
  roadTierButtons: [...document.querySelectorAll("[data-road-tier]")],
  toolButtons: [...document.querySelectorAll("[data-tool]")],
};

const city = {
  demo: null,
  neighborhoods: normalizeNeighborhoods(),
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
    coverageRoutes: {},
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
  undoStack: [],
  settings: {
    performance: DEFAULT_PERFORMANCE,
    muted: false,
    volume: 0.45,
    music: true,
    shortcutHelp: false,
    helpOpen: false,
  },
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
    servicePressure: {},
    fiscal: { score: 80, net: 0, reserveWeeks: 0, deficitWeeks: 0, happiness: 0 },
    happinessReasons: [],
    residentNeeds: [],
  },
  messages: ["欢迎来到晴日港。先铺道路，再建住宅和基础设施吧。"],
};

const canvas = document.querySelector("#scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'low-power', preserveDrawingBuffer: TEST_MODE });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa8ddff);
scene.fog = new THREE.Fog(0xc2e7e5, 110, 210);

const camera = new THREE.OrthographicCamera(-32, 32, 20, -20, 0.1, 220);
camera.position.set(29, 34, 34);
camera.lookAt(0, 0, 0);

const world = new THREE.Group();
scene.add(world);

const raycaster = new THREE.Raycaster();
const pickingPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.06);
const pickingPoint = new THREE.Vector3();
const pointer = new THREE.Vector2();
const drag = { active: false, moved: false, x: 0, y: 0 };
const cameraTarget = new THREE.Vector3(0, 0, 0);
const animatedScale = new THREE.Vector3();
let audioContext = null;
let musicTimer = null;
let musicStep = 0;

const sun = new THREE.DirectionalLight(0xfff8ed, 1.6);
sun.position.set(-20, 42, 18);
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xeef5f3, 0x8b9b85, 1.05));

const tileGroup = new THREE.Group();
const roadGroup = new THREE.Group();
const buildingGroup = new THREE.Group();
const decoGroup = new THREE.Group();
const agentGroup = new THREE.Group();
const effectGroup = new THREE.Group();
const heatmapGroup = new THREE.Group();
world.add(tileGroup, roadGroup, buildingGroup, decoGroup, agentGroup, effectGroup, heatmapGroup);

const tileGeometry = new THREE.BoxGeometry(TILE_SIZE, 0.12, TILE_SIZE);
const grassMaterials = [
  new THREE.MeshLambertMaterial({ color: 0x9bbd94 }),
  new THREE.MeshStandardMaterial({ color: 0x9fbc85, roughness: 0.95 }),
  new THREE.MeshStandardMaterial({ color: 0x99b77f, roughness: 0.95 }),
];
const roadMaterials = {
  lane: new THREE.MeshStandardMaterial({ color: ROAD_TIERS.lane.color, roughness: 0.86 }),
  avenue: new THREE.MeshStandardMaterial({ color: ROAD_TIERS.avenue.color, roughness: 0.78 }),
};
const assetRuntime = {
  textureMode: 'vertex-colors',
  modelStyle: 'coastal-lowpoly',
  loadedTextures: 0,
  failedTextures: 0,
  fallbackTextures: 0,
};
const congestionMaterial = new THREE.MeshBasicMaterial({ color: 0xff8e72, transparent: true, opacity: 0.34 });
const hoverMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.32 });
const invalidMaterial = new THREE.MeshBasicMaterial({ color: 0xff7b7b, transparent: true, opacity: 0.42 });
const previewMaterial = new THREE.MeshBasicMaterial({ color: 0x73bd9c, transparent: true, opacity: 0.5, depthWrite: false });
previewMaterial.userData.persistent = true;
const constructionMaterial = new THREE.MeshStandardMaterial({ color: 0xffd36f, roughness: 0.55, emissive: 0x8c4b12, emissiveIntensity: 0.06 });
const coinMaterial = new THREE.MeshStandardMaterial({ color: 0xffd36f, roughness: 0.38, metalness: 0.12, emissive: 0x8b5b00, emissiveIntensity: 0.08 });
const heartMaterial = new THREE.MeshStandardMaterial({ color: 0xff8cad, roughness: 0.52, emissive: 0x7d2442, emissiveIntensity: 0.1 });


const batchTransform = new THREE.Object3D();
const batchColor = new THREE.Color();
function createBatch(geometry, material, capacity, parent) {
  geometry.userData.persistent = true;
  material.userData.persistent = true;
  const batch = new THREE.InstancedMesh(geometry, material, capacity);
  batch.count = 0;
  batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  batch.frustumCulled = false;
  batch.matrixAutoUpdate = false;
  parent.add(batch);
  return batch;
}
function putInstance(batch, index, x, y, z, sx = 1, sy = 1, sz = 1, rotation = 0) {
  batchTransform.position.set(x, y, z);
  batchTransform.scale.set(sx, sy, sz);
  batchTransform.rotation.set(0, rotation, 0);
  batchTransform.updateMatrix();
  batch.setMatrixAt(index, batchTransform.matrix);
}
function finishBatch(batch, count) {
  batch.count = count;
  batch.visible = count > 0;
  batch.instanceMatrix.needsUpdate = true;
  if (batch.instanceColor) batch.instanceColor.needsUpdate = true;
}
const roadBatches = {
  lane: createBatch(new THREE.BoxGeometry(1, 1, 1), roadMaterials.lane, GRID_SIZE * GRID_SIZE * 5, roadGroup),
  avenue: createBatch(new THREE.BoxGeometry(1, 1, 1), roadMaterials.avenue, GRID_SIZE * GRID_SIZE * 5, roadGroup),
  stripe: createBatch(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xfff6df }), GRID_SIZE * GRID_SIZE, roadGroup),
};
const congestionBatch = createBatch(new THREE.BoxGeometry(1.28, 0.04, 1.28), congestionMaterial, GRID_SIZE * GRID_SIZE, roadGroup);
const heatmapBatch = createBatch(new THREE.BoxGeometry(TILE_SIZE * 0.94, 0.015, TILE_SIZE * 0.94), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.52, depthWrite: false }), GRID_SIZE * GRID_SIZE, heatmapGroup);
const agentBatches = {
  car: createBatch(new THREE.BoxGeometry(0.52, 0.22, 0.34), new THREE.MeshLambertMaterial({ color: 0xffffff }), MAX_VISUAL_AGENTS, agentGroup),
  roof: createBatch(new THREE.BoxGeometry(0.28, 0.16, 0.26), new THREE.MeshLambertMaterial({ color: 0xfff8e8 }), MAX_VISUAL_AGENTS, agentGroup),
  walker: createBatch(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshLambertMaterial({ color: 0xffffff }), MAX_VISUAL_AGENTS, agentGroup),
};
let roadBatchVersion = -1;
let heatmapDirty = true;
let heatmapLastMode = null;

const hoverMesh = new THREE.Mesh(new THREE.BoxGeometry(TILE_SIZE, 0.16, TILE_SIZE), hoverMaterial);
hoverMesh.position.y = 0.12;
hoverMesh.visible = false;
scene.add(hoverMesh);
const radiusPreview = new THREE.Mesh(new THREE.RingGeometry(0.98, 1, 64), new THREE.MeshBasicMaterial({ color: 0x67b99c, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
radiusPreview.rotation.x = -Math.PI / 2;
radiusPreview.visible = false;
scene.add(radiusPreview);
// The diamond follows the same Manhattan distance used by neighborhood rules.
// It is a single persistent outline, updated only when the layout or focus changes.
const neighborhoodOutline = new THREE.LineLoop(
  new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, -1), new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0),
  ]),
  new THREE.LineBasicMaterial({ color: 0x307e75, transparent: true, opacity: 0.8, depthWrite: false }),
);
neighborhoodOutline.visible = false;
scene.add(neighborhoodOutline);
const placementHint = document.createElement('div');
placementHint.className = 'placement-hint';
placementHint.hidden = true;
document.body.append(placementHint);

function setViewMode(mode) {
  viewMode = ['normal', 'traffic', 'services'].includes(mode) ? mode : 'normal';
  document.querySelectorAll('[data-view]').forEach((button) => {
    button.classList.toggle('active', button.dataset.view === viewMode);
    button.setAttribute('aria-pressed', String(button.dataset.view === viewMode));
  });
  heatmapGroup.visible = viewMode !== 'normal';
  updateHeatmap();
  requestRender();
}

function updateHeatmap() {
  if (viewMode === 'normal' || (!heatmapDirty && heatmapLastMode === viewMode)) return;
  let count = 0;
  for (const tile of city.tiles) {
    if (viewMode === 'traffic' && !tile.road) continue;
    const position = gridToWorld(tile.x, tile.z);
    putInstance(heatmapBatch, count, position.x, 0.27, position.z);
    const health = viewMode === 'traffic' ? 1 - clamp(tile.congestion, 0, 1) : ((tile.coverage.power || 0) + (tile.coverage.water || 0)) / 2;
    heatmapBatch.setColorAt(count++, batchColor.setHex(health > 0.7 ? 0x49bc95 : health > 0.35 ? 0xf5c96a : 0xe98372));
  }
  finishBatch(heatmapBatch, count);
  heatmapDirty = false;
  heatmapLastMode = viewMode;
}

function disposeLocalObject(object) {
  if (!object) return;
  worldArt?.releaseBuilding(object);
  const persistent = new Set([...Object.values(roadMaterials), ...grassMaterials, tileGeometry]);
  const geometries = new Set(), materials = new Set(), textures = new Set();
  object.traverse((mesh) => {
    if (mesh.geometry && !mesh.geometry.userData.artSharedResource && !mesh.geometry.userData.persistent && !persistent.has(mesh.geometry)) geometries.add(mesh.geometry);
    for (const material of Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []) {
      if (persistent.has(material) || material.userData.artSharedResource || material.userData.persistent) continue;
      materials.add(material);
      if (material.map && !persistent.has(material.map) && !material.map.userData.artSharedResource) textures.add(material.map);
    }
  });
  textures.forEach((resource) => resource.dispose());
  materials.forEach((resource) => resource.dispose());
  geometries.forEach((resource) => resource.dispose());
  object.removeFromParent();
}

function createTiles() {
  const mesh = new THREE.InstancedMesh(tileGeometry, grassMaterials[0], city.tiles.length);
  const transform = new THREE.Object3D();
  city.tiles.forEach((tile, index) => {
    const { x, z } = gridToWorld(tile.x, tile.z);
    transform.position.set(x, 0, z);
    transform.updateMatrix();
    mesh.setMatrixAt(index, transform.matrix);
    mesh.setColorAt(index, new THREE.Color(0xffffff));
    tile.mesh = mesh;
  });
  mesh.instanceMatrix.needsUpdate = true;
  tileGroup.add(mesh);

  // World-art owns deterministic vegetation outside the buildable grid.
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

function buildingsWithin(building, radius, types = null) {
  return city.buildings.filter((other) => {
    if (other.id === building.id) return false;
    if (types && !types.includes(other.type)) return false;
    return distance(building, other) <= radius;
  });
}

function bestAdjacentRoadTier(building) {
  const road = nearestRoadForBuilding(building);
  return road?.roadTier || null;
}

function buildingById(id) {
  return computationLookup ? computationLookup.byId.get(id) : city.buildings.find((building) => building.id === id);
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

function refreshRoadMeshes() {
  if (roadBatchVersion === city.roadVersion) return;
  refreshRoadMasks();
  const counts = { lane: 0, avenue: 0, stripe: 0 };
  for (const tile of city.tiles) {
    if (!tile.road) continue;
    const batch = roadBatches[tile.roadTier];
    const width = tile.roadTier === 'avenue' ? 1.15 : 0.82;
    const { x, z } = gridToWorld(tile.x, tile.z);
    putInstance(batch, counts[tile.roadTier]++, x, 0.11, z, width, 0.09, width);
    for (const { dir } of roadNeighbors(tile)) {
      putInstance(batch, counts[tile.roadTier]++, x + dir.dx * TILE_SIZE / 4, 0.1, z + dir.dz * TILE_SIZE / 4, dir.dx ? TILE_SIZE / 2 : width, 0.08, dir.dz ? TILE_SIZE / 2 : width);
    }
    if (tile.roadTier === 'avenue') putInstance(roadBatches.stripe, counts.stripe++, x, 0.17, z, width * 0.16, 0.1, width * 0.16);
  }
  for (const [kind, batch] of Object.entries(roadBatches)) finishBatch(batch, counts[kind]);
  roadBatchVersion = city.roadVersion;
  heatmapDirty = true;
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

function createBuildingMesh(type) {
  const group = new THREE.Group();
  group.userData.buildingType = type;
  return group;
}

function setBuildingLevelVisual(building) {
  if (!building?.mesh) return;
  const level = buildingLevel(building);
  building.mesh.userData.level = level;
  building.mesh.scale.setScalar(1 + (level - 1) * 0.12);
  worldArt?.decorateBuilding(building.mesh, building.type, building.x, building.z, level);
  building.mesh.updateMatrix();
  building.mesh.matrixAutoUpdate = false;
}

function canBuild(type, tile) {
  if (!Object.hasOwn(BUILDINGS, type)) return { ok: false, reason: "请选择有效的建造工具。" };
  if (!Object.hasOwn(ROAD_TIERS, city.selectedRoadTier)) return { ok: false, reason: "请选择有效的道路类型。" };
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
  playSound("chapter");
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
      population: city.stats.population,
      demo: city.demo ? JSON.parse(JSON.stringify(city.demo)) : null,
      life: JSON.parse(JSON.stringify(city.life || normalizeTownLife())),
      neighborhoods: normalizeNeighborhoods(city.neighborhoods),
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
      settings: { ...city.settings },
      completed: city.completed,
      messages: [...city.messages],
    },
  };
}

function migrateSave(rawSave) {
  if (!rawSave || typeof rawSave !== "object") return null;
  if (rawSave.version === SAVE_VERSION) return rawSave;
  if ((rawSave.version === 1 || rawSave.version === 2) && rawSave.city) return { ...rawSave, version: SAVE_VERSION };
  if (!rawSave.version && rawSave.city) return { ...rawSave, version: SAVE_VERSION };
  return null;
}

function captureUndoState(label) {
  return {
    label,
    save: serializeGame(),
    selectedTool: city.selectedTool,
    selectedRoadTier: city.selectedRoadTier,
    selectedTile: city.selectedTile ? { x: city.selectedTile.x, z: city.selectedTile.z } : null,
  };
}

function pushUndo(label) {
  city.undoStack.push(captureUndoState(label));
  city.undoStack = city.undoStack.slice(-12);
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
    tile.coverageRoutes = {};
    tile.pollution = 0;
    if (tile.roadMesh) {
      disposeLocalObject(tile.roadMesh);
      tile.roadMesh = null;
    }
  });
  [...buildingGroup.children, ...effectGroup.children].forEach(disposeLocalObject);
  Object.values(agentBatches).forEach(batch => finishBatch(batch, 0));
  Object.values(roadBatches).forEach(batch => finishBatch(batch, 0));
  finishBatch(congestionBatch, 0);
  roadBatchVersion = -1;
  heatmapDirty = true;
  city.buildings = [];
  city.residents = [];
  city.visualAgents = [];
  city.pathCache.clear();
  city.roadVersion += 1;
}

function validateSave(save) {
  const migrated = migrateSave(save);
  const data = migrated?.city;
  if (!data || typeof data !== 'object' || !Array.isArray(data.tiles) || !Array.isArray(data.buildings)) return false;
  if (data.tiles.length + data.buildings.length > GRID_SIZE * GRID_SIZE) return false;
  if (data.money !== undefined && (!Number.isFinite(data.money) || Math.abs(data.money) > 1e12)) return false;
  if (data.week !== undefined && (!Number.isInteger(data.week) || data.week < 1 || data.week > 1000000)) return false;
  if (data.population !== undefined && (!Number.isInteger(data.population) || data.population < 0 || data.population > 25000)) return false;
  for (const key of ['upgradeCount', 'manualSaveCount']) if (data[key] !== undefined && (!Number.isInteger(data[key]) || data[key] < 0 || data[key] > 1000000)) return false;
  if (data.modifiers !== undefined && (!data.modifiers || typeof data.modifiers !== 'object' || Object.values(data.modifiers).some((v) => !Number.isFinite(v) || Math.abs(v) > 1000))) return false;
  if (data.chapterIndex !== undefined && (!Number.isInteger(data.chapterIndex) || data.chapterIndex < 0 || data.chapterIndex >= CHAPTERS.length)) return false;
  if (data.history !== undefined && (!Array.isArray(data.history) || data.history.length > 1000 || data.history.some((row) => !row || typeof row !== 'object' || Object.values(row).some((v) => !Number.isFinite(v))))) return false;
  const occupied = new Set();
  for (const item of [...data.tiles, ...data.buildings]) {
    if (!item || !inBounds(item.x, item.z)) return false;
    const key = `${item.x},${item.z}`;
    if (occupied.has(key)) return false;
    occupied.add(key);
  }
  if (data.buildings.some((b) => !Object.hasOwn(BUILDINGS, b.type) || ['road', 'bulldoze'].includes(b.type))) return false;
  if (data.tiles.some(t => t.roadTier !== undefined && !Object.hasOwn(ROAD_TIERS, t.roadTier))) return false;
  const buildingIds = new Set();
  for (const building of data.buildings) {
    if (building.id === undefined) continue;
    if (typeof building.id !== 'string' || !building.id.length || building.id.length > 128 || buildingIds.has(building.id)) return false;
    buildingIds.add(building.id);
  }
  if (data.buildings.some((b) => (b.level !== undefined && (!Number.isInteger(b.level) || b.level < 1 || b.level > MAX_BUILDING_LEVEL)) || (b.age !== undefined && (!Number.isFinite(b.age) || b.age < 0)))) return false;
  if (data.demo !== undefined && data.demo !== null && !normalizeDemoState(data.demo)) return false;
  return true;
}

function applySave(save) {
  if (!validateSave(save)) return false;
  const migrated = migrateSave(save);
  if (!migrated) return false;
  const data = migrated.city || {};
  creativeControls?.exit();
  clearCityContent();
  city.week = Math.max(1, data.week || 1);
  city.weekProgress = 0;
  city.stats.money = Number.isFinite(data.money) ? data.money : INITIAL_MONEY;
  city.stats.population = clamp(Number.isFinite(data.population) ? data.population : 0, 0, 25000);
  city.demo = normalizeDemoState(data.demo);
  city.life = normalizeTownLife(data.life);
  city.neighborhoods = normalizeNeighborhoods(data.neighborhoods);
  lastNeighborhoodFocus = null;
  city.chapterIndex = clamp(data.chapterIndex || 0, 0, CHAPTERS.length - 1);
  city.completedChapters = Array.isArray(data.completedChapters) ? [...new Set(data.completedChapters.filter(i => Number.isInteger(i) && i >= 0 && i < CHAPTERS.length))] : [];
  city.activeEvents = Array.isArray(data.activeEvents) ? data.activeEvents.filter((event) => EVENT_DEFINITIONS.some((d) => d.id === event?.id)).map((event) => ({ id: event.id, weeksLeft: clamp(Number(event.weeksLeft) || 1, 1, 30) })) : [];
  city.eventCooldowns = Object.fromEntries(EVENT_DEFINITIONS.filter(e => Number.isFinite(data.eventCooldowns?.[e.id]) && data.eventCooldowns[e.id] > 0).map(e => [e.id, Math.min(1000, Math.floor(data.eventCooldowns[e.id]))]));
  city.unlockedAchievements = Array.isArray(data.unlockedAchievements) ? data.unlockedAchievements.filter((id) => ACHIEVEMENTS.some((a) => a.id === id)) : [];
  city.appliedBonuses = Array.isArray(data.appliedBonuses) ? [...new Set(data.appliedBonuses.filter(id => CHAPTERS.some(c => c.bonus?.id === id)))] : [];
  city.modifiers = {
    upgradeDiscount: clamp(data.modifiers?.upgradeDiscount || 0, 0, 0.5),
    trafficBonus: data.modifiers?.trafficBonus || 0,
    happinessBonus: data.modifiers?.happinessBonus || 0,
  };
  city.history = Array.isArray(data.history) ? data.history.slice(-24).map((item) => ({ ...item })) : [];
  city.manualSaveCount = data.manualSaveCount || 0;
  city.upgradeCount = data.upgradeCount || 0;
  city.undoStack = [];
  city.settings = {
    performance: Object.hasOwn(PERFORMANCE_MODES, data.settings?.performance) ? data.settings.performance : DEFAULT_PERFORMANCE,
    muted: Boolean(data.settings?.muted),
    volume: clamp(Number.isFinite(data.settings?.volume) ? data.settings.volume : city.settings.volume, 0, 1),
    music: data.settings?.music !== false,
    shortcutHelp: Boolean(data.settings?.shortcutHelp),
    helpOpen: Boolean(data.settings?.helpOpen),
  };
  city.completed = Boolean(data.completed);
  city.messages = Array.isArray(data.messages) && data.messages.length ? [...data.messages].slice(0, 4) : ["存档已读取，欢迎回到晴日港。"];

  (data.tiles || []).forEach((road) => {
    const tile = getTile(road.x, road.z);
    if (!tile) return;
    tile.road = true;
    tile.roadTier = Object.hasOwn(ROAD_TIERS, road.roadTier) ? road.roadTier : "lane";
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
  city.selectedTile = null;
  setViewMode(city.demo?.view || 'normal');
  return true;
}

function saveGame(manual = false) {
  if (manual) { city.manualSaveCount += 1; updateAchievements(); }
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
    const loaded = applySave(JSON.parse(raw));
    if (!loaded) throw new Error("Save migration failed");
    return true;
  } catch (error) {
    let storageAvailable = true;
    try { localStorage.removeItem(SAVE_KEY); } catch { storageAvailable = false; }
    startNewGame({ keepStorage: true });
    city.saveStatus = storageAvailable ? "存档损坏，已开启新游戏" : "本地存储不可用，请导出备份";
    addMessage(storageAvailable ? "检测到本地存档损坏，已自动移除并开启新游戏。" : "浏览器不允许本地保存，仍可游玩。离开前请导出城镇备份。");
    renderUI();
    return true;
  }
}

function updateSettings(partial) {
  city.settings = { ...city.settings, ...partial };
  if (!Object.hasOwn(PERFORMANCE_MODES, city.settings.performance)) city.settings.performance = DEFAULT_PERFORMANCE;
  const resolution = Math.min(window.devicePixelRatio, PERFORMANCE_MODES[city.settings.performance].resolution);
  if (renderer.getPixelRatio() !== resolution) renderer.setPixelRatio(resolution);
  city.settings.volume = clamp(city.settings.volume, 0, 1);
  if (city.settings.volume <= 0) city.settings.muted = true;
  syncMusic();
  renderUI();
}

function togglePause() {
  city.paused = !city.paused;
  playSound("ui");
  renderUI();
}

function cycleSpeed() {
  city.speed = city.speed === 1 ? 2 : city.speed === 2 ? 4 : 1;
  playSound("ui");
  renderUI();
}

function clampCameraTarget() {
  cameraTarget.x = clamp(cameraTarget.x, -CAMERA_LIMIT, CAMERA_LIMIT);
  cameraTarget.z = clamp(cameraTarget.z, -CAMERA_LIMIT, CAMERA_LIMIT);
}

function setCameraZoom(value) {
  camera.zoom = clamp(value, CAMERA_MIN_ZOOM, CAMERA_MAX_ZOOM);
  camera.updateProjectionMatrix();
  requestRender(true);
}

function zoomCamera(direction) {
  setCameraZoom(camera.zoom + direction * 0.12);
  playSound("ui");
  renderUI();
}

function centerCamera() {
  cameraTarget.set(0, 0, 0);
  setCameraZoom(1);
  playSound("ui");
  renderUI();
}

function undoLastAction() {
  const entry = city.undoStack.pop();
  const remaining = [...city.undoStack];
  if (!entry || entry.save.city.week !== city.week) {
    addMessage("没有可以撤销的建造操作。");
    playSound("warning");
    renderUI();
    return false;
  }
  if (!applySave(entry.save)) {
    addMessage("撤销失败，当前状态已保持。");
    playSound("warning");
    renderUI();
    return false;
  }
  city.undoStack = remaining;
  city.selectedTool = entry.selectedTool;
  city.selectedRoadTier = entry.selectedRoadTier;
  city.selectedTile = entry.selectedTile ? getTile(entry.selectedTile.x, entry.selectedTile.z) : null;
  computeStats();
  addMessage(`已撤销：${entry.label}。`);
  playSound("ui");
  renderUI();
  return true;
}

function resetMetaState() {
  creativeControls?.exit();
  city.demo = null;
  city.life = normalizeTownLife();
  city.neighborhoods = normalizeNeighborhoods();
  lastNeighborhoodFocus = null;
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
  city.undoStack = [];
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
  addEffect(sprite);
}

function addEffect(effect) {
  while (effectGroup.children.length >= 96) disposeLocalObject(effectGroup.children[0]);
  effectGroup.add(effect);
}

function spawnRing(x, z, color = 0xffd36f, radius = 1.45) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.035, 8, 36),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.72 }),
  );
  const worldPos = gridToWorld(x, z);
  ring.position.set(worldPos.x, 0.28, worldPos.z);
  ring.rotation.x = Math.PI / 2;
  ring.userData = { age: 0, kind: "ring", duration: 1.1, baseScale: 0.35 };
  ring.scale.setScalar(0.35);
  addEffect(ring);
}

function spawnConstructionEffect(x, z) {
  const worldPos = gridToWorld(x, z);
  for (let i = 0; i < 4; i += 1) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.82, 0.12), constructionMaterial.clone());
    beam.position.set(worldPos.x + (i % 2 ? 0.58 : -0.58), 0.48, worldPos.z + (i < 2 ? 0.52 : -0.52));
    beam.rotation.y = i * Math.PI * 0.18;
    beam.userData = { age: 0, kind: "construction", duration: 1.15, drift: 0.1 + i * 0.03 };
    addEffect(beam);
  }
  spawnRing(x, z, 0xffd36f, 1.25);
}

function spawnUpgradeEffect(x, z) {
  spawnRing(x, z, 0xffb85f, 1.55);
  spawnRing(x, z, 0xfff2a8, 0.96);
  spawnBubble("UP", x, z, 0xffb85f);
}

function spawnParticleBurst(label, x, z, material, count = 8) {
  const worldPos = gridToWorld(x, z);
  for (let i = 0; i < count; i += 1) {
    const particle = new THREE.Mesh(new THREE.SphereGeometry(0.08 + (i % 3) * 0.018, 8, 6), material.clone());
    const angle = (Math.PI * 2 * i) / count;
    particle.position.set(worldPos.x, 0.9 + (i % 4) * 0.08, worldPos.z);
    particle.userData = {
      age: 0,
      kind: "particle",
      label,
      duration: 1.05,
      velocity: new THREE.Vector3(Math.cos(angle) * 0.72, 0.88 + (i % 3) * 0.16, Math.sin(angle) * 0.72),
    };
    addEffect(particle);
  }
}

function spawnIncomeEffect(amount) {
  if (amount <= 0) return;
  spawnParticleBurst("tax", 9, 9, coinMaterial, 10);
}

function spawnPopulationEffect(delta) {
  if (delta <= 0) return;
  spawnParticleBurst("population", 8, 8, heartMaterial, Math.min(12, 5 + Math.ceil(delta / 12)));
}

function spawnChapterCelebration(title) {
  spawnBubble(title.includes('祭典') ? '春日祭典' : title.includes('章') ? '章节完成' : '收到感谢信', 9, 9, 0xffb85f);
  spawnBubble(title.includes("：") ? title.split("：").pop() : title, 8, 10, 0x5aa27d);
  cameraTarget.set(0, 0, 0);
  for (let i = 0; i < (TEST_MODE ? 3 : 7); i += 1) {
    window.setTimeout(() => {
      const x = 5 + Math.random() * 8;
      const z = 6 + Math.random() * 6;
      spawnBubble("★", x, z, i % 2 ? 0xffadc6 : 0xffd36f);
    }, i * 80);
  }
}

function place(type, x, z, options = {}) {
  if (creativeControls?.isActive()) return false;
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
    pushUndo(tile.buildingId ? "拆除建筑" : "拆除道路");
    bulldoze(tile);
    renderUI();
    return true;
  }

  if (type === "road") {
    const tier = options.tier || city.selectedRoadTier;
    if (tile.road && tile.roadTier === "lane" && tier === "avenue") {
      pushUndo("升级道路");
      const upgradePrice = ROAD_TIERS.avenue.cost - Math.round(ROAD_TIERS.lane.cost * 0.25);
      city.stats.money -= upgradePrice;
      tile.roadTier = "avenue";
      invalidateRoadNetwork();
      spawnBubble("道路升级", x, z, 0xffb85f);
      spawnUpgradeEffect(x, z);
      addMessage("普通道路升级为樱花大道，容量和幸福加成提升。");
      playSound("road");
      maybeCompleteChapter();
      renderUI();
      return true;
    }
    pushUndo(`铺设${ROAD_TIERS[tier].name}`);
    city.stats.money -= ROAD_TIERS[tier].cost;
    tile.road = true;
  tile.roadTier = tier;
  tile.type = "road";
  invalidateRoadNetwork();
  spawnConstructionEffect(x, z);
  addMessage(`${ROAD_TIERS[tier].name}铺好了，居民有了新的通勤路线。`);
    playSound("road");
    maybeCompleteChapter();
    renderUI();
    return true;
  }

  const config = BUILDINGS[type];
  pushUndo(`建造${config.name}`);
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
  spawnConstructionEffect(x, z);
  addMessage(`${config.name}建好了。居民会根据道路可达性决定是否使用它。`);
  playSound("build");
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
      disposeLocalObject(building.mesh);
      city.buildings = city.buildings.filter((item) => item.id !== building.id);
      city.residents = city.residents.filter((resident) => resident.homeId !== building.id && resident.destinationId !== building.id);
      spawnBubble("拆除", tile.x, tile.z, 0xee6b6e);
      addMessage(`${config.name}已拆除，回收了一部分资金。`);
      playSound("demolish");
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
    playSound("demolish");
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
  pushUndo(`升级${BUILDINGS[building.type].name}`);
  city.stats.money -= state.cost;
  building.level = buildingLevel(building) + 1;
  city.upgradeCount += 1;
  setBuildingLevelVisual(building);
  spawnBubble(`Lv.${building.level}`, building.x, building.z, 0xffb85f);
  spawnUpgradeEffect(building.x, building.z);
  addMessage(`${BUILDINGS[building.type].name}升级到 ${building.level} 级，容量、产出或服务能力提升。`);
  playSound("upgrade");
  computeStats();
  maybeCompleteChapter();
  updateAchievements();
  renderUI();
  return true;
}

function clearCoverageAndTraffic() {
  city.tiles.forEach((tile) => {
    tile.coverage = {};
    tile.coverageRoutes = {};
    tile.pollution = 0;
    tile.trafficLoad = 0;
    tile.congestion = 0;
  });
}

function serviceDemand(service, residential) {
  const load = GAME_BALANCE.serviceLoad[service];
  if (!load) return 0;
  return residential.reduce((sum, home) => sum + buildingValue(home, "capacity") * load, 0);
}

function servicePressure(service, residential) {
  const providers = city.buildings.filter((building) => BUILDINGS[building.type]?.service === service && hasAdjacentRoad(getTile(building.x, building.z)));
  const capacity = providers.reduce((sum, building) => sum + buildingValue(building, "serviceCapacity"), 0);
  const demand = serviceDemand(service, residential);
  const pressure = demand > 0 ? clamp(capacity / demand, 0.25, 1.15) : 1;
  return { capacity, demand, score: Math.min(1, pressure) };
}

function servicePressureMap(residential) {
  return Object.keys(GAME_BALANCE.serviceLoad).reduce((map, service) => {
    map[service] = servicePressure(service, residential);
    return map;
  }, {});
}

function residentialLocationScore(building) {
  const tile = getTile(building.x, building.z);
  const serviceScore = ((tile.coverage.park || 0) * 0.25 + (tile.coverage.education || 0) * 0.18 + (tile.coverage.fire || 0) * 0.14 + (tile.coverage.culture || 0) * 0.12 + ((tile.coverage.power || 0) + (tile.coverage.water || 0)) * 0.15) * 100;
  const industryPenalty = buildingsWithin(building, 3, ["industrial"]).length * 8;
  const roadBonus = bestAdjacentRoadTier(building) === "avenue" ? 4 : 0;
  return clamp(48 + serviceScore + roadBonus - tile.pollution * 1.4 - industryPenalty, 20, 115);
}

function commercialLocationScore(building, residential) {
  const nearbyHomes = buildingsWithin(building, 5, ["residential"]).length;
  const roadBonus = bestAdjacentRoadTier(building) === "avenue" ? 18 : 4;
  const serviceBonus = (getTile(building.x, building.z).coverage.culture || 0) * 12 + (getTile(building.x, building.z).coverage.transport || 0) * 10;
  const customerBonus = Math.min(34, nearbyHomes * 5.5 + residential.length * 0.35);
  return clamp(42 + roadBonus + customerBonus + serviceBonus, 25, 125);
}

function industrialLocationScore(building) {
  const nearbyHomes = buildingsWithin(building, 4, ["residential"]).length;
  const roadBonus = bestAdjacentRoadTier(building) === "avenue" ? 24 : 5;
  const utilityScore = ((getTile(building.x, building.z).coverage.power || 0) + (getTile(building.x, building.z).coverage.water || 0)) * 20;
  return clamp(44 + roadBonus + utilityScore - nearbyHomes * 9, 20, 120);
}

function averageScore(buildings, scoreFn) {
  if (!buildings.length) return 0;
  return buildings.reduce((sum, building) => sum + scoreFn(building), 0) / buildings.length;
}

function spreadCoverage() {
  clearCoverageAndTraffic();
  const residential = city.buildings.filter((building) => building.type === "residential" && hasAdjacentRoad(getTile(building.x, building.z)));
  const pressures = servicePressureMap(residential);
  city.buildings.forEach((building) => {
    const config = BUILDINGS[building.type];
    const radius = buildingValue(building, "radius");
    const serviceRoad = config.service ? nearestRoadForBuilding(building) : null;
    if (config.service && radius) {
      city.tiles.forEach((tile) => {
        const reach = Math.max(0, radius - distance(building, tile));
        if (reach <= 0) return;
        const targetBuilding = tile.buildingId ? buildingById(tile.buildingId) : null;
        const targetRoad = targetBuilding ? nearestRoadForBuilding(targetBuilding) : null;
        const route = targetRoad && serviceRoad ? findPath(serviceRoad, targetRoad, { maxCost: radius * 2.2 }) : null;
        if (targetBuilding && !route) return;
        tile.coverage[config.service] = Math.max(tile.coverage[config.service] || 0, reach / radius);
        tile.coverageRoutes[config.service] = true;
      });
    }
    if (config.pollution) {
      const pollutionStrength = buildingValue(building, "pollution");
      city.tiles.forEach((tile) => {
        const reach = Math.max(0, 4 - distance(building, tile));
        tile.pollution += reach * pollutionStrength;
      });
    }
  });
  residential.forEach((home) => {
    const tile = getTile(home.x, home.z);
    Object.entries(tile.coverage).forEach(([service, value]) => {
      tile.coverage[service] = value * (pressures[service]?.score || 1);
    });
  });
  city.stats.servicePressure = pressures;
}

function nearestRoadForBuilding(building) {
  if (computationLookup?.roads.has(building.id)) return computationLookup.roads.get(building.id);
  const tile = getTile(building.x, building.z);
  const road = adjacentRoads(tile).sort((a, b) => ROAD_TIERS[b.roadTier].capacity - ROAD_TIERS[a.roadTier].capacity)[0] || null;
  computationLookup?.roads.set(building.id, road);
  return road;
}

function pathKey(start, end) {
  return `${city.roadVersion}:${start.x},${start.z}->${end.x},${end.z}`;
}

function findPath(start, end, options = {}) {
  const cacheable = true;
  if (!start || !end) return null;
  const key = `${pathKey(start, end)}:${options.maxCost || 'unlimited'}`;
  if (cacheable && city.pathCache.has(key)) return city.pathCache.get(key);
  if (city.pathCache.size >= 2048) city.pathCache.delete(city.pathCache.keys().next().value);

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
      if (cacheable) city.pathCache.set(key, route);
      return route;
    }

    roadNeighbors(current.tile).forEach(({ tile }) => {
      const nextId = `${tile.x},${tile.z}`;
      const cost = current.g + (tile.roadTier === "avenue" ? 0.8 : 1);
      if (options.maxCost && cost > options.maxCost) return;
      if (best.has(nextId) && best.get(nextId) <= cost) return;
      best.set(nextId, cost);
      open.push({ tile, g: cost, f: cost + distance(tile, end), parent: current });
    });
  }

  if (cacheable) city.pathCache.set(key, null);
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

function computeStats({ growPopulation = false } = {}) {
  const computationStarted = performance.now();
  layoutRevision += 1;
  computationLookup = { byId: new Map(city.buildings.map(building => [building.id, building])), roads: new Map() };
  heatmapDirty = true;
  lifeEffects = townLifeEffects(city.life);
  spreadCoverage();
  refreshRoadMasks();
  const activeBuildings = city.buildings.filter((building) => hasAdjacentRoad(getTile(building.x, building.z)));
  const roads = city.tiles.filter((tile) => tile.road);
  const residential = activeBuildings.filter((building) => building.type === "residential");
  const commercial = activeBuildings.filter((building) => building.type === "commercial");
  const industrial = activeBuildings.filter((building) => building.type === "industrial");
  const destinations = [...commercial, ...industrial];
  const residentialScore = averageScore(residential, residentialLocationScore);
  const commercialScore = averageScore(commercial, (building) => commercialLocationScore(building, residential));
  const industrialScore = averageScore(industrial, industrialLocationScore);
  const zoningScore = residential.length || commercial.length || industrial.length ? [residentialScore, commercialScore, industrialScore].filter(Boolean).reduce((sum, value) => sum + value, 0) / [residentialScore, commercialScore, industrialScore].filter(Boolean).length : 0;

  const capacity = residential.reduce((sum, building) => {
    const tile = getTile(building.x, building.z);
    const utilities = ((tile.coverage.power || 0) + (tile.coverage.water || 0)) / 2;
    const location = clamp(0.82 + (residentialLocationScore(building) - 70) / 260, 0.72, 1.12);
    return sum + Math.round(buildingValue(building, "capacity") * (0.35 + utilities * 0.65) * location);
  }, 0);

  const utilityNeed = Math.max(1, activeBuildings.filter((building) => building.type !== "park").length * GAME_BALANCE.utilityNeedPerBuilding + residential.length * GAME_BALANCE.utilityNeedPerHome);
  const powerSupply = activeBuildings.filter((building) => building.type === "power").reduce((sum, building) => sum + buildingValue(building, "supply"), 0);
  const waterSupply = activeBuildings.filter((building) => building.type === "water").reduce((sum, building) => sum + buildingValue(building, "supply"), 0);
  const power = clamp((powerSupply / utilityNeed) * 100);
  const water = clamp((waterSupply / utilityNeed) * 100);

  const baseHappiness = city.stats.happiness || 68;
  const targetPopulation = Math.round(capacity * clamp((baseHappiness - 22) / 68, 0.08, 1));
  const populationStep = Math.sign(targetPopulation - city.stats.population) * Math.min(Math.abs(targetPopulation - city.stats.population), GAME_BALANCE.residentialGrowthStep);
  const nextPopulation = Math.max(0, Math.min(capacity, city.stats.population + (growPopulation ? populationStep : 0)));
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
  const zoningBoost = residential.length ? (residentialScore - 62) * 0.08 : 0;
  const utilityPenalty = Math.max(0, 100 - power) * 0.09 + Math.max(0, 100 - water) * 0.09;
  const jobPenalty = city.residents.length > 0 ? Math.max(0, 78 - employmentRate) * 0.2 : 4;
  const transportRelief = transport * 0.08 + city.modifiers.trafficBonus + lifeEffects.traffic;
  const trafficPenalty = Math.max(0, 76 - city.stats.traffic - transportRelief) * 0.24 + routeStats.unreachableResidents * 0.45;
  const pollutionPenalty = Math.min(24, pollution * 0.16);
  const impact = eventImpact();
  const incomeEfficiency = clamp(0.55 + city.stats.traffic / 180, 0.45, 1);
  const residentialTax = routeStats.reachableResidents * BUILDINGS.residential.tax * (residential.length ? residential.reduce((sum, building) => sum + levelMultiplier("tax", buildingLevel(building)), 0) / residential.length : 1);
  const commercialLocationMultiplier = clamp(commercialScore / 82, 0.72, 1.28);
  const industrialLocationMultiplier = clamp(industrialScore / 82, 0.74, 1.22);
  const income =
    residentialTax +
    commercial.reduce((sum, building) => sum + buildingValue(building, "tax") * 8 * incomeEfficiency * commercialLocationMultiplier, 0) +
    industrial.reduce((sum, building) => sum + buildingValue(building, "tax") * 8 * incomeEfficiency * industrialLocationMultiplier, 0);
  const roadMaintenance = roads.reduce((sum, tile) => sum + ROAD_TIERS[tile.roadTier].maintenance, 0);
  const maintenance = roadMaintenance + activeBuildings.reduce((sum, building) => sum + buildingValue(building, "maintenance"), 0);
  const demoPolicy = demoEconomy(city.demo);
  const visitorIncome = neighborhoods?.weekIncome() || 0;
  const adjustedIncome = (income * impact.incomeMultiplier + impact.incomeDelta) * demoPolicy.income + visitorIncome;
  const adjustedMaintenance = (maintenance * lifeEffects.maintenance + impact.maintenanceDelta) * demoPolicy.maintenance + demoPolicy.upkeep;
  const fiscal = fiscalHealth({ money: city.stats.money, income: adjustedIncome, maintenance: adjustedMaintenance });
  const happinessReasons = [
    impactItem("base", "基础生活", GAME_BALANCE.baseHappiness, "positive"),
    impactItem("demo-policy", "小镇政策", demoPolicy.happiness, demoPolicy.happiness >= 0 ? "positive" : "negative"),
    impactItem("community", "社区共建", lifeEffects.happiness, "positive"),
    impactItem("service", "服务与公园", serviceBoost, "positive"),
    impactItem("zoning", "宜居区位", zoningBoost, zoningBoost >= 0 ? "positive" : "negative"),
    impactItem("fiscal", "财政安全", fiscal.happiness, fiscal.happiness >= 0 ? "positive" : "negative"),
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
    servicePressure: city.stats.servicePressure,
    zoning: { residentialScore, commercialScore, industrialScore },
    fiscal,
  });

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
  city.stats.zoning = {
    residential: residentialScore,
    commercial: commercialScore,
    industrial: industrialScore,
    overall: zoningScore,
  };
  city.stats.fiscal = fiscal;
  city.stats.happinessReasons = happinessReasons;
  city.stats.residentNeeds = residentNeeds;
  city.stats.unreachableResidents = routeStats.unreachableResidents;
  city.stats.averageCommute = routeStats.averageCommute;
  city.stats.income = Math.round(adjustedIncome);
  city.stats.visitors = visitorIncome;
  city.stats.maintenance = Math.round(adjustedMaintenance);
  city.report = {
    income: Math.round(adjustedIncome),
    maintenance: Math.round(adjustedMaintenance),
    net: Math.round(adjustedIncome - adjustedMaintenance),
    eventImpact: Math.round(adjustedIncome - visitorIncome - income - (adjustedMaintenance - maintenance)),
    taxes: Math.round(income),
    visitors: visitorIncome,
    trends: city.report?.trends || { population: "→0", money: "→0", traffic: "→0", happiness: "→0" },
  };
  computationLookup = null;
  frameStats.simulationMs = Math.round((performance.now() - computationStarted) * 100) / 100;
  return { income: adjustedIncome, maintenance: adjustedMaintenance };
}

function advanceWeek(count = 1) {
  city.undoStack = []; // Construction undo ends at settlement; it must not rewind time or income.
  for (let i = 0; i < count; i += 1) {
    const previousMoney = city.stats.money;
    const previousPopulation = city.stats.population;
    const previousTraffic = city.stats.traffic;
    const previousHappiness = city.stats.happiness;
    const { income, maintenance } = computeStats({ growPopulation: true });
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
    if (i === count - 1 && city.stats.money > previousMoney) {
      spawnBubble(`+${money(city.stats.money - previousMoney)}`, 9, 9, 0xffb85f);
      spawnIncomeEffect(city.stats.money - previousMoney);
    }
    if (i === count - 1 && city.stats.population > previousPopulation) {
      spawnBubble(`+${city.stats.population - previousPopulation} 人`, 8, 8, 0x5aa27d);
      spawnPopulationEffect(city.stats.population - previousPopulation);
    }
    if (i === count - 1) playSound(city.bankruptWeeks >= 3 || city.stats.fiscal?.score < 45 ? "warning" : "report");

    if (city.bankruptWeeks >= 6) {
      addMessage("财政连续赤字太久，小镇进入托管状态。拆除高维护设施或等待税收恢复。");
    } else {
      addMessage(`第 ${city.week} 周结算：收入 ${money(income)}，维护 ${money(maintenance)}。`);
    }
    updateEvents();
    maybeCompleteChapter();
    updateAchievements();
    townLife?.onWeek();
    demoController?.onWeek();
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
  if (city.stats.fiscal?.score < 55) messages.push({ title: "财政承压", text: `周净收益 ${money(city.stats.fiscal.net)}。先放缓高维护扩建，补足商业税基。` });
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
        ? `区位 ${Math.round(residentialLocationScore(building))}%，水电 ${Math.round(((tile.coverage.power || 0) + (tile.coverage.water || 0)) * 50)}%，教育 ${Math.round((tile.coverage.education || 0) * 100)}%，消防 ${Math.round((tile.coverage.fire || 0) * 100)}%，污染 ${Math.round(tile.pollution)}。`
        : building.type === "commercial"
          ? `商业区位 ${Math.round(commercialLocationScore(building, city.buildings.filter((item) => item.type === "residential")))}%，贴近住宅和主干路税收更高。`
          : building.type === "industrial"
            ? `工业区位 ${Math.round(industrialLocationScore(building))}%，靠主干路且远离住宅更高效。`
        : config.service
          ? `服务半径 ${buildingValue(building, "radius")} 格，容量 ${Math.round(city.stats.servicePressure?.[config.service]?.capacity || buildingValue(building, "serviceCapacity"))}/${Math.round(city.stats.servicePressure?.[config.service]?.demand || 0)}，覆盖会影响附近住宅。`
          : "";
    return { title: `${config.name} Lv.${buildingLevel(building)} (${active})`, text: `${config.hint} 关联居民/通勤 ${residents.length}。${coverageText} ${upgradeText}。` };
  }
  return { title: `草地 (${tile.x + 1}, ${tile.z + 1})`, text: "可以在这里规划新的道路或建筑。" };
}

function updateNeighborhoodFocus() {
  if (!neighborhoods) return;
  const result = neighborhoods.analyze();
  const quickStatus = document.getElementById('neighborhoodQuickStatus');
  if (quickStatus) quickStatus.textContent = result.count ? `${result.count} 种街区 · +${money(result.income)}/周` : '让邻居成为风景';
  const focus = city.neighborhoods?.focus;
  const district = result.districts.find(item => item.id === focus);
  neighborhoodOutline.visible = Boolean(district?.anchor) && !creativeControls?.isActive();
  if (district?.anchor) {
    const position = gridToWorld(district.anchor.x, district.anchor.z);
    neighborhoodOutline.position.set(position.x, 0.3, position.z);
    neighborhoodOutline.scale.setScalar((focus === 'school' ? 4 : 3) * TILE_SIZE);
    if (lastNeighborhoodFocus !== focus) {
      cameraTarget.set(position.x, 0, position.z);
      clampCameraTarget();
    }
  }
  lastNeighborhoodFocus = focus;
}

function renderUI() {
  const stats = city.stats;
  const chapter = currentChapter();
  els.money.textContent = money(stats.money);
  if (els.versionLabel) els.versionLabel.textContent = GAME_VERSION;
  if (els.helpVersion) els.helpVersion.textContent = GAME_VERSION;
  els.population.textContent = `${Math.round(stats.population)} / ${stats.capacity}`;
  els.happiness.textContent = `${Math.round(stats.happiness)}%`;
  els.employment.textContent = `${Math.round(stats.employmentRate)}%`;
  els.traffic.textContent = `${Math.round(stats.traffic)}%`;
  els.power.textContent = `${Math.round(stats.power)}%`;
  els.water.textContent = `${Math.round(stats.water)}%`;
  els.weekLabel.textContent = `第 ${city.week} 周`;
  els.calendar.textContent = `${seasons[Math.floor((city.week - 1) / 12) % seasons.length]} 第 ${city.week} 周`;
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
  els.undoButton.disabled = city.undoStack.length === 0;
  els.undoButton.title = city.undoStack.length ? `撤销：${city.undoStack.at(-1).label}` : "没有可以撤销的建造操作";
  els.zoomOutButton.disabled = camera.zoom <= CAMERA_MIN_ZOOM + 0.01;
  els.zoomInButton.disabled = camera.zoom >= CAMERA_MAX_ZOOM - 0.01;
  els.muteButton.textContent = city.settings.muted ? "×" : "♪";
  els.muteButton.classList.toggle("is-muted", city.settings.muted);
  els.muteButton.title = city.settings.muted ? "恢复声音" : "静音";
  els.musicButton.classList.toggle("active", city.settings.music && !city.settings.muted);
  els.musicButton.classList.toggle("is-muted", !city.settings.music || city.settings.muted);
  els.musicButton.title = city.settings.music ? "关闭背景音乐" : "开启背景音乐";
  els.volumeSlider.value = `${Math.round(city.settings.volume * 100)}`;
  els.shortcutHint.classList.toggle("is-open", city.settings.shortcutHelp);
  els.shortcutHelpButton.classList.toggle("active", city.settings.shortcutHelp);
  els.helpButton.classList.toggle("active", city.settings.helpOpen);
  els.helpOverlay.classList.toggle("is-open", city.settings.helpOpen);
  els.helpOverlay.setAttribute("aria-hidden", city.settings.helpOpen ? "false" : "true");

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
  els.reportDetails.textContent = `收入 ${money(city.report.income)}（含游客 ${money(city.report.visitors || 0)}） / 维护 ${money(city.report.maintenance)} / 净收益 ${money(city.report.net)} / 财政 ${Math.round(stats.fiscal?.score || 0)}% / 储备 ${Math.max(0, Math.round(stats.fiscal?.reserveWeeks || 0))} 周 / 人口 ${city.report.trends.population} / 资金 ${city.report.trends.money} / 交通 ${city.report.trends.traffic} / 幸福 ${city.report.trends.happiness}。`;
  demoController?.render();
  townLife?.render();
  neighborhoods?.render();
  updateNeighborhoodFocus();
  updateHeatmap();
  updateRoadCongestionVisuals();
  worldArt?.setOccupied?.(city.tiles);
  const performanceSelect = document.getElementById('performanceSelect');
  if (performanceSelect) performanceSelect.value = city.settings.performance;
  const resolution = Math.min(window.devicePixelRatio, (PERFORMANCE_MODES[city.settings.performance] || PERFORMANCE_MODES[DEFAULT_PERFORMANCE]).resolution);
  if (renderer.getPixelRatio() !== resolution) renderer.setPixelRatio(resolution);
  updateHover();
  requestRender();
}

function updateHover() {
  if (!city.selectedTile || !pointerOnMap || demoController?.isBlocking() || creativeControls?.isActive()) {
    hoverMesh.visible = false;
    if (ghost) ghost.visible = false;
    radiusPreview.visible = false;
    placementHint.hidden = true;
    return;
  }
  const { x, z } = gridToWorld(city.selectedTile.x, city.selectedTile.z);
  const check = canBuild(city.selectedTool, city.selectedTile);
  hoverMesh.material = check.ok ? hoverMaterial : invalidMaterial;
  hoverMesh.position.set(x, 0.18, z);
  hoverMesh.visible = true;
  placementHint.hidden = false;
  placementHint.classList.toggle('invalid', !check.ok);
  const config = BUILDINGS[city.selectedTool];
  let hint = check.ok ? `${config.name} · ${money(city.selectedTool === 'road' ? ROAD_TIERS[city.selectedRoadTier].cost : config.cost || 0)}${config.radius ? ` · 覆盖 ${config.radius} 格` : ''}` : check.reason;
  if (check.ok && city.selectedTool !== 'road') {
    const preview = neighborhoods?.preview(city.selectedTool, city.selectedTile.x, city.selectedTile.z);
    if (preview?.valid && preview.text) hint += ` · ${preview.text}`;
  }
  if (placementHint.textContent !== hint) placementHint.textContent = hint;
  const showGhost = city.selectedTool !== 'road' && city.selectedTool !== 'bulldoze' && !city.selectedTile.buildingId && !city.selectedTile.road;
  if (showGhost && ghostType !== city.selectedTool) {
    if (ghost) disposeLocalObject(ghost);
    ghost = createBuildingMesh(city.selectedTool);
    ghostType = city.selectedTool;
    ghost.userData.preview = true;
    worldArt?.decorateBuilding(ghost, city.selectedTool, city.selectedTile.x, city.selectedTile.z, 1);
    ghost.traverse((mesh) => {
      if (!mesh.material) return;
      const old = mesh.material;
      mesh.material = previewMaterial;
      if (!old.userData.artSharedResource && !old.userData.persistent) old.dispose();
    });
    scene.add(ghost);
  }
  if (ghost) {
    ghost.visible = showGhost;
    ghost.position.set(x, 0.16, z);
    if (ghost.userData.valid !== check.ok) {
      ghost.traverse((mesh) => { if (mesh.material) mesh.material.color.setHex(check.ok ? 0x65bf9c : 0xe87b73); });
      ghost.userData.valid = check.ok;
    }
  }
  radiusPreview.visible = showGhost && Boolean(config.radius);
  if (radiusPreview.visible) {
    radiusPreview.position.set(x, 0.28, z);
    radiusPreview.scale.setScalar(config.radius * TILE_SIZE);
  }
}

function setTool(tool) {
  if (!isToolUnlocked(tool)) {
    addMessage(unlockState(tool).label);
    playSound("warning");
    renderUI();
    return;
  }
  city.selectedTool = tool;
  playSound("ui");
  renderUI();
  updateHover();
}

function setRoadTier(tier) {
  city.selectedRoadTier = tier;
  city.selectedTool = "road";
  playSound("ui");
  renderUI();
  updateHover();
}

function pickTile(event, includeBuildings = true) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  if (!raycaster.ray.intersectPlane(pickingPlane, pickingPoint)) return null;
  const half = GRID_SIZE * TILE_SIZE / 2;
  const x = Math.floor((pickingPoint.x + half) / TILE_SIZE);
  const z = Math.floor((pickingPoint.z + half) / TILE_SIZE);
  if (includeBuildings && !creativeControls?.isActive() && !event.shiftKey) {
    // A roof projects beyond its ground tile. Only nearby buildings can cover
    // this ray: inspect at most a 7×7 neighborhood, never all town geometry.
    const candidates = [];
    for (let dz = -3; dz <= 3; dz += 1) for (let dx = -3; dx <= 3; dx += 1) {
      const id = getTile(x + dx, z + dz)?.buildingId;
      if (id) { const building = buildingById(id); if (building) candidates.push(building.mesh); }
    }
    const hit = raycaster.intersectObjects(candidates, true)[0];
    if (hit) {
      let object = hit.object;
      while (object && !object.userData.tile) object = object.parent;
      if (object?.userData.tile) return object.userData.tile;
    }
  }
  return getTile(x, z);
}

function refreshVisualAgents() {
  const previous = city.visualAgents;
  city.visualAgents = city.residents
    .filter((resident) => resident.route?.length > 1)
    .slice(0, MAX_VISUAL_AGENTS)
    .map((resident, index) => {
      const kind = resident.route.length > 4 ? 'car' : 'walker';
      return {
        residentId: resident.id,
        route: resident.route,
        kind,
        offset: previous[index]?.offset ?? ((index * 0.618) % 1),
        speed: (kind === 'car' ? 0.22 : 0.12) * (0.8 + (index % 5) * 0.08),
      };
    });
  updateVisualAgents(0);
}

function updateVisualAgents(delta) {
  let cars = 0, walkers = 0;
  const speed = delta * clamp(city.stats.traffic / 100, 0.25, 1.2);
  const offset = (GRID_SIZE - 1) * TILE_SIZE / 2;
  const colors = [0xff9aa8, 0x8fc7ff, 0xffd36f, 0x9be28d];
  for (let i = 0; i < city.visualAgents.length; i += 1) {
    const agent = city.visualAgents[i];
    agent.offset = (agent.offset + speed * agent.speed) % 1;
    const scaled = agent.offset * (agent.route.length - 1);
    const index = Math.floor(scaled);
    const progress = scaled - index;
    const a = agent.route[index], b = agent.route[Math.min(index + 1, agent.route.length - 1)];
    const x = (a.x + (b.x - a.x) * progress) * TILE_SIZE - offset;
    const z = (a.z + (b.z - a.z) * progress) * TILE_SIZE - offset;
    const rotation = Math.atan2(b.x - a.x, b.z - a.z);
    if (agent.kind === 'car') {
      putInstance(agentBatches.car, cars, x, 0.58, z, 1, 1, 1, rotation);
      agentBatches.car.setColorAt(cars, batchColor.setHex(colors[i % colors.length]));
      putInstance(agentBatches.roof, cars++, x, 0.77, z, 1, 1, 1, rotation);
    } else {
      putInstance(agentBatches.walker, walkers, x, 0.64, z);
      agentBatches.walker.setColorAt(walkers++, batchColor.setHex(colors[i % colors.length]));
    }
  }
  finishBatch(agentBatches.car, cars);
  finishBatch(agentBatches.roof, cars);
  finishBatch(agentBatches.walker, walkers);
}

function updateEffects(delta) {
  for (let i = effectGroup.children.length - 1; i >= 0; i -= 1) {
    const item = effectGroup.children[i];
    item.userData.age += delta;
    const duration = item.userData.duration || 1.3;
    const progress = clamp(item.userData.age / duration, 0, 1);
    if (item.userData.kind === "ring") {
      item.scale.setScalar((item.userData.baseScale || 0.4) + progress * 1.1);
      item.material.opacity = 0.72 * (1 - progress);
    } else if (item.userData.kind === "construction") {
      item.position.y += delta * (item.userData.drift || 0.1);
      item.rotation.y += delta * 2.2;
      item.scale.y = Math.max(0.08, 1 - progress * 0.72);
      item.material.opacity = 1 - progress;
      item.material.transparent = true;
    } else if (item.userData.kind === "particle") {
      item.position.addScaledVector(item.userData.velocity, delta);
      item.userData.velocity.y -= delta * 1.4;
      item.rotation.y += delta * 4;
      item.material.opacity = 1 - progress;
      item.material.transparent = true;
    } else {
      item.position.y += delta * 0.9;
      item.material.opacity = Math.max(0, 1 - item.userData.age * 0.8);
    }
    if (item.userData.age > duration) disposeLocalObject(item);
  }
}

function updateRoadCongestionVisuals() {
  let count = 0;
  for (const tile of city.tiles) {
    if (!tile.road || tile.congestion <= 0.75) continue;
    const position = gridToWorld(tile.x, tile.z);
    putInstance(congestionBatch, count++, position.x, 0.2, position.z);
  }
  finishBatch(congestionBatch, count);
}

canvas.addEventListener("pointerdown", (event) => {
  if (demoController?.isBlocking()) return;
  if (event.button !== 0 && event.button !== 2) return;
  drag.active = true;
  drag.moved = false;
  drag.x = event.clientX;
  drag.y = event.clientY;
  drag.startX = event.clientX;
  drag.startY = event.clientY;
  drag.paint = !creativeControls?.isActive() && event.button === 0 && event.shiftKey && city.selectedTool === 'road';
  drag.lastTile = null;
  drag.initialUndo = drag.paint ? captureUndoState('连续铺路') : null;
  drag.painted = false;
  if (drag.paint) paintRoad(pickTile(event));
  canvas.setPointerCapture(event.pointerId);
  requestRender(true);
});

canvas.addEventListener("pointermove", (event) => {
  const entering = !pointerOnMap;
  pointerOnMap = true;
  placementHint.style.left = `${Math.min(window.innerWidth - 350, event.clientX + 20)}px`;
  placementHint.style.top = `${Math.min(window.innerHeight - 120, event.clientY + 24)}px`;
  const tile = pickTile(event);
  if (entering || tile !== city.selectedTile) {
    city.selectedTile = tile;
    updateHover();
    const selected = selectedDescription();
    els.selectedTitle.textContent = selected.title;
    els.selectedInfo.textContent = selected.text;
  }
  requestRender(true);
  if (!drag.active) return;
  if (drag.paint) { paintRoad(tile); return; }
  const dx = event.clientX - drag.x;
  const dy = event.clientY - drag.y;
  if (Math.abs(event.clientX - drag.startX) + Math.abs(event.clientY - drag.startY) > 5) drag.moved = true;
  cameraTarget.x -= dx * 0.035;
  cameraTarget.z -= dy * 0.035;
  clampCameraTarget();
  drag.x = event.clientX;
  drag.y = event.clientY;
});

canvas.addEventListener("pointerup", (event) => {
  const tile = pickTile(event);
  if (!drag.active) return;
  if (drag.paint && drag.painted && drag.initialUndo.save.city.week === city.week) city.undoStack = [drag.initialUndo];
  const placed = !creativeControls?.isActive() && tile && !drag.moved && !drag.paint && event.button === 0 && place(city.selectedTool, tile.x, tile.z);
  drag.active = false;
  canvas.releasePointerCapture(event.pointerId);
  if (placed || drag.painted) { computeStats(); refreshVisualAgents(); }
  renderUI();
});

canvas.addEventListener('contextmenu', (event) => event.preventDefault());
canvas.addEventListener('pointerleave', () => { pointerOnMap = false; updateHover(); requestRender(); });
function cancelPointerGesture() {
  if (drag.active && drag.paint && drag.painted) {
    if (drag.initialUndo.save.city.week === city.week) city.undoStack = [drag.initialUndo];
    computeStats();
    refreshVisualAgents();
  }
  drag.active = false;
  pointerOnMap = false;
  updateHover();
  renderUI();
}
canvas.addEventListener('pointercancel', cancelPointerGesture);
canvas.addEventListener('lostpointercapture', () => { if (drag.active) cancelPointerGesture(); });
function paintRoad(tile) {
  if (!tile || creativeControls?.isActive()) return;
  const previous = drag.lastTile || tile;
  const path = [];
  let x = previous.x, z = previous.z;
  while (x !== tile.x) { x += Math.sign(tile.x - x); path.push(getTile(x, z)); }
  while (z !== tile.z) { z += Math.sign(tile.z - z); path.push(getTile(x, z)); }
  path.push(tile);
  for (const step of path) if (canBuild('road', step).ok && place('road', step.x, step.z)) drag.painted = true;
  drag.lastTile = tile;
}

canvas.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    const zoom = event.deltaY > 0 ? 1.08 : 0.92;
    setCameraZoom(camera.zoom / zoom);
    renderUI();
  },
  { passive: false },
);

els.toolButtons.forEach((button) => button.addEventListener("click", () => setTool(button.dataset.tool)));
els.roadTierButtons.forEach((button) => button.addEventListener("click", () => setRoadTier(button.dataset.roadTier)));
els.pauseButton.addEventListener("click", togglePause);
els.speedButton.addEventListener("click", cycleSpeed);
els.undoButton.addEventListener("click", undoLastAction);
els.zoomOutButton.addEventListener("click", () => zoomCamera(-1));
els.zoomInButton.addEventListener("click", () => zoomCamera(1));
els.centerCameraButton.addEventListener("click", centerCamera);
els.muteButton.addEventListener("click", () => {
  updateSettings({ muted: !city.settings.muted });
  playSound("ui");
});
els.musicButton.addEventListener("click", () => {
  updateSettings({ music: !city.settings.music, muted: false });
  playSound("ui");
});
els.volumeSlider.addEventListener("input", () => {
  updateSettings({ volume: Number(els.volumeSlider.value) / 100, muted: Number(els.volumeSlider.value) <= 0 });
});
document.getElementById('performanceSelect')?.addEventListener('change', (event) => {
  updateSettings({ performance: event.target.value });
  saveGame(false);
});
els.shortcutHelpButton.addEventListener("click", () => {
  updateSettings({ shortcutHelp: !city.settings.shortcutHelp });
  playSound("ui");
});
els.helpButton.addEventListener("click", () => {
  updateSettings({ helpOpen: !city.settings.helpOpen });
  playSound("ui");
});
els.helpCloseButton.addEventListener("click", () => {
  updateSettings({ helpOpen: false });
  playSound("ui");
});
els.saveButton.addEventListener("click", () => saveGame(true));
els.newGameButton.addEventListener("click", () => {
  demoController?.setWelcome(true);
});
els.resetButton.addEventListener("click", () => {
  demoController?.confirm("清除本地存档", "这会清除当前浏览器里的城镇。建议先导出一份存档，之后仍可导入继续。", "清除并返回菜单", () => {
    startNewGame();
    demoController.setWelcome(true);
  });
});
els.upgradeButton.addEventListener("click", () => upgradeSelectedBuilding());

window.addEventListener("keydown", (event) => {
  if (graphicsLost) return;
  if (demoController?.isBlocking()) return;
  if (event.defaultPrevented) return;
  if (
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLTextAreaElement ||
    event.target instanceof HTMLSelectElement
  ) {
    return;
  }
  const key = event.key.toLowerCase();
  if (creativeControls?.isActive() && (event.ctrlKey || event.metaKey || event.altKey || !['c', '+', '=', '-', '_'].includes(key))) return;
  const toolKeys = {
    "1": "road",
    "2": "residential",
    "3": "commercial",
    "4": "industrial",
    "5": "park",
    "6": "school",
    "7": "fire",
    "8": "power",
    "9": "water",
    b: "bulldoze",
  };
  if (toolKeys[key]) {
    event.preventDefault();
    setTool(toolKeys[key]);
    return;
  }
  if (key === "a") {
    event.preventDefault();
    setRoadTier(city.selectedRoadTier === "lane" ? "avenue" : "lane");
    return;
  }
  if (key === " ") {
    event.preventDefault();
    togglePause();
    return;
  }
  if (key === "v") {
    event.preventDefault();
    cycleSpeed();
    return;
  }
  if (key === "+" || key === "=") {
    event.preventDefault();
    zoomCamera(1);
    return;
  }
  if (key === "-" || key === "_") {
    event.preventDefault();
    zoomCamera(-1);
    return;
  }
  if (key === "c") {
    event.preventDefault();
    centerCamera();
    return;
  }
  if (key === "u" || (event.ctrlKey && key === "z")) {
    event.preventDefault();
    undoLastAction();
    return;
  }
  if (key === "escape") {
    event.preventDefault();
    if (city.settings.helpOpen) {
      updateSettings({ helpOpen: false });
      playSound("ui");
      return;
    }
    city.selectedTile = null;
    city.selectedTool = "road";
    playSound("ui");
    renderUI();
  }
});

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const aspect = width / height;
  const viewHeight = 36;
  camera.left = (-viewHeight * aspect) / 2;
  camera.right = (viewHeight * aspect) / 2;
  camera.top = viewHeight / 2;
  camera.bottom = -viewHeight / 2;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

function animateScene(elapsed, delta) {
  const frameTime = performance.now() / 1000;
  worldArt?.update(delta, { week: city.week, festival: Boolean(city.demo?.festival) });
  const damping = 1 - Math.exp(-delta * 14);
  camera.position.x += (cameraTarget.x + 29 - camera.position.x) * damping;
  camera.position.z += (cameraTarget.z + 34 - camera.position.z) * damping;
  camera.lookAt(cameraTarget.x, 0, cameraTarget.z);
  for (const mesh of buildingGroup.children) {
    if (mesh.userData.settled) continue;
    const age = Math.max(0, frameTime - (mesh.userData.birth || 0));
    const bounce = age < 0.65 ? 1 + Math.sin(age * Math.PI * 4) * (1 - age / 0.65) * 0.12 : 1;
    mesh.scale.setScalar((1 + ((mesh.userData.level || 1) - 1) * 0.12) * bounce);
    mesh.updateMatrix();
    if (age >= 0.65) mesh.userData.settled = true;
  }
  updateVisualAgents(delta);
  updateEffects(delta);
}

function seedTown() {
  clearCityContent();
  city.undoStack = [];
  for (let x = 5; x <= 12; x += 1) place("road", x, 9, { tier: x >= 7 && x <= 10 ? "avenue" : "lane" });
  place("road", 8, 8);
  place("road", 8, 10);
  place("residential", 7, 8);
  place("commercial", 9, 8);
  city.undoStack = [];
  city.stats.money = INITIAL_MONEY - ROAD_TIERS.lane.cost * 6 - ROAD_TIERS.avenue.cost * 4 - 900 - 1300;
  computeStats();
  refreshVisualAgents();
  addMessage("晴日港有了一条主街。接下来补上电力、水塔和更多住宅吧。");
}

function seedScenario(id, scenario) {
  const settings = { ...city.settings, helpOpen: false };
  resetMetaState();
  const tiles = [];
  for (let x = 4; x <= 13; x += 1) tiles.push({ x, z: 9, roadTier: x >= 7 && x <= 10 ? 'avenue' : 'lane' });
  for (let z = 5; z <= 13; z += 1) if (z !== 9) tiles.push({ x: 8, z, roadTier: 'lane' });
  const homes = id === 'commerce' ? [[6, 8], [7, 7], [7, 6]] : [[6, 8], [7, 7], [7, 8]];
  const buildings = homes.map(([x,z]) => ({ type: 'residential', x, z, level: 1, age: 2 }));
  buildings.push({ type: 'commercial', x: 9, z: 8, level: 1, age: 2 }, { type: 'power', x: 9, z: 6, level: 1, age: 2 });
  if (id === 'garden') buildings.push({ type: 'park', x: 7, z: 10, level: 1 });
  if (id === 'commerce') buildings.push({ type: 'commercial', x: 10, z: 8, level: 1 });
  const snapshot = { version: SAVE_VERSION, city: { tiles, buildings, week: 1, money: scenario.money, population: 20, settings, demo: { scenario: id } } };
  applySave(snapshot);
  city.stats.money = scenario.money;
  city.undoStack = [];
  city.messages = [`欢迎来到${scenario.town}。${scenario.tagline}`];
  cameraTarget.set(0, 0, 0);
  setCameraZoom(1.16);
}

function bootGame() {
  worldArt = createWorldArt({ THREE, scene, gridSize: GRID_SIZE, tileSize: TILE_SIZE });
  createTiles();
  neighborhoods = createNeighborhoods({
    city, isConnected: building => hasAdjacentRoad(getTile(building.x, building.z)),
    getRevision: () => layoutRevision, saveGame, renderUI, addMessage,
    canBuild: (type, x, z) => canBuild(type, getTile(x, z)),
    celebrate: spawnChapterCelebration, toast: message => demoController?.toast(message),
  });
  neighborhoods.init();
  const loaded = !TEST_MODE && loadGameFromStorage();
  if (!loaded) startNewGame({ keepStorage: TEST_MODE });
  syncMusic();
  renderUI();
  exposeTestApi();
  demoController = createDemoController({ city, seedScenario, renderUI, recompute: () => { computeStats(); refreshVisualAgents(); }, setTool, setRoadTier, setViewMode, addMessage, celebrate: spawnChapterCelebration, serializeGame, saveGame, validateSave, loadSave: applySave, isGraphicsLost: () => graphicsLost, isPhotoMode: () => Boolean(creativeControls?.isActive()), hasSave: () => { try { return Boolean(localStorage.getItem(SAVE_KEY)); } catch { return false; } } });
  demoController.boot({ testMode: TEST_MODE });
  townLife = createTownLife({ city, isConnected: b => hasAdjacentRoad(getTile(b.x, b.z)), recompute: () => { computeStats(); refreshVisualAgents(); }, save: () => saveGame(false), render: renderUI, addMessage, toast: message => demoController.toast(message), confirm: (...args) => demoController.confirm(...args), celebrate: spawnChapterCelebration });
  creativeControls = createCreativeControls({
    canEnter: () => !graphicsLost && !demoController.isBlocking() && !city.settings.helpOpen,
    getPaused: () => city.paused,
    setPaused: value => { city.paused = value; renderUI(); },
    onChange: () => { cancelPointerGesture(); updateNeighborhoodFocus(); requestRender(true); },
  });
  renderUI();
  if (TEST_MODE) window.sunnyTownTest.demo = demoController;
  if (TEST_MODE) window.sunnyTownTest.life = townLife;
  if (TEST_MODE) window.sunnyTownTest.neighborhoods = neighborhoods;
  if (TEST_MODE) window.sunnyTownTest.photo = creativeControls;
}

function exposeTestApi() {
  if (!TEST_MODE) return;
  window.sunnyTownTest = {
    place: (...args) => { const result = place(...args); if (result) { computeStats(); refreshVisualAgents(); renderUI(); } return result; },
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
    loadFromStorage: loadGameFromStorage,
    getRenderStats: () => ({ ...frameStats, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }),
    projectTile: (x, z, height = 0.1) => {
      camera.updateMatrixWorld();
      const position = gridToWorld(x, z);
      const projected = new THREE.Vector3(position.x, height, position.z).project(camera);
      const bounds = canvas.getBoundingClientRect();
      return { x: bounds.left + (projected.x + 1) * bounds.width / 2, y: bounds.top + (1 - projected.y) * bounds.height / 2 };
    },
    getState: () => ({
      version: GAME_VERSION,
      saveVersion: SAVE_VERSION,
      demo: city.demo ? JSON.parse(JSON.stringify(city.demo)) : null,
      neighborhoods: normalizeNeighborhoods(city.neighborhoods),
      photoMode: creativeControls?.isActive() || false,
      art: worldArt?.stats(),
      rendering: { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, ...frameStats, graphicsLost, pixelRatio: renderer.getPixelRatio() },
      stats: { ...city.stats },
      week: city.week,
      weekProgress: city.weekProgress,
      paused: city.paused,
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
      selectedTile: city.selectedTile ? { x: city.selectedTile.x, z: city.selectedTile.z } : null,
      selectedRoadTier: city.selectedRoadTier,
      settings: { ...city.settings },
      helpOpen: city.settings.helpOpen,
      assetManifest: assetManifestSummary(),
      assetRuntime: {
        ...assetRuntime,
        cachedTextures: 0,
      },
      effectCount: effectGroup.children.length,
      musicEnabled: Boolean(city.settings.music && !city.settings.muted),
      undoDepth: city.undoStack.length,
      undoLabel: city.undoStack.at(-1)?.label || null,
      camera: {
        zoom: camera.zoom,
        target: { x: cameraTarget.x, z: cameraTarget.z },
        limit: CAMERA_LIMIT,
      },
      roadVersion: city.roadVersion,
      buildingCount: city.buildings.length,
      landmarkCount: countLandmarks(),
      residentCount: city.residents.length,
      visualAgentCount: city.visualAgents.length,
      roadCount: city.tiles.filter((tile) => tile.road).length,
      buildings: city.buildings.map((building) => ({ id: building.id, type: building.type, x: building.x, z: building.z, level: buildingLevel(building) })),
      tiles: city.tiles.map((tile) => ({
        x: tile.x,
        z: tile.z,
        type: tile.type,
        buildingId: tile.buildingId,
        coverage: { ...tile.coverage },
        coverageRoutes: { ...tile.coverageRoutes },
        pollution: tile.pollution,
      })),
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
    setQaMetrics: (metrics = {}) => {
      if (Number.isFinite(metrics.chapterIndex)) city.chapterIndex = clamp(metrics.chapterIndex, 0, CHAPTERS.length - 1);
      Object.entries(metrics.stats || {}).forEach(([key, value]) => {
        if (Number.isFinite(value) && key in city.stats) city.stats[key] = value;
      });
      renderUI();
    },
    recompute: () => {
      computeStats();
      refreshVisualAgents();
      renderUI();
    },
    setSettings: (settings) => {
      updateSettings(settings);
    },
    setHelpOpen: (open) => {
      updateSettings({ helpOpen: Boolean(open) });
    },
    writeRawSave: (value) => {
      localStorage.setItem(SAVE_KEY, value);
    },
    clearRawSave: () => {
      localStorage.removeItem(SAVE_KEY);
    },
    undo: undoLastAction,
  };
}

window.addEventListener("resize", resize);
resize();
bootGame();

let frameTimer = null;
let frameRequest = null;
let lastFrameAt = performance.now();
let nextFrameAt = lastFrameAt;
let animationElapsed = 0;

function stopFrameSchedule() {
  clearTimeout(frameTimer);
  cancelAnimationFrame(frameRequest);
  frameTimer = null;
  frameRequest = null;
}

function renderTargetFps(now = performance.now()) {
  const mode = PERFORMANCE_MODES[city.settings.performance] || PERFORMANCE_MODES[DEFAULT_PERFORMANCE];
  if (demoController?.isBlocking()) return 1;
  return city.paused && !drag.active && now >= interactionUntil ? Math.min(10, mode.fps) : mode.fps;
}

function scheduleFrame() {
  if (document.hidden || graphicsLost || frameTimer !== null || frameRequest !== null) return;
  // Register before the next display refresh, rather than waiting a whole frame
  // interval and then another refresh. The deadline is carried across frames.
  const wait = nextFrameAt - performance.now() - 17;
  if (wait > 1) {
    frameTimer = setTimeout(() => {
      frameTimer = null;
      frameRequest = requestAnimationFrame(animate);
    }, wait);
  } else frameRequest = requestAnimationFrame(animate);
}

function requestRender(interactive = false) {
  if (!renderLoopReady || frameExecuting || document.hidden || graphicsLost) return;
  const now = performance.now();
  if (interactive) interactionUntil = now + 220;
  const mode = PERFORMANCE_MODES[city.settings.performance] || PERFORMANCE_MODES[DEFAULT_PERFORMANCE];
  nextFrameAt = Math.min(nextFrameAt, lastFrameAt + 1000 / mode.fps);
  stopFrameSchedule();
  scheduleFrame();
}

function animate() {
  frameRequest = null;
  if (graphicsLost) return;
  if (document.hidden) { frameStats.hidden = true; return; }
  const started = performance.now();
  if (started + 1 < nextFrameAt) { scheduleFrame(); return; }
  frameExecuting = true;
  const delta = Math.min((started - lastFrameAt) / 1000, 0.15);
  lastFrameAt = started;
  animationElapsed += delta;
  if (!city.paused && !demoController?.isBlocking() && !drag.active) {
    city.weekProgress += delta * city.speed;
    const weekDuration = city.demo ? 7 : WEEK_SECONDS;
    if (city.weekProgress >= weekDuration) {
      city.weekProgress -= weekDuration;
      advanceWeek();
    }
  }
  animateScene(animationElapsed, delta);
  renderer.render(scene, camera);
  frameStats.frames += 1;
  frameStats.cpuMs = Math.round((frameStats.cpuMs * 0.8 + (performance.now() - started) * 0.2) * 100) / 100;
  frameStats.targetFps = renderTargetFps(started);
  const interval = 1000 / frameStats.targetFps;
  nextFrameAt += interval;
  if (nextFrameAt < started) nextFrameAt = started + interval;
  frameExecuting = false;
  scheduleFrame();
}

document.addEventListener('visibilitychange', () => {
  stopFrameSchedule();
  frameStats.hidden = document.hidden;
  if (document.hidden) {
    if (drag.active) cancelPointerGesture();
    stopMusic();
    audioContext?.suspend();
  } else {
    lastFrameAt = nextFrameAt = performance.now();
    if (!graphicsLost && !city.settings.muted) audioContext?.resume().catch(() => {});
    syncMusic();
    scheduleFrame();
  }
});
window.addEventListener('pagehide', stopFrameSchedule);
window.addEventListener('pageshow', event => {
  if (event.persisted && !document.hidden) {
    stopFrameSchedule();
    lastFrameAt = nextFrameAt = performance.now();
    scheduleFrame();
  }
});


const graphicsDialog = document.createElement('dialog');
graphicsDialog.id = 'graphicsRecovery';
graphicsDialog.className = 'graphics-recovery';
graphicsDialog.setAttribute('aria-labelledby', 'graphicsRecoveryTitle');
graphicsDialog.innerHTML = '<span>晴日建设课</span><h2 id="graphicsRecoveryTitle">画面暂时中断，小镇已暂停</h2><p id="graphicsRecoveryStatus" role="status">浏览器的图形连接中断了。当前城镇仍在内存中，时间和资金不会继续变化。</p><div><button id="retryGraphics" type="button">尝试恢复画面</button><button id="backupGraphics" type="button">导出城镇备份</button><button id="reloadGraphics" type="button">保存后刷新</button></div><small>如果反复出现，请检查浏览器硬件加速设置，或换一个支持 WebGL 2 的浏览器。</small>';
document.body.append(graphicsDialog);
const graphicsExtension = renderer.getContext().getExtension('WEBGL_lose_context');
graphicsDialog.addEventListener('cancel', event => event.preventDefault());
document.getElementById('retryGraphics').onclick = () => {
  document.getElementById('graphicsRecoveryStatus').textContent = '已请求恢复画面。如果仍没有恢复，可以先导出备份，或保存后刷新。';
  try { graphicsExtension?.restoreContext(); } catch { /* The driver may not yet permit restoration. */ }
};
document.getElementById('backupGraphics').onclick = () => document.getElementById('exportSaveButton').click();
document.getElementById('reloadGraphics').onclick = () => {
  if (saveGame(false)) location.reload();
  else document.getElementById('graphicsRecoveryStatus').textContent = '浏览器未能保存。请先用「导出城镇备份」保留进度，再刷新页面。';
};
canvas.addEventListener('webglcontextlost', event => {
  event.preventDefault();
  graphicsLost = true;
  creativeControls?.exit();
  stopFrameSchedule();
  if (drag.active) cancelPointerGesture();
  stopMusic();
  audioContext?.suspend().catch(() => {});
  if (!graphicsDialog.open) graphicsDialog.showModal();
});
canvas.addEventListener('webglcontextrestored', () => {
  graphicsLost = false;
  graphicsDialog.close();
  lastFrameAt = nextFrameAt = performance.now();
  stopFrameSchedule();
  syncMusic();
  if (!document.hidden) scheduleFrame();
  demoController?.toast('画面恢复了，继续照顾小镇吧。');
});
renderLoopReady = true;
animate();
