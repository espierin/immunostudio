import { splitBezier } from "./model.js";
import { decorateUI } from "./ui-icons.js";
import { installI18n } from "./i18n.js";
import { sheetToVolume } from "./basis-variants.js";
import { Drawing2D, newSheet } from "./drawing2d.js";
import "./drawing2d.css";
import { applyUITheme } from "./palettes.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { Vector2 } from "three";
import "./style.css";
import "./umcu-ui.css";
import { StudioScene } from "./scene.js";
import {
  clone,
  uid,
  presets,
  catalog,
  newProject,
  removeLegacyStarter,
  makeItem,
  curveValid,
  frame,
  effectiveDepth,
  validateProject,
  validateStyle,
  snapshot,
  evaluate,
} from "./model.js";
import {
  parsePDB,
  parseCIF,
  centeredAtoms,
  searchStructures,
} from "./structures.js";
import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const icons = {
  hla: "◒",
  hla2: "◓",
  tcr: "⋎",
  igg: "Y",
  pd1: "♧",
  pdl1: "♧",
  channel: "◉",
  svg: "▧",
  svg3d: "⬡",
  structure: "✣",
  glb: "⬡",
  arrow: "↗",
};
let basisRepresentation = "volume";
let ownModels = [];
let structurePreview = null;
let exportCancelled = false;
let project = newProject(),
  selected = null,
  mode = "select",
  library = [],
  tab = "models",
  query = "",
  category = "",
  page = 0,
  time = 0,
  playing = false,
  playStart = 0,
  undo = [],
  redo = [],
  dirty = false,
  recording = false,
  structures = null,
  db = null;
const qaMode = new URLSearchParams(location.search).has("qa");
const request = indexedDB.open(qaMode ? "immunostudio-qa" : "immunostudio", 2);
request.onupgradeneeded = () => {
  if (!request.result.objectStoreNames.contains("projects"))
    request.result.createObjectStore("projects");
  if (!request.result.objectStoreNames.contains("models"))
    request.result.createObjectStore("models", { keyPath: "libraryId" });
};
request.onsuccess = () => {
  db = request.result;
  db.onversionchange = () => {
    db.close();
    db = null;
    toast(
      "Lokale opslag is bijgewerkt. Download je project en herlaad dit tabblad.",
    );
  };
  const modelsRequest = db.transaction("models").objectStore("models").getAll();
  modelsRequest.onsuccess = () => {
    ownModels = modelsRequest.result;
    renderLibrary();
  };
  const tx = db.transaction("projects").objectStore("projects").get("autosave");
  tx.onsuccess = () => {
    if (tx.result && !dirty && undo.length === 0) {
      try {
        project = validateProject(tx.result);
        const removedStarter = removeLegacyStarter(project);
        project.editorMode = "2d";
        selected = project.items[0]?.id;
        refresh();
        $("#save-state").textContent = "✓ Op dit apparaat bewaard";
        toast("Lokaal project hersteld");
        if (removedStarter) autosave();
      } catch {
        toast("Opgeslagen project kon niet worden hersteld.");
      }
    }
    if (dirty) autosave();
  };
};
request.onblocked = () =>
  toast("Sluit oudere ImmunoStudio-tabbladen om lokale opslag bij te werken.");
request.onerror = () =>
  toast(
    "Lokale opslag is niet beschikbaar. Download je project om het te bewaren.",
  );
document.querySelector("#app").innerHTML = `
<header><a class="brand" href="#"><img class="brandmark" src="./immunostudio-icon.svg" alt="" width="44" height="44"><div>ImmunoStudio<small>SCIENTIFIC ILLUSTRATION STUDIO</small></div></a><div class="project-title"><input id="project-name" aria-label="Projectnaam"><span id="save-state">Lokaal project</span></div><label class="labels-toggle"><input id="all-labels" type="checkbox" checked> Labels</label><div class="editor-mode-switch"><button data-editor-mode="2d">2D</button><button data-editor-mode="3d" class="active">3D</button></div><label class="language-switch"><span class="visually-hidden">Interface-taal</span><select id="interface-language" aria-label="Interface-taal" title="Interface-taal"><option value="nl">Nederlands</option><option value="en">English</option></select></label><div class="header-actions"><button data-action="new" title="Nieuw project">Nieuw</button><button data-action="open">Openen</button><button data-action="save">↓ Project</button><button class="primary" data-action="export">Exporteren ↗</button></div></header>
<nav class="toolbar"><div class="toolgroup"><button data-action="undo" title="Ongedaan maken (Ctrl+Z)">↶</button><button data-action="redo" title="Opnieuw (Ctrl+Shift+Z)">↷</button></div><div class="toolgroup modes"><button data-mode="select">↖ Selecteren</button><button data-mode="curve">⌁ Membraan</button><button data-mode="move">✥ Verplaatsen</button><button data-mode="rotate">⟳ Draaien</button><button data-mode="hinge">⤷ Conformatie</button></div><div class="toolgroup"><button data-action="label">T Label</button><button data-action="arrow">↗ Pijl</button></div><span class="toolbar-note">3D werkplaats <span class="dot"></span> lokaal op dit apparaat</span><button data-action="help">? Handleiding</button></nav>
<main><aside class="library"><div class="panel-head"><h2>Bibliotheek</h2><button data-action="import" title="Eigen SVG, GLB, PDB of mmCIF importeren">＋</button></div><div class="tabs"><button data-tab="models">3D-modellen</button><button data-tab="basis">Basis set</button><button data-tab="pdb">PDB</button></div><div class="search-wrap"><span>⌕</span><input id="search" placeholder="Zoek een molecuul…" aria-label="Bibliotheek doorzoeken"></div><select id="category" aria-label="Categorie"><option value="">Alle categorieën</option></select><select id="basis-representation" aria-label="Basisweergave" hidden><option value="volume">3D · afgerond volume</option><option value="relief">3D · reliëf</option><option value="flat">Originele 2D-vector</option></select><div id="library-info" class="library-info"></div><div id="library-items"></div><div id="pagination"></div><div class="library-footer"><span class="dot"></span> Jouw vormen. Eén werkplaats.<small>Basis set 2026 · native SVG + 3D</small></div></aside>
<section class="workspace"><div class="sheet-toolbar"><button data-action="undo">↶</button><button data-action="redo">↷</button><span class="tool-divider"></span><button data-sheet-tool="select">↖ Selecteren</button><button data-sheet-tool="move">✥ Verplaatsen</button><button data-sheet-tool="rotate">⟳ Draaien</button><button data-sheet-tool="pan">✥ Pan</button><button data-sheet-tool="text">T Tekst</button><button data-sheet-tool="arrow">↗ Pijl</button><button data-sheet-tool="line">╱ Lijn</button><button data-sheet-tool="rect">▭ Kader</button><button data-sheet-tool="ellipse">◯ Ellips</button><button data-sheet-tool="membrane">⌁ Membraan</button><button data-sheet-tool="freehand">⌁ Tekenen</button><button data-action="create-all-3d-variants" title="Maak 3D-varianten van alle vectorbouwstenen op dit blad">⬡ Alles naar 3D</button><button data-sheet-action="fit">Pas blad</button><button data-sheet-action="zoom-out">−</button><button data-sheet-action="zoom-in">＋</button><button data-action="properties">⚙</button></div><div class="view-toolbar"><span id="scene-title">MEMBRAANSCÈNE</span><div><button data-action="focus">◎ Focus selectie</button><button data-action="reset-camera">⌂ Standaardzicht</button><button class="inspector-toggle" data-action="properties">⚙ Eigenschappen</button><button id="cut-toggle" data-action="cut">◐ Doorsnede aan</button></div></div><div id="viewport"><div id="drawing2d" hidden></div><div class="scene-badge">ORTHOGRAFISCH <span>·</span> ECHTE 3D</div><div class="compartment top">EXTRACELLULAIR</div><div class="compartment bottom">CYTOPLASMA</div><div class="scene-hint" id="scene-hint">Slepen: kijkhoek · rechtermuisknop: pan · scrollen: zoom</div><div class="axis"><b>Y</b><span>└── X</span><small>Z ↙</small></div></div><section class="timeline"><div class="timeline-head"><div><button id="play" data-action="play" aria-label="Animatie afspelen">▶</button><span id="time-readout">0.00 / 8.00 s</span></div><div><button data-action="keyframe">◇ Sleutelbeeld</button><label>Duur <input id="duration" type="number" min="1" max="30" step="1"> s</label><button data-action="delete-key">Verwijder key</button></div></div><div class="timeline-track"><span>SCÈNE & CAMERA</span><div class="ruler"><div id="keyframes"></div><input id="scrubber" type="range" min="0" max="8" step="0.01" value="0" aria-label="Animatietijd"></div></div></section></section>
<aside class="inspector"><div class="panel-head"><h2>Eigenschappen</h2><span id="selection-type">MODEL</span></div><div id="properties"></div><details open><summary>Membraan</summary><div class="details-body"><label>Dikte <span>nm</span><input data-project="thickness" type="range" min=".6" max="3" step=".1"></label><label>Diepte <span>nm</span><input data-project="depth" type="range" min="4" max="24" step="1"></label><label>Vervaging achterzijde<input data-project="fade" type="range" min="0" max=".85" step=".05"></label><button data-mode="curve" class="wide">⌁ Béziercurve bewerken</button><button data-action="add-curve" class="wide">＋ Curvepunt toevoegen</button><div id="curve-fields"></div></div></details><details><summary>Camera & focus</summary><div class="details-body"><label>Projectie<select id="projection"><option value="orthographic">Orthografisch</option><option value="perspective">Perspectief</option></select></label><label>Focusgedrag<select id="camera-mode"><option value="follow">Follow-me · verplaats mee</option><option value="look">Kijk naar focus</option><option value="free">Vrije camera</option></select></label><label>Zoom<input id="camera-zoom" type="number" min=".3" max="8" step=".1" value="1"></label><div class="view-buttons">${["Voor", "Achter", "Links", "Rechts", "Boven", "Onder"].map((v) => `<button data-view="${v}">${v}</button>`).join("")}</div><button class="wide" data-action="focus">◎ Gebruik selectie als focuspunt</button></div></details><details open><summary>Stylesheet</summary><div class="details-body"><select id="style-preset" aria-label="Stylesheet"><option value="basis">Basis set 2026</option><option value="light">Illustrated Light</option><option value="dark">Dark Presentation</option><option value="custom">Eigen stylesheet</option></select><div class="swatches" id="swatches"></div><div class="row"><button data-action="style-import">Importeren</button><button data-action="style-export">↓ JSON</button></div></div></details><details open><summary>Scène <span id="object-count"></span></summary><div id="scene-tree"></div></details></aside></main>
<footer><span id="status">Gereed</span><span id="scene-meta"></span><span>ImmunoStudio · v0.1</span></footer><div id="toast" role="status"></div><div id="export-progress" hidden><span>Export voorbereiden…</span><progress max="1" value="0"></progress><button data-action="cancel-export">Annuleren</button></div><dialog id="modal"><div id="modal-content"></div></dialog><input id="file-input" type="file" hidden><input id="project-input" type="file" accept=".immuno,.json,.zip" hidden><input id="style-input" type="file" accept=".json" hidden>`;
const view = new StudioScene(
  $("#viewport"),
  (id, pivot) => {
    selected = id;
    if (mode === "hinge" && pivot) {
      const item = project.items.find((i) => i.id === id);
      if (item?.kind === "igg") {
        checkpoint();
        item.pivot = pivot;
        item.hinge = 0;
        item.domain = pivot[0] < 0 ? "left" : "right";
        toast("Scharnier gekozen. Draai de geselecteerde Fab-arm rechts.");
        changed();
      }
    }
    renderInspector();
    view.select(id);
  },
  (c) => {
    project.camera = c;
    autosave();
  },
  (data, phase) => {
    if (phase === "start") checkpoint();
    if (phase === "move") {
      const curve = clone(project.curve);
      curve[data[0]] = [
        Math.round(data[1] * 100) / 100,
        Math.round(data[2] * 100) / 100,
      ];
      if (curveValid(curve, project.thickness)) {
        project.curve = curve;
        followAnchor();
        view.build(project);
        renderCurve();
        dirty = true;
      } else
        toast(
          "Bocht te scherp of curve loopt terug; laatste geldige vorm blijft staan.",
        );
    }
    if (phase === "end") {
      changed();
    }
  },
  (id, pos, rot, xyz) => {
    const item = project.items.find((i) => i.id === id);
    if (item && !item.anchored) {
      checkpoint();
      [item.x, item.y, item.z] = pos;
      item.level = null;
      item.rotation = rot;
      if (xyz) {
        item.rotationX = xyz[0];
        item.rotationY = xyz[1];
      }
      changed();
    }
  },
);
const drawing2D = new Drawing2D($("#drawing2d"), {
  beforeChange: checkpoint,
  onChange: (sheet) => {
    project.sheet = sheet;
    changed(false);
  },
  onSelect: () => {
    if (project.editorMode === "2d") renderInspector();
  },
  onStatus: (message) => ($("#status").textContent = message),
});
for (const el of [...document.querySelectorAll(".inspector>details")].slice(
  0,
  2,
))
  el.classList.add("three-properties");
