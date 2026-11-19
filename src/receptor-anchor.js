// Coordinates are measured in the 240 by 140 receptor artwork viewBox.
export function receptorAnchorProfile(item) {
  if (/data-receptor="CCR5"/.test(item.svg || '')) return {pivotY: 61 / 140, span: 62 / 140};
  if (/^bio-(?:ccr\d+|cxcr\d+|cx3cr1|xcr1)$/.test(item.pathway?.type || ''))
    return {pivotY: 66 / 140, span: 58 / 140};
  return null;
}

export function fitReceptorAnchor(item, target) {
  const profile = receptorAnchorProfile(item);
  if (!profile) return false;
  const h = (target.bilayerThickness || 34) / profile.span;
  const ratio = h / item.h;
  item.w *= ratio;
  item.h = h;
  item.anchor2d.pivotY = item.mirrorY ? 1 - profile.pivotY : profile.pivotY;
  return true;
}
