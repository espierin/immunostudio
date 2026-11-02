import { JSDOM } from "jsdom";
import { readFile, writeFile } from "node:fs/promises";
import * as T from "three";
import { buildBasisVolume } from "../src/basis3d.js";
import { isHemisphereCell } from "../src/cell-look.js";
import { moleculeInfo } from "../src/molecule-catalog.js";
const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;
globalThis.XMLSerializer = dom.window.XMLSerializer;
const catalog = JSON.parse(await readFile("public/library/index.json", "utf8"));
const report = [];
for (const asset of catalog) {
  let model;
  try {
    model = await buildBasisVolume(
      await readFile("public/library/" + asset.file, "utf8"),
      {
        includeLabels: false,
        cell: isHemisphereCell({ name: asset.title, sourceFile: asset.file }),
      },
    );
    const bounds = new T.Box3().setFromObject(model),
      size = bounds.getSize(new T.Vector3());
    if (size.z < 0.0001 || !size.toArray().every(Number.isFinite))
      throw Error("Volume heeft geen eindige diepte.");
    model.traverse((o) => {
      if (o.isMesh) {
        for (const key of ["position", "normal"])
          if (!o.geometry.attributes[key]?.array.every(Number.isFinite))
            throw Error("Ongeldige geometrie: " + key);
      }
    });
    report.push({
      file: asset.file,
      classification: moleculeInfo(asset),
      title: asset.title,
      status: "ok",
      ...model.userData,
      size: size.toArray(),
    });
  } catch (error) {
    report.push({
      file: asset.file,
      title: asset.title,
      status: "error",
      error: error.message,
    });
  } finally {
    model?.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
  }
  if (report.length % 10 === 0)
    console.log(`${report.length}/${catalog.length} gecontroleerd`);
}
await writeFile(
  "docs/3d-bibliotheek-controle.json",
  JSON.stringify(
    {
      date: new Date().toISOString(),
      total: report.length,
      passed: report.filter((r) => r.status === "ok").length,
      assets: report,
    },
    null,
    2,
  ),
);
const failed = report.filter((r) => r.status !== "ok");
console.log(JSON.stringify({ total: report.length, failed }, null, 2));
if (failed.length) process.exitCode = 1;
