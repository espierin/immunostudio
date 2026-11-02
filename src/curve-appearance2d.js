import { bezier, tangent, arcTable, arcT } from "./model.js";
import { membraneMarkup, membranePoints } from "./membrane2d.js";

export const lineStyles = [
  "line",
  "membrane",
  "endothelium",
  "skin",
  "intestine",
];
export const editableLine = (item) =>
  item &&
  ["line", "arrow", "path", "rect", "ellipse", "membrane"].includes(item.kind);
export function moveCurveControl(item, index, target) {
  const curve = structuredClone(item.curve),
    old = curve[index],
    delta = target.map((v, k) => v - old[k]);
  const aliases =
    item.closed && (index === 0 || index === curve.length - 1)
      ? [0, curve.length - 1]
      : [index];
  for (const anchor of aliases) {
    curve[anchor] = [...target];
    if (anchor % 3 === 0)
      for (const n of [anchor - 1, anchor + 1])
        if (curve[n]) curve[n] = curve[n].map((v, k) => v + delta[k]);
  }
  return curve;
}
const fmt = (n) => Number(n.toFixed(3));
const path = (points, close = true) =>
  `M${points.map((p) => p.map(fmt).join(" ")).join("L")}${close ? "Z" : ""}`;
export function curvePath(item) {
  const p = membranePoints(item);
  return `M${p[0].join(" ")}${Array.from(
    { length: (p.length - 1) / 3 },
    (_, i) =>
      `C${p
        .slice(1 + i * 3, 4 + i * 3)
        .flat()
        .join(" ")}`,
  ).join("")}${item.closed ? "Z" : ""}`;
}

// Cell walls, nuclei and apical detail use the same curvilinear coordinates.
// Rebuilding from the curve transports the complete layer after every edit.
export const curvePosition = (u, closed) =>
  closed ? ((u % 1) + 1) % 1 : Math.max(0, Math.min(1, u));