view.onAddCurve = (t) => {
  try {
    checkpoint();
    project.curve = splitBezier(project.curve, t);
    changed();
  } catch (e) {
    toast(e.message);
  }
};
view.onError = toast;
view.onStatus = (message) => ($("#status").textContent = message);
view.onAssetReady = (id) => {
  if (id === selected) renderInspector();
};
view.onHinge = (id, angle) => {
  const item = project.items.find((i) => i.id === id);
  if (item) {
    checkpoint();
    item.hinge = Math.round(Math.max(-50, Math.min(90, angle)));
    changed();
  }
};
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("#toast").classList.remove("show"), 4200);
  $("#status").textContent = message;
}
function checkpoint() {
  undo.push(clone(project));
  if (undo.length > 35) undo.shift();
  redo = [];
}
function changed(rebuild = true) {
  dirty = true;
  followAnchor();
  if (rebuild && project.editorMode !== "2d") view.build(project);
  if (project.editorMode === "2d")
    drawing2D.setDocument(
      project.sheet,
      project.style,
      project.labelsVisible !== false,
    );
  renderInspector();
  renderTimeline();
  autosave();
}
function followAnchor() {
  const id = project.camera.anchorId;
  if (!id || project.camera.mode === "free") return;
  const item = project.items.find((i) => i.id === id);
  if (!item) {
    delete project.camera.anchorId;
    return;
  }
  const next = item.anchored
    ? frame(project, item).position
    : [item.x, item.y, effectiveDepth(project, item)];
  const old = project.camera.target;
  if (project.camera.mode !== "look")
    project.camera.position = project.camera.position.map(
      (x, k) => x + next[k] - old[k],
    );
  project.camera.target = next;
  view.setCamera(project.camera);
}
function autosave() {
  project.currentTime = time;
  clearTimeout(autosave.timer);
  $("#save-state").textContent = "Wijzigingen opslaan…";
  autosave.timer = setTimeout(() => {
    if (!db) {
      $("#save-state").textContent = "Download project om te bewaren";
      return;
    }
    try {
      const tx = db.transaction("projects", "readwrite");
      tx.objectStore("projects").put(clone(project), "autosave");
      tx.oncomplete = () => {
        $("#save-state").textContent = "✓ Op dit apparaat bewaard";
        dirty = false;
      };
      tx.onerror = () => toast("Lokale opslag vol. Download je project.");
    } catch {
      toast("Automatisch bewaren mislukt. Download het project.");
    }
  }, 500);
}
function refresh() {
  time = Math.max(0, Math.min(project.duration, project.currentTime || 0));
  view.build(project);
  view.setCamera(project.camera);
  $("#project-name").value = project.name;
  $("#duration").value = project.duration;
  renderInspector();
  renderTimeline();
  renderLibrary();
  setMode(mode);
  setEditorMode(project.editorMode || "2d", false);
}
function setMode(next) {
  mode = next;
  view.setMode(next);
  document
    .querySelectorAll("[data-mode]")
    .forEach((b) => b.classList.toggle("active", b.dataset.mode === next));
  $("#scene-hint").textContent =
    next === "curve"
      ? "Sleep de blauwe eindpunten en oranje Bézierhandvatten."
      : next === "hinge"
        ? "Klik een scharnierpunt op IgG. Sleep de rotatiering om de geselecteerde Fab-arm te draaien."
        : next === "move"
          ? "Vrij object: sleep de 3D-pijlen. Membraaneiwit: gebruik Positie langs membraan."
          : "Slepen: kijkhoek · rechtermuisknop: pan · scrollen: zoom";
  renderCurve();
}
function renderLibrary() {
  $("#basis-representation").hidden = tab !== "basis";
  document
    .querySelectorAll("[data-tab]")
    .forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  $("#category").hidden = tab === "pdb";
  $("#search").placeholder =
    tab === "pdb"
      ? "Naam, UniProt of PDB-ID…"
      : tab === "basis"
        ? "Zoek Nederlands of Engels…"
        : "Zoek een molecuul…";
  const data =
    tab === "basis"
      ? library
      : [
          ...catalog,
          ...ownModels.map((i) => ({ ...i, category: "Eigen modellen" })),
        ];
  const categories = [...new Set(data.map((c) => c.category))].sort();
  $("#category").innerHTML =
    '<option value="">Alle categorieën</option>' +
    categories
      .map(
        (c) => `<option ${c === category ? "selected" : ""}>${esc(c)}</option>`,
      )
      .join("");
  if (tab === "pdb") {
    $("#library-info").textContent = "Zoek een structuurtemplate bij RCSB PDB.";
    $("#library-items").innerHTML =
      '<p class="muted">Zoek op naam of typ een PDB-ID. Kies vervolgens assemblage en ketens.</p><button data-action="pdb-search" class="primary wide">Zoek structuren ↗</button><div id="pdb-results"></div>';
    $("#pagination").innerHTML = "";
    return;
  }
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const results = data.filter(
    (c) =>
      (!category || c.category === category) &&
      words.every((w) =>
        (c.name + " " + c.title + " " + c.keywords + " " + c.category)
          .toLowerCase()
          .includes(w),
      ),
  );
  const size = tab === "basis" ? 24 : 20;
  page = Math.min(page, Math.max(0, Math.ceil(results.length / size) - 1));
  $("#library-info").textContent =
    tab === "basis"
      ? `${results.length} losse elementen · 2D en 3D`
      : `${results.length} modellen · cartoons en eigen structuren`;
  $("#library-items").innerHTML =
    results
      .slice(page * size, (page + 1) * size)
      .map((c) =>
        tab === "basis"
          ? `<button class="asset-card" data-asset="${esc(c.file)}"><img loading="lazy" src="${assetUrl(c.file)}" alt=""><span>${esc(c.title)}<small>${esc(c.category)}</small></span><b>＋</b></button>`
          : `<button class="model-card" ${c.libraryId ? `data-user="${c.libraryId}"` : `data-add="${c.kind}"`}><span class="model-icon ${c.kind}">${icons[c.kind]}</span><span>${esc(c.name)}<small>${esc(c.category)}</small></span><b>＋</b></button>`,
      )
      .join("") || '<p class="muted">Geen resultaten.</p>';
  $("#pagination").innerHTML =
    results.length > size
      ? `<button data-action="prev" ${page === 0 ? "disabled" : ""}>←</button><span>${page + 1} / ${Math.ceil(results.length / size)}</span><button data-action="next" ${(page + 1) * size >= results.length ? "disabled" : ""}>→</button>`
      : "";
}
function assetUrl(file) {
  return "./library/" + file.split("/").map(encodeURIComponent).join("/");
}
function renderCurve() {
  $("#curve-fields").innerHTML =
    mode === "curve"
      ? `<p class="muted">${(project.curve.length - 1) / 3 + 1} curvepunten · x / y (nm) · dubbelklik om te splitsen</p>${project.curve.map((p, i) => `<div class="coordinate-row"><span>P${i}</span>${p.map((n, k) => `<input type="number" step=".25" value="${n}" data-curve="${i},${k}" aria-label="Punt ${i} ${k ? "y" : "x"}">`).join("")}</div>`).join("")}`
      : "";
}
function itemColor(item) {
  const role =
    {
      hla: "hla",
      hla2: "hla",
      tcr: "receptor",
      igg: "antibody",
      channel: "channel",
      pd1: "receptor",
      pdl1: "hla",
      label: "label",
    }[item.kind] || "receptor";
  return item.color || project.style[role];
}
function num(label, key, value, min, max, step = ".1") {
  return `<label>${label}<input data-item="${key}" type="number" value="${value}" min="${min}" max="${max}" step="${step}"></label>`;
}
function renderInspector() {
  $("#all-labels").checked = project.labelsVisible !== false;
  applyUITheme(project.style);
  $("#style-preset").innerHTML =
    Object.entries(presets)
      .map(([key, s]) => `<option value="${key}">${esc(s.name)}</option>`)
      .join("") + '<option value="custom">Eigen stylesheet</option>';
  const i = project.items.find((x) => x.id === selected);
  $("#selection-type").textContent = ["svg", "svg3d"].includes(i?.kind)
    ? "SVG"
    : i?.kind === "structure"
      ? "PDB"
      : "3D";
  $("#properties").innerHTML = i
    ? `<div class="selected-card"><span class="model-icon ${i.kind}">${icons[i.kind] || "◇"}</span><div><strong>${esc(i.name)}</strong><small>${i.kind === "structure" ? esc(i.source || "Lokale structuur") : i.kind === "svg" ? "Basis set 2026 · vlakke bouwsteen" : i.kind === "glb" ? "Eigen 3D-asset" : "Schematisch 3D-model"}</small></div></div><div class="details-body"><label>Naam<input data-item="name" value="${esc(i.name)}"></label>${
        !["svg", "glb", "arrow"].includes(i.kind)
          ? `<label>Weergave<select data-item="representation">${(i.kind ===
            "svg3d"
              ? [
                  ["volume", "Afgerond 3D-volume"],
                  ["relief", "3D-reliëf"],
                ]
              : i.kind === "structure"
                ? [
                    ["atoms", "Atomen · van der Waals"],
                    ["backbone", "Ruggengraat"],
                  ]
                : [
                    ["cartoon", "Geïllustreerde cartoon"],
                    ["surface", "Gelobde schematische vorm"],
                  ]
            )
              .map(
                ([v, l]) =>
                  `<option value="${v}" ${i.representation === v ? "selected" : ""}>${l}</option>`,
              )
              .join("")}</select></label>`
          : ""
      }<label>Diepteniveau<select data-item="level">${[
        ["0", "Vooraan"],
        ["1", "Midden-voor"],
        ["2", "Midden-achter"],
        ["3", "Achteraan"],
        ["custom", "Vrije diepte"],
      ]
        .map(
          ([v, l]) =>
            `<option value="${v}" ${String(i.level ?? "custom") === v ? "selected" : ""}>${l}</option>`,
        )
        .join(
          "",
        )}</select></label>${i.anchored ? `<label>Positie langs membraan <output>${Math.round(i.s * 100)}%</output><input data-item="s" type="range" min=".04" max=".96" step=".005" value="${i.s}"></label>${num("Dieptepositie (nm)", "depth", effectiveDepth(project, i), -project.depth / 2, project.depth / 2)}` : `<div class="coordinates">${num("X", "x", i.x, -100, 100)}${num("Y", "y", i.y, -100, 100)}${num("Z", "z", effectiveDepth(project, i), -100, 100)}</div>`}${num("Schaalfactor · illustratief", "scale", i.scale, 0.1, 10)}<label>Rotatie <output>${Math.round((i.rotation * 180) / Math.PI)}°</output><input data-item="rotation" type="range" min="-6.283" max="6.283" step=".01" value="${i.rotation}"></label>${i.kind !== "svg" ? `<div class="row"><label class="inline">Kleur <input type="color" data-item="color" value="${itemColor(i)}"></label><button data-action="reset-color">Stijlkleur</button></div><label class="check"><input type="checkbox" data-item="label" ${i.label ? "checked" : ""}> Label tonen</label>` : ""}${i.kind === "igg" ? `<div class="hinge-box"><strong>⤷ Conformatie</strong><p>Kies een scharnierpunt op het model en draai de Fab-arm.</p><button data-mode="hinge">Scharnier aanklikken</button><label>Bewegend deel<select data-item="domain"><option value="left" ${i.domain === "left" ? "selected" : ""}>Fab links</option><option value="right" ${i.domain !== "left" ? "selected" : ""}>Fab rechts</option></select></label><label>Scharnierhoek <output>${i.hinge}°</output><input data-item="hinge" type="range" min="-50" max="90" step="1" value="${i.hinge}"></label><small>Vast deel en anker blijven behouden. Schematische domeinrotatie.</small><button data-action="reset-hinge">Bronconformatie</button></div>` : ""}${["pd1", "pdl1", "hla", "hla2", "tcr", "channel", "structure", "glb"].includes(i.kind) ? `<button data-action="anchor" class="wide">${i.anchored ? "Membraan losmaken" : "Koppelen aan membraan"}</button>${i.kind === "structure" || i.kind === "glb" ? '<p class="muted">Koppelen gebruikt modelorigine als handmatig anker. Controleer oriëntatie en transmembrangrens.</p>' : ""}` : ""}${basisControls(i)}<button class="wide" data-action="save-model">＋ Bewaar in eigen bibliotheek</button><div class="row"><button data-action="duplicate">Dupliceren</button><button data-action="delete" class="danger">Verwijderen</button></div></div>`
    : '<p class="muted empty">Selecteer een object in de scène of voeg een bouwsteen toe.</p>';
  document
    .querySelectorAll("[data-project]")
    .forEach((el) => (el.value = project[el.dataset.project]));
  $("#cut-toggle").textContent = `◐ Doorsnede ${project.cut ? "aan" : "uit"}`;
  $("#cut-toggle").classList.toggle("active", project.cut);
  $("#swatches").innerHTML = [
    "head",
    "tail",
    "receptor",
    "hla",
    "antibody",
    "channel",
    "background",
    "label",
  ]
    .map(
      (k) =>
        `<label title="${k}"><input type="color" data-style="${k}" value="${project.style[k]}"><span>${{ head: "Koppen", tail: "Staarten", receptor: "Receptor", hla: "HLA", antibody: "IgG", channel: "Kanaal", background: "Achtergr.", label: "Labels" }[k]}</span></label>`,
    )
    .join("");
  $("#style-preset").value =
    Object.keys(presets).find(
      (k) => JSON.stringify(presets[k]) === JSON.stringify(project.style),
    ) || "custom";
  $("#scene-tree").innerHTML = project.items
    .map(
      (o) =>
        `<div class="scene-row ${o.id === selected ? "selected" : ""}"><button data-visible="${o.id}" title="Zichtbaarheid">${o.visible ? "◉" : "○"}</button><button data-select="${o.id}"><span>${icons[o.kind] || "◇"}</span> ${esc(o.name)}</button><small>${o.anchored ? "⚓" : ""}</small></div>`,
    )
    .join("");
  $("#projection").value = project.camera.projection || "orthographic";
  $("#camera-mode").value = project.camera.mode || "follow";
  $("#camera-zoom").value = project.camera.zoom;
  $(".scene-badge").textContent =
    project.camera.projection === "perspective"
      ? "PERSPECTIEF · ECHTE 3D"
      : "ORTHOGRAFISCH · ECHTE 3D";
  $("#object-count").textContent = project.items.length;
  $("#scene-meta").textContent =
    `${project.items.length} objecten · ${project.style.name} · illustratieve schaal`;
  renderCurve();
  if (project.editorMode === "2d") {
    $("#properties").innerHTML = drawing2D.propertiesHTML();
    $("#scene-tree").innerHTML = drawing2D.layersHTML();
    $("#object-count").textContent = drawing2D.doc.items.length;
    $("#selection-type").textContent = "2D";
    $("#scene-meta").textContent =
      drawing2D.doc.items.length +
      " vectorobjecten · " +
      drawing2D.doc.width +
      " × " +
      drawing2D.doc.height +
      " px";
  }
  decorateUI();
}
function renderTimeline() {
  $("#scrubber").max = project.duration;
  $("#scrubber").value = time;
  $("#time-readout").textContent =
    `${time.toFixed(2)} / ${project.duration.toFixed(2)} s`;
  $("#keyframes").innerHTML = project.keys
    .map(
      (k, index) =>
        `<button title="Sleutelbeeld ${k.time.toFixed(2)} s" data-key="${index}" style="left:${(k.time / project.duration) * 100}%">◆</button>`,
    )
    .join("");
  $("#play").textContent = playing ? "Ⅱ" : "▶";
}
function add(kind, extra = {}) {
  if (project.items.length >= 200) {
    toast("Maximaal 200 objecten per scène.");
    return;
  }
  checkpoint();
  const item = makeItem(kind, { level: 0, ...extra });
  project.items.push(item);
  selected = item.id;
  changed();
  toast(`${item.name} toegevoegd`);
}
function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}
function showModal(html) {
  structurePreview?.dispose();
  structurePreview = null;
  $("#modal-content").innerHTML =
    `<button class="close" data-action="close" aria-label="Sluiten">×</button>${html}`;
  $("#modal").showModal();
}
function stop() {
  playing = false;
  $("#play").textContent = "▶";
}
async function action(name) {
  const i = project.items.find((x) => x.id === selected);
  switch (name) {
    case "create-3d-variant":
    case "create-all-3d-variants": {
      const sources = (
        name === "create-all-3d-variants"
          ? drawing2D.doc.items
          : drawing2D.selectedItems()
      ).filter((o) => o.kind === "svg");
      if (!sources.length)
        throw Error("Selecteer eerst een vectorbouwsteen in 2D.");
      const missing = sources.filter(
        (o) => !project.items.some((v) => v.sourceSheetId === o.id),
      );
      if (project.items.length + missing.length > 200)
        throw Error("Maximaal 200 objecten per 3D-scène.");
      checkpoint();
      for (const source of missing)
        project.items.push(sheetToVolume(source, drawing2D.doc));
      selected = project.items.find(
        (v) => v.sourceSheetId === sources[0].id,
      )?.id;
      setEditorMode("3d", false);
      changed();
      await view.waitForAssets();
      view.focus(selected);
      project.camera = view.getCamera();
      autosave();
      toast(
        `${sources.length} 3D-variant${sources.length === 1 ? "" : "en"} beschikbaar · bronvectoren behouden`,
      );
      break;
    }
    case "close":
      $("#modal").close();
      break;
    case "undo":
      if (undo.length) {
        redo.push(clone(project));
        project = undo.pop();
        refresh();
        autosave();
      }
      break;
    case "redo":
      if (redo.length) {
        undo.push(clone(project));
        project = redo.pop();
        refresh();
        autosave();
      }
      break;
    case "new":
      showModal(
        '<h2>Nieuw project</h2><p>Download je huidige project om het als apart bestand te bewaren.</p><div class="row"><button data-action="save">Huidig project downloaden</button><button class="primary" data-action="new-confirm">Lege scène starten</button></div>',
      );
      break;
    case "new-confirm":
      checkpoint();
      project = newProject();
      project.items = [];
      selected = null;
      time = 0;
      stop();
      refresh();
      autosave();
      $("#modal").close();
      break;
    case "open":
      $("#project-input").click();
      break;
    case "save": {
      project.currentTime = time;
      const files = { "project.json": strToU8(JSON.stringify(project)) };
      download(
        new Blob([zipSync(files)], { type: "application/zip" }),
        `${project.name.replace(/[^\w\- ]/g, "") || "ImmunoStudio"}.immuno`,
      );
      toast("Project inclusief eigen assets en sleutelbeelden gedownload");
      break;
    }
    case "import":
      $("#file-input").accept = ".svg,.glb,.pdb,.cif,.mmcif";
      $("#file-input").click();
      break;
    case "style-import":
      $("#style-input").click();
      break;
    case "style-export":
      download(
        new Blob([JSON.stringify(project.style, null, 2)], {
          type: "application/json",
        }),
        "ImmunoStudio-stylesheet.json",
      );
      break;
    case "reset-color":
      if (i) {
        checkpoint();
        delete i.color;
        changed();
      }
      break;
    case "focus":
      view.focus(selected);
      break;
    case "reset-camera":
      view.setCamera(newProject().camera);
      project.camera = view.getCamera();
      autosave();
      break;
    case "cut":
      checkpoint();
      project.cut = !project.cut;
      changed();
      break;
    case "make-3d":
      if (i?.kind === "svg") {
        checkpoint();
        i.kind = "svg3d";
        i.representation = "volume";
        i.volumeDepth = 1;
        changed();
      }
      break;
    case "make-2d":
      if (i?.kind === "svg3d") {
        checkpoint();
        i.kind = "svg";
        i.representation = "flat";
        changed();
      }
      break;
    case "glb-export": {
      const group = view.groups.get(selected);
      if (!group || !group.children.length)
        throw Error("Wacht tot het model is opgebouwd.");
      const asset = group.clone(true);
      asset.position.set(0, 0, 0);
      asset.rotation.set(0, 0, 0);
      asset.scale.setScalar(1);
      const bytes = await new GLTFExporter().parseAsync(asset, {
        binary: true,
        onlyVisible: true,
      });
      download(
        new Blob([bytes], { type: "model/gltf-binary" }),
        (i.name || "model") + ".glb",
      );
      toast("3D-model geëxporteerd als GLB");
      break;
    }
    case "save-model":
      if (i && db) {
        const model = { ...clone(i), libraryId: uid() };
        const tx = db.transaction("models", "readwrite");
        tx.objectStore("models").put(model);
        tx.oncomplete = () => {
          ownModels.push(model);
          renderLibrary();
          toast("Model opgeslagen in je eigen bibliotheek");
        };
      }
      break;
    case "duplicate":
      if (i) {
        checkpoint();
        const n = clone(i);
        n.id = uid();
        n.name += " kopie";
        n.s = Math.min(0.96, n.s + 0.08);
        n.x += 3;
        project.items.push(n);
        selected = n.id;
        changed();
      }
      break;
    case "delete":
      if (project.editorMode === "2d") {
        drawing2D.command("delete");
        break;
      }
      if (i) {
        checkpoint();
        project.items = project.items.filter((o) => o.id !== i.id);
        selected = project.items[0]?.id;
        changed();
      }
      break;
    case "reset-hinge":
      if (i) {
        checkpoint();
        i.hinge = 0;
        i.pivot = [0, 4.2, 0];
        changed();
      }
      break;
    case "anchor":
      if (i) {
        checkpoint();
        if (i.anchored) {
          const g = view.groups.get(i.id);
          [i.x, i.y, i.z] = g.position.toArray();
          i.rotation = g.rotation.z;
          i.anchored = false;
        } else {
          i.anchored = true;
          i.s = 0.5;
          i.depth = 0;
          i.rotation = 0;
        }
        changed();
        toast(
          i.anchored
            ? "Handmatig membraananker actief; controleer het model."
            : "Object losgemaakt",
        );
      }
      break;
    case "label":
      showModal(
        '<h2>Label toevoegen</h2><label>Tekst<input id="label-text" value="Nieuw label" maxlength="100"></label><button class="primary" data-action="add-label">Toevoegen</button>',
      );
      break;
    case "add-label":
      add("label", { name: $("#label-text").value || "Label", label: true });
      $("#modal").close();
      break;
    case "arrow":
      add("arrow", {
        name: "Signaalpijl",
        label: false,
        x: 3,
        y: 7,
        dx: 4,
        dy: 2,
      });
      break;
    case "prev":
      page--;
      renderLibrary();
      break;
    case "next":
      page++;
      renderLibrary();
      break;
    case "play":
      if (playing) {
        stop();
        break;
      }
      if (!project.keys.length) {
        toast("Leg eerst minstens twee sleutelbeelden vast.");
        break;
      }
      playing = true;
      playStart = performance.now() - time * 1000;
      if (time >= project.duration) {
        time = 0;
        playStart = performance.now();
      }
      tick();
      break;
    case "keyframe":
      checkpoint();
      project.camera = view.getCamera();
      const state = snapshot(project);
      project.keys = project.keys.filter((k) => Math.abs(k.time - time) > 0.03);
      project.keys.push({ time, state });
      project.keys.sort((a, b) => a.time - b.time);
      renderTimeline();
      autosave();
      toast(`Sleutelbeeld op ${time.toFixed(2)} s`);
      break;
    case "delete-key":
      checkpoint();
      project.keys = project.keys.filter((k) => Math.abs(k.time - time) > 0.05);
      renderTimeline();
      autosave();
      break;
    case "pdb-search":
      await pdbSearch();
      break;
    case "pdb-import":
      await loadRemoteStructure();
      break;
    case "structure-add":
      addStructure();
      break;
    case "export":
      showModal(
        '<h2>Exporteer je illustratie</h2><p>Afbeeldingen gebruiken de huidige kijkhoek, stijl en tijd.</p><label>Formaat<select id="image-size"><option value="1920">1920 px breed</option><option value="3840">3840 px breed</option></select></label><label class="check"><input id="transparent" type="checkbox"> Transparante achtergrond</label><label class="check"><input id="outline-fonts" type="checkbox" checked> Letters als vectorcontouren in EMF/WMF</label><p class="muted">EMF/WMF: 2D blijft vector. Bij 3D wordt een afbeelding ingesloten. Lettercontouren bewaren de fontweergave; het zijn geen ingesloten, bewerkbare fonts.</p><div class="export-options"><button class="primary" data-action="png">↓ PNG afbeelding</button><button data-action="svg">↓ SVG-vector</button><button data-action="emf">↓ EMF · PowerPoint / Word</button><button data-action="wmf">↓ WMF · compatibel metabestand</button><button data-action="mp4">↓ MP4 · H.264 (lokaal)</button><button data-action="avi">↓ AVI · Motion JPEG (lokaal)</button><button data-action="gif">↓ Geanimeerde GIF (lokaal)</button><button data-action="video">● WebM animatie</button><button data-action="frames">↓ PNG-framereeks (ZIP)</button></div><label>Animatie vanaf (s)<input id="export-from" type="number" min="0" max="30" step=".1" value="0"></label><label>Tot (s)<input id="export-to" type="number" min=".1" max="30" step=".1" value="${project.duration}"></label><p class="muted">MP4/AVI: 30 fps. GIF: 12 fps, 800 px breed, maximaal 15 s, oneindige herhaling. De lokale encoder houdt alle verwerking op dit apparaat.</p><p class="muted">In 2D exporteert SVG het volledige tekenblad. In 3D exporteert SVG de geselecteerde vectorbouwsteen; PNG rendert de huidige kijkhoek.</p>',
      );
      $("#export-to").value = project.duration;
      if (import.meta.env.MODE === "pages") {
        const note =
          "EMF/WMF en MP4/AVI/GIF zijn beschikbaar in de lokale desktopversie. Online kun je PNG, SVG en projectbestanden exporteren; in 3D ook WebM en PNG-frames.";
        const p = document.createElement("p");
        p.className = "muted";
        p.textContent = note;
        $("#modal .export-options").before(p);
        for (const format of ["emf", "wmf", "mp4", "avi", "gif"]) {
          const button = $(`#modal [data-action="${format}"]`);
          button.disabled = true;
          button.title = "Beschikbaar in de lokale desktopversie.";
        }
        $("#outline-fonts").disabled = true;
      }
      for (const action of ["mp4", "avi", "gif", "video", "frames"])
        $(`#modal [data-action="${action}"]`).hidden =
          project.editorMode === "2d";
      break;
    case "emf":
    case "wmf":
      await exportOffice(name);
      break;
    case "mp4":
    case "avi":
    case "gif":
      await exportNative(name);
      break;
    case "cancel-export":
      exportCancelled = true;
      toast("Export annuleren…");
      break;
    case "png":
      await exportPNG();
      break;
    case "svg":
      if (project.editorMode === "2d") {
        download(
          new Blob([drawing2D.exportSVG($("#transparent").checked)], {
            type: "image/svg+xml",
          }),
          project.name + ".svg",
        );
        toast("Bewerkbare 2D-vector geëxporteerd");
        break;
      }
      if (!["svg", "svg3d"].includes(i?.kind)) {
        toast("Selecteer eerst een SVG uit de Basis set.");
        break;
      }
      download(
        await (await fetch(i.url)).blob(),
        (i.name || "bouwsteen") + ".svg",
      );
      break;
    case "video":
      await exportVideo();
      break;
    case "frames":
      await exportFrames();
      break;
    case "help":
      showModal(
        `<h2>Je immunologische werkplaats</h2><ol><li>Voeg een 3D-model of bestaande SVG toe vanuit de bibliotheek.</li><li>Bewerk het membraan met de vier Bézierpunten. Verankerde eiwitten volgen de vorm.</li><li>Selecteer een molecuul en kies <b>Focus selectie</b>. Draai met de muis rond het anker.</li><li>Pas de representatie, kleur en positie rechts aan. Stylesheets veranderen de hele scène.</li><li>Kies <b>Conformatie</b>, klik op een IgG-arm en kies een scharnierhoek.</li><li>Leg op 0 seconden een sleutelbeeld vast. Schuif de tijd, wijzig de scène en leg het volgende vast.</li><li>Download je project en exporteer PNG of een animatie.</li></ol><p><b>Lokale opslag:</b> automatisch op dit apparaat. Download een .immuno-bestand voor overdracht en backup.</p><p><b>Modellen:</b> ingebouwde vormen zijn schematisch. PDB/mmCIF toont echte atoomcoördinaten of de ruggengraat. De Basis set bevat originele vlakke SVG’s. Geïmporteerde GLB’s behouden hun eigen geometrie.</p><p><b>Sneltoetsen:</b> Ctrl+Z ongedaan · Ctrl+Shift+Z opnieuw · Delete verwijdert selectie · Escape sluit dialoog.</p>`,
      );
      break;
    case "add-curve":
      view.onAddCurve(0.5);
      setMode("curve");
      break;
    case "properties":
      $(".inspector").classList.toggle("open");
      break;
  }
}
document.addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  try {
    if (b.dataset.editorMode) {
      setEditorMode(b.dataset.editorMode);
      return;
    }
    if (b.dataset.action) await action(b.dataset.action);
    else if (b.dataset.mode) setMode(b.dataset.mode);
    else if (b.dataset.tab) {
      tab = b.dataset.tab;
      category = "";
      query = "";
      $("#search").value = "";
      page = 0;
      renderLibrary();
    } else if (b.dataset.add) add(b.dataset.add);
    else if (b.dataset.user) {
      const model = ownModels.find((i) => i.libraryId === b.dataset.user);
      add(model.kind, { ...clone(model), id: uid() });
    } else if (b.dataset.asset) {
      const a = library.find((a) => a.file === b.dataset.asset);
      const response = await fetch(assetUrl(a.file));
      if (!response.ok) throw Error("SVG ontbreekt");
      const text = await response.text();
      if (project.editorMode === "2d") {
        drawing2D.addSVG(text, a.title, a.file);
        return;
      }
      add(basisRepresentation === "flat" ? "svg" : "svg3d", {
        representation: basisRepresentation,
        volumeDepth: 1,
        name: a.title,
        url:
          "data:image/svg+xml;base64," +
          bytesBase64(new TextEncoder().encode(text)),
        sourceFile: a.file,
        label: false,
      });
    } else if (b.dataset.select) {
      selected = b.dataset.select;
      view.select(selected);
      renderInspector();
    } else if (b.dataset.visible) {
      checkpoint();
      const i = project.items.find((i) => i.id === b.dataset.visible);
      i.visible = !i.visible;
      changed();
    } else if (b.dataset.key) {
      time = project.keys[+b.dataset.key].time;
      scrub();
    } else if (b.dataset.pdb) {
      showRemoteDialog(b.dataset.pdb);
    }
  } catch (err) {
    toast(err.message);
    console.error(err);
  }
});
$("#project-name").addEventListener("change", (e) => {
  checkpoint();
  project.name = e.target.value || "Naamloos project";
  autosave();
});
$("#search").addEventListener("input", (e) => {
  query = e.target.value;
  page = 0;
  if (tab !== "pdb") renderLibrary();
});
$("#search").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && tab === "pdb")
    pdbSearch().catch((e) => toast(e.message));
});
$("#category").addEventListener("change", (e) => {
  category = e.target.value;
  page = 0;
  renderLibrary();
});
document.addEventListener("change", (e) => {
  const el = e.target;
  try {
    if (el.dataset.item) {
      const i = project.items.find((x) => x.id === selected);
      if (!i) return;
      checkpoint();
      const key = el.dataset.item,
        val =
          el.type === "checkbox"
            ? el.checked
            : el.type === "number" || el.type === "range"
              ? +el.value
              : el.value;
      if (
        typeof val === "number" &&
        (!Number.isFinite(val) || Math.abs(val) > 1000)
      )
        throw Error("Voer een geldig getal in.");
      if (key === "scale" && (val <= 0 || val > 10))
        throw Error("Schaalfactor moet tussen 0 en 10 liggen.");
      if (key === "level") {
        i.level = val === "custom" ? null : +val;
      } else {
        i[key] = val;
        if (key === "depth" || key === "z") i.level = null;
      }
      changed();
    } else if (el.dataset.project) {
      const key = el.dataset.project;
      const val = +el.value;
      if (key === "thickness" && !curveValid(project.curve, val))
        throw Error("Te dikke membraan voor deze bocht.");
      checkpoint();
      project[key] = val;
      changed();
    } else if (el.dataset.style) {
      checkpoint();
      project.style[el.dataset.style] = el.value;
      project.style.name = "Eigen stylesheet";
      changed();
    } else if (el.dataset.curve) {
      const [i, k] = el.dataset.curve.split(",").map(Number);
      const curve = clone(project.curve);
      curve[i][k] = +el.value;
      if (!curveValid(curve, project.thickness))
        throw Error("Curve ongeldig of te scherpe bocht.");
      checkpoint();
      project.curve = curve;
      changed();
    }
  } catch (err) {
    toast(err.message);
    renderInspector();
  }
});
$("#style-preset").addEventListener("change", (e) => {
  if (presets[e.target.value]) {
    checkpoint();
    project.style = clone(presets[e.target.value]);
    changed();
  }
});
$("#duration").addEventListener("change", (e) => {
  checkpoint();
  project.duration = Math.max(1, Math.min(30, +e.target.value || 8));
  project.keys = project.keys.filter((k) => k.time <= project.duration);
  time = Math.min(time, project.duration);
  changed(false);
});
$("#scrubber").addEventListener("input", (e) => {
  stop();
  time = +e.target.value;
  scrub();
});
function scrub() {
  const p = evaluate(project, time);
  for (const pose of p.items) {
    const i = project.items.find((i) => i.id === pose.id);
    for (const k of [
      "s",
      "depth",
      "x",
      "y",
      "z",
      "rotation",
      "rotationX",
      "rotationY",
      "scale",
      "hinge",
      "visible",
      "level",
    ])
      i[k] = pose[k];
  }
  project.camera = p.camera;
  view.build(project);
  view.setCamera(project.camera);
  renderInspector();
  renderTimeline();
}
function tick() {
  if (!playing) return;
  time = Math.min(project.duration, (performance.now() - playStart) / 1000);
  const p = evaluate(project, time);
  view.applyAnimation(p);
  renderTimeline();
  if (time >= project.duration) {
    stop();
    scrub();
    return;
  }
  requestAnimationFrame(tick);
}
document.addEventListener("keydown", (e) => {
  if (["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName)) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
    e.preventDefault();
    action(e.shiftKey ? "redo" : "undo");
  } else if (e.key === "Delete") {
    e.preventDefault();
    action("delete");
  }
});
function bytesBase64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 8192)
    s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(s);
}
$("#project-input").addEventListener("change", async (e) => {
  try {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 60 * 1024 * 1024)
      throw Error("Projectbestand te groot (max. 60 MB).");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const text = file.name.endsWith(".json")
      ? strFromU8(bytes)
      : strFromU8(unzipSync(bytes)["project.json"] || new Uint8Array());
    const next = validateProject(JSON.parse(text));
    checkpoint();
    project = next;
    selected = project.items[0]?.id;
    time = 0;
    stop();
    refresh();
    autosave();
    toast("Project geopend");
  } catch (err) {
    toast("Openen mislukt: " + err.message);
  }
  e.target.value = "";
});
$("#style-input").addEventListener("change", async (e) => {
  try {
    const style = validateStyle(JSON.parse(await e.target.files[0].text()));
    checkpoint();
    project.style = style;
    changed();
    toast("Stylesheet toegepast");
  } catch (err) {
    toast(err.message);
  }
  e.target.value = "";
});
$("#file-input").addEventListener("change", async (e) => {
  try {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 30 * 1024 * 1024)
      throw Error("Bestand te groot (max. 30 MB).");
    const ext = file.name.split(".").pop().toLowerCase();
    if (project.editorMode === "2d") {
      if (ext !== "svg") throw Error("Importeer in 2D een SVG-vector.");
      drawing2D.addSVG(await file.text(), file.name);
      e.target.value = "";
      return;
    }
    if (["pdb", "cif", "mmcif"].includes(ext)) {
      const text = await file.text();
      structures = {
        ...(ext === "pdb" ? parsePDB(text) : parseCIF(text)),
        name: file.name,
        source: "Lokaal bestand",
        text,
      };
      structureDialog();
    } else if (ext === "svg") {
      const text = await file.text();
      const doc = new DOMParser().parseFromString(text, "image/svg+xml");
      if (doc.querySelector("parsererror") || !doc.querySelector("svg"))
        throw Error("Ongeldige SVG");
      if (doc.querySelector('script,foreignObject,image,use[href^="http"]'))
        throw Error(
          "Gebruik een zelfstandige vector-SVG zonder scripts of externe afbeeldingen.",
        );
      add("svg", {
        name: file.name.replace(/\.svg$/i, ""),
        label: false,
        url:
          "data:image/svg+xml;base64," +
          bytesBase64(new TextEncoder().encode(text)),
      });
    } else if (ext === "glb") {
      const bytes = new Uint8Array(await file.arrayBuffer());
      add("glb", {
        name: file.name,
        url: "data:model/gltf-binary;base64," + bytesBase64(bytes),
      });
    } else throw Error("Ondersteund: SVG, GLB, PDB en mmCIF.");
  } catch (err) {
    toast(err.message);
  }
  e.target.value = "";
});
async function pdbSearch() {
  const q = query.trim();
  if (!q) {
    toast("Typ een molecuulnaam of PDB-ID.");
    return;
  }
  if (/^[0-9][a-z0-9]{3}$/i.test(q)) {
    showRemoteDialog(q.toUpperCase());
    return;
  }
  $("#pdb-results").innerHTML = '<p class="muted">Structuren zoeken…</p>';
  try {
    const results = await searchStructures(q);
    $("#pdb-results").innerHTML =
      results
        .map(
          (r) =>
            `<button class="pdb-card" data-pdb="${r.id}"><b>${r.id}</b><span>${esc(r.title)}</span><small>${esc(r.method || "")} ${r.resolution ? "· " + r.resolution + " Å" : ""}</small></button>`,
        )
        .join("") || '<p class="muted">Geen structuren gevonden.</p>';
    if (!$("#pdb-id")) {
      /* Result click opens dialog via handler below. */
    }
  } catch (err) {
    $("#pdb-results").innerHTML =
      '<p class="muted">' +
      esc(err.message) +
      ". Probeer een PDB-ID of importeer een lokaal bestand.</p>";
  }
}
function showRemoteDialog(id) {
  showModal(
    `<h2>Structuurtemplate ophalen</h2><label>PDB-ID<input id="pdb-id" value="${esc(id)}" maxlength="12"></label><label>Assemblage<select id="assembly"><option value="1">Biologische assemblage 1</option><option value="asym">Asymmetrische eenheid</option></select></label><p class="muted">Controleer na import de relevante ketens. De volledige assemblage kan meerdere kopieën bevatten.</p><button class="primary" data-action="pdb-import">Structuur ophalen</button><div id="structure-progress"></div>`,
  );
}
async function loadRemoteStructure() {
  if (!$("#pdb-id")) return;
  const id = $("#pdb-id").value.trim().toUpperCase();
  if (!/^[A-Z0-9]{4,12}$/.test(id)) throw Error("Ongeldig PDB-ID");
  const assembly = $("#assembly")?.value || "1";
  $("#structure-progress").textContent = "Coördinaten ophalen…";
  try {
    const url =
      assembly === "asym"
        ? `https://files.rcsb.org/download/${id}.cif`
        : `https://files.rcsb.org/download/${id}-assembly${assembly}.cif`;
    const res = await fetch(url);
    if (!res.ok)
      throw Error(
        `Ophalen mislukt (${res.status}). Probeer de asymmetrische eenheid.`,
      );
    const text = await res.text();
    structures = {
      ...parseCIF(text),
      name: id,
      source: `RCSB PDB ${id} · ${assembly === "asym" ? "asymmetrische eenheid" : "assemblage " + assembly}`,
      text,
    };
    structureDialog();
  } catch (err) {
    $("#structure-progress").textContent = err.message;
  }
}
function structureDialog() {
  showModal(
    `<h2>${esc(structures.name)} · ketenselectie</h2><p>${structures.atoms.length.toLocaleString("nl-NL")} atomen · ${structures.chains.length} ketens</p><div id="structure-preview" style="height:230px;background:#f2f7fa;border:1px solid #e0e9ef;border-radius:8px"></div><p class="muted">Sleep om de structuur te draaien. De preview toont alle geselecteerde ketens.</p><div class="chain-list">${structures.chains.map((c) => `<label class="check"><input data-chain="${esc(c)}" type="checkbox" checked> Keten ${esc(c)}</label>`).join("")}</div><label>Weergave<select id="structure-rep"><option value="atoms">Atomen · van der Waals-bollen</option><option value="backbone">Ruggengraat · CA / P</option></select></label><p class="muted">Coördinaten worden van Å naar nm omgerekend. Geen ontbrekende domeinen of membranen toegevoegd. Een geïllustreerde domeincartoon vereist een voorbereid model.</p><button class="primary" data-action="structure-add">Voeg geselecteerde ketens toe</button>`,
  );
  updateStructurePreview();
}
function addStructure() {
  const chains = [...document.querySelectorAll("[data-chain]:checked")].map(
    (x) => x.dataset.chain,
  );
  const atoms = centeredAtoms(structures.atoms, chains);
  add("structure", {
    name: structures.name,
    source: structures.source,
    chains,
    atoms,
    representation: $("#structure-rep").value,
    anchored: false,
    scale: 1,
    label: true,
  });
  $("#modal").close();
  toast("Structuur toegevoegd. Controleer schaal en oriëntatie.");
  structures = null;
}

