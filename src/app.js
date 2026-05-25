import * as THREE from "../node_modules/three/build/three.module.js";

const GRID_SIZE = 18;
const TILE_SIZE = 2.4;
const WEEK_SECONDS = 4;
const INITIAL_MONEY = 50000;

const BUILDINGS = {
  road: { name: "道路", cost: 80, maintenance: 2, color: 0xd9cda8, hint: "道路会连接建筑，是小镇的骨架。" },
  residential: {
    name: "住宅",
    cost: 900,
    maintenance: 8,
    tax: 38,
    capacity: 38,
    jobs: 0,
    color: 0xffb8c9,
    hint: "住宅需要靠近道路、电力和水力，居民才会搬入。",
  },
  commercial: {
    name: "商业",
    cost: 1300,
    maintenance: 18,
    tax: 72,
    jobs: 42,
    color: 0xffd36f,
    hint: "商业提供岗位和税收，也会带来一些交通。",
  },
  industrial: {
    name: "工业",
    cost: 1600,
    maintenance: 22,
    tax: 92,
    jobs: 64,
    pollution: 14,
    color: 0x9fc0cf,
    hint: "工业岗位多、税收高，但会制造污染和交通。",
  },
  park: { name: "公园", cost: 1100, maintenance: 18, service: "park", radius: 3, color: 0x8ddf91, hint: "公园会提升附近住宅幸福度。" },
  school: { name: "学校", cost: 2600, maintenance: 42, service: "education", radius: 4, color: 0xffc36e, hint: "学校提升教育覆盖和长期幸福度。" },
  fire: { name: "消防站", cost: 3200, maintenance: 50, service: "fire", radius: 5, color: 0xff8b7f, hint: "消防站降低城市风险，提高居民安心感。" },
  power: { name: "电力", cost: 3600, maintenance: 55, service: "power", radius: 6, supply: 320, color: 0xffe47a, hint: "电力设施为附近建筑供电。" },
  water: { name: "水塔", cost: 2800, maintenance: 45, service: "water", radius: 6, supply: 320, color: 0x84c9ff, hint: "水塔为附近建筑供水。" },
  bulldoze: { name: "拆除", cost: 0, hint: "拆除建筑会退回少量资金，道路也可以拆。" },
};

const TOOL_ORDER = ["road", "residential", "commercial", "industrial", "park", "school", "fire", "power", "water", "bulldoze"];
const seasons = ["春季", "初夏", "盛夏", "秋日"];

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
  advisorList: document.querySelector("#advisorList"),
  selectedTitle: document.querySelector("#selectedTitle"),
  selectedInfo: document.querySelector("#selectedInfo"),
  weeklyReport: document.querySelector("#weeklyReport"),
  pauseButton: document.querySelector("#pauseButton"),
  speedButton: document.querySelector("#speedButton"),
  calendar: document.querySelector("#calendar"),
  currentTool: document.querySelector("#currentTool"),
  hintText: document.querySelector("#hintText"),
  toolButtons: [...document.querySelectorAll("[data-tool]")],
};

const city = {
  tiles: Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, index) => ({
    x: index % GRID_SIZE,
    z: Math.floor(index / GRID_SIZE),
    type: "grass",
    buildingId: null,
    road: false,
    coverage: {},
    pollution: 0,
    mesh: null,
    marker: null,
  })),
  buildings: [],
  selectedTool: "road",
  selectedTile: null,
  week: 1,
  weekProgress: 0,
  paused: false,
  speed: 1,
  bankruptWeeks: 0,
  completed: false,
  stats: {
    money: INITIAL_MONEY,
    income: 0,
    maintenance: 0,
    population: 0,
    capacity: 0,
    jobs: 0,
    employmentRate: 0,
    happiness: 68,
    traffic: 100,
    power: 0,
    water: 0,
    education: 0,
    fire: 0,
    pollution: 0,
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
const buildingGroup = new THREE.Group();
const decoGroup = new THREE.Group();
world.add(tileGroup, buildingGroup, decoGroup);

const tileGeometry = new THREE.BoxGeometry(TILE_SIZE * 0.96, 0.12, TILE_SIZE * 0.96);
const grassMaterials = [
  new THREE.MeshStandardMaterial({ color: 0xbce98e, roughness: 0.85 }),
  new THREE.MeshStandardMaterial({ color: 0xcaf0a3, roughness: 0.85 }),
  new THREE.MeshStandardMaterial({ color: 0xb4e388, roughness: 0.85 }),
];
const roadMaterial = new THREE.MeshStandardMaterial({ color: 0xd9cda8, roughness: 0.9 });
const hoverMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.32 });
const invalidMaterial = new THREE.MeshBasicMaterial({ color: 0xff7b7b, transparent: true, opacity: 0.42 });

