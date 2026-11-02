import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { starterProject } from "../src/starter-projects.js";
import { validateProject, arcTable, arcT } from "../src/model.js";
import { selectionViewport, pageFormats } from "../src/page-layout.js";
const dom = new JSDOM(
  '<!doctype html><div id="app"></div><select id="interface-language"><option value="en">English</option><option value="nl">Nederlands</option></select>',
  { url: "https://example.test/?qa=1" },
);
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  location: dom.window.location,
  localStorage: dom.window.localStorage,
});
const { OpeningPage, hasArtwork } = await import("../src/opening-page.js");
const { searchCommands } = await import("../src/command-palette.js");
test("editable starters validate and do not add a default 3D membrane", () => {
  for (const kind of ["membrane", "tissues"]) {
    const p = validateProject(JSON.parse(JSON.stringify(starterProject(kind))));
    assert.equal(p.editorMode, "2d");
    assert.equal(p.items.length, 0);
    assert.ok(p.sheet.items.length > 0);
  }
  const p = starterProject("membrane", {
    svg: '<svg xmlns="http://www.w3.org/2000/svg"><circle r="10"/></svg>',
    file: "test.svg",
    title: "Test receptor",
  });
  assert.doesNotThrow(() => validateProject(p));
  assert.equal(p.sheet.items[1].anchor2d.targetId, p.sheet.items[0].id);
  assert.throws(() => starterProject("unknown"));
});
test("home resume never clears current artwork and exposes only the home while open", () => {
  const p = starterProject("tissues"),
    before = JSON.stringify(p);
  let resumed = 0;
  const home = new OpeningPage({
    resume: () => resumed++,
    create: () => {},
    open: () => {},
  });
  home.update(p);
  assert.equal(
    home.element.querySelector("[data-current-count]").textContent,
    "6",
  );
  assert.equal(document.querySelector("#app").inert, true);
  assert.equal(hasArtwork(p), true);
  home.element.querySelector('[data-home="resume"]').click();
  assert.equal(resumed, 1);
  assert.equal(document.querySelector("#app").inert, false);
  assert.equal(JSON.stringify(p), before);
  home.element.remove();
});
test("command search accepts both English and Dutch names and accentless text", () => {
  const commands = [
    { label: "Bézierlijn bewerken", keywords: "curve" },
    { label: "Werkruimte herstellen", keywords: "reset layout" },
    { label: "Focusmodus" },
  ];
  assert.equal(searchCommands(commands, "bezier")[0], commands[0]);
  assert.equal(searchCommands(commands, "edit bezier")[0], commands[0]);
  assert.equal(searchCommands(commands, "werkruimte")[0], commands[1]);
  assert.equal(searchCommands(commands, "reset layout").length, 1);
  assert.equal(searchCommands(commands, "missing").length, 0);
});
test("fit selection centres transformed bounds without mutating object coordinates", () => {
  const sheet = { width: 1600, height: 900 },
    box = { x: 400, y: 200, w: 300, h: 100 },
    view = selectionViewport(sheet, box);
  assert.ok(
    Math.abs(-view.panX + sheet.width / view.zoom / 2 - (box.x + box.w / 2)) <
      1e-8,
  );
  assert.ok(
    Math.abs(-view.panY + sheet.height / view.zoom / 2 - (box.y + box.h / 2)) <
      1e-8,
  );
  assert.ok(view.zoom > 1);
  assert.deepEqual(pageFormats.slide, [1600, 900]);
});
test("binary arc lookup matches the prior linear interpolation, including endpoints and zero-length curves", () => {
  const table = arcTable([
    [0, 0],
    [30, 180],
    [180, -100],
    [300, 40],
  ]);
  for (let i = 0; i <= 200; i++) {
    const u = i / 200,
      target = u * table.length,
      index = table.rows.findIndex((r) => r.s >= target),
      a = table.rows[Math.max(0, index - 1)],
      b = table.rows[Math.max(0, index)],
      reference =
        index <= 0
          ? 0
          : a.t + ((b.t - a.t) * (target - a.s)) / (b.s - a.s || 1);
    assert.ok(Math.abs(arcT(table, u) - reference) < 1e-12);
  }
  assert.equal(
    arcT(
      arcTable([
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0],
      ]),
      0.8,
    ),
    0,
  );
});
