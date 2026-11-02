export const pageFormats = {
  slide: [1600, 900],
  square: [1200, 1200],
  portrait: [1120, 1584],
  landscape: [1584, 1120],
};
export function selectionViewport(sheet, box, padding = 50) {
  const zoom = Math.max(
    0.25,
    Math.min(
      10,
      sheet.width / Math.max(1, box.w + padding * 2),
      sheet.height / Math.max(1, box.h + padding * 2),
    ),
  );
  return {
    zoom,
    panX: sheet.width / zoom / 2 - box.x - box.w / 2,
    panY: sheet.height / zoom / 2 - box.y - box.h / 2,
  };
}
export function pageFormatControls() {
  return '<label>Bladformaat<select data-sheet-preset><option value="">Eigen formaat</option><option value="slide">Presentatie 16:9</option><option value="square">Vierkant</option><option value="portrait">A4 staand</option><option value="landscape">A4 liggend</option></select></label>';
}
