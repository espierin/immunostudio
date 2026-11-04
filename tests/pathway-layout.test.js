import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { importGPML, improvePathwayDrawing } from "../src/pathway-import.js";
import {
  syncPathwayConnections,
  connectionPort,
  itemBounds,
  overlaps,
  segmentHitsBox,
  makeConnection,
  simplifyRoute,
} from "../src/pathway-layout.js";
import { Drawing2D, newSheet } from "../src/drawing2d.js";
import { newProject, validateProject } from "../src/model.js";
import { makePathwayItem } from "../src/pathway-elements.js";
import { parsePath } from "../src/vector-nodes.js";
const dom = new JSDOM("");
Object.assign(globalThis, {
  DOMParser: dom.window.DOMParser,
  XMLSerializer: dom.window.XMLSerializer,
});
const row = { source: "WikiPathways", id: "WP-test", name: "Layout test" };
const dataNode = (id, label, x, y) =>
  `<DataNode GraphId="${id}" TextLabel="${label}" Type="Protein"><Graphics CenterX="${x}" CenterY="${y}" Width="40" Height="20"/></DataNode>`;
const fixture = `<Pathway>${[
  ["a", "T-helper", 100, 100],
  ["b", "Fibroblasts", 180, 100],
  ["c", "Endothelial Cells", 180, 150],
  ["d", "IL2", 100, 150],
  ["e", "CXCL8", 130, 150],
  ["f", "CCR7", 160, 150],
]
  .map((a) => dataNode(...a))
  .join(
    "",
  )}<Interaction GraphId="edge1"><Graphics><Point X="100" Y="110" GraphRef="a"/><Point X="180" Y="90" GraphRef="b" ArrowHead="Arrow"/><Anchor GraphId="junction" Position="0.4"/></Graphics></Interaction><Interaction GraphId="edge2"><Graphics><Point X="160" Y="90" GraphRef="junction"/><Point X="180" Y="140" GraphRef="c" ArrowHead="TBar"/></Graphics></Interaction></Pathway>`;
const load = () => importGPML(fixture, row);
test("near-coincident grid coordinates retain right-angle corners instead of cutting through labels", () => {
  const points = simplifyRoute([
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10 + 1e-13, y: 0 },
    { x: 10 + 1e-13, y: 10 },
  ]);
  assert.equal(points.length, 3);
  assert.ok(
    points
      .slice(1)
      .every(
        (p, i) =>
          Math.abs(p.x - points[i].x) < 1e-6 ||
          Math.abs(p.y - points[i].y) < 1e-6,
      ),
  );
});
const diagramNodes = (r) =>
  r.items.filter(
    (i) => !i.pathwayConnection && i.pathway.role !== "compartment",
  );
