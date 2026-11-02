import test from "node:test";
import assert from "node:assert/strict";
import {
  bezier,
  arcTable,
  arcT,
  frame,
  newProject,
  curveValid,
  snapshot,
  evaluate,
  validateProject,
  validateStyle,
} from "../src/model.js";
import { parsePDB, parseCIF, centeredAtoms } from "../src/structures.js";
test("Arc-length mapping gives uniform travel on a nonuniform Bézier curve", () => {
  const points = [
      [0, 0],
      [0, 1],
      [1, 10],
      [15, 10],
    ],
    table = arcTable(points, 2000);
  let prior = bezier(points, 0);
  const lengths = [];
  for (let i = 1; i <= 30; i++) {
    const p = bezier(points, arcT(table, i / 30));
    lengths.push(Math.hypot(p[0] - prior[0], p[1] - prior[1]));
    prior = p;
  }
  assert.ok(Math.max(...lengths) / Math.min(...lengths) < 1.03);
});
test("Membrane anchors keep depth and remain normal when the curve changes", () => {
  const p = newProject(),
    item = p.items[0];
  item.depth = 2;
  const a = frame(p, item);
  p.curve[1][1] += 2;
  const b = frame(p, item);
  assert.equal(b.position[2], 2);
  assert.notDeepEqual(a.position, b.position);
  const dx = Math.cos(b.angle),
    dy = Math.sin(b.angle);
  assert.ok(Math.abs(dx * b.normal[0] + dy * b.normal[1]) < 1e-9);
});
test("Invalid folds and non-finite points are rejected", () => {
  assert.equal(
    curveValid(
      [
        [0, 0],
        [10, 0],
        [-10, 0],
        [1, 0],
      ],
      1,
    ),
    false,
  );
  assert.equal(
    curveValid(
      [
        [0, 0],
        [1, NaN],
        [2, 0],
        [3, 0],
      ],
      1,
    ),
    false,
  );
  assert.ok(curveValid(newProject().curve, 1.6));
});
test("Animation evaluates from immutable keyframes, including a full 360 degree turn", () => {
  const p = newProject(),
    a = snapshot(p);
  p.items[0].rotation = Math.PI * 2;
  p.items[0].s = 0.8;
  const b = snapshot(p);
  p.keys = [
    { time: 0, state: a },
    { time: 8, state: b },
  ];
  const mid = evaluate(p, 4);
  assert.equal(mid.items[0].rotation, Math.PI);
  assert.ok(Math.abs(mid.items[0].s - 0.52) < 1e-8);
  assert.equal(p.keys[0].state.items[0].rotation, 0);
  assert.equal(evaluate(p, 9).items[0].rotation, Math.PI * 2);
});
test("Project validates round-trip and malformed styles", () => {
  const p = newProject();
  assert.equal(validateProject(JSON.parse(JSON.stringify(p))).items.length, 4);
  assert.throws(() => validateStyle({ name: "broken" }));
  p.items[0].scale = -1;
  assert.throws(() => validateProject(p));
});
test("PDB parser converts Å to nm, keeps primary alternate and first model", () => {
  const line = (x, alt = " ") =>
    `ATOM      1  CA ${alt}ALA A   1    ` +
    x.toFixed(3).padStart(8) +
    "   2.000   3.000  1.00 20.00           C  ";
  const result = parsePDB(
    "MODEL        1\n" +
      line(10) +
      "\n" +
      line(20, "B") +
      "\nENDMDL\nMODEL        2\n" +
      line(30),
  );
  assert.equal(result.atoms.length, 1);
  assert.equal(result.atoms[0].x, 1);
});
test("mmCIF handles quoted chain IDs and centers selected chains", () => {
  const data = `data_test\nloop_\n_atom_site.group_PDB\n_atom_site.Cartn_x\n_atom_site.Cartn_y\n_atom_site.Cartn_z\n_atom_site.auth_asym_id\n_atom_site.auth_seq_id\n_atom_site.auth_atom_id\n_atom_site.type_symbol\nATOM 10 20 30 'AA' 1 CA C\nATOM 20 20 30 B 1 CA C\n#\n`;
  const parsed = parseCIF(data);
  assert.deepEqual(parsed.chains, ["AA", "B"]);
  assert.equal(parsed.atoms[0].x, 1);
  const atoms = centeredAtoms(parsed.atoms, ["AA"]);
  assert.equal(atoms.length, 1);
  assert.equal(atoms[0].x, 0);
});
