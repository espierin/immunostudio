import * as T from "three";
import { bezier, tangent, arcT } from "./model.js";

function clipDepth(polygon, limit, sign) {
  const result = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i],
      b = polygon[(i + 1) % polygon.length],
      insideA = sign * a[2] <= sign * limit,
      insideB = sign * b[2] <= sign * limit;
    if (insideA) result.push(a);
    if (insideA !== insideB) {
      const t = (limit - a[2]) / (b[2] - a[2]);
      result.push(a.map((v, k) => v + (b[k] - v) * t));
    }
  }
  return result;
}
/** Exact intersection of both curved leaflets with the camera cutting plane. */
export function membraneCutGeometry(
  project,
  table,
  normal,
  target,
  pores = [],
) {
  const vertices = [];
  if (Math.abs(normal.z) < 0.15) return new T.BufferGeometry();
  const point = (s, side) => {
    const u = arcT(table, s),
      p = bezier(project.curve, u),
      t = tangent(project.curve, u);
    const x = p[0] - t[1] * project.thickness * 0.5 * side,
      y = p[1] + t[0] * project.thickness * 0.5 * side;
    return [
      x,
      y,
      target.z -
        (normal.x * (x - target.x) + normal.y * (y - target.y)) / normal.z,
    ];
  };
  for (let i = 0; i < 240; i++) {
    const start = i / 240,
      end = (i + 1) / 240;
    let polygon = [
      point(start, -1),
      point(end, -1),
      point(end, 1),
      point(start, 1),
    ];
    const s = (start + end) * 0.5 * table.length,
      z = polygon.reduce((n, p) => n + p[2], 0) / 4;
    const margin =
      Math.hypot(
        table.length / 240,
        Math.max(...polygon.map((p) => p[2])) -
          Math.min(...polygon.map((p) => p[2])),
      ) / 2;
    if (
      pores.some((p) => (s - p.s) ** 2 + (z - p.v) ** 2 < (p.r + margin) ** 2)
    )
      continue;
    polygon = clipDepth(polygon, project.depth / 2, 1);
    polygon = clipDepth(polygon, -project.depth / 2, -1);
    for (let j = 1; j + 1 < polygon.length; j++)
      vertices.push(...polygon[0], ...polygon[j], ...polygon[j + 1]);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return geometry;
}
