import {
  vectorElements,
  elementPath,
  pathData,
  pathPoints,
} from "./vector-nodes.js";
import {
  contourCommands,
  contourFrame,
  nearestContour,
  anchoredPose,
  interiorWeights,
  deformInteriorPoint,
} from "./contour2d.js";
import { bezier } from "./model.js";
import { membranePoints } from "./membrane2d.js";
const NS = "http://www.w3.org/2000/svg";
const matrix2D = (m) => new DOMMatrix([m.a, m.b, m.c, m.d, m.e, m.f]);
const point = (p, m) => {
  const v = new DOMPoint(p[0], p[1]).matrixTransform(m);
  return [v.x, v.y];
};
const signature = (item) =>
  item.kind === "membrane" ? JSON.stringify(item.curve) : item.path;
function replacePart(doc, index, commands) {
  const node = vectorElements(doc)[index],
    path = doc.createElementNS(NS, "path");
  for (const a of [...node.attributes])
    if (
      ![
        "d",
        "x",
        "y",
        "x1",
        "y1",
        "x2",
        "y2",
        "cx",
        "cy",
        "rx",
        "ry",
        "r",
        "width",
        "height",
        "points",
      ].includes(a.name)
    )
      path.setAttributeNS(a.namespaceURI, a.name, a.value);
  path.setAttribute("d", pathData(commands));
  node.replaceWith(path);
}
export function prepareContour(drawing, item, preferredIndex) {
  const entity = drawing.svg.querySelector(`[data-entity="${item.id}"]`);
  if (!entity) throw Error("Selecteer eerst een zichtbaar object.");
  const screenToSheet = matrix2D(drawing.svg.getScreenCTM()).inverse();
  let node,
    index = 0,
    sourceDoc,
    closed = true,
    localPoints,
    toSheet,
    sig;
  if (item.kind === "svg") {
    sourceDoc = new DOMParser().parseFromString(item.svg, "image/svg+xml");
    const nodes = [...entity.querySelectorAll("[data-node-path]")],
      sourceParts = vectorElements(sourceDoc);
    index = preferredIndex ?? item.contourEdit?.pathIndex;
    if (index === undefined) {
      let largest = 0;
      nodes.forEach((n, i) => {
        try {
          const b = n.getBBox(),
            fill = getComputedStyle(n).fill,
            commands = elementPath(sourceParts[i]);
          if (
            fill !== "none" &&
            commands.some((c) => c.type === "Z") &&
            b.width * b.height > largest
          ) {
            largest = b.width * b.height;
            index = i;
          }
        } catch {}
      });
    }
    node = nodes[index ?? 0];
    index ??= 0;
    if (!node?.getTotalLength)
      throw Error("Kies een vectorcontour met Punten bewerken.");
    const source = sourceParts[index],
      commands = elementPath(source);
    if (commands.filter((c) => c.type === "M").length !== 1)
      throw Error(
        "Kies één doorlopende contour, zonder samengestelde subpaden.",
      );
    closed = commands.some((c) => c.type === "Z");
    sig = source.getAttribute("d") || source.outerHTML;
    toSheet = screenToSheet.multiply(node.getScreenCTM());
  } else {
    node = entity.querySelector("[data-artwork]");
    toSheet = screenToSheet.multiply(node.getScreenCTM());
    if (item.kind === "membrane") {
      closed = !!item.closed;
      sig = signature(item);
      const curve = membranePoints(item),
        count = closed ? 28 : 29;
      localPoints = Array.from({ length: count }, (_, i) =>
        bezier(curve, i / (closed ? count : count - 1)),
      );
    } else {
      node = [...node.querySelectorAll("path,ellipse,rect")].find(
        (n) => n.getAttribute("fill") !== "transparent",
      );
      if (!node?.getTotalLength)
        throw Error("Kies een cel, weefsel, membraan, ellips, kader of pad.");
      toSheet = screenToSheet.multiply(node.getScreenCTM());
      closed =
        ["ellipse", "rect"].includes(item.kind) ||
        !!item.pathClosed ||
        /z\s*$/i.test(item.path || "");
      sig = signature(item);
    }
  }
  const stored = item.contourEdit;
  if (stored && stored.pathIndex === index && stored.signature === sig)
    localPoints = stored.points;
  if (!localPoints) {
    const length = node.getTotalLength(),
      scale = Math.hypot(toSheet.a, toSheet.b),
      count = Math.max(24, Math.min(192, Math.ceil((length * scale) / 8)));
    localPoints = Array.from({ length: count }, (_, i) => {
      const p = node.getPointAtLength(
        (length * i) / (closed ? count : count - 1),
      );
      return [p.x, p.y];
    });
  }
  const points = localPoints.map((p) => point(p, toSheet));
  return {
    item,
    index,
    closed,
    points,
    toSheet,
    fromSheet: toSheet.inverse(),
    sourceDoc,
    sourceSVG: entity.querySelector("svg"),
    screenToSheet,
    signature: sig,
  };
}
export function embeddedAnchors(session) {
  if (!session.sourceDoc) return [];
  const root = session.sourceSVG,
    body = root.querySelector(`[data-node-path="${session.index}"]`),
    groups = [...root.querySelectorAll("g")],
    chosen = new Set(),
    anchors = [];
  for (const g of groups) {
    const name = [
      g.id,
      g.getAttribute("inkscape:label"),
      g.getAttribute("aria-label"),
    ].join(" ");
    if (
      (!/TCR|CD\d|HLA|KIR|NKG|receptor|coreceptor|BCR|DAP12/i.test(name) &&
        !g.hasAttribute("data-membrane-receptor")) ||
      g.contains(body) ||
      g.closest("defs")
    )
      continue;
    let container = g;
    while (
      container.parentElement?.tagName.toLowerCase() === "g" &&
      !container.parentElement.contains(body)
    )
      container = container.parentElement;
    if (chosen.has(container)) continue;
    chosen.add(container);
    const box = container.getBBox(),
      matrix = session.screenToSheet.multiply(container.getScreenCTM()),
      centre = point([box.x + box.width / 2, box.y + box.height / 2], matrix),
      closest = nearestContour(session.points, centre, session.closed),
      size = Math.max(box.width, box.height) * Math.hypot(matrix.a, matrix.b);
    if (closest.distance > Math.max(14, size * 0.8)) continue;
    const stored = container.getAttribute("data-membrane-u"),
      u = stored === null ? closest.u : +stored,
      frame = contourFrame(session.points, u, session.closed),
      v = centre.map((x, k) => x - frame.point[k]),
      fallback = [-matrix.c, -matrix.d],
      axis = Math.hypot(...v) > 2 ? v : fallback,
      side =
        +(container.getAttribute("data-membrane-side") || 0) ||
        (axis[0] * frame.normal[0] + axis[1] * frame.normal[1] >= 0 ? 1 : -1);
    anchors.push({
      index: groups.indexOf(container),
      u,
      side,
      axisAngle: Math.atan2(axis[1], axis[0]),
      frame,
      matrix,
      parentMatrix: session.screenToSheet.multiply(
        container.parentElement.getScreenCTM(),
      ),
    });
  }
  return anchors;
}
export function prepareInterior(session, anchors) {
  if (!session.sourceDoc) return [];
  const groups = [...session.sourceSVG.querySelectorAll("g")],
    receptors = anchors.map((a) => groups[a.index]),
    source = vectorElements(session.sourceDoc),
    parts = [];
  for (const node of session.sourceSVG.querySelectorAll("[data-node-path]")) {
    const index = +node.dataset.nodePath;
    if (index === session.index || receptors.some((g) => g?.contains(node)))
      continue;
    try {
      const toSheet = session.screenToSheet.multiply(node.getScreenCTM()),
        commands = elementPath(source[index]);
      parts.push({
        index,
        commands,
        samples: pathPoints(commands).map((p) => {
          const world = point([p.x, p.y], toSheet);
          return {
            ...p,
            world,
            weights: session.closed
              ? interiorWeights(session.points, world)
              : undefined,
          };
        }),
        toSheet,
        fromSheet: toSheet.inverse(),
      });
    } catch {}
  }
  return parts;
}
function moveEmbedded(doc, worldPoints, closed, anchors) {
  const groups = [...doc.querySelectorAll("g")];
  for (const a of anchors) {
    const frame = contourFrame(worldPoints, a.u, closed),
      angle =
        Math.atan2(frame.normal[1] * a.side, frame.normal[0] * a.side) -
        a.axisAngle,
      delta = new DOMMatrix()
        .translate(frame.point[0], frame.point[1])
        .rotate((angle * 180) / Math.PI)
        .translate(-a.frame.point[0], -a.frame.point[1]),
      m = a.parentMatrix.inverse().multiply(delta).multiply(a.matrix),
      g = groups[a.index];
    if (!g) continue;
    g.setAttribute(
      "transform",
      `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})`,
    );
    g.setAttribute("data-membrane-u", String(a.u));
    g.setAttribute("data-membrane-side", String(a.side));
  }
}
function deformParts(doc, session, worldPoints, interior) {
  // Simplify can change the cage's point count. Match its parameterization to
  // the original cage only for the interior mapping; retain the simplified rim.
  if (worldPoints.length !== session.points.length) {
    const points = worldPoints;
    worldPoints = session.points.map(
      (_, i) =>
        contourFrame(
          points,
          i /
            (session.closed
              ? session.points.length
              : session.points.length - 1),
          session.closed,
        ).point,
    );
  }
  for (const part of interior) {
    const changed = structuredClone(part.commands);
    for (const p of part.samples) {
      const moved = point(
        deformInteriorPoint(
          p.world,
          session.points,
          worldPoints,
          session.closed,
          session.brushRadius || 100,
          p.weights,
        ),
        part.fromSheet,
      );
      changed[p.command].values[p.offset] = moved[0];
      changed[p.command].values[p.offset + 1] = moved[1];
    }
    replacePart(doc, part.index, changed);
  }
}
export function followInterior(session, nextPoints, interior) {
  const doc = new DOMParser().parseFromString(
    session.item.svg,
    "image/svg+xml",
  );
  if (nextPoints.length !== session.points.length) {
    const points = nextPoints;
    nextPoints = session.points.map(
      (_, i) =>
        contourFrame(
          points,
          i /
            (session.closed
              ? session.points.length
              : session.points.length - 1),
          session.closed,
        ).point,
    );
  }
  deformParts(doc, session, nextPoints, interior);
  session.item.svg = new XMLSerializer().serializeToString(doc.documentElement);
}
export function followEmbedded(session, anchors) {
  const doc = session.sourceDoc.cloneNode(true);
  moveEmbedded(doc, session.points, session.closed, anchors);
  session.item.svg = new XMLSerializer().serializeToString(doc.documentElement);
}
export function writeContour(
  session,
  worldPoints,
  anchors = [],
  interior = [],
) {
  const item = session.item,
    local = worldPoints.map((p) => point(p, session.fromSheet)),
    commands = contourCommands(local, session.closed);
  item.contourOriginal ??= {
    kind: item.kind,
    svg: item.svg,
    path: item.path,
    pathClosed: item.pathClosed,
    curve: item.curve ? structuredClone(item.curve) : undefined,
  };
  if (item.kind === "svg") {
    const doc = session.sourceDoc.cloneNode(true);
    replacePart(doc, session.index, commands);
    deformParts(doc, session, worldPoints, interior);
    moveEmbedded(doc, worldPoints, session.closed, anchors);
    item.svg = new XMLSerializer().serializeToString(doc.documentElement);
    item.contourEdit = {
      pathIndex: session.index,
      points: local,
      closed: session.closed,
      signature: pathData(commands),
    };
  } else if (item.kind === "membrane") {
    // Native bilayers support at most 30 Bézier segments.
    item.curve = commands
      .filter((c) => c.type !== "Z")
      .flatMap((c) => {
        const p = [];
        for (let k = 0; k < c.values.length; k += 2)
          p.push([c.values[k] / item.w, c.values[k + 1] / item.h]);
        return p;
      });
    item.contourEdit = {
      pathIndex: 0,
      points: local,
      closed: session.closed,
      signature: signature(item),
    };
  } else {
    item.kind = "path";
    item.path = pathData(commands);
    item.pathClosed = session.closed;
    item.contourEdit = {
      pathIndex: 0,
      points: local,
      closed: session.closed,
      signature: item.path,
    };
  }
}
export function syncSheetAnchors(drawing) {
  let changed = false;
  const cache = new Map();
  for (const item of drawing.doc.items) {
    const a = item.anchor2d;
    if (!a) continue;
    const target = drawing.doc.items.find((i) => i.id === a.targetId);
    if (!target) {
      delete item.anchor2d;
      continue;
    }
    try {
      if (!cache.has(target.id))
        cache.set(target.id, prepareContour(drawing, target, a.pathIndex));
      const s = cache.get(target.id),
        pose = anchoredPose(item, contourFrame(s.points, a.u, s.closed), a);
      if (
        ["x", "y", "rotation"].some((k) => Math.abs(pose[k] - item[k]) > 1e-5)
      ) {
        Object.assign(item, pose);
        changed = true;
      }
    } catch {}
  }
  return changed;
}
