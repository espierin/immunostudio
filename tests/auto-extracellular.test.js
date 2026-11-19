import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import {
  relaxExtracellular,
  extracellularOverlapCount,
  sourceEctodomains,
  prepareAutomaticEctodomains,
} from "../src/auto-extracellular.js";
import { extracellularPoint } from "../src/extracellular-bend.js";
import { receptorAnchorProfile } from "../src/receptor-anchor.js";
import { anchoredPose, contourFrame } from "../src/contour2d.js";
import { syncEmbeddedReceptors } from "../src/sculpt2d.js";
import { FloatingDrawingTools } from "../src/floating-drawing.js";

const profile = { x: 0, y: 0, span: 10, angle: 0 };
function receptor(id, x, { locked = false, angle = 0 } = {}) {
  return {
    id,
    locked,
    angle,
    anchor: { u: x, pivotY: 0.5, tilt: 0 },
    polygons(a) {
      return [
        [
          [-12, -55],
          [12, -55],
          [12, -30],
          [-12, -30],
        ].map((p) => {
          const q = extracellularPoint(p, profile, a);
          return [q[0] + x, q[1]];
        }),
      ];
    },
    apply(a) {
      this.saved = a;
    },
  };
}
test("overlapping ectodomains separate without changing their membrane anchors", () => {
  const actors = [receptor("a", 0), receptor("b", 14)],
    before = structuredClone(actors.map((a) => a.anchor));
  assert.equal(extracellularOverlapCount(actors), 1);
  const result = relaxExtracellular(actors, { maxDelta: Infinity, passes: 6 });
  assert.equal(result.remaining, 0);
  assert.ok(result.moved > 0);
  assert.deepEqual(
    actors.map((a) => a.anchor),
    before,
  );
  assert.ok(actors.every((a) => Math.abs(a.angle) <= 45));
});
test("isolated domains and locked receptors retain their angles", () => {
  const isolated = [receptor("a", 0, { angle: 12 }), receptor("b", 200)];
  assert.deepEqual(relaxExtracellular(isolated), { moved: 0, remaining: 0 });
  const actors = [receptor("a", 0, { locked: true }), receptor("b", 14)];
  assert.equal(
    relaxExtracellular(actors, { maxDelta: Infinity, passes: 6 }).remaining,
    0,
  );
  assert.equal(actors[0].angle, 0);
  assert.equal(actors[0].saved, undefined);
});
test("insufficient bend range reports overlap and never exceeds its limit", () => {
  const actors = [receptor("a", 0), receptor("b", 1)];
  assert.ok(
    relaxExtracellular(actors, { maxAngle: 5, maxDelta: Infinity, passes: 6 })
      .remaining > 0,
  );
  assert.ok(
    actors.every((a) => Number.isFinite(a.angle) && Math.abs(a.angle) <= 5),
  );
});
test("per-frame bend changes are bounded and repeated relaxation stays finite", () => {
  const actors = [receptor("a", 0), receptor("b", 14), receptor("c", 28)];
  for (let step = 0; step < 10; step++) {
    const before = actors.map((a) => a.angle);
    relaxExtracellular(actors, { maxDelta: 6 });
    actors.forEach((a, i) =>
      assert.ok(Number.isFinite(a.angle) && Math.abs(a.angle - before[i]) <= 6),
    );
  }
});
test("manually bent receptors outside automatic limit are handled without discontinuous reset", () => {
  const actors = [
    receptor("a", 0, { angle: 55 }),
    receptor("b", 0, { angle: 55 }),
  ];
  relaxExtracellular(actors, { maxAngle: 30, maxDelta: 6 });
  assert.ok(actors.every((a) => a.angle >= 49 && a.angle <= 55));
});
test("native TCR, CD4 and CD8 expose extracellular geometry on the correct side", () => {
  for (const [file, p] of [
    ["basic_13_TCR_CD3_user.svg", { x: 0, y: 0, span: 34, angle: 0 }],
    ["basic_14_TCR_CD8.svg", { x: -30, y: 0, span: 34, angle: 0 }],
    [
      "basic_150_CD4_coreceptor_four_domains.svg",
      { x: -145, y: 0, span: 34, angle: 180 },
    ],
    ["basic_15_CD8_coreceptor.svg", { x: 0, y: 0, span: 34, angle: 0 }],
  ]) {
    const svg = readFileSync(
      new URL(
        "../public/library/02_HLA_peptiden_en_receptoren/" + file,
        import.meta.url,
      ),
      "utf8",
    );
    const root = new JSDOM(svg, { contentType: "image/svg+xml" }).window
      .document.documentElement;
    const polygons = sourceEctodomains(root, p),
      dir = p.angle === 180 ? 1 : -1;
    assert.ok(polygons.length > 0, file);
    for (const polygon of polygons)
      for (const point of polygon) {
        assert.ok(dir * (point[1] - p.y - (dir * p.span) / 2) >= -1e-8, file);
        assert.ok(point.every(Number.isFinite));
      }
  }
});

