/**
 * Deterministic, geometry-only scenery for Sunny Town Story.
 * Owns its materials/geometries; never changes simulation or camera state.
 * Shared resources are marked `userData.artSharedResource` for host disposers.
 */
export function createWorldArt({ THREE, scene, gridSize = 18, tileSize = 2.4 }) {
  const half = gridSize * tileSize / 2;
  const root = new THREE.Group();
  root.name = "sunny-harbor-world";
  scene.add(root);
  const geometries = new Set();
  const materials = new Set();
  const buildingRoots = new Set();
  const templates = new Map();
  const primitiveData = new Map();
  const animatedBoats = [];
  let elapsed = 0;
  let disposed = false;
  let sceneryMeshCount = 0;

  const ownGeometry = (geometry) => {
    geometry.userData.artSharedResource = true;
    geometries.add(geometry);
    return geometry;
  };
  const makeMaterial = (color, options = {}) => {
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.84, ...options });
    material.userData.artSharedResource = true;
    materials.add(material);
    return material;
  };
  const palette = {
    cream: makeMaterial(0xfff6df),
    wall: makeMaterial(0xf8eed8),
    wood: makeMaterial(0xaf795a),
    darkWood: makeMaterial(0x684f48),
    deck: makeMaterial(0xd8ab7d),
    stone: makeMaterial(0xa4b6ab),
    paleStone: makeMaterial(0xe4ddc5),
    sand: makeMaterial(0xecd9a9),
    grass: makeMaterial(0x9fc887),
    leaves: makeMaterial(0x78ae85),
    leavesLight: makeMaterial(0xa5c894),
    blossom: makeMaterial(0xefbdba),
    teal: makeMaterial(0x538c88),
    roof: makeMaterial(0xb66e5a),
    roofBlue: makeMaterial(0x608f96),
    roofOlive: makeMaterial(0x859b73),
    brick: makeMaterial(0xcb8c70),
    window: makeMaterial(0x668e92, { roughness: 0.32, metalness: 0.06 }),
    windowWarm: makeMaterial(0xf6dba0, { emissive: 0xe6ae58, emissiveIntensity: 0.12 }),
    white: makeMaterial(0xfffaeb),
    yellow: makeMaterial(0xeac57b),
    red: makeMaterial(0xc87865),
    metal: makeMaterial(0x6f8787, { roughness: 0.55, metalness: 0.2 }),
    water: makeMaterial(0x5baab0, { roughness: 0.64, metalness: 0.05 }),
    shallow: makeMaterial(0x87c4bf, { roughness: 0.75 }),
    shallower: makeMaterial(0xb1d7c6, { roughness: 0.8 }),
    foam: makeMaterial(0xe5f3de, { transparent: true, opacity: 0.58, depthWrite: false }),
    mountain: makeMaterial(0x8eafa2),
    mountainFar: makeMaterial(0xabc3b7),
    cloud: makeMaterial(0xf9f5e7, { transparent: true, opacity: 0.84, depthWrite: false }),
  };
  const primitive = {
    box: ownGeometry(new THREE.BoxGeometry(1, 1, 1)),
    sphere: ownGeometry(new THREE.IcosahedronGeometry(1, 1)),
    softSphere: ownGeometry(new THREE.SphereGeometry(1, 12, 8)),
    cylinder: ownGeometry(new THREE.CylinderGeometry(1, 1, 1, 12)),
    cone: ownGeometry(new THREE.ConeGeometry(1, 1, 8)),
    roofCone: ownGeometry(new THREE.ConeGeometry(1, 1, 12)),
    ring: ownGeometry(new THREE.TorusGeometry(1, 0.085, 5, 20)),
  };
  const sail = new THREE.BufferGeometry();
  sail.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
  sail.computeVertexNormals();
  primitive.sail = ownGeometry(sail);
  const sailMaterial = makeMaterial(0xfff7df, { side: THREE.DoubleSide });
  palette.sail = sailMaterial;

  function seeded(seed) {
    let state = seed >>> 0;
    return () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }
  const random = seeded(918274);

  // Bake many low-poly details into one draw call per material. Building
  // templates also share the baked buffers across all copies of that type.
  function batch() {
    const buckets = new Map();
    const matrix = new THREE.Matrix4();
    const normalMatrix = new THREE.Matrix3();
    const quaternion = new THREE.Quaternion();
    const point = new THREE.Vector3();
    const normal = new THREE.Vector3();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const rotation = new THREE.Euler();
    function add(shape, materialName, at, size, angles = [0, 0, 0]) {
      const source = primitive[shape];
      if (!primitiveData.has(source)) {
        const flat = source.index ? source.toNonIndexed() : source.clone();
        primitiveData.set(source, { positions: flat.attributes.position.array.slice(), normals: flat.attributes.normal.array.slice() });
        flat.dispose();
      }
      const data = primitiveData.get(source);
      const material = palette[materialName];
      if (!buckets.has(material)) buckets.set(material, { positions: [], normals: [] });
      const target = buckets.get(material);
      position.fromArray(at);
      scale.fromArray(size);
      rotation.set(...angles);
      quaternion.setFromEuler(rotation);
      matrix.compose(position, quaternion, scale);
      normalMatrix.getNormalMatrix(matrix);
      for (let index = 0; index < data.positions.length; index += 3) {
        point.fromArray(data.positions, index).applyMatrix4(matrix);
        normal.fromArray(data.normals, index).applyMatrix3(normalMatrix).normalize();
        target.positions.push(point.x, point.y, point.z);
        target.normals.push(normal.x, normal.y, normal.z);
      }
    }
    function finish() {
      return [...buckets.entries()].map(([material, data]) => {
        const geometry = ownGeometry(new THREE.BufferGeometry());
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(data.positions, 3));
        geometry.setAttribute("normal", new THREE.Float32BufferAttribute(data.normals, 3));
        geometry.computeBoundingSphere();
        return { geometry, material };
      });
    }
    return { add, finish };
  }

  function attach(parent, parts, name) {
    const group = new THREE.Group();
    group.name = name;
    group.userData.worldArtDetail = true;
    for (const part of parts) {
      const mesh = new THREE.Mesh(part.geometry, part.material);
      mesh.receiveShadow = true;
      mesh.castShadow = false;
      mesh.updateMatrix();
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
    }
    parent.add(group);
    return group;
  }

  function roundedSquare(side, radius, depth) {
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
    const geometry = depth > 0
      ? new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 8 })
      : new THREE.ShapeGeometry(shape, 8);
    geometry.rotateX(-Math.PI / 2);
    return ownGeometry(geometry);
  }

  function islandLayer(side, radius, depth, y, materialName) {
    const mesh = new THREE.Mesh(roundedSquare(side, radius, depth), palette[materialName]);
    mesh.position.y = y;
    mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  }

  // A continuous island under the existing board removes the floating tiles.
  const sea = new THREE.Mesh(ownGeometry(new THREE.PlaneGeometry(240, 240)), palette.water);
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -1.24;
  root.add(sea);
  islandLayer(half * 2 + 28, 13, 0, -1.21, "shallow");
  islandLayer(half * 2 + 15, 9, 0, -1.18, "shallower");
  islandLayer(half * 2 + 7.5, 5.4, 0.43, -1.02, "sand");
  islandLayer(half * 2 + 3.4, 3.2, 0.48, -0.69, "stone");
  islandLayer(half * 2 + 2.0, 2.4, 0.18, -0.23, "grass");

  const rippleGeometry = ownGeometry(new THREE.PlaneGeometry(150, 150, 36, 36));
  rippleGeometry.rotateX(-Math.PI / 2);
  const ripplePositions = rippleGeometry.attributes.position;
  ripplePositions.setUsage(THREE.DynamicDrawUsage);
  const rippleColumns = rippleGeometry.parameters.widthSegments + 1;
  const rippleRows = rippleGeometry.parameters.heightSegments + 1;
  const rippleXPhase = new Float32Array(rippleColumns);
  const rippleZPhase = new Float32Array(rippleRows);
  const rippleSines = new Float32Array(rippleColumns);
  const rippleCosines = new Float32Array(rippleRows);
  for (let column = 0; column < rippleColumns; column += 1) rippleXPhase[column] = ripplePositions.getX(column) * 0.29;
  for (let row = 0; row < rippleRows; row += 1) rippleZPhase[row] = ripplePositions.getZ(row * rippleColumns) * 0.23;
  let nextRippleUpdate = 0;
  const rippleMaterial = makeMaterial(0xdaf0df, { transparent: true, opacity: 0.085, depthWrite: false, roughness: 0.45, metalness: 0.14 });
  const ripple = new THREE.Mesh(rippleGeometry, rippleMaterial);
  ripple.position.y = -1.1;
  root.add(ripple);

  const shore = batch();
  // Sparse stone joints, foam and grass stay entirely beyond the build grid.
  for (let side = 0; side < 4; side += 1) {
    for (let index = 0; index < 18; index += 1) {
      const along = -half + 1 + index * (half * 2 - 2) / 17;
      const outside = half + 0.97;
      const x = side < 2 ? along : (side === 2 ? outside : -outside);
      const z = side < 2 ? (side === 0 ? outside : -outside) : along;
      shore.add("box", "paleStone", [x, -0.23, z], side < 2 ? [1.35, 0.19, 0.22] : [0.22, 0.19, 1.35]);
      if (index % 2 === 0) {
        const offset = half + 4.1 + random() * 0.8;
        shore.add("box", "foam", [side < 2 ? along : (side === 2 ? offset : -offset), -1.065, side < 2 ? (side === 0 ? offset : -offset) : along], side < 2 ? [1.15 + random(), 0.013, 0.07] : [0.07, 0.013, 1.15 + random()]);
      }
    }
  }
  for (let index = 0; index < 28; index += 1) {
    const x = (random() - 0.5) * 100;
    const z = (random() - 0.5) * 100;
    if (Math.abs(x) < half + 6 && Math.abs(z) < half + 6) continue;
    shore.add("box", "foam", [x, -1.05, z], [0.8 + random() * 1.6, 0.008, 0.035], [0, -0.25, 0]);
  }

  // Public waterfront on the front edge: low structures keep the map readable.
  const waterfrontZ = half + 2.05;
  shore.add("box", "darkWood", [2.4, -0.34, waterfrontZ], [20.2, 0.25, 2.15]);
  for (let index = 0; index < 42; index += 1) {
    shore.add("box", index % 3 ? "deck" : "wood", [-7.45 + index * 0.48, -0.17, waterfrontZ], [0.45, 0.11, 2.1]);
  }
  for (let index = 0; index < 10; index += 1) {
    const x = -7.3 + index * 2.15;
    shore.add("box", "darkWood", [x, -0.62, waterfrontZ + 0.86], [0.12, 1.1, 0.12]);
    shore.add("box", "cream", [x, 0.17, waterfrontZ + 0.86], [0.11, 0.68, 0.11]);
  }
  shore.add("box", "cream", [2.4, 0.39, waterfrontZ + 0.86], [19.45, 0.08, 0.08]);
  shore.add("box", "cream", [2.4, 0.03, waterfrontZ + 0.86], [19.45, 0.05, 0.05]);
  for (const x of [-4.6, 2.4, 9.4]) {
    shore.add("box", "teal", [x, 0.14, waterfrontZ - 0.18], [1.05, 0.12, 0.37]);
    shore.add("box", "teal", [x, 0.4, waterfrontZ - 0.37], [1.05, 0.36, 0.08]);
    for (const dx of [-0.35, 0.35]) shore.add("box", "metal", [x + dx, -0.015, waterfrontZ - 0.18], [0.07, 0.28, 0.27]);
  }
  // Pier extends over water, never through a playable tile.
  shore.add("box", "darkWood", [half + 2.1, -0.54, 8.7], [5.2, 0.25, 1.7]);
  for (let index = 0; index < 14; index += 1) shore.add("box", "deck", [half - 0.2 + index * 0.36, -0.38, 8.7], [0.33, 0.1, 1.68]);
  for (const x of [half + 0.5, half + 3.9]) {
    for (const z of [8.03, 9.37]) shore.add("cylinder", "darkWood", [x, -0.53, z], [0.075, 1.1, 0.075]);
  }
  attach(root, shore.finish(), "shore-and-boardwalk");

  const landscape = batch();
  function tree(x, z, height, flowering = false) {
    landscape.add("cylinder", "wood", [x, height * 0.27 - 0.08, z], [0.085, height * 0.59, 0.085]);
    landscape.add("sphere", flowering ? "blossom" : "leaves", [x, height * 0.7, z], [height * 0.32, height * 0.35, height * 0.31]);
    landscape.add("sphere", flowering ? "blossom" : "leavesLight", [x - height * 0.15, height * 0.82, z + height * 0.07], [height * 0.23, height * 0.25, height * 0.22]);
  }
  for (let index = 0; index < 25; index += 1) {
    const along = -half + 3 + index * (half * 2 - 6) / 24;
    const edge = half + 1.0;
    tree(along, -edge, 1.15 + random() * 1.15, index % 5 === 1);
    if (index % 2 === 0) tree(-edge, along, 1.0 + random() * 1.1, index % 4 === 0);
    if (index % 3 === 0) {
      landscape.add("sphere", "leavesLight", [edge, 0.11, along], [0.37, 0.25, 0.35]);
      landscape.add("sphere", "blossom", [edge + 0.1, 0.3, along], [0.12, 0.09, 0.12]);
    }
  }
  // Small offshore islets and faceted distant hills frame the horizon.
  for (const [x, z, size] of [[-36, -14, 2.4], [31, -24, 2.7], [-27, 27, 1.8]]) {
    landscape.add("sphere", "sand", [x, -1.07, z], [size, 0.52, size * 0.7]);
    landscape.add("sphere", "grass", [x, -0.78, z], [size * 0.72, 0.38, size * 0.5]);
    tree(x, z, 1.8, false);
  }
  for (let index = 0; index < 9; index += 1) {
    const x = -54 + index * 12;
    const height = 7 + random() * 9;
    landscape.add("sphere", index % 2 ? "mountain" : "mountainFar", [x, -4.8, -56 - random() * 9], [9 + random() * 5, height, 8 + random() * 4], [0, random() * 1.2, 0]);
  }
  attach(root, landscape.finish(), "coastal-garden-and-hills");

  const lighthouse = batch();
  const lighthouseX = -half - 7.2;
  const lighthouseZ = -half + 1.5;
  lighthouse.add("sphere", "stone", [0, -0.65, 0], [3.05, 0.75, 2.8]);
  lighthouse.add("cylinder", "paleStone", [0, -0.04, 0], [1.3, 0.18, 1.3]);
  for (let index = 0; index < 5; index += 1) lighthouse.add("cylinder", index % 2 ? "red" : "cream", [0, 0.45 + index * 0.8, 0], [0.76 - index * 0.052, 0.8, 0.76 - index * 0.052]);
  lighthouse.add("cylinder", "darkWood", [0, 4.2, 0], [0.86, 0.12, 0.86]);
  lighthouse.add("cylinder", "windowWarm", [0, 4.62, 0], [0.5, 0.76, 0.5]);
  for (let index = 0; index < 6; index += 1) {
    const angle = index / 6 * Math.PI * 2;
    lighthouse.add("box", "cream", [Math.cos(angle) * 0.49, 4.62, Math.sin(angle) * 0.49], [0.07, 0.85, 0.07]);
  }
  lighthouse.add("roofCone", "roof", [0, 5.17, 0], [0.78, 0.4, 0.78]);
  lighthouse.add("sphere", "yellow", [0, 5.43, 0], [0.09, 0.12, 0.09]);
  lighthouse.add("box", "darkWood", [0, 0.53, 0.74], [0.36, 0.74, 0.08]);
  const beacon = attach(root, lighthouse.finish(), "harbor-lighthouse");
  beacon.position.set(lighthouseX, 0, lighthouseZ);

  function makeBoat(x, z, angle, seed, sailing) {
    const boat = batch();
    boat.add("softSphere", sailing ? "cream" : "teal", [0, 0, 0], [0.6, 0.27, 1.28]);
    boat.add("box", "wood", [0, 0.19, 0], [0.72, 0.09, 1.54]);
    boat.add("box", "white", [0, 0.27, 0.35], [0.53, 0.12, 0.32]);
    if (sailing) {
      boat.add("cylinder", "wood", [0, 1.14, 0], [0.035, 2.0, 0.035]);
      boat.add("sail", "sail", [0.07, 0.55, 0], [1.05, 1.48, 1], [0, Math.PI / 2, 0]);
      boat.add("sail", "red", [-0.07, 0.55, 0.05], [0.75, 1.03, 1], [0, -Math.PI / 2, 0]);
    } else {
      boat.add("box", "white", [0, 0.61, -0.13], [0.6, 0.64, 0.74]);
      boat.add("box", "roof", [0, 0.96, -0.13], [0.74, 0.12, 0.9]);
      boat.add("box", "window", [0, 0.67, 0.255], [0.45, 0.26, 0.02]);
    }
    const group = attach(root, boat.finish(), sailing ? "sailboat" : "fishing-boat");
    group.position.set(x, -0.97, z);
    group.rotation.y = angle;
    animatedBoats.push({ group, x, z, angle, seed });
  }
  makeBoat(half + 5.9, 9.1, 0.2, 0.6, false);
  makeBoat(half + 11.8, -6.5, -0.6, 2.8, true);
  makeBoat(-13.5, half + 10.8, 1.1, 5.4, true);

  const clouds = batch();
  for (const [x, y, z, size] of [[-30, 14, -32, 2.0], [10, 17, -39, 2.4], [38, 11, -18, 1.7]]) {
    for (let index = 0; index < 3; index += 1) clouds.add("softSphere", "cloud", [x + (index - 1) * size * 1.05, y + (index === 1 ? size * 0.28 : 0), z], [size, size * 0.5, size * 0.54]);
  }
  const cloudRoot = attach(root, clouds.finish(), "soft-coastal-clouds");

  // Two instanced wing meshes animate a flock at a fixed two-draw-call cost.
  const birdWingGeometry = ownGeometry(new THREE.BufferGeometry());
  birdWingGeometry.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 0.5, 0.04, 0, 0.22, 0, 0.16], 3));
  birdWingGeometry.computeVertexNormals();
  const birdMaterial = makeMaterial(0xfff9e8, { side: THREE.DoubleSide });
  const leftWings = new THREE.InstancedMesh(birdWingGeometry, birdMaterial, 9);
  const rightWings = new THREE.InstancedMesh(birdWingGeometry, birdMaterial, 9);
  leftWings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  rightWings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  leftWings.frustumCulled = rightWings.frustumCulled = false;
  root.add(leftWings, rightWings);
  const birdTransform = new THREE.Object3D();

  // Small groves make the undeveloped lots feel inhabited by nature. All sites
  // remain buildable; an occupied lot hides only its three vegetation instances.
  const vegetationRandom = seeded(432217);
  const groveCenters = [{ x: 2, z: 3 }, { x: gridSize - 4, z: 2 }, { x: 3, z: gridSize - 4 }, { x: gridSize - 3, z: gridSize - 3 }];
  const vegetationSites = [];
  for (let z = 1; z < gridSize - 1; z += 1) {
    for (let x = 1; x < gridSize - 1; x += 1) {
      if (x >= 5 && x <= 12 && z >= 5 && z <= 12) continue;
      const nearGrove = Math.min(...groveCenters.map((center) => Math.abs(center.x - x) + Math.abs(center.z - z)));
      vegetationSites.push({ x, z, tileIndex: z * gridSize + x, order: nearGrove + vegetationRandom() * 3 });
    }
  }
  vegetationSites.sort((a, b) => a.order - b.order);
  vegetationSites.length = Math.min(40, vegetationSites.length);
  const vegetationTrunks = new THREE.InstancedMesh(primitive.cylinder, palette.wood, vegetationSites.length);
  const vegetationCrownMaterial = makeMaterial(0xffffff);
  const vegetationCrowns = new THREE.InstancedMesh(primitive.sphere, vegetationCrownMaterial, vegetationSites.length);
  const vegetationTips = new THREE.InstancedMesh(primitive.sphere, palette.leavesLight, vegetationSites.length);
  const vegetationMeshes = [vegetationTrunks, vegetationCrowns, vegetationTips];
  const vegetationTransform = new THREE.Object3D();
  const vegetationColor = new THREE.Color();
  const tileOffset = (gridSize - 1) * tileSize / 2;
  let occupiedSignature = "";
  vegetationSites.forEach((site) => {
    site.tree = vegetationRandom() > 0.22;
    site.height = site.tree ? 1.05 + vegetationRandom() * 0.55 : 0.4 + vegetationRandom() * 0.13;
    site.worldX = site.x * tileSize - tileOffset + (vegetationRandom() - 0.5) * 0.38;
    site.worldZ = site.z * tileSize - tileOffset + (vegetationRandom() - 0.5) * 0.38;
    site.flowering = vegetationRandom() < 0.23;
  });
  vegetationMeshes.forEach((mesh, index) => {
    mesh.name = ["lot-tree-trunks", "lot-tree-crowns", "lot-shrub-tips"][index];
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    root.add(mesh);
  });

  function setOccupied(tiles = []) {
    if (disposed) return;
    const signature = vegetationSites.map((site) => {
      const tile = tiles[site.tileIndex];
      return tile?.road || tile?.buildingId ? "1" : "0";
    }).join("");
    if (signature === occupiedSignature) return;
    vegetationSites.forEach((site, index) => {
      if (signature[index] === occupiedSignature[index]) return;
      const visible = signature[index] === "0";
      const trunkScale = visible && site.tree ? 1 : 0;
      vegetationTransform.position.set(site.worldX, 0.08 + site.height * 0.27, site.worldZ);
      vegetationTransform.scale.set(0.065 * trunkScale, site.height * 0.58 * trunkScale, 0.065 * trunkScale);
      vegetationTransform.updateMatrix();
      vegetationTrunks.setMatrixAt(index, vegetationTransform.matrix);
      vegetationTransform.position.y = 0.08 + site.height * (site.tree ? 0.72 : 0.48);
      const crownScale = visible ? site.height : 0;
      vegetationTransform.scale.set(crownScale * 0.34, crownScale * (site.tree ? 0.37 : 0.45), crownScale * 0.33);
      vegetationTransform.updateMatrix();
      vegetationCrowns.setMatrixAt(index, vegetationTransform.matrix);
      vegetationTransform.position.set(site.worldX - site.height * 0.13, 0.08 + site.height * (site.tree ? 0.9 : 0.68), site.worldZ + site.height * 0.09);
      vegetationTransform.scale.set(crownScale * 0.23, crownScale * 0.22, crownScale * 0.23);
      vegetationTransform.updateMatrix();
      vegetationTips.setMatrixAt(index, vegetationTransform.matrix);
    });
    vegetationMeshes.forEach((mesh) => { mesh.instanceMatrix.needsUpdate = true; });
    occupiedSignature = signature;
  }

  setOccupied();
  // Bounds cover every possible restored tree; removing a tree never requires
  // bounds recalculation or geometry allocation.
  vegetationMeshes.forEach((mesh) => mesh.computeBoundingSphere());
  const seasonColors = [0x9fc887, 0x9ac88f, 0x93bb8d, 0xc3bc85];
  const seasonLeafColors = [0x78ae85, 0x73a47c, 0x709879, 0xb79c74];
  const seasonSeaColors = [0x5baab0, 0x55aab5, 0x639fa8, 0x76a6a6];
  let currentSeason = -1;

  function buildingTemplate(type, variant) {
    const key = `${type}:${variant}`;
    if (templates.has(key)) return templates.get(key);
    const base = batch();
    const upper = batch();
    const roofMaterial = type === "fire" ? "red" : type === "industrial" || type === "station" ? "roofBlue" : ["roof", "roofBlue", "roofOlive"][variant];
    const heights = { residential: 0.9, commercial: 1.05, industrial: 1.15, school: 1.0, fire: 1.0 };
    const height = heights[type];
    const box = (material, at, size, angles) => base.add("box", material, at, size, angles);
    const pot = (x, z, flower = false) => {
      base.add("cylinder", "brick", [x, 0.13, z], [0.095, 0.2, 0.095]);
      base.add("sphere", flower ? "blossom" : "leaves", [x, 0.29, z], [0.14, 0.13, 0.13]);
    };
    const window = (x, y, z, width = 0.27, side = false) => {
      box("cream", [x, y, z], side ? [0.07, 0.34, width + 0.07] : [width + 0.07, 0.34, 0.07]);
      box("window", [x + (side ? 0.045 : 0), y + 0.005, z + (side ? 0 : 0.045)], side ? [0.026, 0.25, width] : [width, 0.25, 0.026]);
      box("cream", [x + (side ? 0.061 : 0), y + 0.005, z + (side ? 0 : 0.061)], side ? [0.027, 0.26, 0.025] : [0.025, 0.26, 0.027]);
    };
    // A low paved plinth and ground contact make every lot feel planted.
    box("paleStone", [0, -0.005, 0], [1.69, 0.075, 1.66]);
    if (height) {
      box("cream", [0, 0.11, 0], [1.28, 0.12, 1.22]);
      box("wood", [0, 0.39, 0.614], [0.27, 0.6, 0.04]);
      box("windowWarm", [0, 0.49, 0.642], [0.17, 0.22, 0.025]);
      box("cream", [0, 0.11, 0.73], [0.53, 0.09, 0.27]);
      window(-0.38, 0.52, 0.61, 0.23);
      window(0.38, 0.52, 0.61, 0.23);
      window(0.637, 0.52, -0.22, 0.29, true);
      window(0.637, 0.52, 0.26, 0.25, true);
      // Twin roof planes with eaves, ridge and a tiny chimney.
      for (const side of [-1, 1]) {
        box(roofMaterial, [side * 0.36, height + 0.3, 0], [0.86, 0.12, 1.47], [0, 0, side * -0.48]);
        box("cream", [side * 0.73, height + 0.11, 0], [0.045, 0.065, 1.43]);
      }
      box(roofMaterial, [0, height + 0.51, 0], [0.13, 0.1, 1.53]);
      if (type !== "industrial") {
        box("brick", [-0.37, height + 0.48, -0.36], [0.16, 0.49, 0.2]);
        box("cream", [-0.37, height + 0.75, -0.36], [0.21, 0.08, 0.25]);
      }
      pot(-0.71, 0.7, true);
      pot(0.71, 0.7, variant === 0);
      // A compact upper terrace appears with upgrades without rebuilding buffers.
      upper.add("box", "cream", [0, height + 0.8, 0], [0.57, 0.3, 0.48]);
      upper.add("box", roofMaterial, [0, height + 0.99, 0], [0.68, 0.1, 0.58]);
      upper.add("box", "window", [0, height + 0.81, 0.247], [0.35, 0.18, 0.02]);
    }

    if (type === "residential") {
      for (const x of [-0.81, 0.81]) {
        for (const z of [-0.66, -0.22, 0.22]) box("cream", [x, 0.18, z], [0.045, 0.36, 0.05]);
        box("cream", [x, 0.22, -0.23], [0.045, 0.045, 1.02]);
      }
      box("leaves", [-0.66, 0.19, -0.58], [0.35, 0.25, 0.28]);
    } else if (type === "commercial") {
      for (let index = 0; index < 7; index += 1) box(index % 2 ? "cream" : "teal", [-0.57 + index * 0.19, 0.79, 0.81], [0.18, 0.065, 0.36], [-0.15, 0, 0]);
      box("wood", [0.74, 0.46, 0.64], [0.055, 0.82, 0.055]);
      box("cream", [0.83, 0.79, 0.64], [0.34, 0.28, 0.07]);
      base.add("sphere", "yellow", [0.83, 0.79, 0.685], [0.09, 0.07, 0.025]);
      box("wood", [-0.7, 0.31, 0.71], [0.28, 0.1, 0.28]);
    } else if (type === "industrial") {
      box("metal", [-0.28, height + 0.55, -0.3], [0.22, 0.84, 0.22]);
      box("cream", [-0.28, height + 0.99, -0.3], [0.28, 0.08, 0.28]);
      box("metal", [0, 0.43, 0.65], [0.53, 0.65, 0.04]);
      for (let index = 0; index < 5; index += 1) box("paleStone", [0, 0.22 + index * 0.11, 0.683], [0.49, 0.026, 0.02]);
      box("wood", [0.68, 0.14, -0.7], [0.26, 0.25, 0.26]);
    } else if (type === "school") {
      box("cream", [0, height + 0.57, 0.57], [0.29, 0.36, 0.12]);
      base.add("cylinder", "yellow", [0, height + 0.61, 0.646], [0.095, 0.025, 0.095], [Math.PI / 2, 0, 0]);
      box("darkWood", [0, height + 0.62, 0.664], [0.012, 0.1, 0.012]);
      box("darkWood", [0.025, height + 0.595, 0.664], [0.055, 0.012, 0.012]);
      box("cream", [-0.79, 0.67, -0.72], [0.035, 1.35, 0.035]);
      box("teal", [-0.66, 1.16, -0.72], [0.25, 0.2, 0.025]);
    } else if (type === "fire") {
      box("red", [0, 0.41, 0.66], [0.7, 0.56, 0.055]);
      for (const x of [-0.19, 0.19]) box("window", [x, 0.51, 0.696], [0.23, 0.16, 0.025]);
      box("cream", [0, 0.84, 0.647], [0.4, 0.18, 0.06]);
      box("red", [0, 0.84, 0.69], [0.06, 0.13, 0.025]);
      box("red", [0, 0.84, 0.69], [0.16, 0.05, 0.025]);
    } else if (type === "park") {
      box("wood", [0, 0.31, 0.64], [0.65, 0.075, 0.21]);
      box("wood", [0, 0.47, 0.75], [0.65, 0.24, 0.055]);
      for (const x of [-0.24, 0.24]) box("metal", [x, 0.18, 0.64], [0.06, 0.24, 0.15]);
      for (const x of [-0.66, 0.66]) pot(x, 0.61, true);
      box("paleStone", [0, 0.3, 0.07], [0.22, 0.026, 0.73]);
    } else if (type === "water") {
      for (const x of [-0.34, 0.34]) for (const z of [-0.3, 0.3]) box("cream", [x, 0.59, z], [0.055, 1.1, 0.055]);
      base.add("ring", "cream", [0, 1.16, 0], [0.48, 0.48, 0.48], [Math.PI / 2, 0, 0]);
      box("cream", [-0.49, 0.72, 0], [0.04, 1.39, 0.18]);
      for (let index = 0; index < 7; index += 1) box("metal", [-0.519, 0.17 + index * 0.18, 0], [0.04, 0.026, 0.22]);
      base.add("roofCone", "roofBlue", [0, 1.6, 0], [0.5, 0.27, 0.5]);
    } else if (type === "power") {
      for (const x of [-0.57, 0.57]) {
        box("metal", [x, 0.35, 0.28], [0.035, 0.58, 0.035]);
        box("roofBlue", [x, 0.54, 0.22], [0.4, 0.045, 0.7], [0.25, 0, 0]);
        box("cream", [x, 0.57, 0.22], [0.023, 0.02, 0.65], [0.25, 0, 0]);
      }
      base.add("ring", "cream", [0, 0.77, 0], [0.43, 0.43, 0.43], [Math.PI / 2, 0, 0]);
    } else if (type === "plaza") {
      base.add("cylinder", "paleStone", [0, 0.28, 0], [0.6, 0.16, 0.6]);
      base.add("cylinder", "water", [0, 0.372, 0], [0.49, 0.035, 0.49]);
      base.add("cylinder", "cream", [0, 0.51, 0], [0.085, 0.3, 0.085]);
      base.add("softSphere", "shallower", [0, 0.71, 0], [0.14, 0.07, 0.14]);
      for (const [x, z] of [[-0.7, -0.65], [0.7, 0.65]]) pot(x, z, true);
    } else if (type === "station") {
      for (const x of [-0.64, 0.64]) box("cream", [x, 0.56, 0.15], [0.07, 0.79, 0.07]);
      box("wood", [-0.3, 0.38, 0.07], [0.57, 0.06, 0.2]);
      box("teal", [0, 0.61, 0.5], [0.52, 0.16, 0.025]);
      for (const z of [-0.67, -0.85]) box("metal", [0, 0.12, z], [1.65, 0.045, 0.045]);
      for (let index = 0; index < 6; index += 1) box("wood", [-0.67 + index * 0.27, 0.092, -0.76], [0.075, 0.04, 0.36]);
      base.add("cylinder", "cream", [0.48, 0.64, 0.515], [0.095, 0.028, 0.095], [Math.PI / 2, 0, 0]);
      box("darkWood", [0.48, 0.66, 0.535], [0.013, 0.08, 0.013]);
    } else if (type === "lantern") {
      for (const x of [-0.57, 0.57]) box("darkWood", [x, 0.63, 0], [0.065, 1.16, 0.065]);
      box("darkWood", [0, 1.19, 0], [1.35, 0.08, 0.09]);
      for (const x of [-0.47, 0.47]) {
        base.add("softSphere", x < 0 ? "yellow" : "red", [x, 0.95, 0], [0.17, 0.21, 0.16]);
        box("cream", [x, 0.96, 0.162], [0.035, 0.28, 0.02]);
        box("darkWood", [x, 0.71, 0], [0.027, 0.12, 0.027]);
      }
      pot(-0.67, 0.67, true);
      pot(0.67, -0.67, true);
    }
    const result = { base: base.finish(), upper: upper.finish() };
    templates.set(key, result);
    return result;
  }

  function decorateBuilding(group, type, x = 0, z = 0, level = 1) {
    if (disposed || !group) return;
    let details = group.userData.worldArt;
    if (!details) {
      const variant = Math.abs(Math.imul(x + 13, 17) + Math.imul(z + 7, 31)) % 3;
      // Replace the generic pyramid only. Existing park/tower/platform meshes
      // are retained and the host continues owning their original resources.
      const originals = [...group.children];
      const hidden = [];
      originals.forEach((child, index) => {
        if (!child.isMesh) return;
        const genericRoof = child.geometry?.type === "ConeGeometry";
        const genericLandmarkBody = ["plaza", "station", "lantern"].includes(type) && index === 0 && child.geometry?.type === "BoxGeometry";
        const oldShopAwning = type === "commercial" && index === 2 && child.geometry?.type === "BoxGeometry";
        if (genericRoof || genericLandmarkBody || oldShopAwning) {
          hidden.push({ child, wasVisible: child.visible });
          child.visible = false;
        }
      });
      const template = buildingTemplate(type, variant);
      const detailRoot = new THREE.Group();
      detailRoot.name = `architecture-${type}`;
      detailRoot.userData.worldArtDetail = true;
      group.add(detailRoot);
      const baseDetails = attach(detailRoot, template.base, "facade-and-garden");
      const upperDetails = attach(detailRoot, template.upper, "upper-dormer");
      details = { root: detailRoot, base: baseDetails, upper: upperDetails, hidden, type, variant };
      group.userData.worldArt = details;
      buildingRoots.add(group);
    }
    details.upper.visible = level >= 3;
    details.root.userData.level = level;
  }

  function releaseBuilding(group) {
    const details = group?.userData.worldArt;
    if (!details) return;
    group.remove(details.root);
    details.hidden.forEach(({ child, wasVisible }) => { child.visible = wasVisible; });
    delete group.userData.worldArt;
    buildingRoots.delete(group);
  }

  function update(delta, context = {}) {
    if (disposed) return;
    elapsed += Math.max(0, Math.min(Number.isFinite(delta) ? delta : 0, 0.1));
    const season = Number.isInteger(context.season) ? ((context.season % 4) + 4) % 4 : Math.floor((Math.max(1, context.week || 1) - 1) / 12) % 4;
    if (season !== currentSeason) {
      palette.grass.color.setHex(seasonColors[season]);
      palette.leaves.color.setHex(seasonLeafColors[season]);
      palette.water.color.setHex(seasonSeaColors[season]);
      palette.blossom.color.setHex(season === 3 ? 0xd4af7d : season === 2 ? 0xb0c598 : 0xefbdba);
      vegetationSites.forEach((site, index) => {
        vegetationColor.setHex(site.flowering ? (season === 3 ? 0xd4af7d : 0xe8bcb3) : seasonLeafColors[season]);
        vegetationCrowns.setColorAt(index, vegetationColor);
      });
      if (vegetationCrowns.instanceColor) vegetationCrowns.instanceColor.needsUpdate = true;
      currentSeason = season;
    }
    if (elapsed >= nextRippleUpdate) {
      // The wave is separable: 37 row + 37 column trig operations replace
      // 2,738 per-vertex operations, and tiny ripples only upload at 6 Hz.
      for (let column = 0; column < rippleColumns; column += 1) rippleSines[column] = Math.sin(rippleXPhase[column] + elapsed * 0.63);
      for (let row = 0; row < rippleRows; row += 1) rippleCosines[row] = Math.cos(rippleZPhase[row] + elapsed * 0.47);
      const positions = ripplePositions.array;
      for (let row = 0; row < rippleRows; row += 1) {
        const waveHeight = rippleCosines[row] * 0.025;
        for (let column = 0; column < rippleColumns; column += 1) positions[(row * rippleColumns + column) * 3 + 1] = rippleSines[column] * waveHeight;
      }
      ripplePositions.needsUpdate = true;
      nextRippleUpdate = elapsed + 1 / 6;
    }
    animatedBoats.forEach((boat) => {
      boat.group.position.y = -0.94 + Math.sin(elapsed * 1.16 + boat.seed) * 0.055;
      boat.group.rotation.z = Math.sin(elapsed * 0.8 + boat.seed) * 0.035;
      boat.group.rotation.x = Math.cos(elapsed * 0.63 + boat.seed) * 0.025;
    });
    cloudRoot.position.x = Math.sin(elapsed * 0.012) * 3;
    for (let index = 0; index < 9; index += 1) {
      const angle = elapsed * 0.042 + index * 0.09;
      const x = Math.cos(angle) * (half + 9.5) + index * 0.46;
      const z = Math.sin(angle) * (half + 8.5) - 6 - index * 0.62;
      const y = 7.1 + Math.sin(index * 2.4) * 0.48;
      const flap = Math.sin(elapsed * 4.5 + index * 0.8) * 0.48;
      birdTransform.position.set(x, y, z);
      birdTransform.rotation.set(0, -angle, flap);
      birdTransform.scale.set(0.8, 0.8, 0.8);
      birdTransform.updateMatrix();
      leftWings.setMatrixAt(index, birdTransform.matrix);
      birdTransform.rotation.z = Math.PI - flap;
      birdTransform.updateMatrix();
      rightWings.setMatrixAt(index, birdTransform.matrix);
    }
    leftWings.instanceMatrix.needsUpdate = true;
    rightWings.instanceMatrix.needsUpdate = true;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    [...buildingRoots].forEach(releaseBuilding);
    root.removeFromParent();
    root.traverse((object) => { if (object.isInstancedMesh) object.dispose(); });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    geometries.clear();
    materials.clear();
    templates.clear();
    primitiveData.clear();
    animatedBoats.length = 0;
    sceneryMeshCount = 0;
  }

  function stats() {
    return { sceneryMeshes: sceneryMeshCount, vegetationSites: vegetationSites.length, buildingTemplates: templates.size, decoratedBuildings: buildingRoots.size, sharedGeometries: geometries.size, sharedMaterials: materials.size, season: currentSeason, disposed };
  }

  const movingGroups = new Set([cloudRoot, ...animatedBoats.map((boat) => boat.group)]);
  root.traverse((object) => {
    if (object.isMesh) sceneryMeshCount += 1;
    if (movingGroups.has(object)) return;
    object.updateMatrix();
    object.matrixAutoUpdate = false;
  });
  update(0, { week: 1 });
  return { root, update, decorateBuilding, releaseBuilding, setOccupied, dispose, stats };
}
