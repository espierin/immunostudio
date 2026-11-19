import { elementPath, vectorElements, pathData } from "./vector-nodes.js";
import {
  receptorAnchorProfile,
  embeddedStemProfile,
} from "./receptor-anchor.js";
const identity = [1, 0, 0, 1, 0, 0];
export function multiplyAffine(a, b) {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}
function inverse(a) {
  const d = a[0] * a[3] - a[1] * a[2];
  if (Math.abs(d) < 1e-12) throw Error("Singular receptor transform");
  return [
    a[3] / d,
    -a[1] / d,
    -a[2] / d,
    a[0] / d,
    (a[2] * a[5] - a[3] * a[4]) / d,
    (a[1] * a[4] - a[0] * a[5]) / d,
  ];
}
const point = (p, m) => [
  m[0] * p[0] + m[2] * p[1] + m[4],
  m[1] * p[0] + m[3] * p[1] + m[5],
];
export function parseAffine(text = "") {
  let matrix = identity;
  for (const match of text.matchAll(
    /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g,
  )) {
    const v = match[2]
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (!v.every(Number.isFinite)) continue;
    let next = identity;
    if (match[1] === "matrix" && v.length === 6) next = v;
    if (match[1] === "translate") next = [1, 0, 0, 1, v[0], v[1] || 0];
    if (match[1] === "scale") next = [v[0], 0, 0, v[1] ?? v[0], 0, 0];
    if (match[1] === "rotate") {
      const r = (v[0] * Math.PI) / 180,
        c = Math.cos(r),
        s = Math.sin(r),
        x = v[1] || 0,
        y = v[2] || 0;
      next = [c, s, -s, c, x - x * c + y * s, y - x * s - y * c];
    }
    if (match[1] === "skewX")
      next = [1, 0, Math.tan((v[0] * Math.PI) / 180), 1, 0, 0];
    if (match[1] === "skewY")
      next = [1, Math.tan((v[0] * Math.PI) / 180), 0, 1, 0, 0];
    matrix = multiplyAffine(matrix, next);
  }
  return matrix;
}
function relativeMatrix(node, frame) {
  let matrix = identity;
  for (let p = node; p && p !== frame; p = p.parentElement)
    matrix = multiplyAffine(
      parseAffine(p.getAttribute("transform") || ""),
      matrix,
    );
  return matrix;
}
export function extracellularPoint(p, profile, angle) {
  const direction = profile.angle === 180 ? 1 : -1,
    boundary = profile.y + (direction * profile.span) / 2,
    d = direction * (p[1] - boundary);
  if (d <= 0 || !angle) return [...p];
  const t = Math.min(1, d / Math.max(1, profile.span * 0.7)),
    smooth = t * t * (3 - 2 * t);
  let r =
    ((-direction * Math.max(-60, Math.min(60, angle)) * Math.PI) / 180) *
    smooth;
  const dx = p[0] - profile.x;
  if (direction * dx * Math.sin(r) < 0)
    r =
      Math.sign(r) * Math.min(Math.abs(r), Math.atan2(d, Math.abs(dx)) * 0.98);
  const x = dx,
    y = p[1] - boundary,
    c = Math.cos(r),
    s = Math.sin(r);
  return [profile.x + x * c - y * s, boundary + x * s + y * c];
}
function curvePoint(points, t) {
  let rows = points.map((p) => [...p]);
  while (rows.length > 1)
    rows = rows
      .slice(1)
      .map((p, n) => p.map((v, k) => rows[n][k] * (1 - t) + v * t));
  return rows[0];
}
function subdivideWarp(points, warp, out, t0 = 0, t1 = 1, depth = 0) {
  const a = warp(curvePoint(points, t0)),
    b = warp(curvePoint(points, t1)),
    m = (t0 + t1) / 2,
    p = warp(curvePoint(points, m));
  const error = Math.hypot(p[0] - (a[0] + b[0]) / 2, p[1] - (a[1] + b[1]) / 2);
  // Quarter samples also catch symmetric curves whose midpoint lies on their chord.
  const q = warp(curvePoint(points, (3 * t0 + t1) / 4)),
    r = warp(curvePoint(points, (t0 + 3 * t1) / 4));
  const detail = Math.max(
    error,
    Math.hypot(q[0] - (3 * a[0] + b[0]) / 4, q[1] - (3 * a[1] + b[1]) / 4),
    Math.hypot(r[0] - (a[0] + 3 * b[0]) / 4, r[1] - (a[1] + 3 * b[1]) / 4),
  );
  if (depth < 11 && detail > 0.08) {
    subdivideWarp(points, warp, out, t0, m, depth + 1);
    subdivideWarp(points, warp, out, m, t1, depth + 1);
  } else out.push({ type: "L", values: b });
}
export function bendPath(commands, profile, angle, matrix = identity) {
  if (!angle) return structuredClone(commands);
  const back = inverse(matrix),
    warp = (p) =>
      point(extracellularPoint(point(p, matrix), profile, angle), back);
  const direction = profile.angle === 180 ? 1 : -1,
    boundary = profile.y + (direction * profile.span) / 2,
    transition = Math.max(1, profile.span * 0.7);
  let current = [0, 0],
    start = current;
  const output = [];
  for (const cmd of commands) {
    if (cmd.type === "M") {
      current = cmd.values;
      start = current;
      output.push({ type: "M", values: warp(current) });
      continue;
    }
    const end = cmd.type === "Z" ? start : cmd.values.slice(-2),
      controls = [];
    if (!["L", "C", "Q", "Z"].includes(cmd.type))
      throw Error("Unsupported extracellular path");
    for (let n = 0; n < cmd.values.length - 2; n += 2)
      controls.push(cmd.values.slice(n, n + 2));
    const points = [current, ...controls, end],
      depths = points.map((p) => direction * (point(p, matrix)[1] - boundary));
    if (Math.max(...depths) <= 0) output.push(structuredClone(cmd));
    else if (Math.min(...depths) >= transition && cmd.type !== "Z")
      output.push({
        type: cmd.type,
        values: cmd.values.flatMap((_, n) =>
          n % 2 ? [] : warp(cmd.values.slice(n, n + 2)),
        ),
      });
    else {
      const at = (t) =>
          direction * (point(curvePoint(points, t), matrix)[1] - boundary),
        cuts = [0];
      let previous = at(0);
      for (let n = 1; n <= 32; n++) {
        const next = at(n / 32);
        if (previous * next < 0) {
          let lo = (n - 1) / 32,
            hi = n / 32;
          const sign = previous;
          for (let k = 0; k < 40; k++) {
            const mid = (lo + hi) / 2;
            if (at(mid) * sign > 0) lo = mid;
            else hi = mid;
          }
          cuts.push((lo + hi) / 2);
        }
        previous = next;
      }
      cuts.push(1);
      for (let n = 1; n < cuts.length; n++)
        subdivideWarp(points, warp, output, cuts[n - 1], cuts[n]);
      if (cmd.type === "Z") output.push({ type: "Z", values: [] });
    }
    current = end;
  }
  return output;
}
function warpFrame(frame, profile, angle) {
  if (!angle) return;
  for (const node of vectorElements(frame))
    try {
      const matrix = relativeMatrix(node, frame),
        commands = elementPath(node),
        changed = bendPath(commands, profile, angle, matrix);
      if (pathData(commands) === pathData(changed)) continue;
      const path = frame.ownerDocument.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      );
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
      path.setAttribute("d", pathData(changed));
      node.replaceWith(path);
    } catch {}
}
const groupName = (n) =>
  [
    n.id,
    n.getAttribute("inkscape:label"),
    n.getAttribute("data-receptor"),
  ].join(" ");
export function extracellularArtwork(svg, item) {
  const bend = item.anchor2d?.ectoBend || 0;
  if (!bend && !svg.includes("data-membrane-ecto-bend")) return svg;
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml"),
    root = doc.documentElement,
    profile = receptorAnchorProfile(item);
  if (bend && profile?.extracellular) {
    const box = root
      .getAttribute("viewBox")
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    warpFrame(
      root,
      {
        x: box[0] + (profile.pivotX ?? 0.5) * box[2],
        y: box[1] + profile.pivotY * box[3],
        span: profile.span * box[3],
        angle: profile.angle || 0,
      },
      bend,
    );
  }
  for (const container of root.querySelectorAll("[data-membrane-ecto-bend]")) {
    const angle = +container.getAttribute("data-membrane-ecto-bend");
    if (!angle) continue;
    const frame = [container, ...container.querySelectorAll("g")].find(
      (n) => embeddedStemProfile(groupName(n))?.extracellular,
    );
    if (frame) warpFrame(frame, embeddedStemProfile(groupName(frame)), angle);
  }
  return new XMLSerializer().serializeToString(root);
}
