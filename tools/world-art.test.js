const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const THREE = require('three');

// The game is served as browser ES modules while development tools use CJS.
const sourceRoot = path.resolve(__dirname, '..', 'src');
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const helperUrl = moduleUrl(fs.readFileSync(path.join(sourceRoot, 'art-batch.js'), 'utf8'));
const worldSource = fs.readFileSync(path.join(sourceRoot, 'world-art.js'), 'utf8')
  .replace('from "./art-batch.js"', `from "${helperUrl}"`);
const worldModule = import(moduleUrl(worldSource));

test('world art keeps every building to one mesh and releases unreferenced templates', async () => {
  const { createWorldArt } = await worldModule;
  const scene = new THREE.Scene();
  const art = createWorldArt({ THREE, scene });
  const initial = art.stats();
  assert.ok(initial.sceneryMeshes <= 12, `scenery uses ${initial.sceneryMeshes} meshes`);
  const types = ['residential', 'commercial', 'industrial', 'park', 'school', 'fire', 'power', 'water', 'plaza', 'station', 'lantern'];
  for (const type of types) {
    const building = new THREE.Group();
    for (const level of [1, 2, 3, 1]) {
      art.decorateBuilding(building, type, 3, 4, level);
      let count = 0;
      building.traverse(object => {
        if (!object.isMesh) return;
        count += 1;
        assert.ok(object.geometry.attributes.color, 'colours must share a vertex-colour draw');
        assert.equal(object.material.map, null, 'architecture must not retain the pixel facade texture');
        for (const value of object.geometry.attributes.position.array) assert.ok(Number.isFinite(value));
        const bounds = object.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().makeScale(1 + (level - 1) * 0.12, 1, 1 + (level - 1) * 0.12));
        assert.ok(bounds.min.x >= -1.2 && bounds.max.x <= 1.2 && bounds.min.z >= -1.2 && bounds.max.z <= 1.2, `${type} level ${level} must stay inside its 2.4-unit tile`);
      });
      assert.equal(count, 1, `${type} level ${level}`);
      assert.equal(art.stats().buildingTemplates, 1);
    }
    art.releaseBuilding(building);
    assert.equal(building.children.length, 0);
    assert.equal(art.stats().sharedGeometries, initial.sharedGeometries);
    assert.equal(art.stats().buildingTemplates, 0);
  }
  art.dispose();
  assert.equal(scene.children.length, 0);
  assert.equal(art.stats().sharedGeometries, 0);
  assert.equal(art.stats().sharedMaterials, 0);
});

test('shared model survives other copies and previews, then disposes exactly once', async () => {
  const { createWorldArt } = await worldModule;
  const art = createWorldArt({ THREE, scene: new THREE.Scene() });
  const first = new THREE.Group();
  const second = new THREE.Group();
  const preview = new THREE.Group();
  preview.userData.preview = true;
  [first, second, preview].forEach(group => art.decorateBuilding(group, 'residential', 4, 6, 1));
  const geometry = first.userData.worldArt.template.parts[0].geometry;
  assert.equal(second.userData.worldArt.template.parts[0].geometry, geometry);
  assert.equal(preview.userData.worldArt.template.parts[0].geometry, geometry);
  assert.equal(art.stats().decoratedBuildings, 2);
  let disposals = 0;
  geometry.addEventListener('dispose', () => { disposals += 1; });
  art.releaseBuilding(first);
  art.releaseBuilding(second);
  assert.equal(disposals, 0, 'preview still holds a geometry reference');
  art.releaseBuilding(preview);
  assert.equal(disposals, 1);
  art.releaseBuilding(preview);
  art.dispose();
  assert.equal(disposals, 1, 'released geometry must not be disposed again');
});

test('occupancy and seasons reuse buffers and legacy visuals retain host ownership', async () => {
  const { createWorldArt } = await worldModule;
  const art = createWorldArt({ THREE, scene: new THREE.Scene() });
  const baseline = art.stats().sharedGeometries;
  const trunks = art.root.getObjectByName('lot-tree-trunks');
  const meadow = art.root.getObjectByName('empty-lot-meadows');
  const meadowPositions = meadow.geometry.attributes.position;
  const originalMeadow = meadowPositions.array.slice();
  for (let index = 0; index < meadow.geometry.attributes.normal.count; index += 1) {
    assert.ok(meadow.geometry.attributes.normal.getY(index) > 0.99, 'meadow triangles must face up');
  }
  const originalMatrices = trunks.instanceMatrix.array.slice();
  const tiles = Array.from({ length: 324 }, () => ({ road: true }));
  art.setOccupied(tiles);
  for (let index = 0; index < meadowPositions.count; index += 1) assert.ok(meadowPositions.getY(index) < 0, 'occupied cells must hide meadow surfaces');
  const uploadVersion = meadowPositions.version;
  art.setOccupied(tiles);
  assert.equal(meadowPositions.version, uploadVersion, 'unchanged occupancy must not upload the meadow buffer');
  art.update(0.1, { week: 13 });
  assert.equal(art.stats().season, 1);
  art.setOccupied([]);
  assert.deepEqual(trunks.instanceMatrix.array, originalMatrices);
  assert.deepEqual(meadowPositions.array, originalMeadow);
  art.update(0.1, { week: 37 });
  assert.equal(art.stats().season, 3);
  assert.equal(art.stats().sharedGeometries, baseline);

  const building = new THREE.Group();
  const legacy = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  building.add(legacy);
  let legacyDisposed = false;
  legacy.geometry.addEventListener('dispose', () => { legacyDisposed = true; });
  art.decorateBuilding(building, 'school', 1, 2, 1);
  assert.equal(legacy.visible, false);
  art.releaseBuilding(building);
  assert.equal(legacy.visible, true);
  assert.equal(legacyDisposed, false, 'the host must dispose its own legacy resources');
  legacy.geometry.dispose();
  legacy.material.dispose();
  art.dispose();
});
