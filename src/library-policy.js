/** A deliberately conservative catalog: reusable single components, not teaching scenes. */
export function isBasicElement(c) {
  const text = [c.key, c.title, c.file, c.assetRole, c.category]
    .join(" ")
    .toLowerCase();
  if (
    /samengesteld|samengestelde|table|tabel|overview|overzicht|comparison|compare|matrix|dashboard|timeline|workflow|diagram|schema|synapse|synaps|contact_|costimulation|crosslink|inhibition_activation|degranulation|lineages|infusion|engraftment|divergence|versus|recipient_|donor_heart_transfer|_bigr|plasma_membrane|on plasma membrane|receptor_set|target_organs|blood.group.*panel/.test(
      text,
    )
  )
    return false;
  if (
    c.moduleSet ||
    c.textbookModule ||
    c.flowModule ||
    c.teachingModule ||
    c.diseaseSlides ||
    c.innovationModule ||
    c.fullScopeExpansion
  )
    return false;
  if (
    /textbook|onderwijs infectie|publicatie-uitbreidingen|bouwsteen \/ concept/.test(
      text,
    )
  )
    return false;
  const number = +(c.file?.match(/basic_(\d+)_/)?.[1] || 0);
  if (
    c.receptorFree ||
    /_component\b|amino.*acid|aminozuren|_AA_[A-Z]_(?:chemical|residue)/i.test(
      text,
    )
  )
    return true;
  return number > 0 && number <= 320;
}
