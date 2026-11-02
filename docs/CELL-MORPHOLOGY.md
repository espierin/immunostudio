# Cell morphology in 3D — 2 November 2026

The 3D cell body now uses a cell-type profile and the original 2D outline. The front remains an open illustration cutaway with its nucleus, granules and organelles. Depth values are schematic proportions, not measured cell dimensions or a reconstruction of microscopy.

| Cell group | Construction |
|---|---|
| Erythrocyte | Thin rear disc with a central depression; shallow source detail layers avoid a raised central bubble. |
| Platelet | Flattened, lobed disc retaining the original outline. |
| Dendritic cell | Concave source footprint with tapered, thin processes; no circular rear surface spans the spaces between processes. |
| Macrophage / monocyte | Source footprint with an asymmetric rounded rear and locally tapered extensions. The source kidney-shaped nucleus remains visible. |
| Plasma cell | Ovoid cutaway based on the original proportions and eccentric nucleus. |
| Cardiomyocyte | Elongated source contour and reduced rear depth, retaining source striations and branches where present. |
| Epithelial cell | Source columnar/polygonal footprint, with a shallow rounded rear rather than a circular body. |
| Apoptotic / graft / infected / leukemic target | Original target-cell contour with a less regular rear; no diagnosis inferred from shape. |
| T/B/NK and granular immune cells | Relatively rounded bodies where appropriate. Source shape, lobulated nuclei and granules provide the distinctions; artificial lineage-specific outer shapes are not invented. |

Profiles apply to all matching curated cell variants, including receptor-free and receptor-bearing drawings. The cell classifier uses a file's basename rather than its parent directory, so an individual cell stored under “context” is not incorrectly excluded. Molecules, cell membrane patches, bags and tubes retain their own geometry.

For concave cells, the rear is triangulated inside the actual source silhouette. Distance to the boundary controls local thickness, keeping fine processes thin and preserving genuine holes. Round/ovoid profiles retain the source rim and proportions. Contours, nucleus position and organelle content are taken from the user's 2D figures; external images are references only and are not copied into the app.

References consulted:

- [University of Leeds: erythrocytes, including a scanning electron micrograph](https://histology.leeds.ac.uk/home/blood/blood_rbc/): biconcave disc morphology.
- [University of Leeds: white blood cells](https://histology.leeds.ac.uk/home/blood/blood_wbc/): nuclear shape and cytoplasmic granules as distinguishing features.
- [ATCC: macrophage and dendritic-cell differentiation](https://www.atcc.org/resources/application-notes/in-vitro-differentiation-of-macrophages-and-dendritic-cells): microscopy examples and variation with differentiation/culture state.
- [Columbia University: cardiac muscle](https://histologylab.ctl.columbia.edu/lab06/cardiac-muscle/): branched cylindrical cardiomyocytes.
- [Duke University: connective tissue and blood](https://histology.oit.duke.edu/MBS/CellSci/CS-ConnTissueBlood/CS-ConnTissueBlood.html): plasma cells and blood-cell morphology.

Verification includes profile selection, flattened erythrocyte depth and central depression, finite surface normals, a concave L-shaped footprint that cannot be reproduced correctly by a radial sphere, existing membrane/animation regressions and the complete 190-element geometry audit.
