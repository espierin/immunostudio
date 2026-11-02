const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
// Mean-value cage coordinates transport the whole cell interior, including a
// nucleus far from the brush. Signed weights also handle concave cell outlines.
export function interiorWeights(contour, p) {
  const n = contour.length,
    vectors = contour.map((v) => [v[0] - p[0], v[1] - p[1]]),
    lengths = vectors.map((v) => Math.hypot(...v));
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const a = contour[i],
      b = contour[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
    if (lengths[i] < 1e-7) return contour.map((_, k) => (k === i ? 1 : 0));
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      l2 = dx * dx + dy * dy,
      t = l2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0;
    if (
      t >= 0 &&
      t <= 1 &&
      Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy) < 1e-6
    )
      return contour.map((_, k) => (k === i ? 1 - t : k === j ? t : 0));
  }
  if (!inside) return null;
  const halves = vectors.map((a, i) => {
      const b = vectors[(i + 1) % n];
      return Math.tan(
        Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1]) / 2,
      );
    }),
    weights = lengths.map((r, i) => (halves[(i + n - 1) % n] + halves[i]) / r),
    sum = weights.reduce((a, b) => a + b, 0);
  return Math.abs(sum) > 1e-10 && weights.every(Number.isFinite)
    ? weights.map((v) => v / sum)
    : null;
}
export function deformInteriorPoint(
  p,
  before,
  after,
  closed = true,
  radius = 100,
  weights = undefined,
) {
  if (closed) {
    const w = weights === undefined ? interiorWeights(before, p) : weights;
    if (!w) return [...p];
    return p.map(
      (v, k) =>
        v + w.reduce((sum, x, i) => sum + x * (after[i][k] - before[i][k]), 0),
    );
  }
  const old = nearestContour(before, p, false),
    next = contourFrame(after, old.u, false),
    offset = p.map((v, k) => v - old.point[k]),
    along = offset[0] * old.tangent[0] + offset[1] * old.tangent[1],
    normal = offset[0] * old.normal[0] + offset[1] * old.normal[1],
    blend = Math.max(0, 1 - old.distance / Math.max(1, radius));
  return p.map(
    (v, k) =>
      v +
      (next.point[k] + next.tangent[k] * along + next.normal[k] * normal - v) *
        blend,
  );
}
export const signedArea = (p) =>
  p.reduce((a, v, i) => {
    const q = p[(i + 1) % p.length];
    return a + v[0] * q[1] - q[0] * v[1];
  }, 0) / 2;
