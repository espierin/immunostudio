import { receptorAnchorProfile } from "./receptor-anchor.js";

// Footprints describe only the transmembrane portion, in membrane artwork coordinates.
export function receptorFootprints(target, items, pathIndex = 0) {
  const result = [];
  for (const item of items) {
    if (
      item.visible === false ||
      item.opacity === 0 ||
      item.anchor2d?.targetId !== target.id ||
      (pathIndex !== null && (item.anchor2d.pathIndex ?? 0) !== pathIndex)
    )
      continue;
    const profile = receptorAnchorProfile(item);
    if (!profile?.width) continue;
    for (const [stemX, stemWidth] of profile.stems || [
      [profile.tmX ?? profile.pivotX ?? 0.5, profile.width],
    ]) {
      const x = stemX * item.w,
        y = profile.pivotY * item.h;
      const hw = (stemWidth * item.w) / 2 + 0.15,
        hh = (profile.span * item.h) / 2 + 0.5;
      const angle = ((item.rotation || 0) * Math.PI) / 180,
        c = Math.cos(angle),
        s = Math.sin(angle);
      const inverse = (-(target.rotation || 0) * Math.PI) / 180,
        tc = Math.cos(inverse),
        ts = Math.sin(inverse);
      result.push(
        [
          [x - hw, y - hh],
          [x + hw, y - hh],
          [x + hw, y + hh],
          [x - hw, y + hh],
        ].map(([px, py]) => {
          px = (item.mirrorX ? item.w - px : px) - item.w / 2;
          py = (item.mirrorY ? item.h - py : py) - item.h / 2;
          const wx =
              item.x + item.w / 2 + px * c - py * s - (target.x + target.w / 2),
            wy =
              item.y + item.h / 2 + px * s + py * c - (target.y + target.h / 2);
          const lx = wx * tc - wy * ts + target.w / 2,
            ly = wx * ts + wy * tc + target.h / 2;
          return [
            target.mirrorX ? target.w - lx : lx,
            target.mirrorY ? target.h - ly : ly,
          ];
        }),
      );
    }
  }
  return result;
}

export function polygonsOverlap(a, b) {
  for (const polygon of [a, b])
    for (let n = 0; n < polygon.length; n++) {
      const p = polygon[n],
        q = polygon[(n + 1) % polygon.length],
        axis = [p[1] - q[1], q[0] - p[0]];
      const aa = a.map((v) => v[0] * axis[0] + v[1] * axis[1]),
        bb = b.map((v) => v[0] * axis[0] + v[1] * axis[1]);
      if (
        Math.max(...aa) <= Math.min(...bb) ||
        Math.max(...bb) <= Math.min(...aa)
      )
        return false;
    }
  return true;
}

// Cut tail strokes at the actual protein boundary, retaining the remaining lipid.
export function outsideSegments(segments, footprints) {
  for (const polygon of footprints) {
    const area = polygon.reduce((s, p, n) => {
      const q = polygon[(n + 1) % polygon.length];
      return s + p[0] * q[1] - p[1] * q[0];
    }, 0);
    const sign = Math.sign(area) || 1;
    segments = segments.flatMap(([a, b]) => {
      let low = 0,
        high = 1;
      for (let n = 0; n < polygon.length; n++) {
        const p = polygon[n],
          q = polygon[(n + 1) % polygon.length];
        const d = (v) =>
          sign *
          ((q[0] - p[0]) * (v[1] - p[1]) - (q[1] - p[1]) * (v[0] - p[0]));
        const da = d(a),
          db = d(b),
          delta = db - da;
        if (Math.abs(delta) < 1e-12) {
          if (da < 0) return [[a, b]];
          continue;
        }
        const t = -da / delta;
        if (delta > 0) low = Math.max(low, t);
        else high = Math.min(high, t);
        if (low >= high) return [[a, b]];
      }
      const at = (t) => a.map((v, k) => v + (b[k] - v) * t),
        result = [];
      if (low > 1e-8) result.push([a, at(low)]);
      if (high < 1 - 1e-8) result.push([at(high), b]);
      return result;
    });
  }
  return segments;
}

// Subtract a convex footprint without SVG masks, so exported paths remain plain vectors.
export function subtractFootprint(subject, clip) {
  if (!polygonsOverlap(subject, clip)) return [subject];
  const area = clip.reduce((sum, p, n) => {
      const q = clip[(n + 1) % clip.length];
      return sum + p[0] * q[1] - q[0] * p[1];
    }, 0),
    sign = Math.sign(area) || 1;
  let inside = subject;
  const outside = [];
  for (let n = 0; n < clip.length && inside.length >= 3; n++) {
    const a = clip[n],
      b = clip[(n + 1) % clip.length];
    const distance = (p) =>
      sign * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]));
    const cut = (keepInside) => {
      const output = [];
      for (let j = 0; j < inside.length; j++) {
        const p = inside[j],
          q = inside[(j + 1) % inside.length],
          dp = distance(p),
          dq = distance(q),
          ip = keepInside ? dp >= 0 : dp <= 0,
          iq = keepInside ? dq >= 0 : dq <= 0;
        if (ip) output.push(p);
        if (ip !== iq) {
          const t = dp / (dp - dq);
          output.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
        }
      }
      return output;
    };
    const piece = cut(false),
      next = cut(true);
    if (piece.length >= 3) outside.push(piece);
    inside = next;
  }
  return outside;
}

