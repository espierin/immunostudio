import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import {
  biologicalFigureFor,
  biologicalFigures,
} from "../src/biological-figures.js";
import { importGPML } from "../src/pathway-import.js";
import { updatePathwayItem } from "../src/pathway-elements.js";
test("cell and molecule aliases are precise; pathways and gene labels are not inferred cells", () => {
  for (const label of ["T-helper", "Th", "CD4 T cell"])
    assert.equal(biologicalFigureFor(label).id, "helper-t-cell");
  for (const label of [
    "fibroblasts",
    "Endothelial Cells",
    "Macrophage",
    "B Cell",
  ])
    assert.equal(biologicalFigureFor(label).family, "cell");
  assert.equal(biologicalFigureFor("IL-2").label, "IL2");
  assert.equal(biologicalFigureFor("IL-8").label, "CXCL8");
  assert.equal(biologicalFigureFor("CXCL12").family, "chemokine");
  assert.equal(biologicalFigureFor("CCR7").family, "chemokine-receptor");
  assert.equal(biologicalFigureFor("CD4").family, "membrane-protein");
  assert.equal(biologicalFigureFor("HLA-DRA").family, "mhc");
  assert.equal(biologicalFigureFor("CD4", "gene"), null);
  assert.equal(biologicalFigureFor("T-helper differentiation"), null);
  assert.equal(biologicalFigureFor("T-cell receptor signaling"), null);
  assert.equal(
    new Set(biologicalFigures.map((f) => f.id)).size,
    biologicalFigures.length,
  );
});
test("GPML cell labels become native collection artwork, cytokines keep IDs and editable labels", () => {
  const Parser = new JSDOM("").window.DOMParser;
  const xml =
    '<Pathway><Label TextLabel="T-helper" GraphId="cell"><Graphics CenterX="100" CenterY="100" Width="85" Height="20"/></Label><DataNode TextLabel="IL2" Type="GeneProduct" GraphId="il2"><Graphics CenterX="250" CenterY="100" Width="45" Height="20"/><Xref Database="Entrez Gene" ID="3558"/></DataNode><Label TextLabel="Inflammatory response" GraphId="note"><Graphics CenterX="100" CenterY="250" Width="100" Height="30"/></Label></Pathway>';
  const result = importGPML(
    xml,
    { source: "WikiPathways", id: "WP-test", name: "Test" },
    Parser,
  );
  const cell = result.items.find((i) => i.name === "T-helper"),
    il = result.items.find((i) => i.name === "IL2");
  assert.equal(cell.pathway.type, "bio-helper-t-cell");
  assert.match(cell.svg, /viewBox="-165 -165 330 330"/);
  assert.equal(il.pathway.type, "bio-il2");
  assert.equal(il.pathway.identifiers[0].id, "3558");
  assert.equal(
    result.items.find((i) => i.name === "Inflammatory response").pathway.type,
    "annotation",
  );
  const before = il.svg.match(/<path[^>]+>/)[0];
  updatePathwayItem(il, "label", "IL-2 secreted");
  assert.match(il.svg, /IL-2 secreted/);
  assert.equal(il.svg.match(/<path[^>]+>/)[0], before);
  assert.equal(
    new Parser()
      .parseFromString(il.svg, "image/svg+xml")
      .querySelector("parsererror"),
    null,
  );
});
