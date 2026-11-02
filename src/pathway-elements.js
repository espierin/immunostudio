const E = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c],
  );
const definitions = [
  [
    "protein",
    "Eiwit",
    "Moleculen",
    "entity",
    "Protein",
    "protein eiwit geneproduct",
  ],
  [
    "receptor",
    "Receptor",
    "Moleculen",
    "entity",
    "Receptor",
    "membrane receptor transmembraan",
  ],
  [
    "ligand",
    "Ligand",
    "Moleculen",
    "entity",
    "Ligand",
    "ligand cytokine chemokine",
  ],
  [
    "enzyme",
    "Enzym",
    "Moleculen",
    "entity",
    "Enzyme",
    "enzyme enzym kinase phosphatase",
  ],
  [
    "metabolite",
    "Metaboliet",
    "Moleculen",
    "entity",
    "Metabolite",
    "chemical metabolite small molecule chebi",
  ],
  [
    "drug",
    "Geneesmiddel",
    "Moleculen",
    "entity",
    "Drug",
    "chemicaldrug drug medicine inhibitor",
  ],
  ["ion", "Ion", "Moleculen", "entity", "Ion", "calcium sodium ion"],
  ["gene", "Gen", "Moleculen", "entity", "Gene", "gene gen dna locus"],
  ["dna", "DNA", "Moleculen", "entity", "DNA", "dna nucleic acid"],
  ["rna", "RNA", "Moleculen", "entity", "RNA", "rna mrna transcript"],
  [
    "complex",
    "Eiwitcomplex",
    "Complexen en groepen",
    "entity",
    "Complex",
    "complex eiwitcomplex assembly",
  ],
  [
    "entity-set",
    "Molecuulverzameling",
    "Complexen en groepen",
    "entity",
    "Entity set",
    "entityset set collection family groep",
  ],
  [
    "multimer",
    "Multimeer",
    "Complexen en groepen",
    "entity",
    "Multimer",
    "multimer dimer oligomer stoichiometry",
  ],
  [
    "unknown",
    "Onbekend molecuul",
    "Complexen en groepen",
    "entity",
    "Unknown",
    "unknown entity fallback unspecified",
  ],
  [
    "subpathway",
    "Deelpathway",
    "Processen",
    "process",
    "Subpathway",
    "processnode encapsulatednode pathway process",
  ],
  [
    "reaction",
    "Reactiestap",
    "Processen",
    "process",
    "Reaction",
    "reaction process transition conversion",
  ],
  [
    "association",
    "Associatie",
    "Processen",
    "process",
    "Association",
    "association binding assembly",
  ],
  [
    "dissociation",
    "Dissociatie",
    "Processen",
    "process",
    "Dissociation",
    "dissociation unbinding",
  ],
  [
    "degradation",
    "Afbraak",
    "Processen",
    "process",
    "Degradation",
    "degradation sink proteasome",
  ],
  [
    "compartment",
    "Compartiment",
    "Compartimenten",
    "compartment",
    "Compartment",
    "compartment organelle location",
  ],
  [
    "cell",
    "Celgebied",
    "Compartimenten",
    "compartment",
    "Cell",
    "cell area cel cytoplasm",
  ],
  [
    "nucleus",
    "Kerngebied",
    "Compartimenten",
    "compartment",
    "Nucleus",
    "nucleus nuclear kern compartment",
  ],
  [
    "vesicle",
    "Vesikelgebied",
    "Compartimenten",
    "compartment",
    "Vesicle",
    "vesicle endosome lysosome",
  ],
  [
    "membrane",
    "Celmembraan",
    "Compartimenten",
    "compartment",
    "Membrane",
    "membrane bilayer celmembraan",
  ],
  [
    "conversion",
    "Omzetting",
    "Verbindingen",
    "edge",
    "Conversion",
    "output arrow conversion reaction product",
  ],
  [
    "reversible",
    "Reversibele omzetting",
    "Verbindingen",
    "edge",
    "Reversible",
    "reversible bidirectional",
  ],
  [
    "activation",
    "Activatie",
    "Verbindingen",
    "edge",
    "Activation",
    "activation stimulation positive regulation",
  ],
  [
    "inhibition",
    "Remming",
    "Verbindingen",
    "edge",
    "Inhibition",
    "inhibition negative regulation tbar",
  ],
  [
    "catalysis",
    "Katalyse",
    "Verbindingen",
    "edge",
    "Catalysis",
    "catalysis catalyst enzyme",
  ],
  [
    "modulation",
    "Modulatie",
    "Verbindingen",
    "edge",
    "Modulation",
    "modulation regulation unspecified influence",
  ],
  [
    "interaction",
    "Interactie",
    "Verbindingen",
    "edge",
    "Interaction",
    "interaction binding association unknown relationship",
  ],
  [
    "translocation",
    "Transport",
    "Verbindingen",
    "edge",
    "Transport",
    "transport translocation compartment",
  ],
  [
    "transcription",
    "Transcriptie",
    "Verbindingen",
    "edge",
    "Transcription",
    "transcription gene expression",
  ],
  [
    "translation",
    "Translatie",
    "Verbindingen",
    "edge",
    "Translation",
    "translation protein synthesis",
  ],
  [
    "annotation",
    "Annotatie",
    "Annotaties",
    "annotation",
    "Note",
    "note annotation label text",
  ],
];
export const pathwayCatalog = definitions.map(
  ([type, title, category, role, label, keywords]) => ({
    type,
    title,
    category,
    role,
    label,
    name: label,
    keywords,
  }),
);
export const pathwayDefinition = (type) =>
  pathwayCatalog.find((d) => d.type === type);