const hoverMesh = new THREE.Mesh(new THREE.BoxGeometry(TILE_SIZE, 0.16, TILE_SIZE), hoverMaterial);
hoverMesh.position.y = 0.12;
hoverMesh.visible = false;
scene.add(hoverMesh);

const cloudGroup = new THREE.Group();
scene.add(cloudGroup);

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
  decoGroup.add(trunk, crown);
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

  for (let i = 0; i < 36; i += 1) {
    const x = Math.floor(Math.random() * GRID_SIZE);
    const z = Math.floor(Math.random() * GRID_SIZE);
    if ((x > 6 && x < 12 && z > 6 && z < 12) || Math.random() < 0.35) continue;
    makeTree(x + Math.random() * 0.5 - 0.25, z + Math.random() * 0.5 - 0.25, Math.random() > 0.58);
  }
}

function buildingHeight(type) {
  return {
    residential: 0.9,
    commercial: 1.05,
    industrial: 1.15,
    park: 0.25,
    school: 1.0,
    fire: 1.0,
    power: 1.25,
    water: 1.45,
  }[type] || 0.8;
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
  const config = BUILDINGS[type];
  const group = new THREE.Group();
  const baseColor = config.color;

  if (type === "park") {
    const mat = new THREE.MeshStandardMaterial({ color: 0x91db7b, roughness: 0.85 });
    const mound = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 0.92, 0.22, 16), mat);
    mound.position.y = 0.18;
    group.add(mound);
    for (let i = 0; i < 4; i += 1) {
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.26, 8), new THREE.MeshStandardMaterial({ color: 0x9b7046 }));
      const crown = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), new THREE.MeshStandardMaterial({ color: i % 2 ? 0xffb4ca : 0x69bf68 }));
      trunk.position.y = 0.31;
      crown.position.y = 0.53;
      tree.position.set((i % 2 ? 0.28 : -0.28), 0, i < 2 ? 0.25 : -0.25);
      tree.add(trunk, crown);
      group.add(tree);
    }
    return group;
  }

  if (type === "water") {
    const tank = new THREE.Mesh(new THREE.SphereGeometry(0.46, 18, 12), new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.45 }));
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.1, 12), new THREE.MeshStandardMaterial({ color: 0x8db7cf }));
    tank.position.y = 1.15;
    stem.position.y = 0.58;
    group.add(stem, tank);
    return group;
  }

  if (type === "power") {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.48, 1.2, 12), new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.65 }));
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffd66d, emissiveIntensity: 0.35 }));
    body.position.y = 0.68;
    cap.position.y = 1.42;
    group.add(body, cap);
    return group;
  }

  const height = buildingHeight(type);
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.22, height, 1.16),
    new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.78 }),
  );
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

  return group;
}

function refreshTileMesh(tile) {
  tile.mesh.material = tile.road ? roadMaterial : grassMaterials[(tile.x + tile.z) % grassMaterials.length];
}

function getTile(x, z) {
  return inBounds(x, z) ? city.tiles[tileIndex(x, z)] : null;
}

function neighbors(tile) {
  return [
    getTile(tile.x + 1, tile.z),
    getTile(tile.x - 1, tile.z),
    getTile(tile.x, tile.z + 1),
    getTile(tile.x, tile.z - 1),
  ].filter(Boolean);
}

function hasAdjacentRoad(tile) {
  return neighbors(tile).some((item) => item.road);
}

function buildingById(id) {
  return city.buildings.find((building) => building.id === id);
}

function canBuild(type, tile) {
  if (!tile) return { ok: false, reason: "请选择地图格子。" };
  if (type === "bulldoze") return tile.road || tile.buildingId ? { ok: true } : { ok: false, reason: "这里没有可拆除的内容。" };
  if (tile.buildingId || tile.road) return { ok: false, reason: "这个格子已经被占用了。" };
  if (city.stats.money < BUILDINGS[type].cost) return { ok: false, reason: "资金不足，先等待税收或拆除低效建筑。" };
  if (type !== "road" && !hasAdjacentRoad(tile)) return { ok: false, reason: "建筑必须贴近道路才会运行。" };
  return { ok: true };
}

function addMessage(message) {
  city.messages.unshift(message);
  city.messages = city.messages.slice(0, 4);
  els.weeklyReport.textContent = city.messages[0];
}

