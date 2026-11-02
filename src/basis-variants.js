import { makeItem } from "./model.js";

/** A schematic volume linked to its original, editable 2D vector. */
export function sheetToVolume(item, sheet) {
  if (item.kind !== "svg" || typeof item.svg !== "string")
    throw Error("Kies een vectorbouwsteen.");
  const bytes = new TextEncoder().encode(item.svg);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const unit = 32 / sheet.width;
  return makeItem("svg3d", {
    name: item.name,
    sourceFile: item.sourceFile,
    sourceSheetId: item.id,
    url: "data:image/svg+xml;base64," + btoa(binary),
    representation: "volume",
    volumeDepth: 1,
    anchored: false,
    level: null,
    x: (item.x + item.w / 2 - sheet.width / 2) * unit,
    y: (sheet.height / 2 - item.y - item.h / 2) * unit + 8,
    z: 0,
    rotation: (-(item.rotation || 0) * Math.PI) / 180,
    scale: Math.max(0.1, Math.min(10, (Math.max(item.w, item.h) * unit) / 7)),
    visible: item.visible !== false,
    label: false,
  });
}