export function newPathwayMetadata(type, label) {
  const d = pathwayDefinition(type);
  if (!d) throw Error("Unknown pathway element");
  return {
    schema: 1,
    type,
    role: d.role,
    label: label ?? d.label,
    state: "",
    stoichiometry: type === "multimer" ? 2 : 1,
    compartment: "",
    identifiers: [],
    members: [],
    source: { database: "manual", elementId: "", pathwayId: "", version: "" },
    ports:
      d.role === "edge"
        ? [
            { id: "input", x: 0.08, y: 60 / 140, role: "input" },
            { id: "output", x: 0.92, y: 60 / 140, role: "output" },
          ]
        : d.role === "annotation"
          ? []
          : [
              { id: "left", x: 0.075, y: 0.48, role: "interface" },
              { id: "right", x: 0.925, y: 0.48, role: "interface" },
            ],
  };
}
export function validatePathwayMetadata(m) {
  const bounded = (v, n) => typeof v === "string" && v.length <= n;
  if (
    !m ||
    m.schema !== 1 ||
    !pathwayDefinition(m.type) ||
    m.role !== pathwayDefinition(m.type).role ||
    !bounded(m.label, 512) ||
    !bounded(m.state, 80) ||
    !bounded(m.compartment, 160) ||
    !Number.isInteger(m.stoichiometry) ||
    m.stoichiometry < 1 ||
    m.stoichiometry > 99
  )
    throw Error("Invalid pathway element metadata.");
  if (
    !Array.isArray(m.identifiers) ||
    m.identifiers.length > 30 ||
    m.identifiers.some(
      (x) => !bounded(x.database, 80) || !bounded(x.id, 256),
    ) ||
    !Array.isArray(m.members) ||
    m.members.length > 100 ||
    m.members.some((x) => !bounded(x, 256))
  )
    throw Error("Invalid pathway references.");
  if (
    !m.source ||
    !["manual", "Reactome", "WikiPathways"].includes(m.source.database) ||
    !["elementId", "pathwayId", "version"].every((k) =>
      bounded(m.source[k], 256),
    )
  )
    throw Error("Invalid pathway source.");
  if (
    !Array.isArray(m.ports) ||
    m.ports.length > 8 ||
    new Set(m.ports.map((p) => p.id)).size !== m.ports.length ||
    m.ports.some(
      (p) =>
        !bounded(p.id, 40) ||
        ![p.x, p.y].every((v) => Number.isFinite(v) && v >= 0 && v <= 1) ||
        !["input", "output", "interface", "regulator"].includes(p.role),
    )
  )
    throw Error("Invalid pathway ports.");
  return m;
}
export function pathwayTypeFor(source, type) {
  const key = String(type || "").toLowerCase();
  const maps = {
    Reactome: {
      protein: "protein",
      chemical: "metabolite",
      chemicaldrug: "drug",
      complex: "complex",
      entity: "unknown",
      entityset: "entity-set",
      gene: "gene",
      rna: "rna",
      processnode: "subpathway",
      encapsulatednode: "subpathway",
      compartment: "compartment",
      input: "interaction",
      output: "conversion",
      activator: "activation",
      inhibitor: "inhibition",
      catalyst: "catalysis",
    },
    WikiPathways: {
      geneproduct: "protein",
      protein: "protein",
      metabolite: "metabolite",
      dna: "dna",
      rna: "rna",
      complex: "complex",
      pathway: "subpathway",
      unknown: "unknown",
      arrow: "conversion",
      tbar: "inhibition",
      "mim-stimulation": "activation",
      "mim-inhibition": "inhibition",
      "mim-catalysis": "catalysis",
      "mim-conversion": "conversion",
      "mim-binding": "association",
    },
  };
  return maps[source]?.[key] || "unknown";
}
function wrapLabel(label) {
  const words = String(label).split(/\s+/),
    lines = [""];
  for (const w of words) {
    const i = lines.length - 1;
    if ((lines[i] + " " + w).trim().length > 22 && lines[i]) lines.push(w);
    else lines[i] = (lines[i] + " " + w).trim();
  }
  return lines
    .slice(0, 3)
    .map(
      (s, i) =>
        s.slice(0, 25) +
        (s.length > 25 || (i === 2 && lines.length > 3) ? "…" : ""),
    );
}
function labelMarkup(m) {
  const d = pathwayDefinition(m.type),
    lines = wrapLabel(m.label),
    edge = d.role === "edge",
    outside = [
      "receptor",
      "gene",
      "dna",
      "reaction",
      "association",
      "dissociation",
      "degradation",
    ].includes(m.type),
    y = outside
      ? 128
      : d.role === "compartment"
        ? 25
        : edge
          ? 112
          : 76 - (lines.length - 1) * 9;
  return `<text data-pathway-label="true" x="${edge ? 150 : 120}" y="${y}" text-anchor="middle" font-size="${edge || outside ? 14 : 16}" fill="#064986">${(outside ? lines.slice(0, 1) : lines).map((line, i) => `<tspan x="${edge ? 150 : 120}" dy="${i ? 18 : 0}">${E(line)}</tspan>`).join("")}</text>`;
}
function stateMarkup(m) {
  return m.state
    ? `<rect x="158" y="10" width="68" height="23" rx="9" fill="#FF5A36" stroke="#064986" stroke-width="1"/><text x="192" y="26" text-anchor="middle" font-size="11" fill="#FFFFFF">${E(m.state.length > 10 ? m.state.slice(0, 9) + "…" : m.state)}</text>`
    : "";
}
function countMarkup(m) {
  return m.stoichiometry > 1
    ? `<text data-pathway-count="true" x="22" y="24" font-size="14" fill="#064986">${m.stoichiometry}×</text>`
    : '<text data-pathway-count="true" x="22" y="24" font-size="14" fill="#064986"></text>';
}
export function pathwaySVG(m) {
  validatePathwayMetadata(m);
  const { type, role } = m,
    edge = role === "edge",
    fill = "#A9C6E2",
    stroke = "#064986";
  let art = "";
  const rect = (x, y, w, h, rx = 0, extra = "") =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" ${extra}/>`;
  const path = (d, extra = "") => `<path d="${d}" ${extra}/>`;
  if (role === "compartment") {
    if (type === "membrane") {
      art = Array.from({ length: 13 }, (_, i) =>
        [43, 89]
          .map(
            (y) =>
              `<path d="M${18 + i * 17} ${y + (y === 43 ? 7 : -7)}l-2 ${y === 43 ? 15 : -15}m5 ${y === 43 ? -15 : 15}l2 ${y === 43 ? 15 : -15}" fill="none"/><ellipse cx="${18 + i * 17}" cy="${y}" rx="7.5" ry="6"/>`,
          )
          .join(""),
      ).join("");
    } else {
      art =
        type === "cell" || type === "vesicle"
          ? '<ellipse cx="120" cy="78" rx="108" ry="54" fill-opacity=".1"/>'
          : rect(12, 10, 216, 120, 16, 'fill-opacity=".1"');
      if (type === "nucleus") art += rect(19, 17, 202, 106, 12, 'fill="none"');
    }
  } else if (edge) {
    const dashed = ["interaction", "transcription", "translation"].includes(
      type,
    )
      ? 'stroke-dasharray="7 5"'
      : "";
    art = path("M24 60C95 60 205 60 276 60", `fill="none" ${dashed}`);
    const arrow = path("M261 49L276 60L261 71Z", `fill="${stroke}"`),
      open = path("M260 48L276 60L260 72Z", 'fill="#FFFFFF"');
    if (
      [
        "conversion",
        "translocation",
        "transcription",
        "translation",
        "reversible",
      ].includes(type)
    )
      art += arrow;
    if (type === "reversible")
      art += path("M39 49L24 60L39 71Z", `fill="${stroke}"`);
    if (type === "activation") art += open;
    if (type === "inhibition") art += path("M276 46V74");
    if (type === "catalysis")
      art += '<circle cx="276" cy="60" r="10" fill="#FFFFFF"/>';
    if (type === "modulation")
      art += path("M264 60L276 48L288 60L276 72Z", 'fill="#FFFFFF"');
    if (type === "translocation")
      art += path("M142 36V84M154 36V84", 'stroke="#A9C6E2" stroke-width="5"');
  } else if (type === "complex")
    art = path("M32 30H208L224 46V94L208 110H32L16 94V46Z");
  else if (type === "entity-set")
    art = rect(16, 28, 208, 82, 18) + rect(24, 36, 192, 66, 13, 'fill="none"');
  else if (type === "multimer")
    art =
      rect(29, 28, 192, 72, 14) +
      rect(22, 35, 192, 72, 14) +
      rect(15, 42, 192, 72, 14);
  else if (["metabolite", "drug", "ion", "ligand"].includes(type)) {
    art = `<ellipse cx="120" cy="70" rx="${type === "ion" ? 48 : type === "ligand" ? 66 : 96}" ry="42"/>`;
    if (type === "drug")
      art +=
        rect(190, 89, 35, 22, 3, 'fill="#FFFFFF"') +
        '<text x="207" y="105" text-anchor="middle" fill="#064986" stroke="none" font-size="12">Rx</text>';
  } else if (type === "gene")
    art =
      path("M20 106V38H202V21L225 40L202 59V46H20", 'fill="none"') +
      rect(20, 62, 184, 44, 9);
  else if (type === "dna")
    art =
      path("M16 40C68 4 160 98 224 52L224 100C160 146 68 52 16 88Z") +
      path(
        "M30 37L30 83M62 39L62 87M96 55L96 104M132 70L132 119M168 78L168 125M204 66L204 113",
        'fill="none" stroke-width="1.5"',
      );
  else if (type === "rna")
    art = path(
      "M34 32H206Q230 32 222 70Q230 108 206 108H34Q10 108 18 70Q10 32 34 32Z",
    );
  else if (type === "receptor")
    art = path(
      "M102 120V72L64 32Q58 24 67 19L80 15L120 57L160 15L174 20Q182 25 176 33L138 74V120Z",
    );
  else if (type === "enzyme")
    art = path(
      "M18 70Q18 24 66 24H174Q220 24 220 56L196 70L220 85Q220 112 176 112H64Q18 112 18 70Z",
    );
  else if (type === "unknown")
    art = rect(18, 30, 204, 80, 4, 'stroke-dasharray="6 4"');
  else if (type === "subpathway")
    art =
      path("M40 28H200L225 70L200 112H40L15 70Z") +
      path(
        "M46 37H194L214 70L194 103H46L26 70Z",
        'fill="none" stroke-width="1"',
      );
  else if (type === "reaction")
    art = rect(96, 46, 48, 48, 2) + path("M24 70H96M144 70H216", 'fill="none"');
  else if (type === "association")
    art =
      path("M24 36L120 70L216 36M120 70V119", 'fill="none"') +
      '<circle cx="120" cy="70" r="9" fill="#064986"/>';
  else if (type === "dissociation")
    art =
      path("M24 36L120 70L216 36M120 70V119", 'fill="none"') +
      '<circle cx="120" cy="70" r="12" fill="#FFFFFF"/><circle cx="120" cy="70" r="7" fill="#FFFFFF"/>';
  else if (type === "degradation")
    art =
      '<circle cx="120" cy="70" r="30" fill="#FFFFFF"/>' +
      path("M94 97L146 43", 'fill="none"');
  else if (type === "annotation")
    art =
      path("M28 18H190L216 44V121H28Z", 'fill="#FFFFFF"') +
      path("M190 18V44H216", 'fill="none"');
  else art = rect(18, 30, 204, 80, 16);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${edge ? 300 : 240} 140" width="${edge ? 300 : 240}" height="140"><title>${E(m.label)}</title><metadata data-pathway-metadata="true">${E(JSON.stringify(m))}</metadata><g fill="${fill}" stroke="${stroke}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">${art}</g><g font-family="Calibri,Arial,sans-serif">${labelMarkup(m)}<g data-pathway-state="true">${stateMarkup(m)}</g>${countMarkup(m)}</g></svg>`;
}
export function makePathwayItem(type, id, overrides = {}) {
  const m = { ...newPathwayMetadata(type), ...structuredClone(overrides) };
  validatePathwayMetadata(m);
  const compartment = m.role === "compartment",
    edge = m.role === "edge";
  const base = {
    id,
    kind: "svg",
    name: m.label,
    x: 0,
    y: 0,
    w: compartment ? 500 : edge ? 320 : 240,
    h: compartment ? 300 : 140,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    volumeLook: false,
    svg: pathwaySVG(m),
    pathway: m,
  };
  if (type === "membrane")
    return {
      ...base,
      kind: "membrane",
      svg: undefined,
      w: 600,
      h: 120,
      curve: [
        [0.02, 0.5],
        [0.34, 0.5],
        [0.66, 0.5],
        [0.98, 0.5],
      ],
      bilayerThickness: 34,
    };
  return base;
}
export function updatePathwayItem(item, key, value) {
  const m = structuredClone(item.pathway);
  if (key === "identifiers")
    m.identifiers = String(value)
      .split(/\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const i = s.indexOf(":");
        return {
          database: i < 0 ? "Other" : s.slice(0, i).trim(),
          id: i < 0 ? s : s.slice(i + 1).trim(),
        };
      });
  else if (key === "members")
    m.members = String(value)
      .split(/\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  else if (key === "stoichiometry") m.stoichiometry = Number(value);
  else if (["label", "state", "compartment"].includes(key))
    m[key] = String(value);
  else throw Error("Unknown pathway field");
  validatePathwayMetadata(m);
  if (item.svg) {
    item.svg = item.svg
      .replace(
        /<title(?:\s[^>]*)?>[\s\S]*?<\/title>/,
        () => `<title>${E(m.label)}</title>`,
      )
      .replace(
        /<metadata\b[^>]*data-pathway-metadata="true"[^>]*>[\s\S]*?<\/metadata>/,
        () =>
          `<metadata data-pathway-metadata="true">${E(JSON.stringify(m))}</metadata>`,
      )
      .replace(
        /<text\b[^>]*data-pathway-label="true"[^>]*>[\s\S]*?<\/text>/,
        () => labelMarkup(m),
      )
      .replace(
        /<g\b[^>]*data-pathway-state="true"[^>]*?(?:\/>|>[\s\S]*?<\/g>)/,
        () => `<g data-pathway-state="true">${stateMarkup(m)}</g>`,
      )
      .replace(
        /<text\b[^>]*data-pathway-count="true"[^>]*?(?:\/>|>[\s\S]*?<\/text>)/,
        () => countMarkup(m),
      );
  }
  item.pathway = m;
  if (key === "label") item.name = m.label;
  return item;
}
export function pathwayPorts(item) {
  return item.pathway.ports.map((p) => {
    const x = (item.mirrorX ? 1 - p.x : p.x) * item.w - item.w / 2,
      y = (item.mirrorY ? 1 - p.y : p.y) * item.h - item.h / 2,
      a = ((item.rotation || 0) * Math.PI) / 180;
    return {
      ...p,
      x: item.x + item.w / 2 + x * Math.cos(a) - y * Math.sin(a),
      y: item.y + item.h / 2 + x * Math.sin(a) + y * Math.cos(a),
    };
  });
}
export function pathwayProperties(item) {
  const m = item?.pathway;
  if (!m) return "";
  const field = (key, label, value) =>
    `<label>${label}<input ${key === "stoichiometry" ? 'type="number" min="1" max="99" step="1"' : `maxlength="${key === "state" ? 80 : 160}"`} data-pathway-field="${key}" value="${E(value)}" ${item.locked ? "disabled" : ""}></label>`;
  return `<details open class="pathway-properties"><summary>Pathway-bouwsteen</summary><div class="details-body"><p data-no-translate>${E(pathwayDefinition(m.type).name)} · ${E(m.source.database)}</p><p class="muted">Naam wijzigt ook het label. Punten bewerken blijft beschikbaar.</p>${field("state", "Toestand / modificatie", m.state)}${field("compartment", "Celcompartiment", m.compartment)}${field("stoichiometry", "Stoichiometrie", m.stoichiometry)}<label>Database-ID’s (één per regel)<textarea data-pathway-field="identifiers" ${item.locked ? "disabled" : ""} placeholder="UniProt:P31749">${E(m.identifiers.map((x) => x.database + ":" + x.id).join("\n"))}</textarea></label>${["complex", "entity-set", "multimer"].includes(m.type) ? `<label>Componenten (metadata)<textarea data-pathway-field="members" ${item.locked ? "disabled" : ""}>${E(m.members.join("\n"))}</textarea></label>` : ""}<button data-sheet-action="pathway-reset" ${item.locked ? "disabled" : ""}>Standaardsymbool herstellen</button><p class="muted">Bewerkbare schema-elementen. Automatische pathway-import volgt later.</p></div></details>`;
}