async function exportPNG() {
  if (project.editorMode !== "2d") await view.waitForAssets();
  const width = +$("#image-size").value;
  const transparent = $("#transparent").checked;
  const blob =
    project.editorMode === "2d"
      ? await drawing2D.exportPNG(width, transparent)
      : await imageBlob(width, transparent);
  download(blob, project.name + ".png");
  toast("PNG geëxporteerd");
}
async function imageBlob(width, transparent = false, aspect = 16 / 9) {
  const oldSize = view.renderer.getSize(new Vector2()),
    ratio = view.renderer.getPixelRatio();
  view.outline && (view.outline.visible = false);
  view.gizmo.getHelper().visible = false;
  view.handles.visible = false;
  view.renderer.setPixelRatio(1);
  const camera = view.camera,
    oldProjection = {
      left: camera.left,
      right: camera.right,
      aspect: camera.aspect,
    };
  const outputAspect = aspect || oldSize.x / oldSize.y;
  if (camera.isOrthographicCamera) {
    const halfHeight = (camera.top - camera.bottom) / 2;
    camera.left = -halfHeight * outputAspect;
    camera.right = halfHeight * outputAspect;
  } else camera.aspect = outputAspect;
  camera.updateProjectionMatrix();
  view.renderer.setSize(width, Math.round(width / outputAspect / 2) * 2, false);
  view.renderer.setClearAlpha(transparent ? 0 : 1);
  view.render();
  const blob = await new Promise((resolve) =>
    view.renderer.domElement.toBlob(resolve, "image/png"),
  );
  view.renderer.setClearAlpha(1);
  view.renderer.setPixelRatio(ratio);
  view.renderer.setSize(oldSize.x, oldSize.y, false);
  if (camera.isOrthographicCamera) {
    camera.left = oldProjection.left;
    camera.right = oldProjection.right;
  } else camera.aspect = oldProjection.aspect;
  camera.updateProjectionMatrix();
  view.outline && (view.outline.visible = true);
  view.gizmo.getHelper().visible = true;
  view.handles.visible = mode === "curve";
  if (!blob) throw Error("Afbeelding exporteren mislukt");
  return blob;
}
async function exportFrames() {
  if (recording) return;
  stop();
  recording = true;
  const original = clone(project),
    width = +$("#image-size").value;
  $("#modal").close();
  const files = {};
  try {
    const count = Math.ceil(project.duration * 24) + 1;
    for (let f = 0; f < count; f++) {
      const p = evaluate(original, Math.min(original.duration, f / 24));
      view.applyAnimation(p);
      const blob = await imageBlob(width, false);
      files[`frame-${String(f).padStart(5, "0")}.png`] = new Uint8Array(
        await blob.arrayBuffer(),
      );
      if (f % 12 === 0) toast(`Frames exporteren: ${f + 1}/${count}`);
    }
    download(
      new Blob([zipSync(files, { level: 0 })], { type: "application/zip" }),
      "ImmunoStudio-frames.zip",
    );
    toast("PNG-framereeks geëxporteerd");
  } finally {
    recording = false;
    project = original;
    view.build(project);
    view.setCamera(project.camera);
  }
}
async function exportVideo() {
  if (recording) return;
  if (!window.MediaRecorder || !view.renderer.domElement.captureStream)
    throw Error(
      "Deze browser ondersteunt geen video-export. Kies PNG-framereeks.",
    );
  const mime = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ].find((m) => MediaRecorder.isTypeSupported(m));
  if (!mime) throw Error("WebM niet beschikbaar. Gebruik PNG-framereeks.");
  stop();
  recording = true;
  const original = clone(project);
  $("#modal").close();
  view.outline && (view.outline.visible = false);
  view.gizmo.getHelper().visible = false;
  const stream = view.renderer.domElement.captureStream(24),
    chunks = [];
  const recorder = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: 10000000,
  });
  const completed = new Promise((resolve) => (recorder.onstop = resolve));
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  try {
    recorder.start();
    const start = performance.now();
    await new Promise((resolve) => {
      const step = () => {
        const t = Math.min(
            original.duration,
            (performance.now() - start) / 1000,
          ),
          p = evaluate(original, t);
        view.applyAnimation(p);
        view.outline && (view.outline.visible = false);
        view.gizmo.getHelper().visible = false;
        view.setCamera(p.camera);
        toast(`Animatie opnemen: ${t.toFixed(1)} / ${original.duration} s`);
        if (t < original.duration) requestAnimationFrame(step);
        else resolve();
      };
      step();
    });
    recorder.stop();
    await completed;
    download(new Blob(chunks, { type: mime }), "ImmunoStudio-animatie.webm");
    toast("WebM geëxporteerd");
  } finally {
    stream.getTracks().forEach((t) => t.stop());
    recording = false;
    project = original;
    view.build(project);
    view.setCamera(project.camera);
    view.gizmo.getHelper().visible = true;
  }
}
fetch("./library/index.json")
  .then((r) => {
    if (!r.ok) throw Error();
    return r.json();
  })
  .then((data) => {
    library = data;
    if (tab === "basis") renderLibrary();
  })
  .catch(() => toast("Basisbibliotheek ontbreekt. Voer sync-library uit."));
