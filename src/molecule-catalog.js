import { pdbReferences } from "./pdb-references.js";
import { isHemisphereCell } from "./cell-look.js";
export function moleculeInfo(asset) {
  const text = `${asset.file || asset.sourceFile || ""} ${asset.key || ""} ${asset.title || asset.name || ""}`;
  if (
    isHemisphereCell({
      name: asset.title || asset.name,
      sourceFile: asset.file || asset.sourceFile,
    })
  )
    return { type: "cell", variant: "hemisphere-cutaway", reference: null };
  const rules = [
    [/proteasom/i, "1IRU"],
    [/TAP_transporter/i, "5U1D"],
    [/perforin/i, "3NSJ"],
    [/MAC_membrane|Complement membrane pore/i, "6H03"],
    [/TCR|T.cell receptor/i, "6JXR"],
    [/NKG2A/i, "3BDW"],
    [/NKG2C/i, "2L35"],
    [/NKG2D/i, "1HYR"],
    [/KIR.*3[ _-]?domain|KIR3/i, "3VH8"],
    [/KIR.*2[ _-]?domain|KIR2/i, "1EFX"],
    [/DAP12/i, "2L34"],
    [/CD16/i, "1FNL"],
    [/CD4[ _-]|CD4 coreceptor/i, "1CDH"],
    [/CD8[ _-]|CD8 coreceptor/i, "1AKJ"],
    [/HLA[ _-]?E[ _-]|HLA E /i, "3BZE"],
    [/HLA[ _-]?II|class II/i, "1DLH"],
    [/HLA[ _-]?I[ _-]|class I |beta2.*microglobulin|HLA_heavy/i, "1AKJ"],
    [/BCR|CD79/i, "7XQ8"],
    [/IgG|immunoglobulin|antibody/i, "1IGT"],
    [/PD.?1|PD.?L1/i, "4ZQK"],
  ];
  const match = rules.find(([pattern]) => pattern.test(text)),
    molecular =
      !!match ||
      /02_HLA|peptide|protein|proteasom|TAP_transporter|perforin|amino|AA_[A-Z]_chemical|MAC_membrane/i.test(
        text,
      );
  return {
    type: molecular ? "molecule" : "element",
    variant: "rounded-vector-volume",
    reference: match ? pdbReferences[match[1]] || null : null,
  };
}
