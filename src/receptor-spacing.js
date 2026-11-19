import { anchoredPose, contourFrame } from "./contour2d.js";

function shape(item, frame, bounds, gap = 0) {
  const pose = anchoredPose(item, frame, item.anchor2d),
    r = (pose.rotation * Math.PI) / 180,
    c = Math.cos(r),
    s = Math.sin(r);
  const b = bounds || { x: 0, y: 0, w: 1, h: 1 };
  const corners = [
    [b.x * item.w - gap / 2, b.y * item.h - gap / 2],
    [(b.x + b.w) * item.w + gap / 2, b.y * item.h - gap / 2],
    [(b.x + b.w) * item.w + gap / 2, (b.y + b.h) * item.h + gap / 2],
    [b.x * item.w - gap / 2, (b.y + b.h) * item.h + gap / 2],
  ].map(([x, y]) => {
    x = (item.mirrorX ? item.w - x : x) - item.w / 2;
    y = (item.mirrorY ? item.h - y : y) - item.h / 2;
    return [
      pose.x + item.w / 2 + x * c - y * s,
      pose.y + item.h / 2 + x * s + y * c,
    ];
  });
  return {
    corners,
    minX: Math.min(...corners.map((p) => p[0])),
    maxX: Math.max(...corners.map((p) => p[0])),
    minY: Math.min(...corners.map((p) => p[1])),
    maxY: Math.max(...corners.map((p) => p[1])),
  };
}
function overlap(a, b) {
  if (
    a.maxX <= b.minX ||
    b.maxX <= a.minX ||
    a.maxY <= b.minY ||
    b.maxY <= a.minY
  )
    return 0;
  let depth = Infinity;
  for (const box of [a, b])
    for (let n = 0; n < 2; n++) {
      const p = box.corners[n],
        q = box.corners[n + 1],
        length = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1,
        axis = [-(q[1] - p[1]) / length, (q[0] - p[0]) / length];
      const aa = a.corners.map((v) => v[0] * axis[0] + v[1] * axis[1]),
        bb = b.corners.map((v) => v[0] * axis[0] + v[1] * axis[1]);
      const d =
        Math.min(Math.max(...aa), Math.max(...bb)) -
        Math.max(Math.min(...aa), Math.min(...bb));
      if (d <= 0.05) return 0;
      depth = Math.min(depth, d);
    }
  return depth;
}
function brushWeight(box, focus, radius) {
  if (!focus) return 1;
  const dx = Math.max(box.minX - focus[0], 0, focus[0] - box.maxX),
    dy = Math.max(box.minY - focus[1], 0, focus[1] - box.maxY);
  const t = Math.min(1, Math.hypot(dx, dy) / Math.max(1, radius));
  return (1 - t * t) ** 2;
}
function arcMap(points, closed) {
  const rows = [{ u: 0, s: 0 }],
    steps = Math.max(128, points.length * 6);
  let previous = contourFrame(points, 0, closed).point,
    total = 0;
  for (let n = 1; n <= steps; n++) {
    const u = n / steps,
      p = contourFrame(points, u, closed).point;
    total += Math.hypot(p[0] - previous[0], p[1] - previous[1]);
    rows.push({ u, s: total });
    previous = p;
  }
  const at = (value, from, to) => {
    let lo = 0,
      hi = rows.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (rows[m][from] < value) lo = m;
      else hi = m;
    }
    const a = rows[lo],
      b = rows[hi];
    return (
      a[to] +
      (b[to] - a[to]) *
        Math.max(0, Math.min(1, (value - a[from]) / (b[from] - a[from] || 1)))
    );
  };
  return {
    total,
    toS: (u) => at(u, "u", "s"),
    toU: (s) =>
      at(
        closed
          ? ((s % total) + total) % total
          : Math.max(0, Math.min(total, s)),
        "s",
        "u",
      ),
  };
}
function pairs(boxes, visit) {
  const sorted = boxes
    .map((box, index) => ({ box, index }))
    .sort((a, b) => a.box.minX - b.box.minX);
  let count = 0;
  for (let i = 0; i < sorted.length; i++)
    for (
      let j = i + 1;
      j < sorted.length && sorted[j].box.minX < sorted[i].box.maxX;
      j++
    ) {
      const a = sorted[i],
        b = sorted[j],
        depth = overlap(a.box, b.box);
      if (depth) {
        count++;
        visit?.(a.index, b.index, depth);
      }
    }
  return count;
}

export function receptorOverlapCount(
  items,
  contour,
  { bounds = new Map(), gap = 6 } = {},
) {
  return pairs(
    items.map((item) =>
      shape(
        item,
        contourFrame(contour.points, item.anchor2d.u, contour.closed),
        bounds.get(item.id),
        gap,
      ),
    ),
  );
}