refresh();
installI18n();

async function exportNative(format) {
  if (recording) return;
  const status = await fetch("./api/status")
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  if (!status?.encoder)
    throw Error(
      "Lokale encoder niet actief. Start ImmunoStudio met Start-ImmunoStudio.cmd; PNG-framereeks blijft beschikbaar.",
    );
  const start = +$("#export-from").value,
    end = Math.min(project.duration, +$("#export-to").value);
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    end <= start
  )
    throw Error("Kies een geldig tijdsbereik.");
  if (format === "gif" && end - start > 15)
    throw Error("GIF ondersteunt maximaal 15 seconden.");
  const width =
      format === "gif" ? 800 : Math.min(1920, +$("#image-size").value),
    fps = format === "gif" ? 12 : 30,
    count = Math.ceil((end - start) * fps),
    original = clone(project);
  const api = async (path, data) => {
    const res = await fetch("./api/export/" + path, {
      method: "POST",
      headers: {
        "X-ImmunoStudio": status.token,
        ...(data instanceof Blob ? {} : { "Content-Type": "application/json" }),
      },
      body: data instanceof Blob ? data : JSON.stringify(data || {}),
    });
    const result = await res.json();
    if (!res.ok) throw Error(result.error || "Export mislukt");
    return result;
  };
  stop();
  recording = true;
  exportCancelled = false;
  setExportLock(true);
  $("#modal").close();
  $("#export-progress").hidden = false;
  let job;
  try {
    job = await api("start", { format, fps, count, loop: 0 });
    for (let f = 0; f < count; f++) {
      if (exportCancelled) throw Error("Export geannuleerd");
      const p = evaluate(original, start + f / fps);
      view.applyAnimation(p);
      const blob = await imageBlob(width, false);
      await api(job.id + "/frame", blob);
      $("#export-progress span").textContent =
        "Frames renderen: " + (f + 1) + " / " + count;
      $("#export-progress progress").value = ((f + 1) / count) * 0.8;
    }
    await api(job.id + "/finish");
    while (true) {
      if (exportCancelled) throw Error("Export geannuleerd");
      const state = await fetch("./api/export/" + job.id + "/status").then(
        (r) => r.json(),
      );
      if (state.state === "error") throw Error(state.error);
      if (state.state === "done") break;
      $("#export-progress span").textContent =
        format.toUpperCase() + " coderen…";
      $("#export-progress progress").value = 0.8 + 0.2 * state.progress;
      await new Promise((r) => setTimeout(r, 250));
    }
    const result = await fetch("./api/export/" + job.id + "/download");
    if (!result.ok) throw Error("Download mislukt");
    download(await result.blob(), project.name + "." + format);
    job = null;
    toast(format.toUpperCase() + " geëxporteerd");
  } finally {
    if (job) await api(job.id + "/cancel").catch(() => {});
    recording = false;
    setExportLock(false);
    $("#export-progress").hidden = true;
    project = original;
    view.build(project);
    view.setCamera(project.camera);
  }
}
function setExportLock(locked) {
  for (const section of document.querySelectorAll("header, nav.toolbar, main"))
    section.inert = locked;
}

