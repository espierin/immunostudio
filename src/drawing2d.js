import { uid, clone } from "./model.js";
import { recolorSourceColor } from "./palettes.js";
import { isCellElement, enhanceCellVector } from "./cell-look.js";
import { membraneMarkup, membranePoints } from "./membrane2d.js";
import { closestCurveT, splitBezier } from "./model.js";
const NS = "http://www.w3.org/2000/svg";
const escape = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function newSheet() {
  return {
    version: 1,
    width: 1600,
    height: 900,
    background: "#FFFFFF",
    zoom: 1,
    panX: 0,
    panY: 0,
    grid: false,
    snap: true,
    items: [],
  };
}
export function sheetBounds(items) {
  if (!items.length) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const i of items) {
    const a = ((i.rotation || 0) * Math.PI) / 180,
      c = Math.cos(a),
      s = Math.sin(a),
      cx = i.x + i.w / 2,
      cy = i.y + i.h / 2;
    for (const [x, y] of [
      [-i.w / 2, -i.h / 2],
      [i.w / 2, -i.h / 2],
      [i.w / 2, i.h / 2],
      [-i.w / 2, i.h / 2],
    ]) {
      const px = cx + x * c - y * s,
        py = cy + x * s + y * c;
      minX = Math.min(minX, px);
      minY = Math.min(minY, py);
      maxX = Math.max(maxX, px);
      maxY = Math.max(maxY, py);
    }
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
export function alignItems(items, alignment) {
  if (items.length < 2) return;
  const b = sheetBounds(items);
  for (const i of items) {
    const own = sheetBounds([i]);
    if (alignment === "left") i.x += b.x - own.x;
    if (alignment === "right") i.x += b.x + b.w - own.w - own.x;
    if (alignment === "center") i.x += b.x + (b.w - own.w) / 2 - own.x;
    if (alignment === "top") i.y += b.y - own.y;
    if (alignment === "bottom") i.y += b.y + b.h - own.h - own.y;
    if (alignment === "middle") i.y += b.y + (b.h - own.h) / 2 - own.y;
  }
}
export function distributeItems(items, axis) {
  if (items.length < 3) return;
  const key = axis === "x" ? "x" : "y",
    size = axis === "x" ? "w" : "h",
    sorted = [...items].sort((a, b) => a[key] - b[key]),
    first = sorted[0][key],
    last = sorted.at(-1)[key] + sorted.at(-1)[size],
    total = sorted.reduce((n, i) => n + i[size], 0),
    gap = (last - first - total) / (items.length - 1);
  let cursor = first;
  for (const item of sorted) {
    item[key] = cursor;
    cursor += item[size] + gap;
  }
}
export function sanitizedSVG(text, prefix = "asset") {
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  if (
    doc.querySelector("parsererror") ||
    doc.documentElement.tagName.toLowerCase() !== "svg"
  )
    throw Error("Ongeldige SVG-bouwsteen.");
  for (const node of doc.querySelectorAll(
    "script,foreignObject,iframe,object,embed",
  ))
    node.remove();
  const ids = new Map();
  for (const n of doc.querySelectorAll("[id]"))
    ids.set(n.id, prefix + "-" + n.id);
  for (const n of doc.querySelectorAll("*")) {
    for (const a of [...n.attributes]) {
      if (/^on/i.test(a.name)) {
        n.removeAttribute(a.name);
        continue;
      }
      let value = a.value;
      if (
        /(?:href|src)$/i.test(a.name) &&
        value &&
        !value.startsWith("#") &&
        !value.startsWith("data:image/")
      ) {
        n.removeAttribute(a.name);
        continue;
      }
      for (const [old, id] of ids) {
        value = value.split("url(#" + old + ")").join("url(#" + id + ")");
        if (value === "#" + old) value = "#" + id;
        if (a.name === "id" && value === old) value = id;
      }
      if (/url\(\s*['"]?(?:https?:|file:|javascript:)/i.test(value)) {
        n.removeAttribute(a.name);
        continue;
      }
      n.setAttribute(a.name, value);
    }
  }
  return new XMLSerializer().serializeToString(doc.documentElement);
}
function sourceSize(svg) {
  const d = new DOMParser().parseFromString(
    svg,
    "image/svg+xml",
  ).documentElement;
  const box = (d.getAttribute("viewBox") || "").split(/[ ,]+/).map(Number);
  return box.length === 4 && box[2] > 0 && box[3] > 0
    ? [box[2], box[3]]
    : [+d.getAttribute("width") || 600, +d.getAttribute("height") || 600];
}
export class Drawing2D {
  constructor(
    host,
    {
      beforeChange = () => {},
      onChange = () => {},
      onSelect = () => {},
      onStatus = () => {},
    } = {},
  ) {
    this.host = host;
    this.beforeChange = beforeChange;
    this.onChange = onChange;
    this.onSelect = onSelect;
    this.onStatus = onStatus;
    this.doc = newSheet();
    this.selected = [];
    this.tool = "select";
    this.clipboard = [];
    this.cache = new Map();
    this.style = { label: "#064986", hla: "#FF5A36", head: "#A9C6E2" };
    this.svg = document.createElementNS(NS, "svg");
    this.svg.setAttribute("aria-label", "2D tekenblad");
    this.svg.setAttribute("tabindex", "0");
    this.svg.classList.add("sheet-canvas");
    host.append(this.svg);
    this.bind();
    this.resize = new ResizeObserver(() => this.render());
    this.resize.observe(host);
    this.render();
  }
  setDocument(doc, style, labelsVisible = true) {
    this.labelsVisible = labelsVisible;
    this.doc = doc || newSheet();
    this.style = style || this.style;
    if (!this.doc.customBackground)
      this.doc.background = this.style.ui ? this.style.background : "#FFFFFF";
    for (const item of this.doc.items) {
      if (item.kind === "svg") {
        if (item.volumeLook === undefined && isCellElement(item))
          item.volumeLook = true;
        continue;
      }
      if (!item.customFill)
        item.fill = item.kind === "text" ? this.style.label : this.style.head;
      if (!item.customStroke) item.stroke = this.style.label;
    }
    this.selected = this.selected.filter((id) =>
      this.doc.items.some((i) => i.id === id),
    );
    this.render();
  }
  notify() {
    this.render();
    this.onChange(this.doc);
    this.onSelect(this.selected);
  }
  selectedItems() {
    return this.doc.items.filter((i) => this.selected.includes(i.id));
  }
  setTool(tool) {
    this.tool = tool;
    this.svg.dataset.tool = tool;
    document
      .querySelectorAll("[data-sheet-tool]")
      .forEach((b) =>
        b.classList.toggle("active", b.dataset.sheetTool === tool),
      );
    this.onStatus(
      tool === "rotate"
        ? "2D: sleep rond de selectie om te draaien; Shift voor stappen van 15°."
        : tool === "move"
          ? "2D: sleep een element om het te verplaatsen."
          : tool === "select"
            ? "2D: selecteren, slepen en hoekpunten schalen."
            : "2D: " + tool + " tekenen.",
    );
  }
  select(ids) {
    this.selected = [...new Set(ids)];
    this.render();
    this.onSelect(this.selected);
  }
  add(item) {
    this.beforeChange();
    const n = {
      id: uid(),
      name: "Bouwsteen",
      x: this.doc.width / 2 - 100,
      y: this.doc.height / 2 - 100,
      w: 200,
      h: 200,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      fill: this.style.head,
      stroke: this.style.label,
      strokeWidth: 3,
      ...item,
    };
    this.doc.items.push(n);
    this.selected = [n.id];
    this.notify();
    return n;
  }
  addSVG(text, name, sourceFile) {
    const svg = sanitizedSVG(text, "source"),
      [w, h] = sourceSize(svg),
      width = Math.min(330, Math.max(240, w / 2)),
      height = (width * h) / w;
    return this.add({
      kind: "svg",
      name,
      svg,
      sourceFile,
      volumeLook: isCellElement({ name, sourceFile }),
      w: width,
      h: height,
    });
  }
  point(e) {
    const p = this.svg.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    return p.matrixTransform(this.svg.getScreenCTM().inverse());
  }
  snap(n) {
    return this.doc.snap ? Math.round(n / 5) * 5 : n;
  }
  render() {
    const d = this.doc;
    if (!d) return;
    this.svg.setAttribute(
      "viewBox",
      `${-d.panX} ${-d.panY} ${d.width / d.zoom} ${d.height / d.zoom}`,
    );
    const defs = `<defs><pattern id="sheet-grid" width="25" height="25" patternUnits="userSpaceOnUse"><path d="M25 0H0V25" fill="none" stroke="#A9C6E2" stroke-width=".5"/></pattern></defs>`;
    let html =
      defs +
      `<rect class="sheet-page" x="0" y="0" width="${d.width}" height="${d.height}" fill="${d.background}" stroke="#bdcbd6" stroke-width="1"/>` +
      (d.grid
        ? `<rect width="${d.width}" height="${d.height}" fill="url(#sheet-grid)" pointer-events="none"/>`
        : "");
    for (const i of d.items) {
      if (!i.visible || (i.kind === "text" && this.labelsVisible === false))
        continue;
      html += `<g data-entity="${i.id}" opacity="${i.opacity}" transform="translate(${i.x + i.w / 2} ${i.y + i.h / 2}) rotate(${i.rotation || 0}) translate(${-i.w / 2} ${-i.h / 2})"><rect width="${i.w}" height="${i.h}" fill="transparent" stroke="none"/>${this.itemMarkup(i)}</g>`;
    }
    const selected = this.selectedItems();
    if (selected.length) {
      const box = sheetBounds(selected),
        scale =
          1 /
          Math.max(
            0.01,
            Math.hypot(
              this.svg.getScreenCTM()?.a || 1,
              this.svg.getScreenCTM()?.b || 0,
            ),
          );
      html += `<g class="sheet-selection" fill="#fff" stroke="#0077b6" stroke-width="${1.5 * scale}"><rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="none" stroke-dasharray="${5 * scale} ${3 * scale}" pointer-events="none"/>`;
      if (selected.length === 1 && !selected[0].locked) {
        const i = selected[0],
          cx = i.x + i.w / 2,
          cy = i.y + i.h / 2;
        html += `<g transform="rotate(${i.rotation || 0} ${cx} ${cy})">`;
        if (i.kind === "membrane") {
          const points = membranePoints(i);
          html += `<polyline points="${points.map(([x, y]) => [i.x + x, i.y + y].join(",")).join(" ")}" fill="none" stroke="#e5a475" stroke-dasharray="4 4"/>`;
          points.forEach(
            ([x, y], index) =>
              (html += `<circle data-curve-handle="${index}" cx="${i.x + x}" cy="${i.y + y}" r="${(index % 3 === 0 ? 7 : 5) * scale}" fill="${index % 3 === 0 ? "#0077b6" : "#ff9a5e"}" stroke="white"/>`),
          );
        }
        for (const [handle, x, y] of [
          ["nw", i.x, i.y],
          ["ne", i.x + i.w, i.y],
          ["se", i.x + i.w, i.y + i.h],
          ["sw", i.x, i.y + i.h],
        ])
          html += `<rect data-sheet-handle="${handle}" x="${x - 5 * scale}" y="${y - 5 * scale}" width="${10 * scale}" height="${10 * scale}"/>`;
        html += `<line x1="${cx}" y1="${i.y}" x2="${cx}" y2="${i.y - 30 * scale}"/><circle data-sheet-handle="rotate" cx="${cx}" cy="${i.y - 30 * scale}" r="${6 * scale}"/></g>`;
      }
      html += "</g>";
    }
    if (this.marquee)
      html += `<rect x="${this.marquee.x}" y="${this.marquee.y}" width="${this.marquee.w}" height="${this.marquee.h}" fill="#0077b610" stroke="#0077b6" stroke-dasharray="5 3"/>`;
    this.svg.innerHTML = html;
  }
  itemMarkup(i) {
    if (i.kind === "membrane") return membraneMarkup(i, this.style);
    const fill = i.fill || "none",
      stroke = i.stroke || "none",
      sw = i.strokeWidth ?? 3;
    if (i.kind === "svg") {
      const key =
        i.id +
        "|" +
        i.svg +
        "|" +
        JSON.stringify(this.style) +
        "|" +
        this.labelsVisible +
        "|" +
        i.volumeLook;
      let markup = this.cache.get(key);
      if (!markup) {
        markup = sanitizedSVG(i.svg, i.id);
        if (this.labelsVisible === false) {
          const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
          for (const n of doc.querySelectorAll("text,tspan")) n.remove();
          markup = new XMLSerializer().serializeToString(doc.documentElement);
        }
        markup = markup.replace(/#[0-9a-f]{6}\b/gi, (hex) =>
          recolorSourceColor(hex, this.style),
        );
        if (i.volumeLook) markup = enhanceCellVector(markup, i.id);
        this.cache.set(key, markup);
      }
      return markup.replace(
        /<svg\b([^>]*)>/,
        (tag, attrs) =>
          "<svg " +
          attrs.replace(/\s(?:width|height|x|y)="[^"]*"/g, "") +
          ' x="0" y="0" width="' +
          i.w +
          '" height="' +
          i.h +
          '">',
      );
    }
    if (i.kind === "text" && this.labelsVisible === false) return "";
    if (i.kind === "text") {
      const lines = (i.text || "Label").split("\n");
      return `<text font-family="Calibri,Arial,sans-serif" font-size="${i.fontSize || 36}" font-weight="${i.bold ? "700" : "400"}" fill="${i.fill || this.style.label}" x="0" y="${i.fontSize || 36}">${lines.map((line, n) => `<tspan x="0" dy="${n ? (i.fontSize || 36) * 1.2 : 0}">${escape(line)}</tspan>`).join("")}</text>`;
    }
    if (i.kind === "rect")
      return `<rect width="${i.w}" height="${i.h}" rx="${i.radius || 0}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
    if (i.kind === "ellipse")
      return `<ellipse cx="${i.w / 2}" cy="${i.h / 2}" rx="${i.w / 2}" ry="${i.h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
    if (i.kind === "line" || i.kind === "arrow") {
      const [x1, y1, x2, y2] = [
          i.flipX ? i.w : 0,
          i.flipY ? i.h : 0,
          i.flipX ? 0 : i.w,
          i.flipY ? 0 : i.h,
        ],
        arrow = i.kind === "arrow";
      return (
        (arrow
          ? `<defs><marker id="arrow-${i.id}" markerWidth="9" markerHeight="8" refX="8.5" refY="4" orient="auto" markerUnits="strokeWidth"><path d="M0 0L9 4L0 8Z" fill="${stroke}"/></marker></defs>`
          : "") +
        `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${sw}" stroke-dasharray="${i.dashed ? "10 7" : "none"}" stroke-linecap="round" ${arrow ? `marker-end="url(#arrow-${i.id})"` : ""}/>`
      );
    }
    if (i.kind === "path")
      return `<path d="${escape(i.path || "")}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
    return "";
  }
  bind() {
    let interaction = null;
    this.svg.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 && e.button !== 1) return;
      e.preventDefault();
      e.stopPropagation();
      const p = this.point(e),
        hit = e.target.closest("[data-entity]")?.dataset.entity,
        handle = e.target.closest("[data-sheet-handle]")?.dataset.sheetHandle,
        curveHandle = e.target.closest("[data-curve-handle]")?.dataset
          .curveHandle;
      this.svg.focus();
      this.svg.setPointerCapture(e.pointerId);
      if (this.tool === "pan" || e.button === 1 || e.altKey) {
        interaction = {
          type: "pan",
          start: p,
          panX: this.doc.panX,
          panY: this.doc.panY,
        };
        return;
      }
      if (handle) {
        this.beforeChange();
        interaction = {
          type: handle,
          start: p,
          original: clone(this.selectedItems()[0]),
        };
        return;
      }
      if (curveHandle !== undefined) {
        this.beforeChange();
        interaction = {
          type: "curve-point",
          index: +curveHandle,
          start: p,
          original: clone(this.selectedItems()[0]),
        };
        return;
      }
      if (this.tool === "rotate") {
        if (hit && !this.selected.includes(hit)) this.selected = [hit];
        const originals = clone(this.selectedItems().filter((i) => !i.locked));
        if (!originals.length) return;
        const bounds = sheetBounds(originals),
          center = { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 };
        this.beforeChange();
        interaction = {
          type: "rotate-selection",
          start: p,
          originals,
          center,
          startAngle: Math.atan2(p.y - center.y, p.x - center.x),
        };
        this.render();
        this.onSelect(this.selected);
        return;
      }
      if (!["select", "move"].includes(this.tool)) {
        this.beforeChange();
        const kind = this.tool === "freehand" ? "path" : this.tool;
        const item = {
          id: uid(),
          kind,
          name:
            {
              text: "Label",
              rect: "Rechthoek",
              ellipse: "Ellips",
              arrow: "Pijl",
              line: "Lijn",
              path: "Vrije lijn",
              membrane: "Plasmamembraan",
            }[kind] || kind,
          x: p.x,
          y: p.y,
          w: 1,
          h: 1,
          rotation: 0,
          opacity: 1,
          visible: true,
          fill: kind === "text" ? this.style.label : this.style.head,
          stroke: this.style.label,
          strokeWidth: kind === "arrow" ? 4 : 3,
          text: "Nieuw label",
          fontSize: 36,
          path: "M0 0",
        };
        if (kind === "membrane") {
          item.w = 300;
          item.h = 120;
          item.bilayerThickness = 34;
          item.curve = [
            [0.08, 0.5],
            [0.35, 0.5],
            [0.65, 0.5],
            [0.92, 0.5],
          ];
        }
        this.doc.items.push(item);
        this.selected = [item.id];
        interaction = { type: "draw", start: p, item, points: [[0, 0]] };
        if (kind === "text") {
          item.w = 260;
          item.h = 60;
          interaction = null;
          this.setTool("select");
          this.notify();
        } else this.render();
        return;
      }
      if (hit) {
        const item = this.doc.items.find((i) => i.id === hit);
        if (item.locked) {
          this.select([hit]);
          return;
        }
        const ids = item.groupId
          ? this.doc.items
              .filter((i) => i.groupId === item.groupId)
              .map((i) => i.id)
          : [hit];
        if (e.shiftKey)
          this.selected = this.selected.includes(hit)
            ? this.selected.filter((id) => !ids.includes(id))
            : [...this.selected, ...ids];
        else if (!this.selected.includes(hit)) this.selected = ids;
        this.beforeChange();
        interaction = {
          type: "move",
          start: p,
          originals: clone(this.selectedItems()),
        };
        this.render();
        this.onSelect(this.selected);
      } else {
        if (!e.shiftKey) this.selected = [];
        interaction = { type: "marquee", start: p };
        this.render();
        this.onSelect(this.selected);
      }
    });
    this.svg.addEventListener("pointermove", (e) => {
      if (!interaction) return;
      const p = this.point(e),
        x = interaction,
        dx = p.x - x.start.x,
        dy = p.y - x.start.y;
      if (x.type === "pan") {
        this.doc.panX += dx;
        this.doc.panY += dy;
        this.render();
        return;
      }
      if (x.type === "move") {
        for (const original of x.originals) {
          const item = this.doc.items.find((i) => i.id === original.id);
          if (item && !item.locked) {
            item.x = this.snap(original.x + dx);
            item.y = this.snap(original.y + dy);
          }
        }
      } else if (x.type === "rotate-selection") {
        let angle =
          Math.atan2(p.y - x.center.y, p.x - x.center.x) - x.startAngle;
        if (e.shiftKey)
          angle = (Math.round(angle / (Math.PI / 12)) * Math.PI) / 12;
        for (const original of x.originals) {
          const item = this.doc.items.find((i) => i.id === original.id),
            ox = original.x + original.w / 2 - x.center.x,
            oy = original.y + original.h / 2 - x.center.y;
          item.x =
            x.center.x +
            ox * Math.cos(angle) -
            oy * Math.sin(angle) -
            item.w / 2;
          item.y =
            x.center.y +
            ox * Math.sin(angle) +
            oy * Math.cos(angle) -
            item.h / 2;
          item.rotation = original.rotation + (angle * 180) / Math.PI;
        }
      } else if (x.type === "curve-point") {
        const original = x.original,
          item = this.doc.items.find((i) => i.id === original.id),
          angle = (-(original.rotation || 0) * Math.PI) / 180,
          cx = original.x + original.w / 2,
          cy = original.y + original.h / 2,
          lx =
            (p.x - cx) * Math.cos(angle) -
            (p.y - cy) * Math.sin(angle) +
            original.w / 2,
          ly =
            (p.x - cx) * Math.sin(angle) +
            (p.y - cy) * Math.cos(angle) +
            original.h / 2,
          pad = Math.min(
            0.45,
            ((item.bilayerThickness || 34) / 2 + 9) / item.h,
          );
        item.curve = clone(original.curve);
        const target = [
          Math.max(0.03, Math.min(0.97, lx / item.w)),
          Math.max(pad, Math.min(1 - pad, ly / item.h)),
        ];
        const old = item.curve[x.index],
          delta = target.map((n, k) => n - old[k]);
        item.curve[x.index] = target;
        if (x.index % 3 === 0)
          for (const j of [x.index - 1, x.index + 1])
            if (item.curve[j])
              item.curve[j] = item.curve[j].map((n, k) => n + delta[k]);
      } else if (x.type === "marquee")
        this.marquee = {
          x: Math.min(p.x, x.start.x),
          y: Math.min(p.y, x.start.y),
          w: Math.abs(dx),
          h: Math.abs(dy),
        };
      else if (x.type === "draw") {
        const item = x.item;
        if (item.kind === "path") {
          x.points.push([p.x - item.x, p.y - item.y]);
          item.path = x.points
            .map((p, n) => (n ? "L" : "M") + p.join(" "))
            .join(" ");
          item.w = Math.max(1, Math.max(...x.points.map((p) => p[0])));
          item.h = Math.max(1, Math.max(...x.points.map((p) => p[1])));
        } else {
          if (item.kind === "membrane") {
            const length = Math.max(40, Math.hypot(dx, dy));
            item.w = length + 70;
            item.h = 120;
            item.x = (p.x + x.start.x) / 2 - item.w / 2;
            item.y = (p.y + x.start.y) / 2 - 60;
            item.rotation = (Math.atan2(dy, dx) * 180) / Math.PI;
            item.bilayerThickness = 34;
            const pad = 35 / item.w;
            item.curve = [
              [pad, 0.5],
              [pad + (1 - 2 * pad) / 3, 0.5],
              [1 - pad - (1 - 2 * pad) / 3, 0.5],
              [1 - pad, 0.5],
            ];
            this.render();
            return;
          }
          item.x = Math.min(p.x, x.start.x);
          item.y = Math.min(p.y, x.start.y);
          item.w = Math.max(2, Math.abs(dx));
          item.h = Math.max(2, Math.abs(dy));
          item.flipX = dx < 0;
          item.flipY = dy < 0;
          if (e.shiftKey && ["rect", "ellipse"].includes(item.kind))
            item.h = item.w;
        }
      } else {
        const original = x.original,
          item = this.doc.items.find((i) => i.id === original.id),
          cx = original.x + original.w / 2,
          cy = original.y + original.h / 2;
        if (x.type === "rotate") {
          const angle = (Math.atan2(p.y - cy, p.x - cx) * 180) / Math.PI + 90;
          item.rotation = e.shiftKey
            ? Math.round(angle / 15) * 15
            : Math.round(angle);
        } else {
          const angle = (-(original.rotation || 0) * Math.PI) / 180,
            localX = dx * Math.cos(angle) - dy * Math.sin(angle),
            localY = dx * Math.sin(angle) + dy * Math.cos(angle),
            west = x.type.includes("w"),
            north = x.type.includes("n");
          let width = Math.max(10, original.w + (west ? -localX : localX)),
            height = Math.max(10, original.h + (north ? -localY : localY));
          if (item.kind === "svg" || e.shiftKey)
            height = (width * original.h) / original.w;
          item.w = this.snap(width);
          item.h = this.snap(height);
          const rotation = -angle,
            cos = Math.cos(rotation),
            sin = Math.sin(rotation),
            oldFixedX = ((west ? 1 : -1) * original.w) / 2,
            oldFixedY = ((north ? 1 : -1) * original.h) / 2,
            fixedX = cx + oldFixedX * cos - oldFixedY * sin,
            fixedY = cy + oldFixedX * sin + oldFixedY * cos,
            newFixedX = ((west ? 1 : -1) * item.w) / 2,
            newFixedY = ((north ? 1 : -1) * item.h) / 2;
          item.x = fixedX - newFixedX * cos + newFixedY * sin - item.w / 2;
          item.y = fixedY - newFixedX * sin - newFixedY * cos - item.h / 2;
        }
      }
      this.render();
    });
    this.svg.addEventListener("pointerup", (e) => {
      if (!interaction) return;
      const type = interaction.type;
      if (type === "draw" && interaction.item.kind === "path") {
        const pts = interaction.points,
          item = interaction.item,
          minX = Math.min(...pts.map((p) => p[0])),
          minY = Math.min(...pts.map((p) => p[1]));
        item.x += minX;
        item.y += minY;
        item.w = Math.max(2, Math.max(...pts.map((p) => p[0])) - minX);
        item.h = Math.max(2, Math.max(...pts.map((p) => p[1])) - minY);
        item.path = pts
          .map((p, n) => (n ? "L" : "M") + (p[0] - minX) + " " + (p[1] - minY))
          .join(" ");
      }
      if (type === "marquee" && this.marquee) {
        const b = this.marquee;
        this.selected = this.doc.items
          .filter(
            (i) =>
              i.visible &&
              i.x < b.x + b.w &&
              i.x + i.w > b.x &&
              i.y < b.y + b.h &&
              i.y + i.h > b.y,
          )
          .map((i) => i.id);
      }
      if (type === "draw") this.setTool("select");
      interaction = null;
      this.marquee = null;
      this.notify();
    });
    this.svg.addEventListener("dblclick", (e) => {
      const id = e.target.closest("[data-entity]")?.dataset.entity,
        item = this.doc.items.find((i) => i.id === id);
      if (item?.kind === "text") {
        this.select([id]);
        document.querySelector('[data-sheet-field="text"]')?.focus();
      }
      if (item?.kind === "membrane") {
        const p = this.point(e),
          angle = (-(item.rotation || 0) * Math.PI) / 180,
          cx = item.x + item.w / 2,
          cy = item.y + item.h / 2,
          local = [
            (p.x - cx) * Math.cos(angle) -
              (p.y - cy) * Math.sin(angle) +
              item.w / 2,
            (p.x - cx) * Math.sin(angle) +
              (p.y - cy) * Math.cos(angle) +
              item.h / 2,
          ];
        this.beforeChange();
        item.curve = splitBezier(
          item.curve,
          closestCurveT(membranePoints(item), local),
        );
        this.select([id]);
        this.notify();
      }
    });
    this.svg.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const p = this.point(e),
          old = this.doc.zoom,
          next = Math.max(
            0.25,
            Math.min(5, old * (e.deltaY < 0 ? 1.12 : 1 / 1.12)),
          );
        this.doc.zoom = next;
        this.doc.panX =
          this.doc.panX + (p.x + this.doc.panX) * (old / next - 1);
        this.doc.panY =
          this.doc.panY + (p.y + this.doc.panY) * (old / next - 1);
        this.render();
        this.onSelect(this.selected);
      },
      { passive: false },
    );
    document.addEventListener("click", (e) => {
      if (document.documentElement.dataset.editor !== "2d") return;
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.sheetTool) this.setTool(b.dataset.sheetTool);
      if (b.dataset.sheetAction) this.command(b.dataset.sheetAction);
      if (b.dataset.sheetSelect) this.select([b.dataset.sheetSelect]);
      if (b.dataset.sheetVisible) {
        this.beforeChange();
        const i = this.doc.items.find((i) => i.id === b.dataset.sheetVisible);
        i.visible = !i.visible;
        this.notify();
      }
    });
    document.addEventListener("change", (e) => {
      if (document.documentElement.dataset.editor !== "2d") return;
      const field = e.target.dataset.sheetField,
        page = e.target.dataset.sheetPage;
      if (field) {
        this.beforeChange();
        for (const item of this.selectedItems()) {
          const value =
            e.target.type === "checkbox"
              ? e.target.checked
              : e.target.type === "number" || e.target.type === "range"
                ? +e.target.value
                : e.target.value;
          if (typeof value === "number" && !Number.isFinite(value)) continue;
          item[field] = value;
          if (field === "fill") item.customFill = true;
          if (field === "stroke") item.customStroke = true;
          if (field === "bilayerThickness")
            item.bilayerThickness = Math.max(12, Math.min(80, +value || 34));
          if (["w", "h", "fontSize"].includes(field))
            item[field] = Math.max(5, Math.min(10000, +value || 5));
          if (field === "text") {
            item.w = Math.max(
              80,
              String(value).length * (item.fontSize || 36) * 0.6,
            );
            item.h =
              String(value).split("\n").length * (item.fontSize || 36) * 1.3;
          }
        }
        this.notify();
      } else if (page) {
        this.beforeChange();
        this.doc[page] =
          e.target.type === "checkbox"
            ? e.target.checked
            : e.target.type === "number"
              ? Math.max(100, Math.min(10000, +e.target.value || 100))
              : e.target.value;
        if (page === "background") this.doc.customBackground = true;
        this.notify();
      }
    });
    document.addEventListener("keydown", (e) => {
      if (
        document.documentElement.dataset.editor !== "2d" ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName) ||
        e.defaultPrevented
      )
        return;
      if (e.ctrlKey || e.metaKey) {
        const cmd = {
          a: "select-all",
          d: "duplicate",
          g: e.shiftKey ? "ungroup" : "group",
          c: "copy",
          v: "paste",
        }[e.key.toLowerCase()];
        if (cmd) {
          e.preventDefault();
          this.command(cmd);
        }
      } else if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        this.beforeChange();
        const step = e.shiftKey ? 10 : 1;
        for (const i of this.selectedItems()) {
          if (i.locked) continue;
          if (e.key === "ArrowLeft") i.x -= step;
          if (e.key === "ArrowRight") i.x += step;
          if (e.key === "ArrowUp") i.y -= step;
          if (e.key === "ArrowDown") i.y += step;
        }
        this.notify();
      } else if (e.key === "Escape") {
        this.setTool("select");
        this.select([]);
      }
    });
  }
  command(cmd) {
    const items = this.selectedItems();
    if (cmd === "select-all") {
      this.select(this.doc.items.filter((i) => i.visible).map((i) => i.id));
      return;
    }
    if (cmd === "copy") {
      this.clipboard = clone(items);
      return;
    }
    if (cmd === "fit") {
      this.doc.zoom = 1;
      this.doc.panX = 0;
      this.doc.panY = 0;
      this.render();
      return;
    }
    if (cmd === "zoom-in" || cmd === "zoom-out") {
      this.doc.zoom = Math.max(
        0.25,
        Math.min(5, this.doc.zoom * (cmd === "zoom-in" ? 1.25 : 0.8)),
      );
      this.render();
      this.onSelect(this.selected);
      return;
    }
    this.beforeChange();
    if (cmd === "delete")
      this.doc.items = this.doc.items.filter(
        (i) => !this.selected.includes(i.id) || i.locked,
      );
    else if (cmd === "duplicate" || cmd === "paste") {
      const originals = cmd === "paste" ? this.clipboard : items;
      const added = originals.map((i) => ({
        ...clone(i),
        id: uid(),
        x: i.x + 25,
        y: i.y + 25,
        groupId: null,
      }));
      this.doc.items.push(...added);
      this.selected = added.map((i) => i.id);
    } else if (cmd === "group") {
      const groupId = uid();
      items.forEach((i) => (i.groupId = groupId));
    } else if (cmd === "ungroup") items.forEach((i) => delete i.groupId);
    else if (cmd === "front" || cmd === "back") {
      const rest = this.doc.items.filter((i) => !this.selected.includes(i.id));
      this.doc.items =
        cmd === "front" ? [...rest, ...items] : [...items, ...rest];
    } else if (cmd === "forward" || cmd === "backward") {
      const direction = cmd === "forward" ? 1 : -1;
      for (const item of direction === 1 ? [...items].reverse() : items) {
        const index = this.doc.items.indexOf(item),
          next = Math.max(
            0,
            Math.min(this.doc.items.length - 1, index + direction),
          );
        [this.doc.items[index], this.doc.items[next]] = [
          this.doc.items[next],
          this.doc.items[index],
        ];
      }
    } else if (cmd === "add-curve-point") {
      for (const item of items.filter((i) => i.kind === "membrane"))
        item.curve = splitBezier(item.curve);
    } else if (cmd.startsWith("align-")) alignItems(items, cmd.slice(6));
    else if (cmd === "distribute-x" || cmd === "distribute-y")
      distributeItems(items, cmd.slice(-1));
    this.notify();
  }
  propertiesHTML() {
    const items = this.selectedItems(),
      i = items[0];
    const number = (title, key, value) =>
      `<label>${title}<input type="number" data-sheet-field="${key}" value="${Math.round(value * 100) / 100}" step="1"></label>`;
    return `<div class="details-body"><strong ${i ? "data-no-translate" : ""}>${items.length > 1 ? items.length + " geselecteerde elementen" : i ? escape(i.name) : "2D tekenblad"}</strong>${i ? `<label>Naam<input data-sheet-field="name" value="${escape(i.name)}"></label><div class="coordinates">${number("X", "x", i.x)}${number("Y", "y", i.y)}</div><div class="coordinates">${number("Breedte", "w", i.w)}${number("Hoogte", "h", i.h)}</div>${number("Rotatie (°)", "rotation", i.rotation || 0)}<label>Dekking<input type="range" data-sheet-field="opacity" min="0" max="1" step=".05" value="${i.opacity}"></label>${i.kind === "membrane" ? `<div class="hinge-box"><strong>Lipidendubbellaag</strong>${number("Membraandikte", "bilayerThickness", i.bilayerThickness || 34)}<p class="muted">${(i.curve.length - 1) / 3 + 1} curvepunten. Sleep de punten en oranje handvatten. Dubbelklik op het membraan om een extra punt toe te voegen.</p><button data-sheet-action="add-curve-point">＋ Punt toevoegen</button></div>` : ""}${i.kind === "text" ? `<label>Tekst<textarea data-sheet-field="text">${escape(i.text)}</textarea></label>${number("Tekstgrootte", "fontSize", i.fontSize)}<label class="check"><input type="checkbox" data-sheet-field="bold" ${i.bold ? "checked" : ""}> Vet</label>` : ""}${i.kind !== "svg" ? `<div class="row"><label>Vulling <input type="color" data-sheet-field="fill" value="${i.fill || "#ffffff"}"></label><label>Contour <input type="color" data-sheet-field="stroke" value="${i.stroke || "#064986"}"></label></div>${number("Lijndikte", "strokeWidth", i.strokeWidth || 3)}` : '<p class="muted">Native vector. Verhoudingen blijven behouden bij slepen van de hoekpunten.</p>'}${i.kind === "svg" && isCellElement(i) ? `<label class="check"><input type="checkbox" data-sheet-field="volumeLook" ${i.volumeLook ? "checked" : ""}> Volumewerking</label>` : ""}${i.kind === "svg" ? `<div class="hinge-box"><strong>3D-variant</strong><p class="muted">Maak een draaibaar, schematisch volume van deze vector. De 2D-bron blijft behouden.</p><button class="wide" data-action="create-3d-variant">⬡ Open 3D-variant</button></div>` : ""}<label class="check"><input type="checkbox" data-sheet-field="locked" ${i.locked ? "checked" : ""}> Vergrendeld</label><div class="row"><button data-sheet-action="duplicate">Dupliceren</button><button data-sheet-action="delete" class="danger">Verwijderen</button></div>` : '<p class="muted">Voeg een losse bouwsteen toe of teken een vorm. Shift-klik voor meervoudige selectie.</p>'}<div class="sheet-arrange"><strong>Ordenen</strong><div class="view-buttons">${[
      ["front", "Vooraan"],
      ["back", "Achteraan"],
      ["forward", "Vooruit"],
      ["backward", "Achteruit"],
      ["group", "Groeperen"],
      ["ungroup", "Losmaken"],
    ]
      .map(
        ([key, label]) =>
          `<button data-sheet-action="${key}">${label}</button>`,
      )
      .join("")}</div><strong>Uitlijnen</strong><div class="view-buttons">${[
      ["left", "Links"],
      ["center", "Midden X"],
      ["right", "Rechts"],
      ["top", "Boven"],
      ["middle", "Midden Y"],
      ["bottom", "Onder"],
    ]
      .map(
        ([key, label]) =>
          `<button data-sheet-action="align-${key}">${label}</button>`,
      )
      .join(
        "",
      )}</div><div class="row"><button data-sheet-action="distribute-x">Verdelen X</button><button data-sheet-action="distribute-y">Verdelen Y</button></div></div><label>Bladbreedte<input type="number" data-sheet-page="width" min="100" max="10000" value="${this.doc.width}"></label><label>Bladhoogte<input type="number" data-sheet-page="height" min="100" max="10000" value="${this.doc.height}"></label><label>Bladkleur<input type="color" data-sheet-page="background" value="${this.doc.background}"></label><label class="check"><input type="checkbox" data-sheet-page="grid" ${this.doc.grid ? "checked" : ""}> Raster tonen</label><label class="check"><input type="checkbox" data-sheet-page="snap" ${this.doc.snap ? "checked" : ""}> Op raster uitlijnen</label><p class="muted">Ctrl+A selecteren · Ctrl+D dupliceren · Ctrl+G groeperen · Shift+Ctrl+G losmaken · pijltjes verplaatsen.</p></div>`;
  }
  layersHTML() {
    return [...this.doc.items]
      .reverse()
      .map(
        (i) =>
          `<div class="scene-row ${this.selected.includes(i.id) ? "selected" : ""}"><button data-sheet-visible="${i.id}">${i.visible ? "◉" : "○"}</button><button data-sheet-select="${i.id}">${i.locked ? "▣" : "◇"} ${escape(i.name)}</button></div>`,
      )
      .join("");
  }
  exportSVG(transparent = false) {
    const d = this.doc;
    return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="${NS}" xmlns:xlink="http://www.w3.org/1999/xlink" width="${d.width}" height="${d.height}" viewBox="0 0 ${d.width} ${d.height}"><title>ImmunoStudio 2D illustration</title>${transparent ? "" : `<rect width="100%" height="100%" fill="${d.background}"/>`}${d.items
      .filter((i) => i.visible)
      .map(
        (i) =>
          `<g id="object-${i.id}" transform="translate(${i.x + i.w / 2} ${i.y + i.h / 2}) rotate(${i.rotation || 0}) translate(${-i.w / 2} ${-i.h / 2})" opacity="${i.opacity}">${this.itemMarkup(i)}</g>`,
      )
      .join("")}</svg>`;
  }
  async exportPNG(width = 1920, transparent = false) {
    const text = this.exportSVG(transparent),
      image = new Image(),
      url = URL.createObjectURL(new Blob([text], { type: "image/svg+xml" }));
    try {
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () =>
          reject(Error("2D-afbeelding kon niet worden gerenderd."));
        image.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = Math.round((width * this.doc.height) / this.doc.width);
      canvas
        .getContext("2d")
        .drawImage(image, 0, 0, canvas.width, canvas.height);
      return await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}
