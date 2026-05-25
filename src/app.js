import * as THREE from "../node_modules/three/build/three.module.js";

const GRID_SIZE = 18;
const TILE_SIZE = 2.4;
const WEEK_SECONDS = 4;
const INITIAL_MONEY = 50000;
const MAX_VISUAL_AGENTS = 60;

const ROAD_TIERS = {
  lane: { name: "普通道路", cost: 80, maintenance: 2, capacity: 16, color: 0xd9cda8, speed: 1 },
  avenue: { name: "樱花大道", cost: 260, maintenance: 5, capacity: 60, color: 0xf3c3d1, speed: 1.18, happiness: 1.5 },
};

const BUILDINGS = {
  road: { name: "道路", hint: "道路会自动连接。樱花大道容量更高，也更漂亮。" },
  residential: { name: "住宅", cost: 900, maintenance: 8, tax: 38, capacity: 38, color: 0xffb8c9, hint: "居民会从住宅出发，沿道路前往工作或消费地点。" },
  commercial: { name: "商业", cost: 1300, maintenance: 18, tax: 72, jobs: 42, color: 0xffd36f, hint: "商业提供岗位和税收，也会吸引居民消费。" },
  industrial: { name: "工业", cost: 1600, maintenance: 22, tax: 92, jobs: 64, pollution: 14, color: 0x9fc0cf, hint: "工业岗位多、税收高，但会制造污染和交通压力。" },
  park: { name: "公园", cost: 1100, maintenance: 18, service: "park", radius: 3, color: 0x8ddf91, hint: "公园会提升附近住宅幸福度。" },
  school: { name: "学校", cost: 2600, maintenance: 42, service: "education", radius: 4, color: 0xffc36e, hint: "学校提升教育覆盖和长期幸福度。" },
  fire: { name: "消防站", cost: 3200, maintenance: 50, service: "fire", radius: 5, color: 0xff8b7f, hint: "消防站降低城市风险，提高居民安心感。" },
  power: { name: "电力", cost: 3600, maintenance: 55, service: "power", radius: 6, supply: 320, color: 0xffe47a, hint: "电力设施为附近建筑供电。" },
  water: { name: "水塔", cost: 2800, maintenance: 45, service: "water", radius: 6, supply: 320, color: 0x84c9ff, hint: "水塔为附近建筑供水。" },
  bulldoze: { name: "拆除", cost: 0, hint: "拆除建筑会退回少量资金，道路也可以拆。" },
};

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
  advisorList: document.querySelector("#advisorList"),
  selectedTitle: document.querySelector("#selectedTitle"),
  selectedInfo: document.querySelector("#selectedInfo"),
  weeklyReport: document.querySelector("#weeklyReport"),
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
  return { residential: 0.9, commercial: 1.05, industrial: 1.15, park: 0.25, school: 1.0, fire: 1.0, power: 1.25, water: 1.45 }[type] || 0.8;
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
    const mound = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 0.92, 0.22, 16), new THREE.MeshStandardMaterial({ color: 0x91db7b, roughness: 0.85 }));
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
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.22, height, 1.16), new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.78 }));
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

