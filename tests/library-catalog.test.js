import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { createRequire } from "node:module";
// Reuse jsdom's XML tokenizer without constructing a DOM for every thumbnail.
const { SaxesParser } = createRequire(import.meta.resolve('jsdom'))('saxes');
import { isBasicElement, basicElementDecision } from "../src/library-policy.js";
import { libraryEntry } from "../src/library-catalog.js";
test("descriptive schematic titles and explicit loose module components remain available", () => {
  for (const component of [
    {
      file: "10_Laboratorium_en_context/basic_220_flow_cytometry_stream.svg",
      title: "Flow cytometry fluidics schematic",
    },
    { file: "x/basic_191_alveolar_sac.svg", title: "Alveolar sac schematic" },
    {
      file: "x/basic_513_TB01_01_Bacterial_PAMP.svg",
      moduleSet: "TB01",
      textbookModule: "TB01",
      assetRole: "Losse bouwsteen",
    },
    {
      file: "x/basic_893_FC01_01_Hydrodynamic_focusing_with_sheath_fluid.svg",
      moduleSet: "FC01",
      flowModule: "FC01",
      assetRole: "Losse bouwsteen",
    },
    {
      file: "03_Synapsen_en_alloherkenning/basic_999_protein.svg",
      title: "Protein",
      assetRole: "Losse bouwsteen",
    },
  ])
    assert.equal(isBasicElement(component), true, component.file);
  assert.equal(
    basicElementDecision({
      file: "x/basic_220_flow.svg",
      title: "Flow schematic",
    }).reason,
    "legacy-building-block",
  );
});
test("composites, tables and unclassified teaching scenes stay outside the basic collection", () => {
  for (const c of [
    { file: "x/basic_1_overview.svg", assetRole: "Losse bouwsteen" },
    {
      file: "x/basic_2_compensation_matrix.svg",
      title: "Compensation matrix",
      assetRole: "Losse bouwsteen",
    },
    { file: "x/basic_3_table.svg", title: "Table" },
    { file: "x/basic_4.svg", assetRole: "Samengesteld voorbeeld" },
    { file: "x/basic_5.svg", assetRole: "Bouwsteen / concept" },
    { file: "x/basic_61_contact_HLA_TCR.svg", title: "HLA TCR contact" },
    { file: "x/basic_556_scene.svg", moduleSet: "TB11" },
    {
      file: "x/basic_957.svg",
      assetRole: "Cel met één vergroot receptorcomplex",
    },
  ])
    assert.equal(isBasicElement(c), false, c.file);
  assert.equal(
    isBasicElement({
      file: "x/basic_1200_extracellular_matrix.svg",
      title: "Extracellular matrix protein",
      assetRole: "Losse bouwsteen",
    }),
    true,
  );
});
test("flow cytometry can be found using instrument, method and Dutch search terms", () => {
  const entry = libraryEntry({
    file: "x/basic_220_flow_cytometry_stream.svg",
    key: "flow_cytometry_stream",
    title: "Flow cytometry fluidics schematic",
    category: "Laboratorium",
  });
  for (const query of [
    "flow cytometer",
    "flowcytometer",
    "flowcytometrie",
    "cytometer",
    "FACS",
  ])
    assert.ok(
      query
        .toLowerCase()
        .split(/\s+/)
        .every((word) => entry.keywords.toLowerCase().includes(word)),
      query,
    );
  const sanitized = libraryEntry({
    file: "x.svg",
    title: "Cell\u2014receptor free",
    note: "A\u2013B",
    category: "Cells",
  });
  assert.doesNotMatch(JSON.stringify(sanitized), /[\u2012-\u2015\u2212]/);
});
test("every published basic and pathway figure has a packaged SVG, including the flow cytometer", async () => {
  const base = new URL("../public/", import.meta.url);
  const index = JSON.parse(
    await readFile(new URL("library/index.json", base), "utf8"),
  );
  const audit = JSON.parse(
    await readFile(new URL("library/audit.json", base), "utf8"),
  );
  assert.equal(index.length, audit.publishedCount);
  assert.equal(new Set(index.map((e) => e.file)).size, index.length);
  assert.ok(index.some((e) => e.key === "flow_cytometry_stream"));
  const pathways = JSON.parse(
    await readFile(new URL("pathway-elements/index.json", base), "utf8"),
  ).elements;
  for (const file of [
    ...index.map((e) => "library/" + e.file),
    ...pathways.map((e) => "pathway-elements/" + e.type + ".svg"),
  ]) {
    assert.ok(!file.includes(".."), "no traversal");
    assert.equal((await stat(new URL(file, base))).isFile(), true, file);
    const xml=await readFile(new URL(file,base),'utf8'),parser=new SaxesParser({xmlns:true});
    let firstTag;
    parser.on('opentag',tag=>{firstTag??=tag.local;});
    assert.doesNotThrow(()=>parser.write(xml).close(),file);
    assert.equal(firstTag,'svg',file);
  }
});