$("#projection").addEventListener("change", (e) => {
  checkpoint();
  project.camera.projection = e.target.value;
  view.setCamera(project.camera);
  renderInspector();
  autosave();
});
$("#camera-mode").addEventListener("change", (e) => {
  checkpoint();
  project.camera.mode = e.target.value;
  followAnchor();
  view.setCamera(project.camera);
  autosave();
});
$("#camera-zoom").addEventListener("change", (e) => {
  const zoom = Math.max(0.3, Math.min(8, +e.target.value || 1));
  checkpoint();
  project.camera.zoom = zoom;
  view.setCamera(project.camera);
  renderInspector();
  autosave();
});
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-view]");
  if (!b) return;
  checkpoint();
  const c = project.camera,
    target = c.target,
    distance = Math.hypot(...c.position.map((x, k) => x - target[k]));
  const dir = {
    Voor: [0, 0.12, 1],
    Achter: [0, 0.12, -1],
    Links: [-1, 0.12, 0],
    Rechts: [1, 0.12, 0],
    Boven: [0, 1, 0.001],
    Onder: [0, -1, 0.001],
  }[b.dataset.view];
  c.position = target.map((x, k) => x + dir[k] * distance);
  view.setCamera(c);
  autosave();
  if (["Boven", "Onder", "Links", "Rechts"].includes(b.dataset.view))
    toast("Vrij aanzicht: de membraansnijrand kan vanuit deze hoek dun zijn.");
});

