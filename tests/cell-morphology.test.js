import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { cellMorphology } from "../src/cell-morphology.js";
import { cellHemisphereGeometry } from "../src/cell-geometry.js";
import { isHemisphereCell } from "../src/cell-look.js";

test("cell profiles separate disc, stellate, elongated, phagocyte and lymphocyte types", () => {
  for (const [name, type] of [
    ["Biconcave erythrocyte", "erythrocyte"],
    ["Platelet", "platelet"],
    ["Dendritic cell", "dendritic"],
    ["Macrophage", "macrophage"],
    ["Cardiomyocyte HLA", "cardiomyocyte"],
    ["Plasma cell", "plasma"],
    ["Neutrophil", "granulocyte"],
    ["B cell", "lymphocyte"],
  ])
    assert.equal(cellMorphology({ name }).type, type);
  assert.equal(isHemisphereCell({ name: "Cardiomyocyte HLA" }), true);
  assert.equal(
    isHemisphereCell({
      name: "Apoptotic graft target cell",
      sourceFile: "10_Laboratorium_en_context/basic_11_injured_target.svg",
    }),
    true,
  );
  assert.equal(isHemisphereCell({ name: "Cell suspension tube" }), false);
});
test("disc cells are flattened and erythrocytes have a rear central depression", () => {
  const shape = new T.Shape();
  shape.absarc(0, 0, 10, 0, 2 * Math.PI, false);
  const { geometry } = cellHemisphereGeometry(
    shape,
    20,
    24,
    cellMorphology({ name: "erythrocyte" }),
  );
  const p = geometry.attributes.position;
  let centre = 0,
    ring = 0;
  for (let i = 0; i < p.count; i++) {
    const r = Math.hypot(p.getX(i), p.getY(i));
    if (r < 0.1) centre = Math.max(centre, -p.getZ(i));
    if (r > 5 && r < 9) ring = Math.max(ring, -p.getZ(i));
  }
  assert.ok(centre > 0 && ring > centre * 1.5);
  geometry.computeBoundingBox();
  assert.ok(geometry.boundingBox.min.z > -4);
  assert.ok(geometry.attributes.normal.array.every(Number.isFinite));
  geometry.dispose();
});
test("concave processes stay inside their original footprint at every depth", () => {
  // L-shaped body is not star-shaped about the centre of its bounding box.
  const shape = new T.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(10, 0);
  shape.lineTo(10, 3);
  shape.lineTo(3, 3);
  shape.lineTo(3, 10);
  shape.lineTo(0, 10);
  shape.closePath();
  const { geometry } = cellHemisphereGeometry(
    shape,
    10,
    24,
    cellMorphology({ name: "dendritic cell" }),
  );
  const p = geometry.attributes.position;
  let rear = 0;
  for (let i = 0; i < p.count; i++) {
    assert.ok(
      p.getX(i) <= 3.00001 || p.getY(i) <= 3.00001,
      "must not fill the concave notch",
    );
    if (p.getZ(i) < -0.01) rear++;
    assert.ok(p.getZ(i) <= 1e-6, "front remains a flat cut");
  }
  assert.ok(rear > 100);
  assert.ok(geometry.attributes.normal.array.every(Number.isFinite));
  geometry.dispose();
});