test("real native receptors follow curved membranes with fixed anchors and perpendicular stems", () => {
  const dom = new JSDOM(""),
    previous = globalThis.DOMParser;
  globalThis.DOMParser = dom.window.DOMParser;
  try {
    for (const file of [
      "basic_13_TCR_CD3_user.svg",
      "basic_150_CD4_coreceptor_four_domains.svg",
      "basic_15_CD8_coreceptor.svg",
    ]) {
      const svg = readFileSync(
        new URL(
          "../public/library/02_HLA_peptiden_en_receptoren/" + file,
          import.meta.url,
        ),
        "utf8",
      );
      const root = new dom.window.DOMParser().parseFromString(
        svg,
        "image/svg+xml",
      ).documentElement;
      const vb = root
          .getAttribute("viewBox")
          .split(/[\s,]+/)
          .map(Number),
        scale = 0.3;
      const items = [0, 1].map((n) => {
        const item = {
          id: String(n),
          svg,
          sourceFile: file,
          w: vb[2] * scale,
          h: vb[3] * scale,
        };
        const p = receptorAnchorProfile(item);
        item.anchor2d = {
          u: 0.49 + n * 0.02,
          pivotX: p.pivotX,
          pivotY: p.pivotY,
          angle: p.angle,
          side: 1,
          tilt: 15,
          offset: 0,
        };
        return item;
      });
      const matrix = {
        a: scale,
        b: 0,
        c: 0,
        d: scale,
        e: -vb[0] * scale,
        f: -vb[1] * scale,
      };
      const liveRoot = { getScreenCTM: () => matrix };
      const art = {
        getScreenCTM: () => ({ inverse: () => ({ multiply: (m) => m }) }),
        querySelector: () => liveRoot,
      };
      const drawing = {
        svg: { querySelector: () => ({ querySelector: () => art }) },
      };
      const contour = {
        closed: false,
        points: [
          [0, 0],
          [300, 0],
        ],
      };
      const controller = prepareAutomaticEctodomains(
        drawing,
        contour,
        items,
        [],
      );
      assert.equal(controller.count, 2, file);
      const initial = items.map((i) => ({ ...i.anchor2d }));
      let moved = 0;
      for (const points of [
        contour.points,
        [
          [0, 0],
          [130, 35],
          [300, 0],
        ],
        [
          [0, 0],
          [130, -25],
          [300, 0],
        ],
      ]) {
        const before = JSON.stringify(points);
        moved += controller.relax(points, {
          gap: 3,
          maxAngle: 45,
          maxDelta: Infinity,
          passes: 6,
        }).moved;
        assert.equal(JSON.stringify(points), before);
        items.forEach((item, n) => {
          const { tilt, ectoBend, ...anchor } = item.anchor2d;
          const { tilt: oldTilt, ...oldAnchor } = initial[n];
          assert.deepEqual(anchor, oldAnchor);
          assert.equal(tilt, 0);
          const frame = contourFrame(points, anchor.u, false),
            pose = anchoredPose(item, frame, item.anchor2d);
          const axis = ((pose.rotation - (anchor.angle || 0)) * Math.PI) / 180;
          assert.ok(
            Math.abs(
              Math.sin(axis) * frame.tangent[0] -
                Math.cos(axis) * frame.tangent[1],
            ) < 1e-9,
          );
        });
      }
      assert.ok(moved > 0, file);
    }
  } finally {
    if (previous === undefined) delete globalThis.DOMParser;
    else globalThis.DOMParser = previous;
    dom.window.close();
  }
});

