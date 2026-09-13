import { createArtBatcher } from "./art-batch.js";

/**
 * A compact seaside diorama. Colours are baked into geometry, so a whole
 * building is one draw call. The host owns simulation and building transforms.
 */
export function createWorldArt({ THREE, scene, gridSize = 18, tileSize = 2.4 }) {
  const half = gridSize * tileSize / 2;
  const root = new THREE.Group();
  root.name = "sunny-harbor-world";
  scene.add(root);
  const geometries = new Set();
  const materials = new Set();
  const templates = new Map();
  const buildingRoots = new Set();
  const boats = [];
  let disposed = false;
  let elapsed = 0;
  let currentSeason = -1;
  let sceneryMeshCount = 0;

  const ownGeometry = (geometry) => {
    geometry.userData.artSharedResource = true;
    geometries.add(geometry);
    return geometry;
  };
  const ownMaterial = (material) => {
    material.userData.artSharedResource = true;
    materials.add(material);
    return material;
  };
  const palette = {
    cream: 0xfff0d8, wall: 0xffe4be, white: 0xfff8e9,
    coral: 0xdb795e, coralLight: 0xf0a180, teal: 0x428e8b,
    tealLight: 0x83b9b1, blue: 0x578897, roofDark: 0x386b72,
    ochre: 0xe3b75e, wood: 0xad7c54, deck: 0xe2b889,
    darkWood: 0x74574b, window: 0x355f70, windowLight: 0x9dcbc5,
    stone: 0x9ab4ac, paleStone: 0xdfd9bd, sand: 0xf1d8a6,
    grass: 0x9dbd92, leaf: 0x6eaa84, leafLight: 0x98c68f,
    blossom: 0xf2b5ac, shadow: 0x8caa8b, metal: 0x6b8c8c,
    water: 0x66bac4, shallow: 0x92d0c9, foam: 0xdeefdc,
  };
  const renderMaterials = {
    solid: ownMaterial(new THREE.MeshLambertMaterial({ vertexColors: true })),
    foliage: ownMaterial(new THREE.MeshLambertMaterial({ vertexColors: true })),
    water: ownMaterial(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })),
  };
  const primitives = {
    box: ownGeometry(new THREE.BoxGeometry(1, 1, 1)),
    sphere: ownGeometry(new THREE.IcosahedronGeometry(1, 0)),
    softSphere: ownGeometry(new THREE.SphereGeometry(1, 10, 6)),
    cylinder: ownGeometry(new THREE.CylinderGeometry(1, 1, 1, 10)),
    cone: ownGeometry(new THREE.ConeGeometry(1, 1, 10)),
    ring: ownGeometry(new THREE.TorusGeometry(1, 0.085, 4, 16)),
  };
  const gable = new THREE.BufferGeometry();
  gable.setAttribute("position", new THREE.Float32BufferAttribute([
    -1, 0, -1, 1, 0, -1, 0, 1, -1, -1, 0, 1, 1, 0, 1, 0, 1, 1,
  ], 3));
  gable.setIndex([0, 2, 1, 3, 4, 5, 0, 3, 5, 0, 5, 2, 2, 5, 4, 2, 4, 1, 0, 1, 4, 0, 4, 3]);
  primitives.gable = ownGeometry(gable.toNonIndexed());
  primitives.gable.computeVertexNormals();
  gable.dispose();
  const sail = new THREE.BufferGeometry();
  sail.setAttribute("position", new THREE.Float32BufferAttribute([
    0, 0, 0, 0, 1.5, 0, 0, 0, 1.1,
    0, 0, 0, 0, 0, 1.1, 0, 1.5, 0,
  ], 3));
  sail.computeVertexNormals();
  primitives.sail = ownGeometry(sail);
  const batcher = createArtBatcher({ THREE, primitives, palette, materials: renderMaterials, ownGeometry });
  const { batch } = batcher;

  function attach(parent, parts, name, castShadow = false) {
    const group = new THREE.Group();
    group.name = name;
    group.userData.worldArtDetail = true;
    parts.forEach(({ geometry, material }) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
    });
    parent.add(group);
    return group;
  }
  function randomGenerator(seed) {
    let value = seed >>> 0;
    return () => {
      value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }
  const random = randomGenerator(918274);
  function roundedIsland(side, radius, depth) {
    const edge = side / 2;
    const shape = new THREE.Shape();
    shape.moveTo(-edge + radius, -edge);
    shape.lineTo(edge - radius, -edge);
    shape.quadraticCurveTo(edge, -edge, edge, -edge + radius);
    shape.lineTo(edge, edge - radius);
    shape.quadraticCurveTo(edge, edge, edge - radius, edge);
    shape.lineTo(-edge + radius, edge);
    shape.quadraticCurveTo(-edge, edge, -edge, edge - radius);
    shape.lineTo(-edge, -edge + radius);
    shape.quadraticCurveTo(-edge, -edge, -edge + radius, -edge);
    const geometry = depth ? new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 4 }) : new THREE.ShapeGeometry(shape, 4);
    geometry.rotateX(-Math.PI / 2);
    return ownGeometry(geometry);
  }

  // Static vertex colours give the water depth without a screen-sized alpha
  // layer, a shader effect, or per-frame vertex uploads.
  const seaGeometry = ownGeometry(new THREE.PlaneGeometry(220, 220, 20, 20));
  seaGeometry.rotateX(-Math.PI / 2);
  const seaColors = [];
  const seaTint = new THREE.Color();
  const deep = new THREE.Color(0x54a9bf);
  const near = new THREE.Color(0x8acac5);
  const seaPositions = seaGeometry.attributes.position;
  for (let index = 0; index < seaPositions.count; index += 1) {
    const distance = Math.max(Math.abs(seaPositions.getX(index)), Math.abs(seaPositions.getZ(index)));
    seaTint.copy(near).lerp(deep, Math.min(1, Math.max(0, (distance - half) / 47)));
    seaColors.push(seaTint.r, seaTint.g, seaTint.b);
  }
  seaGeometry.setAttribute("color", new THREE.Float32BufferAttribute(seaColors, 3));
  const sea = new THREE.Mesh(seaGeometry, renderMaterials.water);
  sea.position.y = -1.2;
  root.add(sea);
  const coast = batch();
  const waterMarks = batch("water");
  [
    ["island-sand", half * 2 + 6.7, 4.7, 0.35, -1.05, "sand", "solid"],
    ["island-cliff", half * 2 + 2.8, 2.4, 0.48, -0.74, "stone", "solid"],
    ["island-meadow", half * 2 + 1.25, 1.8, 0.16, -0.27, "grass", "foliage"],
    ["island-lagoon", half * 2 + 14.0, 8.5, 0, -1.16, "shallow", "water"],
  ].forEach(([key, side, radius, depth, y, tint, mode]) => {
    primitives[key] = roundedIsland(side, radius, depth);
    (mode === "water" ? waterMarks : coast).add(key, tint, [0, y, 0], [1, 1, 1], [0, 0, 0], mode);
  });

  // Long readable coastline shapes replace dozens of thin repeated joints.
  const shoreZ = half + 1.62;
  coast.add("box", "darkWood", [1.1, -0.34, shoreZ], [21.8, 0.22, 1.75]);
  coast.add("box", "deck", [1.1, -0.18, shoreZ], [21.6, 0.12, 1.65]);
  for (let index = 0; index < 15; index += 1) {
    const x = -9.3 + index * 1.48;
    coast.add("box", "wood", [x, -0.105, shoreZ], [0.035, 0.018, 1.61]);
    if (index % 2 === 0) coast.add("box", "cream", [x, 0.15, shoreZ + 0.71], [0.09, 0.63, 0.09]);
  }
  coast.add("box", "cream", [1.05, 0.43, shoreZ + 0.71], [20.8, 0.07, 0.08]);
  for (const x of [-5, 1, 7]) {
    coast.add("box", "teal", [x, 0.12, shoreZ - 0.15], [1.25, 0.12, 0.42]);
    coast.add("box", "teal", [x, 0.36, shoreZ - 0.34], [1.25, 0.32, 0.09]);
    for (const dx of [-0.44, 0.44]) coast.add("box", "darkWood", [x + dx, -0.025, shoreZ - 0.14], [0.07, 0.28, 0.28]);
  }
  const pierX = half + 2.15;
  coast.add("box", "wood", [pierX, -0.54, 7.8], [5.0, 0.2, 2.15]);
  coast.add("box", "deck", [pierX, -0.39, 7.8], [4.85, 0.12, 2.02]);
  for (const x of [half + 0.2, half + 4.15]) for (const z of [6.83, 8.77]) {
    coast.add("cylinder", "darkWood", [x, -0.5, z], [0.11, 1.2, 0.11]);
    coast.add("cylinder", "cream", [x, 0.13, z], [0.15, 0.08, 0.15]);
  }
  for (const [x, z, angle] of [[half + 4.5, -10, 0.5], [-half - 5.1, 2, -0.7], [-14, half + 4.5, 0], [8, half + 5.4, 0]]) {
    waterMarks.add("box", "foam", [x, -1.115, z], [3.2, 0.013, 0.07], [0, angle, 0]);
    waterMarks.add("box", "foam", [x + 0.8, -1.112, z + 0.45], [1.1, 0.013, 0.055], [0, angle, 0]);
  }
  for (let index = 0; index < 18; index += 1) {
    const x = (random() - 0.5) * 105;
    const z = (random() - 0.5) * 90;
    if (Math.abs(x) < half + 6 && Math.abs(z) < half + 6) continue;
    waterMarks.add("box", "shallow", [x, -1.12, z], [1.5 + random() * 2, 0.012, 0.07]);
  }

  const foliage = batch("foliage");
  function tree(x, z, height, flowering = false) {
    coast.add("cylinder", "wood", [x, height * 0.24, z], [0.09, height * 0.5, 0.09]);
    foliage.add("sphere", flowering ? "blossom" : "leaf", [x, height * 0.65, z], [height * 0.38, height * 0.4, height * 0.34]);
    foliage.add("sphere", flowering ? "blossom" : "leafLight", [x - height * 0.17, height * 0.79, z + height * 0.1], [height * 0.24, height * 0.26, height * 0.24]);
  }
  for (let index = 0; index < 15; index += 1) {
    const along = -half + 3 + index * (half * 2 - 6) / 14;
    tree(along, -half - 0.15, 1.35 + random() * 0.8, index % 4 === 1);
    if (index % 2 === 0) tree(-half - 0.17, along, 1.25 + random() * 0.7, index % 4 === 0);
  }
  for (const [x, z, size] of [[-half - 5.5, -5, 2.2], [half + 6, -15, 2.9]]) {
    coast.add("sphere", "sand", [x, -1.05, z], [size, 0.55, size * 0.75]);
    foliage.add("sphere", "grass", [x, -0.66, z], [size * 0.72, 0.36, size * 0.57]);
    tree(x, z, 1.9);
  }
  // A single bold landmark on the near waterfront is visible from the town.
  const lighthouseX = -half + 1.8;
  const lighthouseZ = half + 2.8;
  coast.add("cylinder", "paleStone", [lighthouseX, -0.49, lighthouseZ], [1.4, 0.85, 1.4]);
  coast.add("cylinder", "cream", [lighthouseX, 1.52, lighthouseZ], [0.67, 3.3, 0.67]);
  coast.add("cylinder", "coral", [lighthouseX, 1.32, lighthouseZ], [0.683, 0.57, 0.683]);
  coast.add("cylinder", "coral", [lighthouseX, 2.55, lighthouseZ], [0.683, 0.57, 0.683]);
  coast.add("cylinder", "cream", [lighthouseX, 3.22, lighthouseZ], [0.88, 0.16, 0.88]);
  coast.add("cylinder", "window", [lighthouseX, 3.61, lighthouseZ], [0.48, 0.66, 0.48]);
  coast.add("cone", "teal", [lighthouseX, 4.1, lighthouseZ], [0.84, 0.5, 0.84]);
  for (const dx of [-0.41, 0.41]) coast.add("box", "cream", [lighthouseX + dx, 3.63, lighthouseZ + 0.26], [0.055, 0.7, 0.055]);
  coast.add("box", "darkWood", [lighthouseX, 0.42, lighthouseZ + 0.67], [0.35, 0.73, 0.04]);
  attach(root, coast.finish(), "island-and-waterfront", true);
  attach(root, foliage.finish(), "coastal-groves");
  attach(root, waterMarks.finish(), "lagoon-and-wave-lines");

  function makeBoat(x, z, angle, sailing) {
    const boat = batch();
    boat.add("softSphere", sailing ? "cream" : "coral", [0, 0, 0], [0.62, 0.28, 1.35]);
    boat.add("box", "wood", [0, 0.15, 0], [0.75, 0.08, 1.7]);
    if (sailing) {
      boat.add("cylinder", "darkWood", [0, 1.08, -0.28], [0.035, 1.9, 0.035]);
      boat.add("sail", "white", [0, 0.31, -0.23], [1, 1, 1]);
      boat.add("sail", "ochre", [0, 0.31, -0.33], [1, 0.72, -0.67]);
    } else {
      boat.add("box", "cream", [0, 0.52, -0.27], [0.68, 0.62, 0.77]);
      boat.add("box", "teal", [0, 0.87, -0.27], [0.84, 0.13, 0.91]);
      boat.add("box", "window", [0, 0.58, 0.12], [0.5, 0.28, 0.025]);
    }
    const group = attach(root, boat.finish(), sailing ? "harbor-sailboat" : "harbor-fishing-boat");
    group.position.set(x, -1.0, z);
    group.rotation.y = angle;
    boats.push({ group, seed: boats.length * 2.5 });
  }
  makeBoat(half + 5.6, 8, 0.3, false);
  makeBoat(-7, half + 8, 0.95, true);

  // Five connected meadow shapes soften the large lawn. Each polygon is
  // clipped to buildable cells and all fragments share one mesh. Occupied
  // fragments move beneath the lawn using the existing position buffer.
  const meadowSpecs = [
    [4.1, 5.2, 3.1, 2.2, -0.3, 0xadcba0],
    [11.8, 4.5, 3.1, 1.9, 0.4, 0x8fb88a],
    [4.0, 11.6, 2.6, 2.2, 0.25, 0x91b58a],
    [11.2, 12.0, 3.5, 2.0, -0.4, 0xadcba0],
    [14.3, 8.4, 2.2, 1.5, 0.45, 0xa2c598],
  ];
  const meadowTileRanges = Array.from({ length: gridSize * gridSize }, () => []);
  const meadowCoordinates = [];
  const meadowColors = [];
  const meadowBaseColor = new THREE.Color(0x9bbd94);
  const meadowColor = new THREE.Color();
  const meadowOffset = (gridSize - 1) * tileSize / 2;
  const meadowY = 0.07;
  function clipPolygon(points, axis, bound, keepGreater) {
    const output = [];
    for (let index = 0; index < points.length; index += 1) {
      const from = points[index];
      const to = points[(index + 1) % points.length];
      const fromInside = keepGreater ? from[axis] >= bound : from[axis] <= bound;
      const toInside = keepGreater ? to[axis] >= bound : to[axis] <= bound;
      if (fromInside) output.push(from);
      if (fromInside !== toInside) {
        const factor = (bound - from[axis]) / (to[axis] - from[axis]);
        output.push([from[0] + (to[0] - from[0]) * factor, from[1] + (to[1] - from[1]) * factor]);
      }
    }
    return output;
  }
  meadowSpecs.forEach(([gridX, gridZ, radiusX, radiusZ, angle, color]) => {
    const cx = gridX * tileSize - meadowOffset;
    const cz = gridZ * tileSize - meadowOffset;
    const rx = radiusX * tileSize;
    const rz = radiusZ * tileSize;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const polygon = Array.from({ length: 12 }, (_, index) => {
      const phase = index / 12 * Math.PI * 2;
      const px = Math.cos(phase) * rx;
      const pz = Math.sin(phase) * rz;
      return [cx + px * cosine - pz * sine, cz + px * sine + pz * cosine];
    });
    const centerColor = new THREE.Color(color);
    const vertex = ([x, z]) => {
      const dx = x - cx;
      const dz = z - cz;
      const radius = Math.hypot((dx * cosine + dz * sine) / rx, (-dx * sine + dz * cosine) / rz);
      meadowColor.copy(centerColor).lerp(meadowBaseColor, Math.min(1, Math.max(0, (radius - 0.4) / 0.6)));
      meadowCoordinates.push(x, meadowY, z);
      meadowColors.push(meadowColor.r, meadowColor.g, meadowColor.b);
    };
    for (let z = 0; z < gridSize; z += 1) for (let x = 0; x < gridSize; x += 1) {
      const wx = x * tileSize - meadowOffset;
      const wz = z * tileSize - meadowOffset;
      let clipped = clipPolygon(polygon, 0, wx - tileSize / 2, true);
      clipped = clipPolygon(clipped, 0, wx + tileSize / 2, false);
      clipped = clipPolygon(clipped, 1, wz - tileSize / 2, true);
      clipped = clipPolygon(clipped, 1, wz + tileSize / 2, false);
      if (clipped.length < 3) continue;
      const start = meadowCoordinates.length / 3;
      // Reverse the XZ polygon's winding to face upward.
      for (let index = 1; index < clipped.length - 1; index += 1) {
        vertex(clipped[0]);
        vertex(clipped[index + 1]);
        vertex(clipped[index]);
      }
      meadowTileRanges[z * gridSize + x].push([start, meadowCoordinates.length / 3]);
    }
  });
  const meadowGeometry = ownGeometry(new THREE.BufferGeometry());
  const meadowPositions = new THREE.Float32BufferAttribute(meadowCoordinates, 3);
  meadowPositions.setUsage(THREE.DynamicDrawUsage);
  meadowGeometry.setAttribute("position", meadowPositions);
  meadowGeometry.setAttribute("color", new THREE.Float32BufferAttribute(meadowColors, 3));
  meadowGeometry.computeVertexNormals();
  meadowGeometry.computeBoundingSphere();
  const meadowMaterial = ownMaterial(new THREE.MeshLambertMaterial({ vertexColors: true }));
  const meadow = new THREE.Mesh(meadowGeometry, meadowMaterial);
  meadow.name = "empty-lot-meadows";
  meadow.receiveShadow = true;
  root.add(meadow);

  // Empty-lot groves use only two draw calls, with fixed allocations. Building
  // on a site changes its matrices; no per-tree geometry is created or removed.
  const vegetationRandom = randomGenerator(432217);
  const centers = [{ x: 2, z: 3 }, { x: gridSize - 4, z: 2 }, { x: 3, z: gridSize - 4 }, { x: gridSize - 3, z: gridSize - 3 }];
  const nearTown = new Set([[4, 7], [5, 5], [10, 4], [11, 5], [13, 7], [13, 10], [12, 12], [10, 13], [7, 13], [5, 11], [4, 10], [11, 11], [6, 5], [6, 12], [11, 7]].map(([x, z]) => `${x},${z}`));
  const vegetationSites = [];
  for (let z = 1; z < gridSize - 1; z += 1) for (let x = 1; x < gridSize - 1; x += 1) {
    const nearSettlement = nearTown.has(`${x},${z}`);
    if (x >= 5 && x <= 12 && z >= 5 && z <= 12 && !nearSettlement) continue;
    const nearGrove = Math.min(...centers.map((center) => Math.abs(center.x - x) + Math.abs(center.z - z)));
    vegetationSites.push({ x, z, tileIndex: z * gridSize + x, nearSettlement, order: (nearSettlement ? -10 : nearGrove) + vegetationRandom() * 3 });
  }
  vegetationSites.sort((a, b) => a.order - b.order);
  vegetationSites.length = Math.min(36, vegetationSites.length);
  const trunkMaterial = ownMaterial(new THREE.MeshLambertMaterial({ color: palette.wood }));
  const crownMaterial = ownMaterial(new THREE.MeshLambertMaterial({ color: 0xffffff }));
  const trunks = new THREE.InstancedMesh(primitives.cylinder, trunkMaterial, vegetationSites.length);
  const crowns = new THREE.InstancedMesh(primitives.sphere, crownMaterial, vegetationSites.length);
  const vegetationMeshes = [trunks, crowns];
  const transform = new THREE.Object3D();
  const tint = new THREE.Color();
  const offset = (gridSize - 1) * tileSize / 2;
  let occupiedSignature = "";
  vegetationSites.forEach((site) => {
    site.height = (site.nearSettlement ? 0.85 : 1.0) + vegetationRandom() * 0.5;
    site.worldX = site.x * tileSize - offset + (vegetationRandom() - 0.5) * 0.35;
    site.worldZ = site.z * tileSize - offset + (vegetationRandom() - 0.5) * 0.35;
    site.flowering = vegetationRandom() < 0.22;
  });
  vegetationMeshes.forEach((mesh, index) => {
    mesh.name = index ? "lot-tree-crowns" : "lot-tree-trunks";
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.receiveShadow = true;
    root.add(mesh);
  });
  function setOccupied(tiles = []) {
    if (disposed) return;
    const signature = Array.from({ length: gridSize * gridSize }, (_, index) => {
      const tile = tiles[index];
      return tile?.road || tile?.buildingId ? "1" : "0";
    }).join("");
    if (signature === occupiedSignature) return;
    transform.rotation.set(0, 0, 0);
    vegetationSites.forEach((site, index) => {
      if (signature[site.tileIndex] === occupiedSignature[site.tileIndex]) return;
      const visible = signature[site.tileIndex] === "0" ? 1 : 0;
      transform.position.set(site.worldX, 0.08 + site.height * 0.23, site.worldZ);
      transform.scale.set(0.07 * visible, site.height * 0.49 * visible, 0.07 * visible);
      transform.updateMatrix();
      trunks.setMatrixAt(index, transform.matrix);
      transform.position.y = 0.08 + site.height * 0.66;
      transform.scale.set(site.height * 0.41 * visible, site.height * 0.45 * visible, site.height * 0.38 * visible);
      transform.updateMatrix();
      crowns.setMatrixAt(index, transform.matrix);
    });
    let meadowChanged = false;
    meadowTileRanges.forEach((ranges, tileIndex) => {
      if (signature[tileIndex] === occupiedSignature[tileIndex]) return;
      for (const [start, end] of ranges) {
        for (let vertex = start; vertex < end; vertex += 1) meadowPositions.setY(vertex, signature[tileIndex] === "0" ? meadowY : -0.4);
        meadowChanged = true;
      }
    });
    if (meadowChanged) meadowPositions.needsUpdate = true;
    vegetationMeshes.forEach((mesh) => { mesh.instanceMatrix.needsUpdate = true; });
    occupiedSignature = signature;
  }
  setOccupied();
  vegetationMeshes.forEach((mesh) => mesh.computeBoundingSphere());

  const birdGeometry = ownGeometry(new THREE.BufferGeometry());
  birdGeometry.setAttribute("position", new THREE.Float32BufferAttribute([
    0, 0, 0, -0.43, 0.06, 0.09, -0.18, 0, 0.19,
    0, 0, 0, 0.18, 0, 0.19, 0.43, 0.06, 0.09,
  ], 3));
  const birds = new THREE.InstancedMesh(birdGeometry, ownMaterial(new THREE.MeshBasicMaterial({ color: 0xfff6e4, side: THREE.DoubleSide })), 5);
  birds.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  birds.frustumCulled = false;
  root.add(birds);

  const buildingTypes = new Set(["residential", "commercial", "industrial", "park", "school", "fire", "power", "water", "plaza", "station", "lantern"]);
  function buildingTemplate(type, variant, level) {
    const key = `${type}:${variant}:${level}`;
    if (templates.has(key)) return templates.get(key);
    const art = batch();
    const box = (color, at, size, angles) => art.add("box", color, at, size, angles);
    const roofColor = type === "fire" ? "coral" : type === "industrial" ? "blue" : ["coral", "teal", "ochre"][variant];
    const wallColor = ["cream", "wall", "white"][variant];
    const height = 1.03 + (level - 1) * 0.28;
    // Broad ground contact and large openings read clearly at town scale.
    box("shadow", [0.025, 0.018, 0.025], [1.87, 0.075, 1.86]);
    box("paleStone", [0, 0.055, 0], [1.83, 0.08, 1.79]);
    const window = (x, y, z, width = 0.31, side = false) => {
      box("white", [x, y, z], side ? [0.045, 0.43, width + 0.08] : [width + 0.08, 0.43, 0.045]);
      box("window", [x + (side ? 0.03 : 0), y, z + (side ? 0 : 0.03)], side ? [0.026, 0.34, width] : [width, 0.34, 0.026]);
      box("windowLight", [x + (side ? 0.045 : 0), y - 0.09, z + (side ? 0 : 0.045)], side ? [0.014, 0.035, width] : [width, 0.035, 0.014]);
    };
    const plant = (x, z, flowering = false) => {
      art.add("cylinder", "coral", [x, 0.16, z], [0.12, 0.18, 0.12]);
      art.add("sphere", flowering ? "blossom" : "leaf", [x, 0.34, z], [0.2, 0.2, 0.18]);
    };
    if (["residential", "commercial", "school", "fire"].includes(type)) {
      const depth = type === "commercial" ? 1.4 : 1.34;
      box(wallColor, [0, height / 2 + 0.13, 0], [1.4, height, depth]);
      box("white", [0, height + 0.13, 0], [1.55, 0.11, depth + 0.13]);
      art.add("gable", roofColor, [0, height + 0.17, 0], [0.84, 0.48, depth / 2 + 0.13]);
      box("darkWood", [0, 0.43, depth / 2 + 0.025], [0.28, 0.63, 0.055]);
      box("sand", [0, 0.13, depth / 2 + 0.12], [0.53, 0.12, 0.25]);
      const windowY = height > 1.3 ? 0.86 : 0.67;
      window(-0.43, windowY, depth / 2 + 0.027, 0.29);
      window(0.43, windowY, depth / 2 + 0.027, 0.29);
      window(0.715, windowY, -0.3, 0.34, true);
      window(0.715, windowY, 0.29, 0.34, true);
      if (level >= 2) {
        box(wallColor, [0.22, height + 0.41, 0.18], [0.5, 0.4, 0.45]);
        art.add("gable", roofColor, [0.22, height + 0.61, 0.18], [0.32, 0.2, 0.3]);
        window(0.22, height + 0.41, 0.414, 0.23);
      }
      if (level === 3) {
        box("white", [0, 0.81, depth / 2 + 0.1], [1.41, 0.065, 0.13]);
        window(-0.43, 0.44, depth / 2 + 0.027, 0.27);
        window(0.43, 0.44, depth / 2 + 0.027, 0.27);
      }
      if (type === "residential") {
        box("coral", [-0.44, height + 0.59, -0.39], [0.19, 0.48, 0.22]);
        box("cream", [-0.44, height + 0.85, -0.39], [0.26, 0.07, 0.28]);
        box("leaf", [-0.76, 0.24, -0.23], [0.19, 0.32, 1.0]);
        plant(0.74, 0.71, true);
      } else if (type === "commercial") {
        for (let stripe = 0; stripe < 5; stripe += 1) box(stripe % 2 ? "white" : roofColor, [-0.6 + stripe * 0.3, 0.94, 0.8], [0.3, 0.08, 0.3], [-0.17, 0, 0]);
        box("window", [-0.41, 0.45, 0.721], [0.45, 0.44, 0.027]);
        box("window", [0.41, 0.45, 0.721], [0.45, 0.44, 0.027]);
        box("wood", [0.78, 0.67, 0.62], [0.065, 0.96, 0.065]);
        box("ochre", [0.8, 1.02, 0.69], [0.33, 0.27, 0.07]);
      } else if (type === "school") {
        box("white", [0, height + 0.59, 0.52], [0.4, 0.45, 0.25]);
        art.add("cylinder", "ochre", [0, height + 0.63, 0.661], [0.135, 0.035, 0.135], [Math.PI / 2, 0, 0]);
        box("window", [0, height + 0.66, 0.685], [0.025, 0.13, 0.015]);
        box("window", [0.035, height + 0.61, 0.685], [0.08, 0.025, 0.015]);
        plant(-0.77, 0.7);
      } else {
        box("coral", [0, 0.47, 0.7], [0.8, 0.68, 0.07]);
        box("window", [0, 0.6, 0.744], [0.65, 0.2, 0.023]);
        box("white", [0, 1.07, 0.707], [0.45, 0.18, 0.07]);
        box("coral", [0, 1.07, 0.75], [0.07, 0.13, 0.023]);
        box("coral", [0, 1.07, 0.75], [0.21, 0.055, 0.023]);
      }
    } else if (type === "industrial") {
      box("cream", [0, height / 2 + 0.13, 0], [1.5, height, 1.42]);
      for (const x of [-0.38, 0.38]) art.add("gable", "blue", [x, height + 0.13, 0], [0.44, 0.34, 0.82]);
      box("teal", [0, 0.52, 0.733], [0.75, 0.77, 0.05]);
      box("windowLight", [0, 0.71, 0.765], [0.62, 0.2, 0.02]);
      window(0.768, 0.72, -0.3, 0.35, true);
      window(0.768, 0.72, 0.3, 0.35, true);
      art.add("cylinder", "coral", [-0.51, height + 0.16, -0.51], [0.15, 1.04, 0.15]);
      art.add("cylinder", "cream", [-0.51, height + 0.72, -0.51], [0.2, 0.09, 0.2]);
      box("wood", [0.7, 0.25, 0.73], [0.28, 0.31, 0.27]);
    } else if (type === "park") {
      art.add("cylinder", "grass", [0, 0.13, 0], [0.9, 0.13, 0.9]);
      for (const [x, z, h, flowering] of [[-0.4, -0.31, 1.1, true], [0.44, -0.14, 0.85, false]]) {
        art.add("cylinder", "wood", [x, h * 0.32, z], [0.07, h * 0.55, 0.07]);
        art.add("sphere", flowering ? "blossom" : "leaf", [x, h * 0.77, z], [0.43, h * 0.4, 0.4]);
      }
      box("deck", [0, 0.34, 0.6], [0.8, 0.08, 0.24]);
      box("teal", [0, 0.51, 0.72], [0.8, 0.26, 0.06]);
      for (const x of [-0.29, 0.29]) box("darkWood", [x, 0.21, 0.6], [0.07, 0.26, 0.2]);
    } else if (type === "water") {
      for (const x of [-0.36, 0.36]) for (const z of [-0.32, 0.32]) box("cream", [x, 0.64, z], [0.11, 1.13, 0.11]);
      art.add("cylinder", "tealLight", [0, 1.22, 0], [0.53, 0.64, 0.53]);
      art.add("cylinder", "white", [0, 0.93, 0], [0.57, 0.12, 0.57]);
      art.add("cone", "teal", [0, 1.66, 0], [0.63, 0.35, 0.63]);
      box("cream", [-0.58, 0.71, 0], [0.06, 1.4, 0.26]);
      for (let index = 0; index < 5; index += 1) box("teal", [-0.62, 0.22 + index * 0.23, 0], [0.02, 0.06, 0.26]);
    } else if (type === "power") {
      box("cream", [0, 0.54, -0.17], [0.94, 0.9, 0.92]);
      art.add("gable", "teal", [0, 0.99, -0.17], [0.56, 0.29, 0.54]);
      box("ochre", [0, 0.6, 0.308], [0.44, 0.49, 0.055]);
      box("white", [0.02, 0.6, 0.343], [0.09, 0.34, 0.02], [0, 0, -0.32]);
      for (const x of [-0.55, 0.55]) {
        box("metal", [x, 0.26, 0.52], [0.06, 0.35, 0.06]);
        box("roofDark", [x, 0.47, 0.48], [0.58, 0.055, 0.63], [0.24, 0, 0]);
        box("tealLight", [x, 0.507, 0.48], [0.028, 0.02, 0.59], [0.24, 0, 0]);
      }
    } else if (type === "plaza") {
      art.add("cylinder", "cream", [0, 0.21, 0], [0.75, 0.21, 0.75]);
      art.add("cylinder", "water", [0, 0.328, 0], [0.63, 0.04, 0.63]);
      art.add("cylinder", "white", [0, 0.5, 0], [0.13, 0.37, 0.13]);
      art.add("cylinder", "cream", [0, 0.68, 0], [0.32, 0.09, 0.32]);
      art.add("softSphere", "shallow", [0, 0.8, 0], [0.14, 0.19, 0.14]);
      plant(-0.7, -0.7, true);
      plant(0.7, 0.7, true);
    } else if (type === "station") {
      box("cream", [0, 0.2, 0], [1.7, 0.18, 1.2]);
      for (const x of [-0.65, 0.65]) box("cream", [x, 0.72, 0], [0.12, 1.05, 0.12]);
      art.add("gable", "teal", [0, 1.22, 0], [0.94, 0.34, 0.63]);
      box("deck", [-0.22, 0.48, -0.23], [0.87, 0.1, 0.26]);
      box("teal", [0, 0.95, 0.39], [0.62, 0.25, 0.065]);
      box("cream", [0, 0.95, 0.43], [0.39, 0.055, 0.02]);
      for (const z of [-0.65, -0.81]) box("metal", [0, 0.15, z], [1.75, 0.035, 0.045]);
    } else if (type === "lantern") {
      for (const x of [-0.53, 0.53]) box("darkWood", [x, 0.73, 0], [0.095, 1.3, 0.095]);
      box("darkWood", [0, 1.35, 0], [1.4, 0.1, 0.12]);
      art.add("gable", "coral", [0, 1.41, 0], [0.81, 0.25, 0.25]);
      for (const x of [-0.37, 0.37]) {
        art.add("softSphere", x < 0 ? "ochre" : "coralLight", [x, 0.94, 0], [0.23, 0.32, 0.22]);
        box("cream", [x, 0.94, 0.215], [0.045, 0.38, 0.025]);
      }
      plant(0.72, 0.64, true);
    }
    const template = { key, refs: 0, parts: art.finish() };
    templates.set(key, template);
    return template;
  }

  function dropTemplate(template) {
    template.refs -= 1;
    if (template.refs > 0) return;
    template.parts.forEach(({ geometry }) => {
      geometry.dispose();
      geometries.delete(geometry);
    });
    templates.delete(template.key);
  }
  function decorateBuilding(group, type, x = 0, z = 0, level = 1) {
    if (disposed || !group || !buildingTypes.has(type)) return;
    const variant = Math.abs(Math.imul(x + 13, 17) + Math.imul(z + 7, 31)) % 3;
    const safeLevel = Math.max(1, Math.min(3, Math.trunc(level) || 1));
    const key = `${type}:${variant}:${safeLevel}`;
    let details = group.userData.worldArt;
    if (!details) {
      details = { root: null, template: null, hidden: new Map() };
      group.userData.worldArt = details;
      group.userData.worldArtBuilding = true;
      buildingRoots.add(group);
    }
    // Also catches host upgrade decorations added after the first call. These
    // remain host-owned and are restored before its normal disposer traverses.
    group.children.forEach((child) => {
      if (child === details.root) return;
      if (!details.hidden.has(child)) details.hidden.set(child, child.visible);
      child.visible = false;
    });
    if (details.template?.key !== key) {
      const next = buildingTemplate(type, variant, safeLevel);
      next.refs += 1;
      if (details.root) group.remove(details.root);
      if (details.template) dropTemplate(details.template);
      details.root = attach(group, next.parts, `architecture-${type}`, true);
      details.root.matrixAutoUpdate = false;
      details.template = next;
    }
    details.root.userData.level = safeLevel;
    details.type = type;
    details.variant = variant;
  }
  function releaseBuilding(group) {
    const details = group?.userData.worldArt;
    if (!details) return;
    group.remove(details.root);
    details.hidden.forEach((visible, child) => { child.visible = visible; });
    dropTemplate(details.template);
    delete group.userData.worldArt;
    delete group.userData.worldArtBuilding;
    buildingRoots.delete(group);
  }
  function update(delta, context = {}) {
    if (disposed) return;
    elapsed += Math.max(0, Math.min(Number.isFinite(delta) ? delta : 0, 0.1));
    const season = Number.isInteger(context.season) ? ((context.season % 4) + 4) % 4 : Math.floor((Math.max(1, context.week || 1) - 1) / 12) % 4;
    if (season !== currentSeason) {
      // White spring/summer illumination; autumn warms foliage, winter cools it.
      renderMaterials.foliage.color.setHex([0xffffff, 0xeaf4e0, 0xe7c28d, 0xdbe9e4][season]);
      const leafColors = [0x78ae88, 0x66a780, 0xc7a06d, 0x98b4a4];
      vegetationSites.forEach((site, index) => {
        tint.setHex(site.flowering ? [0xefb0a7, 0x9dc68d, 0xd4a16f, 0xcbd5c5][season] : leafColors[season]);
        crowns.setColorAt(index, tint);
      });
      if (crowns.instanceColor) crowns.instanceColor.needsUpdate = true;
      currentSeason = season;
    }
    boats.forEach((boat) => {
      boat.group.position.y = -1.0 + Math.sin(elapsed * 0.9 + boat.seed) * 0.035;
      boat.group.rotation.z = Math.sin(elapsed * 0.7 + boat.seed) * 0.025;
    });
    for (let index = 0; index < birds.count; index += 1) {
      const angle = elapsed * 0.032 + index * 0.08;
      transform.position.set(Math.cos(angle) * (half + 5) + index * 0.55, 6.1 + index * 0.15, Math.sin(angle) * (half + 5) - 8 - index * 0.7);
      transform.rotation.set(0, -angle, 0);
      transform.scale.set(1, 1 + Math.sin(elapsed * 3 + index) * 0.7, 1);
      transform.updateMatrix();
      birds.setMatrixAt(index, transform.matrix);
    }
    birds.instanceMatrix.needsUpdate = true;
  }
  function dispose() {
    if (disposed) return;
    [...buildingRoots].forEach(releaseBuilding);
    disposed = true;
    root.removeFromParent();
    root.traverse((object) => { if (object.isInstancedMesh) object.dispose(); });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    geometries.clear();
    materials.clear();
    templates.clear();
    batcher.dispose();
    boats.length = 0;
    sceneryMeshCount = 0;
  }
  function stats() {
    const visibleBuildings = [...buildingRoots].filter((group) => !group.userData.preview).length;
    return {
      sceneryMeshes: sceneryMeshCount,
      vegetationSites: vegetationSites.length,
      buildingTemplates: templates.size,
      decoratedBuildings: visibleBuildings,
      sharedGeometries: geometries.size,
      sharedMaterials: materials.size,
      buildingMeshes: visibleBuildings,
      season: currentSeason,
      disposed,
    };
  }
  const movingGroups = new Set(boats.map((boat) => boat.group));
  root.traverse((object) => {
    if (object.isMesh) sceneryMeshCount += 1;
    if (movingGroups.has(object)) return;
    object.updateMatrix();
    object.matrixAutoUpdate = false;
  });
  update(0, { week: 1 });
  return { root, update, decorateBuilding, releaseBuilding, setOccupied, dispose, stats };
}
