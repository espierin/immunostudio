import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bendReceptors } from "../src/receptor-spacing.js";
import {
  membraneThickness,
  fitReceptorAnchor,
  receptorAnchorProfile,
  embeddedStemProfile,
} from "../src/receptor-anchor.js";
import { anchoredPose, contourFrame } from "../src/contour2d.js";
import { syncEmbeddedReceptors } from "../src/sculpt2d.js";
import {
  sampledStemFootprint,
  sampledStemFootprints,
  receptorFootprints,
} from "../src/receptor-footprints.js";
import { cellMembraneKey } from "../src/cell-membrane2d.js";
import { newProject, validateProject } from "../src/model.js";
import { newSheet } from "../src/drawing2d.js";
const contour = {
  points: [
    [0, 0],
    [300, 0],
  ],
  closed: false,
};
const item = (id, u = 0.5) => ({
  id,
  x: 0,
  y: 0,
  w: 30,
  h: 80,
  anchor2d: {
    targetId: "cell",
    pathIndex: 7,
    u,
    offset: 0,
    pivotX: 0.5,
    pivotY: 0.8,
    side: 1,
    angle: 0,
  },
});
test("molecule bending changes tilt only and keeps the pivot on the unchanged membrane", () => {
  const receptor = item("a"),
    before = structuredClone(receptor),
    points = structuredClone(contour.points);
  bendReceptors([receptor], contour, [20, 0], {
    focus: [150, -30],
    radius: 40,
    strength: 1,
  });
  assert.ok(receptor.anchor2d.tilt > 0);
  const pose = anchoredPose(
      receptor,
      contourFrame(contour.points, 0.5, false),
      receptor.anchor2d,
    ),
    r = (pose.rotation * Math.PI) / 180,
    px = (receptor.anchor2d.pivotX - 0.5) * receptor.w,
    py = (receptor.anchor2d.pivotY - 0.5) * receptor.h;
  assert.ok(
    Math.abs(
      pose.x + receptor.w / 2 + px * Math.cos(r) - py * Math.sin(r) - 150,
    ) < 1e-8,
  );
  assert.ok(
    Math.abs(pose.y + receptor.h / 2 + px * Math.sin(r) + py * Math.cos(r)) <
      1e-8,
  );
  const { tilt, ...anchor } = receptor.anchor2d;
  assert.deepEqual({ ...receptor, anchor2d: anchor }, before);
  assert.deepEqual(contour.points, points);
});
test("bending respects locks, brush locality and tilt limits", () => {
  const locked = { ...item("locked"), locked: true },
    far = item("far", 0.99),
    near = item("near");
  for (let n = 0; n < 20; n++)
    bendReceptors([locked, far, near], contour, [100, 0], {
      focus: [150, -20],
      radius: 30,
      strength: 1,
    });
  assert.equal(locked.anchor2d.tilt, undefined);
  assert.equal(far.anchor2d.tilt, undefined);
  assert.equal(near.anchor2d.tilt, 60);
});
test("embedded proxies preserve existing tilt while updating placement and support straightening", () => {
  const anchor = {
    u: 0.1,
    initialTilt: 25,
    tilt: 25,
    proxy: item("embedded", 0.3),
  };
  anchor.proxy.anchor2d.tilt = 20;
  syncEmbeddedReceptors([anchor]);
  assert.equal(anchor.u, 0.3);
  assert.equal(anchor.tilt, 45);
  anchor.proxy.anchor2d.tilt = -25;
  syncEmbeddedReceptors([anchor]);
  assert.equal(anchor.tilt, 0);
});
test("TCR, CD4 and CD8 fit an adaptive collection cell bilayer at any contour index", () => {
  const target = {
    id: "cell",
    kind: "svg",
    name: "T-helper cell",
    w: 330,
    h: 330,
  };
  assert.equal(membraneThickness(target), 11.55);
  for (const file of [
    "basic_13_TCR_CD3_user.svg",
    "basic_150_CD4_coreceptor_four_domains.svg",
    "basic_15_CD8_coreceptor.svg",
  ]) {
    const receptor = {
      ...item(file),
      kind: "svg",
      sourceFile: file,
      svg: readFileSync(
        new URL(
          "../public/library/02_HLA_peptiden_en_receptoren/" + file,
          import.meta.url,
        ),
        "utf8",
      ),
    };
    fitReceptorAnchor(receptor, target);
    const profile = receptorAnchorProfile(receptor);
    assert.ok(Math.abs(receptor.h * profile.span - 11.55) < 1e-8);
    receptor.anchor2d.tilt = 22;
    fitReceptorAnchor(receptor, { ...target, bilayerThickness: 14 }, true);
    assert.equal(receptor.anchor2d.tilt, 22);
    assert.equal(
      receptorFootprints(target, [receptor], 7).length,
      receptorAnchorProfile(receptor).stems.length,
    );
    assert.equal(receptorFootprints(target, [receptor], 0).length, 0);
  }
  assert.equal(membraneThickness({ ...target, name: "Fibroblast" }), 11.55);
});
test("native embedded TCR, CD4 and CD8 group names resolve transmembrane geometry", () => {
  for (const name of [
    "Basis: basic_13_TCR_CD3_user.svg",
    "Basis-basic-150-CD4-coreceptor-four-domains-svg",
    "CD8 coreceptor",
  ])
    assert.ok(embeddedStemProfile(name)?.width > 0);
  assert.equal(embeddedStemProfile("Golgi cisternae"), null);
});
test("collection membrane cache invalidates labels, thickness, source geometry and receptor tilt", () => {
  const cell = { id: "cell", svg: "<svg/>", w: 330, h: 330 },
    key = cellMembraneKey(cell, {}, []);
  assert.notEqual(cellMembraneKey(cell, {}, [], false), key);
  assert.notEqual(
    cellMembraneKey({ ...cell, bilayerThickness: 14 }, {}, []),
    key,
  );
  assert.notEqual(
    cellMembraneKey({ ...cell, svg: "<svg><path/></svg>" }, {}, []),
    key,
  );
});
test("project files retain receptor tilt and reject invalid values", () => {
  const project = newProject();
  project.sheet = newSheet();
  project.sheet.items = [
    {
      id: "cell",
      kind: "ellipse",
      x: 0,
      y: 0,
      w: 300,
      h: 300,
      rotation: 0,
      opacity: 1,
      visible: true,
    },
    {
      ...item("receptor"),
      kind: "rect",
      rotation: 0,
      opacity: 1,
      visible: true,
    },
  ];
  project.sheet.items[1].anchor2d.tilt = 35;
  assert.equal(
    validateProject(structuredClone(project)).sheet.items[1].anchor2d.tilt,
    35,
  );
  project.sheet.items[1].anchor2d.tilt = 61;
  assert.throws(() => validateProject(project), /tilt/);
});

