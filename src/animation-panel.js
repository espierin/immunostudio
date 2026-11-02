import { animationOptions } from "./animation.js";
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function animationPanelHTML(project, time) {
  const o = animationOptions(project),
    number = (label, key, min, max) =>
      `<label>${label}<input type="number" data-animation="${key}" min="${min}" max="${max}" value="${o[key]}" step="1"></label>`;
  return `<p class="muted">Keyframes bepalen camera- en objectbeweging. Tussenframes worden automatisch berekend.</p><label>Framerate<select data-animation="fps">${[12, 24, 25, 30, 50, 60].map((n) => `<option value="${n}" ${o.fps === n ? "selected" : ""}>${n} fps</option>`).join("")}</select></label><div class="coordinates">${number("Startframe", "startFrame", 1, 1801)}${number("Eindframe", "endFrame", 1, 1801)}</div>${number("Framestap", "frameStep", 1, 120)}<div class="coordinates">${number("Renderbreedte", "width", 320, 3840)}${number("Renderhoogte", "height", 240, 2160)}</div><label>Interpolatie<select data-animation="interpolation">${[
    ["constant", "Constant"],
    ["linear", "Lineair"],
    ["bezier", "Vloeiend · Bézier"],
  ]
    .map(
      ([v, l]) =>
        `<option value="${v}" ${o.interpolation === v ? "selected" : ""}>${l}</option>`,
    )
    .join(
      "",
    )}</select></label><label>Keyframe voor<select data-animation="keyScope">${[
    ["all", "Scène en camera"],
    ["selected", "Geselecteerd object"],
    ["camera", "Alleen camera"],
  ]
    .map(
      ([v, l]) =>
        `<option value="${v}" ${o.keyScope === v ? "selected" : ""}>${l}</option>`,
    )
    .join(
      "",
    )}</select></label><label class="check"><input type="checkbox" data-animation="autoKey" ${o.autoKey ? "checked" : ""}> Automatische keyframes</label><label class="check"><input type="checkbox" data-animation="loop" ${o.loop ? "checked" : ""}> Herhalen</label><button data-action="keyframe">Keyframe invoegen</button><strong>Camera-acties</strong><div class="drawing-grid">${[
    ["orbit", "Orbit 360°"],
    ["dolly", "Dolly naar focus"],
    ["zoom", "Zoom naar focus"],
    ["pan", "Pan horizontaal"],
  ]
    .map(([a, l]) => `<button data-camera-action="${a}">${l}</button>`)
    .join(
      "",
    )}</div><button data-action="turn-object">Object 360° draaien</button><p class="muted">Huidig frame: ${Math.round(time * o.fps) + 1}. Camera-acties gebruiken het renderbereik.</p><div class="keyframe-list">${project.keys.map((key, index) => `<div class="keyframe-row"><input aria-label="Keyframe frame" type="number" min="1" max="1801" data-key-time="${index}" value="${Math.round(key.time * o.fps) + 1}"><span data-no-translate>${escape(key.scope === "camera" ? "Camera" : key.scope === "selected" ? project.items.find((i) => i.id === key.targetId)?.name || "Object" : "Scene")}</span><select aria-label="Keyframe interpolation" data-key-interpolation="${index}">${["constant", "linear", "bezier"].map((v) => `<option ${v === (key.interpolation || o.interpolation) ? "selected" : ""}>${v}</option>`).join("")}</select><button data-key-delete="${index}" title="Keyframe verwijderen">×</button></div>`).join("")}</div>`;
}
