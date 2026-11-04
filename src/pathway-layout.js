// Native pathway layout and live connections. Coordinates are sheet units.
const E = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c],
  );
const center = (n) => ({ x: n.x + n.w / 2, y: n.y + n.h / 2 });
export const pathwayContainer = (n) =>
  n.pathway?.role === "compartment" || !!n.pathwayMemberIds?.length;
const isNode = (n) =>
  n.pathway &&
  n.pathway.role !== "edge" &&
  !n.pathwayConnection &&
  !pathwayContainer(n);
export function itemBounds(n, pad = 0) {
  const a = ((n.rotation || 0) * Math.PI) / 180,
    c = Math.abs(Math.cos(a)),
    s = Math.abs(Math.sin(a)),
    p = center(n),
    w = n.w * c + n.h * s,
    h = n.w * s + n.h * c;
  return {
    x: p.x - w / 2 - pad,
    y: p.y - h / 2 - pad,
    w: w + 2 * pad,
    h: h + 2 * pad,
    id: n.id,
  };
}
export function overlaps(a, b, gap = 0) {
  return (
    a.x < b.x + b.w + gap &&
    a.x + a.w + gap > b.x &&
    a.y < b.y + b.h + gap &&
    a.y + a.h + gap > b.y
  );
}
class SpatialIndex {
  constructor(boxes = [], size = 160) {
    this.cells = new Map();
    this.size = size;
    boxes.forEach((b) => this.add(b));
  }
  keys(b) {
    const out = [];
    for (
      let x = Math.floor(b.x / this.size);
      x <= Math.floor((b.x + b.w) / this.size);
      x++
    )
      for (
        let y = Math.floor(b.y / this.size);
        y <= Math.floor((b.y + b.h) / this.size);
        y++
      )
        out.push(`${x},${y}`);
    return out;
  }
  add(b) {
    for (const k of this.keys(b)) {
      if (!this.cells.has(k)) this.cells.set(k, []);
      this.cells.get(k).push(b);
    }
  }
  query(b) {
    return [...new Set(this.keys(b).flatMap((k) => this.cells.get(k) || []))];
  }
}
export function layoutPathway(items, { expand = true } = {}) {
  const nodes = items.filter(isNode),
    index = new SpatialIndex();
  if (!nodes.length) return;
  const origin = {
    x: Math.min(...nodes.map((n) => n.x)),
    y: Math.min(...nodes.map((n) => n.y)),
  };
  // More room for illustrated imports while retaining the source neighbourhoods.
  const factor = expand && nodes.some((n) => n.pathwayIllustration) ? 1.8 : 1;
  for (const n of nodes) {
    if (n.locked) {
      index.add(itemBounds(n, 14));
      continue;
    }
    const p =
      expand && n.pathwaySourceBounds
        ? center(n.pathwaySourceBounds)
        : center(n);
    n.x = origin.x + (p.x - origin.x) * factor - n.w / 2;
    n.y = origin.y + (p.y - origin.y) * factor - n.h / 2;
  }
  for (const n of nodes
    .filter((n) => !n.locked)
    .sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id))) {
    const home = { x: n.x, y: n.y },
      valid = () => {
        const b = itemBounds(n, 10);
        return !index.query(b).some((o) => overlaps(b, o));
      };
    if (!valid()) {
      let found = false;
      for (let radius = 24; radius < 14000 && !found; radius += 24) {
        // Search nearest free positions, retaining source row/column context.
        for (const [dx, dy] of [
          [radius, 0],
          [-radius, 0],
          [0, radius],
          [0, -radius],
          [radius, radius],
          [-radius, radius],
          [radius, -radius],
          [-radius, -radius],
        ]) {
          n.x = home.x + dx;
          n.y = home.y + dy;
          if (valid()) {
            found = true;
            break;
          }
        }
      }
      if (!found)
        throw Error(
          "Het pathway past niet op het tekenblad. Kies een kleiner deelpathway.",
        );
    }
    index.add(itemBounds(n, 10));
  }
  const byId = new Map(items.map((i) => [i.id, i]));
  for (const group of items.filter(pathwayContainer)) {
    if (group.locked) continue;
    const members = (group.pathwayMemberIds || [])
      .map((id) => byId.get(id))
      .filter(Boolean);
    if (!members.length) continue;
    const boxes = members.map((n) => itemBounds(n)),
      x = Math.min(...boxes.map((b) => b.x)) - 16,
      y = Math.min(...boxes.map((b) => b.y)) - 32;
    group.x = x;
    group.y = y;
    group.w = Math.max(...boxes.map((b) => b.x + b.w)) - x + 16;
    group.h = Math.max(...boxes.map((b) => b.y + b.h)) - y + 16;
    group.rotation = 0;
    group.svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${group.w} ${group.h}"><title>${E(group.name)}</title><metadata data-pathway-metadata="true">${E(JSON.stringify(group.pathway))}</metadata><rect x="1" y="1" width="${group.w - 2}" height="${group.h - 2}" rx="10" fill="#edf5fb" fill-opacity=".12" stroke="#426884" stroke-dasharray="5 4"/><text data-pathway-label="true" x="12" y="20" font-family="Arial,sans-serif" font-size="14" fill="#064986">${E(group.pathway.label)}</text></svg>`;
    group.pathwayLabelLayout = {
      w: group.w,
      h: group.h,
      fontSize: 14,
      top: true,
    };
  }
  // Points with no declared biological target keep their source location.
  if (factor !== 1)
    for (const edge of items)
      for (const link of edge.pathwayConnection?.links || [])
        for (const k of ["a", "b"]) {
          link[k].x = origin.x + (link[k].x - origin.x) * factor;
          link[k].y = origin.y + (link[k].y - origin.y) * factor;
        }
}
export function markerFor(value = "") {
  if (/tbar|inhib/i.test(value)) return "inhibition";
  if (/catalys/i.test(value)) return "catalysis";
  if (/modulat/i.test(value)) return "modulation";
  if (/stimulat|activat/i.test(value)) return "activation";
  return /arrow|conversion|output|reversible/i.test(value) ? "arrow" : "none";
}
export function makeConnection(
  edge,
  from,
  to,
  a,
  b,
  start = "none",
  end = "arrow",
) {
  edge.pathwayConnection = {
    version: 1,
    links: [
      {
        from: from || null,
        to: to || null,
        a: { ...a },
        b: { ...b },
        start,
        end,
      },
    ],
  };
  return edge;
}
export function remapPathwayLinks(
  items,
  ids,
  dx = 0,
  dy = 0,
  { detachExternal = false } = {},
) {
  for (const item of items) {
    if (item.pathwayMemberIds)
      item.pathwayMemberIds = item.pathwayMemberIds.map(
        (id) => ids.get(id) || id,
      );
    for (const link of item.pathwayConnection?.links || []) {
      for (const key of ["from", "to"])
        link[key] = ids.get(link[key]) || (detachExternal ? null : link[key]);
      for (const key of ["a", "b"]) {
        link[key].x += dx;
        link[key].y += dy;
      }
    }
  }
}
// Connection ports sit on artwork, not in the label area. Transform them with
// the node so rotation, reflection and resizing keep the same attachment.
export function connectionPort(n, toward, preferredSide) {
  const geo = n.pathwayGeometry || { x: 0, y: 0, w: 1, h: 1, shape: "rect" },
    angle = ((n.rotation || 0) * Math.PI) / 180,
    c = Math.cos(angle),
    s = Math.sin(angle),
    nc = center(n),
    dx = toward.x - nc.x,
    dy = toward.y - nc.y;
  const local = {
    x: n.w / 2 + (dx * c + dy * s) * (n.mirrorX ? -1 : 1),
    y: n.h / 2 + (-dx * s + dy * c) * (n.mirrorY ? -1 : 1),
  };
  const box = {
      x: geo.x * n.w,
      y: geo.y * n.h,
      w: geo.w * n.w,
      h: geo.h * n.h,
    },
    p = { x: box.x + box.w / 2, y: box.y + box.h / 2 };
  const vx = local.x - p.x,
    vy = local.y - p.y;
  const side =
    preferredSide ||
    (geo.h < 0.95 && vy > 0
      ? vx >= 0
        ? "right"
        : "left"
      : Math.abs(vx) > Math.abs(vy)
        ? vx >= 0
          ? "right"
          : "left"
        : vy >= 0
          ? "bottom"
          : "top");
  const dir = {
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
    top: { x: 0, y: -1 },
    bottom: { x: 0, y: 1 },
  }[side];
  let distance = dir.x ? box.w / 2 : box.h / 2;
  if (geo.outlines?.length) {
    const hits = [];
    for (const path of geo.outlines)
      for (let i = 0; i < path.length; i++) {
        const a = { x: path[i][0] * n.w, y: path[i][1] * n.h },
          b = {
            x: path[(i + 1) % path.length][0] * n.w,
            y: path[(i + 1) % path.length][1] * n.h,
          },
          vx = b.x - a.x,
          vy = b.y - a.y,
          den = dir.x * vy - dir.y * vx;
        if (Math.abs(den) < 1e-8) continue;
        const t = ((a.x - p.x) * vy - (a.y - p.y) * vx) / den,
          u = ((a.x - p.x) * dir.y - (a.y - p.y) * dir.x) / den;
        if (t >= 0 && u >= 0 && u <= 1) hits.push(t);
      }
    if (hits.length) distance = Math.max(...hits);
  }
  p.x += dir.x * distance;
  p.y += dir.y * distance;
  const world = (q) => {
    const x = (q.x - n.w / 2) * (n.mirrorX ? -1 : 1),
      y = (q.y - n.h / 2) * (n.mirrorY ? -1 : 1);
    return { x: nc.x + x * c - y * s, y: nc.y + x * s + y * c };
  };
  const endpoint = world(p),
    direction = {
      x: dir.x * (n.mirrorX ? -1 : 1) * c - dir.y * (n.mirrorY ? -1 : 1) * s,
      y: dir.x * (n.mirrorX ? -1 : 1) * s + dir.y * (n.mirrorY ? -1 : 1) * c,
    },
    outer = itemBounds(n, 12);
  const reach = Math.max(
    12,
    Math.abs(direction.x) > 1e-5
      ? ((direction.x > 0 ? outer.x + outer.w : outer.x) - endpoint.x) /
          direction.x
      : 0,
    Math.abs(direction.y) > 1e-5
      ? ((direction.y > 0 ? outer.y + outer.h : outer.y) - endpoint.y) /
          direction.y
      : 0,
  );
  return {
    point: endpoint,
    stub: {
      x: endpoint.x + direction.x * reach,
      y: endpoint.y + direction.y * reach,
    },
  };
}
export function segmentHitsBox(a, b, r) {
  let lo = 0,
    hi = 1;
  const dx = b.x - a.x,
    dy = b.y - a.y;
  for (const [p, q] of [
    [-dx, a.x - r.x],
    [dx, r.x + r.w - a.x],
    [-dy, a.y - r.y],
    [dy, r.y + r.h - a.y],
  ]) {
    if (Math.abs(p) < 1e-9) {
      if (q <= 0) return false;
      continue;
    }
    const t = q / p;
    if (p < 0) lo = Math.max(lo, t);
    else hi = Math.min(hi, t);
    if (lo >= hi) return false;
  }
  return hi > 0 && lo < 1;
}
export function simplifyRoute(points) {
  const out = [];
  for (const p of points) {
    if (out.length && Math.hypot(p.x - out.at(-1).x, p.y - out.at(-1).y) < 1e-6)
      continue;
    while (out.length >= 2) {
      const a = out.at(-2),
        b = out.at(-1),
        ux = b.x - a.x,
        uy = b.y - a.y,
        vx = p.x - b.x,
        vy = p.y - b.y;
      if (
        Math.abs(ux * vy - uy * vx) >
          1e-7 * Math.hypot(ux, uy) * Math.hypot(vx, vy) ||
        ux * vx + uy * vy < 0
      )
        break;
      out.pop();
    }
    out.push(p);
  }
  return out;
}
const simplify = simplifyRoute;
function route(a, b, index) {
  const clearCache = new Map();
  const clear = (p, q) => {
    const key = [p.x, p.y, q.x, q.y].join(",");
    if (clearCache.has(key)) return clearCache.get(key);
    const result = !index
      .query({
        x: Math.min(p.x, q.x),
        y: Math.min(p.y, q.y),
        w: Math.abs(p.x - q.x),
        h: Math.abs(p.y - q.y),
      })
      .some((r) => segmentHitsBox(p, q, r));
    clearCache.set(key, result);
    return result;
  };
  const valid = (ps) => ps.slice(1).every((p, i) => clear(ps[i], p));
  const simple = [
    [a, b],
    [a, { x: b.x, y: a.y }, b],
    [a, { x: a.x, y: b.y }, b],
  ];
  for (const ps of simple) if (valid(ps)) return simplify(ps);
  const near = index.query({
    x: Math.min(a.x, b.x) - 200,
    y: Math.min(a.y, b.y) - 200,
    w: Math.abs(a.x - b.x) + 400,
    h: Math.abs(a.y - b.y) + 400,
  });
  const xs = [a.x, b.x, ...near.flatMap((r) => [r.x - 2, r.x + r.w + 2])],
    ys = [a.y, b.y, ...near.flatMap((r) => [r.y - 2, r.y + r.h + 2])];
  const candidates = [];
  for (const x of xs) candidates.push([a, { x, y: a.y }, { x, y: b.y }, b]);
  for (const y of ys) candidates.push([a, { x: a.x, y }, { x: b.x, y }, b]);
  const length = (ps) =>
    ps
      .slice(1)
      .reduce((sum, p, i) => sum + Math.hypot(p.x - ps[i].x, p.y - ps[i].y), 0);
  for (const ps of candidates.sort((p, q) => length(p) - length(q)))
    if (valid(ps)) return simplify(ps);
  // Visibility grid A*: coordinates follow obstacle boundaries, so no raster
  // approximation can cut through a narrow gap or a label.
  const unique = (values) => [...new Set(values)].sort((x, y) => x - y),
    xx = unique(xs),
    yy = unique(ys);
  const start = xx.indexOf(a.x) + "," + yy.indexOf(a.y),
    goal = xx.indexOf(b.x) + "," + yy.indexOf(b.y),
    open = [],
    cost = new Map([[start, 0]]),
    prior = new Map(),
    done = new Set();
  const point = (k) => {
      const [x, y] = k.split(",").map(Number);
      return { x: xx[x], y: yy[y] };
    },
    heur = (k) => {
      const p = point(k);
      return Math.abs(p.x - b.x) + Math.abs(p.y - b.y);
    };
  const push = (key, score) => {
    let i = open.length;
    open.push({ key, score });
    while (i) {
      const p = (i - 1) >> 1;
      if (open[p].score <= score) break;
      [open[p], open[i]] = [open[i], open[p]];
      i = p;
    }
  };
  const pop = () => {
    const first = open[0],
      last = open.pop();
    if (open.length) {
      open[0] = last;
      let i = 0;
      for (;;) {
        let n = i,
          l = i * 2 + 1,
          r = l + 1;
        if (l < open.length && open[l].score < open[n].score) n = l;
        if (r < open.length && open[r].score < open[n].score) n = r;
        if (n === i) break;
        [open[n], open[i]] = [open[i], open[n]];
        i = n;
      }
    }
    return first.key;
  };
  push(start, heur(start));
  for (let iteration = 0; open.length && iteration < 2500; iteration++) {
    const k = pop();
    if (k === goal) {
      const out = [];
      for (let v = k; v; v = prior.get(v)) out.push(point(v));
      return simplify(out.reverse());
    }
    if (done.has(k)) continue;
    done.add(k);
    const [x, y] = k.split(",").map(Number),
      p = point(k);
    for (const [nx, ny] of [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ]) {
      if (nx < 0 || ny < 0 || nx >= xx.length || ny >= yy.length) continue;
      const nk = `${nx},${ny}`,
        q = { x: xx[nx], y: yy[ny] };
      if (done.has(nk) || !clear(p, q)) continue;
      const next =
        cost.get(k) + Math.abs(q.x - p.x) + Math.abs(q.y - p.y) + 0.1;
      if (next < (cost.get(nk) ?? Infinity)) {
        cost.set(nk, next);
        prior.set(nk, k);
        push(nk, next + heur(nk) * 1.00001);
      }
    }
  }
  // Keep a visible connection for physically impossible/overlapping manual
  // placements; automatic layout normally leaves an obstacle-free corridor.
  return [a, { x: a.x, y: (a.y + b.y) / 2 }, { x: b.x, y: (a.y + b.y) / 2 }, b];
}
function marker(points, kind) {
  if (kind === "none" || points.length < 2) return "";
  const b = points.at(-1),
    a = points.at(-2),
    len = Math.hypot(b.x - a.x, b.y - a.y) || 1,
    ux = (b.x - a.x) / len,
    uy = (b.y - a.y) / len,
    p = (back, side) =>
      `${b.x - back * ux - side * uy} ${b.y - back * uy + side * ux}`;
  if (kind === "inhibition") return `<path d="M${p(0, -6)}L${p(0, 6)}"/>`;
  if (kind === "catalysis")
    return `<circle cx="${b.x - 4 * ux}" cy="${b.y - 4 * uy}" r="4" fill="white"/>`;
  if (kind === "modulation")
    return `<path d="M${p(0, 0)}L${p(5, 5)}L${p(10, 0)}L${p(5, -5)}Z" fill="white"/>`;
  return `<path d="M${p(9, -4)}L${p(0, 0)}L${p(9, 4)}Z" fill="${kind === "activation" ? "white" : "#426884"}"/>`;
}
const signatures = new WeakMap();
const routedPoints = new WeakMap();
const regions = new WeakMap(),
  routeVersions = new WeakMap();
