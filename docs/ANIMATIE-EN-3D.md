# Animation, membranes and 3D library — 2 November 2026

The interface starts in English, in 2D, with the Default illustration palette. An explicitly saved Dutch preference is retained. 2D and 3D have separate tools and documents. Switching modes does not create objects. New 3D scenes have no membrane until it is explicitly added.

## Drawing

The right-hand Drawing tab contains selection, grouping, order, rotation, alignment, distribution and page controls. Edit nodes exposes anchors and Bézier controls in individual SVG parts, preserving source transforms and other parts. Add node splits a line, quadratic or cubic segment. SVG arc endpoints can move; arc splitting is not implemented. These operations edit the embedded project copy.

Draw a line, freehand path, rectangle or ellipse and choose Convert to membrane. Open paths become membrane segments; closed paths become bilayer loops. The 3D from 2D drawing command creates linked schematic volumes. Closed loops produce an ellipsoidal vesicle cutaway, with a hollow hemispherical shell and paired lipid tails at the opening rim. General irregular loops currently use their bounding ellipse for this 3D representation. The 2D contour remains editable.

## Animation

The workflow follows Blender's separation of keyframes, interpolation and output frame range: [keyframes](https://docs.blender.org/manual/en/2.90/animation/keyframes/introduction.html), [animation editors](https://docs.staging.blender.org/manual/en/latest/animation/animation_editors.html), [frame range](https://docs.staging.blender.org/manual/en/latest/render/output/properties/frame_range.html), [animation output](https://docs.staging.blender.org/manual/en/latest/render/output/animation.html).

Choose Scene and camera, Selected object or Camera only as the keyframe target. Insert a pose, move the timeline, change position/rotation/scale or camera view and insert the next pose. Independent object and camera tracks generate intermediate poses. Auto keying records subsequent transformations. Each key has editable frame timing and constant, linear or smooth Bézier easing. Smooth Bézier is an ease-in/ease-out curve; this is not Blender's full F-curve, constraint, rigging or NLA system.

Camera actions create an orbit, dolly, zoom or horizontal pan over the render range. Rotate object 360° creates selected-object keys. Playback respects start/end frames and loop. Output offers 12/24/25/30/50/60 fps, frame step, frame range and dimensions. Frame 1 is time zero. Frame steps above one omit frames; encoded playback uses the selected output fps. PNG sequences and local MP4/AVI render every selected frame; WebM records in real time. GIF uses 12 fps and an 800-pixel width, up to 15 seconds. Maximum output is 1801 frames per job. PNG sequences can be cancelled.

## Molecular audit

All 190 curated individual elements were generated and checked for finite positions/normals and nonzero depth: **190 passed**. The catalog classifies 51 cell figures, 70 molecular elements and 69 other elements. Every molecular element has a schematic volume; cells use source-contour cutaways with type-specific rear shapes (see CELL-MORPHOLOGY.md). The machine-readable evidence is in [3d-bibliotheek-controle.json](3d-bibliotheek-controle.json).

19 RCSB entry titles were checked through the RCSB API. 55 catalog elements have a related reference; some share a reference complex. Reference buttons open the existing PDB import and chain-selection workflow. References are explicitly examples of structures, fragments or complexes, not assertions that a cartoon has an exact sequence, allele, peptide, species or isotype match. Other molecules retain a schematic volume and RCSB search. No experimental coordinates are fabricated from a drawing.

## Three improvement rounds

1. Workspace and defaults: separated drawing/properties tabs and 2D/3D controls, ordered palettes, English default, explicit membrane. Browser checked empty 3D switching and palette order.
2. Geometry and interaction: edited SVG nodes, line/ellipse-to-bilayer conversion and vesicle cutaways; scoped object/camera keys and camera actions. Browser checked ellipse conversion, linked 3D vesicle and key creation.
3. Robustness and GUI: fixed the viewport pushing the timeline below the window, made Bézier guide lines ignore pointer input, honoured locked objects, bounded SVG markup cache and avoided copying large coordinate arrays for every animation frame. Added output validation, render-range playback and cancellable PNG sequences. Browser-generated ZIP verified as three 320 × 240 PNGs; local MP4 at 25 fps, AVI at 30 fps and GIF at 12 fps decoded with the expected frame counts. Regression tests cover timing, independent tracks, path splitting, SVG preservation and hollow vesicle geometry.
