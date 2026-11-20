import { isMembraneCell } from "./cell-look.js";
import { receptorAnchorProfile, membraneThickness } from "./receptor-anchor.js";
import {
  sampledStemFootprints,
  receptorFootprints,
} from "./receptor-footprints.js";
import { prepareContour, embeddedAnchors } from "./sculpt2d.js";
import { contourCommands, contourFrame } from "./contour2d.js";
import { membraneMarkup } from "./membrane2d.js";

const NS = "http://www.w3.org/2000/svg";
export function cellMembraneKey(item, style, items, labelsVisible = true) {
  return JSON.stringify([
    labelsVisible,
    item.name,
    item.sourceFile,
    item.svg,
    item.w,
    item.h,
    item.rotation,
    item.mirrorX,
    item.mirrorY,
    item.volumeLook,
    item.cellBilayer,
    item.bilayerThickness,
    style,
    receptorFootprints(item, items, null),
    items
      .filter(
        (i) =>
          i.anchor2d?.targetId === item.id && !receptorAnchorProfile(i)?.width,
      )
      .map((i) => [
        i.id,
        i.x,
        i.y,
        i.w,
        i.h,
        i.rotation,
        i.anchor2d?.ectoBend,
        i.mirrorX,
        i.mirrorY,
        i.visible,
        i.opacity,
        i.svg,
      ]),
  ]);
}
export function updateCellMembranes(drawing) {
  drawing.cellMembranes ??= new Map();
  const live = new Set(drawing.doc.items.map((i) => i.id));
  for (const id of drawing.cellMembranes.keys())
    if (!live.has(id)) drawing.cellMembranes.delete(id);
  for (const item of drawing.doc.items) {
    if (
      item.kind !== "svg" ||
      !isMembraneCell(item) ||
      item.cellBilayer === false ||
      item.visible === false
    )
      continue;
    const key = cellMembraneKey(
      item,
      drawing.style,
      drawing.doc.items,
      drawing.labelsVisible !== false,
    );
    if (drawing.cellMembranes.get(item.id)?.key === key) continue;
    try {
      const session = prepareContour(drawing, item);
      if (!session.closed) continue;
      const entity = drawing.svg.querySelector(`[data-entity="${item.id}"]`),
        art = entity.querySelector("[data-artwork]");
      const sheetToArt = new DOMMatrix([
        art.getScreenCTM().a,
        art.getScreenCTM().b,
        art.getScreenCTM().c,
        art.getScreenCTM().d,
        art.getScreenCTM().e,
        art.getScreenCTM().f,
      ])
        .inverse()
        .multiply(drawing.svg.getScreenCTM());
      const local = (p) => {
        const v = new DOMPoint(...p).matrixTransform(sheetToArt);
        return [v.x, v.y];
      };
      const points = Array.from(
        { length: Math.min(64, session.points.length) },
        (_, n) =>
          local(
            contourFrame(
              session.points,
              n / Math.min(64, session.points.length),
              true,
            ).point,
          ),
      );
      const curve = contourCommands(points, true)
        .filter((c) => c.type !== "Z")
        .flatMap((c) => {
          const p = [];
          for (let n = 0; n < c.values.length; n += 2)
            p.push(c.values.slice(n, n + 2));
          return p;
        });
      const footprints = receptorFootprints(
        item,
        drawing.doc.items,
        session.index,
      );
      const embedded = embeddedAnchors(session);
      for (const anchor of embedded)
        for (const stem of anchor.stems || (anchor.stem ? [anchor.stem] : []))
          footprints.push(stem.map(local));
      for (const receptor of drawing.doc.items) {
        if (
          receptor.visible === false ||
          receptor.opacity === 0 ||
          receptor.anchor2d?.targetId !== item.id ||
          receptor.anchor2d.pathIndex !== session.index ||
          receptorAnchorProfile(receptor)?.width
        )
          continue;
        const receptorStems = sampledStemFootprints(
          drawing.svg.querySelector(
            `[data-entity="${receptor.id}"] [data-artwork]`,
          ),
          contourFrame(session.points, receptor.anchor2d.u, true),
          session.screenToSheet,
          membraneThickness(item),
        );
        footprints.push(...receptorStems.map((p) => p.map(local)));
      }
      const root = entity.querySelector("svg");
      root.querySelector("[data-cell-bilayer]")?.remove();
      const body = entity.querySelector(`[data-node-path="${session.index}"]`);
      body.setAttribute("stroke", "none");
      body.style.stroke = "none";
      const layer = document.createElementNS(NS, "g");
      layer.setAttribute("data-cell-bilayer", "true");
      layer.setAttribute("pointer-events", "none");
      // The generated bilayer uses artwork coordinates, while the source root uses its own viewBox.
      const sourceToArt = art
          .getScreenCTM()
          .inverse()
          .multiply(root.getScreenCTM()),
        inverse = sourceToArt.inverse();
      layer.setAttribute(
        "transform",
        `matrix(${inverse.a} ${inverse.b} ${inverse.c} ${inverse.d} ${inverse.e} ${inverse.f})`,
      );
      layer.innerHTML = membraneMarkup(
        {
          w: 1,
          h: 1,
          curve,
          closed: true,
          bilayerThickness: membraneThickness(item),
        },
        drawing.style,
        footprints,
      );
      root.append(layer);
      drawing.cellMembranes.set(item.id, {
        key,
        markup: root.outerHTML,
        index: session.index,
        embeddedCount: embedded.length,
      });
    } catch (error) {
      drawing.cellMembranes.delete(item.id);
    }
  }
}
