import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
/** Paired slender, kinked tails, following basic_40 / basic_41. */
export function lipidTailGeometry() {
  const geometries = [];
  for (const side of [-1, 1]) {
    const points = [
      new T.Vector3(side * 0.085, 0, 0),
      new T.Vector3(side * 0.115, -0.48, 0),
      new T.Vector3(side * 0.025, -1, 0.025 * side),
    ];
    const path = new T.CurvePath();
    path.add(new T.LineCurve3(points[0], points[1]));
    path.add(new T.LineCurve3(points[1], points[2]));
    geometries.push(new T.TubeGeometry(path, 10, 0.02, 6, false));
  }
  const geometry = mergeGeometries(geometries);
  for (const g of geometries) g.dispose();
  return geometry;
}