function canBuild(type, tile) {
  if (!tile) return { ok: false, reason: "请选择地图格子。" };
  if (type === "bulldoze") return tile.road || tile.buildingId ? { ok: true } : { ok: false, reason: "这里没有可拆除的内容。" };
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
    city.stats.money -= ROAD_TIERS[tier].cost;
    tile.road = true;
    tile.roadTier = tier;
    tile.type = "road";
    invalidateRoadNetwork();
    addMessage(`${ROAD_TIERS[tier].name}铺好了，居民有了新的通勤路线。`);
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
  spawnBubble(`+${config.name}`, x, z, 0x5aa27d);
  addMessage(`${config.name}建好了。居民会根据道路可达性决定是否使用它。`);
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
    if (config.service && config.radius) {
      city.tiles.forEach((tile) => {
        const reach = Math.max(0, config.radius - distance(building, tile));
        if (reach > 0) tile.coverage[config.service] = Math.max(tile.coverage[config.service] || 0, reach / config.radius);
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
      id: crypto.randomUUID(),
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
  city.stats.traffic = clamp(100 - avg * 54);
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
    return sum + Math.round(BUILDINGS.residential.capacity * (0.35 + utilities * 0.65));
  }, 0);

  const utilityNeed = Math.max(1, activeBuildings.filter((building) => building.type !== "park").length * 28 + residential.length * 10);
  const powerSupply = activeBuildings.filter((building) => building.type === "power").length * BUILDINGS.power.supply;
  const waterSupply = activeBuildings.filter((building) => building.type === "water").length * BUILDINGS.water.supply;
  const power = clamp((powerSupply / utilityNeed) * 100);
  const water = clamp((waterSupply / utilityNeed) * 100);

  const baseHappiness = city.stats.happiness || 68;
  const targetPopulation = Math.round(capacity * clamp((baseHappiness - 22) / 68, 0.08, 1));
  const populationStep = Math.sign(targetPopulation - city.stats.population) * Math.min(Math.abs(targetPopulation - city.stats.population), 28);
  const nextPopulation = Math.max(0, city.stats.population + populationStep);
  syncResidents(nextPopulation, residential);

  const routeStats = assignResidentRoutes(residential, destinations);
  updateTrafficStats();

  const reachableJobs = Math.min(routeStats.reachableResidents, commercial.length * BUILDINGS.commercial.jobs + industrial.length * BUILDINGS.industrial.jobs);
  const jobs = commercial.length * BUILDINGS.commercial.jobs + industrial.length * BUILDINGS.industrial.jobs;
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
  const pollution = residential.length
    ? residential.reduce((sum, building) => sum + getTile(building.x, building.z).pollution, 0) / residential.length
    : industrial.length * 4;
  const avenueBoost = roads.filter((tile) => tile.roadTier === "avenue").length * ROAD_TIERS.avenue.happiness;
  const serviceBoost = park * 0.16 + education * 0.09 + fire * 0.07 + Math.min(8, avenueBoost);
  const utilityPenalty = Math.max(0, 100 - power) * 0.09 + Math.max(0, 100 - water) * 0.09;
  const jobPenalty = city.residents.length > 0 ? Math.max(0, 78 - employmentRate) * 0.2 : 4;
  const trafficPenalty = Math.max(0, 76 - city.stats.traffic) * 0.24 + routeStats.unreachableResidents * 0.45;
  const pollutionPenalty = Math.min(24, pollution * 0.16);
  const happiness = clamp(72 + serviceBoost - utilityPenalty - jobPenalty - trafficPenalty - pollutionPenalty, 18, 100);

  const incomeEfficiency = clamp(0.55 + city.stats.traffic / 180, 0.45, 1);
  const income =
    routeStats.reachableResidents * BUILDINGS.residential.tax +
    commercial.length * BUILDINGS.commercial.tax * 8 * incomeEfficiency +
    industrial.length * BUILDINGS.industrial.tax * 8 * incomeEfficiency;
  const roadMaintenance = roads.reduce((sum, tile) => sum + ROAD_TIERS[tile.roadTier].maintenance, 0);
  const maintenance = roadMaintenance + activeBuildings.reduce((sum, building) => sum + BUILDINGS[building.type].maintenance, 0);

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
  city.stats.pollution = pollution;
  city.stats.unreachableResidents = routeStats.unreachableResidents;
  city.stats.averageCommute = routeStats.averageCommute;
  city.stats.income = Math.round(income);
  city.stats.maintenance = Math.round(maintenance);
  return { income, maintenance };
}

function advanceWeek(count = 1) {
  for (let i = 0; i < count; i += 1) {
    const previousMoney = city.stats.money;
    const previousPopulation = city.stats.population;
    const { income, maintenance } = computeStats();
    city.stats.money += Math.round(income - maintenance);
    city.week += 1;
    city.bankruptWeeks = city.stats.money < -10000 ? city.bankruptWeeks + 1 : 0;
    if (city.stats.money > previousMoney) spawnBubble(`+${money(city.stats.money - previousMoney)}`, 9, 9, 0xffb85f);
    if (city.stats.population > previousPopulation) spawnBubble(`+${city.stats.population - previousPopulation} 人`, 8, 8, 0x5aa27d);

    if (!city.completed && city.stats.population >= 800 && city.stats.happiness >= 75 && city.stats.money > 0) {
      city.completed = true;
      addMessage("阳光小镇已成型！居民们沿着樱花大道举办了小小庆祝会。");
    } else if (city.bankruptWeeks >= 6) {
      addMessage("财政连续赤字太久，小镇进入托管状态。拆除高维护设施或等待税收恢复。");
    } else {
      addMessage(`第 ${city.week} 周结算：收入 ${money(income)}，维护 ${money(maintenance)}。`);
    }
  }
  refreshVisualAgents();
  renderUI();
}

function advisorMessages() {
  const messages = [];
  if (city.stats.unreachableResidents > 0) messages.push({ title: "有人到不了目的地", text: `${city.stats.unreachableResidents} 位居民找不到可达路线。检查住宅、商业和工业之间的道路连接。` });
  if (city.stats.traffic < 70) messages.push({ title: "道路开始拥堵", text: "通勤变慢了。可以铺设樱花大道或增加支路分流。" });
  if (city.stats.power < 80) messages.push({ title: "电力不足", text: "住宅和商店需要稳定供电。建一座电力设施并靠近道路。" });
  if (city.stats.water < 80) messages.push({ title: "供水不足", text: "水塔覆盖不足会限制人口成长。" });
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
    return { title: `${config.name} (${active})`, text: `${config.hint} 关联居民/通勤 ${residents.length}。` };
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
  els.cityMood.textContent = city.completed ? "庆祝达成" : stats.traffic < 65 ? "交通承压" : stats.happiness > 78 ? "晴朗成长" : stats.happiness > 50 ? "稳步建设" : "需要关照";
  els.goalCard.classList.toggle("is-complete", city.completed);
  els.goalTitle.textContent = city.completed ? "阳光小镇已成型" : "目标：打造阳光小镇";
  els.goalText.textContent = city.completed ? "目标已达成，但你仍可以继续扩建，让晴日港变得更可爱。" : "人口达到 800、幸福度 75%、资金保持为正，即可完成第一阶段建设。";
  els.trafficSummary.textContent = stats.traffic < 65 ? "通勤拥堵" : stats.unreachableResidents > 0 ? "道路断点" : "道路通畅";
  els.trafficDetails.textContent = `平均通勤 ${Math.round(stats.averageCommute || 0)} 格，平均拥堵 ${Math.round((stats.averageCongestion || 0) * 100)}%，移动体 ${city.visualAgents.length}/${MAX_VISUAL_AGENTS}。`;
  els.trafficSummary.closest(".traffic-card").classList.toggle("is-congested", stats.traffic < 70 || stats.unreachableResidents > 0);

  const selected = selectedDescription();
  els.selectedTitle.textContent = selected.title;
  els.selectedInfo.textContent = selected.text;
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
    button.classList.toggle("active", tool === city.selectedTool);
    button.disabled = tool !== "bulldoze" && city.stats.money < cost;
  });

  els.advisorList.innerHTML = advisorMessages()
    .map((item, index) => `<li class="${index === 0 && item.title !== "道路很顺畅" ? "is-warning" : ""}"><strong>${item.title}</strong><p>${item.text}</p></li>`)
    .join("");
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

