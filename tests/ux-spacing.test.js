import test from "node:test";
import assert from "node:assert/strict";
import {
  spreadReceptors,
  receptorOverlapCount,
} from "../src/receptor-spacing.js";
import { anchoredPose, contourFrame } from "../src/contour2d.js";
import { matchesLibrary } from "../src/library-search.js";
import { installWorkspacePanels } from "../src/workspace-panels.js";
import { JSDOM } from "jsdom";
const line = {
  points: [
    [0, 0],
    [100, 0],
    [200, 0],
    [300, 0],
  ],
  closed: false,
};
const receptor = (id, u = 0.5) => ({
  id,
  w: 30,
  h: 80,
  rotation: 0,
  anchor2d: {
    targetId: "membrane",
    pathIndex: 0,
    u,
    pivotX: 0.5,
    pivotY: 0.8,
    side: 1,
    offset: 0,
  },
});
test("spacing resolves coincident anchors without altering artwork or anchor configuration", () => {
  const items = Array.from({ length: 5 }, (_, n) => receptor(String(n))),
    before = structuredClone(items);
  assert.equal(receptorOverlapCount(items, line), 10);
  const result = spreadReceptors(items, line);
  assert.equal(result.remaining, 0);
  assert.ok(result.moved >= 4);
  items.forEach((item, n) => {
    assert.ok(item.anchor2d.u >= 0 && item.anchor2d.u <= 1);
    assert.deepEqual(
      { ...item, anchor2d: { ...item.anchor2d, u: before[n].anchor2d.u } },
      before[n],
    );
  });
});
test("locked receptors are fixed obstacles and a local brush leaves distant receptors alone", () => {
  const items = [receptor("locked"), receptor("move"), receptor("far", 0.95)];
  items[0].locked = true;
  const result = spreadReceptors(items, line, {
    focus: [150, -20],
    radius: 50,
    maxShift: 60,
  });
  assert.equal(items[0].anchor2d.u, 0.5);
  assert.equal(items[2].anchor2d.u, 0.95);
  assert.ok(result.moved > 0);
  assert.equal(result.remaining, 0);
});
test("closed membrane spacing crosses the seam and retains local normal orientation", () => {
  const contour = {
    points: Array.from({ length: 64 }, (_, n) => [
      150 * Math.cos((n * Math.PI) / 32),
      100 * Math.sin((n * Math.PI) / 32),
    ]),
    closed: true,
  };
  const items = [
    receptor("a", 0.995),
    receptor("b", 0.005),
    receptor("c", 0.015),
  ];
  assert.ok(receptorOverlapCount(items, contour) > 0);
  assert.equal(spreadReceptors(items, contour).remaining, 0);
  for (const item of items) {
    const frame = contourFrame(contour.points, item.anchor2d.u, true),
      pose = anchoredPose(item, frame, item.anchor2d),
      r = (pose.rotation * Math.PI) / 180;
    assert.ok(
      Math.abs(
        -Math.sin(r) * frame.tangent[0] + Math.cos(r) * frame.tangent[1],
      ) < 1e-9,
    );
  }
});
test("insufficient space reports overlap and never detaches, shrinks or produces invalid positions", () => {
  const items = Array.from({ length: 8 }, (_, n) => receptor(String(n)));
  const result = spreadReceptors(items, {
    points: [
      [0, 0],
      [10, 0],
    ],
    closed: false,
  });
  assert.ok(result.remaining > 0);
  for (const item of items) {
    assert.ok(Number.isFinite(item.anchor2d.u));
    assert.equal(item.anchor2d.targetId, "membrane");
    assert.equal(item.w, 30);
    assert.equal(item.h, 80);
  }
});
test("search accepts accents, Greek symbols, punctuation and multiple words", () => {
  const entry = { name: "T-helper cell, IFN-γ", keywords: "mémbrane" };
  for (const query of ["t helper", "ifn gamma", "membrane", "IFN-γ"])
    assert.equal(matchesLibrary(entry, query), true);
  assert.equal(matchesLibrary(entry, "B cell"), false);
});
test("compact workspace panels expose state and Escape closes the inspector", () => {
  const dom = new JSDOM(
    '<aside class="library"></aside><aside class="inspector"></aside><button data-action="properties"></button><button data-action="toggle-library"></button>',
  );
  const doc = dom.window.document,
    panels = installWorkspacePanels({
      doc,
      win: dom.window,
      narrow: () => true,
    });
  const properties = doc.querySelector('[data-action="properties"]');
  assert.equal(properties.getAttribute("aria-expanded"), "false");
  panels.toggleProperties();
  assert.equal(properties.getAttribute("aria-expanded"), "true");
  doc.dispatchEvent(
    new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
  assert.equal(properties.getAttribute("aria-expanded"), "false");
  panels.toggleLibrary();
  assert.equal(
    doc
      .querySelector('[data-action="toggle-library"]')
      .getAttribute("aria-expanded"),
    "false",
  );
  dom.window.close();
});
