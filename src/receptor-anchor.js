// Source coordinates refer to the transmembrane stem, not the figure bounds.
// CD4 is drawn with its extracellular domains pointing down in the source set.
const nativeProfiles = [
  {file: 'basic_150_CD4_coreceptor_four_domains.svg', marker: /data-cd4-cytoplasmic-stem=/, x: -145, y: 0, span: 34, angle: 180},
  {file: 'basic_14_TCR_CD8.svg', marker: /<title>TCR\/CD3 with CD8<\/title>/, x: -30, y: 0, span: 34, angle: 0},
  {file: 'basic_13_TCR_CD3_user.svg', marker: /<title>TCR αβ \+ CD3<\/title>/, x: 0, y: 0, span: 34, angle: 0},
  {file: 'basic_15_CD8_coreceptor.svg', marker: /<title>CD8 coreceptor<\/title>/, x: 0, y: 0, span: 34, angle: 0},
];

export function receptorAnchorProfile(item) {
  const svg = item.svg || '';
  const native = nativeProfiles.find(p => item.sourceFile?.replaceAll('\\', '/').endsWith('/' + p.file) || item.sourceFile === p.file || p.marker.test(svg));
  if (native) {
    const box = svg.match(/\bviewBox=["']([^"']+)["']/)?.[1].trim().split(/[\s,]+/).map(Number);
    if (!box || box.length !== 4 || !box.every(Number.isFinite) || box[2] <= 0 || box[3] <= 0) return null;
    return {pivotX: (native.x - box[0]) / box[2], pivotY: (native.y - box[1]) / box[3], span: native.span / box[3], angle: native.angle};
  }
  if (/data-receptor="CCR5"/.test(svg)) return {pivotY: 61 / 140, span: 62 / 140};
  if (/^bio-(?:ccr\d+|cxcr\d+|cx3cr1|xcr1)$/.test(item.pathway?.type || ''))
    return {pivotY: 66 / 140, span: 58 / 140};
  if (/^bio-(?:tcr|tra|trb|cd4|cd8a|cd8b)$/.test(item.pathway?.type || ''))
    return {pivotY: 87 / 140, span: 38 / 140};
  return null;
}

export function fitReceptorAnchor(item, target, onlyIfChanged = false) {
  const profile = receptorAnchorProfile(item);
  if (!profile || !item.anchor2d || !(item.h > 0) || !(item.w > 0)) return false;
  const stamp = JSON.stringify([profile, target.bilayerThickness || 34, !!item.mirrorX, !!item.mirrorY]);
  if (onlyIfChanged && item.anchor2d.receptorFit === stamp) return false;
  const h = (target.bilayerThickness || 34) / profile.span;
  const ratio = h / item.h;
  item.w *= ratio;
  item.h = h;
  item.anchor2d.pivotX = item.mirrorX ? 1 - (profile.pivotX ?? .5) : (profile.pivotX ?? .5);
  item.anchor2d.pivotY = item.mirrorY ? 1 - profile.pivotY : profile.pivotY;
  item.anchor2d.angle = (profile.angle || 0) + (item.mirrorY ? 180 : 0);
  item.anchor2d.receptorFit = stamp;
  return true;
}
