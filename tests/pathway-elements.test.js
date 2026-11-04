import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import {
  pathwayCatalog,
  newPathwayMetadata,
  pathwaySVG,
  makePathwayItem,
  updatePathwayItem,
  validatePathwayMetadata,
  pathwayTypeFor,
  pathwayPorts,
} from "../src/pathway-elements.js";
import { newProject, validateProject } from "../src/model.js";
import { Drawing2D, newSheet, sanitizedSVG } from "../src/drawing2d.js";
import { parsePath, updateVectorPath } from "../src/vector-nodes.js";
const dom = new JSDOM("");
Object.assign(globalThis, {
  DOMParser: dom.window.DOMParser,
  XMLSerializer: dom.window.XMLSerializer,
});
test("all original and biological symbols have editable geometry and portable metadata", () => {
  assert.ok(pathwayCatalog.length > 250);
  assert.equal(
    new Set(pathwayCatalog.map((d) => d.type)).size,
    pathwayCatalog.length,
  );
  for (const d of pathwayCatalog) {
    const m = newPathwayMetadata(d.type),
      svg = pathwaySVG(m),
      doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    assert.equal(doc.querySelector("parsererror"), null, d.type);
    assert.ok(doc.querySelector("path,rect,circle,ellipse"), d.type);
    assert.doesNotMatch(svg, /NaN|Infinity|<image|<script/);
    assert.deepEqual(JSON.parse(doc.querySelector("metadata").textContent), m);
    assert.ok(sanitizedSVG(svg).includes("data-pathway-metadata"));
  }
});
test("label, state and identifier edits retain custom vector geometry and do not inject markup", () => {
  const item = makePathwayItem("protein", "protein");
  item.svg = updateVectorPath(
    item.svg,
    0,
    parsePath("M20 35C80 0 160 120 220 35L220 100L20 100Z"),
  );
  const before = new DOMParser()
    .parseFromString(item.svg, "image/svg+xml")
    .querySelector("path")
    .getAttribute("d");
  updatePathwayItem(item, "label", 'AKT1 <active> & "bound" $&');
  updatePathwayItem(item, "state", "P");
  updatePathwayItem(item, "identifiers", "UniProt:P31749\nChEBI:CHEBI:15377");
  const doc = new DOMParser().parseFromString(item.svg, "image/svg+xml");
  assert.equal(doc.querySelector("parsererror"), null);
  assert.equal(doc.querySelector("path").getAttribute("d"), before);
  assert.equal(doc.querySelector("active"), null);
  assert.match(doc.querySelector("[data-pathway-label]").textContent, /AKT1/);
  assert.equal(doc.querySelector("[data-pathway-state]").textContent, "P");
  assert.equal(item.pathway.identifiers[1].id, "CHEBI:15377");
  assert.deepEqual(
    JSON.parse(doc.querySelector("metadata").textContent),
    item.pathway,
  );
});
test("project and standalone SVG round trips retain entity states, complex members and identifiers", () => {
  const p = newProject();
  p.sheet = newSheet();
  const item = makePathwayItem("complex", "complex");
  updatePathwayItem(item, "members", "AKT1\nPDK1");
  updatePathwayItem(item, "stoichiometry", 2);
  p.sheet.items = [item];
  const restored = validateProject(JSON.parse(JSON.stringify(p))).sheet
    .items[0];
  assert.deepEqual(restored.pathway, item.pathway);
  const imported = Drawing2D.prototype.addSVG.call(
    { add: (x) => x },
    item.svg,
    "file name.svg",
    "test.svg",
  );
  assert.deepEqual(imported.pathway, item.pathway);
  assert.equal(imported.name, item.name);
  assert.equal(imported.volumeLook, false);
});
test("source type mappings preserve the distinction between nodes, groups and regulation", () => {
  for (const [source, type, expected] of [
    ["Reactome", "Protein", "protein"],
    ["Reactome", "Complex", "complex"],
    ["Reactome", "EntitySet", "entity-set"],
    ["Reactome", "ChemicalDrug", "drug"],
    ["Reactome", "Inhibitor", "inhibition"],
    ["WikiPathways", "Rna", "rna"],
    ["WikiPathways", "mim-stimulation", "activation"],
    ["WikiPathways", "mim-catalysis", "catalysis"],
  ])
    assert.equal(pathwayTypeFor(source, type), expected);
  assert.equal(pathwayTypeFor("Reactome", "unrecognized"), "unknown");
});
test("connection ports follow resize, rotation and mirroring while native membranes remain sculptable", () => {
  const item = makePathwayItem("conversion", "edge");
  Object.assign(item, { x: 100, y: 200, w: 400, h: 140, rotation: 90 });
  const [a, b] = pathwayPorts(item);
  assert.ok(Math.abs(a.x - b.x) < 1e-9);
  assert.ok(b.y > a.y);
  item.mirrorX = true;
  const [c, d] = pathwayPorts(item);
  assert.ok(c.y > d.y);
  const membrane = makePathwayItem("membrane", "membrane");
  assert.equal(membrane.kind, "membrane");
  assert.equal(membrane.curve.length, 4);
});
test("metadata rejects invalid ports, excessive stoichiometry and invalid identifiers without partial edits", () => {
  const item = makePathwayItem("protein", "test"),
    before = JSON.stringify(item);
  assert.throws(() => updatePathwayItem(item, "stoichiometry", 100));
  assert.equal(JSON.stringify(item), before);
  const m = structuredClone(item.pathway);
  m.ports[0].x = NaN;
  assert.throws(() => validatePathwayMetadata(m));
  const p = newProject();
  p.sheet = newSheet();
  p.sheet.items = [item];
  item.pathway.identifiers = [{ database: "UniProt", id: 42 }];
  assert.throws(() => validateProject(p));
});