function anchorPort(edge, u = 0.5) {
  const points = routedPoints.get(edge)?.[0];
  if (!points?.length) return { point: center(edge), stub: center(edge) };
  const lengths = points
      .slice(1)
      .map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y)),
    total = lengths.reduce((s, n) => s + n, 0);
  let distance = total * u;
  for (let i = 0; i < lengths.length; i++) {
    if (distance <= lengths[i]) {
      const t = lengths[i] ? distance / lengths[i] : 0,
        p = {
          x: points[i].x + (points[i + 1].x - points[i].x) * t,
          y: points[i].y + (points[i + 1].y - points[i].y) * t,
        };
      return { point: p, stub: p };
    }
    distance -= lengths[i];
  }
  return { point: points.at(-1), stub: points.at(-1) };
}
export function syncPathwayConnections(items) {
  if (!items.some((i) => i.pathwayConnection)) return;
  const byId = new Map(items.map((i) => [i.id, i])),
    nodes = items.filter((i) => isNode(i) && i.visible !== false),
    index = new SpatialIndex(nodes.map((i) => itemBounds(i, 8)));
  const pose = (i) =>
    i
      ? [
          i.id,
          i.x,
          i.y,
          i.w,
          i.h,
          i.rotation,
          i.mirrorX,
          i.mirrorY,
          i.visible,
          routeVersions.get(i) || 0,
        ]
      : [];
  const port = (node, toward) => {
    const clear = (c) =>
      !index
        .query({
          x: Math.min(c.point.x, c.stub.x),
          y: Math.min(c.point.y, c.stub.y),
          w: Math.abs(c.point.x - c.stub.x),
          h: Math.abs(c.point.y - c.stub.y),
        })
        .some((r) => r.id !== node.id && segmentHitsBox(c.point, c.stub, r));
    const preferred = connectionPort(node, toward);
    if (clear(preferred)) return preferred;
    for (const side of [
      "left",
      "right",
      "top",
      ...(node.pathwayGeometry?.h < 0.95 ? [] : ["bottom"]),
    ]) {
      const candidate = connectionPort(node, toward, side);
      if (clear(candidate)) return candidate;
    }
    return preferred;
  };
  const ordered = [],
    seen = new Set(),
    visiting = new Set();
  const visit = (edge) => {
    if (seen.has(edge.id) || visiting.has(edge.id)) return;
    visiting.add(edge.id);
    for (const l of edge.pathwayConnection.links)
      for (const k of ["from", "to"]) {
        const parent = byId.get(l[k]);
        if (parent?.pathwayConnection) visit(parent);
      }
    visiting.delete(edge.id);
    seen.add(edge.id);
    ordered.push(edge);
  };
  items.filter((i) => i.pathwayConnection).forEach(visit);
  for (const edge of ordered) {
    const endpoints = edge.pathwayConnection.links.flatMap((l) => [
      byId.has(l.from) ? center(byId.get(l.from)) : l.a,
      byId.has(l.to) ? center(byId.get(l.to)) : l.b,
    ]);
    const priorRegion = regions.get(edge),
      x1 =
        Math.min(...endpoints.map((p) => p.x), priorRegion?.x ?? Infinity) - 60,
      y1 =
        Math.min(...endpoints.map((p) => p.y), priorRegion?.y ?? Infinity) - 60,
      x2 =
        Math.max(
          ...endpoints.map((p) => p.x),
          priorRegion ? priorRegion.x + priorRegion.w : -Infinity,
        ) + 60,
      y2 =
        Math.max(
          ...endpoints.map((p) => p.y),
          priorRegion ? priorRegion.y + priorRegion.h : -Infinity,
        ) + 60;
    const signature =
      JSON.stringify(
        edge.pathwayConnection.links.map((l) => [
          l.from,
          l.to,
          l.from ? pose(byId.get(l.from)) : l.a,
          l.to ? pose(byId.get(l.to)) : l.b,
          l.start,
          l.end,
          l.fromAnchor,
          l.toAnchor,
        ]),
      ) +
      JSON.stringify(
        index
          .query({ x: x1, y: y1, w: x2 - x1, h: y2 - y1 })
          .sort((a, b) => a.id.localeCompare(b.id)),
      );
    const stamp = signature;
    if (signatures.get(edge) === stamp) {
      const cached = regions.get(edge);
      if (cached)
        Object.assign(edge, cached, {
          rotation: 0,
          mirrorX: false,
          mirrorY: false,
        });
      continue;
    }
    const paths = [];
    let markup = "";
    for (const link of edge.pathwayConnection.links) {
      const from = byId.get(link.from),
        to = byId.get(link.to);
      if ((from && from.visible === false) || (to && to.visible === false))
        continue;
      const a = from
          ? from.pathwayConnection
            ? anchorPort(from, link.fromAnchor)
            : port(from, to ? center(to) : link.b)
          : { point: link.a, stub: link.a },
        b = to
          ? to.pathwayConnection
            ? anchorPort(to, link.toAnchor)
            : port(to, from ? center(from) : link.a)
          : { point: link.b, stub: link.b };
      const points = [a.point, ...route(a.stub, b.stub, index), b.point].filter(
        (p, i, ps) =>
          !i || Math.hypot(p.x - ps[i - 1].x, p.y - ps[i - 1].y) > 1e-5,
      );
      link.a = { ...a.point };
      link.b = { ...b.point };
      paths.push(points);
      markup += `<path data-pathway-connector="true" d="${points.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" ")}"/>${marker(points, link.end)}${marker([...points].reverse(), link.start)}`;
    }
    if (!paths.length) {
      edge.svg =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"></svg>';
      signatures.set(edge, signature);
      routedPoints.delete(edge);
      routeVersions.set(edge, (routeVersions.get(edge) || 0) + 1);
      continue;
    }
    routedPoints.set(edge, paths);
    const ps = paths.flat(),
      x = Math.min(...ps.map((p) => p.x)) - 12,
      y = Math.min(...ps.map((p) => p.y)) - 12,
      w = Math.max(...ps.map((p) => p.x)) - x + 12,
      h = Math.max(...ps.map((p) => p.y)) - y + 12;
    Object.assign(edge, {
      x,
      y,
      w: Math.max(w, 24),
      h: Math.max(h, 24),
      rotation: 0,
      mirrorX: false,
      mirrorY: false,
    });
    const metadata = edge.pathway
      ? `<metadata data-pathway-metadata="true">${E(JSON.stringify(edge.pathway))}</metadata>`
      : "";
    const s = edge.pathway?.source,
      attribution =
        edge.svg?.match(
          /<metadata\b[^>]*data-pathway-attribution="true"[^>]*>[\s\S]*?<\/metadata>/,
        )?.[0] ||
        (s?.database === "Reactome"
          ? `<metadata data-pathway-attribution="true">${E(`Reactome ${s.pathwayId}; https://reactome.org/PathwayBrowser/#/${s.pathwayId}; CC BY 4.0 https://creativecommons.org/licenses/by/4.0/`)}</metadata>`
          : "");
    edge.svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${edge.w} ${edge.h}"><title>${E(edge.name)}</title>${metadata}${attribution}<g transform="translate(${-x} ${-y})" fill="none" stroke="#426884" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">${markup}</g></svg>`;
    regions.set(edge, { x, y, w, h });
    routeVersions.set(edge, (routeVersions.get(edge) || 0) + 1);
    signatures.set(edge, signature);
  }
}
export function validatePathwayConnection(value) {
  const point = (p) =>
    p &&
    Number.isFinite(p.x) &&
    Number.isFinite(p.y) &&
    Math.abs(p.x) <= 100000 &&
    Math.abs(p.y) <= 100000;
  const markers = [
    "none",
    "arrow",
    "activation",
    "inhibition",
    "catalysis",
    "modulation",
  ];
  if (
    !value ||
    value.version !== 1 ||
    !Array.isArray(value.links) ||
    !value.links.length ||
    value.links.length > 1000 ||
    value.links.some(
      (l) =>
        !l ||
        !["from", "to"].every(
          (k) =>
            l[k] === null || (typeof l[k] === "string" && l[k].length <= 256),
        ) ||
        !point(l.a) ||
        !point(l.b) ||
        !markers.includes(l.start) ||
        !markers.includes(l.end) ||
        ["fromAnchor", "toAnchor"].some(
          (k) =>
            l[k] !== undefined &&
            (!Number.isFinite(l[k]) || l[k] < 0 || l[k] > 1),
        ),
    )
  )
    throw Error("Invalid pathway connection.");
}
