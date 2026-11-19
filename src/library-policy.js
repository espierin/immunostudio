/** Select reusable components using explicit source roles before module labels. */
export function basicElementDecision(c) {
  if (!c.file?.endsWith(".svg"))
    return { include: false, reason: "unsupported-file" };
  const role = String(c.assetRole || "")
    .toLowerCase()
    .trim();
  const basename = c.file.split(/[\\/]/).at(-1);
  const text = [c.key, c.title, basename]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replaceAll("_", " ");
  if (/samengesteld|samengestelde/.test(role))
    return { include: false, reason: "composite-role" };
  if (role && !/^(losse bouwsteen|bouwsteen)$/.test(role))
    return { include: false, reason: "concept-or-context-role" };
  if (
    /\b(table|tabel|overview|overzicht|comparison|compare|dashboard|timeline|workflow|versus)\b/.test(
      text,
    ) ||
    (/\bmatrix\b/.test(text) &&
      !/(extracellular|extracellulaire|basement)\s+matrix/.test(text))
  )
    return { include: false, reason: "table-or-overview" };
  if (
    /\b(synapse|synaps|costimulation|crosslink|degranulation|lineages|infusion|engraftment|divergence)\b|inhibition activation|donor heart transfer|receptor set|target organs|blood.group.*panel|\bbigr\b|on plasma membrane|plasma membrane/.test(
      text,
    ) ||
    /(?:^|_)(?:contact|recipient)_/i.test(basename)
  )
    return { include: false, reason: "composite-scene" };
  // A loose component remains reusable when it belongs to a subject module.
  if (/^(losse bouwsteen|bouwsteen)$/.test(role))
    return { include: true, reason: "explicit-building-block" };
  if (
    c.receptorFree ||
    /\bcomponent\b|amino.*acid|aminozuren|\baa [a-z] (chemical|residue)\b/.test(
      text,
    )
  )
    return { include: true, reason: "atomic-component" };
  if (/(?:^|[\\/])03_Synapsen_en_alloherkenning[\\/]/i.test(c.file))
    return { include: false, reason: "unclassified-contact-scene" };
  if (
    c.moduleSet ||
    c.textbookModule ||
    c.flowModule ||
    c.teachingModule ||
    c.diseaseSlides ||
    c.innovationModule ||
    c.fullScopeExpansion
  )
    return { include: false, reason: "unclassified-module-scene" };
  // Whole words prevent schematic and schematics from matching schema.
  if (/\b(schema|diagram)\b/.test(text))
    return { include: false, reason: "unclassified-diagram" };
  const number = Number(basename.match(/basic_(\d+)_/)?.[1] || 0);
  return number > 0 && number <= 320
    ? { include: true, reason: "legacy-building-block" }
    : { include: false, reason: "unclassified-extension" };
}
export const isBasicElement = (component) =>
  basicElementDecision(component).include;
