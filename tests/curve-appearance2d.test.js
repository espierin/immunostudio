import test from "node:test";
import { newSheet } from "../src/drawing2d.js";
import assert from "node:assert/strict";
import {
  curveAppearanceMarkup,
  tissueMarkup,
  curvePath,
  moveCurveControl,
} from "../src/curve-appearance2d.js";
import { shapeMembrane } from "../src/shape-membrane.js";
import {
  interiorWeights,
  deformInteriorPoint,
  sculptContour,
} from "../src/contour2d.js";
import { newProject, validateProject } from "../src/model.js";
const style = {
  head: "#BBDDEE",
  tail: "#DDAA77",
  outline: "#2167AE",
  core: "#EDF6FA",
  receptor: "#5599CC",
};
const curve = {
  id: "ribbon",
  kind: "membrane",
  x: 0,
  y: 0,
  w: 400,
  h: 150,
  rotation: 0,
  opacity: 1,
  curve: [
    [0, 0.5],
    [0.3, 0.5],
    [0.7, 0.5],
    [1, 0.5],
  ],
  fill: "#BBDDEE",
};
test("curve construction separates fill from line, membrane and tissue decoration", () => {
  for (const lineStyle of [
    "line",
    "membrane",
    "endothelium",
    "skin",
    "intestine",
  ]) {
    const item = { ...curve, lineStyle, fillEnabled: false };
    assert.match(
      curveAppearanceMarkup(item, style),
      /data-curve-fill[^>]*fill="none"/,
    );
    assert.match(
      curveAppearanceMarkup({ ...item, fillEnabled: true }, style),
      /data-curve-fill[^>]*fill="#BBDDEE"/,
    );
  }
  assert.doesNotMatch(
    curveAppearanceMarkup({ ...curve, lineStyle: "line" }, style),
    /ellipse|data-layer-cell/,
  );
  assert.match(curveAppearanceMarkup(curve, style), /ellipse/); // Legacy membrane stays a bilayer.
});
test("all tissue walls and nuclei rebuild on the Bézier geometry, with distinct tissue layers", () => {
  for (const lineStyle of ["endothelium", "skin", "intestine"]) {
    const flat = tissueMarkup({ ...curve, lineStyle }, style),
      bent = tissueMarkup(
        {
          ...curve,
          lineStyle,
          curve: [
            [0, 0.5],
            [0.3, 1],
            [0.7, 1],
            [1, 0.5],
          ],
        },
        style,
      );
    assert.notEqual(flat, bent);
    assert.match(flat, /data-layer-nucleus/);
    assert.doesNotMatch(bent, /NaN|Infinity/);
    const rows = new Set(
      [...flat.matchAll(/data-layer-cell="(\d)-/g)].map((m) => m[1]),
    );
    assert.equal(rows.size, lineStyle === "skin" ? 3 : 1);
    assert.notEqual(
      flat,
      tissueMarkup({ ...curve, lineStyle, layerSide: -1 }, style),
    );
  }
});
test("fill and tissue choices preserve source curve geometry and serialize in projects", () => {
  const item = shapeMembrane({
      ...curve,
      kind: "path",
      path: "M0 60C100 0 250 140 400 60",
    }),
    before = curvePath(item);
  item.lineStyle = "intestine";
  item.layerThickness = 90;
  item.cellWidth = 38;
  item.layerSide = -1;
  item.fillEnabled = false;
  const p = newProject();
  p.sheet = newSheet();
  p.sheet.items = [item];
  const restored = validateProject(JSON.parse(JSON.stringify(p))).sheet
    .items[0];
  assert.equal(curvePath(restored), before);
  assert.equal(restored.lineStyle, "intestine");
  p.sheet.items[0].cellWidth = NaN;
  assert.throws(() => validateProject(p), /tissue dimensions/);
});
test("closed-cell cage moves deep organelles and reproduces affine deformations exactly", () => {
  const before = [
      [0, 0],
      [200, 0],
      [200, 200],
      [0, 200],
    ],
    point = [90, 100],
    weights = interiorWeights(before, point);
  assert.ok(Math.abs(weights.reduce((a, b) => a + b, 0) - 1) < 1e-12);
  const after = before.map(([x, y]) => [x * 1.2 + 20, y * 0.8 - 10]);
  const moved = deformInteriorPoint(point, before, after, true);
  assert.ok(Math.abs(moved[0] - 128) < 1e-8);
  assert.ok(Math.abs(moved[1] - 70) < 1e-8);
  assert.deepEqual(
    deformInteriorPoint([-30, 100], before, after, true),
    [-30, 100],
  );
  const sculpted = sculptContour(before, [200, 0], [-35, 15], {
    radius: 70,
    strength: 1,
  });
  assert.notDeepEqual(
    deformInteriorPoint(point, before, sculpted, true),
    point,
  );
});
test("interior deformation stays finite on a concave outline and moves with an open membrane", () => {
  const before = [
      [0, 0],
      [100, 0],
      [100, 40],
      [40, 40],
      [40, 100],
      [0, 100],
    ],
    after = before.map(([x, y]) => [x + 12, y - 7]);
  const p = deformInteriorPoint([20, 60], before, after, true);
  assert.ok(Math.abs(p[0] - 32) < 1e-7 && Math.abs(p[1] - 53) < 1e-7);
  assert.deepEqual(interiorWeights(before, [100, 40]), [0, 0, 1, 0, 0, 0]);
  const moved = deformInteriorPoint(
    [50, 10],
    [
      [0, 0],
      [50, 0],
      [100, 0],
    ],
    [
      [0, 20],
      [50, 20],
      [100, 20],
    ],
    false,
    100,
  );
  assert.ok(moved[1] > 25 && moved.every(Number.isFinite));
});

test("B�zier controls extend beyond the initial line box and closed seams stay joined", () => {
  const open = moveCurveControl(curve, 1, [0.3, -2]);
  assert.deepEqual(open[1], [0.3, -2]);
  assert.deepEqual(curve.curve[1], [0.3, 0.5]);
  const loop = shapeMembrane({ ...curve, kind: "ellipse" }),
    last = loop.curve.length - 1,
    moved = moveCurveControl(loop, last, [1.2, 0.65]);
  assert.deepEqual(moved[0], moved[last]);
  assert.notDeepEqual(moved[1], loop.curve[1]);
  assert.notDeepEqual(moved[last - 1], loop.curve[last - 1]);
});