function updateStructurePreview() {
  if (!structures || !$("#structure-preview")) return;
  const chains = [...document.querySelectorAll("[data-chain]:checked")].map(
    (x) => x.dataset.chain,
  );
  if (!chains.length) return;
  const atoms = centeredAtoms(structures.atoms, chains),
    extent = Math.max(
      1,
      ...atoms.flatMap((a) => [Math.abs(a.x), Math.abs(a.y), Math.abs(a.z)]),
    );
  structurePreview?.dispose();
  structurePreview = new StudioScene(
    $("#structure-preview"),
    () => {},
    () => {},
    () => {},
    () => {},
  );
  const p = newProject();
  p.items = [
    makeItem("structure", {
      atoms,
      name: structures.name,
      representation: $("#structure-rep").value,
      x: 0,
      y: 0,
      z: 0,
      label: false,
    }),
  ];
  p.cut = false;
  p.fade = 0;
  structurePreview.build(p);
  structurePreview.membraneGroup.visible = false;
  structurePreview.setCamera({
    position: [extent * 2, extent, extent * 3],
    target: [0, 0, 0],
    zoom: Math.min(4, 6 / extent),
  });
}
$("#modal").addEventListener("close", () => {
  structurePreview?.dispose();
  structurePreview = null;
});
document.addEventListener("change", (e) => {
  if (e.target.dataset.chain !== undefined || e.target.id === "structure-rep")
    updateStructurePreview();
});

