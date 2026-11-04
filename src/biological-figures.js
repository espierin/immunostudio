import cellArtwork from "./biological-cell-art.json" with { type: "json" };

// Original schematic family symbols, not atomic structures or inferred expression.
const cells = [
  [
    "helper-t-cell",
    "T-helper cell",
    "T_CD4_receptor_free",
    [
      "t helper",
      "t helper cell",
      "thelper cell",
      "helper t cell",
      "cd4 t cell",
      "th",
    ],
  ],
  [
    "cytotoxic-t-cell",
    "Cytotoxic T cell",
    "T_CD8_receptor_free",
    ["cytotoxic t cell", "cd8 t cell", "tc"],
  ],
  ["t-cell", "T cell", "T_cell_receptor_free", ["t cell", "t cells"]],
  ["b-cell", "B cell", "B_cell_receptor_free", ["b cell", "b cells"]],
  [
    "nk-cell",
    "NK cell",
    "NK_cell_receptor_free",
    [
      "nk cell",
      "nk cells",
      "natural killer cell",
      "lymphocyte activated killer cells lak",
      "lak cell",
    ],
  ],
  [
    "macrophage",
    "Macrophage",
    "macrophage_receptor_free",
    ["macrophage", "macrophages"],
  ],
  ["monocyte", "Monocyte", "monocyte_receptor_free", ["monocyte", "monocytes"]],
  [
    "dendritic-cell",
    "Dendritic cell",
    "dendritic_receptor_free",
    ["dendritic cell", "dendritic cells"],
  ],
  [
    "neutrophil",
    "Neutrophil",
    "neutrophil_receptor_free",
    ["neutrophil", "neutrophils"],
  ],
  [
    "eosinophil",
    "Eosinophil",
    "eosinophil_receptor_free",
    ["eosinophil", "eosinophils", "eos"],
  ],
  ["basophil", "Basophil", "basophil_receptor_free", ["basophil", "basophils"]],
  [
    "mast-cell",
    "Mast cell",
    "mast_cell_receptor_free",
    ["mast cell", "mast cells"],
  ],
  [
    "plasma-cell",
    "Plasma cell",
    "plasma_cell_receptor_free",
    ["plasma cell", "plasma cells"],
  ],
  ["fibroblast", "Fibroblast", null, ["fibroblast", "fibroblasts"]],
  [
    "endothelial-cell",
    "Endothelial cell",
    null,
    [
      "endothelial cell",
      "endothelial cells",
      "endothelial",
      "endothelia cells",
    ],
  ],
  [
    "epithelial-cell",
    "Epithelial cell",
    null,
    ["epithelial cell", "epithelial cells"],
  ],
  [
    "stem-cell",
    "Hematopoietic stem cell",
    null,
    ["hematopoietic stem cell", "haematopoietic stem cell", "hsc"],
  ],
];
const normal = (s) =>
  String(s)
    .toLowerCase()
    .replace(/α/g, "a")
    .replace(/β/g, "b")
    .replace(/γ/g, "g")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const compact = (s) => normal(s).replaceAll(" ", "");
export const biologicalFigures = cells.map(([id, label, asset, aliases]) => ({
  id,
  label,
  asset,
  aliases,
  family: "cell",
}));
const add = (label, family, aliases = []) =>
  biologicalFigures.push({
    id: label.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    label,
    family,
    aliases: [label, ...aliases],
  });
// Explicit symbols; family fallbacks cover additional named members without
// claiming that every number in a sequence is a real human gene.
const cytokines =
  "IL1A IL1B IL1RN IL2 IL3 IL4 IL5 IL6 IL7 IL9 IL10 IL11 IL12A IL12B IL13 IL15 IL16 IL17A IL17B IL17C IL17D IL17F IL18 IL19 IL20 IL21 IL22 IL23A IL24 IL25 IL26 IL27 IL32 IL33 IL34 IL36A IL36B IL36G IL36RN IL37 IFNA1 IFNA2 IFNB1 IFNG IFNL1 IFNL2 IFNL3 IFNL4 TNF LTA LTB TGFB1 TGFB2 TGFB3 CSF1 CSF2 CSF3 KITLG FLT3LG TSLP EBI3".split(
    " ",
  );
