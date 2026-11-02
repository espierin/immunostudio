import test from "node:test";
import assert from "node:assert/strict";
import {
  newSheet,
  sheetBounds,
  alignItems,
  distributeItems,
} from "../src/drawing2d.js";
import { newProject, validateProject } from "../src/model.js";
const item = (x, y, w, h, rotation = 0) => ({
  id: crypto.randomUUID(),
  kind: "rect",
  x,
  y,
  w,
  h,
  rotation,
  opacity: 1,
  visible: true,
});
test("Rotated vector bounds include all transformed corners", () => {
  const b = sheetBounds([item(0, 0, 100, 40, 90)]);
  assert.ok(Math.abs(b.x - 30) < 1e-9);
  assert.ok(Math.abs(b.y + 30) < 1e-9);
  assert.ok(Math.abs(b.w - 40) < 1e-9);
  assert.ok(Math.abs(b.h - 100) < 1e-9);
});
test("Alignment handles rotated objects without changing their rotation", () => {
  const a = item(0, 0, 100, 40, 90),
    b = item(180, 50, 30, 30);
  alignItems([a, b], "left");
  assert.ok(Math.abs(sheetBounds([a]).x - sheetBounds([b]).x) < 1e-8);
  assert.equal(a.rotation, 90);
});
test("Distribution uses equal gaps while preserving endpoint positions", () => {
  const items = [item(0, 0, 20, 20), item(40, 0, 30, 20), item(150, 0, 50, 20)];
  distributeItems(items, "x");
  assert.equal(items[0].x, 0);
  assert.equal(items[2].x, 150);
  assert.equal(items[1].x - 20, 150 - (items[1].x + 30));
});
test("2D and 3D state coexist and survive a project round trip", () => {
  const p = newProject({ demo: true });
  p.editorMode = "2d";
  p.sheet = newSheet();
  p.sheet.items = [item(20, 30, 100, 60)];
  const loaded = validateProject(JSON.parse(JSON.stringify(p)));
  assert.equal(loaded.items.length, 4);
  assert.equal(loaded.sheet.items.length, 1);
  assert.equal(loaded.editorMode, "2d");
  loaded.sheet.items[0].w = -5;
  assert.throws(() => validateProject(loaded));
});
