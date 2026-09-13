/** Bake low-poly shapes into vertex-coloured buffers, one draw per render mode. */
export function createArtBatcher({ THREE, primitives, palette, materials, ownGeometry }) {
  const sources = new Map();
  const matrix = new THREE.Matrix4();
  const normalMatrix = new THREE.Matrix3();
  const quaternion = new THREE.Quaternion();
  const point = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const rotation = new THREE.Euler();
  const color = new THREE.Color();

  function batch(defaultMode = "solid") {
    const buckets = new Map();
    function add(shape, tint, at, size, angles = [0, 0, 0], mode = defaultMode) {
      const primitive = primitives[shape];
      if (!primitive) throw new Error(`Unknown art primitive: ${shape}`);
      if (!materials[mode]) throw new Error(`Unknown art render mode: ${mode}`);
      if (!sources.has(primitive)) {
        const source = primitive.index ? primitive.toNonIndexed() : primitive.clone();
        if (!source.attributes.normal) source.computeVertexNormals();
        sources.set(primitive, {
          positions: source.attributes.position.array.slice(),
          normals: source.attributes.normal.array.slice(),
        });
        source.dispose();
      }
      const source = sources.get(primitive);
      if (!buckets.has(mode)) buckets.set(mode, { positions: [], normals: [], colors: [] });
      const target = buckets.get(mode);
      position.fromArray(at);
      scale.fromArray(size);
      rotation.set(...angles);
      quaternion.setFromEuler(rotation);
      matrix.compose(position, quaternion, scale);
      normalMatrix.getNormalMatrix(matrix);
      color.set(palette[tint] ?? tint);
      for (let index = 0; index < source.positions.length; index += 3) {
        point.fromArray(source.positions, index).applyMatrix4(matrix);
        normal.fromArray(source.normals, index).applyMatrix3(normalMatrix).normalize();
        target.positions.push(point.x, point.y, point.z);
        target.normals.push(normal.x, normal.y, normal.z);
        target.colors.push(color.r, color.g, color.b);
      }
    }
    function finish() {
      return [...buckets.entries()].map(([mode, data]) => {
        const geometry = ownGeometry(new THREE.BufferGeometry());
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(data.positions, 3));
        geometry.setAttribute("normal", new THREE.Float32BufferAttribute(data.normals, 3));
        geometry.setAttribute("color", new THREE.Float32BufferAttribute(data.colors, 3));
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
        return { geometry, material: materials[mode] };
      });
    }
    return { add, finish };
  }

  return { batch, dispose: () => sources.clear() };
}