for (const x of cytokines)
  add(
    x,
    "cytokine",
    x === "CSF2"
      ? ["GM-CSF"]
      : x === "CSF3"
        ? ["G-CSF"]
        : x === "TNF"
          ? ["TNF alpha"]
          : x === "IFNG"
            ? ["interferon gamma"]
            : x === "IFNB1"
              ? ["IFN beta"]
              : [],
  );
for (const x of "CCL1 CCL2 CCL3 CCL4 CCL5 CCL7 CCL8 CCL11 CCL13 CCL14 CCL15 CCL16 CCL17 CCL18 CCL19 CCL20 CCL21 CCL22 CCL23 CCL24 CCL25 CCL26 CCL27 CCL28 CXCL1 CXCL2 CXCL3 CXCL4 CXCL5 CXCL6 CXCL8 CXCL9 CXCL10 CXCL11 CXCL12 CXCL13 CXCL14 CXCL16 CXCL17 CX3CL1 XCL1 XCL2".split(
  " ",
))
  add(x, "chemokine", x === "CXCL8" ? ["IL8", "IL-8"] : []);
for (const x of "PDGFA PDGFB PDGFC PDGFD VEGFA VEGFB VEGFC VEGFD FGF1 FGF2 FGF7 EGF HGF IGF1 IGF2".split(
  " ",
))
  add(x, "growth-factor");
for (const x of "CD3D CD3E CD3G CD4 CD8A CD8B CD19 CD20 CD28 CD40 CD40LG CD80 CD86 ICAM1 VCAM1 SELE SELL SELP ITGAL ITGB2 PDCD1 CD274 CTLA4 HLA-A HLA-B HLA-C HLA-E HLA-DRA HLA-DRB1 HLA-DPA1 HLA-DPB1 HLA-DQA1 HLA-DQB1 B2M TCR TRA TRB BCR IL1R1 IL2RA IL2RB IL2RG IL4R IL6R IL6ST IL7R IL10RA IL10RB IL12RB1 IL12RB2 IL13RA1 IL15RA IL17RA IL18R1 IL21R IFNAR1 IFNAR2 IFNGR1 IFNGR2 TNFRSF1A TNFRSF1B TGFBR1 TGFBR2 CSF1R CSF2RA CSF2RB CSF3R CCR1 CCR2 CCR3 CCR4 CCR5 CCR6 CCR7 CCR8 CCR9 CCR10 CXCR1 CXCR2 CXCR3 CXCR4 CXCR5 CXCR6 CX3CR1 XCR1 TLR2 TLR3 TLR4 TLR7 TLR8 TLR9".split(
  " ",
))
  add(
    x,
    /^(CCR|CXCR|CX3CR|XCR)/.test(x)
      ? "chemokine-receptor"
      : /^HLA|^B2M/.test(x)
        ? "mhc"
        : "membrane-protein",
    x === "PDCD1"
      ? ["PD-1"]
      : x === "CD274"
        ? ["PD-L1"]
        : x === "CD20"
          ? ["MS4A1"]
          : [],
  );
