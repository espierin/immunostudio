import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { createAutosave } from "../src/autosave.js";
import { Drawing2D, newSheet } from "../src/drawing2d.js";
import { sheetActionEnabled } from "../src/sheet-actions.js";
import { CommandPalette } from "../src/command-palette.js";
import { searchStructures } from "../src/structures.js";
import { zoomViewport, selectionViewport } from "../src/page-layout.js";

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
const settle = () => new Promise((resolve) => queueMicrotask(resolve));
test("older autosave completion cannot mark a newer edit saved, and hiding the page flushes the latest snapshot", async () => {
  let value = 1,
    timer,
    saved = 0;
  const writes = [];
  const saver = createAutosave({
    snapshot: () => ({ value }),
    write: (data) => {
      const operation = deferred();
      writes.push({ data, ...operation });
      return operation.promise;
    },
    onSaved: () => saved++,
    setTimer: (fn) => {
      timer = fn;
      return 1;
    },
    clearTimer: () => {},
  });
  saver.schedule();
  timer();
  value = 2;
  saver.schedule();
  writes[0].resolve();
  await settle();
  assert.equal(saved, 0);
  saver.flush();
  assert.deepEqual(
    writes.map((w) => w.data),
    [{ value: 1 }, { value: 2 }],
  );
  writes[1].resolve();
  await settle();
  assert.equal(saved, 1);
  saver.flush();
  assert.equal(writes.length, 2);
});
test("autosave failures retain the pending project for retry instead of reporting it saved", async () => {
  let count = 0,
    errors = 0,
    saved = 0;
  const saver = createAutosave({
    snapshot: () => ({ value: 7 }),
    write: () => {
      if (!count++) throw Error("quota");
      return Promise.resolve();
    },
    onError: () => errors++,
    onSaved: () => saved++,
    setTimer: () => 1,
    clearTimer: () => {},
  });
  saver.schedule();
  saver.flush();
  assert.equal(errors, 1);
  assert.equal(saved, 0);
  saver.flush();
  await settle();
  assert.equal(saved, 1);
});

const rect = (id, extra = {}) => ({
  id,
  kind: "rect",
  x: 10,
  y: 20,
  w: 40,
  h: 50,
  visible: true,
  opacity: 1,
  ...extra,
});
function drawing(items, selected = items.map((i) => i.id)) {
  let changes = 0;
  const statuses = [];
  const value = {
    doc: { ...newSheet(), items },
    selected,
    clipboard: [],
    selectedItems() {
      return this.doc.items.filter((i) => this.selected.includes(i.id));
    },
    beforeChange() {
      changes++;
    },
    notify() {},
    sculptCommand: () => false,
    onStatus: (message) => statuses.push(message),
  };
  value.command = (cmd) => Drawing2D.prototype.command.call(value, cmd);
  return { value, statuses, changes: () => changes };
}
test("duplicated groups stay grouped with new IDs and pasted copies receive successive offsets", () => {
  const { value: d } = drawing([
    rect("a", { groupId: "old" }),
    rect("b", { groupId: "old" }),
  ]);
  d.command("duplicate");
  const copies = d.selectedItems();
  assert.equal(copies.length, 2);
  assert.equal(copies[0].groupId, copies[1].groupId);
  assert.notEqual(copies[0].groupId, "old");
  d.command("copy");
  const x = copies[0].x;
  d.command("paste");
  assert.equal(d.selectedItems()[0].x, x + 25);
  d.command("paste");
  assert.equal(d.selectedItems()[0].x, x + 50);
});
test("a duplicated membrane receptor retains its attachment but moves along the membrane; copied membrane references are remapped", () => {
  const host = rect("host"),
    receptor = rect("receptor", { anchor2d: { targetId: "host", u: 0.3 } });
  const { value: d } = drawing([host, receptor], ["receptor"]);
  d.command("duplicate");
  assert.equal(d.selectedItems()[0].anchor2d.targetId, "host");
  assert.notEqual(d.selectedItems()[0].anchor2d.u, 0.3);
  d.selected = ["host", "receptor"];
  d.command("duplicate");
  const pair = d.selectedItems();
  assert.equal(pair[1].anchor2d.targetId, pair[0].id);
  assert.equal(pair[1].anchor2d.u, 0.3);
});
test("empty or oversized duplicate and paste operations leave the document and undo history untouched", () => {
  const empty = drawing([], []);
  empty.value.command("paste");
  empty.value.command("duplicate");
  assert.equal(empty.changes(), 0);
  const full = drawing(
    Array.from({ length: 4000 }, (_, i) => rect(String(i))),
    ["0"],
  );
  full.value.command("duplicate");
  assert.equal(full.value.doc.items.length, 4000);
  assert.equal(full.changes(), 0);
  assert.match(full.statuses[0], /4000/);
  assert.equal(Drawing2D.prototype.add.call(full.value, rect("extra")), null);
  assert.equal(full.value.doc.items.length, 4000);
  assert.equal(full.changes(), 0);
});
test("drawing menus expose only usable operations for the selection and clipboard", () => {
  const doc = { items: [rect("a"), rect("b"), rect("c", { locked: true })] };
  assert.equal(sheetActionEnabled(doc, [], [], "paste"), false);
  assert.equal(sheetActionEnabled(doc, ["a"], [], "group"), false);
  assert.equal(sheetActionEnabled(doc, ["a", "b"], [], "group"), true);
  assert.equal(
    sheetActionEnabled(doc, ["a", "b", "c"], [], "distribute-x"),
    false,
  );
  assert.equal(sheetActionEnabled(doc, ["c"], [], "copy"), true);
  assert.equal(sheetActionEnabled(doc, ["c"], [], "duplicate"), false);
  assert.equal(sheetActionEnabled(doc, [], [], "pathway-detach"), false);
});

