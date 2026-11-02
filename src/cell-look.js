export function isCellElement(item) {
  return /cell|lymphocyt|neutroph|monocyt|macroph|dendritic|erythro|platelet|_T_CD|_NK_/i.test(
    `${item.name || ""} ${item.sourceFile || ""}`,
  );
}

// Keep the original contours and organelles; shade each coloured compartment.
export function enhanceCellVector(text, prefix) {
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  const root = doc.documentElement;
  const ns = "http://www.w3.org/2000/svg";
  const defs = doc.createElementNS(ns, "defs");
  const mix = (hex, target, amount) =>
    "#" +
    [0, 2, 4]
      .map((n) =>
        Math.round(
          parseInt(hex.slice(n, n + 2), 16) * (1 - amount) + target * amount,
        )
          .toString(16)
          .padStart(2, "0"),
      )
      .join("");
  let count = 0;
  for (const shape of root.querySelectorAll(
    "path,ellipse,circle,rect,polygon",
  )) {
    if (shape.closest("defs,clipPath,mask")) continue;
    let fill = shape.getAttribute("fill") || shape.style.fill;
    if (fill?.startsWith("url(")) {
      const id = fill.match(/#([^)'"\s]+)/)?.[1];
      fill = [...(doc.getElementById(id)?.querySelectorAll("stop") || [])]
        .at(-1)
        ?.getAttribute("stop-color");
    }
    if (!/^#[0-9a-f]{6}$/i.test(fill || "") || /#(?:ffffff|000000)/i.test(fill))
      continue;
    const hex = fill.slice(1),
      id = `${prefix}-volume-${count++}`;
    const gradient = doc.createElementNS(ns, "radialGradient");
    for (const [key, value] of Object.entries({
      id,
      cx: "38%",
      cy: "32%",
      r: "78%",
      fx: "28%",
      fy: "22%",
    }))
      gradient.setAttribute(key, value);
    for (const [offset, color] of [
      ["0%", mix(hex, 255, 0.48)],
      ["48%", mix(hex, 255, 0.08)],
      ["100%", mix(hex, 0, 0.26)],
    ]) {
      const stop = doc.createElementNS(ns, "stop");
      stop.setAttribute("offset", offset);
      stop.setAttribute("stop-color", color);
      gradient.append(stop);
    }
    defs.append(gradient);
    shape.setAttribute("fill", `url(#${id})`);
    shape.style.removeProperty("fill");
  }
  root.prepend(defs);
  return new XMLSerializer().serializeToString(root);
}