// For other receptor artwork, sample the geometry that actually crosses the membrane slab.
export function sampledStemFootprints(node, frame, screenToSheet, thickness) {
  if (!node) return [];
  return [...node.querySelectorAll("[data-node-path]")].flatMap((shape) => {
    // A single open path can contain several disconnected membrane stems.
    // Keep those crossings separate instead of bridging the space between them.
    try {
      const style = getComputedStyle(shape);
      if (style.fill === "none" || shape.getAttribute?.("fill") === "none") {
        const matrix = screenToSheet.multiply(shape.getScreenCTM()),
          scale = Math.hypot(matrix.a, matrix.b),
          length = shape.getTotalLength(),
          count = Math.max(
            8,
            Math.min(4096, Math.ceil((length * scale) / 0.75)),
          ),
          stroke = Math.max(
            0.25,
            ((parseFloat(style.strokeWidth) || 1) * scale) / 2,
          ),
          result = [];
        let low = Infinity,
          high = -Infinity,
          previous;
        const flush = () => {
          if (!Number.isFinite(low)) return;
          const at = (along, depth) =>
            frame.point.map(
              (v, k) => v + frame.tangent[k] * along + frame.normal[k] * depth,
            );
          result.push([
            at(low, -thickness / 2 - 0.5),
            at(high, -thickness / 2 - 0.5),
            at(high, thickness / 2 + 0.5),
            at(low, thickness / 2 + 0.5),
          ]);
          low = Infinity;
          high = -Infinity;
        };
        for (let n = 0; n <= count; n++) {
          const p = shape.getPointAtLength((length * n) / count),
            world = new DOMPoint(p.x, p.y).matrixTransform(matrix),
            dx = world.x - frame.point[0],
            dy = world.y - frame.point[1];
          if (
            previous &&
            Math.hypot(world.x - previous.x, world.y - previous.y) >
              Math.max(2, ((length * scale) / count) * 4)
          )
            flush();
          previous = world;
          if (
            Math.abs(dx * frame.normal[0] + dy * frame.normal[1]) >
            thickness / 2 + stroke
          ) {
            flush();
            continue;
          }
          const along = dx * frame.tangent[0] + dy * frame.tangent[1];
          low = Math.min(low, along - stroke);
          high = Math.max(high, along + stroke);
        }
        flush();
        return result;
      }
    } catch {}
    const footprint = sampledStemFootprint(
      { querySelectorAll: () => [shape] },
      frame,
      screenToSheet,
      thickness,
    );
    return footprint ? [footprint] : [];
  });
}
export function sampledStemFootprint(node, frame, screenToSheet, thickness) {
  if (!node) return null;
  let low = Infinity,
    high = -Infinity;
  for (const shape of node.querySelectorAll("[data-node-path]"))
    try {
      if (!shape.getTotalLength) continue;
      const matrix = screenToSheet.multiply(shape.getScreenCTM()),
        scale = Math.hypot(matrix.a, matrix.b);
      const length = shape.getTotalLength(),
        count = Math.max(8, Math.min(160, Math.ceil((length * scale) / 3)));
      const stroke = Math.max(
        0.5,
        ((parseFloat(getComputedStyle(shape).strokeWidth) || 1) * scale) / 2,
      );
      for (let n = 0; n <= count; n++) {
        const p = shape.getPointAtLength((length * n) / count),
          world = new DOMPoint(p.x, p.y).matrixTransform(matrix),
          dx = world.x - frame.point[0],
          dy = world.y - frame.point[1];
        if (
          Math.abs(dx * frame.normal[0] + dy * frame.normal[1]) >
          thickness / 2 + stroke
        )
          continue;
        const along = dx * frame.tangent[0] + dy * frame.tangent[1];
        low = Math.min(low, along - stroke);
        high = Math.max(high, along + stroke);
      }
    } catch {}
  if (!Number.isFinite(low)) return null;
  const point = (along, depth) => [
    frame.point[0] + frame.tangent[0] * along + frame.normal[0] * depth,
    frame.point[1] + frame.tangent[1] * along + frame.normal[1] * depth,
  ];
  return [
    point(low, -thickness / 2 - 0.5),
    point(high, -thickness / 2 - 0.5),
    point(high, thickness / 2 + 0.5),
    point(low, thickness / 2 + 0.5),
  ];
}
