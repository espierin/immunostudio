import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  receptorFootprints,
  polygonsOverlap,
  subtractFootprint,
} from "../src/receptor-footprints.js";
import { fitReceptorAnchor } from "../src/receptor-anchor.js";
import { membraneMarkup } from "../src/membrane2d.js";
import { createCurveAppearanceCache } from "../src/curve-appearance2d.js";
import { anchoredPose, contourFrame, sculptContour } from "../src/contour2d.js";
import {
  spreadReceptors,
  receptorOverlapCount,
} from "../src/receptor-spacing.js";
const svg = readFileSync(
  new URL(
    "../public/library/02_HLA_peptiden_en_receptoren/immunostudio_CCR5.svg",
    import.meta.url,
  ),
  "utf8",
);
const membrane = () => ({
  id: "m",
  kind: "membrane",
  x: 0,
  y: 0,
  w: 600,
  h: 120,
  rotation: 0,
  bilayerThickness: 34,
  curve: [
    [0, 0.5],
    [1 / 3, 0.5],
    [2 / 3, 0.5],
    [1, 0.5],
  ],
});
function attached(target) {
  const item = {
    id: "r",
    svg,
    x: 0,
    y: 0,
    w: 240,
    h: 140,
    rotation: 0,
    anchor2d: { targetId: target.id, pathIndex: 0, u: 0.5, side: 1, offset: 0 },
  };
  fitReceptorAnchor(item, target);
  Object.assign(
    item,
    anchoredPose(
      item,
      contourFrame(
        [
          [0, 60],
          [600, 60],
        ],
        0.5,
        false,
      ),
      item.anchor2d,
    ),
  );
  return item;
}
const area = (p) =>
  Math.abs(
    p.reduce((sum, a, n) => {
      const b = p[(n + 1) % p.length];
      return sum + a[0] * b[1] - b[0] * a[1];
    }, 0) / 2,
  );
test("CCR5 removes both leaflet lipids and cuts the core at its full seven-helix footprint", () => {
  const target = membrane(),
    item = attached(target),
    footprints = receptorFootprints(target, [item]);
  assert.equal(footprints.length, 1);
  const xs = footprints[0].map((p) => p[0]);
  assert.ok(Math.max(...xs) - Math.min(...xs) > 60);
  const plain = membraneMarkup(target, {}),
    cut = membraneMarkup(target, {}, footprints);
  assert.ok(
    (cut.match(/data-lipid-side/g) || []).length <
      (plain.match(/data-lipid-side/g) || []).length,
  );
  for (const match of cut.matchAll(/data-lipid-side="([^"]+)" cx="([^"]+)"/g))
    assert.ok(+match[2] < Math.min(...xs) || +match[2] > Math.max(...xs));
  assert.match(cut, /data-membrane-core/);
  assert.doesNotMatch(cut, /mask|clipPath|NaN|Infinity/);
  assert.deepEqual(
    receptorFootprints(target, [{ ...item, visible: false }]),
    [],
  );
  assert.deepEqual(
    receptorFootprints(target, [{ ...item, anchor2d: undefined }]),
    [],
  );
});
test("footprints follow shared transforms and mirrored membranes without a fixed blank patch", () => {
  const target = membrane(),
    item = attached(target),
    original = receptorFootprints(target, [item])[0];
  target.x = 80;
  target.y = -20;
  item.x += 80;
  item.y -= 20;
  assert.deepEqual(receptorFootprints(target, [item])[0], original);
  target.mirrorX = true;
  const mirrored = receptorFootprints(target, [item])[0];
  original.forEach((p, n) => assert.deepEqual(mirrored[n], [600 - p[0], p[1]]));
  item.anchor2d.offset = 100;
  item.y += 100;
  assert.equal(
    polygonsOverlap(
      [
        [0, 43],
        [600, 43],
        [600, 77],
        [0, 77],
      ],
      receptorFootprints(target, [item])[0],
    ),
    false,
  );
});
test("plain vector subtraction removes the union of overlapping receptor footprints", () => {
  const square = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ],
    a = [
      [2, -1],
      [6, -1],
      [6, 11],
      [2, 11],
    ],
    b = [
      [4, -1],
      [8, -1],
      [8, 11],
      [4, 11],
    ];
  let pieces = subtractFootprint(square, a);
  assert.equal(
    pieces.reduce((s, p) => s + area(p), 0),
    60,
  );
  pieces = pieces.flatMap((p) => subtractFootprint(p, b));
  assert.equal(
    pieces.reduce((s, p) => s + area(p), 0),
    40,
  );
  assert.deepEqual(
    subtractFootprint(square, [
      [-1, -1],
      [11, -1],
      [11, 11],
      [-1, 11],
    ]),
    [],
  );
  assert.equal(
    subtractFootprint(square, [...a].reverse()).reduce(
      (s, p) => s + area(p),
      0,
    ),
    60,
  );
});
test("membrane artwork cache invalidates when a receptor moves or is detached", () => {
  let renders = 0;
  const render = createCurveAppearanceCache((item, style, footprints) => {
    renders++;
    return JSON.stringify(footprints);
  });
  const target = membrane(),
    item = attached(target);
  const first = render(target, {}, receptorFootprints(target, [item]));
  render(target, {}, receptorFootprints(target, [item]));
  assert.equal(renders, 1);
  item.x += 60;
  assert.notEqual(
    render(target, {}, receptorFootprints(target, [item])),
    first,
  );
  assert.equal(renders, 2);
  render(target, {}, []);
  assert.equal(renders, 3);
});
test("repeated membrane sculpt steps can space receptors without modifying their stems or contour", () => {
  const initial = Array.from({ length: 48 }, (_, n) => [
    150 * Math.cos((n * Math.PI) / 24),
    150 * Math.sin((n * Math.PI) / 24),
  ]);
  const items = Array.from({ length: 4 }, (_, n) => ({
    id: String(n),
    w: 30,
    h: 90,
    anchor2d: {
      targetId: "m",
      pathIndex: 0,
      u: 0.1 + n * 0.018,
      pivotX: 0.5,
      pivotY: 0.8,
      side: 1,
    },
  }));
  items[0].locked = true;
  const locked = items[0].anchor2d.u;
  for (let step = 1; step <= 8; step++) {
    const points = sculptContour(initial, [120, 90], [-step * 7, -step * 3], {
      radius: 110,
      strength: 0.7,
      closed: true,
    });
    const before = structuredClone(points);
    spreadReceptors(items, { points, closed: true }, { iterations: 64 });
    assert.deepEqual(points, before);
    assert.equal(items[0].anchor2d.u, locked);
    assert.equal(receptorOverlapCount(items, { points, closed: true }), 0);
    for (const item of items) {
      assert.equal(item.w, 30);
      assert.equal(item.h, 90);
      assert.equal(item.anchor2d.targetId, "m");
    }
  }
});
