import test from "node:test";
import assert from "node:assert/strict";
import { membraneLeaflets, membraneMarkup } from "../src/membrane2d.js";
import { shapeMembrane } from "../src/shape-membrane.js";
const circle = shapeMembrane({ kind: "ellipse", w: 240, h: 240 });
circle.bilayerThickness = 34;
const gaps = (lipids, closed) =>
  lipids.slice(closed ? 0 : 1).map((p, i) => {
    const previous =
      lipids[closed ? (i + lipids.length - 1) % lipids.length : i];
    return Math.hypot(
      p.center[0] - previous.center[0],
      p.center[1] - previous.center[1],
    );
  });
test("outer and inner circular leaflets use independent counts and nearly touching heads", () => {
  const { leaflets, radius } = membraneLeaflets(circle),
    [outer, inner] = leaflets;
  assert.ok(outer.length > inner.length);
  assert.ok(outer.lipids.length > inner.lipids.length);
  for (const row of leaflets) {
    const distances = gaps(row.lipids, true),
      mean = distances.reduce((a, b) => a + b, 0) / distances.length;
    assert.ok(Math.max(...distances) - Math.min(...distances) < 0.03);
    assert.ok(mean <= 2 * radius + 1.1);
    assert.ok(mean >= 2 * radius * 0.9);
    assert.ok(Math.min(...distances) > 1); // No duplicate head at the closed seam.
  }
});
test("open straight membrane fills both ends; reversing its direction swaps the curved leaflet lengths", () => {
  const straight = {
    w: 600,
    h: 120,
    curve: [
      [0, 0.5],
      [0.33, 0.5],
      [0.67, 0.5],
      [1, 0.5],
    ],
    bilayerThickness: 34,
  };
  const result = membraneLeaflets(straight);
  assert.equal(
    result.leaflets[0].lipids.length,
    result.leaflets[1].lipids.length,
  );
  for (const { lipids } of result.leaflets) {
    assert.equal(lipids[0].t, 0);
    assert.equal(lipids.at(-1).t, 1);
    assert.ok(Math.max(...gaps(lipids, false)) <= 17.1 + 0.01);
  }
  const reversed = { ...circle, curve: [...circle.curve].reverse() },
    a = membraneLeaflets(circle),
    b = membraneLeaflets(reversed);
  assert.ok(Math.abs(a.leaflets[0].length - b.leaflets[1].length) < 0.001);
});
test("S-bends distribute both leaflets along their own edges, with normal tails and finite SVG", () => {
  const item = {
      w: 600,
      h: 220,
      curve: [
        [0, 0.5],
        [0.32, -0.4],
        [0.67, 1.4],
        [1, 0.5],
      ],
      bilayerThickness: 34,
    },
    result = membraneLeaflets(item);
  assert.notDeepEqual(
    result.leaflets[0].lipids.map((p) => p.t),
    result.leaflets[1].lipids.map((p) => p.t),
  );
  for (const { lipids } of result.leaflets)
    for (const p of lipids) {
      assert.ok(p.center.every(Number.isFinite));
      assert.ok(
        Math.abs(p.normal[0] * p.tangent[0] + p.normal[1] * p.tangent[1]) <
          1e-12,
      );
    }
  const svg = membraneMarkup(item, { head: "#BBDDEE", tail: "#DDAA77" });
  assert.equal(
    [...svg.matchAll(/data-lipid-side=/g)].length,
    result.leaflets.reduce((n, row) => n + row.lipids.length, 0),
  );
  assert.doesNotMatch(svg, /NaN|Infinity/);
});
