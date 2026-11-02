import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { volumeGeometry } from "../src/basis3d.js";
import { isHemisphereCell } from "../src/cell-look.js";
test("Cell has a flat front cut and a hemispherical rear with half-diameter depth", () => {
  const shape = new T.Shape();
  shape.absarc(0, 0, 10, 0, 2 * Math.PI, false);
  const { geometry } = volumeGeometry(shape, {
    depth: 20,
    subdivisions: 4,
    curveSegments: 32,
    hemisphere: true,
  });
  geometry.computeBoundingBox();
  assert.ok(Math.abs(geometry.boundingBox.max.z) < 1e-6);
  assert.ok(geometry.boundingBox.min.z < -9.9);
  const p = geometry.attributes.position;
  let flat = 0,
    rear = 0;
  for (let i = 0; i < p.count; i++) {
    if (p.getZ(i) === 0) flat++;
    if (p.getZ(i) < -0.01) {
      rear++;
      assert.ok(
        Math.abs(p.getX(i) ** 2 + p.getY(i) ** 2 + p.getZ(i) ** 2 - 100) < 0.5,
      );
    }
  }
  assert.ok(flat > 100 && rear > 100);
  assert.ok(geometry.attributes.normal.array.every(Number.isFinite));
});
test("Complete cell figures receive half-ball geometry while receptors and membrane patches retain their geometry", () => {
  for (const name of [
    "B cell — receptor-free",
    "T CD8 cytotoxic",
    "Macrophage",
    "NK cell",
    "Basophil — receptor-free",
    "Eosinophil — receptor-free",
    "Leukemic blast",
  ])
    assert.equal(isHemisphereCell({ name }), true, name);
  for (const name of [
    "TCR αβ + CD3",
    "Self-cell membrane patch",
    "CD3-associated ITAM tails",
    "Cell suspension tube",
  ])
    assert.equal(isHemisphereCell({ name }), false, name);
});
