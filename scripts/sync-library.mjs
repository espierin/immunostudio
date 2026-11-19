import { readFile, mkdir, copyFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { basicElementDecision } from "../src/library-policy.js";
import { libraryEntry } from "../src/library-catalog.js";
import {libraryAdditions} from '../src/library-additions.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.resolve(
  process.argv[2] || "C:/Users/espierin/Nextcloud/Presentations/Basis_set_2026",
);
const target = path.join(root, "public/library");
const sourceManifest = await readFile(
  path.join(source, "basis_manifest.json"),
  "utf8",
);
const manifest = JSON.parse(sourceManifest),
  selected = [],
  excluded = [],
  seen = new Set();
for (const component of manifest.components) {
  const decision = basicElementDecision(component);
  if (!decision.include) {
    excluded.push({ file: component.file, reason: decision.reason });
    continue;
  }
  const from = path.resolve(source, component.file);
  if (!from.startsWith(source + path.sep) || seen.has(component.file))
    throw Error("Invalid or duplicate library path: " + component.file);
  seen.add(component.file);
  // Missing files stop publication before the catalog changes.
  if (!(await stat(from)).isFile())
    throw Error("Missing source SVG: " + component.file);
  selected.push({ component, from });
}
for (const { component, from } of selected) {
  const dest = path.join(target, component.file);
  await mkdir(path.dirname(dest), { recursive: true });
  await copyFile(from, dest);
}
for(const addition of libraryAdditions){
  if(seen.has(addition.file)||!(await stat(path.join(target,addition.file))).isFile())throw Error('Missing or duplicate app figure: '+addition.file);
  seen.add(addition.file);
}
const entries = [...selected.map(({ component }) => libraryEntry(component)),...libraryAdditions.map(libraryEntry)];
await writeFile(path.join(target, "index.json"), JSON.stringify(entries));
await copyFile(
  path.join(source, "STIJLSPECIFICATIE.md"),
  path.join(target, "STIJLSPECIFICATIE.md"),
);
const report = {
  schema: 1,
  sourceCount: manifest.components.length,
  publishedCount: entries.length,
  sourceBuildingBlockCount:selected.length,
  appBuildingBlockCount:libraryAdditions.length,
  sourceManifestHash: createHash("sha256").update(sourceManifest).digest("hex"),
  excludedByReason: Object.fromEntries(
    [...new Set(excluded.map((e) => e.reason))].map((reason) => [
      reason,
      excluded.filter((e) => e.reason === reason).length,
    ]),
  ),
};
await writeFile(
  path.join(target, "audit.json"),
  JSON.stringify(report, null, 2) + "\n",
);
await mkdir(path.join(root, ".local"), { recursive: true });
await writeFile(
  path.join(root, ".local/library-selection-audit.json"),
  JSON.stringify({ ...report, excluded }, null, 2),
);
console.log(
  entries.length +
    " reusable SVG components synchronized from " +
    manifest.components.length +
    " source figures. Source collection unchanged.",
);