function place(type, x, z) {
  const tile = getTile(x, z);
  const check = canBuild(type, tile);
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

  const config = BUILDINGS[type];
  city.stats.money -= config.cost;
  if (type === "road") {
    tile.road = true;
    tile.type = "road";
    refreshTileMesh(tile);
    addMessage("道路铺好了，新的街区可以开始规划。");
    renderUI();
    return true;
  }

  const mesh = createBuildingMesh(type);
  const { x: wx, z: wz } = gridToWorld(x, z);
  mesh.position.set(wx, 0.1, wz);
  mesh.userData.tile = tile;
  const building = {
    id: crypto.randomUUID(),
    type,
    x,
    z,
    age: 0,
    active: true,
    mesh,
  };
  tile.buildingId = building.id;
  tile.type = type;
  city.buildings.push(building);
  buildingGroup.add(mesh);
  addMessage(`${config.name}建好了。记得检查服务覆盖和预算。`);
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
      addMessage(`${config.name}已拆除，回收了一部分资金。`);
    }
  } else if (tile.road) {
    city.stats.money += Math.round(BUILDINGS.road.cost * 0.25);
    addMessage("道路已拆除。");
  }
  tile.buildingId = null;
  tile.road = false;
  tile.type = "grass";
  tile.coverage = {};
  tile.pollution = 0;
  refreshTileMesh(tile);
}

function clearCoverage() {
  city.tiles.forEach((tile) => {
    tile.coverage = {};
    tile.pollution = 0;
  });
}

function spreadCoverage() {
  clearCoverage();
  city.buildings.forEach((building) => {
    const config = BUILDINGS[building.type];
    if (config.service && config.radius) {
      city.tiles.forEach((tile) => {
        const reach = Math.max(0, config.radius - distance(building, tile));
        if (reach > 0) {
          tile.coverage[config.service] = Math.max(tile.coverage[config.service] || 0, reach / config.radius);
        }
      });
    }
    if (config.pollution) {
      city.tiles.forEach((tile) => {
        const reach = Math.max(0, 4 - distance(building, tile));
        tile.pollution += reach * config.pollution;
      });
    }
  });
}

function computeStats() {
  spreadCoverage();
  const buildings = city.buildings;
  const activeBuildings = buildings.filter((building) => hasAdjacentRoad(getTile(building.x, building.z)));
  const roads = city.tiles.filter((tile) => tile.road).length;
  const residential = activeBuildings.filter((building) => building.type === "residential");
  const commercial = activeBuildings.filter((building) => building.type === "commercial");
  const industrial = activeBuildings.filter((building) => building.type === "industrial");
  const service = activeBuildings.filter((building) => BUILDINGS[building.type].service);

  const capacity = residential.reduce((sum, building) => {
    const tile = getTile(building.x, building.z);
    const utilities = ((tile.coverage.power || 0) + (tile.coverage.water || 0)) / 2;
    return sum + Math.round(BUILDINGS.residential.capacity * (0.35 + utilities * 0.65));
  }, 0);
  const jobs = commercial.length * BUILDINGS.commercial.jobs + industrial.length * BUILDINGS.industrial.jobs;
  const utilityNeed = Math.max(1, buildings.filter((building) => building.type !== "park").length * 28 + residential.length * 10);
  const powerSupply = activeBuildings.filter((building) => building.type === "power").length * BUILDINGS.power.supply;
  const waterSupply = activeBuildings.filter((building) => building.type === "water").length * BUILDINGS.water.supply;
  const power = clamp((powerSupply / utilityNeed) * 100);
  const water = clamp((waterSupply / utilityNeed) * 100);
  const jobBalance = city.stats.population ? clamp((jobs / city.stats.population) * 100) : jobs ? 100 : 0;
  const traffic = clamp(105 - roads * 0.35 - industrial.length * 7 - commercial.length * 2 + Math.min(28, roads * 1.3));

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
  const pollution = residential.length
    ? residential.reduce((sum, building) => sum + getTile(building.x, building.z).pollution, 0) / residential.length
    : industrial.length * 4;
  const serviceBoost = park * 0.16 + education * 0.09 + fire * 0.07;
  const utilityPenalty = Math.max(0, 100 - power) * 0.09 + Math.max(0, 100 - water) * 0.09;
  const jobPenalty = city.stats.population > 0 ? Math.max(0, 76 - jobBalance) * 0.16 : 4;
  const trafficPenalty = Math.max(0, 72 - traffic) * 0.16;
  const pollutionPenalty = Math.min(24, pollution * 0.16);
  const happiness = clamp(72 + serviceBoost - utilityPenalty - jobPenalty - trafficPenalty - pollutionPenalty, 18, 100);

  const targetPopulation = Math.round(capacity * clamp((happiness - 28) / 58, 0.08, 1));
  const deltaPopulation = Math.sign(targetPopulation - city.stats.population) * Math.min(Math.abs(targetPopulation - city.stats.population), 26);
  city.stats.population = Math.max(0, city.stats.population + deltaPopulation);
  city.stats.capacity = capacity;
  city.stats.jobs = jobs;
  city.stats.employmentRate = city.stats.population ? clamp((jobs / city.stats.population) * 100) : 0;
  city.stats.happiness = happiness;
  city.stats.traffic = traffic;
  city.stats.power = power;
  city.stats.water = water;
  city.stats.education = education;
  city.stats.fire = fire;
  city.stats.pollution = pollution;

  const income =
    city.stats.population * BUILDINGS.residential.tax +
    commercial.length * BUILDINGS.commercial.tax * 8 +
    industrial.length * BUILDINGS.industrial.tax * 8;
  const maintenance = roads * BUILDINGS.road.maintenance + activeBuildings.reduce((sum, building) => sum + BUILDINGS[building.type].maintenance, 0);
  city.stats.income = Math.round(income);
  city.stats.maintenance = Math.round(maintenance);
  return { income, maintenance, serviceCount: service.length };
}

