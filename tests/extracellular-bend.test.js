import { Drawing2D, newSheet } from "../src/drawing2d.js";
import { newProject, validateProject } from "../src/model.js";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import {
  extracellularPoint,
  bendPath,
  parseAffine,
  extracellularArtwork,
} from "../src/extracellular-bend.js";
import { parsePath, vectorElements } from "../src/vector-nodes.js";
import {
  receptorAnchorProfile,
  fitReceptorAnchor,
} from "../src/receptor-anchor.js";
import { anchoredPose, contourFrame } from "../src/contour2d.js";
import { bendReceptors } from "../src/receptor-spacing.js";
import { syncEmbeddedReceptors } from "../src/sculpt2d.js";
const files = [
  "basic_13_TCR_CD3_user.svg",
  "basic_14_TCR_CD8.svg",
  "basic_150_CD4_coreceptor_four_domains.svg",
  "basic_15_CD8_coreceptor.svg",
];
const source = (file) =>
  readFileSync(
    new URL(
      "../public/library/02_HLA_peptiden_en_receptoren/" + file,
      import.meta.url,
    ),
    "utf8",
  );
const profiles = [
  { x: 0, y: 0, span: 34, angle: 0 },
  { x: -145, y: 0, span: 34, angle: 180 },
];
test("every point in the transmembrane slab and cytoplasm stays exactly fixed at any bend", () => {
  for (const profile of profiles)
    for (const angle of [-60, -35, 0, 35, 60])
      for (const x of [-100, 0, 100])
        for (let y = -17; y <= 17; y += 0.5) {
          const p = [profile.x + x, y];
          assert.deepEqual(extracellularPoint(p, profile, angle), p);
        }
  assert.deepEqual(extracellularPoint([0, 100], profiles[0], 45), [0, 100]);
  assert.deepEqual(
    extracellularPoint([-145, -100], profiles[1], 45),
    [-145, -100],
  );
});
test("extracellular domains move, preserve hinge distance and cannot bend through the membrane", () => {
  for (const profile of profiles)
    for (const angle of [-60, -35, 35, 60]) {
      const dir = profile.angle === 180 ? 1 : -1,
        boundary = dir * 17;
      for (const x of [-100, -20, 0, 20, 100])
        for (const d of [0.1, 2, 10, 30, 100]) {
          const p = [profile.x + x, boundary + dir * d],
            q = extracellularPoint(p, profile, angle);
          assert.ok(dir * (q[1] - boundary) > -1e-10);
          assert.ok(
            Math.abs(
              Math.hypot(q[0] - profile.x, q[1] - boundary) - Math.hypot(x, d),
            ) < 1e-8,
          );
        }
      assert.notDeepEqual(
        extracellularPoint([profile.x, boundary + dir * 100], profile, angle),
        [profile.x, boundary + dir * 100],
      );
    }
});
test("a linker crossing the extracellular boundary is split exactly at the fixed stem", () => {
  const profile = profiles[1],
    path = bendPath(parsePath("M-145 -55V53"), profile, 35);
  assert.ok(path.some((c) => Math.abs(c.values[1] - 17) < 1e-8));
  for (const c of path) if (c.values[1] <= 17) assert.equal(c.values[0], -145);
  assert.notEqual(path.at(-1).values[0], -145);
  assert.deepEqual(
    bendPath(parsePath("M-145 -55V17"), profile, 35),
    parsePath("M-145 -55V17"),
  );
});
test("native TCR, CD4 and CD8 keep their anchor pose and transmembrane fit when ectodomains bend", () => {
  for (const file of files)
    for (const mirrorX of [false, true])
      for (const mirrorY of [false, true]) {
        const item = {
          svg: source(file),
          sourceFile: file,
          w: 240,
          h: 240,
          mirrorX,
          mirrorY,
          anchor2d: { u: 0.4, side: 1, offset: 0 },
        };
        fitReceptorAnchor(item, { bilayerThickness: 34 });
        const frame = contourFrame(
            [
              [0, 0],
              [120, -30],
              [300, 0],
            ],
            0.4,
            false,
          ),
          before = anchoredPose(item, frame, item.anchor2d);
        item.anchor2d.ectoBend = 40;
        assert.deepEqual(anchoredPose(item, frame, item.anchor2d), before);
        assert.equal(receptorAnchorProfile(item).extracellular, true);
        assert.equal(
          fitReceptorAnchor(item, { bilayerThickness: 34 }, true),
          false,
        );
      }
});
test("extracellular brush changes a separate bend field, preserves u and resets only touched whole-molecule tilt", () => {
  const native = {
      id: "cd4",
      svg: source(files[2]),
      sourceFile: files[2],
      w: 30,
      h: 80,
      anchor2d: { u: 0.5, side: 1, pivotX: 0.5, pivotY: 0.8, tilt: 25 },
    },
    far = {
      ...structuredClone(native),
      id: "far",
      anchor2d: { ...native.anchor2d, u: 0.99 },
    };
  bendReceptors(
    [native, far],
    {
      points: [
        [0, 0],
        [300, 0],
      ],
      closed: false,
    },
    [20, 0],
    { focus: [150, -30], radius: 25, extracellular: true, strength: 1 },
  );
  assert.ok(native.anchor2d.ectoBend > 0);
  assert.equal(native.anchor2d.tilt, 0);
  assert.equal(native.anchor2d.u, 0.5);
  assert.equal(far.anchor2d.tilt, 25);
  const a = {
    u: 0.1,
    initialTilt: 20,
    initialEctoBend: 10,
    proxy: { anchor2d: { u: 0.1, tilt: -20, ectoBend: 15 } },
  };
  syncEmbeddedReceptors([a]);
  assert.equal(a.tilt, 0);
  assert.equal(a.ectoBend, 25);
});
test("native and embedded extracellular artwork remains plain vector paths without mutating its source", () => {
  const dom = new JSDOM(),
    previousParser = globalThis.DOMParser,
    previousSerializer = globalThis.XMLSerializer;
  globalThis.DOMParser = dom.window.DOMParser;
  globalThis.XMLSerializer = dom.window.XMLSerializer;
  try {
    for (const file of files) {
      const svg = source(file),
        item = { svg, sourceFile: file, anchor2d: { ectoBend: 35 } },
        result = extracellularArtwork(svg, item);
      assert.notEqual(result, svg);
      assert.equal(item.svg, svg);
      assert.doesNotMatch(result, /NaN|Infinity|<mask|<clipPath/);
      const parser = new DOMParser();
      assert.equal(
        vectorElements(parser.parseFromString(svg, "image/svg+xml")).length,
        vectorElements(parser.parseFromString(result, "image/svg+xml")).length,
      );
    }
    const cell = readFileSync(
        new URL(
          "../public/library/01_Cellen_en_immuniteit/basic_130_T_CD4_helper_cartoon.svg",
          import.meta.url,
        ),
        "utf8",
      ),
      doc = new DOMParser().parseFromString(cell, "image/svg+xml");
    const group = [...doc.querySelectorAll("g")].find((g) =>
      /basic_13_TCR/.test(g.getAttribute("inkscape:label") || ""),
    );
    group.parentElement.setAttribute("data-membrane-ecto-bend", "35");
    const cellSource = new XMLSerializer().serializeToString(doc),
      body = doc.querySelector("path").getAttribute("d"),
      result = extracellularArtwork(cellSource, { svg: cellSource });
    assert.notEqual(result, cellSource);
    assert.equal(
      new DOMParser()
        .parseFromString(result, "image/svg+xml")
        .querySelector("path")
        .getAttribute("d"),
      body,
    );
    assert.deepEqual(parseAffine("translate(10 20) rotate(90) scale(2)"), [
      Math.cos(Math.PI / 2) * 2,
      2,
      -2,
      Math.cos(Math.PI / 2) * 2,
      10,
      20,
    ]);
  } finally {
    globalThis.DOMParser = previousParser;
    globalThis.XMLSerializer = previousSerializer;
    dom.window.close();
  }
});

