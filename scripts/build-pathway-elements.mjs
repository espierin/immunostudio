import { mkdir, writeFile } from "node:fs/promises";
import {
  pathwayCatalog,
  newPathwayMetadata,
  pathwaySVG,
} from "../src/pathway-elements.js";
await mkdir("public/pathway-elements", { recursive: true });
for (const d of pathwayCatalog)
  await writeFile(
    `public/pathway-elements/${d.type}.svg`,
    pathwaySVG(newPathwayMetadata(d.type)),
  );
await writeFile(
  "public/pathway-elements/index.json",
  JSON.stringify(
    {
      version: 1,
      scope: "Original editable schematic glyphs; no live pathway import.",
      elements: pathwayCatalog,
    },
    null,
    2,
  ),
);
const gallery = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ImmunoStudio · Pathway elements</title><style>body{font:15px/1.5 system-ui;color:#002b49;background:#edf3f7;margin:0}header{background:#002b49;color:white;padding:28px max(24px,calc((100% - 1150px)/2))}header a{color:white}main{max-width:1150px;margin:auto;padding:24px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(205px,1fr));gap:14px}article{background:white;border:1px solid #d8e3ea;border-radius:10px;padding:14px}article img{width:100%;height:125px;object-fit:contain}h2{font-size:21px}h3{font-size:15px;margin:8px 0}a{color:#0077b6}small{color:#577184}</style><header><a href="../">← ImmunoStudio</a><h1>Pathway building blocks</h1><p>${pathwayCatalog.length} original 2D symbols · editable SVG · semantic metadata</p></header><main><p>Open ImmunoStudio → 2D → Pathway elements to place these symbols. Names, state badges, database IDs and compartments can be edited in Properties. Source geometry remains editable with Edit nodes. Membranes use the native bilayer curve tool.</p>${[
  ...new Set(pathwayCatalog.map((d) => d.category)),
]
  .map(
    (category) =>
      `<h2>${{ Moleculen: "Molecules", "Complexen en groepen": "Complexes & sets", Processen: "Processes", Compartimenten: "Compartments", Verbindingen: "Connections", Annotaties: "Annotations" }[category] || category}</h2><div class="grid">${pathwayCatalog
        .filter((d) => d.category === category)
        .map(
          (d) =>
            `<article><img src="${d.type}.svg" alt="${d.name}"><h3>${d.name}</h3><small>${d.role} · ${d.type}</small><p><a href="${d.type}.svg" download>Download SVG</a></p></article>`,
        )
        .join("")}</div>`,
  )
  .join(
    "",
  )}<p>Use the ImmunoStudio header menu Pathways → Search pathways to search Reactome and WikiPathways. Class adapters are prepared in the code; automatic full pathway import is not available yet. These diagrams are schematic and are not a claim of full SBGN or GPML conformance.</p></main></html>`;
await writeFile("public/pathway-elements/index.html", gallery);
console.log(`Generated ${pathwayCatalog.length} pathway symbols and gallery.`);