test("embedded receptors receive absolute bends without changing anchor positions or native SVG", () => {
  const dom = new JSDOM(
    '<svg xmlns="http://www.w3.org/2000/svg"><g><path fill="blue" d="M-12 -55L12 -55L12 -30L-12 -30Z"/></g></svg>',
    { contentType: "image/svg+xml" },
  );
  const source = dom.window.document.querySelector("g"),
    before = source.outerHTML;
  const anchors = [0, 1].map((n) => ({
    stemProfile: { ...profile, extracellular: true },
    sourceStem: source,
    stemMatrix: { a: 1, b: 0, c: 0, d: 1 },
    stemAxisAngle: -Math.PI / 2,
    side: 1,
    initialTilt: 12,
    initialEctoBend: 5,
    proxy: {
      id: String(n),
      w: 24,
      h: 60,
      anchor2d: { u: 0.48 + n * 0.04, side: 1, tilt: 0, ectoBend: 0 },
    },
  }));
  const contour = {
    closed: false,
    points: [
      [0, 0],
      [300, 0],
    ],
  };
  const controller = prepareAutomaticEctodomains({}, contour, [], anchors);
  const result = controller.relax(contour.points, {
    maxDelta: Infinity,
    passes: 6,
  });
  syncEmbeddedReceptors(anchors);
  assert.ok(result.moved > 0);
  assert.ok(
    anchors.every(
      (a, n) =>
        a.u === 0.48 + n * 0.04 && a.tilt === 0 && Number.isFinite(a.ectoBend),
    ),
  );
  assert.equal(source.outerHTML, before);
  dom.window.close();
});

test("automatic bending controls exclude sliding and persist their limit across reopening", () => {
  const dom = new JSDOM("<body/>", { url: "http://localhost/?qa=1" });
  const values = {
    window: dom.window,
    document: dom.window.document,
    location: dom.window.location,
    localStorage: dom.window.localStorage,
    innerWidth: 1280,
    innerHeight: 720,
  };
  const previous = new Map(
    Object.keys(values).map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  for (const [key, value] of Object.entries(values))
    Object.defineProperty(globalThis, key, {
      value,
      writable: true,
      configurable: true,
    });
  try {
    const drawing = {
      sculptOptions: {},
      selectedItems: () => [],
      doc: { items: [] },
      embeddedReceptorCount: () => 0,
    };
    let menu = new FloatingDrawingTools(drawing);
    const input = (key, value) => {
      const field = menu.element.querySelector(`[data-sculpt-option="${key}"]`);
      if (field.type === "checkbox") field.checked = value;
      else field.value = value;
      field.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
      return field;
    };
    assert.equal(
      menu.element.querySelector('[data-sculpt-option="autoEctoLimit"]')
        .disabled,
      true,
    );
    input("autoSpread", true);
    input("autoEcto", true);
    assert.equal(drawing.sculptOptions.autoSpread, false);
    assert.equal(
      menu.element.querySelector('[data-sculpt-option="autoSpread"]').checked,
      false,
    );
    assert.equal(
      menu.element.querySelector('[data-sculpt-option="autoEctoLimit"]')
        .disabled,
      false,
    );
    input("autoEctoLimit", "35");
    menu.element.remove();
    menu = new FloatingDrawingTools(drawing);
    assert.equal(drawing.sculptOptions.autoEcto, true);
    assert.equal(drawing.sculptOptions.autoEctoLimit, 35);
    input("autoSpread", true);
    assert.equal(drawing.sculptOptions.autoEcto, false);
    assert.equal(
      menu.element.querySelector('[data-sculpt-option="autoEctoLimit"]')
        .disabled,
      true,
    );
  } finally {
    dom.window.close();
    for (const [key, descriptor] of previous)
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
  }
});
