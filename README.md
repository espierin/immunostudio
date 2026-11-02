# ImmunoStudio 0.2

Online: **https://espierin.github.io/immunostudio/**

Detailed user manuals: [English](public/manual/en.html) · [Nederlands](public/manual/nl.html). Both have a table of contents, practical tutorials, eleven captioned screenshots/detail views, export reference and print/PDF layout. Click any illustration to open the original screenshot. Online: [English](https://espierin.github.io/immunostudio/manual/en.html) · [Nederlands](https://espierin.github.io/immunostudio/manual/nl.html). Regenerate after editing: `node scripts/build-manuals.mjs`.

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
