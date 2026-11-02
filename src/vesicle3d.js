import * as T from "three";
import { lipidTailGeometry } from "./lipids.js";
export function vesicleModel(item, style) {
  const root = new T.Group(),
    rx = item.radiusX || 3,
    ry = item.radiusY || 3,
    rz = item.radiusZ || Math.min(rx, ry),
    thickness = Math.min(rx, ry) * 0.13;
  for (const side of [-1, 1]) {
    const geometry = new T.SphereGeometry(
      1,
      64,
      32,
      0,
      Math.PI * 2,
      0,
      Math.PI / 2,
    );
    geometry.rotateX(-Math.PI / 2);
    const shell = new T.Mesh(
      geometry,
      new T.MeshStandardMaterial({
        color: style.head,
        side: T.DoubleSide,
        roughness: 0.8,
      }),
    );
    shell.scale.set(
      rx + (side * thickness) / 2,
      ry + (side * thickness) / 2,
      rz + (side * thickness) / 2,
    );
    root.add(shell);
  }
  const count = 96,
    heads = new T.InstancedMesh(
      new T.SphereGeometry(thickness * 0.23, 12, 8),
      new T.MeshStandardMaterial({ color: style.head, roughness: 0.8 }),
      count * 2,
    ),
    tails = new T.InstancedMesh(
      lipidTailGeometry(),
      new T.MeshBasicMaterial({ color: style.tail }),
      count * 2,
    ),
    dummy = new T.Object3D();
  let index = 0;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2,
      x = rx * Math.cos(a),
      y = ry * Math.sin(a),
      n = new T.Vector2(ry * Math.cos(a), rx * Math.sin(a)).normalize();
    for (const side of [-1, 1]) {
      dummy.position.set(
        x + (n.x * side * thickness) / 2,
        y + (n.y * side * thickness) / 2,
        0,
      );
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      heads.setMatrixAt(index, dummy.matrix);
      dummy.position.set(
        x + n.x * side * thickness * 0.36,
        y + n.y * side * thickness * 0.36,
        0,
      );
      dummy.rotation.z =
        Math.atan2(n.y, n.x) - Math.PI / 2 + (side < 0 ? Math.PI : 0);
      dummy.scale.set(thickness * 0.55, thickness * 0.35, thickness * 0.55);
      dummy.updateMatrix();
      tails.setMatrixAt(index++, dummy.matrix);
    }
  }
  root.add(heads, tails);
  return root;
}