function basisControls(i) {
  if (i.kind === "svg")
    return '<button class="wide" data-action="make-3d">⬡ Bouw 3D-volume</button>';
  if (!["svg3d", "glb", "structure"].includes(i.kind)) return "";
  const info = view.groups.get(i.id)?.userData.volumeInfo;
  return (
    '<div class="hinge-box"><strong>Ruimtelijk model</strong>' +
    ["X", "Y"]
      .map(
        (axis) =>
          "<label>Draaien " +
          axis +
          ' (rad)<input type="number" data-item="rotation' +
          axis +
          '" value="' +
          (i["rotation" + axis] || 0) +
          '" min="-6.283" max="6.283" step=".1"></label>',
      )
      .join("") +
    (i.kind === "svg3d"
      ? '<label>Volumediepte<input type="range" data-item="volumeDepth" value="' +
        (i.volumeDepth || 1) +
        '" min=".25" max="3" step=".25"></label>' +
        (info
          ? '<p class="muted">' +
            info.shapeCount +
            " ruimtelijke vormen · " +
            info.triangles +
            " driehoeken</p>"
          : '<p class="muted">Vectoren worden als 3D-geometrie opgebouwd…</p>') +
        (info?.warnings?.length
          ? '<p class="muted">' + info.warnings.map(esc).join("<br>") + "</p>"
          : "") +
        '<button data-action="make-2d">Originele 2D-vector</button>'
      : "") +
    '<button class="wide" data-action="glb-export">↓ 3D-model · GLB</button></div>'
  );
}
$("#basis-representation").addEventListener(
  "change",
  (e) => (basisRepresentation = e.target.value),
);

