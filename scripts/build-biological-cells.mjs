import { readFile, writeFile } from "node:fs/promises";
const entries = JSON.parse(await readFile("public/library/index.json", "utf8"));
const artwork = {};
for (const entry of entries.filter((e) => e.key.endsWith("_receptor_free"))) {
  const svg = await readFile(`public/library/${entry.file}`, "utf8");
  const viewBox = svg.match(/viewBox="([^"]+)"/)[1];
  let body = svg
    .slice(svg.indexOf(">", svg.indexOf("<svg")) + 1, svg.lastIndexOf("</svg>"))
    .replace(/<(title|desc|metadata)\b[^>]*>[\s\S]*?<\/\1>/g, "");
  const ids = [...body.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  for (const id of ids)
    body = body
      .replaceAll(`id="${id}"`, `id="bio-${entry.key}-${id}"`)
      .replaceAll(`url(#${id})`, `url(#bio-${entry.key}-${id})`)
      .replaceAll(`href="#${id}"`, `href="#bio-${entry.key}-${id}"`);
  artwork[entry.key] = { viewBox, body };
}
await writeFile("src/biological-cell-art.json", JSON.stringify(artwork));
console.log(`Embedded ${Object.keys(artwork).length} native cell drawings.`);
