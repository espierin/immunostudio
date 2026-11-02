import test from "node:test";
import assert from "node:assert/strict";
import { newProject, validateProject } from "../src/model.js";
import { Drawing2D, newSheet } from "../src/drawing2d.js";
import {
  sculptContour,
  contourFrame,
  nearestContour,
  anchoredPose,
  offsetContour,
  smoothContour,
  simplifyContour,
  validContour,
  contourCommands,
} from "../src/contour2d.js";
const circle = (n = 64) =>
  Array.from({ length: n }, (_, i) => [
    100 * Math.cos((i / n) * Math.PI * 2),
    100 * Math.sin((i / n) * Math.PI * 2),
  ]);
test("sculpt brush has a bounded local influence and leaves the opposite membrane unchanged", () => {
  const original = circle(),
    deformed = sculptContour(original, [100, 0], [-40, 10], {
      radius: 70,
      strength: 1,
    });
  assert.deepEqual(original[0], [100, 0]);
  assert.deepEqual(deformed[0], [60, 10]);
  assert.deepEqual(deformed[32], original[32]);
  assert.ok(validContour(deformed));
  assert.deepEqual(
    sculptContour(original, [100, 0], [-40, 10], {
      radius: 70,
      strength: 1,
      invert: true,
    })[0],
    [140, -10],
  );
});

test("sculpt metadata and membrane bindings survive project serialization; bad bindings are rejected", () => {
  const p = newProject();
  p.sheet = newSheet();
  const base = {
    x: 0,
    y: 0,
    w: 100,
    h: 100,
    rotation: 0,
    opacity: 1,
    visible: true,
  };
  p.sheet.items = [
    {
      ...base,
      id: "host",
      kind: "ellipse",
      contourEdit: { pathIndex: 0, points: circle(), closed: true },
    },
    {
      ...base,
      id: "receptor",
      kind: "rect",
      anchor2d: {
        targetId: "host",
        pathIndex: 0,
        u: 0.2,
        side: 1,
        offset: 3,
        pivotX: 0.5,
        pivotY: 0.8,
        angle: 0,
      },
    },
  ];
  const loaded = validateProject(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(loaded.sheet.items[1].anchor2d, p.sheet.items[1].anchor2d);
  loaded.sheet.items[1].anchor2d.u = NaN;
  assert.throws(() => validateProject(loaded), /anchor/);
});
test("SVG export preserves mirror transforms and excludes floating tools or sculpt cursor", () => {
  const doc = {
    width: 100,
    height: 100,
    background: "#ffffff",
    items: [
      {
        id: "x",
        x: 0,
        y: 0,
        w: 50,
        h: 40,
        rotation: 0,
        opacity: 1,
        visible: true,
        mirrorX: true,
      },
    ],
  };
  const svg = Drawing2D.prototype.exportSVG.call({
    doc,
    itemMarkup: () => '<path d="M0 0L40 40"/>',
  });
  assert.match(svg, /scale\(-1 1\)/);
  assert.doesNotMatch(svg, /floating|sculpt-guide/);
});
test("attached molecule follows a deformed contour and remains perpendicular at its actual anchor pivot", () => {
  const p = sculptContour(circle(), [100, 0], [-35, 20], {
      radius: 80,
      strength: 1,
    }),
    frame = contourFrame(p, 0.04),
    item = { w: 40, h: 80 },
    anchor = { side: 1, offset: 7, pivotX: 0.5, pivotY: 0.8 },
    pose = anchoredPose(item, frame, anchor),
    r = (pose.rotation * Math.PI) / 180;
  const axis = [Math.sin(r), -Math.cos(r)];
  assert.ok(
    Math.abs(axis[0] * frame.tangent[0] + axis[1] * frame.tangent[1]) < 1e-10,
  );
  const pivot = [
    pose.x + 20 - 24 * Math.sin(r),
    pose.y + 40 + 24 * Math.cos(r),
  ];
  pivot.forEach((v, i) =>
    assert.ok(Math.abs(v - frame.point[i] - frame.normal[i] * 7) < 1e-8),
  );
  const reverse = anchoredPose(item, frame, { ...anchor, side: -1 });
  assert.ok(Math.abs(Math.abs(reverse.rotation - pose.rotation) - 180) < 1e-8);
});
test("inset and outset use contour normals consistently for either winding", () => {
  for (const p of [circle(), circle().reverse()]) {
    const out = offsetContour(p, 10),
      inside = offsetContour(p, -10);
    assert.ok(out.every((v) => Math.abs(Math.hypot(...v) - 110) < 1e-5));
    assert.ok(inside.every((v) => Math.abs(Math.hypot(...v) - 90) < 1e-5));
  }
});
test("simplify reduces points within tolerance and smooth keeps open ends fixed", () => {
  const p = circle(128),
    simple = simplifyContour(p, 2);
  assert.ok(simple.length < 40 && simple.length >= 4);
  assert.ok(validContour(simple));
  for (const v of p) assert.ok(nearestContour(simple, v).distance < 2.5);
  const open = [
      [0, 0],
      [10, 12],
      [20, -2],
      [30, 0],
    ],
    smooth = smoothContour(open, 0.5, false);
  assert.deepEqual(smooth[0], open[0]);
  assert.deepEqual(smooth.at(-1), open.at(-1));
  assert.notDeepEqual(smooth[1], open[1]);
});
test("self-crossing contours are rejected and bilayers stay within their segment limit", () => {
  assert.equal(
    validContour([
      [0, 0],
      [50, 50],
      [0, 50],
      [50, 0],
    ]),
    false,
  );
  const p = circle(28),
    commands = contourCommands(p, true);
  assert.equal(commands.filter((c) => c.type === "C").length, 28);
  assert.equal(
    commands
      .filter((c) => c.type !== "Z")
      .reduce((n, c) => n + c.values.length / 2, 0),
    85,
  );
});