test("Copy immediately refreshes Paste availability without adding an undo step", () => {
  const { value: d, changes } = drawing([rect("a")]);
  let refreshed = false;
  d.onSelect = () => {
    refreshed = sheetActionEnabled(d.doc, d.selected, d.clipboard, "paste");
  };
  d.command("copy");
  assert.equal(refreshed, true);
  assert.equal(changes(), 0);
});
test("command search skips disabled entries and reports asynchronous action failures", async () => {
  const dom = new JSDOM("<!doctype html>");
  globalThis.document = dom.window.document;
  dom.window.HTMLElement.prototype.scrollIntoView = function () {};
  const errors = [],
    palette = new CommandPalette(
      () => [
        { label: "Disabled", disabled: true },
        { label: "First" },
        { label: "Disabled next", disabled: true },
        { label: "Last" },
      ],
      (e) => errors.push(e.message),
    );
  palette.index = 0;
  palette.render();
  assert.equal(palette.index, 1);
  palette.dialog.setAttribute("open", "");
  palette.dialog.close = () => palette.dialog.removeAttribute("open");
  document.dispatchEvent(
    new dom.window.KeyboardEvent("keydown", { key: "ArrowDown" }),
  );
  assert.equal(palette.index, 3);
  palette.run({
    run: async () => {
      throw Error("test failure");
    },
  });
  await settle();
  assert.deepEqual(errors, ["test failure"]);
  dom.window.close();
  delete globalThis.document;
});

test("cancelled PDB metadata requests stop instead of returning stale search results", async () => {
  const controller = new AbortController(),
    started = deferred();
  const result = searchStructures("CCR5", {
    signal: controller.signal,
    fetcher: async (url, options) => {
      if (url.includes("/rcsbsearch/"))
        return {
          ok: true,
          json: async () => ({ result_set: [{ identifier: "4MBS" }] }),
        };
      started.resolve();
      return new Promise((resolve, reject) =>
        options.signal.addEventListener(
          "abort",
          () => reject(options.signal.reason),
          { once: true },
        ),
      );
    },
  });
  await started.promise;
  controller.abort();
  await assert.rejects(result, (error) => error.name === "AbortError");
});

test("toolbar zoom keeps the view centre fixed and never zooms out when zooming in after Fit selection", () => {
  const sheet = { width: 1600, height: 900, zoom: 2, panX: -100, panY: 40 };
  const centre = (s) => [
    -s.panX + s.width / s.zoom / 2,
    -s.panY + s.height / s.zoom / 2,
  ];
  const next = { ...sheet, ...zoomViewport(sheet, 1.25) };
  centre(sheet).forEach((v, k) =>
    assert.ok(Math.abs(v - centre(next)[k]) < 1e-9),
  );
  const fitted = {
    ...sheet,
    ...selectionViewport(sheet, { x: 400, y: 200, w: 10, h: 10 }),
  };
  assert.ok(zoomViewport(fitted, 1.25).zoom >= fitted.zoom);
  const point = { x: 850, y: 500 },
    pointerZoom = zoomViewport(sheet, 1.12, point);
  assert.ok(
    Math.abs(
      (point.x + sheet.panX) * sheet.zoom -
        (point.x + pointerZoom.panX) * pointerZoom.zoom,
    ) < 1e-9,
  );
});