// Only the normalized anchor position changes. The contour and molecular
// artwork are never deformed, and syncSheetAnchors keeps each stem normal.
export function spreadReceptors(
  items,
  contour,
  {
    bounds = new Map(),
    gap = 6,
    focus,
    radius = 100,
    maxShift,
    iterations = 48,
  } = {},
) {
  if (items.length < 2) return { moved: 0, remaining: 0 };
  const arc = arcMap(contour.points, contour.closed);
  if (arc.total < 1) return { moved: 0, remaining: 0 };
  const budget = maxShift ?? arc.total * 0.3,
    used = items.map(() => 0),
    start = items.map((i) => i.anchor2d.u);
  for (let pass = 0; pass < iterations; pass++) {
    const boxes = items.map((item) =>
      shape(
        item,
        contourFrame(contour.points, item.anchor2d.u, contour.closed),
        bounds.get(item.id),
        gap,
      ),
    );
    const shifts = items.map(() => 0),
      position = items.map((i) => arc.toS(i.anchor2d.u));
    const collisions = pairs(boxes, (i, j, depth) => {
      const wa = items[i].locked ? 0 : brushWeight(boxes[i], focus, radius),
        wb = items[j].locked ? 0 : brushWeight(boxes[j], focus, radius);
      if (!wa && !wb) return;
      let distance = position[j] - position[i];
      if (contour.closed)
        distance = ((distance + arc.total * 1.5) % arc.total) - arc.total / 2;
      const sign =
          Math.abs(distance) < 0.001 ? (i < j ? 1 : -1) : Math.sign(distance),
        amount = Math.min(12, Math.max(1, depth * 0.6));
      shifts[i] -= (sign * amount * wa) / (wa + wb);
      shifts[j] += (sign * amount * wb) / (wa + wb);
    });
    if (!collisions) break;
    let changed = false;
    for (let n = 0; n < items.length; n++) {
      const step =
        Math.sign(shifts[n]) *
        Math.min(Math.abs(shifts[n]), 12, Math.max(0, budget - used[n]));
      if (!step) continue;
      const u = arc.toU(position[n] + step);
      if (Math.abs(u - items[n].anchor2d.u) < 1e-9) continue;
      items[n].anchor2d.u = u;
      used[n] += Math.abs(step);
      changed = true;
    }
    if (!changed) break;
  }
  return {
    moved: items.filter(
      (item, n) => Math.abs(item.anchor2d.u - start[n]) > 1e-7,
    ).length,
    remaining: receptorOverlapCount(items, contour, { bounds, gap }),
  };
}

// Measure actual vector artwork, excluding labels and empty SVG margins.
export function measureReceptors(drawing, items) {
  const bounds = new Map();
  for (const item of items)
    try {
      const entity = drawing.svg.querySelector(`[data-entity="${item.id}"]`),
        art = entity.querySelector("[data-artwork]"),
        inverse = art.getScreenCTM().inverse();
      const points = [];
      for (const node of art.querySelectorAll("[data-node-path]")) {
        const b = node.getBBox(),
          matrix = node.getScreenCTM();
        for (const [x, y] of [
          [b.x, b.y],
          [b.x + b.width, b.y],
          [b.x + b.width, b.y + b.height],
          [b.x, b.y + b.height],
        ]) {
          const p = new DOMPoint(x, y)
            .matrixTransform(matrix)
            .matrixTransform(inverse);
          points.push(p);
        }
      }
      if (!points.length) continue;
      const x = Math.min(...points.map((p) => p.x)),
        y = Math.min(...points.map((p) => p.y)),
        w = Math.max(...points.map((p) => p.x)) - x,
        h = Math.max(...points.map((p) => p.y)) - y;
      if (w > 0 && h > 0)
        bounds.set(item.id, {
          x: x / item.w,
          y: y / item.h,
          w: w / item.w,
          h: h / item.h,
        });
    } catch {}
  return bounds;
}

// Tilt about the fixed membrane pivot. The contour and anchor position stay unchanged.
export function bendReceptors(
  items,
  contour,
  delta,
  { bounds = new Map(), focus, radius = 100, strength = 0.7 } = {},
) {
  let moved = 0;
  for (const item of items) {
    if (item.locked) continue;
    const frame = contourFrame(contour.points, item.anchor2d.u, contour.closed),
      box = shape(item, frame, bounds.get(item.id));
    const weight = brushWeight(box, focus, radius);
    if (!weight) continue;
    const along = delta[0] * frame.tangent[0] + delta[1] * frame.tangent[1];
    const tilt = Math.max(
      -60,
      Math.min(
        60,
        (item.anchor2d.tilt || 0) +
          ((Math.atan2(along, Math.max(30, item.h * 0.5)) * 180) / Math.PI) *
            weight *
            strength,
      ),
    );
    if (tilt !== item.anchor2d.tilt) {
      item.anchor2d.tilt = tilt;
      moved++;
    }
  }
  return moved;
}
