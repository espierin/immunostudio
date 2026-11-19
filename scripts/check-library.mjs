import { readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isBasicElement } from "../src/library-policy.js";
import { libraryEntry } from "../src/library-catalog.js";
import {libraryAdditions} from '../src/library-additions.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2),
  online = args.includes("--online"),
  packaged = args.includes("--packaged");
const source = path.resolve(
  args.find((a) => !a.startsWith("--")) ||
    "C:/Users/espierin/Nextcloud/Presentations/Basis_set_2026",
);
const index = JSON.parse(
  await readFile(path.join(root, "public/library/index.json"), "utf8"),
);
const report = JSON.parse(
  await readFile(path.join(root, "public/library/audit.json"), "utf8"),
);
const failures = [],
  hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
if (new Set(index.map((e) => e.file)).size !== index.length)
  failures.push("Duplicate catalog paths");
if (report.publishedCount !== index.length)
  failures.push("Catalog count differs from selection audit");
if (!packaged) {
  const manifest = JSON.parse(
    await readFile(path.join(source, "basis_manifest.json"), "utf8"),
  );
  const expected = [...manifest.components.filter(isBasicElement),...libraryAdditions].map(libraryEntry);
  if (JSON.stringify(expected) !== JSON.stringify(index))
    failures.push("Catalog does not match all eligible source building blocks");
  for (const e of index.filter(e=>!libraryAdditions.some(a=>a.file===e.file)))
    if (
      hash(await readFile(path.join(source, e.file))) !==
      hash(await readFile(path.join(root, "public/library", e.file)))
    )
      failures.push("Local source copy differs: " + e.file);
}
const pathways = JSON.parse(
  await readFile(path.join(root, "public/pathway-elements/index.json"), "utf8"),
).elements;
const files = [
  ...index.map((e) => "library/" + e.file),
  ...pathways.map((e) => "pathway-elements/" + e.type + ".svg"),
];
for (const file of files) {
  const resolved = path.resolve(root, "public", file);
  if (!resolved.startsWith(path.join(root, "public") + path.sep))
    throw Error("Invalid public asset path");
  try {
    if (!(await stat(resolved)).isFile())
      failures.push("Missing packaged SVG: " + file);
  } catch {
    failures.push("Missing packaged SVG: " + file);
  }
}
if (online) {
  const base = "https://espierin.github.io/immunostudio/";
  const remote = await fetch(base + "library/index.json", {
    signal: AbortSignal.timeout(20000),
  });
  if (
    !remote.ok ||
    JSON.stringify(await remote.json()) !== JSON.stringify(index)
  )
    failures.push("Online library index differs from the packaged catalog");
  let next = 0;
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      while (next < files.length) {
        const file = files[next++];
        try {
          const r = await fetch(
            base + file.split("/").map(encodeURIComponent).join("/"),
            { signal: AbortSignal.timeout(20000) },
          );
          const text = await r.text(),
            local = await readFile(path.join(root, "public", file), "utf8");
          if (!r.ok || !text.includes("<svg"))
            failures.push(
              "Online SVG missing or invalid: " + file + " (" + r.status + ")",
            );
          else if (text.replace(/\r\n/g, "\n") !== local.replace(/\r\n/g, "\n"))
            failures.push("Online SVG differs: " + file);
        } catch (error) {
          failures.push(
            "Online request failed: " + file + " (" + error.message + ")",
          );
        }
      }
    }),
  );
}
console.log(
  JSON.stringify(
    {
      basicElements: index.length,
      pathwayElements: pathways.length,
      checkedSVGs: files.length,
      online,
      failures,
    },
    null,
    2,
  ),
);
if (failures.length) process.exitCode = 1;
