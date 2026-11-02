import { sourceStyles } from "./palettes.js";
export const clone = (x) => structuredClone(x);
export const uid = () => crypto.randomUUID();
export const presets = {
  basis: {
    name: "Basis set 2026",
    background: "#f4f7fa",
    head: "#a9c6e2",
    tail: "#80b2d8",
    receptor: "#93c94d",
    hla: "#ff5a36",
    antibody: "#ffb75d",
    channel: "#8c82bd",
    outline: "#064986",
    label: "#064986",
  },
  light: {
    name: "Illustrated Light",
    background: "#f8f7f3",
    head: "#d8c8a3",
    tail: "#ad9672",
    receptor: "#72b7ae",
    hla: "#e99c73",
    antibody: "#e9be63",
    channel: "#9d8bc6",
    outline: "#334b65",
    label: "#334b65",
  },
  dark: {
    name: "Dark Presentation",
    background: "#14283e",
    head: "#689fba",
    tail: "#3b6c92",
    receptor: "#a5ce78",
    hla: "#ff8b6b",
    antibody: "#f8ce79",
    channel: "#b9a1ee",
    outline: "#dce9f7",
    label: "#eff7ff",
  },
  ...sourceStyles,
};
export const catalog = [
  {
    kind: "hla",
    name: "Peptide–HLA-I",
    category: "Antigeenpresentatie",
    description: "Zware keten, β2-microglobuline en peptide",
    anchored: true,
  },
  {
    kind: "hla2",
    name: "Peptide–HLA-II",
    category: "Antigeenpresentatie",
    description: "Twee transmembraanketens en flankerend peptide",
    anchored: true,
  },
  {
    kind: "tcr",
    name: "TCR αβ · CD3",
    category: "Receptoren",
    description: "Twee receptorarmen met signaalketens",
    anchored: true,
  },
  {
    kind: "igg",
    name: "IgG",
    category: "Antistoffen",
    description: "Twee Fab-armen met bewerkbaar scharnier",
    anchored: false,
  },
  {
    kind: "pd1",
    name: "PD-1",
    category: "Checkpoints",
    description: "Schematisch Ig-domein en membraananker",
    anchored: true,
  },
  {
    kind: "pdl1",
    name: "PD-L1",
    category: "Checkpoints",
    description: "Twee extracellulaire domeinen",
    anchored: true,
  },
  {
    kind: "channel",
    name: "Porie / kanaal",
    category: "Membraan",
    description: "Geometrische referentie met echt lumen",
    anchored: true,
  },
];
export function makeItem(kind, extra = {}) {
  const c = catalog.find((x) => x.kind === kind);
  return {
    id: uid(),
    kind,
    name: c?.name || "Object",
    s: 0.5,
    depth: 0,
    anchored: c?.anchored || false,
    x: 0,
    y: 6,
    z: 0,
    rotation: 0,
    rotationX: 0,
    rotationY: 0,
    volumeDepth: 1,
    scale: 1,
    hinge: 0,
    pivot: [0, 4.2, 0],
    representation: "cartoon",
    visible: true,
    label: true,
    ...extra,
  };
}
export function newProject({ demo = false } = {}) {
  return {
    version: 1,
    editorMode: "2d",
    starterSceneVersion: 2,
    name: "Immunologische membraanscène",
    curve: [
      [-16, 0],
      [-6, 3],
      [5, -3],
      [16, 0],
    ],
    thickness: 1.6,
    depth: 12,
    fade: 0.45,
    cut: true,
    style: clone(presets.basis),
    duration: 8,
    camera: { position: [20, 14, 32], target: [0, 2, 0], zoom: 1 },
    items: demo
      ? [
          makeItem("hla", { s: 0.24 }),
          makeItem("channel", { s: 0.52 }),
          makeItem("tcr", { s: 0.78 }),
          makeItem("igg", { x: -8, y: 7, z: 1, rotation: -0.2, scale: 0.75 }),
        ]
      : [],
    keys: [],
  };
}
/** Remove only the exact, untouched four-object starter from older autosaves. */
export function removeLegacyStarter(project) {
  if (project.starterSceneVersion >= 2) return 0;
  project.starterSceneVersion = 2;
  if (project.keys?.length || project.items.length < 4) return 0;
  const templates = newProject({ demo: true }).items;
  const matches = templates.every((template, index) => {
    const item = project.items[index];
    return [...new Set([...Object.keys(template), ...Object.keys(item)])]
      .filter((k) => k !== "id")
      .every((k) => JSON.stringify(item[k]) === JSON.stringify(template[k]));
  });
  if (!matches) return 0;
  project.items = project.items.slice(4);
  return 4;
}
export function bezier(points, t) {
  if (points.length > 4) {
    const count = (points.length - 1) / 3,
      index = Math.min(
        count - 1,
        Math.floor(Math.max(0, Math.min(1, t)) * count),
      );
    return bezier(
      points.slice(index * 3, index * 3 + 4),
      Math.max(0, Math.min(1, t)) * count - index,
    );
  }
  const u = 1 - t;
  return [0, 1].map(
    (k) =>
      u * u * u * points[0][k] +
      3 * u * u * t * points[1][k] +
      3 * u * t * t * points[2][k] +
      t * t * t * points[3][k],
  );
}
export function tangent(points, t) {
  if (points.length > 4) {
    const count = (points.length - 1) / 3,
      index = Math.min(
        count - 1,
        Math.floor(Math.max(0, Math.min(1, t)) * count),
      );
    return tangent(
      points.slice(index * 3, index * 3 + 4),
      Math.max(0, Math.min(1, t)) * count - index,
    );
  }
  const u = 1 - t;
  const v = [0, 1].map(
    (k) =>
      3 * u * u * (points[1][k] - points[0][k]) +
      6 * u * t * (points[2][k] - points[1][k]) +
      3 * t * t * (points[3][k] - points[2][k]),
  );
  const l = Math.hypot(...v);
  return l > 1e-8 ? v.map((x) => x / l) : [1, 0];
}
export function arcTable(points, n = 300) {
  n = Math.max(n, ((points.length - 1) / 3) * 100);
  const rows = [{ t: 0, s: 0 }];
  let prev = bezier(points, 0),
    sum = 0;
  for (let i = 1; i <= n; i++) {
    const p = bezier(points, i / n);
    sum += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    rows.push({ t: i / n, s: sum });
    prev = p;
  }
  return { rows, length: sum };
}
export function arcT(table, s) {
  const target = Math.max(0, Math.min(1, s)) * table.length;
  const i = table.rows.findIndex((r) => r.s >= target);
  if (i <= 0) return 0;
  const a = table.rows[i - 1],
    b = table.rows[i];
  return a.t + ((b.t - a.t) * (target - a.s)) / (b.s - a.s || 1);
}
export function effectiveDepth(project, item) {
  return Number.isInteger(item.level)
    ? (project.depth / 2 - 0.8) * (1 - (2 * item.level) / 3)
    : item.anchored
      ? item.depth
      : item.z;
}
export function frame(project, item, table = arcTable(project.curve)) {
  const t = arcT(table, item.s),
    p = bezier(project.curve, t),
    v = tangent(project.curve, t);
  return {
    position: [p[0], p[1], effectiveDepth(project, item)],
    angle: Math.atan2(v[1], v[0]),
    normal: [-v[1], v[0], 0],
    t,
  };
}
export function curveValid(points, thickness) {
  if (
    !Array.isArray(points) ||
    points.length < 4 ||
    (points.length - 1) % 3 !== 0 ||
    points.length > 91 ||
    points.flat().some((x) => !Number.isFinite(x))
  )
    return false;
  for (let i = 0; i < 100; i++) {
    const a = bezier(points, i / 100),
      b = bezier(points, (i + 1) / 100);
    if (b[0] - a[0] < 0.015) return false;
    const ta = tangent(points, i / 100),
      tb = tangent(points, (i + 1) / 100);
    if (
      Math.acos(Math.max(-1, Math.min(1, ta[0] * tb[0] + ta[1] * tb[1]))) *
        thickness >
      Math.hypot(b[0] - a[0], b[1] - a[1])
    )
      return false;
  }
  return true;
}
export function closestCurveT(points, position) {
  let best = 0,
    distance = Infinity;
  for (let n = 0; n <= 600; n++) {
    const t = n / 600,
      p = bezier(points, t),
      d = Math.hypot(p[0] - position[0], p[1] - position[1]);
    if (d < distance) {
      best = t;
      distance = d;
    }
  }
  return best;
}
export function splitBezier(points, t = 0.5) {
  if (points.length >= 91) throw Error("Maximaal 31 curvepunten.");
  const count = (points.length - 1) / 3,
    index = Math.min(
      count - 1,
      Math.floor(Math.max(0, Math.min(1, t)) * count),
    );
  let u = t * count - index;
  if (u < 0.02 || u > 0.98) u = 0.5;
  const [a, b, c, d] = points.slice(index * 3, index * 3 + 4),
    mix = (x, y) => x.map((v, k) => v + (y[k] - v) * u),
    ab = mix(a, b),
    bc = mix(b, c),
    cd = mix(c, d),
    abc = mix(ab, bc),
    bcd = mix(bc, cd),
    point = mix(abc, bcd);
  return [
    ...clone(points.slice(0, index * 3)),
    clone(a),
    ab,
    abc,
    point,
    bcd,
    cd,
    clone(d),
    ...clone(points.slice(index * 3 + 4)),
  ];
}
export function snapshot(p) {
  return {
    items: p.items.map(
      ({
        id,
        s,
        depth,
        x,
        y,
        z,
        rotation,
        rotationX = 0,
        rotationY = 0,
        scale,
        hinge,
        visible,
        level,
      }) => ({
        id,
        s,
        depth,
        x,
        y,
        z,
        rotation,
        rotationX,
        rotationY,
        scale,
        hinge,
        visible,
        level,
      }),
    ),
    camera: clone(p.camera),
  };
}
export function evaluate(p, time) {
  const out = clone(p);
  if (!p.keys.length) return out;
  const keys = [...p.keys].sort((a, b) => a.time - b.time);
  let a = keys[0],
    b = keys.at(-1);
  if (time <= a.time) b = a;
  else if (time >= b.time) a = b;
  else
    for (let i = 0; i < keys.length - 1; i++)
      if (time >= keys[i].time && time <= keys[i + 1].time) {
        a = keys[i];
        b = keys[i + 1];
        break;
      }
  const t = a === b ? 0 : (time - a.time) / (b.time - a.time);
  const mix = (x, y) => x + (y - x) * t;
  for (const item of out.items) {
    const x = a.state.items.find((i) => i.id === item.id),
      y = b.state.items.find((i) => i.id === item.id);
    if (x && y) {
      for (const k of [
        "s",
        "depth",
        "x",
        "y",
        "z",
        "rotation",
        "scale",
        "hinge",
      ])
        item[k] = mix(x[k], y[k]);
      item.rotationX = mix(x.rotationX || 0, y.rotationX || 0);
      item.rotationY = mix(x.rotationY || 0, y.rotationY || 0);
      if (Number.isInteger(x.level) || Number.isInteger(y.level)) {
        const dx = effectiveDepth(p, { ...item, ...x }),
          dy = effectiveDepth(p, { ...item, ...y });
        item.level = null;
        if (item.anchored) item.depth = mix(dx, dy);
        else item.z = mix(dx, dy);
      }
      item.visible = t < 0.5 ? x.visible : y.visible;
    }
  }
  out.camera = {
    anchorId: a.state.camera.anchorId,
    mode: a.state.camera.mode,
    projection: a.state.camera.projection,
    position: a.state.camera.position.map((x, i) =>
      mix(x, b.state.camera.position[i]),
    ),
    target: a.state.camera.target.map((x, i) =>
      mix(x, b.state.camera.target[i]),
    ),
    zoom: mix(a.state.camera.zoom, b.state.camera.zoom),
  };
  if (out.camera.anchorId && out.camera.mode !== "free") {
    const item = out.items.find((i) => i.id === out.camera.anchorId);
    if (item) {
      const pos = item.anchored
        ? frame(out, item).position
        : [item.x, item.y, effectiveDepth(out, item)];
      if (out.camera.mode !== "look")
        out.camera.position = out.camera.position.map(
          (x, k) => x + pos[k] - out.camera.target[k],
        );
      out.camera.target = pos;
    }
  }
  return out;
}
export function validateProject(p) {
  if (
    !p ||
    p.version !== 1 ||
    !Array.isArray(p.items) ||
    p.items.length > 200 ||
    !curveValid(p.curve, p.thickness)
  )
    throw Error("Ongeldig project of ongeschikte curve.");
  for (const k of ["thickness", "depth", "duration"])
    if (!Number.isFinite(p[k]) || p[k] <= 0 || p[k] > 120)
      throw Error("Ongeldige afmetingen of tijdsduur.");
  validateStyle(p.style);
  if (p.sheet) {
    if (
      p.sheet.version !== 1 ||
      !Array.isArray(p.sheet.items) ||
      p.sheet.items.length > 300 ||
      ![p.sheet.width, p.sheet.height].every(
        (n) => Number.isFinite(n) && n >= 100 && n <= 10000,
      )
    )
      throw Error("Ongeldig 2D-tekenblad.");
    const sheetIds = new Set();
    for (const i of p.sheet.items) {
      if (
        sheetIds.has(i.id) ||
        ![i.x, i.y, i.w, i.h, i.rotation, i.opacity].every(Number.isFinite) ||
        i.w <= 0 ||
        i.h <= 0
      )
        throw Error("Ongeldig 2D-object");
      sheetIds.add(i.id);
      if (i.kind === "svg" && typeof i.svg !== "string")
        throw Error("SVG ontbreekt in 2D-object.");
      if (
        i.kind === "membrane" &&
        (!Array.isArray(i.curve) ||
          i.curve.length < 4 ||
          i.curve.length > 91 ||
          (i.curve.length - 1) % 3 !== 0 ||
          i.curve.some(
            (p) =>
              !Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite),
          ))
      )
        throw Error("Ongeldige 2D-membraancurve.");
    }
  }
  if (
    !p.camera ||
    ![...p.camera.position, ...p.camera.target, p.camera.zoom].every(
      Number.isFinite,
    )
  )
    throw Error("Ongeldige camera.");
  const ids = new Set();
  for (const i of p.items) {
    if (ids.has(i.id)) throw Error("Dubbele object-ID");
    ids.add(i.id);
    if (
      i.kind === "structure" &&
      (!Array.isArray(i.atoms) ||
        i.atoms.length > 80000 ||
        i.atoms.some((a) => ![a.x, a.y, a.z].every(Number.isFinite)))
    )
      throw Error("Ongeldige atoomcoördinaten.");
    if (
      ["svg", "svg3d"].includes(i.kind) &&
      !i.url?.startsWith("data:image/svg+xml;base64,")
    )
      throw Error("SVG moet in het project zijn ingesloten.");
    if (
      i.kind === "glb" &&
      !i.url?.startsWith("data:model/gltf-binary;base64,")
    )
      throw Error("GLB moet in het project zijn ingesloten.");
    if (
      i.level != null &&
      (!Number.isInteger(i.level) || i.level < 0 || i.level > 3)
    )
      throw Error("Ongeldig diepteniveau.");
    if (
      !["s", "depth", "x", "y", "z", "scale", "rotation", "hinge"].every((k) =>
        Number.isFinite(i[k]),
      ) ||
      i.scale <= 0 ||
      i.scale > 50
    )
      throw Error("Ongeldige objecttransformatie.");
  }
  if (
    !Array.isArray(p.keys) ||
    p.keys.some(
      (k) =>
        !Number.isFinite(k.time) ||
        !k.state?.camera ||
        !Array.isArray(k.state?.items),
    )
  )
    throw Error("Ongeldige tijdlijn");
  for (const key of p.keys) {
    if (
      key.time < 0 ||
      key.time > p.duration ||
      ![
        ...key.state.camera.position,
        ...key.state.camera.target,
        key.state.camera.zoom,
      ].every(Number.isFinite)
    )
      throw Error("Ongeldig sleutelbeeld.");
    for (const item of key.state.items)
      if (
        !["s", "depth", "x", "y", "z", "rotation", "scale", "hinge"].every(
          (k) => Number.isFinite(item[k]),
        )
      )
        throw Error("Ongeldige animatietransformatie.");
  }
  return p;
}
export function validateStyle(s) {
  if (["UMCU · Hyderabad", "UMCU Hyderabad"].includes(s?.name))
    s.name = "UMC Utrecht";
  for (const k of Object.keys(presets.basis).filter((x) => x !== "name"))
    if (!/^#[0-9a-f]{6}$/i.test(s?.[k]))
      throw Error(`Ongeldige stijlkleur: ${k}`);
  return s;
}
