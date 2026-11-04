# Biological pathway figures

The pathway collection includes 230 biological figures alongside the 35 generic pathway symbols. Search in **2D → Pathway elements**. New structured imports use the same artwork for recognized names; existing projects retain their artwork.

* Cell illustrations reuse the repository's receptor-free basic elements. Dedicated original silhouettes cover fibroblasts, endothelial cells, epithelial cells and hematopoietic stem cells.
* Named cytokines, chemokines, growth factors, membrane proteins, chemokine receptors, MHC proteins and antibodies use editable family cartoons. These are not atomic structures, quantitative dimensions, expression measurements or species-specific sequence models.
* Exact normalized names, explicit aliases and a few bounded family-name patterns select illustrations. Gene/DNA/RNA nodes, compartments, complexes and process names retain their source semantics. Unrecognized names retain the generic source representation. No biological relations are inferred.
* Symbol coverage is extensible, not an exhaustive inventory of every cytokine or membrane protein across all organisms. Additional family members may share a family silhouette and retain their original label.
* Original source identifiers, source-element IDs and pathway IDs are preserved. Imported labels remain editable. Figures are independent SVG objects and connection paths do not reroute automatically. Dense source layouts may need manual spacing after illustration replacement.

Registry and matching: `src/biological-figures.js`. Native cell artwork is embedded using `node scripts/build-biological-cells.mjs`; rebuild after editing the underlying cell SVGs. Regenerate the downloadable gallery with `node scripts/build-pathway-elements.mjs`. No remote images are required at rendering time.

Family naming references: [IUPHAR ligand families](https://www.guidetopharmacology.org/GRAC/LigandFamiliesForward), [IUPHAR chemokine receptors](https://www.guidetopharmacology.org/GRAC/FamilyIntroductionForward?familyId=14). Shared silhouettes are schematic design choices and do not imply identical protein folds within a family.

Validation includes all collection SVGs, safe metadata round trips, exact alias/false-positive cases, and a GPML import with cells and cytokines. Manual QA of WikiPathways WP530 recognized 24 cell objects and 75 molecules among 160 total objects, preserving its source layout and returning to the drawing page after import.