test("selection export includes ectodomains outside the source frame, even with labels hidden", () => {
  const previousPoint = globalThis.DOMPoint;
  try {
    globalThis.DOMPoint = class {
      constructor(x, y) {
        this.x = x;
        this.y = y;
      }
      matrixTransform(m) {
        return {
          x: m.a * this.x + m.c * this.y + m.e,
          y: m.b * this.x + m.d * this.y + m.f,
        };
      }
    };
    const item = {
        id: "receptor",
        kind: "svg",
        x: 500,
        y: 500,
        w: 40,
        h: 100,
        visible: true,
        opacity: 1,
      },
      doc = newSheet();
    doc.items = [item];
    const art = {
      getBBox: () => ({ x: -80, y: -25, width: 180, height: 180 }),
      getScreenCTM: () => ({ a: 1, b: 0, c: 0, d: 1, e: 500, f: 500 }),
    };
    const drawing = {
      doc,
      labelsVisible: false,
      selectedItems: () => [item],
      itemMarkup: () => '<path d="M0 0L1 1"/>',
      svg: {
        querySelector: () => art,
        getScreenCTM: () => ({ inverse: () => ({ multiply: (m) => m }) }),
      },
    };
    const before = JSON.stringify(doc),
      svg = Drawing2D.prototype.exportSelectionSVG.call(drawing);
    assert.match(svg, /viewBox="410 465 200 200"/);
    assert.equal(JSON.stringify(doc), before);
    assert.equal((svg.match(/<path /g) || []).length, 1);
  } finally {
    if (previousPoint === undefined) delete globalThis.DOMPoint;
    else globalThis.DOMPoint = previousPoint;
  }
});
test("project files retain extracellular bend and reject invalid bend parameters", () => {
  const project = newProject();
  project.sheet = newSheet();
  project.sheet.items = [
    {
      id: "host",
      kind: "ellipse",
      x: 0,
      y: 0,
      w: 300,
      h: 300,
      rotation: 0,
      opacity: 1,
      visible: true,
    },
    {
      id: "r",
      kind: "rect",
      x: 20,
      y: 30,
      w: 40,
      h: 80,
      rotation: 0,
      opacity: 1,
      visible: true,
      anchor2d: {
        targetId: "host",
        u: 0.5,
        side: 1,
        offset: 0,
        pivotX: 0.5,
        pivotY: 0.8,
        pathIndex: 0,
        angle: 0,
        ectoBend: 35,
      },
    },
  ];
  assert.equal(
    validateProject(JSON.parse(JSON.stringify(project))).sheet.items[1].anchor2d
      .ectoBend,
    35,
  );
  project.sheet.items[1].anchor2d.ectoBend = 61;
  assert.throws(() => validateProject(project), /extracellular/);
});
