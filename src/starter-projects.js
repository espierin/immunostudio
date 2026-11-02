import { newProject } from "./model.js";
export function starterProject(kind, molecule = null) {
  const p = newProject();
  p.name =
    kind === "membrane" ? "Membrane & receptors" : "Editable tissue layers";
  p.sheet = {
    version: 1,
    width: 1600,
    height: 900,
    background: "#FFFFFF",
    zoom: 1,
    panX: 0,
    panY: 0,
    grid: false,
    snap: false,
    items: [],
  };
  const base = { rotation: 0, opacity: 1, visible: true };
  if (kind === "membrane") {
    p.sheet.items.push({
      ...base,
      id: "starter-membrane",
      kind: "membrane",
      name: "Membrane",
      x: 180,
      y: 380,
      w: 1240,
      h: 160,
      curve: [
        [0, 0.5],
        [0.32, 0.06],
        [0.68, 0.94],
        [1, 0.5],
      ],
      bilayerThickness: 34,
    });
    if (molecule)
      p.sheet.items.push({
        ...base,
        id: "starter-receptor",
        kind: "svg",
        name: molecule.title,
        sourceFile: molecule.file,
        svg: molecule.svg,
        x: 720,
        y: 240,
        w: 160,
        h: 260,
        anchor2d: {
          targetId: "starter-membrane",
          pathIndex: 0,
          u: 0.5,
          side: 1,
          offset: 0,
          pivotX: 0.5,
          pivotY: 0.8,
          angle: 0,
        },
      });
  } else if (kind === "tissues") {
    for (const [lineStyle, y, name] of [
      ["endothelium", 160, "Endothelium"],
      ["skin", 390, "Skin / stratified epithelium"],
      ["intestine", 620, "Intestinal epithelium"],
    ]) {
      p.sheet.items.push({
        ...base,
        id: lineStyle,
        kind: "membrane",
        name,
        x: 220,
        y,
        w: 1150,
        h: 130,
        lineStyle,
        curve: [
          [0, 0.5],
          [0.3, -0.1],
          [0.7, 1.1],
          [1, 0.5],
        ],
        layerThickness: lineStyle === "endothelium" ? 26 : 96,
        cellWidth: lineStyle === "endothelium" ? 100 : 42,
        fillEnabled: false,
      });
      p.sheet.items.push({
        ...base,
        id: lineStyle + "-label",
        kind: "text",
        name,
        text: name,
        x: 220,
        y: y - 65,
        w: 1100,
        h: 40,
        fontSize: 30,
        fill: "#002B49",
      });
    }
  } else throw Error("Unknown starter");
  return p;
}
