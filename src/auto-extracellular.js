import {
  extracellularPoint,
  relativeMatrix,
  curvePoint,
} from "./extracellular-bend.js";
import { receptorAnchorProfile } from "./receptor-anchor.js";
import { vectorElements, elementPath } from "./vector-nodes.js";
import { anchoredPose, contourFrame } from "./contour2d.js";

const map = (p, m) => [
  m[0] * p[0] + m[2] * p[1] + m[4],
  m[1] * p[0] + m[3] * p[1] + m[5],
];
const affine = (m) => [m.a, m.b, m.c, m.d, m.e, m.f];
const cross = (o, a, b) =>
  (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
export function convexHull(points) {
  const sorted = points
    .map((p) => [...p])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (sorted.length < 3) return [];
  const lower = [],
    upper = [];
  for (const p of sorted) {
    while (lower.length > 1 && cross(lower.at(-2), lower.at(-1), p) <= 0)
      lower.pop();
    lower.push(p);
  }
  for (const p of [...sorted].reverse()) {
    while (upper.length > 1 && cross(upper.at(-2), upper.at(-1), p) <= 0)
      upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
function outside(points, profile) {
  const dir = profile.angle === 180 ? 1 : -1,
    y = profile.y + (dir * profile.span) / 2,
    depth = (p) => dir * (p[1] - y),
    output = [];
  for (let n = 0; n < points.length; n++) {
    const a = points[n],
      b = points[(n + 1) % points.length],
      da = depth(a),
      db = depth(b);
    if (da >= 0) output.push(a);
    if (da >= 0 !== db >= 0) {
      const t = da / (da - db);
      output.push([a[0] + t * (b[0] - a[0]), y]);
    }
  }
  return output;
}
function filled(node, frame) {
  for (let n = node; n; n = n.parentElement) {
    const fill = n.style?.fill || n.getAttribute("fill");
    if (fill) return fill !== "none";
    if (n === frame) break;
  }
  return true;
}
export function sourceEctodomains(frame, profile) {
  const shapes = [];
  for (const node of vectorElements(frame))
    try {
      const commands = elementPath(node);
      if (!filled(node, frame) || !commands.some((c) => c.type === "Z"))
        continue;
      const matrix = relativeMatrix(node, frame),
        points = [];
      let current = [0, 0],
        start = current;
      for (const command of commands) {
        if (command.type === "M") {
          current = command.values;
          start = current;
          points.push(map(current, matrix));
          continue;
        }
        const end = command.type === "Z" ? start : command.values.slice(-2),
          controls = [];
        if (!["L", "C", "Q", "Z"].includes(command.type)) continue;
        for (let n = 0; n < command.values.length - 2; n += 2)
          controls.push(command.values.slice(n, n + 2));
        const count = controls.length ? 12 : 1;
        for (let n = 1; n <= count; n++)
          points.push(
            map(curvePoint([current, ...controls, end], n / count), matrix),
          );
        current = end;
      }
      const polygon = convexHull(outside(convexHull(points), profile));
      if (polygon.length >= 3) shapes.push(polygon);
    } catch {}
  return shapes;
}
function box(points) {
  return {
    minX: Math.min(...points.map((p) => p[0])),
    maxX: Math.max(...points.map((p) => p[0])),
    minY: Math.min(...points.map((p) => p[1])),
    maxY: Math.max(...points.map((p) => p[1])),
  };
}
function disjoint(a, b, gap) {
  return (
    a.maxX + gap <= b.minX ||
    b.maxX + gap <= a.minX ||
    a.maxY + gap <= b.minY ||
    b.maxY + gap <= a.minY
  );
}
function depth(a, b, gap) {
  if (disjoint(a.box, b.box, gap)) return 0;
  let result = Infinity;
  for (const polygon of [a.points, b.points])
    for (let n = 0; n < polygon.length; n++) {
      const p = polygon[n],
        q = polygon[(n + 1) % polygon.length],
        len = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (len < 1e-8) continue;
      const axis = [-(q[1] - p[1]) / len, (q[0] - p[0]) / len],
        aa = a.points.map((v) => v[0] * axis[0] + v[1] * axis[1]),
        bb = b.points.map((v) => v[0] * axis[0] + v[1] * axis[1]);
      const d =
        Math.min(Math.max(...aa), Math.max(...bb)) -
        Math.max(Math.min(...aa), Math.min(...bb)) +
        gap;
      if (d <= 0.1) return 0;
      result = Math.min(result, d);
    }
  return Number.isFinite(result) ? result : 0;
}
function geometry(actor, angle) {
  const polygons = actor
    .polygons(angle)
    .map((points) => ({ points, box: box(points) }));
  return { polygons, box: box(polygons.flatMap((p) => p.points)) };
}
function pairScore(a, b, gap) {
  if (!a.polygons.length || !b.polygons.length || disjoint(a.box, b.box, gap))
    return 0;
  let score = 0;
  for (const p of a.polygons)
    for (const q of b.polygons) {
      const d = depth(p, q, gap);
      score += d * d;
    }
  return score;
}
export function extracellularOverlapCount(actors, { gap = 3 } = {}) {
  const shapes = actors.map((a) => geometry(a, a.angle));
  let count = 0;
  for (let i = 0; i < shapes.length; i++)
    for (let j = i + 1; j < shapes.length; j++)
      if (pairScore(shapes[i], shapes[j], gap) > 0) count++;
  return count;
}
// Coordinate descent evaluates actual deformed ectodomain polygons. Anchors never move.
export function relaxExtracellular(
  actors,
  { gap = 3, maxAngle = 45, maxDelta = 12, passes = 2 } = {},
) {
  const start = actors.map((a) => a.angle),
    caches = actors.map(() => new Map());
  const shapeAt = (i, angle) => {
    let shape = caches[i].get(angle);
    if (!shape) {
      shape = geometry(actors[i], angle);
      caches[i].set(angle, shape);
    }
    return shape;
  };
  const shapes = actors.map((a, i) => shapeAt(i, a.angle));
  let changes = 0;
  for (let pass = 0; pass < passes; pass++) {
    let changed = false;
    for (let i = 0; i < actors.length; i++) {
      const actor = actors[i];
      if (actor.locked || actor.bendable === false) continue;
      const score = (shape) =>
        shapes.reduce(
          (sum, other, j) => sum + (j === i ? 0 : pairScore(shape, other, gap)),
          0,
        );
      const initialScore = score(shapes[i]);
      if (initialScore < 1e-8) continue;
      const low =
          start[i] > maxAngle
            ? Math.max(maxAngle, start[i] - maxDelta)
            : start[i] < -maxAngle
              ? start[i]
              : Math.max(-maxAngle, start[i] - maxDelta),
        high =
          start[i] < -maxAngle
            ? Math.min(-maxAngle, start[i] + maxDelta)
            : start[i] > maxAngle
              ? start[i]
              : Math.min(maxAngle, start[i] + maxDelta);
      let best = actor.angle,
        bestScore = initialScore;
      const candidates = new Set([
        low,
        high,
        Math.max(low, Math.min(high, 0)),
        actor.angle - 1,
        actor.angle + 1,
      ]);
      for (let a = Math.ceil(low / 3) * 3; a <= high; a += 3) candidates.add(a);
      for (const angle of candidates) {
        if (angle < low || angle > high) continue;
        const value =
          score(shapeAt(i, angle)) + 0.00001 * (angle - start[i]) ** 2;
        if (value < bestScore - 1e-7) {
          bestScore = value;
          best = angle;
        }
      }
      if (best !== actor.angle) {
        actor.angle = best;
        shapes[i] = shapeAt(i, best);
        changed = true;
        changes++;
      }
    }
    if (!changed) break;
  }
  let remaining = 0;
  for (let i = 0; i < shapes.length; i++)
    for (let j = i + 1; j < shapes.length; j++)
      if (pairScore(shapes[i], shapes[j], gap) > 0) remaining++;
  if (changes)
    actors.forEach((actor, i) => {
      if (actor.angle !== start[i]) actor.apply?.(actor.angle);
    });
  return {
    moved: actors.filter((a, i) => a.angle !== start[i]).length,
    remaining,
  };
}
function rawProfile(item, root) {
  const p = receptorAnchorProfile(item);
  if (!p?.extracellular) return null;
  const b = root
    .getAttribute("viewBox")
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  if (b?.length !== 4) return null;
  return {
    x: b[0] + (p.pivotX ?? 0.5) * b[2],
    y: b[1] + p.pivotY * b[3],
    span: p.span * b[3],
    angle: p.angle || 0,
  };
}
export function prepareAutomaticEctodomains(drawing, contour, items, anchors) {
  const entries = [];
  for (const item of items)
    try {
      const source = new DOMParser().parseFromString(
          item.svg,
          "image/svg+xml",
        ).documentElement,
        profile = rawProfile(item, source);
      if (!profile) continue;
      const entity = drawing.svg.querySelector(`[data-entity="${item.id}"]`),
        art = entity.querySelector("[data-artwork]"),
        root = art.querySelector("svg");
      const toArt = affine(
          art.getScreenCTM().inverse().multiply(root.getScreenCTM()),
        ),
        domains = sourceEctodomains(source, profile);
      if (domains.length) entries.push({ item, profile, domains, toArt });
    } catch {}
  for (const anchor of anchors) {
    if (!anchor.stemProfile?.extracellular || !anchor.sourceStem) continue;
    const domains = sourceEctodomains(anchor.sourceStem, anchor.stemProfile);
    if (!domains.length) continue;
    entries.push({
      item: anchor.proxy,
      profile: anchor.stemProfile,
      domains,
      embedded: anchor,
    });
  }
  return {
    count: entries.length,
    relax(points, options) {
      const actors = entries.map((entry) => {
        const { item, profile, domains, embedded } = entry,
          frame = contourFrame(points, item.anchor2d.u, contour.closed);
        // Align supported stems to the local normal while retaining every anchor parameter.
        if (!item.locked)
          item.anchor2d.tilt = embedded ? -embedded.initialTilt : 0;
        const pose = anchoredPose(item, frame, item.anchor2d),
          r = (pose.rotation * Math.PI) / 180,
          c = Math.cos(r),
          s = Math.sin(r);
        let world;
        if (embedded) {
          const normalAngle = Math.atan2(
              frame.normal[1] * embedded.side,
              frame.normal[0] * embedded.side,
            ),
            angle =
              normalAngle -
              embedded.stemAxisAngle +
              ((item.locked ? embedded.initialTilt : 0) * Math.PI) / 180,
            rc = Math.cos(angle),
            rs = Math.sin(angle),
            m = embedded.stemMatrix;
          world = (p) => {
            const x = m.a * (p[0] - profile.x) + m.c * (p[1] - profile.y),
              y = m.b * (p[0] - profile.x) + m.d * (p[1] - profile.y);
            return [
              frame.point[0] + x * rc - y * rs,
              frame.point[1] + x * rs + y * rc,
            ];
          };
        } else
          world = (p) => {
            const local = map(p, entry.toArt),
              x = (item.mirrorX ? item.w - local[0] : local[0]) - item.w / 2,
              y = (item.mirrorY ? item.h - local[1] : local[1]) - item.h / 2;
            return [
              pose.x + item.w / 2 + x * c - y * s,
              pose.y + item.h / 2 + x * s + y * c,
            ];
          };
        const initial = embedded ? embedded.initialEctoBend || 0 : 0;
        return {
          id: item.id,
          locked: item.locked,
          angle: initial + (item.anchor2d.ectoBend || 0),
          polygons: (angle) =>
            domains
              .map((polygon) =>
                convexHull(
                  polygon.map((p) =>
                    world(extracellularPoint(p, profile, angle)),
                  ),
                ),
              )
              .filter((p) => p.length >= 3),
          apply: (angle) => {
            item.anchor2d.ectoBend = angle - initial;
          },
        };
      });
      return relaxExtracellular(actors, options);
    },
  };
}
