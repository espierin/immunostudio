import { receptorAnchorProfile } from "./receptor-anchor.js";

// Footprints describe only the transmembrane portion, in membrane artwork coordinates.
export function receptorFootprints(target, items) {
  const result = [];
  for (const item of items) {
    if (
      item.visible === false ||
      item.opacity === 0 ||
      item.anchor2d?.targetId !== target.id ||
      (item.anchor2d.pathIndex ?? 0) !== 0
    )
      continue;
    const profile = receptorAnchorProfile(item);
    if (!profile?.width) continue;
    const x = (profile.tmX ?? profile.pivotX ?? 0.5) * item.w,
      y = profile.pivotY * item.h;
    const hw = (profile.width * item.w) / 2 + 0.5,
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
