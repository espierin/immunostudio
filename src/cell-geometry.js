import * as T from "three";
import {
  mergeGeometries,
  mergeVertices,
} from "three/addons/utils/BufferGeometryUtils.js";
/** Smooth half-ellipsoid, with the source cell outline retained only near the cut rim. */
export function cellHemisphereGeometry(shape, depth, curveSegments = 24) {
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
      z = (-depth / 2) * Math.sin(angle);
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * 2 * Math.PI,
        r = c * (1 + (edges[i] - 1) * c ** 24);
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
