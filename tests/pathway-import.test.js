import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import {
  importReactomeDiagram,
  importGPML,
  importBioPAX,
  importKGML,
  importPathwayFile,
  loadPathway,
} from "../src/pathway-import.js";
import { validateProject, newProject } from "../src/model.js";
import { Drawing2D, sanitizedSVG } from "../src/drawing2d.js";
import { updatePathwayItem } from "../src/pathway-elements.js";
const dom = new JSDOM("");
Object.assign(globalThis, {
  DOMParser: dom.window.DOMParser,
  XMLSerializer: dom.window.XMLSerializer,
});
const row = { source: "Reactome", id: "R-HSA-2132295", name: "MHC II" };
const data = {
  stableId: row.id,
  nodes: [
    {
      id: 1,
      reactomeId: 101,
      displayName: "HLA alpha",
      renderableClass: "Protein",
      prop: { x: 100, y: 60, width: 100, height: 24 },
      connectors: [
        {
          edgeId: 3,
          type: "INPUT",
          segments: [{ from: { x: 200, y: 72 }, to: { x: 240, y: 72 } }],
        },
      ],
    },
    {
      id: 2,
      reactomeId: 102,
      displayName: "HLA beta",
      renderableClass: "Protein",
      prop: { x: 290, y: 60, width: 100, height: 24 },
    },
  ],
  edges: [
    {
      id: 3,
      reactomeId: 103,
      displayName: "MHC assembly",
      segments: [{ from: { x: 240, y: 72 }, to: { x: 290, y: 72 } }],
      endShape: {
        a: { x: 283, y: 68 },
        b: { x: 290, y: 72 },
        c: { x: 283, y: 76 },
        type: "ARROW",
      },
    },
  ],
  compartments: [
    {
      id: 4,
      displayName: "ER",
      prop: { x: 80, y: 30, width: 340, height: 120 },
    },
  ],
};
const gpml = `<Pathway xmlns="http://pathvisio.org/GPML/2013a" Name="IL5"><DataNode GraphId="a" TextLabel="AKT1" Type="Protein"><Graphics CenterX="100" CenterY="50" Width="80" Height="24"/><Xref Database="Entrez Gene" ID="207"/></DataNode><DataNode GraphId="b" TextLabel="STAT5" Type="Protein"><Graphics CenterX="250" CenterY="50" Width="80" Height="24"/></DataNode><Interaction GraphId="e"><Graphics><Point X="140" Y="50"/><Point X="210" Y="50" ArrowHead="TBar"/></Graphics></Interaction></Pathway>`;
test("Reactome imports molecular nodes, compartments and live reaction branches", () => {
  const r = importReactomeDiagram(data, row);
  assert.equal(r.items.length, 5);
  assert.equal(r.layout, "readable-source");
  assert.equal(r.items[0].pathway.type, "compartment");
  const a = r.items.find((i) => i.name === "HLA alpha"),
    b = r.items.find((i) => i.name === "HLA beta"),
    edge = r.items.find((i) => i.name === "MHC assembly");
  assert.equal(b.x - a.x, 190);
  assert.equal(a.w, 100);
  assert.equal(a.pathway.source.elementId, "101");
  assert.equal(edge.pathwayConnection.links.length, 2);
  assert.ok(edge.pathwayConnection.links.some((l) => l.from === a.id));
  assert.ok(
    edge.pathwayConnection.links.some(
      (l) => l.to === b.id && l.end === "arrow",
    ),
  );
  assert.match(edge.svg, /data-pathway-connector/);
  for (const i of r.items) {
    assert.ok(sanitizedSVG(i.svg).includes("<svg"));
    assert.doesNotMatch(i.svg, /NaN|Infinity|<script|<image/);
  }
});
test("GPML retains placements, identifiers and inhibition; malformed coordinates fail before insertion", () => {
  const r = importGPML(gpml, {
    source: "WikiPathways",
    id: "WP127",
    name: "IL5",
  });
  assert.equal(r.items.length, 3);
  const nodes = r.items.filter((i) => i.pathway.role === "entity");
  assert.equal(nodes[1].x - nodes[0].x, 150);
  assert.deepEqual(nodes[0].pathway.identifiers, [
    { database: "Entrez Gene", id: "207" },
  ]);
  assert.equal(r.items[0].pathway.type, "inhibition");
  assert.throws(
    () =>
      importGPML(gpml.replace('CenterX="100"', 'CenterX="NaN"'), {
        source: "WikiPathways",
        id: "WP1",
      }),
    /coördinaten/,
  );
  assert.throws(
    () =>
      importGPML('<Pathway><!ENTITY x "x"></Pathway>', {
        source: "WikiPathways",
        id: "WP1",
      }),
    /Ongeldig/,
  );
});
test("source-sized labels stay editable without replacing node geometry", () => {
  const i = importReactomeDiagram(data, row).items.find(
    (i) => i.name === "HLA alpha",
  );
  const original = new DOMParser()
    .parseFromString(i.svg, "image/svg+xml")
    .querySelector("rect").outerHTML;
  updatePathwayItem(i, "label", "HLA edited");
  const doc = new DOMParser().parseFromString(i.svg, "image/svg+xml");
  assert.equal(doc.querySelector("rect").outerHTML, original);
  assert.equal(doc.querySelector("text").getAttribute("x"), "50");
  assert.match(doc.querySelector("text").textContent, /HLA edited/);
});
test("BioPAX preserves explicit left/right and catalytic control with an automatic layout", () => {
  const d = {
    "@graph": [
      { "@id": "a", "@type": "bp:Protein", displayName: "A" },
      { "@id": "b", "@type": "bp:Protein", displayName: "B" },
      { "@id": "c", "@type": "bp:Protein", displayName: "Catalyst" },
      {
        "@id": "r",
        "@type": "bp:BiochemicalReaction",
        left: "a",
        right: "b",
        displayName: "A to B",
      },
      {
        "@id": "ctl",
        "@type": "bp:Catalysis",
        controller: "c",
        controlled: "r",
      },
    ],
  };
  const r = importBioPAX(d, {
    source: "Pathway Commons",
    id: "netpath:Example",
    name: "Example",
  });
  assert.equal(r.layout, "automatic");
  assert.equal(r.items.length, 7);
  assert.ok(r.items.some((i) => i.pathway.type === "catalysis"));
  assert.equal(
    r.items.find((i) => i.name === "A to B").pathway.source.elementId,
    "r",
  );
  assert.throws(
    () =>
      importBioPAX(
        { "@graph": [] },
        { source: "Pathway Commons", id: "netpath:Example" },
      ),
    /geen importeerbare/,
  );
});
test("pathway insertion is one undo step, keeps existing objects and survives a project round trip beyond 300 items", () => {
  const r = importReactomeDiagram(data, row),
    doc = {
      width: 700,
      height: 500,
      items: [
        {
          id: "old",
          kind: "text",
          name: "Keep me",
          x: 0,
          y: 0,
          w: 80,
          h: 20,
          rotation: 0,
          opacity: 1,
        },
      ],
    };
  let checkpoints = 0,
    notifications = 0;
  const drawing = {
    doc,
    beforeChange: () => checkpoints++,
    notify: () => notifications++,
  };
  const count = Drawing2D.prototype.insertPathway.call(drawing, r);
  assert.equal(count, r.items.length);
  assert.equal(checkpoints, 1);
  assert.equal(notifications, 1);
  assert.equal(doc.items[0].id, "old");
  assert.ok(doc.items[1].y >= 100);
  Drawing2D.prototype.insertPathway.call(drawing, r);
  assert.equal(
    new Set(doc.items.map((i) => i.id)).size,
    1 + r.items.length * 2,
  );
  const project = newProject();
  project.sheet = {
    version: 1,
    width: doc.width,
    height: doc.height,
    items: [...doc.items],
  };
  for (let n = 0; n < 310; n++)
    project.sheet.items.push({
      ...structuredClone(doc.items[2]),
      id: `copy-${n}`,
    });
  validateProject(JSON.parse(JSON.stringify(project)));
  assert.equal(project.sheet.items.length, 311 + r.items.length * 2);
  const before = JSON.stringify(doc);
  assert.throws(
    () =>
      Drawing2D.prototype.insertPathway.call(drawing, { ...r, height: 10001 }),
    /past niet/,
  );
  assert.equal(JSON.stringify(doc), before);
});
test("KGML imports local KEGG entry graphics and directed relations without fetching remote content", () => {
  const xml =
    '<pathway name="path:hsa04612" title="Antigen processing"><entry id="1" type="gene" name="hsa:1"><graphics name="TAP1" x="100" y="50" width="80" height="20"/></entry><entry id="2" type="gene" name="hsa:2"><graphics name="HLA" x="250" y="50" width="80" height="20"/></entry><relation entry1="1" entry2="2"><subtype name="activation"/></relation></pathway>';
  const r = importKGML(xml);
  assert.equal(r.items.length, 3);
  assert.equal(r.source.id, "hsa04612");
  assert.equal(r.items[0].pathway.type, "activation");
  assert.equal(r.items[1].pathway.source.database, "KEGG");
  const p = newProject();
  p.sheet = { version: 1, width: r.width, height: r.height, items: r.items };
  validateProject(p);
  assert.equal(importPathwayFile(xml, "example.xml").items.length, 3);
});
test("live import requests select validated source routes and obey cancellation", async () => {
  const seen = [];
  const fetcher = async (url, options) => {
    seen.push(url);
    assert.ok(options.signal);
    return { ok: true, text: async () => JSON.stringify(data) };
  };
  const r = await loadPathway(
    {
      ...row,
      source: "Pathway Commons",
      id: "http://bioregistry.io/reactome:R-HSA-2132295",
    },
    { fetcher },
  );
  assert.equal(r.items.length, 5);
  assert.equal(r.source.source, "Reactome");
  assert.equal(
    seen[0],
    "https://reactome.org/download/current/diagram/R-HSA-2132295.json",
  );
  await assert.rejects(
    loadPathway({ source: "WikiPathways", id: "../../evil" }, { fetcher }),
    /geen bewerkbare/,
  );
  assert.equal(seen.length, 1);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    loadPathway(row, {
      signal: controller.signal,
      fetcher: async (url, { signal }) => {
        assert.equal(signal.aborted, true);
        throw new DOMException("Aborted", "AbortError");
      },
    }),
    { name: "AbortError" },
  );
});
