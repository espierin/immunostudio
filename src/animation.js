export function animationOptions(project) {
  return {
    fps: 24,
    startFrame: 1,
    endFrame: Math.round(project.duration * 24),
    frameStep: 1,
    width: 1920,
    height: 1080,
    interpolation: "bezier",
    keyScope: "all",
    autoKey: false,
    loop: false,
    ...project.animation,
  };
}
export function interpolationAmount(u, mode = "linear") {
  if (mode === "constant") return u >= 1 ? 1 : 0;
  if (mode === "bezier") return u * u * (3 - 2 * u);
  return u;
}
function sample(keys, time, mode) {
  keys = [...new Map(keys.map((k) => [k.time, k])).values()].sort(
    (a, b) => a.time - b.time,
  );
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
  const u = a === b ? 0 : (time - a.time) / (b.time - a.time);
  return { a, b, t: interpolationAmount(u, a.interpolation || mode) };
}
export function evaluateTimeline(p, time, { frame, effectiveDepth }) {
  const out = {
    ...p,
    items: p.items.map((i) => ({ ...i })),
    camera: structuredClone(p.camera),
  };
  if (!p.keys.length) return out;
  const mode = p.animation?.interpolation || "linear",
    mix = (x, y, t) => x + (y - x) * t;
  for (const item of out.items) {
    const keys = p.keys.filter((k) =>
      k.state.items.some((i) => i.id === item.id),
    );
    if (!keys.length) continue;
    const { a, b, t } = sample(keys, time, mode),
      x = a.state.items.find((i) => i.id === item.id),
      y = b.state.items.find((i) => i.id === item.id);
    for (const key of [
      "s",
      "depth",
      "x",
      "y",
      "z",
      "rotation",
      "scale",
      "hinge",
      "rotationX",
      "rotationY",
    ])
      item[key] = mix(x[key] || 0, y[key] || 0, t);
    if (Number.isInteger(x.level) || Number.isInteger(y.level)) {
      const dx = effectiveDepth(p, { ...item, ...x }),
        dy = effectiveDepth(p, { ...item, ...y });
      item.level = null;
      if (item.anchored) item.depth = mix(dx, dy, t);
      else item.z = mix(dx, dy, t);
    }
    item.visible = t < 0.5 ? x.visible : y.visible;
  }
  const cameraKeys = p.keys.filter((k) => k.scope !== "selected");
  if (cameraKeys.length) {
    const { a, b, t } = sample(cameraKeys, time, mode),
      x = a.state.camera,
      y = b.state.camera;
    out.camera = {
      ...x,
      position: x.position.map((v, i) => mix(v, y.position[i], t)),
      target: x.target.map((v, i) => mix(v, y.target[i], t)),
      zoom: mix(x.zoom, y.zoom, t),
    };
  }
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
export function framePlan(project, overrides = {}) {
  const s = { ...animationOptions(project), ...overrides };
  if (![12, 24, 25, 30, 50, 60].includes(s.fps))
    throw Error("Choose 12, 24, 25, 30, 50 or 60 fps.");
  if (
    ![s.startFrame, s.endFrame, s.frameStep, s.width, s.height].every(
      Number.isFinite,
    ) ||
    s.startFrame < 1 ||
    s.endFrame < s.startFrame ||
    s.frameStep < 1 ||
    s.endFrame > s.fps * project.duration + 1 ||
    s.width < 320 ||
    s.width > 3840 ||
    s.height < 240 ||
    s.height > 2160 ||
    ![s.startFrame, s.endFrame, s.frameStep, s.width, s.height].every(
      Number.isInteger,
    )
  )
    throw Error("Invalid frame range.");
  if (Math.floor((s.endFrame - s.startFrame) / s.frameStep) + 1 > 1801)
    throw Error("Maximum 1801 output frames.");
  const frames = [];
  for (
    let f = Math.round(s.startFrame);
    f <= s.endFrame;
    f += Math.round(s.frameStep)
  )
    frames.push({ frame: f, time: (f - 1) / s.fps });
  if (frames.length > 1801) throw Error("Maximum 1801 output frames.");
  return { ...s, frames };
}
export function addTimelineKey(
  project,
  time,
  state,
  scope = "all",
  selectedId,
) {
  if (scope === "selected")
    state = { ...state, items: state.items.filter((i) => i.id === selectedId) };
  if (scope === "selected" && !state.items.length)
    throw Error("Select an object to animate.");
  if (scope === "camera") state = { ...state, items: [] };
  project.keys = project.keys.filter(
    (k) =>
      !(
        Math.abs(k.time - time) < 0.00001 &&
        (k.scope || "all") === scope &&
        (scope !== "selected" || k.targetId === selectedId)
      ),
  );
  project.keys.push({
    time,
    state,
    scope,
    targetId: scope === "selected" ? selectedId : undefined,
    interpolation: animationOptions(project).interpolation,
  });
  project.keys.sort((a, b) => a.time - b.time);
}
export function createCameraAction(project, state, action) {
  const options = animationOptions(project),
    start = (options.startFrame - 1) / options.fps,
    end = (options.endFrame - 1) / options.fps,
    base = structuredClone(state.camera),
    target = base.target,
    offset = base.position.map((v, i) => v - target[i]);
  const count = action === "orbit" ? 32 : 1;
  project.keys = project.keys.filter(
    (k) => k.scope !== "camera" || k.time < start || k.time > end,
  );
  for (let i = 0; i <= count; i++) {
    const u = i / count,
      camera = structuredClone(base);
    camera.mode = "free";
    delete camera.anchorId;
    if (action === "orbit") {
      const a = u * Math.PI * 2;
      camera.position = [
        target[0] + offset[0] * Math.cos(a) + offset[2] * Math.sin(a),
        base.position[1],
        target[2] - offset[0] * Math.sin(a) + offset[2] * Math.cos(a),
      ];
    }
    if (action === "dolly")
      camera.position = base.position.map(
        (v, k) => target[k] + offset[k] * (1 - 0.5 * u),
      );
    if (action === "zoom") camera.zoom = base.zoom * (1 + u);
    if (action === "pan") {
      camera.position[0] += 8 * u;
      camera.target[0] += 8 * u;
    }
    addTimelineKey(
      project,
      start + (end - start) * u,
      { items: [], camera },
      "camera",
    );
    if (action === "orbit")
      project.keys.find(
        (k) =>
          k.scope === "camera" &&
          Math.abs(k.time - (start + (end - start) * u)) < 1e-8,
      ).interpolation = "linear";
  }
}
