# ImmunoStudio 0.2

Online: **https://espierin.github.io/immunostudio/**

Detailed user manuals: [English](public/manual/en.html) · [Nederlands](public/manual/nl.html). Both have a table of contents, practical tutorials, fifteen captioned screenshots/detail views, export reference and print/PDF layout. Click any illustration to open the original screenshot. Online: [English](https://espierin.github.io/immunostudio/manual/en.html) · [Nederlands](https://espierin.github.io/immunostudio/manual/nl.html). Regenerate after editing: `node scripts/build-manuals.mjs`.

2D sculpting: open **Sculpt & modifiers** to push/pull, inflate, deflate or smooth individual cell/tissue contours. The floating panel can be dragged, expanded and minimized. Contour modifiers provide smooth, simplify, inset/outset and whole-object mirrors. Choose **Use as membrane**, then **Attach selection** on separate molecules to keep them perpendicular while the membrane deforms. Line construction also supports plain strokes, lipid bilayers, endothelium, stratified skin and intestinal epithelium, with independent interior fill. Bézier handles extend freely beyond the original line box. Enclosed SVG cell interiors deform with the boundary. See manual sections 5a–5c for grouped receptors, anchor settings and supported geometry.

Een lokale en online 2D-/3D-werkplaats voor immunologische illustraties, met een Nederlands/Engelse interface en UMC Utrecht-opmaak. Projecten en eigen modellen worden op het apparaat in de browser bewaard. Gebruik een `.immuno`-download om projecten tussen de online en lokale versie over te zetten.

GitHub Pages ondersteunt PNG, SVG, projectbestanden en browserexport. EMF/WMF en de native MP4/AVI/GIF-encoder vereisen de lokale versie. Publicatie wordt automatisch getest, gebouwd en uitgevoerd via `.github/workflows/pages.yml`.
| EMF / WMF | Lokale Inkscape-conversie; 2D vector, 3D ingesloten afbeelding. Fonts standaard omgezet naar lettercontouren |
| MP4 | Lokale FFmpeg, H.264, instelbare framerate en afmetingen |
| AVI | Lokale FFmpeg, Motion JPEG, instelbare framerate |
| GIF | Lokale FFmpeg met gedeeld palet en dithering, 12 fps, 800 pixels, maximaal 15 s |
| WebM | Browsercodec indien beschikbaar; opname in werkelijke tijd |
| PNG-reeks | ZIP met vaste tijdstappen |

MP4, AVI en GIF verwerken frames op dit apparaat. Ze worden niet naar een externe renderdienst verstuurd. Voor die formaten biedt de editor voortgang en annuleren. PDB-zoeken en ophalen gebruiken wel internet.

## Grenzen van deze versie

Dit is een werkende eerste editor, geen afgeronde uitvoering van alle oorspronkelijke productspecificaties. Het membraan ondersteunt gekoppelde kubische Béziersegmenten met extra punten en een geëxtrudeerde diepte. De ingebouwde cartoons zijn schematische 3D-domeinmodellen. De gelobde variant is eveneens schematisch; hij wordt niet gepresenteerd als een PDB-afgeleid moleculair oppervlak. Geïmporteerde structuren tonen van der Waals-atoombollen of de CA/P-ruggengraat.

Automatische reconstructie van ontbrekende receptorregio’s met UniProt/SIFTS/AlphaFold, algemene residu- en domeinrigging, signaalankers, meerdere gekoppelde scharnieren, focusovergangen, gesloten celoppervlakken en echte moleculaire oppervlakteberekening zijn nog niet geïmplementeerd. De uniforme membraanuitsparing is momenteel voor het referentiekanaal beschikbaar. Geïmporteerde structuren vereisen handmatige controle van anker, oriëntatie en schaal. Moleculaire dynamica wordt niet gesimuleerd.


## Verificatie

```powershell
npm test
npm run check-encoders
npm run build
```

De geometrie- en modeltests controleren membraanankers, porie-uitsparing, scharniergedrag, vier diepteniveaus, follow-me, interpolatie en structuurparsers. De encodertest maakt en decodeert zes seconden MP4 (150 frames bij 25 fps), AVI (180 frames bij 30 fps) en GIF (72 frames). Browsercontrole omvat de 3D-scène, het zoeken en invoegen van een actuele TCR-SVG en een echte MP4-export vanuit de editor.

## 2D-bediening en stijlen

Kies **2D**. Sleep losse elementen met Selecteren of Verplaatsen. Gebruik de ronde greep boven de selectie of de knop Draaien; Shift begrenst de hoek tot stappen van 15°. Positie en hoek zijn ook numeriek in te stellen. Vergrendelde elementen moeten eerst worden ontgrendeld. Cellen hebben standaard zachte volumewerking, per cel uit te schakelen. Tekst, pijlen, vormen, vrije lijnen, groeperen, uitlijnen, lagen en ongedaan maken zijn beschikbaar.

Teken met **Membraan** een lipidendubbellaag. Versleep de groene curvepunten en oranje handvatten. **Punt toevoegen** of dubbelklikken voegt een punt toe zonder de bestaande curve te vervormen. Dit werkt ook in 3D.

De stijlen omvatten **UMC Utrecht**, **EFI**, **Nordic Light** en **Nordic Dark**, afgeleid van de opgegeven lokale projecten. **Labels** schakelt alle tekstlabels gezamenlijk aan of uit, ook in de export.

EMF/WMF vereist de geïnstalleerde Inkscape-exporter. Lettercontouren bewaren de exacte fontvorm op andere computers; het zijn geen ingebedde, bewerkbare fonts. De 2D-volumekleuring blijft vectorgebaseerd, maar oudere Office-importers kunnen gradiënten vereenvoudigen. Gebruik EMF voor Office en SVG voor behoud van moderne vectorinformatie.
## 3D-varianten van 2D-bouwstenen

Wissel naar 3D en kies **3D uit 2D-tekening** voor de geschikte vectoren en membranen op het 2D-tekenblad. De varianten zijn gekoppeld aan de 2D-bron; opnieuw openen maakt geen duplicaat. De bron blijft op het tekenblad. Een bestaande 3D-variant wordt behouden wanneer de 2D-bron later verandert. Het zijn schematische, afgeronde volumes, geen voorspelde eiwitstructuren. GLB-export staat in de eigenschappen van het 3D-model.

De hele collectie is gecontroleerd op eindige geometrie en daadwerkelijke diepte: **190/190**. Details en eventuele beperkingen per figuur staan in `docs/3d-bibliotheek-controle.json`. Opnieuw controleren: `node scripts/check-basis-volumes.mjs`.

## Nederlands en Engels

Kies **Nederlands** of **English** in de kopbalk. De interface, uitlegteksten, meldingen en dialoogvensters wisselen direct van taal. De keuze wordt op dit apparaat bewaard. Projectnamen, eigen objectnamen en tekst in de illustraties blijven intact. Pictogramknoppen en eigenschapspictogrammen hebben verklarende hoverteksten in de gekozen taal.

## Celtype-afhankelijke 3D-doorsneden

De 3D-cellen volgen de oorspronkelijke 2D-contour met een celtype-afhankelijke achterkant. Dendritische cellen behouden dunne uitlopers; erytrocyten krijgen een afgeplatte schijf met centrale indeuking en bloedplaatjes worden plat. Macrofagen en monocyten krijgen een asymmetrische achterzijde. Cardiomyocyten en epitheelcellen behouden hun langgerekte of hoekige contour. Lymfocyten blijven waar passend relatief rond. De oorspronkelijke kern en organellen blijven vooraan zichtbaar. Volumediepte past de schematische diepte aan. Zie [celvormen en referenties](docs/CELL-MORPHOLOGY.md).

2D optimization review (three rounds): closed tissue seams now wrap correctly and locked objects resist double-click/anchor edits; floating controls preserve collapsed sections and focus, with unavailable actions disabled; unchanged curve artwork is reused and SVG contour discovery avoids repeated DOM scans. Validation: 54 tests pass plus browser checks for sculpting, undo and persistent panel state. A local 100-redraw geometry benchmark measured approximately 390 ms regenerating a skin layer versus 0.1 ms reusing unchanged artwork; this excludes browser DOM layout and painting.

2D bilayers pack the two leaflets independently along their actual offset-edge lengths. Outside and inside curves may contain different lipid counts, while both retain close head spacing, normal tails and an evenly filled closed seam.

## Ten improvement rounds

| Round | Delivered |
|---|---|
| 1 | Home screen, current local workspace summary and safe resume/open flows |
| 2 | Original scientific vector hero artwork and responsive home layout |
| 3 | Editable membrane/receptor and tissue starters, with replacement confirmation |
| 4 | Ctrl+K/F3 command search, bilingual matching and keyboard navigation |
| 5 | Contextual duplicate/mirror/layer/lock/group/alignment controls |
| 6 | Persistent library favorites and empty-search recovery |
| 7 | F9 focus mode, panel space and layout reset |
| 8 | Fit-selection navigation, 16:9/square/A4-ratio page presets and Ctrl+S backup |
| 9 | Binary arc-length lookup, debounced search, no hidden or duplicate 3D rebuilds |
| 10 | Accessibility, English/Dutch wording, contrast, browser regression checks and manuals |

References: [Inkscape welcome and command palette](https://wiki.inkscape.org/wiki/index.php/Release_notes/1.1), [Blender command search](https://docs.blender.org/manual/en/4.0/interface/controls/templates/operator_search.html), [BioRender contextual canvas](https://help.biorender.com/hc/en-gb/articles/26447997366173-How-to-use-the-BioRender-canvas). Graphics and code are original. Regenerate the opening artwork with `node scripts/build-opening-art.mjs`. See manual section 2a for the new workflow.

## Pathway building blocks

The 2D Pathway elements tab contains 35 original editable schematic symbols in six categories. Geometry, labels, state/modification, stoichiometry, compartments, identifiers, complex members, source provenance and normalized connection ports are represented separately. Project validation and `.immuno` files preserve the metadata; generated SVGs carry portable metadata too. Label/state edits preserve customized vector geometry. The membrane entry uses the existing native bilayer editor. Compartments are placed behind other objects.

[Symbol gallery](https://espierin.github.io/immunostudio/pathway-elements/) · [English instructions](https://espierin.github.io/immunostudio/manual/en.html#pathway) · [Nederlandse uitleg](https://espierin.github.io/immunostudio/manual/nl.html#pathway). Generate the original SVGs and gallery with `node scripts/build-pathway-elements.mjs`.

`pathwayTypeFor` provides initial Reactome/GPML class mappings with an explicit unknown fallback; `pathwayPorts` returns transformed port coordinates. These are foundations for a future importer. The header menu **Pathways → Search pathways…** now searches Reactome, WikiPathways and Pathway Commons by molecule name, pathway ID or partial pathway name. Filter by database and organism, open the original pathway or copy its stable ID. Reactome molecule results come from entity-to-pathway membership; WikiPathways uses its official current JSON search index (cached in memory for one hour). Searches require internet access. Broad searches show at most 50 pathways per source; Reactome and Pathway Commons check at most 8 matched molecular entities and report the limit. Pathway Commons also displays the original provider (for example NetPath or Reactome); results can overlap with direct Reactome records. **Pathways → Immunology and cell biology…** offers 15 verified human reference pathways, including MHC-I/MHC-II, cross-presentation, TCR/BCR, complement and autophagy. The registry in `src/pathway-topics.js` stores stable source IDs, species and verification dates for future additions. **KEGG (external website)…** opens external website searches or exact map IDs such as `hsa04612`. Its results remain on KEGG: direct browser API requests lack CORS support, and API use is subject to academic-use conditions. No KEGG dataset is mirrored. Click a result title or **Place on drawing page** to import editable 2D objects. Reactome diagram JSON and WikiPathways GPML preserve source placements; other Pathway Commons records use BioPAX with an automatic layout. KEGG KGML can be imported locally through **Import pathway file…**. New pathways are appended below existing artwork, and insertion is one Undo step. Source metadata survives project downloads. Imported connections remain independent objects and do not reroute automatically when a molecule moves. Limits: 4,000 objects per page, 10,000-unit page extent, 12 MB source payload and 45-second request timeout. The symbols do not claim full SBGN/GPML conformance. References: [Reactome diagram specification](https://reactome.org/dev/diagram/pathway-diagram-specs), [GPML schema](https://github.com/PathVisio/GPML).