export function tissueMarkup(item, style) {
  const points = membranePoints(item),
    table = arcTable(points),
    kind = item.lineStyle,
    depth = Math.max(
      12,
      Math.min(240, item.layerThickness || (kind === "endothelium" ? 24 : 90)),
    ),
    width = Math.max(
      12,
      Math.min(200, item.cellWidth || (kind === "endothelium" ? 100 : 38)),
    ),
    side = item.layerSide === -1 ? -1 : 1,
    rows = kind === "skin" ? 3 : 1,
    count = Math.max(1, Math.min(180, Math.ceil(table.length / width))),
    outline = item.stroke || style.outline || "#2167AE",
    cytoplasm = item.fill || style.head || "#C5E4F4",
    nucleus = style.nucleus || style.receptor || "#579BD0";
  const at = (u, offset) => {
    const t = arcT(table, curvePosition(u, item.closed)),
      p = bezier(points, t),
      v = tangent(points, t);
    return [p[0] - v[1] * offset * side, p[1] + v[0] * offset * side];
  };
  const oval = (u, y, rx, ry) =>
    Array.from({ length: 24 }, (_, k) => {
      const a = (k / 24) * Math.PI * 2;
      return at(
        u + (Math.cos(a) * rx) / Math.max(1, table.length),
        y + Math.sin(a) * ry,
      );
    });
  let svg = `<g data-tissue="${kind}">`;
  for (let row = 0; row < rows; row++) {
    const boundaries = kind === "skin" ? [0, 0.18, 0.53, 1] : [0, 1],
      y0 = boundaries[row] * depth,
      y1 = boundaries[row + 1] * depth,
      rowCount =
        kind === "skin"
          ? Math.max(1, Math.round(count / [2, 1.35, 1][row]))
          : count;
    for (let i = 0; i < rowCount; i++) {
      const a = i / rowCount,
        b = (i + 1) / rowCount,
        u = (a + b) / 2,
        top = Array.from({ length: 7 }, (_, k) =>
          at(a + ((b - a) * k) / 6, y0),
        ),
        bottom = Array.from({ length: 7 }, (_, k) =>
          at(b - ((b - a) * k) / 6, y1),
        ),
        goblet = kind === "intestine" && i % 5 === 3;
      svg += `<path data-layer-cell="${row}-${i}" d="${path([...top, ...bottom])}" fill="${goblet ? style.core || "#EAF5F8" : cytoplasm}" stroke="${outline}" stroke-width="${Math.max(0.8, Math.min(3, item.strokeWidth || 1.5))}" stroke-linejoin="round"/>`;
      const ny = kind === "intestine" ? y0 + (y1 - y0) * 0.73 : (y0 + y1) / 2,
        rx = Math.min(
          (table.length / rowCount) * 0.23,
          kind === "endothelium" ? 18 : 9,
        ),
        ry = Math.min((y1 - y0) * 0.24, kind === "endothelium" ? 5 : 12);
      svg += `<path data-layer-nucleus="${row}-${i}" d="${path(oval(u, ny, rx, ry))}" fill="${nucleus}" stroke="${outline}" stroke-width=".8"/>`;
      if (goblet)
        svg += `<path d="${path(oval(u, depth * 0.28, Math.min(12, (table.length / rowCount) * 0.31), depth * 0.18))}" fill="${style.core || "#EAF5F8"}" stroke="${outline}" stroke-width=".7"/>`;
    }
  }
  if (kind === "intestine") {
    const n = Math.min(1200, Math.ceil(table.length / 5));
    for (let i = 0; i <= n; i++)
      svg += `<path d="${path([at(i / n, 0), at(i / n, -6)], false)}" stroke="${outline}" stroke-width="1.3"/>`;
  }
  svg += `<path d="${path(
    Array.from({ length: 181 }, (_, i) => at(i / 180, depth)),
    false,
  )}" fill="none" stroke="${outline}" stroke-width="2"/></g>`;
  return svg;
}
export function curveAppearanceMarkup(item, style) {
  const d = curvePath(item),
    fill = item.fillEnabled ? item.fill || style.head : "none",
    interior = `<path data-curve-fill d="${d}" fill="${fill}" stroke="none"/>`,
    kind = item.lineStyle || "membrane";
  if (kind === "membrane") return interior + membraneMarkup(item, style);
  if (kind !== "line") return interior + tissueMarkup(item, style);
  return (
    interior +
    `<path data-curve-line d="${d}" fill="none" stroke="${item.stroke || style.outline || "#2167AE"}" stroke-width="${item.strokeWidth || 3}" stroke-linecap="round" stroke-linejoin="round"/>`
  );
}
export function lineAppearanceControls(item) {
  if (!editableLine(item)) return "";
  const kind =
      item.lineStyle || (item.kind === "membrane" ? "membrane" : "line"),
    labels = [
      "Alleen lijn",
      "Celmembraan",
      "Endotheel",
      "Huid / meerlagig epitheel",
      "Darmepitheel",
    ],
    select = (key, options, value) =>
      `<select data-sheet-field="${key}">${options.map(([v, t]) => `<option value="${v}" ${String(v) === String(value) ? "selected" : ""}>${t}</option>`).join("")}</select>`;
  return `<details open class="line-appearance"><summary>Lijnopbouw en vulling</summary><label>Lijnopbouw${select(
    "lineStyle",
    lineStyles.map((v, i) => [v, labels[i]]),
    kind,
  )}</label><label class="check"><input type="checkbox" data-sheet-field="fillEnabled" ${(item.fillEnabled ?? (item.kind === "rect" || item.kind === "ellipse" || item.pathClosed)) ? "checked" : ""}> Binnenvlak vullen</label><label>Vulkleur<input type="color" data-sheet-field="fill" value="${/^#[\da-f]{6}$/i.test(item.fill || "") ? item.fill : "#C5E4F4"}"></label>${
    ["endothelium", "skin", "intestine"].includes(kind)
      ? `<label>Laagdikte (px)<input type="number" min="12" max="240" data-sheet-field="layerThickness" value="${item.layerThickness || (kind === "endothelium" ? 24 : 90)}"></label><label>Celbreedte (px)<input type="number" min="12" max="200" data-sheet-field="cellWidth" value="${item.cellWidth || (kind === "endothelium" ? 100 : 38)}"></label><label>Zijde van de lijn${select(
          "layerSide",
          [
            [1, "Zijde 1"],
            [-1, "Zijde 2"],
          ],
          item.layerSide || 1,
        )}</label>`
      : ""
  }<button data-sheet-action="to-editable-curve">Bézierlijn bewerken</button>${item.kind === "membrane" ? '<button data-sheet-action="add-curve-point">Punt toevoegen</button>' : ""}<p class="muted">De lijnopbouw volgt alle curve- en sculptbewerkingen. Binnenvlak vullen sluit een open lijn visueel met een rechte verbinding.</p></details>`;
}