function setEditorMode(next, save = true) {
  project.editorMode = next;
  document.documentElement.dataset.editor = next;
  $("#drawing2d").hidden = next !== "2d";
  view.suspended = next === "2d";
  view.controls.enabled = next !== "2d";
  document
    .querySelectorAll("[data-editor-mode]")
    .forEach((b) =>
      b.classList.toggle("active", b.dataset.editorMode === next),
    );
  if (next === "2d") {
    project.sheet ||= newSheet();
    drawing2D.setDocument(
      project.sheet,
      project.style,
      project.labelsVisible !== false,
    );
    drawing2D.setTool("select");
    tab = "basis";
    renderLibrary();
  } else {
    view.build(project);
    view.setCamera(project.camera);
  }
  renderInspector();
  if (save) autosave();
}

$("#all-labels").addEventListener("change", (e) => {
  checkpoint();
  project.labelsVisible = e.target.checked;
  changed();
});

async function exportOffice(format) {
  if (recording) return;
  const status = await fetch("./api/status")
    .then((r) => r.json())
    .catch(() => null);
  if (!status?.office)
    throw Error(
      "De lokale Inkscape-exporter is niet actief. Herstart ImmunoStudio voor EMF/WMF.",
    );
  const outlineText = $("#outline-fonts").checked;
  let svg;
  if (project.editorMode === "2d")
    svg = drawing2D.exportSVG($("#transparent").checked);
  else {
    await view.waitForAssets();
    const blob = await imageBlob(
        +$("#image-size").value,
        $("#transparent").checked,
      ),
      bytes = new Uint8Array(await blob.arrayBuffer());
    svg =
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1920" height="1080" viewBox="0 0 1920 1080"><image width="1920" height="1080" href="data:image/png;base64,' +
      bytesBase64(bytes) +
      '"/></svg>';
  }
  $("#modal").close();
  setExportLock(true);
  toast(format.toUpperCase() + " voorbereiden…");
  try {
    const result = await fetch("./api/office/export", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-ImmunoStudio": status.token,
      },
      body: JSON.stringify({ svg, format, outlineText }),
    });
    if (!result.ok) {
      const error = await result.json();
      throw Error(error.error || "Office-export mislukt");
    }
    download(await result.blob(), project.name + "." + format);
    toast(
      format.toUpperCase() +
        " geëxporteerd" +
        (outlineText ? " · letters als contouren" : ""),
    );
  } finally {
    setExportLock(false);
  }
}