function advanceWeek(count = 1) {
  for (let i = 0; i < count; i += 1) {
    const { income, maintenance } = computeStats();
    city.stats.money += Math.round(income - maintenance);
    city.week += 1;
    city.bankruptWeeks = city.stats.money < -10000 ? city.bankruptWeeks + 1 : 0;

    if (!city.completed && city.stats.population >= 800 && city.stats.happiness >= 75 && city.stats.money > 0) {
      city.completed = true;
      addMessage("阳光小镇已成型！居民们在商店街举办了小小的庆祝会。");
    } else if (city.bankruptWeeks >= 6) {
      addMessage("财政连续赤字太久，小镇进入托管状态。拆除高维护设施或等待税收恢复。");
    } else {
      addMessage(`第 ${city.week} 周结算：收入 ${money(income)}，维护 ${money(maintenance)}。`);
    }
  }
  renderUI();
}

function advisorMessages() {
  const messages = [];
  if (city.stats.power < 80) messages.push({ title: "电力不足", text: "住宅和商店需要稳定供电。建一座电力设施并靠近道路。" });
  if (city.stats.water < 80) messages.push({ title: "供水不足", text: "水塔覆盖不足会限制人口成长。" });
  if (city.stats.employmentRate < 72 && city.stats.population > 80) messages.push({ title: "岗位不足", text: "增加商业或工业，让居民有地方工作。" });
  if (city.stats.traffic < 70) messages.push({ title: "交通变慢", text: "铺设更多道路分流，工业区不要挤在住宅旁。" });
  if (city.stats.pollution > 38) messages.push({ title: "污染偏高", text: "工业区离住宅太近了，可以用公园缓冲。" });
  if (city.stats.education < 35 && city.stats.population > 150) messages.push({ title: "教育覆盖低", text: "学校会让居民更安心，也能提升长期幸福度。" });
  if (messages.length === 0) messages.push({ title: "一切都很晴朗", text: "小镇运转顺利。继续扩大道路、住宅和服务覆盖吧。" });
  return messages.slice(0, 4);
}

function selectedDescription() {
  const tile = city.selectedTile;
  if (!tile) return { title: "未选择", text: "点击地图格子来建造、查看或拆除。" };
  if (tile.road) return { title: `道路 (${tile.x + 1}, ${tile.z + 1})`, text: "道路连接建筑，也会产生少量维护费。" };
  if (tile.buildingId) {
    const building = buildingById(tile.buildingId);
    const config = BUILDINGS[building.type];
    const active = hasAdjacentRoad(tile) ? "运行中" : "未连接道路";
    return { title: `${config.name} (${active})`, text: config.hint };
  }
  return { title: `草地 (${tile.x + 1}, ${tile.z + 1})`, text: "可以在这里规划新的道路或建筑。" };
}

