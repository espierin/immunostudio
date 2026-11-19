import { isMembraneCell } from "./cell-look.js";
// Source coordinates refer to the transmembrane stem, not the figure bounds.
// CD4 is drawn with its extracellular domains pointing down in the source set.
const nativeProfiles = [
  {
    file: "basic_150_CD4_coreceptor_four_domains.svg",
    marker: /data-cd4-cytoplasmic-stem=/,
    x: -145,
    y: 0,
    span: 34,
    width: 6,
    angle: 180,
  },
  {
    file: "basic_14_TCR_CD8.svg",
    marker: /<title>TCR\/CD3 with CD8<\/title>/,
    x: -30,
    y: 0,
    span: 34,
    width: 104,
    angle: 0,
  },
  {
    file: "basic_13_TCR_CD3_user.svg",
    marker: /<title>TCR αβ \+ CD3<\/title>/,
    x: 0,
    y: 0,
    span: 34,
    width: 98,
    angle: 0,
  },
  {
    file: "basic_15_CD8_coreceptor.svg",
    marker: /<title>CD8 coreceptor<\/title>/,
    x: 0,
    y: 0,
    span: 34,
    width: 24,
    angle: 0,
  },
];

export function receptorAnchorProfile(item) {
  const svg = item.svg || "";
  const native = nativeProfiles.find(
    (p) =>
      item.sourceFile?.replaceAll("\\", "/").endsWith("/" + p.file) ||
      item.sourceFile === p.file ||
      p.marker.test(svg),
  );
  if (native) {
    const box = svg
      .match(/\bviewBox=["']([^"']+)["']/)?.[1]
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (
      !box ||
      box.length !== 4 ||
      !box.every(Number.isFinite) ||
      box[2] <= 0 ||
      box[3] <= 0
    )
      return null;
    return {
      pivotX: (native.x - box[0]) / box[2],
      pivotY: (native.y - box[1]) / box[3],
      span: native.span / box[3],
      width: native.width / box[2],
      angle: native.angle,
      extracellular: true,
    };
  }
  if (/data-receptor="CCR5"/.test(svg))
    return {
      pivotY: 61 / 140,
      span: 62 / 140,
      width: 114.6 / 240,
      tmX: 122.5 / 240,
    };
  if (/^bio-(?:ccr\d+|cxcr\d+|cx3cr1|xcr1)$/.test(item.pathway?.type || ""))
    return {
      pivotY: 66 / 140,
      span: 58 / 140,
      width: 95.5 / 240,
      tmX: 116.5 / 240,
    };
  if (/^bio-(?:tcr|tra|trb|cd4|cd8a|cd8b)$/.test(item.pathway?.type || ""))
    return {
      pivotY: 87 / 140,
      span: 38 / 140,
      width: 17 / 240,
      extracellular: true,
    };
  return null;
}

export function membraneThickness(item) {
  return (
    item.bilayerThickness ||
    (item.kind === "svg" && isMembraneCell(item)
      ? Math.max(6, Math.min(14, Math.min(item.w, item.h) * 0.035))
      : 34)
  );
}
export function embeddedStemProfile(name) {
  if (/CCR5/i.test(name)) return { x: 122.5, y: 61, width: 114.6, span: 62 };
  const file = /basic[_-]150[_-]CD4|CD4.*(?:coreceptor|four.domain)/i.test(name)
    ? nativeProfiles[0]
    : /basic[_-]14[_-]TCR|TCR.*(?:with.CD8|CD8)/i.test(name)
      ? nativeProfiles[1]
      : /basic[_-]13[_-]TCR|TCR.*(?:CD3|alpha)/i.test(name)
        ? nativeProfiles[2]
        : /basic[_-]15[_-]CD8|CD8.*coreceptor/i.test(name)
          ? nativeProfiles[3]
          : null;
  return file ? { ...file, extracellular: true } : null;
}
export function fitReceptorAnchor(item, target, onlyIfChanged = false) {
  const profile = receptorAnchorProfile(item);
  if (!profile || !item.anchor2d || !(item.h > 0) || !(item.w > 0))
    return false;
  const stamp = JSON.stringify([
    profile,
    membraneThickness(target),
    !!item.mirrorX,
    !!item.mirrorY,
  ]);
  if (onlyIfChanged && item.anchor2d.receptorFit === stamp) return false;
  const h = membraneThickness(target) / profile.span;
  const ratio = h / item.h;
  item.w *= ratio;
  item.h = h;
  item.anchor2d.pivotX = item.mirrorX
    ? 1 - (profile.pivotX ?? 0.5)
    : (profile.pivotX ?? 0.5);
  item.anchor2d.pivotY = item.mirrorY ? 1 - profile.pivotY : profile.pivotY;
  item.anchor2d.angle = (profile.angle || 0) + (item.mirrorY ? 180 : 0);
  item.anchor2d.receptorFit = stamp;
  return true;
}