test("other receptor artwork is measured only where it crosses the membrane", () => {
  const previousPoint = globalThis.DOMPoint,
    previousStyle = globalThis.getComputedStyle;
  try {
    globalThis.DOMPoint = class {
      constructor(x, y) {
        this.x = x;
        this.y = y;
      }
      matrixTransform() {
        return this;
      }
    };
    globalThis.getComputedStyle = () => ({ strokeWidth: "2" });
    const shape = {
      getTotalLength: () => 100,
      getPointAtLength: (s) => ({ x: 10, y: s - 50 }),
      getScreenCTM: () => ({}),
    };
    const node = { querySelectorAll: () => [shape] },
      matrix = { multiply: () => ({ a: 1, b: 0 }) },
      frame = { point: [0, 0], normal: [0, 1], tangent: [1, 0] };
    assert.deepEqual(sampledStemFootprint(node, frame, matrix, 10), [
      [9, -5.5],
      [11, -5.5],
      [11, 5.5],
      [9, 5.5],
    ]);
    const other = { ...shape, getPointAtLength: (s) => ({ x: 30, y: s - 50 }) };
    const separate = sampledStemFootprints(
      { querySelectorAll: () => [shape, other] },
      frame,
      matrix,
      10,
    );
    assert.equal(separate.length, 2);
    assert.ok(separate[0].every((p) => p[0] <= 11));
    assert.ok(separate[1].every((p) => p[0] >= 29));
    globalThis.getComputedStyle = () => ({ strokeWidth: "2", fill: "none" });
    const split = {
      ...shape,
      getPointAtLength: (s) => ({
        x: s < 50 ? 10 : 30,
        y: s < 50 ? s - 25 : s - 75,
      }),
    };
    const crossings = sampledStemFootprints(
      { querySelectorAll: () => [split] },
      frame,
      matrix,
      10,
    );
    assert.equal(crossings.length, 2);
    assert.ok(crossings[0].every((p) => p[0] <= 11));
    assert.ok(crossings[1].every((p) => p[0] >= 29));
    shape.getPointAtLength = (s) => ({ x: s, y: 100 });
    assert.equal(sampledStemFootprint(node, frame, matrix, 10), null);
  } finally {
    if (previousPoint === undefined) delete globalThis.DOMPoint;
    else globalThis.DOMPoint = previousPoint;
    if (previousStyle === undefined) delete globalThis.getComputedStyle;
    else globalThis.getComputedStyle = previousStyle;
  }
});
