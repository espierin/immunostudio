import {
  polygonsOverlap,
  subtractFootprint,
  outsideSegments,
} from "./receptor-footprints.js";
import { bezier, tangent } from "./model.js";
export function membranePoints(item) {
  return (
    item.curve || [
      [0.06, 0.5],
      [0.33, 0.28],
      [0.67, 0.72],
      [0.94, 0.5],
    ]
  ).map(([x, y]) => [x * item.w, y * item.h]);
}
// Each leaflet has its own physical arc length. Lipids are packed along that
// offset edge, rather than paired at equal parameters on the centre curve.
export function membraneLeaflets(item) {
  const points = membranePoints(item),
    thickness = item.bilayerThickness || 34,
    radius = Math.min(8, thickness * 0.22),
    pitch = radius * 2 + 1.1,
    steps = Math.max(300, ((points.length - 1) / 3) * 100);
  const frames = Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    return { t, p: bezier(points, t), v: tangent(points, t) };
  });
  const leaflets = [-1, 1].map((side) => {
    let length = 0,
      previous;
    const rows = frames.map(({ t, p, v }) => {
      const center = [
        p[0] - (v[1] * side * thickness) / 2,
        p[1] + (v[0] * side * thickness) / 2,
      ];
      if (previous)
        length += Math.hypot(center[0] - previous[0], center[1] - previous[1]);
      previous = center;
      return { t, s: length };
    });
    const count = Math.max(1, Math.min(2000, Math.ceil(length / pitch))),
      size = length < 1e-8 ? 1 : count + (item.closed ? 0 : 1);
    const atDistance = (distance) => {
      let lo = 0,
        hi = rows.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (rows[mid].s < distance) lo = mid + 1;
        else hi = mid;
      }
      const b = rows[lo],
        a = rows[Math.max(0, lo - 1)],
        t = a.t + ((b.t - a.t) * (distance - a.s)) / (b.s - a.s || 1),
        p = bezier(points, t),
        v = tangent(points, t),
        normal = [-v[1], v[0]];
      return {
        t,
        center: [
          p[0] + (normal[0] * side * thickness) / 2,
          p[1] + (normal[1] * side * thickness) / 2,
        ],
        tangent: v,
        normal,
      };
    };
    const lipids = Array.from({ length: size }, (_, n) =>
      atDistance((n / count) * length),
    );
    return { side, length, lipids, atDistance };
  });
  return { points, thickness, radius, leaflets };
}
export function membraneMarkup(item, style, footprints = []) {
  const { points, thickness, radius, leaflets } = membraneLeaflets(item),
    head = style.head,
    tail = style.tail,
    edge = style.ui ? style.outline : "#2167AE";
  const offset = (t, side) => {
    const p = bezier(points, t),
      v = tangent(points, t);
    return [
      p[0] - (v[1] * side * thickness) / 2,
      p[1] + (v[0] * side * thickness) / 2,
    ];
  };
  const upper = Array.from({ length: 121 }, (_, i) => offset(i / 120, -1)),
    lower = Array.from({ length: 121 }, (_, i) => offset(1 - i / 120, 1));
  let svg = `<path d="M${[...upper, ...lower].map((p) => p.join(" ")).join("L")}Z" fill="${style.core || "#D9EAF6"}" stroke="none"/>`;
  if (footprints.length) {
    const polygons = [];
    for (let n = 0; n < 120; n++) {
      let parts = [[upper[n], upper[n + 1], lower[119 - n], lower[120 - n]]];
      for (const footprint of footprints)
        parts = parts.flatMap((p) => subtractFootprint(p, footprint));
      polygons.push(...parts);
    }
    svg = `<path data-membrane-core="true" d="${polygons.map((p) => "M" + p.map((v) => v.join(" ")).join("L") + "Z").join("")}" fill="${style.core || "#D9EAF6"}" stroke="none"/>`;
  }
  for (const leaflet of leaflets) {
    const { side } = leaflet;
    const lipids = packLeaflet(leaflet, radius, footprints, !!item.closed);
    for (const { center, tangent: v, normal } of lipids) {
      const angle = (Math.atan2(v[1], v[0]) * 180) / Math.PI,
        length = thickness / 2 - radius * 0.78 - 1;
      for (const branch of [-1, 1]) {
        const a = [
            center[0] +
              v[0] * branch * radius * 0.4 -
              normal[0] * side * radius * 0.74,
            center[1] +
              v[1] * branch * radius * 0.4 -
              normal[1] * side * radius * 0.74,
          ],
          b = [
            a[0] - normal[0] * side * length * 0.48 + v[0] * branch * 1.7,
            a[1] - normal[1] * side * length * 0.48 + v[1] * branch * 1.7,
          ],
          c = [
            a[0] - normal[0] * side * length - v[0] * branch * 1.3,
            a[1] - normal[1] * side * length - v[1] * branch * 1.3,
          ];
        const segments = outsideSegments(
          [
            [a, b],
            [b, c],
          ],
          footprints,
        );
        if (segments.length)
          svg += `<path d="${segments.map(([p, q]) => `M${p.join(" ")}L${q.join(" ")}`).join("")}" fill="none" stroke="${tail}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`;
      }
      svg += `<ellipse data-lipid-side="${side}" cx="${center[0]}" cy="${center[1]}" rx="${radius}" ry="${radius * 0.84}" transform="rotate(${angle} ${center[0]} ${center[1]})" fill="${head}" stroke="${edge}" stroke-width="1.5"/>`;
    }
  }
  return svg;
}

