import test from "node:test";
import assert from "node:assert/strict";
import { newProject, removeLegacyStarter, makeItem } from "../src/model.js";
test("A new 2D project contains no hidden 3D examples", () => {
  const p = newProject();
  assert.equal(p.editorMode, "2d");
  assert.deepEqual(p.items, []);
});
test("Legacy migration removes only the untouched starter and retains added objects", () => {
  const p = newProject({ demo: true });
  delete p.starterSceneVersion;
  const own = makeItem("igg", { name: "Mijn antistof", x: 10 });
  p.items.push(own);
  assert.equal(removeLegacyStarter(p), 4);
  assert.deepEqual(p.items, [own]);
  assert.equal(removeLegacyStarter(p), 0);
});
test("Legacy migration preserves edited or animated examples and deliberately added models", () => {
  const edited = newProject({ demo: true });
  delete edited.starterSceneVersion;
  edited.items[0].name = "Mijn HLA";
  assert.equal(removeLegacyStarter(edited), 0);
  assert.equal(edited.items.length, 4);
  const animated = newProject({ demo: true });
  delete animated.starterSceneVersion;
  animated.keys = [{ time: 0 }];
  assert.equal(removeLegacyStarter(animated), 0);
  assert.equal(animated.items.length, 4);
  const fresh = newProject();
  fresh.items.push(makeItem("hla"));
  assert.equal(removeLegacyStarter(fresh), 0);
  assert.equal(fresh.items.length, 1);
});
