const counts = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
export function parsePath(d) {
  const tokens =
    d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi) || [];
  let at = 0,
    command = null,
    x = 0,
    y = 0,
    start = [0, 0],
    previous = null;
  const out = [];
  while (at < tokens.length) {
    if (/^[a-z]$/i.test(tokens[at])) command = tokens[at++];
    if (!command || !(command.toUpperCase() in counts))
      throw Error("Unsupported SVG path command");
    const kind = command.toUpperCase(),
      relative = command !== kind,
      n = counts[kind];
    if (kind === "Z") {
      out.push({ type: "Z", values: [] });
      [x, y] = start;
      command = null;
      previous = out.at(-1);
      continue;
    }
    const v = tokens.slice(at, at + n).map(Number);
    if (v.length !== n || !v.every(Number.isFinite))
      throw Error("Invalid SVG path");
    at += n;
    const point = (i) => [
      v[i] + (relative ? x : 0),
      v[i + 1] + (relative ? y : 0),
    ];
    let type = kind,
      values;
    if (kind === "H") {
      type = "L";
      values = [v[0] + (relative ? x : 0), y];
    } else if (kind === "V") {
      type = "L";
      values = [x, v[0] + (relative ? y : 0)];
    } else if (kind === "A") {
      values = [...v.slice(0, 5), ...point(5)];
    } else if (kind === "S") {
      type = "C";
      const p = previous?.type === "C" ? previous.values.slice(2, 4) : [x, y];
      values = [2 * x - p[0], 2 * y - p[1], ...point(0), ...point(2)];
    } else if (kind === "T") {
      type = "Q";
      const p = previous?.type === "Q" ? previous.values.slice(0, 2) : [x, y];
      values = [2 * x - p[0], 2 * y - p[1], ...point(0)];
    } else {
      values = [];
      for (let i = 0; i < n; i += 2) values.push(...point(i));
    }
    const result = { type, values };
    out.push(result);
    [x, y] = values.slice(-2);
    if (type === "M") start = [x, y];
    previous = result;
    if (kind === "M") command = relative ? "l" : "L";
  }
  return out;
}
export const pathData = (commands) =>
  commands
    .map((c) => c.type + c.values.map((v) => +v.toFixed(5)).join(" "))
    .join(" ");
export function pathPoints(commands) {
  const points = [];
  commands.forEach((c, command) => {
    if (c.type === "Z") return;
    const start = c.type === "A" ? 5 : 0;
    for (let offset = start; offset < c.values.length; offset += 2)
      points.push({
        command,
        offset,
        x: c.values[offset],
        y: c.values[offset + 1],
        control: offset < c.values.length - 2,
      });
  });
  return points;
}
export function movePathPoint(commands, point, x, y) {
  const copy = structuredClone(commands),
    p = pathPoints(copy)[point];
  if (!p) throw Error("Unknown point");
  copy[p.command].values[p.offset] = x;
  copy[p.command].values[p.offset + 1] = y;
  return copy;
}
export function splitPathSegment(commands, index = 1) {
  const out = structuredClone(commands),
    c = out[index],
    previous = out[index - 1];
  if (!c || !previous || !["L", "C", "Q"].includes(c.type))
    throw Error("Choose a line or Bézier segment.");
  const a = previous.values.slice(-2),
    end = c.values.slice(-2),
    mid = (p, q) => p.map((v, i) => (v + q[i]) / 2);
  let parts;
  if (c.type === "L") {
    parts = [{ type: "L", values: mid(a, end) }, c];
  }
  if (c.type === "Q") {
    const b = c.values.slice(0, 2),
      ab = mid(a, b),
      bc = mid(b, end),
      m = mid(ab, bc);
    parts = [
      { type: "Q", values: [...ab, ...m] },
      { type: "Q", values: [...bc, ...end] },
    ];
  }
  if (c.type === "C") {
    const b = c.values.slice(0, 2),
      d = c.values.slice(2, 4),
      ab = mid(a, b),
      bd = mid(b, d),
      de = mid(d, end),
      p = mid(ab, bd),
      q = mid(bd, de),
      m = mid(p, q);
    parts = [
      { type: "C", values: [...ab, ...p, ...m] },
      { type: "C", values: [...q, ...de, ...end] },
    ];
  }
  out.splice(index, 1, ...parts);
  return out;
}
export function vectorElements(doc) {
  return [
    ...doc.querySelectorAll("path,ellipse,circle,rect,polygon,polyline,line"),
  ].filter((n) => !n.closest("defs,clipPath,mask"));
}
export function elementPath(node) {
  const num = (k) => +(node.getAttribute(k) || 0),
    tag = node.tagName.toLowerCase();
  if (tag === "path") return parsePath(node.getAttribute("d") || "");
  if (tag === "line")
    return parsePath(`M${num("x1")} ${num("y1")}L${num("x2")} ${num("y2")}`);
  if (tag === "polygon" || tag === "polyline") {
    const v = (node.getAttribute("points") || "")
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    return parsePath(
      "M" +
        v.slice(0, 2).join(" ") +
        "L" +
        v.slice(2).join(" ") +
        (tag === "polygon" ? "Z" : ""),
    );
  }
  if (tag === "rect") {
    const x = num("x"),
      y = num("y"),
      w = num("width"),
      h = num("height"),
      rx = Math.min(w / 2, num("rx")),
      ry = Math.min(h / 2, num("ry") || rx);
    return parsePath(
      `M${x + rx} ${y}H${x + w - rx}Q${x + w} ${y} ${x + w} ${y + ry}V${y + h - ry}Q${x + w} ${y + h} ${x + w - rx} ${y + h}H${x + rx}Q${x} ${y + h} ${x} ${y + h - ry}V${y + ry}Q${x} ${y} ${x + rx} ${y}Z`,
    );
  }
  const cx = num("cx"),
    cy = num("cy"),
    rx = tag === "circle" ? num("r") : num("rx"),
    ry = tag === "circle" ? num("r") : num("ry"),
    k = 0.5522847498307936;
  return parsePath(
    `M${cx + rx} ${cy}C${cx + rx} ${cy + k * ry} ${cx + k * rx} ${cy + ry} ${cx} ${cy + ry}C${cx - k * rx} ${cy + ry} ${cx - rx} ${cy + k * ry} ${cx - rx} ${cy}C${cx - rx} ${cy - k * ry} ${cx - k * rx} ${cy - ry} ${cx} ${cy - ry}C${cx + k * rx} ${cy - ry} ${cx + rx} ${cy - k * ry} ${cx + rx} ${cy}Z`,
  );
}
export function annotateVectors(svg) {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  vectorElements(doc).forEach((node, index) =>
    node.setAttribute("data-node-path", index),
  );
  return new XMLSerializer().serializeToString(doc.documentElement);
}
export function updateVectorPath(svg, index, commands) {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml"),
    node = vectorElements(doc)[index];
  if (!node) throw Error("Vector path not found.");
  const path = doc.createElementNS("http://www.w3.org/2000/svg", "path");
  for (const attr of node.attributes)
    if (
      ![
        "d",
        "x",
        "y",
        "x1",
        "y1",
        "x2",
        "y2",
        "cx",
        "cy",
        "r",
        "rx",
        "ry",
        "width",
        "height",
        "points",
      ].includes(attr.name)
    )
      path.setAttributeNS(attr.namespaceURI, attr.name, attr.value);
  path.setAttribute("d", pathData(commands));
  node.replaceWith(path);
  return new XMLSerializer().serializeToString(doc.documentElement);
}