function exposeTestApi() {
  if (!new URLSearchParams(window.location.search).has("test")) return;
  window.sunnyTownTest = {
    place,
    advanceWeek,
    findPathByRoads: (a, b) => findPath(getTile(a.x, a.z), getTile(b.x, b.z))?.map((tile) => ({ x: tile.x, z: tile.z })) || null,
    getState: () => ({
      stats: { ...city.stats },
      week: city.week,
      selectedTool: city.selectedTool,
      selectedRoadTier: city.selectedRoadTier,
      roadVersion: city.roadVersion,
      buildingCount: city.buildings.length,
      residentCount: city.residents.length,
      visualAgentCount: city.visualAgents.length,
      roadCount: city.tiles.filter((tile) => tile.road).length,
      roads: city.tiles
        .filter((tile) => tile.road)
        .map((tile) => ({ x: tile.x, z: tile.z, tier: tile.roadTier, mask: tile.roadMask, load: tile.trafficLoad, capacity: tile.trafficCapacity, congestion: tile.congestion })),
      residents: city.residents.map((resident) => ({ id: resident.id, routeLength: resident.route?.length || 0, commuteTime: resident.commuteTime, happiness: resident.happiness })),
      messages: [...city.messages],
      advisor: advisorMessages(),
    }),
    setMoney: (amount) => {
      city.stats.money = amount;
      renderUI();
    },
  };
}

window.addEventListener("resize", resize);
resize();
createPetals();
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
  animateScene(elapsed, delta);
  updateHover();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();
