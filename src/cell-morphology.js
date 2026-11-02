/** Schematic morphology choices; the source outline and organelles remain authoritative. */
export function cellMorphology(item = {}) {
  const text = `${item.sourceFile || item.file || ""} ${item.name || item.title || ""}`;
  const rules = [
    [/erythro|red.blood|biconcave/i, "erythrocyte", "radial", 0.34],
    [/platelet|thrombocyt/i, "platelet", "radial", 0.22],
    [/dendritic|stellate/i, "dendritic", "contour", 0.56],
    [/macroph|phagocyt/i, "macrophage", "contour", 0.78],
    [/cardiomy|cardiac|myocyte/i, "cardiomyocyte", "contour", 0.68],
    [/epithelial|epitheel/i, "epithelial", "contour", 0.48],
    [/apoptot|injured/i, "apoptotic", "contour", 0.65],
    [/monocyt/i, "monocyte", "contour", 0.86],
    [/plasma.cell|plasma_cell|plasmacyt/i, "plasma", "radial", 0.86],
    [
      /neutroph|eosinoph|basoph|mast.cell|mast_cell/i,
      "granulocyte",
      "radial",
      0.9,
    ],
    [/leukemic|blast|target|graft/i, "target", "contour", 0.82],
  ];
  const match = rules.find(([pattern]) => pattern.test(text));
  return match
    ? { type: match[1], construction: match[2], depthRatio: match[3] }
    : { type: "lymphocyte", construction: "radial", depthRatio: 1 };
}
