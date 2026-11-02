import * as T from "three";
import { cellHemisphereGeometry } from "./cell-geometry.js";
import { isHemisphereCell } from "./cell-look.js";
import { cellMorphology } from "./cell-morphology.js";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";
import {
  mergeGeometries,
  mergeVertices,
} from "three/addons/utils/BufferGeometryUtils.js";

function distanceToSegment(x, y, a, b) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    t = Math.max(
      0,
      Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1)),
    );
  return Math.hypot(x - a.x - t * dx, y - a.y - t * dy);
}
export function boundaryDistance(x, y, rings) {
  let d = Infinity;
  for (const ring of rings)
    for (let i = 0; i < ring.length; i++)
      d = Math.min(
        d,
        distanceToSegment(x, y, ring[i], ring[(i + 1) % ring.length]),
      );
  return d;
}
function inside(x, y, ring) {
  let yes = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j];
    if (
      a.y > y !== b.y > y &&
      x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x
    )
      yes = !yes;
  }
  return yes;
}

/** Two curved faces meet at the exact vector boundary, including real holes. */
export function volumeGeometry(
  shape,
  {
    depth = 10,
    subdivisions = 2,
    curveSegments = 10,
    hemisphere = false,
    morphology,
  } = {},
) {
  if (hemisphere)
    return cellHemisphereGeometry(
      shape,
      depth,
      Math.max(24, curveSegments),
      morphology,
    );
  const flat = new T.ShapeGeometry(shape, curveSegments),
    pos = flat.attributes.position,
    index = flat.index;
  const extracted = shape.extractPoints(curveSegments),
    rings = [extracted.shape, ...extracted.holes];
  const bounds = new T.Box2().setFromPoints(extracted.shape),
    size = bounds.getSize(new T.Vector2()),
    radius = Math.max(0.001, Math.min(size.x, size.y) / 2),
    vertices = [];
  const vertex = (p, side) => {
    const d = boundaryDistance(p.x, p.y, rings),
      fraction = Math.min(1, d / radius);
    return [
      p.x,
      p.y,
      side * depth * 0.5 * Math.sqrt(Math.max(0, fraction * (2 - fraction))),
    ];
  };
  const triangle = (a, b, c, n) => {
    if (n) {
      const ab = a.clone().add(b).multiplyScalar(0.5),
        bc = b.clone().add(c).multiplyScalar(0.5),
        ca = c.clone().add(a).multiplyScalar(0.5);
      triangle(a, ab, ca, n - 1);
      triangle(ab, b, bc, n - 1);
      triangle(ca, bc, c, n - 1);
      triangle(ab, bc, ca, n - 1);
      return;
    }
    vertices.push(
      ...vertex(a, 1),
      ...vertex(b, 1),
      ...vertex(c, 1),
      ...vertex(c, -1),
      ...vertex(b, -1),
      ...vertex(a, -1),
    );
  };
  for (let i = 0; i < index.count; i += 3) {
    const points = [0, 1, 2].map(
      (k) =>
        new T.Vector2(pos.getX(index.getX(i + k)), pos.getY(index.getX(i + k))),
    );
    triangle(...points, subdivisions);
  }
  flat.dispose();
  let geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
  geometry = mergeVertices(geometry, 1e-4);
  geometry.computeVertexNormals();
  return { geometry, bounds, rings, radius, depth, hemisphere };
}
function simpleColor(value, fallback = "#064986") {
  try {
    if (value && value !== "none" && !value.startsWith("url"))
      return "#" + new T.Color(value).getHexString();
  } catch {}
  return fallback;
}
function sourceDocument(text) {
  const document = new DOMParser().parseFromString(text, "image/svg+xml");
  if (document.querySelector("parsererror"))
    throw Error("De bron-SVG is niet geldig.");
  const svg = document.documentElement;
  const gradients = new Map();
  for (const gradient of svg.querySelectorAll(
    "linearGradient,radialGradient",
  )) {
    const stops = [...gradient.querySelectorAll("stop")];
    const colors = stops
      .map((s) => s.getAttribute("stop-color") || s.style.stopColor)
      .filter(Boolean);
    if (colors.length)
      gradients.set(gradient.id, colors[Math.floor(colors.length / 2)]);
  }
  const resolve = (value) =>
    value?.replace(
      /url\(\s*['"]?#([^)'"\s]+)['"]?\s*\)/g,
      (original, id) => gradients.get(id) || "#a9c6e2",
    );
  for (const node of svg.querySelectorAll("*")) {
    if (
      node.getAttribute("display") === "none" ||
      node.style?.display === "none" ||
      node.getAttribute("visibility") === "hidden"
    ) {
      node.remove();
      continue;
    }
    for (const attr of ["fill", "stroke", "style"])
      if (node.hasAttribute(attr))
        node.setAttribute(attr, resolve(node.getAttribute(attr)));
    if (node.tagName.toLowerCase() === "style")
      node.textContent = resolve(node.textContent);
  }
  return document;
}
function strokeGeometry(subPath, width, z) {
  const points = subPath.getPoints(22);
  if (points.length < 2 || width <= 0) return null;
  const unique = points.filter(
    (p, i) => i === 0 || p.distanceTo(points[i - 1]) > 0.001,
  );
  if (unique.length < 2) return null;
  const curve = new T.CurvePath();
  for (let i = 1; i < unique.length; i++)
    curve.add(
      new T.LineCurve3(
        new T.Vector3(unique[i - 1].x, unique[i - 1].y, z),
        new T.Vector3(unique[i].x, unique[i].y, z),
      ),
    );
  return new T.TubeGeometry(
    curve,
    Math.min(160, Math.max(2, unique.length * 2)),
    width / 2,
    5,
    false,
  );
}