export function contourCommands(points, closed = true) {
  const n = points.length,
    at = (i) => points[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))],
    out = [{ type: "M", values: [...points[0]] }];
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const a = at(i - 1),
      b = at(i),
      c = at(i + 1),
      d = at(i + 2);
    out.push({
      type: "C",
      values: [
        b[0] + (c[0] - a[0]) / 6,
        b[1] + (c[1] - a[1]) / 6,
        c[0] - (d[0] - b[0]) / 6,
        c[1] - (d[1] - b[1]) / 6,
        ...c,
      ],
    });
  }
  if (closed) out.push({ type: "Z", values: [] });
  return out;
}
export function contourFrame(points, u, closed = true) {
  const commands = contourCommands(points, closed),
    count = closed ? points.length : points.length - 1,
    f = Math.max(0, Math.min(1, u)) * count,
    i = Math.min(count - 1, Math.floor(f)),
    t = Math.min(1, f - i),
    a = points[i],
    v = commands[i + 1].values,
    b = v.slice(0, 2),
    c = v.slice(2, 4),
    d = v.slice(4, 6),
    q = 1 - t,
    point = a.map(
      (v, k) =>
        q * q * q * v +
        3 * q * q * t * b[k] +
        3 * q * t * t * c[k] +
        t * t * t * d[k],
    ),
    tangent = a.map(
      (v, k) =>
        3 * q * q * (b[k] - v) +
        6 * q * t * (c[k] - b[k]) +
        3 * t * t * (d[k] - c[k]),
    ),
    len = Math.hypot(...tangent) || 1,
    side = closed && signedArea(points) < 0 ? -1 : 1;
  return {
    point,
    tangent: tangent.map((v) => v / len),
    normal: [(side * tangent[1]) / len, (-side * tangent[0]) / len],
  };
}
export function nearestContour(points, point, closed = true) {
  let best = { distance: Infinity, u: 0 };
  const n = closed ? points.length : points.length - 1;
  for (let i = 0; i < n; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length],
      dx = b[0] - a[0],
      dy = b[1] - a[1],
      t = Math.max(
        0,
        Math.min(
          1,
          ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) /
            (dx * dx + dy * dy || 1),
        ),
      ),
      p = mix(a, b, t),
      distance = Math.hypot(point[0] - p[0], point[1] - p[1]);
    if (distance < best.distance) best = { distance, u: (i + t) / n };
  }
  return { ...best, ...contourFrame(points, best.u, closed) };
}
export function sculptContour(
  points,
  centre,
  delta,
  {
    radius = 100,
    strength = 0.7,
    mode = "drag",
    closed = true,
    invert = false,
  } = {},
) {
  const distance = Math.hypot(...delta),
    direction = invert ? -1 : 1;
  return points.map((p, i) => {
    const r = Math.hypot(p[0] - centre[0], p[1] - centre[1]) / radius;
    if (r >= 1) return [...p];
    const w = (1 - r * r) ** 2 * strength;
    if (mode === "smooth") {
      const a = points[(i + points.length - 1) % points.length],
        b = points[(i + 1) % points.length];
      if (!closed && (i === 0 || i === points.length - 1)) return [...p];
      return mix(p, mix(a, b, 0.5), Math.min(1, distance / radius) * w);
    }
    if (mode === "inflate" || mode === "deflate") {
      const normal = contourFrame(
          points,
          i / (closed ? points.length : points.length - 1),
          closed,
        ).normal,
        amount =
          Math.min(distance, radius * 0.65) *
          w *
          (mode === "deflate" ? -1 : 1) *
          direction;
      return p.map((v, k) => v + normal[k] * amount);
    }
    const factor = Math.min(1, (radius * 0.8) / (distance || 1));
    return p.map((v, k) => v + delta[k] * factor * w * direction);
  });
}
export function smoothContour(points, amount = 0.35, closed = true) {
  return points.map((p, i) =>
    !closed && (i === 0 || i === points.length - 1)
      ? [...p]
      : mix(
          p,
          mix(
            points[(i + points.length - 1) % points.length],
            points[(i + 1) % points.length],
            0.5,
          ),
          amount,
        ),
  );
}
export function offsetContour(points, distance, closed = true) {
  return points.map((p, i) => {
    const n = contourFrame(
      points,
      i / (closed ? points.length : points.length - 1),
      closed,
    ).normal;
    return p.map((v, k) => v + distance * n[k]);
  });
}
export function simplifyContour(points, tolerance = 2, closed = true) {
  const segment = (pts) => {
    const a = pts[0],
      b = pts.at(-1),
      dx = b[0] - a[0],
      dy = b[1] - a[1];
    let max = 0,
      at = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i],
        t = Math.max(
          0,
          Math.min(
            1,
            ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) /
              (dx * dx + dy * dy || 1),
          ),
        ),
        d = Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dy * t);
      if (d > max) {
        max = d;
        at = i;
      }
    }
    return max > tolerance
      ? [
          ...segment(pts.slice(0, at + 1)).slice(0, -1),
          ...segment(pts.slice(at)),
        ]
      : [a, b];
  };
  if (points.length < 5) return points.map((p) => [...p]);
  if (!closed) return segment(points);
  const half = Math.floor(points.length / 2),
    result = [
      ...segment(points.slice(0, half + 1)).slice(0, -1),
      ...segment([...points.slice(half), points[0]]).slice(0, -1),
    ];
  return result.length >= 4 ? result : points.map((p) => [...p]);
}
export function validContour(points, closed = true) {
  if (points.length < (closed ? 4 : 2) || !points.flat().every(Number.isFinite))
    return false;
  if (!closed) return true;
  if (Math.abs(signedArea(points)) < 1) return false;
  const cross = (a, b, c) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  for (let i = 0; i < points.length; i++)
    for (let j = i + 2; j < points.length; j++) {
      if (i === 0 && j === points.length - 1) continue;
      const a = points[i],
        b = points[(i + 1) % points.length],
        c = points[j],
        d = points[(j + 1) % points.length];
      if (
        cross(a, b, c) * cross(a, b, d) < -1e-6 &&
        cross(c, d, a) * cross(c, d, b) < -1e-6
      )
        return false;
    }
  return true;
}
export function anchoredPose(item, frame, anchor) {
  const normal = frame.normal.map((v) => v * (anchor.side || 1)),
    rotation =
      Math.atan2(normal[1], normal[0]) +
      Math.PI / 2 +
      ((anchor.angle || 0) * Math.PI) / 180,
    c = Math.cos(rotation),
    s = Math.sin(rotation),
    x = ((anchor.pivotX ?? 0.5) - 0.5) * item.w,
    y = ((anchor.pivotY ?? 0.8) - 0.5) * item.h,
    point = frame.point.map((v, k) => v + normal[k] * (anchor.offset || 0));
  return {
    x: point[0] - x * c + y * s - item.w / 2,
    y: point[1] - x * s - y * c - item.h / 2,
    rotation: (rotation * 180) / Math.PI,
  };
}
