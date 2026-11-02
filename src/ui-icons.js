import { explanations } from "./ui-help.js";
import { english } from "./translations.js";
for (const [nl, en] of Object.values(explanations)) english[nl] = en;
const commands = {
  front: "selection-top",
  back: "selection-bottom",
  forward: "selection-raise",
  backward: "selection-lower",
  group: "object-group",
  ungroup: "object-ungroup",
  duplicate: "edit-duplicate",
  delete: "edit-delete",
  "align-left": "align-horizontal-left",
  "align-center": "align-horizontal-center",
  "align-right": "align-horizontal-right",
  "align-top": "align-vertical-top",
  "align-middle": "align-vertical-center",
  "align-bottom": "align-vertical-bottom",
  "distribute-x": "distribute-horizontal-gaps",
  "distribute-y": "distribute-vertical-gaps",
  undo: "edit-undo",
  redo: "edit-redo",
  save: "document-save",
  "zoom-in": "zoom-in",
  "zoom-out": "zoom-out",
};
const tools = {
  nodes: "tool-node-editor",
  select: "tool-pointer",
  move: "transform-move-horizontal",
  rotate: "transform-rotate",
  curve: "tool-node-editor",
  membrane: "tool-node-editor",
};
const fields = {
  x: "transform-move-horizontal",
  y: "transform-move-vertical",
  w: "transform-scale-horizontal",
  h: "transform-scale-vertical",
  rotation: "transform-rotate",
  rotationX: "transform-rotate",
  rotationY: "transform-rotate",
  scale: "transform-scale-horizontal",
  locked: "object-locked",
  fill: "color-fill",
  stroke: "dialog-fill-and-stroke",
  strokeWidth: "transform-affect-stroke",
};
function icon(name) {
  const span = document.createElement("span");
  span.className = "ui-icon";
  span.setAttribute("aria-hidden", "true");
  span.style.setProperty(
    "--icon-url",
    `url("${new URL("./icons/inkscape/" + name + ".svg", document.baseURI).href}")`,
  );
  return span;
}
export function decorateUI(root = document) {
  for (const button of root.querySelectorAll("button")) {
    if (button.querySelector(".ui-icon")) continue;
    const name =
      commands[button.dataset.sheetAction || button.dataset.action] ||
      tools[button.dataset.sheetTool || button.dataset.mode];
    if (!name) continue;
    let label = button.textContent.trim();
    if (button.dataset.sheetAction === "zoom-in") label = "Inzoomen";
    if (button.dataset.sheetAction === "zoom-out") label = "Uitzoomen";
    if (["undo", "redo"].includes(button.dataset.action))
      label = button.dataset.action === "undo" ? "Ongedaan maken" : "Opnieuw";
    else label = label.replace(/^[^\p{L}\p{N}]+/u, "").trim();
    button.textContent = "";
    button.append(icon(name));
    const text = document.createElement("span");
    text.textContent = label || button.title;
    button.append(text);
    button.classList.add("icon-button");
    const helpKey =
      button.dataset.sheetAction ||
      button.dataset.action ||
      button.dataset.sheetTool ||
      button.dataset.mode;
    button.title = explanations[helpKey]?.[0] || text.textContent;
    button.setAttribute("aria-description", button.title);
    if (["undo", "redo"].includes(button.dataset.action)) {
      button.setAttribute("aria-label", text.textContent);
      text.className = "visually-hidden";
    }
  }
  for (const input of root.querySelectorAll("#properties input")) {
    const name = fields[input.dataset.sheetField || input.dataset.item];
    const label = input.closest("label");
    if (!name || !label || label.querySelector(".ui-icon")) continue;
    const node = [...label.childNodes].find(
      (n) => n.nodeType === 3 && n.textContent.trim(),
    );
    if (!node) continue;
    const caption = document.createElement("span");
    caption.className = "property-caption";
    const field = input.dataset.sheetField || input.dataset.item;
    caption.title =
      explanations["field-" + field]?.[0] || node.textContent.trim();
    input.title = caption.title;
    caption.append(
      icon(name),
      document.createTextNode(node.textContent.trim()),
    );
    node.replaceWith(caption);
  }
}
