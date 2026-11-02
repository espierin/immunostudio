import { parsePath } from "./vector-nodes.js";
export function shapeMembrane(item) {
  let commands;
  if (item.kind === "ellipse") {
    const rx = item.w / 2,
      ry = item.h / 2,
      k = 0.5522847498307936;
    commands = parsePath(
      `M${item.w} ${ry}C${item.w} ${ry + k * ry} ${rx + k * rx} ${item.h} ${rx} ${item.h}C${rx - k * rx} ${item.h} 0 ${ry + k * ry} 0 ${ry}C0 ${ry - k * ry} ${rx - k * rx} 0 ${rx} 0C${rx + k * rx} 0 ${item.w} ${ry - k * ry} ${item.w} ${ry}Z`,
    );
  } else if (item.kind === "rect")
    commands = parsePath(`M0 0L${item.w} 0L${item.w} ${item.h}L0 ${item.h}Z`);
  else if (item.kind === "line" || item.kind === "arrow")
    commands = parsePath(
      `M${item.flipX ? item.w : 0} ${item.flipY ? item.h : 0}L${item.flipX ? 0 : item.w} ${item.flipY ? 0 : item.h}`,
    );
  else if (item.kind === "path") commands = parsePath(item.path);
  else throw Error("Kies een lijn, vrije lijn, cirkel, ellips of rechthoek.");
  const curve = [];
  let previous = null,
    start = null,
    closed = false;
  const line = (a, b) => [
    a.map((v, i) => v + (b[i] - v) / 3),
    a.map((v, i) => v + (2 * (b[i] - v)) / 3),
    b,
  ];
  for (const command of commands) {
    const v = command.values,
      end = v.slice(-2);
    if (command.type === "M") {
      if (curve.length) throw Error("Gebruik één doorlopende lijn.");
      previous = end;
      start = end;
      curve.push(end);
      continue;
    }
    if (command.type === "Z") {
      closed = true;
      if (Math.hypot(previous[0] - start[0], previous[1] - start[1]) > 0.01)
        curve.push(...line(previous, start));
      continue;
    }
    if (command.type === "C") curve.push(v.slice(0, 2), v.slice(2, 4), end);
    else if (command.type === "Q") {
      const control = v.slice(0, 2);
      curve.push(
        previous.map((p, i) => p + (2 * (control[i] - p)) / 3),
        end.map((p, i) => p + (2 * (control[i] - p)) / 3),
        end,
      );
    } else if (command.type === "L") curve.push(...line(previous, end));
    else
      throw Error("Convert arcs to Bézier curves before creating a membrane.");
    previous = end;
  }
  if (curve.length < 4)
    throw Error("De lijn heeft minstens twee punten nodig.");
  let result = curve;
  if (curve.length > 91) {
    const anchors = curve.filter((_, i) => i % 3 === 0),
      reduced = Array.from(
        { length: 31 },
        (_, i) => anchors[Math.round((i * (anchors.length - 1)) / 30)],
      );
    result = [reduced[0]];
    for (let i = 1; i < reduced.length; i++)
      result.push(...line(reduced[i - 1], reduced[i]));
  }
  return {
    ...item,
    kind: "membrane",
    name: closed ? "Vesikel" : "Plasmamembraan",
    closed,
    curve: result.map(([x, y]) => [x / item.w, y / item.h]),
    bilayerThickness: Math.max(
      12,
      Math.min(34, Math.min(item.w, item.h) * 0.15 || 34),
    ),
  };
}
