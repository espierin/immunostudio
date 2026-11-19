export function sheetActionEnabled(doc, selected, clipboard, cmd) {
  const items = doc.items.filter((i) => selected.includes(i.id));
  const editable = items.filter((i) => !i.locked);
  if (cmd === "paste")
    return !!clipboard?.length && doc.items.length + clipboard.length <= 4000;
  if (cmd === "select-none") return !!items.length;
  if (["select-all", "invert-selection", "select-unlocked"].includes(cmd))
    return !!doc.items.length;
  if (cmd === "copy" || cmd === "fit-selection") return !!items.length;
  if (cmd === "group" || cmd.startsWith("align-")) return editable.length >= 2;
  if (cmd.startsWith("distribute-")) return editable.length >= 3;
  if (cmd === "ungroup") return editable.some((i) => i.groupId);
  if (cmd === "pathway-layout")
    return doc.items.some((i) => i.pathwayBatchId || i.pathway);
  if (cmd === "pathway-detach")
    return editable.some((i) => i.pathwayConnection);
  if (cmd === "to-membrane" || cmd === "to-editable-curve")
    return editable.some((i) =>
      ["line", "arrow", "path", "rect", "ellipse", "membrane"].includes(i.kind),
    );
  if (["fit", "floating-tools", "zoom-in", "zoom-out"].includes(cmd))
    return true;
  return !!editable.length;
}