add("Antibody", "antibody", ["antibodies", "immunoglobulin", "IgG"]);
add("Cytokine", "cytokine");
add("Chemokine", "chemokine");
add("Membrane protein", "membrane-protein");
const lookup = new Map(
  biologicalFigures.flatMap((f) => f.aliases.map((a) => [compact(a), f])),
);
export function biologicalFigureFor(label, type = "protein") {
  if (
    [
      "edge",
      "compartment",
      "complex",
      "entity-set",
      "subpathway",
      "gene",
      "dna",
      "rna",
      "metabolite",
      "drug",
      "ion",
    ].includes(type)
  )
    return null;
  const key = compact(String(label).replace(/\s*\[[^\]]+\]\s*$/, ""));
  const exact = lookup.get(key);
  if (exact) return exact;
  const expanded = key
    .replace(/^interleukin/, "il")
    .replace(/^interferon/, "ifn")
    .replace(/alpha/g, "a")
    .replace(/beta/g, "b")
    .replace(/gamma/g, "g");
  if (lookup.has(expanded)) return lookup.get(expanded);
  if (expanded === "tnfa") return lookup.get("tnf");
  if (expanded === "tnfb") return lookup.get("lta");
  if (/^(ccl|cxcl|cx3cl|xcl)\d+$/.test(key))
    return { ...lookup.get("chemokine"), label };
  if (/^(il\d+[abfg]?|ifn[abgl]\d*|tgfb\d*|csf[123])$/.test(expanded))
    return { ...lookup.get("cytokine"), label };
  if (/^(ccr|cxcr|cx3cr|xcr)\d+$/.test(key))
    return { ...lookup.get("ccr1"), label };
  return null;
}
export function biologicalArtwork(f) {
  if (f.asset && cellArtwork[f.asset])
    return `<svg xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" xmlns:xlink="http://www.w3.org/1999/xlink" x="56" y="2" width="128" height="108" viewBox="${cellArtwork[f.asset].viewBox}">${cellArtwork[f.asset].body}</svg>`;
  const stroke = "#064986",
    fill =
      f.family === "chemokine"
        ? "#efa85b"
        : f.family === "cytokine"
          ? "#80b9cf"
          : f.family === "growth-factor"
            ? "#9ebc9c"
            : "#a9c6e2";
  let art = "";
  if (f.family === "cell") {
    art =
      f.id === "fibroblast"
        ? '<path d="M14 82Q72 74 99 39Q112 20 130 37Q156 67 226 29Q174 77 143 83Q117 106 95 85Q65 73 14 82Z"/>'
        : f.id === "endothelial-cell"
          ? '<path d="M14 76Q18 45 63 47Q99 30 132 47Q168 38 222 61L222 90Q183 107 135 93Q82 107 18 95Z"/>'
          : f.id === "epithelial-cell"
            ? '<path d="M68 16Q119 5 173 17L181 103H61Z"/>'
            : '<ellipse cx="120" cy="57" rx="51" ry="48"/>';
    art +=
      '<ellipse cx="119" cy="64" rx="23" ry="16" fill="#7586b6"/><path d="M89 72q9 10 16 3M145 47q12 5 7 14M78 59q-8 10 3 13" fill="none" stroke="#528ca5" stroke-width="3"/>';
  } else if (f.family === "antibody")
    art =
      '<path d="M110 107V67L67 25L78 14L120 53L162 14L173 25L130 67V107Z"/><path d="M93 53L77 37M147 53L163 37" stroke="#e7af66" stroke-width="7"/>';
  else if (f.family === "chemokine-receptor")
    art =
      Array.from(
        { length: 7 },
        (_, i) =>
          `<rect x="${70 + i * 14}" y="37" width="9" height="58" rx="4"/>`,
      ).join("") +
      '<path d="M74 37Q82 12 88 37M102 95Q111 114 116 95M130 37Q139 12 144 37M158 95Q170 110 160 95" fill="none"/>';
  else if (f.family === "membrane-protein" || f.family === "mhc")
    art =
      '<rect x="113" y="68" width="14" height="38" rx="5"/>' +
      [25, 50]
        .map((y) => `<ellipse cx="120" cy="${y}" rx="24" ry="16"/>`)
        .join("") +
      (f.family === "mhc"
        ? '<path d="M91 13Q120 2 150 13M94 16H146" fill="none" stroke-width="5"/><ellipse cx="151" cy="66" rx="13" ry="15"/>'
        : '<path d="M107 106v8m25-8v8" fill="none"/>');
  else if (f.family === "chemokine")
    art =
      '<path d="M77 41Q91 12 115 29Q139 11 157 35Q183 53 158 81Q143 105 117 88Q88 101 76 75Q57 55 77 41Z"/><path d="M91 43l16 31m5-35 15 38m5-42 17 32M89 76q29-24 61-4" fill="none" stroke="#b87636" stroke-width="4"/>';
  else
    art =
      '<path d="M76 38Q85 13 111 27Q138 9 157 33Q179 49 165 72Q151 99 127 89Q101 105 83 83Q61 66 76 38Z"/>' +
      [89, 109, 129, 149]
        .map(
          (x, i) =>
            `<path d="M${x} ${39 + (i % 2) * 5}q-9 16 0 34" fill="none" stroke="#eef8fb" stroke-width="7"/>`,
        )
        .join("");
  return `<g data-biological-family="${f.family}" fill="${fill}" stroke="${stroke}" stroke-width="2" stroke-linejoin="round">${art}</g>`;
}
