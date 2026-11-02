import test from "node:test";
import assert from "node:assert/strict";
import { newProject, snapshot, evaluate, presetOrder } from "../src/model.js";
import {
  addTimelineKey,
  framePlan,
  createCameraAction,
} from "../src/animation.js";
import { parsePath, splitPathSegment } from "../src/vector-nodes.js";
import { shapeMembrane } from "../src/shape-membrane.js";
import { isHemisphereCell } from "../src/cell-look.js";
import { JSDOM } from "jsdom";
import {
  updateVectorPath,
  elementPath,
  vectorElements,
} from "../src/vector-nodes.js";
import { vesicleModel } from "../src/vesicle3d.js";
import { sheetToVolume } from "../src/basis-variants.js";

test("new projects are empty, with explicit membrane and ordered default palette", () => {
  const p = newProject();
  assert.equal(p.membraneEnabled, false);
  assert.equal(p.items.length, 0);
  assert.equal(p.style.name, "Default");
  assert.deepEqual(presetOrder, [
    "basis",
    "umcu",
    "nordicLight",
    "nordicDark",
    "efi",
    "light",
    "dark",
  ]);
});
test("object keyframes interpolate independently of camera keys and preserve source atoms", () => {
  const p = newProject({ demo: true }),
    item = p.items[0];
  item.atoms = [{ x: 1 }];
  item.x = 0;
  addTimelineKey(p, 0, snapshot(p), "selected", item.id);
  item.x = 8;
  addTimelineKey(p, 4, snapshot(p), "selected", item.id);
  p.camera.zoom = 1;
  addTimelineKey(p, 0, snapshot(p), "camera");
  p.camera.zoom = 3;
  addTimelineKey(p, 2, snapshot(p), "camera");
  const out = evaluate(p, 1);
  assert.equal(out.items[0].x, 1.25);
  assert.equal(out.camera.zoom, 2);
  assert.equal(out.items[0].atoms, item.atoms);
  assert.equal(item.x, 8);
  p.keys.filter((k) => k.scope === "selected")[0].interpolation = "constant";
  assert.equal(evaluate(p, 3).items[0].x, 0);
});
test("frame range and orbit share render timing; invalid output is rejected", () => {
  const p = newProject();
  p.animation = { fps: 25, startFrame: 26, endFrame: 76, frameStep: 2 };
  const plan = framePlan(p);
  assert.equal(plan.frames.length, 26);
  assert.deepEqual(plan.frames[0], { frame: 26, time: 1 });
  assert.deepEqual(plan.frames.at(-1), { frame: 76, time: 3 });
  createCameraAction(p, snapshot(p), "orbit");
  assert.equal(p.keys.length, 33);
  assert.equal(p.keys[0].time, 1);
  const a = evaluate(p, 1).camera.position,
    b = evaluate(p, 3).camera.position;
  a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-8));
  assert.throws(() => framePlan(p, { frameStep: 0 }));
  assert.throws(() => framePlan(p, { fps: 0 }));
});
test("SVG shorthand expands without changing coordinates and Bézier splits retain midpoint", () => {
  const c = parsePath("m1 2h3v4c0 2 2 2 2 0s2 -2 2 0z");
  assert.deepEqual(c[2], { type: "L", values: [4, 6] });
  assert.deepEqual(c[4], { type: "C", values: [6, 4, 8, 4, 8, 6] });
  const split = splitPathSegment(parsePath("M0 0C0 8 8 8 8 0"), 1);
  assert.deepEqual(split[1].values.slice(-2), [4, 6]);
  assert.deepEqual(split[2].values.slice(-2), [8, 0]);
});
test("ellipse becomes a closed four-segment membrane and open line remains open", () => {
  const e = shapeMembrane({ kind: "ellipse", w: 200, h: 100 });
  assert.equal(e.closed, true);
  assert.equal(e.curve.length, 13);
  assert.deepEqual(e.curve[0], e.curve.at(-1));
  assert.ok(e.curve.flat().every(Number.isFinite));
  assert.equal(shapeMembrane({ kind: "line", w: 200, h: 10 }).closed, false);
  assert.equal(isHemisphereCell({ name: "T-cell receptor" }), false);
});

test("editing one SVG part preserves sibling geometry and original transforms", () => {
  const dom = new JSDOM();
  globalThis.DOMParser = dom.window.DOMParser;
  globalThis.XMLSerializer = dom.window.XMLSerializer;
  const source =
    '<svg xmlns="http://www.w3.org/2000/svg"><g transform="translate(10 20)"><circle cx="5" cy="6" r="3" fill="#123456"/><path id="untouched" d="M0 0L5 5"/></g></svg>';
  const doc = new DOMParser().parseFromString(source, "image/svg+xml");
  const commands = elementPath(vectorElements(doc)[0]);
  commands[0].values[0] += 2;
  const updated = new DOMParser().parseFromString(
    updateVectorPath(source, 0, commands),
    "image/svg+xml",
  );
  assert.equal(
    updated.querySelector("g").getAttribute("transform"),
    "translate(10 20)",
  );
  assert.equal(
    updated.querySelector("#untouched").getAttribute("d"),
    "M0 0L5 5",
  );
  assert.equal(updated.querySelector("path").getAttribute("fill"), "#123456");
  assert.equal(doc.querySelector("circle").getAttribute("cx"), "5");
  dom.window.close();
});
test("closed membrane creates two hollow 3D shells with lipids confined to the rim", () => {
  const membrane = shapeMembrane({
    id: "ellipse-1",
    kind: "ellipse",
    x: 0,
    y: 0,
    w: 200,
    h: 100,
  });
  const item = sheetToVolume(membrane, { width: 1600, height: 900 });
  assert.equal(item.kind, "vesicle");
  assert.equal(item.radiusX / item.radiusY, 2);
  const group = vesicleModel(item, newProject().style);
  assert.equal(group.children.length, 4);
  for (const shell of group.children.slice(0, 2)) {
    const pos = shell.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      assert.ok(
        Math.abs(Math.hypot(pos.getX(i), pos.getY(i), pos.getZ(i)) - 1) < 1e-6,
      );
      assert.ok(pos.getZ(i) <= 1e-6);
    }
  }
  assert.equal(group.children[2].count, 192);
  assert.equal(group.children[3].count, 192);
  group.traverse((o) => {
    o.geometry?.dispose();
    o.material?.dispose();
  });
});
