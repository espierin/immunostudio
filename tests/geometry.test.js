import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { StudioScene } from "../src/scene.js";
import { newProject, arcTable } from "../src/model.js";
test("Membrane geometry removes a full footprint around a channel", () => {
  const p = newProject();
  p.curve = [
    [-16, 0],
    [-5.3, 0],
    [5.3, 0],
    [16, 0],
  ];
  const channel = p.items.find((i) => i.kind === "channel");
  channel.s = 0.5;
  channel.depth = 0;
  const scene = Object.create(StudioScene.prototype);
  scene.root = new T.Group();
  scene.clip = new T.Plane();
  scene.table = arcTable(p.curve);
  scene.membrane(p);
  const surfaces = scene.membraneGroup.children.filter(
    (c) => c.isMesh && !c.isInstancedMesh && c!==scene.cap,
  );
  assert.equal(surfaces.length, 2);
  for (const m of surfaces) {
    const a = m.geometry.attributes.position;
    for (let i = 0; i < a.count; i++)
      assert.ok(
        Math.hypot(a.getX(i), a.getZ(i)) >= 1.24,
        "Surface must not cross the pore",
      );
  }
  const heads = scene.membraneGroup.children.find((c) => c.isInstancedMesh);
  const matrix = new T.Matrix4(),
    pos = new T.Vector3();
  for (let i = 0; i < heads.count; i++) {
    heads.getMatrixAt(i, matrix);
    pos.setFromMatrixPosition(matrix);
    assert.ok(Math.hypot(pos.x, pos.z) > 1.4, "No lipid heads inside lumen");
  }
});
test("Hinge gizmo origin stays at selected pivot; unselected Fab arm remains unchanged", () => {
  const scene = Object.create(StudioScene.prototype),
    item = { domain: "right", pivot: [1, 5, 0.2], hinge: 0 };
  const arm = new T.Group();
  arm.userData.side = 1;
  arm.add(new T.Group());
  scene.poseArm(arm, item);
  const before = arm.children[0].getWorldPosition(new T.Vector3());
  item.hinge = 45;
  scene.poseArm(arm, item);
  arm.updateMatrixWorld(true);
  const after = arm.children[0].getWorldPosition(new T.Vector3());
  assert.deepEqual(arm.position.toArray(), item.pivot);
  assert.ok(after.distanceTo(before) > 0.1);
  const fixed = new T.Group();
  fixed.userData.side = -1;
  fixed.add(new T.Group());
  scene.poseArm(fixed, item);
  assert.equal(fixed.rotation.z, 0);
  assert.deepEqual(fixed.position.toArray(), [0, 4.2, 0]);
});