/** Every shape remains derived from the current source; no molecule identity is invented. */
export async function buildBasisVolume(
  text,
  {
    depthScale = 1,
    mode = "volume",
    includeLabels = true,
    cell,
    cellProfile,
    onProgress = () => {},
  } = {},
) {
  const document = sourceDocument(text),
    svg = document.documentElement;
  const warnings = [];
  if (svg.querySelector("[clip-path],mask,filter"))
    warnings.push(
      "Controleer uitsparingen en effecten: SVG-clipping en filters zijn niet volledig naar volume vertaald.",
    );
  const labelSVG = svg.cloneNode(true);
  for (const n of labelSVG.querySelectorAll(
    "path,rect,circle,ellipse,polygon,polyline,line,image,use",
  ))
    if (!n.closest("defs")) n.remove();
  const hasText = !!labelSVG.querySelector("text");
  for (const n of svg.querySelectorAll("text,tspan,script,foreignObject"))
    n.remove();
  const normalized = new XMLSerializer().serializeToString(svg),
    data = new SVGLoader().parse(normalized),
    bounds = new T.Box2();
  for (const p of data.paths)
    for (const sub of p.subPaths)
      for (const point of sub.getPoints(8)) bounds.expandByPoint(point);
  if (bounds.isEmpty())
    throw Error("Deze bouwsteen bevat geen omzetbare vectorpaden.");
  const size = bounds.getSize(new T.Vector2()),
    span = Math.max(size.x, size.y),
    center = bounds.getCenter(new T.Vector2()),
    unit = 7 / span;
  const cellMode =
    mode === "volume" &&
    (cell ??
      isHemisphereCell({ name: document.querySelector("title")?.textContent }));
  const shapesByPath = new Map();
  const morphology =
    cellProfile ||
    cellMorphology({ name: document.querySelector("title")?.textContent });
  let bodyShape = null,
    bodyArea = 0;
  if (cellMode)
    for (const path of data.paths) {
      const style = path.userData.style;
      if (
        !style.fill ||
        style.fill === "none" ||
        Number(style.fillOpacity ?? 1) <= 0
      )
        continue;
      try {
        const shapes = SVGLoader.createShapes(path);
        shapesByPath.set(path, shapes);
        for (const shape of shapes) {
          const box = new T.Box2().setFromPoints(shape.extractPoints(10).shape),
            s = box.getSize(new T.Vector2()),
            area = s.x * s.y;
          if (Math.min(s.x, s.y) > span * 0.12 && area > bodyArea) {
            bodyShape = shape;
            bodyArea = area;
          }
        }
      } catch {}
    }
  const batches = new Map(),
    envelopes = [];
  let triangles = 0,
    pathCount = 0,
    shapeCount = 0;
  const add = (geometry, color, opacity = 1) => {
    if (!geometry) return;
    const key = color + "|" + opacity;
    geometry.deleteAttribute("uv");
    if (geometry.index) geometry = geometry.toNonIndexed();
    if (!batches.has(key)) batches.set(key, []);
    batches.get(key).push(geometry);
    triangles += geometry.attributes.position.count / 3;
  };
  for (let pi = 0; pi < data.paths.length; pi++) {
    const path = data.paths[pi],
      style = path.userData.style;
    if (style.visibility === "hidden") continue;
    const node = path.userData.node,
      identity = node?.id || node?.parentElement?.id || "onderdeel-" + pi;
    if (
      style.fill &&
      style.fill !== "none" &&
      Number(style.fillOpacity ?? 1) > 0
    ) {
      let shapes;
      try {
        shapes = shapesByPath.get(path) || SVGLoader.createShapes(path);
      } catch {
        warnings.push("Een complex pad kon niet worden omgezet: " + identity);
        continue;
      }
      for (const shape of shapes) {
        const extracted = shape.extractPoints(10);
        if (extracted.shape.length < 3) continue;
        const box = new T.Box2().setFromPoints(extracted.shape),
          s = box.getSize(new T.Vector2()),
          c = box.getCenter(new T.Vector2()),
          minor = Math.min(s.x, s.y);
        if (minor < 0.001) continue;
        const isBody = shape === bodyShape;
        const large = minor > span * 0.55,
          depth =
            (isBody
              ? minor
              : cellMode &&
                  ["erythrocyte", "platelet"].includes(morphology.type)
                ? span * 0.003
                : mode === "relief"
                  ? span * 0.035
                  : Math.max(
                      span * 0.003,
                      Math.min(minor * 0.75, span * (large ? 0.045 : 0.18)),
                    )) * depthScale;
        const complexity =
            extracted.shape.length +
            extracted.holes.reduce((n, h) => n + h.length, 0),
          subdivisions =
            mode === "relief"
              ? 0
              : triangles > 120000
                ? 0
                : complexity > 100
                  ? 1
                  : minor > span * 0.04
                    ? 3
                    : 1;
        const volume = volumeGeometry(shape, {
          depth,
          subdivisions: isBody ? Math.max(4, subdivisions) : subdivisions,
          hemisphere: isBody,
          morphology: isBody ? morphology : undefined,
        });
        let base = 0;
        for (const prev of envelopes) {
          if (
            prev.bounds.containsPoint(c) &&
            prev.area > s.x * s.y * 1.2 &&
            inside(c.x, c.y, prev.rings[0]) &&
            !prev.rings.slice(1).some((r) => inside(c.x, c.y, r))
          ) {
            const d = Math.min(
                1,
                boundaryDistance(c.x, c.y, prev.rings) / prev.radius,
              ),
              front =
                prev.z +
                (prev.hemisphere
                  ? 0
                  : prev.depth * 0.5 * Math.sqrt(d * (2 - d)));
            base = Math.max(base, front);
          }
        }
        const z = base + span * 0.001 + (pi / data.paths.length) * span * 0.002;
        volume.geometry.translate(0, 0, z);
        envelopes.push({ ...volume, z, area: s.x * s.y });
        add(
          volume.geometry,
          simpleColor(style.fill),
          Math.min(
            1,
            Number(style.opacity ?? 1) * Number(style.fillOpacity ?? 1),
          ),
        );
        shapeCount++;
      }
    }
    if (
      style.stroke &&
      style.stroke !== "none" &&
      Number(style.strokeOpacity ?? 1) > 0
    ) {
      const width = Number(style.strokeWidth) || 1;
      for (const sub of path.subPaths) {
        const points = sub.getPoints(8);
        if (!points.length) continue;
        const c = points[Math.floor(points.length / 2)];
        let z = span * 0.002;
        for (const envelope of envelopes.slice(-8)) {
          if (envelope.bounds.containsPoint(c))
            z = Math.max(
              z,
              envelope.z + Math.min(envelope.depth * 0.03, span * 0.001),
            );
        }
        add(
          strokeGeometry(sub, Math.max(span * 0.0006, width), z),
          simpleColor(style.stroke),
          Math.min(
            1,
            Number(style.opacity ?? 1) * Number(style.strokeOpacity ?? 1),
          ),
        );
      }
    }
    pathCount++;
    if (pi % 18 === 0) {
      onProgress(pi / data.paths.length);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  const source = new T.Group();
  for (const [key, geometries] of batches) {
    const [color, opacity] = key.split("|"),
      merged = mergeGeometries(geometries, false);
    if (!merged) continue;
    source.add(
      new T.Mesh(
        merged,
        new T.MeshStandardMaterial({
          color,
          roughness: 0.65,
          side: T.DoubleSide,
          transparent: +opacity < 1,
          opacity: +opacity,
        }),
      ),
    );
    for (const geo of geometries) geo.dispose();
  }
  source.position.set(-center.x, center.y, 0);
  source.scale.set(1, -1, 1);
  const root = new T.Group();
  root.add(source);
  root.scale.setScalar(unit);
  // Text remains sharp on a transparent layer, while the drawing itself is geometry.
  if (hasText && includeLabels) {
    const serialized = new XMLSerializer().serializeToString(labelSVG),
      uri =
        "data:image/svg+xml;charset=utf-8," + encodeURIComponent(serialized);
    try {
      const texture = await new T.TextureLoader().loadAsync(uri);
      texture.colorSpace = T.SRGBColorSpace;
      const vb = svg.viewBox.baseVal;
      const w = vb.width || +svg.getAttribute("width") || span,
        h = vb.height || +svg.getAttribute("height") || span;
      const plane = new T.Mesh(
        new T.PlaneGeometry(w, h),
        new T.MeshBasicMaterial({
          map: texture,
          transparent: true,
          side: T.DoubleSide,
          depthWrite: false,
        }),
      );
      const box3 = new T.Box3().setFromObject(source);
      plane.position.set(
        (vb.x || 0) + w / 2 - center.x,
        center.y - (vb.y || 0) - h / 2,
        box3.max.z + span * 0.003,
      );
      plane.userData.isLabel = true;
      root.add(plane);
    } catch {
      warnings.push(
        "Tekstlaag kon niet worden geladen. Het oorspronkelijke SVG blijft beschikbaar.",
      );
    }
  }
  root.userData = {
    conversion: "rounded-vector-volume-v1",
    cellGeometry: bodyShape ? "cell-type-cutaway-v2" : null,
    cellMorphology: bodyShape ? morphology.type : null,
    shapeCount,
    pathCount,
    triangles: Math.round(triangles),
    warnings: [...new Set(warnings)],
    sourceTitle: document.querySelector("title")?.textContent || "Basisfiguur",
  };
  onProgress(1);
  return root;
}
