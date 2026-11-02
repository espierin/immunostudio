import { readFile, mkdir, copyFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import {isBasicElement} from '../src/library-policy.js';
const source =
  process.argv[2] || "C:/Users/espierin/Nextcloud/Presentations/Basis_set_2026";
const target = path.resolve("public/library");
const manifest = JSON.parse(
  await readFile(path.join(source, "basis_manifest.json"), "utf8"),
);
await mkdir(target, { recursive: true });
const entries = [];
for (const c of manifest.components) {
  if(!isBasicElement(c))continue;
  if (!c.file?.endsWith(".svg")) continue;
  const from = path.resolve(source, c.file);
  if (!from.startsWith(path.resolve(source) + path.sep))
    throw Error("Ongeldig bronpad");
  try {
    await stat(from);
  } catch {
    console.warn("Ontbreekt:", c.file);
    continue;
  }
  const dest = path.join(target, c.file);
  await mkdir(path.dirname(dest), { recursive: true });
  await copyFile(from, dest);
  entries.push({
    file: c.file,
    key: c.key,
    title: c.title || c.key,
    category: c.category || c.categoryFolder || "Overige",
    keywords: [
      c.key,
      c.title,
      c.category,
      c.note,
      ...(Array.isArray(c.searchKeywords)
        ? c.searchKeywords
        : [c.searchKeywords]),
      ...(Array.isArray(c.keywords) ? c.keywords : []),
    ]
      .filter(Boolean)
      .join(" "),
    role: c.assetRole || "Bouwsteen",
  });
}
await writeFile(path.join(target, "index.json"), JSON.stringify(entries));
await copyFile(
  path.join(source, "STIJLSPECIFICATIE.md"),
  path.join(target, "STIJLSPECIFICATIE.md"),
);
console.log(
  `${entries.length} actuele SVG-bestanden gekopieerd; broncollectie ongewijzigd.`,
);