function renderUI() {
  const stats = city.stats;
  els.money.textContent = money(stats.money);
  els.population.textContent = `${Math.round(stats.population)} / ${stats.capacity}`;
  els.happiness.textContent = `${Math.round(stats.happiness)}%`;
  els.employment.textContent = `${Math.round(stats.employmentRate)}%`;
  els.traffic.textContent = `${Math.round(stats.traffic)}%`;
  els.power.textContent = `${Math.round(stats.power)}%`;
  els.water.textContent = `${Math.round(stats.water)}%`;
  els.weekLabel.textContent = `第 ${city.week} 周`;
  els.calendar.textContent = `${seasons[Math.floor((city.week - 1) / 13) % seasons.length]} 第 ${city.week} 周`;
  els.cityMood.textContent = city.completed ? "庆祝达成" : stats.happiness > 78 ? "晴朗成长" : stats.happiness > 50 ? "稳步建设" : "需要关照";
  els.goalCard.classList.toggle("is-complete", city.completed);
  els.goalTitle.textContent = city.completed ? "阳光小镇已成型" : "目标：打造阳光小镇";
  els.goalText.textContent = city.completed
    ? "目标已达成，但你仍可以继续扩建，让晴日港变得更可爱。"
    : "人口达到 800、幸福度 75%、资金保持为正，即可完成第一阶段建设。";

  const selected = selectedDescription();
  els.selectedTitle.textContent = selected.title;
  els.selectedInfo.textContent = selected.text;
  els.currentTool.textContent = `当前：${BUILDINGS[city.selectedTool].name}`;
  els.hintText.textContent = BUILDINGS[city.selectedTool].hint;
  els.toolCost.textContent = city.selectedTool === "bulldoze" ? "拆除工具" : `${BUILDINGS[city.selectedTool].name} ${money(BUILDINGS[city.selectedTool].cost)}`;
  els.pauseButton.textContent = city.paused ? "继续" : "暂停";
  els.speedButton.textContent = `速度 x${city.speed}`;

  els.toolButtons.forEach((button) => {
    const tool = button.dataset.tool;
    button.classList.toggle("active", tool === city.selectedTool);
    button.disabled = tool !== "bulldoze" && city.stats.money < BUILDINGS[tool].cost;
  });

  const list = advisorMessages()
    .map((item, index) => `<li class="${index === 0 && item.title !== "一切都很晴朗" ? "is-warning" : ""}"><strong>${item.title}</strong><p>${item.text}</p></li>`)
    .join("");
  els.advisorList.innerHTML = list;
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

function pickTile(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(tileGroup.children, false);
  return hits[0]?.object.userData.tile || null;
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
  if (tile && !drag.moved) {
    place(city.selectedTool, tile.x, tile.z);
  }
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

els.toolButtons.forEach((button) => {
  button.addEventListener("click", () => setTool(button.dataset.tool));
});

els.pauseButton.addEventListener("click", () => {
  city.paused = !city.paused;
  renderUI();
});

els.speedButton.addEventListener("click", () => {
  city.speed = city.speed === 1 ? 2 : city.speed === 2 ? 4 : 1;
  renderUI();
});

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

function animateScene(elapsed) {
  camera.position.x += (cameraTarget.x + 29 - camera.position.x) * 0.08;
  camera.position.z += (cameraTarget.z + 34 - camera.position.z) * 0.08;
  camera.lookAt(cameraTarget.x, 0, cameraTarget.z);
  cloudGroup.children.forEach((cloud, index) => {
    cloud.position.x += 0.003 * (index + 1);
    if (cloud.position.x > 34) cloud.position.x = -34;
  });
  buildingGroup.children.forEach((mesh, index) => {
    mesh.position.y = 0.1 + Math.sin(elapsed * 1.4 + index) * 0.008;
  });
}

function seedTown() {
  for (let x = 5; x <= 12; x += 1) place("road", x, 9);
  place("road", 8, 8);
  place("road", 8, 10);
  place("residential", 7, 8);
  place("commercial", 9, 8);
  city.stats.money = INITIAL_MONEY - 80 * 10 - 900 - 1300;
  computeStats();
  addMessage("晴日港有了一条主街。接下来补上电力、水塔和更多住宅吧。");
}

function exposeTestApi() {
  if (!new URLSearchParams(window.location.search).has("test")) return;
  window.sunnyTownTest = {
    place,
    advanceWeek,
    getState: () => ({
      stats: { ...city.stats },
      week: city.week,
      selectedTool: city.selectedTool,
      buildingCount: city.buildings.length,
      roadCount: city.tiles.filter((tile) => tile.road).length,
      messages: [...city.messages],
    }),
    setMoney: (amount) => {
      city.stats.money = amount;
      renderUI();
    },
  };
}

window.addEventListener("resize", resize);
resize();
createTiles();
seedTown();
renderUI();
exposeTestApi();

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
  animateScene(elapsed);
  updateHover();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();
