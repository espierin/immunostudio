import * as T from "three";
import {
  mergeGeometries,
  mergeVertices,
} from "three/addons/utils/BufferGeometryUtils.js";
/** Cell-type cutaway; source contours determine the footprint and profile determines depth. */
export function cellHemisphereGeometry(
  shape,
  depth,
  curveSegments = 24,
  morphology,
) {
  if (morphology?.construction === "contour")
    return contourCellGeometry(shape, depth, curveSegments, morphology);
  const extracted = shape.extractPoints(curveSegments),
    rings = [extracted.shape, ...extracted.holes];
  const bounds = new T.Box2().setFromPoints(extracted.shape),
    size = bounds.getSize(new T.Vector2()),
    center = bounds.getCenter(new T.Vector2()),
    rx = size.x / 2,
    ry = size.y / 2;
  const positions = [],
    indices = [],
    segments = 160,
    latitudes = 48;
  const edgeAt = (dx, dy) => {
    let edge = Infinity;
    const ring = rings[0];
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length],
        ax = (a.x - center.x) / rx,
        ay = (a.y - center.y) / ry,
        sx = (b.x - a.x) / rx,
        sy = (b.y - a.y) / ry,
        den = dx * sy - dy * sx;
      if (Math.abs(den) < 1e-10) continue;
      const t = (ax * sy - ay * sx) / den,
        u = (ax * dy - ay * dx) / den;
      if (t > 0 && u >= -1e-6 && u <= 1 + 1e-6) edge = Math.min(edge, t);
    }
    return Number.isFinite(edge) ? edge : 1;
  };
  const edges = Array.from({ length: segments + 1 }, (_, i) => {
    const angle = (i / segments) * 2 * Math.PI;
    return edgeAt(Math.cos(angle), Math.sin(angle));
  });
  for (let j = 0; j <= latitudes; j++) {
    const angle = ((j / latitudes) * Math.PI) / 2,
      c = Math.cos(angle),
      radial = Math.cos(angle),
      depression =
        morphology?.type === "erythrocyte" ? 0.3 + 1.35 * radial * radial : 1,
      z =
        (-depth / 2) *
        (morphology?.depthRatio ?? 1) *
        Math.sin(angle) *
        depression;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * 2 * Math.PI,
        contourWeight = morphology
          ? morphology.type === "lymphocyte"
            ? c ** 4
            : 1
          : c ** 24,
        r = c * (1 + (edges[i] - 1) * contourWeight);
      positions.push(
        center.x + rx * r * Math.cos(theta),
        center.y + ry * r * Math.sin(theta),
        z,
      );
    }
  }
  for (let j = 0; j < latitudes; j++)
    for (let i = 0; i < segments; i++) {
      const a = j * (segments + 1) + i,
        b = a + 1,
        d = a + segments + 1,
        c = d + 1;
      if (j < latitudes - 1) indices.push(a, d, c);
      indices.push(a, c, b);
    }
  let rear = new T.BufferGeometry();
  rear.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  rear.setIndex(indices);
  rear = mergeVertices(rear, 1e-5);
  rear.computeVertexNormals();
  const front = new T.ShapeGeometry(shape, curveSegments);
  front.deleteAttribute("uv");
  const geometry = mergeGeometries([front, rear]);
  front.dispose();
  rear.dispose();
  return {
    geometry,
    bounds,
    rings,
    radius: Math.min(rx, ry),
    depth,
    hemisphere: true,
  };
}

/** Triangulated source footprint: concave outlines and thin processes never become a disk. */
function contourCellGeometry(shape, depth, curveSegments, morphology) {
  const extracted = shape.extractPoints(curveSegments),
    rings = [extracted.shape, ...extracted.holes],
    bounds = new T.Box2().setFromPoints(extracted.shape),
    size = bounds.getSize(new T.Vector2()),
    center = bounds.getCenter(new T.Vector2()),
    radius = Math.max(0.001, Math.min(size.x, size.y) / 2),
    halfDepth = (depth * morphology.depthRatio) / 2,
    flat = new T.ShapeGeometry(shape, curveSegments),
    pos = flat.attributes.position,
    index = flat.index,
    points = [],
    cache = new Map();
  const rearPoint = (p) => {
    const key = `${p.x.toFixed(5)},${p.y.toFixed(5)}`;
    if (cache.has(key)) return cache.get(key);
    let distance = Infinity;
    for (const ring of rings)
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i],
          b = ring[(i + 1) % ring.length],
          dx = b.x - a.x,
          dy = b.y - a.y,
          t = Math.max(
            0,
            Math.min(
              1,
              ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1),
            ),
          );
        distance = Math.min(
          distance,
          Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy),
        );
      }
    const f = Math.min(
        1,
        distance / (radius * (morphology.type === "dendritic" ? 0.48 : 0.85)),
      ),
      x = (p.x - center.x) / Math.max(1, size.x / 2),
      y = (p.y - center.y) / Math.max(1, size.y / 2),
      asymmetry = ["macrophage", "monocyte", "apoptotic"].includes(
        morphology.type,
      )
        ? 1 + 0.14 * Math.sin(3 * x + 1.3 * y) + 0.08 * Math.sin(4 * y - 2 * x)
        : 1,
      slope = morphology.type === "dendritic" ? 1.15 : 1.8,
      dome = halfDepth * Math.sqrt(f * (2 - f)) * asymmetry,
      local = distance * slope,
      z = -(dome * local) / Math.max(1e-12, Math.hypot(dome, local)),
      value = [p.x, p.y, z];
    cache.set(key, value);
    return value;
  };
  const triangle = (a, b, c, n) => {
    if (n) {
      const ab = a.clone().add(b).multiplyScalar(0.5),
        bc = b.clone().add(c).multiplyScalar(0.5),
        ca = c.clone().add(a).multiplyScalar(0.5);
      triangle(a, ab, ca, n - 1);
      triangle(ab, b, bc, n - 1);
      triangle(ca, bc, c, n - 1);
      triangle(ab, bc, ca, n - 1);
      return;
    }
    points.push(...rearPoint(c), ...rearPoint(b), ...rearPoint(a));
  };
  const subdivisions = Math.max(
    2,
    Math.min(
      4,
      Math.floor(Math.log2(20000 / Math.max(1, index.count / 3)) / 2),
    ),
  );
  for (let i = 0; i < index.count; i += 3) {
    triangle(
      ...[0, 1, 2].map(
        (k) =>
          new T.Vector2(
            pos.getX(index.getX(i + k)),
            pos.getY(index.getX(i + k)),
          ),
      ),
      subdivisions,
    );
  }
  let rear = new T.BufferGeometry();
  rear.setAttribute("position", new T.Float32BufferAttribute(points, 3));
  rear = mergeVertices(rear, 1e-5);
  rear.computeVertexNormals();
  flat.deleteAttribute("uv");
  const geometry = mergeGeometries([flat, rear]);
  flat.dispose();
  rear.dispose();
  return { geometry, bounds, rings, radius, depth, hemisphere: true };
}
