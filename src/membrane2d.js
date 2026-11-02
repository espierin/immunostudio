import { bezier, tangent, arcTable, arcT } from "./model.js";
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
export function membraneMarkup(item, style) {
  const points = membranePoints(item),
    table = arcTable(points),
    thickness = item.bilayerThickness || 34,
    radius = Math.min(8, thickness * 0.22),
    spacing = radius * 2.25,
    count = Math.max(2, Math.min(500, Math.ceil(table.length / spacing))),
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
  for (let n = 0; n <= count; n++) {
    const t = arcT(table, n / count),
      p = bezier(points, t),
      v = tangent(points, t),
      normal = [-v[1], v[0]],
      angle = (Math.atan2(v[1], v[0]) * 180) / Math.PI;
    for (const side of [-1, 1]) {
      const center = [
          p[0] + (normal[0] * side * thickness) / 2,
          p[1] + (normal[1] * side * thickness) / 2,
        ],
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
      svg += `<ellipse cx="${center[0]}" cy="${center[1]}" rx="${radius}" ry="${radius * 0.84}" transform="rotate(${angle} ${center[0]} ${center[1]})" fill="${head}" stroke="${edge}" stroke-width="1.5"/>`;
    }
  }
  return svg;
}