// Repack each free stretch, using the head outline instead of a whole lipid box.
export function packLeaflet(leaflet, radius, footprints, closed = false) {
  if (!footprints.length) return leaflet.lipids;
  const { length, atDistance } = leaflet;
  if (length < 1e-8) return leaflet.lipids;
  const free = (distance) => {
    const { center, tangent: v, normal } = atDistance(distance);
    const head = Array.from({ length: 16 }, (_, n) => {
      const angle = (n * Math.PI) / 8,
        x = Math.cos(angle) * (radius + 0.75),
        y = Math.sin(angle) * (radius * 0.84 + 0.75);
      return [
        center[0] + v[0] * x + normal[0] * y,
        center[1] + v[1] * x + normal[1] * y,
      ];
    });
    return !footprints.some((p) => polygonsOverlap(head, p));
  };
  const steps = Math.max(1, Math.min(12000, Math.ceil(length))),
    runs = [];
  let start = free(0) ? 0 : null,
    previous = 0,
    wasFree = start !== null;
  for (let n = 1; n <= steps; n++) {
    const distance = (n / steps) * length,
      isFree = free(distance);
    if (isFree !== wasFree) {
      let low = previous,
        high = distance;
      for (let k = 0; k < 10; k++) {
        const mid = (low + high) / 2;
        if (free(mid) === wasFree) low = mid;
        else high = mid;
      }
      if (wasFree) runs.push([start, low]);
      else start = high;
    }
    wasFree = isFree;
    previous = distance;
  }
  if (wasFree) runs.push([start, length]);
  if (runs.length === 1 && runs[0][0] === 0 && runs[0][1] === length)
    return leaflet.lipids;
  // Join the free stretch across the seam of a closed contour.
  if (
    closed &&
    runs.length > 1 &&
    runs[0][0] === 0 &&
    runs.at(-1)[1] === length
  ) {
    const first = runs.shift(),
      last = runs.pop();
    runs.push([last[0], length + first[1]]);
  }
  const result = [],
    pitch = radius * 2 + 1.1;
  for (const [a, b] of runs) {
    const count = Math.max(1, Math.floor((b - a) / pitch));
    for (let n = 0; n <= count; n++) {
      if (b - a < pitch && n > 0) continue;
      const distance = b - a < pitch ? (a + b) / 2 : a + ((b - a) * n) / count;
      result.push(atDistance(closed ? distance % length || 0 : distance));
    }
  }
  return result;
}
