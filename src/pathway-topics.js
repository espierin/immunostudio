// Human reference pathways, checked against Reactome Content Service (2026-11-02).
// These are discovery shortcuts, not locally invented pathways or imported graphs.
export const pathwayTopics = [
  [
    "mhc-i",
    "Immunologie",
    "MHC-I-antigeenverwerking",
    "R-HSA-983169",
    "Class I MHC mediated antigen processing & presentation",
  ],
  [
    "mhc-ii",
    "Immunologie",
    "MHC-II-antigeenpresentatie",
    "R-HSA-2132295",
    "MHC class II antigen presentation",
  ],
  [
    "cross",
    "Immunologie",
    "Cross-presentatie",
    "R-HSA-1236975",
    "Antigen processing-Cross presentation",
  ],
  [
    "proteasome",
    "Immunologie",
    "Ubiquitine en proteasoom",
    "R-HSA-983168",
    "Antigen processing: Ubiquitination & Proteasome degradation",
  ],
  [
    "tcr",
    "Immunologie",
    "T-celreceptorsignalering",
    "R-HSA-202403",
    "TCR signaling",
  ],
  [
    "bcr",
    "Immunologie",
    "B-celreceptorsignalering",
    "R-HSA-983705",
    "Signaling by the B Cell Receptor (BCR)",
  ],
  [
    "cytokine",
    "Immunologie",
    "Cytokinesignalering",
    "R-HSA-1280215",
    "Cytokine Signaling in Immune system",
  ],
  [
    "complement",
    "Immunologie",
    "Complementsysteem",
    "R-HSA-166658",
    "Complement cascade",
  ],
  [
    "innate",
    "Immunologie",
    "Aangeboren afweer",
    "R-HSA-168249",
    "Innate Immune System",
  ],
  [
    "adaptive",
    "Immunologie",
    "Adaptieve afweer",
    "R-HSA-1280218",
    "Adaptive Immune System",
  ],
  ["autophagy", "Celbiologie", "Autofagie", "R-HSA-9612973", "Autophagy"],
  ["apoptosis", "Celbiologie", "Apoptose", "R-HSA-109581", "Apoptosis"],
  [
    "vesicles",
    "Celbiologie",
    "Vesiculair transport",
    "R-HSA-5653656",
    "Vesicle-mediated transport",
  ],
  [
    "trafficking",
    "Celbiologie",
    "Membraantransport",
    "R-HSA-199991",
    "Membrane Trafficking",
  ],
  [
    "upr",
    "Celbiologie",
    "ER-stress / UPR",
    "R-HSA-381119",
    "Unfolded Protein Response (UPR)",
  ],
].map(([key, group, label, id, name]) => ({
  key,
  group,
  label,
  id,
  name,
  source: "Reactome",
  species: "Homo sapiens",
  verified: "2026-11-02",
}));

export function topicSearch(key) {
  const topic = pathwayTopics.find((t) => t.key === key);
  return topic
    ? {
        query: topic.id,
        mode: "id",
        source: "Reactome",
        species: topic.species,
      }
    : null;
}
export function keggSearchURL(query = "", species = "Homo sapiens") {
  const topic = pathwayTopics.find((t) => t.id === query.trim().toUpperCase());
  if (topic)
    query = {
      "mhc-i": "antigen processing",
      "mhc-ii": "antigen processing",
      cross: "antigen processing",
      proteasome: "proteasome",
      tcr: "T cell receptor",
      bcr: "B cell receptor",
      cytokine: "cytokine",
      complement: "complement",
      innate: "innate immune",
      adaptive: "immune",
      autophagy: "autophagy",
      apoptosis: "apoptosis",
      vesicles: "vesicle",
      trafficking: "endocytosis",
      upr: "protein processing",
    }[topic.key];
  const id = query
    .trim()
    .replace(/^path:/i, "")
    .toLowerCase();
  if (/^(?:map|hsa|mmu|ko|ec|rn)\d{5}$/.test(id))
    return `https://www.kegg.jp/pathway/${id}`;
  const url = new URL("https://www.kegg.jp/kegg-bin/search_pathway_text");
  url.search = new URLSearchParams({
    map:
      species === "Homo sapiens"
        ? "hsa"
        : species === "Mus musculus"
          ? "mmu"
          : "map",
    keyword: query.trim(),
    mode: "1",
    viewImage: "true",
  });
  return url.href;
}
