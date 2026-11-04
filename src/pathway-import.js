import {
  makePathwayItem,
  pathwayTypeFor,
  importedPathwayLabel,
  pathwayLabelLines,
} from "./pathway-elements.js";
import { commonsId } from "./pathway-search.js";
import {
  biologicalFigureFor,
  biologicalArtwork,
  biologicalOutlines,
} from "./biological-figures.js";
import {
  layoutPathway,
  makeConnection,
  markerFor,
  syncPathwayConnections,
  remapPathwayLinks,
} from "./pathway-layout.js";
export const MAX_PATHWAY_ITEMS = 4000;
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
const finite = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || Math.abs(n) > 100000)
    throw Error("Ongeldige pathwaycoördinaten.");
  return n;
};
const array = (value) =>
  value == null ? [] : Array.isArray(value) ? value : [value];
const xmlChildren = (el, name) =>
  [...el.children].filter((x) => x.localName === name);
const child = (el, name) => xmlChildren(el, name)[0];
const attr = (el, name, fallback = "") => el?.getAttribute(name) ?? fallback;
const txt = (value) => String(value ?? "").slice(0, 512);
let serial = 0;
function source(row, elementId) {
  return {
    database: row.source,
    elementId: String(elementId).slice(0, 256),
    pathwayId: row.id.slice(0, 256),
    version: String(row.revision || "").slice(0, 256),
  };
}
function node(type, label, rect, row, key, options = {}) {
  label = txt(label);
  const figure = options.members?.length
    ? null
    : biologicalFigureFor(label, type);
  if (figure) type = `bio-${figure.id}`;
  const labelWidth = Math.min(
    220,
    Math.max(70, String(label || "").length * 7.4 + 20),
  );
  const w = Math.max(
      options.hideLabel
        ? 10
        : figure?.family === "cell"
          ? Math.max(128, labelWidth)
          : figure
            ? Math.max(88, Math.min(136, labelWidth))
            : type === "compartment"
              ? 10
              : labelWidth,
      finite(rect.w),
    ),
    h = Math.max(
      options.hideLabel
        ? 10
        : figure?.family === "cell"
          ? 138
          : figure
            ? 94
            : type === "compartment"
              ? 10
              : 44,
      type === "compartment" || options.hideLabel
        ? 10
        : (figure ? (figure.family === "cell" ? 106 : 62) : 12) +
            Math.max(
              32,
              pathwayLabelLines(
                label,
                Math.max(4, Math.floor((w - 8) / (14 * 0.55))),
              ).length *
                16.1 +
                8,
            ),
      finite(rect.h),
    );
  const item = makePathwayItem(type, `pathway-${++serial}`, {
    label: txt(label),
    source: source(row, key),
    identifiers: (options.identifiers || []).slice(0, 30),
    members: (options.members || []).slice(0, 100),
  });
  if (!item.name.trim())
    item.name =
      type === "compartment" ? "Group" : type === "complex" ? "Complex" : type;
  Object.assign(item, {
    x: finite(rect.x) + (finite(rect.w) - w) / 2,
    y: finite(rect.y) + (finite(rect.h) - h) / 2,
    w,
    h,
    pathwaySourceBounds: {
      x: finite(rect.x),
      y: finite(rect.y),
      w: finite(rect.w),
      h: finite(rect.h),
    },
    pathwayLabelLayout: {
      w,
      h,
      fontSize: 14,
      top: item.pathway.role === "compartment",
    },
  });
  const c = item.pathway.role === "compartment",
    annotation = item.pathway.role === "annotation";
  const fill = c
    ? "#f0f5fa"
    : options.fill ||
      (["metabolite", "drug", "ion"].includes(type)
        ? "#fff1d6"
        : type === "complex"
          ? "#d8e8f3"
          : "#edf5fb");
  const labelHeight = figure
    ? Math.max(
        32,
        pathwayLabelLines(label, Math.max(4, Math.floor((w - 8) / (14 * 0.55))))
          .length *
          16.1 +
          8,
      )
    : 0;
  const artHeight = h - labelHeight;
  let artViewBox =
    figure?.family === "cell"
      ? figure.asset
        ? [50, 0, 140, 112]
        : [0, 0, 240, 112]
      : [45, 0, 150, 112];
  if (figure) {
    const outline = biologicalOutlines(figure).flat(),
      pad =
        figure.family.includes("receptor") ||
        figure.family === "membrane-protein"
          ? 12
          : 4;
    if (outline.length) {
      const xs = outline.map((p) => p[0]),
        ys = outline.map((p) => p[1]),
        x = Math.min(...xs) - pad,
        y = Math.min(...ys) - pad;
      artViewBox = [x, y, Math.max(...xs) - x + pad, Math.max(...ys) - y + pad];
    }
  }
  const shape = figure
    ? `<svg x="${(w - Math.min(w, artHeight * 1.25)) / 2}" width="${Math.min(w, artHeight * 1.25)}" height="${artHeight}" viewBox="${artViewBox.join(" ")}">${biologicalArtwork(figure)}</svg>`
    : annotation
      ? ""
      : ["metabolite", "drug", "ion"].includes(type) || options.ellipse
        ? `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2 - 1}" ry="${h / 2 - 1}" fill="${fill}" stroke="#426884"/>`
        : `<rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="${c ? 10 : 4}" fill="${fill}" fill-opacity="${c ? 0.35 : 1}" stroke="#426884" ${c ? 'stroke-dasharray="5 3"' : ""}/>`;
  item.svg = svg(
    item,
    shape +
      (options.hideLabel
        ? ""
        : figure
          ? `<g transform="translate(0 ${artHeight})">${importedPathwayLabel(item.pathway, { w, h: labelHeight, fontSize: 14 })}</g>`
          : importedPathwayLabel(item.pathway, item.pathwayLabelLayout)),
  );
  if (figure) {
    item.pathwayLabelLayout = {
      w,
      h: labelHeight,
      fontSize: 14,
      offsetY: artHeight,
    };
    item.pathwayIllustration = { id: figure.id, family: figure.family };
    const aw = Math.min(w, artHeight * 1.25) * 0.86;
    item.pathwayGeometry = {
      shape: figure.family === "cell" ? "ellipse" : "rect",
      x: (w - aw) / 2 / w,
      y: 0,
      w: aw / w,
      h: (artHeight / h) * 0.96,
    };
    const outerWidth = Math.min(w, artHeight * 1.25),
      vb = artViewBox,
      s = Math.min(outerWidth / vb[2], artHeight / vb[3]),
      ox = (w - outerWidth) / 2 + (outerWidth - vb[2] * s) / 2,
      oy = (artHeight - vb[3] * s) / 2;
    item.pathwayGeometry.outlines = biologicalOutlines(figure).map((path) =>
      path.map((p) => [
        (ox + (p[0] - vb[0]) * s) / w,
        (oy + (p[1] - vb[1]) * s) / h,
      ]),
    );
    const points = item.pathwayGeometry.outlines.flat();
    if (points.length) {
      const xs = points.map((p) => p[0]),
        ys = points.map((p) => p[1]);
      Object.assign(item.pathwayGeometry, {
        x: Math.min(...xs),
        y: Math.min(...ys),
        w: Math.max(...xs) - Math.min(...xs),
        h: Math.max(...ys) - Math.min(...ys),
      });
    }
  }
  return item;
}
function svg(item, content) {
  const s = item.pathway.source,
    attribution =
      s.database === "Reactome"
        ? `Reactome ${s.pathwayId}; https://reactome.org/PathwayBrowser/#/${s.pathwayId}; CC BY 4.0 https://creativecommons.org/licenses/by/4.0/`
        : s.database === "WikiPathways"
          ? `WikiPathways ${s.pathwayId}; https://www.wikipathways.org/pathways/${s.pathwayId}; CC0`
          : `${s.database}; pathway ${s.pathwayId}; source element ${s.elementId}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${item.w} ${item.h}"><title>${E(item.name)}</title><metadata data-pathway-attribution="true">${E(attribution)}</metadata><metadata data-pathway-metadata="true">${E(JSON.stringify(item.pathway))}</metadata>${content}</svg>`;
}
function edge(
  points,
  row,
  key,
  label = "",
  type = "interaction",
  extra = "",
  boundsPoints = [],
) {
  if (points.length < 2) return null;
  const all = [...points, ...boundsPoints],
    xs = all.map((p) => finite(p.x)),
    ys = all.map((p) => finite(p.y));
  const x = Math.min(...xs) - 9,
    y = Math.min(...ys) - 9,
    w = Math.max(...xs) - x + 9,
    h = Math.max(...ys) - y + 9;
  const item = makePathwayItem(type, `pathway-${++serial}`, {
    label: txt(label),
    source: source(row, key),
  });
  Object.assign(item, { x, y, w, h });
  const path = points.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" ");
  item.svg = svg(
    item,
    `<g transform="translate(${-x} ${-y})" fill="none" stroke="#426884" stroke-width="1.5"><path d="${path}"/>${extra}</g>`,
  );
  return item;
}
function clippedConnection(a, b) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    len = Math.hypot(dx, dy) || 1,
    ux = dx / len,
    uy = dy / len;
  const distance = (p) =>
    Math.min(
      (p.w || 0) / 2 / Math.max(Math.abs(ux), 1e-9),
      (p.h || 0) / 2 / Math.max(Math.abs(uy), 1e-9),
    );
  return [
    { x: a.x + ux * distance(a), y: a.y + uy * distance(a) },
    { x: b.x - ux * distance(b), y: b.y - uy * distance(b) },
  ];
}
function sourceShape(s) {
  if (!s) return "";
  const p = (v) => `${finite(v.x)},${finite(v.y)}`;
  if (s.a && s.b && s.c)
    return `<path d="M ${p(s.a)} L ${p(s.b)} L ${p(s.c)}${s.empty ? "" : " Z"}" fill="${s.empty ? "none" : "#426884"}"/>`;
  if (s.c && s.r)
    return `<circle cx="${finite(s.c.x)}" cy="${finite(s.c.y)}" r="${Math.max(1, finite(s.r))}" fill="white"/>`;
  if (s.a && s.b)
    return `<rect x="${Math.min(finite(s.a.x), finite(s.b.x))}" y="${Math.min(finite(s.a.y), finite(s.b.y))}" width="${Math.max(2, Math.abs(s.a.x - s.b.x))}" height="${Math.max(2, Math.abs(s.a.y - s.b.y))}" fill="white"/>`;
  return "";
}
function finish(items, row, layout, warnings = []) {
  items = items.filter(Boolean);
  if (!items.length)
    throw Error("Dit pathway bevat geen importeerbare elementen.");
  if (items.length > MAX_PATHWAY_ITEMS)
    throw Error("Dit pathway is te groot. Kies een specifieker deelpathway.");
  resolveConnectionReferences(items);
  layoutPathway(items);
  for (const item of items) item.pathwayLayoutVersion = 1;
  syncPathwayConnections(items);
  const minX = Math.min(...items.map((i) => i.x)),
    minY = Math.min(...items.map((i) => i.y));
  for (const item of items) {
    item.x += 50 - minX;
    item.y += 80 - minY;
  }
  remapPathwayLinks(items, new Map(), 50 - minX, 80 - minY);
  const width = Math.max(600, ...items.map((i) => i.x + i.w + 50)),
    height = Math.max(400, ...items.map((i) => i.y + i.h + 50));
  // Preserve source scale until the sheet's validated size limit is reached.
  const scale = Math.min(1, 9800 / width, 9800 / height);
  for (const item of items) {
    item.x *= scale;
    item.y *= scale;
    item.w *= scale;
    item.h *= scale;
  }
  if (scale !== 1)
    for (const i of items)
      for (const l of i.pathwayConnection?.links || [])
        for (const k of ["a", "b"]) {
          l[k].x *= scale;
          l[k].y *= scale;
        }
  syncPathwayConnections(items);
  return {
    items,
    width: Math.ceil(width * scale),
    height: Math.ceil(height * scale),
    source: { ...row },
    layout: layout === "source" ? "readable-source" : layout,
    warnings,
  };
}
function resolveConnectionReferences(items) {
  const known = new Set(items.map((i) => i.id));
  const refs = new Map(
    items
      .filter((i) => i.pathway?.role !== "edge")
      .map((i) => [i.pathwayGraphId || i.pathway?.source.elementId, i.id]),
  );
  const nodes = items.filter(
    (i) => i.pathway?.role !== "edge" && !i.pathwayConnection,
  );
  const nearest = (p) =>
    nodes
      .map((n) => {
        const b = n.pathwaySourceBounds || n,
          dx = Math.max(b.x - p.x, 0, p.x - b.x - b.w),
          dy = Math.max(b.y - p.y, 0, p.y - b.y - b.h);
        return {
          n,
          d: Math.hypot(dx, dy),
          c: Math.hypot(p.x - b.x - b.w / 2, p.y - b.y - b.h / 2),
        };
      })
      .filter((o) => o.d < 20)
      .sort((a, b) => a.d - b.d || a.c - b.c)[0]?.n.id || null;
  for (const i of items)
    if (i.pathwayConnectionRefs) {
      for (const l of i.pathwayConnection.links) {
        l.from = known.has(l.from) ? l.from : refs.get(l.from) || nearest(l.a);
        l.to = known.has(l.to) ? l.to : refs.get(l.to) || nearest(l.b);
      }
      delete i.pathwayConnectionRefs;
    }
  for (const group of items.filter(
    (i) => i.pathway?.role === "compartment" && !i.pathwayMemberIds,
  )) {
    const b = group.pathwaySourceBounds || group;
    group.pathwayMemberIds = nodes
      .filter((n) => n !== group && n.pathway?.role !== "compartment")
      .filter((n) => {
        const r = n.pathwaySourceBounds || n;
        return (
          r.x + r.w / 2 > b.x &&
          r.x + r.w / 2 < b.x + b.w &&
          r.y + r.h / 2 > b.y &&
          r.y + r.h / 2 < b.y + b.h
        );
      })
      .map((n) => n.id);
  }
}
export function importReactomeDiagram(data, row) {
  if (!Array.isArray(data.nodes) || !Array.isArray(data.edges))
    throw Error("Geen Reactome-diagram beschikbaar voor dit pathway.");
  const items = [];
  const rect = (n) => ({
    x: n.prop?.x ?? n.minX,
    y: n.prop?.y ?? n.minY,
    w: n.prop?.width ?? n.maxX - n.minX,
    h: n.prop?.height ?? n.maxY - n.minY,
  });
  for (const n of [...(data.compartments || [])].sort(
    (a, b) => b.prop.width * b.prop.height - a.prop.width * a.prop.height,
  ))
    items.push(
      node("compartment", n.displayName, rect(n), row, n.reactomeId || n.id),
    );
  const nodes = data.nodes || [];
  const reactomeNodes = new Map();
  for (const n of nodes) {
    const item = node(
      pathwayTypeFor("Reactome", n.renderableClass),
      n.displayName,
      rect(n),
      row,
      n.reactomeId || n.id,
    );
    reactomeNodes.set(String(n.id), item);
  }
  for (const e of [...data.edges, ...(data.links || [])]) {
    const connectors = nodes.flatMap((n) =>
      (n.connectors || []).filter((c) => c.edgeId === e.id),
    );
    const segments = [
      ...(e.segments || []),
      ...connectors.flatMap((c) => c.segments || []),
    ];
    const points = segments.flatMap((s) => [s.from, s.to]);
    const shapes = [
      e.endShape,
      e.reactionShape,
      ...connectors.map((c) => c.endShape),
    ].filter(Boolean);
    const shapePoints = shapes.flatMap((s) =>
      [s.a, s.b, s.c, s.centre].filter(Boolean),
    );
    if (points.length < 2) continue;
    const item = edge(
      points,
      row,
      e.reactomeId || e.id,
      e.displayName || "Reaction",
      "reaction",
      "",
      shapePoints,
    );
    const p = e.position ||
      e.reactionShape?.centre || {
        x: (points[0].x + points.at(-1).x) / 2,
        y: (points[0].y + points.at(-1).y) / 2,
      };
    const hub = makePathwayItem("reaction", `pathway-${++serial}`, {
      label: txt(e.displayName || "Reaction"),
      source: source(row, e.reactomeId || e.id),
    });
    Object.assign(hub, {
      x: finite(p.x) - 8,
      y: finite(p.y) - 8,
      w: 16,
      h: 16,
      name: `Reaction: ${e.displayName || "Reaction"}`,
      pathwayReaction: true,
    });
    hub.pathwaySourceBounds = { x: hub.x, y: hub.y, w: 16, h: 16 };
    hub.svg = svg(
      hub,
      `<${e.reactionType === "binding" ? 'circle cx="8" cy="8" r="5"' : 'rect x="3" y="3" width="10" height="10"'} fill="white" stroke="#426884" stroke-width="1.8"/>`,
    );
    const participants = new Map();
    for (const [key, kind] of [
      ["inputs", "INPUT"],
      ["outputs", "OUTPUT"],
      ["catalysts", "CATALYST"],
      ["inhibitors", "INHIBITOR"],
      ["activators", "ACTIVATOR"],
    ])
      for (const n of e[key] || []) participants.set(String(n.id), kind);
    for (const n of nodes)
      for (const c of n.connectors || [])
        if (c.edgeId === e.id) participants.set(String(n.id), c.type);
    // Some source diagrams omit explicit participant lists; geometrically
    // touching source segments still provide a declared visual connection.
    if (!e.inputs && !e.outputs)
      for (const n of nodes) {
        if (participants.has(String(n.id))) continue;
        const b = rect(n);
        if (
          points.some(
            (q) =>
              Math.hypot(
                Math.max(b.x - q.x, 0, q.x - b.x - b.w),
                Math.max(b.y - q.y, 0, q.y - b.y - b.h),
              ) < 3,
          )
        )
          participants.set(String(n.id), "OUTPUT");
      }
    const links = [];
    for (const [id, kind] of participants) {
      const target = reactomeNodes.get(id);
      if (!target) continue;
      const a = { x: target.x + target.w / 2, y: target.y + target.h / 2 };
      links.push(
        kind === "OUTPUT"
          ? {
              from: hub.id,
              to: target.id,
              a: { ...p },
              b: a,
              start: "none",
              end: "arrow",
            }
          : {
              from: target.id,
              to: hub.id,
              a,
              b: { ...p },
              start: "none",
              end:
                kind === "CATALYST"
                  ? "catalysis"
                  : kind === "INHIBITOR"
                    ? "inhibition"
                    : kind === "ACTIVATOR"
                      ? "activation"
                      : "none",
            },
      );
    }
    if (links.length) {
      item.pathwayConnection = { version: 1, links };
      items.push(item, hub);
    } else {
      makeConnection(
        item,
        null,
        null,
        points[0],
        points.at(-1),
        "none",
        e.endShape ? "arrow" : "none",
      );
      item.pathwayConnectionRefs = true;
      items.push(item);
    }
  }
  items.push(...reactomeNodes.values());
  for (const n of data.notes || [])
    if (n.prop)
      items.push(
        node("annotation", n.text || n.displayName || "", rect(n), row, n.id),
      );
  return finish(items, row, "source", [
    "Bronindeling als uitgangspunt; leesbare figuren en labels met gekoppelde reactiepijlen.",
  ]);
}
function arrow(points, kind) {
  if (!kind || kind === "Line" || points.length < 2) return "";
  const b = points.at(-1),
    a = points.at(-2),
    dx = b.x - a.x,
    dy = b.y - a.y,
    len = Math.hypot(dx, dy) || 1,
    ux = dx / len,
    uy = dy / len;
  const p = (back, side) =>
    `${b.x - back * ux - side * uy} ${b.y - back * uy + side * ux}`;
  if (/catalysis/i.test(kind))
    return `<circle cx="${b.x - 3 * ux}" cy="${b.y - 3 * uy}" r="3" fill="white"/>`;
  if (/binding/i.test(kind)) return "";
  return /tbar|inhibition/i.test(kind)
    ? `<path d="M ${p(0, -5)} L ${p(0, 5)}"/>`
    : `<path d="M ${p(8, -4)} L ${p(0, 0)} L ${p(8, 4)}" fill="${/stimulation|catalysis/i.test(kind) ? "white" : "#426884"}"/>`;
}
export function importGPML(text, row, Parser = globalThis.DOMParser) {
  if (/<!ENTITY/i.test(text)) throw Error("Ongeldig pathwaybestand.");
  const doc = new Parser().parseFromString(text, "application/xml");
  if (
    doc.querySelector("parsererror") ||
    doc.documentElement.localName !== "Pathway"
  )
    throw Error("Ongeldig GPML-bestand.");
  const root = doc.documentElement,
    items = [];
  const box = (el) => {
    const g = child(el, "Graphics"),
      w = finite(attr(g, "Width", 100)),
      h = finite(attr(g, "Height", 30));
    return {
      x: finite(attr(g, "CenterX")) - w / 2,
      y: finite(attr(g, "CenterY")) - h / 2,
      w,
      h,
    };
  };
  for (const el of [
    ...xmlChildren(root, "Shape"),
    ...xmlChildren(root, "Label"),
    ...xmlChildren(root, "DataNode"),
  ]) {
    const kind = el.localName,
      ref = child(el, "Xref"),
      g = child(el, "Graphics");
    const type =
      kind === "DataNode"
        ? pathwayTypeFor("WikiPathways", attr(el, "Type"))
        : kind === "Label"
          ? "annotation"
          : "compartment";
    const item = node(
      type,
      attr(el, "TextLabel"),
      box(el),
      row,
      attr(el, "GraphId"),
      {
        identifiers:
          ref && attr(ref, "ID")
            ? [
                {
                  database: attr(ref, "Database").slice(0, 80),
                  id: attr(ref, "ID").slice(0, 256),
                },
              ]
            : [],
        ellipse: /oval|ellipse/i.test(attr(g, "ShapeType")),
      },
    );
    item.pathwayGroup = attr(el, "GroupRef");
    items.push(item);
  }
  const edges = [];
  for (const el of [
    ...xmlChildren(root, "Interaction"),
    ...xmlChildren(root, "GraphicalLine"),
  ]) {
    const g = child(el, "Graphics"),
      ps = xmlChildren(g || el, "Point");
    const points = ps.map((p) => ({
      x: finite(attr(p, "X")),
      y: finite(attr(p, "Y")),
    }));
    const type = pathwayTypeFor(
      "WikiPathways",
      attr(ps.at(-1), "ArrowHead", "Line"),
    );
    const item = edge(
      points,
      row,
      attr(el, "GraphId"),
      "Interaction",
      type === "unknown" ? "interaction" : type,
      arrow(points, attr(ps.at(-1), "ArrowHead")) +
        arrow([...points].reverse(), attr(ps[0], "ArrowHead")),
    );
    if (item) {
      makeConnection(
        item,
        attr(ps[0], "GraphRef"),
        attr(ps.at(-1), "GraphRef"),
        points[0],
        points.at(-1),
        markerFor(attr(ps[0], "ArrowHead")),
        markerFor(attr(ps.at(-1), "ArrowHead")),
      );
      item.pathwayConnectionRefs = true;
      edges.push(item);
    }
  }
  const compartments = items.filter((i) => i.pathway.role === "compartment"),
    others = items.filter((i) => i.pathway.role !== "compartment");
  for (const group of xmlChildren(root, "Group")) {
    const key = attr(group, "GroupId"),
      members = others.filter((i) => i.pathwayGroup === key);
    if (!members.length) continue;
    const x = Math.min(...members.map((i) => i.x)) - 8,
      y = Math.min(...members.map((i) => i.y)) - 8;
    const container = node(
      /complex/i.test(attr(group, "Style")) ? "complex" : "compartment",
      attr(group, "TextLabel"),
      {
        x,
        y,
        w: Math.max(...members.map((i) => i.x + i.w)) - x + 8,
        h: Math.max(...members.map((i) => i.y + i.h)) - y + 8,
      },
      row,
      attr(group, "GraphId", key),
      { members: members.map((i) => i.name).filter(Boolean) },
    );
    container.pathwayMemberIds = members.map((i) => i.id);
    compartments.push(container);
  }
  const anchorRefs = new Map();
  for (const el of [
    ...xmlChildren(root, "Interaction"),
    ...xmlChildren(root, "GraphicalLine"),
  ]) {
    const parent = edges.find(
      (e) => e.pathway.source.elementId === attr(el, "GraphId"),
    );
    if (parent)
      for (const anchor of xmlChildren(child(el, "Graphics") || el, "Anchor"))
        anchorRefs.set(attr(anchor, "GraphId"), {
          id: parent.id,
          u: Math.max(
            0,
            Math.min(1, Number(attr(anchor, "Position", ".5")) || 0),
          ),
        });
  }
  for (const edge of edges)
    for (const link of edge.pathwayConnection.links)
      for (const key of ["from", "to"]) {
        const ref = anchorRefs.get(link[key]);
        if (ref) {
          link[key] = ref.id;
          link[`${key}Anchor`] = ref.u;
        }
      }
  return finish([...compartments, ...edges, ...others], row, "source", [
    "GPML-indeling als uitgangspunt; labels en figuren gescheiden en pijlen gekoppeld.",
  ]);
}
export function importKGML(text, Parser = globalThis.DOMParser) {
  if (/<!ENTITY/i.test(text)) throw Error("Ongeldig pathwaybestand.");
  const doc = new Parser().parseFromString(text, "application/xml"),
    root = doc.documentElement;
  if (doc.querySelector("parsererror") || root.localName !== "pathway")
    throw Error("Ongeldig KGML-bestand.");
  const row = {
    source: "KEGG",
    id: attr(root, "name").replace(/^path:/, ""),
    name: attr(root, "title", "KEGG pathway"),
    url: "https://www.kegg.jp/kegg/pathway.html",
  };
  if (/^[a-z]{2,4}\d{5}$/.test(row.id))
    row.url = `https://www.kegg.jp/pathway/${row.id}`;
  const items = [],
    positions = new Map(),
    relations = [];
  for (const el of xmlChildren(root, "entry")) {
    const g = child(el, "graphics");
    if (!g) continue;
    const w = Math.max(12, finite(attr(g, "width", 70))),
      h = Math.max(12, finite(attr(g, "height", 25))),
      x = finite(attr(g, "x")) - w / 2,
      y = finite(attr(g, "y")) - h / 2,
      key = attr(el, "id");
    const t =
      {
        gene: "protein",
        ortholog: "protein",
        enzyme: "enzyme",
        compound: "metabolite",
        map: "subpathway",
        group: "complex",
      }[attr(el, "type")] || "unknown";
    const item = node(
      t,
      attr(g, "name", attr(el, "name")),
      { x, y, w, h },
      row,
      key,
      {
        identifiers: attr(el, "name")
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 30)
          .map((id) => ({ database: "KEGG", id: id.slice(0, 256) })),
        ellipse: attr(g, "type") === "circle",
      },
    );
    item.pathway.members = xmlChildren(el, "component")
      .map((c) => attr(c, "id"))
      .slice(0, 100);
    item.svg = item.svg.replace(
      /<metadata data-pathway-metadata="true">[\s\S]*?<\/metadata>/,
      () =>
        `<metadata data-pathway-metadata="true">${E(JSON.stringify(item.pathway))}</metadata>`,
    );
    items.push(item);
    positions.set(key, { x: x + w / 2, y: y + h / 2, w, h });
  }
  const link = (a, b, type, key) => {
    if (positions.has(a) && positions.has(b)) {
      const points = clippedConnection(positions.get(a), positions.get(b));
      const connection = edge(
        points,
        row,
        key,
        "",
        type,
        arrow(points, type === "inhibition" ? "TBar" : "Arrow"),
      );
      makeConnection(
        connection,
        a,
        b,
        points[0],
        points.at(-1),
        "none",
        type === "inhibition" ? "inhibition" : "arrow",
      );
      connection.pathwayConnectionRefs = true;
      relations.push(connection);
    }
  };
  for (const el of xmlChildren(root, "relation")) {
    const subtypes = xmlChildren(el, "subtype").map((s) => attr(s, "name")),
      type = subtypes.some((s) => /inhibition|repression/.test(s))
        ? "inhibition"
        : subtypes.includes("activation")
          ? "activation"
          : "interaction";
    link(
      attr(el, "entry1"),
      attr(el, "entry2"),
      type,
      `${attr(el, "entry1")}-${attr(el, "entry2")}`,
    );
  }
  for (const el of xmlChildren(root, "reaction"))
    for (const a of xmlChildren(el, "substrate"))
      for (const b of xmlChildren(el, "product")) {
        link(attr(a, "id"), attr(b, "id"), "conversion", attr(el, "name"));
        if (attr(el, "type") === "reversible")
          link(attr(b, "id"), attr(a, "id"), "conversion", attr(el, "name"));
      }
  return finish([...relations, ...items], row, "source", [
    "KGML bevat niet alle decoraties van de KEGG-bronfiguur.",
  ]);
}
export function importPathwayFile(text, name, Parser = globalThis.DOMParser) {
  if (/<!ENTITY/i.test(text)) throw Error("Ongeldig pathwaybestand.");
  if (text.length > 12000000)
    throw Error("Dit pathway is te groot. Kies een specifieker deelpathway.");
  if (/^\s*\{/.test(text)) {
    const data = JSON.parse(text);
    if (data.stableId)
      return importReactomeDiagram(data, {
        source: "Reactome",
        id: data.stableId,
        name: data.displayName || name,
      });
    throw Error("Gebruik een Reactome-diagram-JSON, GPML of KGML.");
  }
  const doc = new Parser().parseFromString(text, "application/xml");
  if (doc.documentElement.localName === "pathway")
    return importKGML(text, Parser);
  const root = doc.documentElement,
    id = attr(root, "Version", name).split("_")[0];
  return importGPML(
    text,
    { source: "WikiPathways", id, name: attr(root, "Name", name) },
    Parser,
  );
}
export function importBioPAX(data, row) {
  const graph = data["@graph"];
  if (!Array.isArray(graph)) throw Error("Ongeldige Pathway Commons-data.");
  const map = new Map(graph.map((e) => [e["@id"], e])),
    type = (e) => String(e?.["@type"] || "").replace("bp:", "");
  const physical = new Set([
    "Protein",
    "SmallMolecule",
    "Complex",
    "Dna",
    "Rna",
    "PhysicalEntity",
    "DnaRegion",
    "RnaRegion",
  ]);
  const processes = graph.filter(
    (e) =>
      /Reaction|Assembly|Transport|Degradation|Interaction/.test(type(e)) &&
      !/Reference|Vocabulary/.test(type(e)),
  );
  const used = new Set(
    processes.flatMap((e) => [
      ...array(e.left),
      ...array(e.right),
      ...array(e.participant),
      ...array(e.template),
      ...array(e.product),
    ]),
  );
  const controls = graph.filter((e) =>
    [
      "Catalysis",
      "Control",
      "Modulation",
      "TemplateReactionRegulation",
    ].includes(type(e)),
  );
  controls.forEach((e) => array(e.controller).forEach((id) => used.add(id)));
  const entities = [...used]
    .map((id) => map.get(id))
    .filter((e) => physical.has(type(e)));
  const layoutNodes = [...entities, ...processes];
  if (layoutNodes.length > 1600)
    throw Error("Dit pathway is te groot. Kies een specifieker deelpathway.");
  const columns = Math.max(3, Math.ceil(Math.sqrt(layoutNodes.length) * 1.5)),
    positions = new Map();
  const items = layoutNodes.map((e, i) => {
    const isProcess = !physical.has(type(e)),
      reference = map.get(e.entityReference);
    const label =
      e.displayName || e.standardName || array(e.name)[0] || type(e);
    const w = isProcess ? 28 : 145,
      h = isProcess ? 28 : 48,
      x = 80 + (i % columns) * 195,
      y = 80 + Math.floor(i / columns) * 100;
    const t = isProcess
      ? "reaction"
      : {
          Protein: "protein",
          SmallMolecule: "metabolite",
          Complex: "complex",
          Dna: "dna",
          Rna: "rna",
          DnaRegion: "gene",
          RnaRegion: "rna",
        }[type(e)] || "unknown";
    const refs = [...array(e.xref), ...array(reference?.xref)]
      .map((id) => map.get(id))
      .filter((x) => x?.db && x?.id)
      .map((x) => ({
        database: txt(x.db).slice(0, 80),
        id: txt(x.id).slice(0, 256),
      }));
    const item = node(t, label, { x, y, w, h }, row, e["@id"], {
      identifiers: refs,
      hideLabel: isProcess,
    });
    item.name = txt(label);
    item.pathway.label = txt(label);
    positions.set(e["@id"], { x: x + w / 2, y: y + h / 2, w, h });
    return item;
  });
  const edges = [];
  const connect = (a, b, kind, key) => {
    if (positions.has(a) && positions.has(b)) {
      const ps = clippedConnection(positions.get(a), positions.get(b));
      const connection = edge(
        ps,
        row,
        key,
        "",
        kind,
        arrow(
          ps,
          kind === "inhibition"
            ? "TBar"
            : kind === "interaction"
              ? "Line"
              : kind === "catalysis"
                ? "mim-catalysis"
                : "Arrow",
        ),
      );
      makeConnection(
        connection,
        a,
        b,
        ps[0],
        ps.at(-1),
        "none",
        kind === "interaction"
          ? "none"
          : kind === "conversion"
            ? "arrow"
            : markerFor(kind),
      );
      connection.pathwayConnectionRefs = true;
      edges.push(connection);
    }
  };
  for (const e of processes) {
    const id = e["@id"],
      reverse = e.conversionDirection === "RIGHT_TO_LEFT";
    for (const ref of array(e.left))
      connect(reverse ? id : ref, reverse ? ref : id, "interaction", id);
    for (const ref of array(e.right))
      connect(reverse ? ref : id, reverse ? id : ref, "conversion", id);
    for (const ref of array(e.participant)) connect(ref, id, "interaction", id);
    for (const ref of array(e.template)) connect(ref, id, "interaction", id);
    for (const ref of array(e.product)) connect(id, ref, "conversion", id);
  }
  for (const e of controls)
    for (const a of array(e.controller))
      for (const b of array(e.controlled))
        connect(
          a,
          b,
          /INHIBITION/.test(e.controlType)
            ? "inhibition"
            : type(e) === "Catalysis"
              ? "catalysis"
              : /ACTIVATION/.test(e.controlType)
                ? "activation"
                : "modulation",
          e["@id"],
        );
  return finish([...edges, ...items], row, "automatic", [
    "Automatische indeling uit BioPAX; dit is geen oorspronkelijke bronfiguur.",
  ]);
}
export function improvePathwayDrawing(
  originals,
  Parser = globalThis.DOMParser,
) {
  const items = structuredClone(originals),
    alreadyReadable = items.every((i) => i.pathwayLayoutVersion === 1);
  for (const item of items)
    item.pathwaySourceBounds = { x: item.x, y: item.y, w: item.w, h: item.h };
  for (const item of items) {
    // Old imported arrows have no endpoint IDs. Recover only the connections
    // visible in their original vector geometry, before changing any sizes.
    if (
      !item.pathwayConnection &&
      !item.pathwayReaction &&
      (item.pathway.role === "edge" || item.pathway.type === "reaction") &&
      Parser
    ) {
      const root = new Parser().parseFromString(
        item.svg,
        "image/svg+xml",
      ).documentElement;
      const vb = (root.getAttribute("viewBox") || `0 0 ${item.w} ${item.h}`)
          .split(/[ ,]+/)
          .map(Number),
        paths = [...root.querySelectorAll("path")].filter(
          (p) =>
            !/[zZCQcq]/.test(p.getAttribute("d") || "") &&
            (!p.getAttribute("fill") || p.getAttribute("fill") === "none"),
        );
      const point = (p, element) => {
        for (
          let el = element.parentElement;
          el && el !== root;
          el = el.parentElement
        ) {
          const t = el
            .getAttribute("transform")
            ?.match(/^translate\(\s*([\d.eE+-]+)[ ,]+([\d.eE+-]+)\s*\)$/);
          if (t) {
            p.x += Number(t[1]);
            p.y += Number(t[2]);
          }
        }
        const x = ((p.x - vb[0]) * item.w) / vb[2] - item.w / 2,
          y = ((p.y - vb[1]) * item.h) / vb[3] - item.h / 2,
          a = ((item.rotation || 0) * Math.PI) / 180;
        return {
          x: item.x + item.w / 2 + x * Math.cos(a) - y * Math.sin(a),
          y: item.y + item.h / 2 + x * Math.sin(a) + y * Math.cos(a),
        };
      };
      const links = [];
      for (const path of paths) {
        const nums = (
          path
            .getAttribute("d")
            .match(/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g) || []
        ).map(Number);
        if (nums.length < 4 || nums.length % 2) continue;
        const first = point({ x: nums[0], y: nums[1] }, path),
          last = point({ x: nums.at(-2), y: nums.at(-1) }, path);
        if (Math.hypot(last.x - first.x, last.y - first.y) < 16) continue;
        links.push({
          from: null,
          to: null,
          a: first,
          b: last,
          start: "none",
          end: markerFor(item.pathway.type),
        });
      }
      if (links.length) {
        item.pathwayConnection = { version: 1, links };
        item.pathwayConnectionRefs = true;
      }
    }
  }
  resolveConnectionReferences(items);
  for (const edge of items.filter((i) => i.pathwayConnection))
    for (const link of edge.pathwayConnection.links)
      for (const key of ["from", "to"]) {
        if (link[key]) continue;
        const p = link[key === "from" ? "a" : "b"],
          candidates = [];
        for (const other of items.filter(
          (i) => i !== edge && i.pathwayConnection,
        ))
          for (const parent of other.pathwayConnection.links) {
            const dx = parent.b.x - parent.a.x,
              dy = parent.b.y - parent.a.y,
              t =
                ((p.x - parent.a.x) * dx + (p.y - parent.a.y) * dy) /
                (dx * dx + dy * dy || 1),
              distance = Math.hypot(
                p.x - parent.a.x - t * dx,
                p.y - parent.a.y - t * dy,
              );
            if (t > 0 && t < 1 && distance < 4)
              candidates.push({ id: other.id, t, distance });
          }
        const best = candidates.sort((a, b) => a.distance - b.distance)[0];
        if (best) {
          link[key] = best.id;
          link[`${key}Anchor`] = best.t;
        }
      }
  for (const item of items) {
    if (
      item.pathwayConnection ||
      item.pathwayReaction ||
      item.pathway.role === "compartment" ||
      item.pathwayMemberIds?.length ||
      item.locked
    )
      continue;
    const bounds = { x: item.x, y: item.y, w: item.w, h: item.h };
    if (!alreadyReadable && !item.contourEdit && !item.contourOriginal) {
      const m = item.pathway,
        fresh = node(
          m.type,
          m.label,
          bounds,
          { source: m.source.database, id: m.source.pathwayId },
          m.source.elementId,
          { identifiers: m.identifiers, members: m.members },
        );
      fresh.svg = fresh.svg.replace(
        /<metadata data-pathway-metadata="true">[\s\S]*?<\/metadata>/,
        () =>
          `<metadata data-pathway-metadata="true">${E(JSON.stringify(m))}</metadata>`,
      );
      Object.assign(item, {
        x: fresh.x,
        y: fresh.y,
        w: fresh.w,
        h: fresh.h,
        svg: fresh.svg,
        pathwayLabelLayout: fresh.pathwayLabelLayout,
        pathwayGeometry: fresh.pathwayGeometry,
      });
    }
    item.pathwaySourceBounds = bounds;
  }
  layoutPathway(items, { expand: !alreadyReadable });
  const minX = Math.min(
      ...items.filter((i) => !i.pathwayConnection).map((i) => i.x),
    ),
    minY = Math.min(
      ...items.filter((i) => !i.pathwayConnection).map((i) => i.y),
    );
  const dx = Math.max(0, 40 - minX),
    dy = Math.max(0, 40 - minY);
  for (const item of items) {
    item.x += dx;
    item.y += dy;
    item.pathwayLayoutVersion = 1;
  }
  remapPathwayLinks(items, new Map(), dx, dy);
  syncPathwayConnections(items);
  return items;
}
async function payload(url, { fetcher, signal, ...options }, format) {
  const response = await fetcher(url, { ...options, signal });
  if (!response.ok)
    throw Error(`Pathway ophalen mislukt (HTTP ${response.status}).`);
  const text = await response.text();
  if (text.length > 12000000)
    throw Error("Dit pathway is te groot. Kies een specifieker deelpathway.");
  return format === "json" ? JSON.parse(text) : text;
}
export async function loadPathway(
  row,
  { fetcher = fetch, signal, Parser = globalThis.DOMParser } = {},
) {
  const reactome =
    row.source === "Reactome"
      ? row.id
      : row.source === "Pathway Commons"
        ? row.id.match(/(?:reactome:)(R-[A-Z]{3}-\d+)/)?.[1]
        : null;
  const controller = new AbortController(),
    abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) abort();
  const timer = setTimeout(abort, 45000);
  const request = { fetcher, signal: controller.signal };
  try {
    if (reactome && /^R-[A-Z]{3}-\d+$/.test(reactome)) {
      const data = await payload(
        `https://reactome.org/download/current/diagram/${reactome}.json`,
        request,
        "json",
      );
      return importReactomeDiagram(data, {
        ...row,
        source: "Reactome",
        id: reactome,
      });
    }
    if (row.source === "WikiPathways" && /^WP\d+$/.test(row.id))
      return importGPML(
        await payload(
          `https://www.wikipathways.org/wikipathways-assets/pathways/${row.id}/${row.id}.gpml`,
          request,
          "text",
        ),
        row,
        Parser,
      );
    if (row.source === "Pathway Commons" && commonsId(row.id))
      return importBioPAX(
        await payload(
          "https://www.pathwaycommons.org/pc2/v2/fetch",
          {
            ...request,
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              uri: [row.id],
              format: "JSONLD",
              subpw: false,
            }),
          },
          "json",
        ),
        row,
      );
    throw Error(
      "Voor deze bron is geen bewerkbare pathway-import beschikbaar.",
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
