import test from "node:test";
import assert from "node:assert/strict";
import {
  newProject,
  effectiveDepth,
  frame,
  snapshot,
  evaluate,
} from "../src/model.js";
test("Four depth levels keep index and membrane anchor after depth changes", () => {
  const p = newProject(),
    i = p.items[0];
  i.level = 2;
  const a = frame(p, i);
  p.depth = 20;
  const b = frame(p, i);
  assert.equal(i.level, 2);
  assert.equal(a.position[0], b.position[0]);
  assert.equal(a.position[1], b.position[1]);
  assert.notEqual(a.position[2], b.position[2]);
  const levels = [0, 1, 2, 3].map((level) =>
    effectiveDepth(p, { ...i, level }),
  );
  assert.equal(new Set(levels).size, 4);
  assert.ok(levels[0] > levels[3]);
});
test("Transitions between depth levels interpolate physical coordinates", () => {
  const p = newProject(),
    i = p.items[0];
  i.level = 0;
  const a = snapshot(p);
  i.level = 3;
  const b = snapshot(p);
  p.keys = [
    { time: 0, state: a },
    { time: 8, state: b },
  ];
  const mid = evaluate(p, 4).items[0];
  assert.equal(mid.level, null);
  assert.ok(Math.abs(mid.depth) < 1e-9);
});
test("Follow-me moves the camera by the animated anchor displacement", () => {
  const p = newProject(),
    i = p.items[0];
  p.camera.anchorId = i.id;
  p.camera.mode = "follow";
  p.camera.target = frame(p, i).position;
  const initial = p.camera.position.map((x, k) => x - p.camera.target[k]);
  const a = snapshot(p);
  i.s = 0.8;
  const b = snapshot(p);
  p.keys = [
    { time: 0, state: a },
    { time: 8, state: b },
  ];
  const mid = evaluate(p, 4);
  const pos = frame(mid, mid.items[0]).position;
  assert.deepEqual(mid.camera.target, pos);
  const offset = mid.camera.position.map((x, k) => x - pos[k]);
  offset.forEach((x, k) => assert.ok(Math.abs(x - initial[k]) < 1e-9));
});
