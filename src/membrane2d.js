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
    const lipids = Array.from({ length: size }, (_, n) => {
      const distance = (n / count) * length;
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
    });
    return { side, length, lipids };
  });
  return { points, thickness, radius, leaflets };
}
export function membraneMarkup(item, style) {
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
  for (const { side, lipids } of leaflets) {
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
        svg += `<path d="M${a.join(" ")}L${b.join(" ")}L${c.join(" ")}" fill="none" stroke="${tail}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`;
      }
      svg += `<ellipse data-lipid-side="${side}" cx="${center[0]}" cy="${center[1]}" rx="${radius}" ry="${radius * 0.84}" transform="rotate(${angle} ${center[0]} ${center[1]})" fill="${head}" stroke="${edge}" stroke-width="1.5"/>`;
    }
  }
  return svg;
}