test("illustrated pathways allocate readable label space and remove all node/label box overlaps", () => {
  const r = load(),
    nodes = diagramNodes(r);
  for (let a = 0; a < nodes.length; a++)
    for (let b = a + 1; b < nodes.length; b++)
      assert.equal(
        overlaps(itemBounds(nodes[a]), itemBounds(nodes[b])),
        false,
        `${nodes[a].name} / ${nodes[b].name}`,
      );
  for (const n of nodes) {
    const doc = new DOMParser().parseFromString(n.svg, "image/svg+xml"),
      label = doc.querySelector("[data-pathway-label]");
    assert.ok(Number(label.getAttribute("font-size")) >= 13.9, n.name);
    assert.ok(
      n.pathwayLabelLayout.offsetY + n.pathwayLabelLayout.h <= n.h + 0.01,
    );
    assert.ok(
      n.pathwayGeometry.y + n.pathwayGeometry.h <=
        n.pathwayLabelLayout.offsetY / n.h + 0.01,
    );
  }
  const e = r.items.find((i) => i.pathway.source.elementId === "edge2"),
    parent = r.items.find((i) => i.pathway.source.elementId === "edge1");
  assert.equal(e.pathwayConnection.links[0].from, parent.id);
  assert.equal(e.pathwayConnection.links[0].fromAnchor, 0.4);
});
test("live arrow endpoints follow the actual outline through translation, scaling, rotation and reflection", () => {
  const r = load(),
    n = r.items.find((i) => i.name === "T-helper"),
    edge = r.items.find((i) => i.pathway.source.elementId === "edge1"),
    branch = r.items.find((i) => i.pathway.source.elementId === "edge2"),
    before = branch.svg;
  Object.assign(n, {
    x: n.x + 137,
    y: n.y + 83,
    w: n.w * 1.4,
    h: n.h * 1.2,
    rotation: 37,
    mirrorX: true,
  });
  syncPathwayConnections(r.items);
  const link = edge.pathwayConnection.links[0],
    target = r.items.find((i) => i.id === link.to),
    expected = connectionPort(n, {
      x: target.x + target.w / 2,
      y: target.y + target.h / 2,
    }).point;
  assert.ok(Math.hypot(expected.x - link.a.x, expected.y - link.a.y) < 1e-7);
  assert.notEqual(
    branch.svg,
    before,
    "junction branches follow the parent arrow",
  );
  const angle = (n.rotation * Math.PI) / 180,
    dx = link.a.x - n.x - n.w / 2,
    dy = link.a.y - n.y - n.h / 2,
    p = [
      n.w / 2 - (dx * Math.cos(angle) + dy * Math.sin(angle)),
      n.h / 2 - dx * Math.sin(angle) + dy * Math.cos(angle),
    ];
  const distance = (a, b) => {
    const vx = b[0] - a[0],
      vy = b[1] - a[1],
      t = Math.max(
        0,
        Math.min(
          1,
          ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / (vx * vx + vy * vy || 1),
        ),
      );
    return Math.hypot(p[0] - a[0] - t * vx, p[1] - a[1] - t * vy);
  };
  const distances = n.pathwayGeometry.outlines.flatMap((path) =>
    path.map((a, i) =>
      distance(
        [a[0] * n.w, a[1] * n.h],
        [
          path[(i + 1) % path.length][0] * n.w,
          path[(i + 1) % path.length][1] * n.h,
        ],
      ),
    ),
  );
  assert.ok(
    Math.min(...distances) < 1e-6,
    "attachment touches the sampled vector outline",
  );
});
test("routing avoids the reserved boxes of intervening figures and labels; hidden targets hide their arrows", () => {
  const a = makePathwayItem("protein", "a"),
    b = makePathwayItem("protein", "b"),
    block = makePathwayItem("protein", "block"),
    e = makePathwayItem("conversion", "edge");
  Object.assign(a, { x: 20, y: 200, w: 100, h: 70 });
  Object.assign(b, { x: 620, y: 200, w: 100, h: 70 });
  Object.assign(block, { x: 280, y: 170, w: 140, h: 130 });
  makeConnection(e, a.id, b.id, { x: 120, y: 235 }, { x: 620, y: 235 });
  const items = [e, a, b, block];
  syncPathwayConnections(items);
  const path = new DOMParser()
      .parseFromString(e.svg, "image/svg+xml")
      .querySelector("[data-pathway-connector]"),
    points = parsePath(path.getAttribute("d")).map((c) => ({
      x: c.values[0],
      y: c.values[1],
    }));
  for (let i = 1; i < points.length; i++)
    assert.equal(
      segmentHitsBox(points[i - 1], points[i], itemBounds(block, 7)),
      false,
    );
  a.visible = false;
  syncPathwayConnections(items);
  assert.doesNotMatch(e.svg, /data-pathway-connector/);
  a.visible = true;
  syncPathwayConnections(items);
  assert.match(e.svg, /data-pathway-connector/);
});
test("insertion and duplication remap connection IDs, preserve independent batches and survive project serialization", () => {
  const r = load(),
    doc = newSheet();
  let changes = 0;
  const drawing = {
    doc,
    selected: [],
    beforeChange() {
      changes++;
    },
    notify() {
      syncPathwayConnections(this.doc.items);
    },
    selectedItems() {
      return this.doc.items.filter((i) => this.selected.includes(i.id));
    },
    sculptCommand() {
      return false;
    },
  };
  Drawing2D.prototype.insertPathway.call(drawing, r);
  const first = doc.items.map((i) => i.id);
  Drawing2D.prototype.insertPathway.call(drawing, r);
  const second = doc.items.filter((i) => !first.includes(i.id));
  for (const e of second.filter((i) => i.pathwayConnection))
    for (const l of e.pathwayConnection.links)
      for (const k of ["from", "to"])
        assert.ok(!l[k] || second.some((i) => i.id === l[k]));
  drawing.selected = [...first];
  Drawing2D.prototype.command.call(drawing, "duplicate");
  const copied = doc.items.filter((i) => drawing.selected.includes(i.id));
  for (const e of copied.filter((i) => i.pathwayConnection))
    for (const l of e.pathwayConnection.links)
      for (const k of ["from", "to"])
        assert.ok(!l[k] || copied.some((i) => i.id === l[k]));
  const project = newProject();
  project.sheet = doc;
  const restored = validateProject(JSON.parse(JSON.stringify(project)));
  const n = restored.sheet.items.find((i) => i.name === "T-helper"),
    e = restored.sheet.items.find((i) =>
      i.pathwayConnection?.links.some((l) => l.from === n.id),
    ),
    svg = e.svg;
  n.x += 100;
  syncPathwayConnections(restored.sheet.items);
  assert.notEqual(e.svg, svg);
  const invalid = structuredClone(project);
  invalid.sheet.items.find(
    (i) => i.pathwayConnection,
  ).pathwayConnection.links[0].a.x = NaN;
  assert.throws(() => validateProject(invalid), /connection/);
  assert.equal(changes, 3);
});
test("legacy diagrams can be improved without mutating the input; repeated layout stays stable and deletion removes linked arrows", () => {
  const r = load();
  for (const i of r.items) delete i.pathwayLayoutVersion;
  const old = JSON.stringify(r.items),
    improved = improvePathwayDrawing(r.items),
    again = improvePathwayDrawing(improved);
  assert.equal(JSON.stringify(r.items), old);
  assert.ok(
    again.every(
      (i) =>
        i.pathwayConnection ||
        (Math.abs(i.x - improved.find((n) => n.id === i.id).x) < 1e-6 &&
          Math.abs(i.y - improved.find((n) => n.id === i.id).y) < 1e-6),
    ),
  );
  const n = improved.find((i) => i.name === "T-helper"),
    drawing = {
      doc: { ...newSheet(), items: improved },
      selected: [n.id],
      selectedItems() {
        return this.doc.items.filter((i) => this.selected.includes(i.id));
      },
      beforeChange() {},
      notify() {
        syncPathwayConnections(this.doc.items);
      },
      sculptCommand() {
        return false;
      },
    };
  Drawing2D.prototype.command.call(drawing, "delete");
  assert.ok(
    drawing.doc.items.every(
      (i) =>
        !i.pathwayConnection?.links.some(
          (l) => l.from === n.id || l.to === n.id,
        ),
    ),
  );
  const retained = new Set(drawing.doc.items.map((i) => i.id));
  assert.ok(
    drawing.doc.items.every(
      (i) =>
        !i.pathwayConnection ||
        i.pathwayConnection.links.every(
          (l) =>
            (!l.from || retained.has(l.from)) && (!l.to || retained.has(l.to)),
        ),
    ),
  );
});
test("legacy arrowheads are not mistaken for extra interactions and improving layout is one undo checkpoint", () => {
  const a = makePathwayItem("protein", "a"),
    b = makePathwayItem("protein", "b"),
    e = makePathwayItem("conversion", "e");
  Object.assign(a, { x: 20, y: 20, w: 80, h: 50 });
  Object.assign(b, { x: 300, y: 20, w: 80, h: 50 });
  Object.assign(e, {
    x: 0,
    y: 0,
    w: 400,
    h: 100,
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 100"><g fill="none"><path d="M100 45L300 45"/><path d="M291 41L300 45L291 49" fill="#426884"/></g></svg>',
  });
  let checkpoint = 0;
  const doc = { ...newSheet(), items: [e, a, b] },
    before = JSON.stringify(doc),
    drawing = {
      doc,
      selected: [],
      selectedItems() {
        return [];
      },
      beforeChange() {
        checkpoint++;
      },
      notify() {},
      onStatus() {},
    };
  Drawing2D.prototype.command.call(drawing, "pathway-layout");
  assert.equal(checkpoint, 1);
  assert.notEqual(JSON.stringify(doc), before);
  const links = doc.items.find((i) => i.id === "e").pathwayConnection.links;
  assert.equal(links.length, 1);
  assert.equal(links[0].from, "a");
  assert.equal(links[0].to, "b");
});
