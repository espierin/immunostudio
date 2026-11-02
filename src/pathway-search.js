// Public, CORS-enabled sources; no credentials or proxy required on GitHub Pages.
const REACTOME = "https://reactome.org/ContentService";
const WIKI_INDEX = "https://www.wikipathways.org/json/findPathwaysByText.json";
const COMMONS = "https://www.pathwaycommons.org/pc2/v2/search";
let wikiCache;
export const SEARCH_LIMIT = 50;
export function plainText(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(
      /&(?:amp|lt|gt|quot|#39);/g,
      (s) =>
        ({
          "&amp;": "&",
          "&lt;": "<",
          "&gt;": ">",
          "&quot;": '"',
          "&#39;": "'",
        })[s],
    )
    .trim();
}
const fold = (value) =>
  plainText(value).toLocaleLowerCase().replace(/\s+/g, " ").trim();
export function pathwayId(query) {
  const id = query.trim().toUpperCase();
  return /^(?:WP\d+|R-[A-Z]{3}-\d+(?:\.\d+)?)$/.test(id) ? id : null;
}
export function pathwayURL(source, id) {
  if (source === "Reactome" && /^R-[A-Z]{3}-\d+$/.test(id))
    return `https://reactome.org/PathwayBrowser/#/${id}`;
  if (source === "WikiPathways" && /^WP\d+$/.test(id))
    return `https://www.wikipathways.org/pathways/${id}`;
  if (source === "Pathway Commons" && commonsId(id)) {
    const url = new URL("https://www.pathwaycommons.org/pc2/search");
    url.search = new URLSearchParams({ q: `uri:"${id}"`, type: "Pathway" });
    return url.href;
  }
  return "";
}
export function commonsId(value) {
  return /^(?:(?:pc\d+|pid|netpath|inoh|biofactoid):[\w.:-]+|https?:\/\/(?:bioregistry\.io|identifiers\.org)\/[\w./:-]+)$/.test(
    value,
  )
    ? value
    : null;
}
function normalize(source, entry, matched = []) {
  const id = String(entry.stId || entry.id || "").replace(/\.\d+$/, "");
  const url = pathwayURL(source, id);
  if (!url) return null;
  const description = entry.summation || entry.description;
  return {
    source,
    id,
    url,
    name: plainText(entry.displayName || entry.name),
    species: plainText(entry.speciesName || entry.species),
    description: plainText(
      Array.isArray(description)
        ? description.map((s) => s.text || s.displayName || "").join("\n\n")
        : description,
    ),
    matched,
    revision: entry.revision || "",
  };
}
export function searchWikiIndex(
  index,
  { query, mode = "auto", species = "Homo sapiens" },
) {
  const term = fold(query),
    id = pathwayId(query);
  const rows = [];
  for (const entry of index.pathwayInfo || []) {
    if (species && entry.species !== species) continue;
    const name = fold(entry.name),
      nodes = String(entry.datanodes || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    const molecules = nodes.filter((s) => fold(s).includes(term));
    const idMatch = id && entry.id?.toUpperCase() === id;
    const nameMatch = name.includes(term);
    const extraMatch = fold(
      `${entry.annotations || ""} ${entry.description || ""}`,
    ).includes(term);
    const matches =
      mode === "id" || id
        ? idMatch
        : mode === "name"
          ? nameMatch
          : mode === "molecule"
            ? molecules.length
            : nameMatch || molecules.length || extraMatch;
    if (!matches) continue;
    const result = normalize("WikiPathways", entry, molecules.slice(0, 6));
    if (result)
      rows.push({
        ...result,
        score: idMatch
          ? 100
          : name === term
            ? 90
            : molecules.some((s) => fold(s) === term)
              ? 80
              : nameMatch
                ? 60
                : molecules.length
                  ? 40
                  : 20,
      });
  }
  rows.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return {
    results: rows.slice(0, SEARCH_LIMIT),
    total: rows.length,
    limited: rows.length > SEARCH_LIMIT,
  };
}
async function json(url, fetcher, signal, optional404 = false) {
  const response = await fetcher(url, { signal });
  if (optional404 && response.status === 404) return null;
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
const entries = (data) =>
  (data?.results || []).flatMap((group) => group.entries || []);
function reactomeQuery(query, type, species) {
  const url = new URL(`${REACTOME}/search/query`);
  url.search = new URLSearchParams({
    query,
    types: type,
    cluster: "false",
    rows: String(SEARCH_LIMIT),
    ...(species ? { species } : {}),
  });
  return url.href;
}
// Escape Lucene operators so user input is literal, then allow partial word names.
export function nameQuery(query) {
  return query
    .trim()
    .split(/\s+/)
    .map(
      (word) =>
        `*${word.replace(/[^\p{L}\p{N}_-]/gu, "").replace(/-/g, "\\-")}*`,
    )
    .filter((word) => word !== "**")
    .map((word) => `name:${word}`)
    .join(" AND ");
}
export async function searchReactome(options, fetcher = fetch, signal) {
  const { query, mode = "auto", species = "Homo sapiens" } = options;
  const id = pathwayId(query);
  if (id || mode === "id") {
    if (!id?.startsWith("R-")) return { results: [], total: 0 };
    const entry = await json(
      `${REACTOME}/data/query/${id.replace(/\.\d+$/, "")}`,
      fetcher,
      signal,
      true,
    );
    const result =
      entry &&
      /Pathway$/.test(entry.schemaClass) &&
      (!species || entry.speciesName === species)
        ? normalize("Reactome", entry)
        : null;
    return { results: result ? [result] : [], total: result ? 1 : 0 };
  }
  const results = new Map();
  let limited = false,
    total = 0;
  if (mode !== "molecule") {
    const data = await json(
      reactomeQuery(nameQuery(query), "Pathway", species),
      fetcher,
      signal,
    );
    total = data.numberOfMatches || 0;
    limited = total > SEARCH_LIMIT;
    for (const entry of entries(data)) {
      const row = normalize("Reactome", {
        ...entry,
        species: entry.species?.join(", "),
      });
      if (row) results.set(row.id, row);
    }
  }
  if (mode !== "name") {
    const data = await json(
      reactomeQuery(
        nameQuery(query),
        "Protein,SmallMolecule,Complex,DNA,RNA",
        species,
      ),
      fetcher,
      signal,
    );
    const candidates = entries(data).sort(
      (a, b) =>
        Number(fold(b.name) === fold(query)) -
        Number(fold(a.name) === fold(query)),
    );
    // Bound remote requests; the UI explicitly reports this search limit.
    limited ||= (data.numberOfMatches || candidates.length) > 8;
    const selected = [...new Map(candidates.map((e) => [e.dbId, e])).values()]
      .filter((e) => /^\d+$/.test(String(e.dbId)))
      .slice(0, 8);
    const memberships = await Promise.all(
      selected.map(async (entity) => ({
        entity,
        pathways: await json(
          `${REACTOME}/data/pathways/low/entity/${entity.dbId}`,
          fetcher,
          signal,
        ),
      })),
    );
    for (const { entity, pathways } of memberships)
      for (const entry of pathways || []) {
        if (species && entry.speciesName !== species) continue;
        const row = normalize("Reactome", entry, [plainText(entity.name)]);
        if (!row) continue;
        const old = results.get(row.id);
        if (old) old.matched = [...new Set([...old.matched, ...row.matched])];
        else results.set(row.id, row);
      }
  }
  const rows = [...results.values()].sort(
    (a, b) =>
      Number(Boolean(b.matched.length)) - Number(Boolean(a.matched.length)) ||
      a.name.localeCompare(b.name),
  );
  return {
    results: rows.slice(0, SEARCH_LIMIT),
    total: Math.max(total, rows.length),
    limited: limited || rows.length > SEARCH_LIMIT,
  };
}
export async function searchCommons(options, fetcher = fetch, signal) {
  const { query, mode = "auto", species = "Homo sapiens" } = options;
  const organism = species
    ? [
        species === "Homo sapiens"
          ? "9606"
          : species === "Mus musculus"
            ? "10090"
            : species,
      ]
    : [];
  const request = async (q, type = "Pathway") => {
    const response = await fetcher(COMMONS, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ q, type, organism, page: 0 }),
      signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  };
  const normalizeHit = (hit, matched = []) => {
    if (hit.biopaxClass !== "Pathway") return null;
    const url = pathwayURL("Pathway Commons", hit.uri);
    if (!url) return null;
    return {
      source: "Pathway Commons",
      id: hit.uri,
      url,
      name: plainText(hit.name || hit.uri),
      species: (hit.organism || [])
        .map((uri) =>
          uri.endsWith(":9606")
            ? "Homo sapiens"
            : uri.endsWith(":10090")
              ? "Mus musculus"
              : plainText(uri),
        )
        .join(", "),
      description: plainText(hit.excerpt),
      providers: (hit.dataSource || []).map(plainText),
      matched,
    };
  };
  const id = pathwayId(query),
    uri = commonsId(query),
    results = new Map();
  let total = 0,
    limited = false;
  if (id || uri || mode === "id") {
    const key =
      uri ||
      (id?.startsWith("R-")
        ? `http://bioregistry.io/reactome:${id.replace(/\.\d+$/, "")}`
        : null);
    if (!key) return { results: [], total: 0 };
    const data = await request(`uri:"${key}"`);
    const rows = (data.searchHit || [])
      .filter((hit) => hit.uri === key)
      .map((hit) => normalizeHit(hit))
      .filter(Boolean);
    return { results: rows, total: rows.length };
  }
  if (mode !== "molecule") {
    const data = await request(nameQuery(query));
    total = data.numHits || 0;
    limited = total > SEARCH_LIMIT;
    for (const hit of (data.searchHit || []).slice(0, SEARCH_LIMIT)) {
      const row = normalizeHit(hit);
      if (row) results.set(row.id, row);
    }
  }
  if (mode !== "name") {
    const data = await request(nameQuery(query), "EntityReference");
    limited ||= data.numHits > 8;
    const entities = (data.searchHit || [])
      .filter((hit) => hit.pathway?.length)
      .sort(
        (a, b) =>
          Number(fold(b.name) === fold(query)) -
            Number(fold(a.name) === fold(query)) ||
          b.pathway.length - a.pathway.length,
      )
      .slice(0, 8);
    const membership = new Map();
    for (const entity of entities)
      for (const uri of entity.pathway || []) {
        if (!commonsId(uri)) continue;
        const matches = membership.get(uri) || [];
        membership.set(uri, [...new Set([...matches, plainText(entity.name)])]);
      }
    limited ||= membership.size > SEARCH_LIMIT;
    const ids = [...membership.keys()].slice(0, SEARCH_LIMIT);
    if (ids.length) {
      const pathways = await request(
        ids.map((uri) => `uri:"${uri}"`).join(" OR "),
      );
      for (const hit of pathways.searchHit || []) {
        if (!membership.has(hit.uri)) continue;
        const row = normalizeHit(hit, membership.get(hit.uri));
        if (!row) continue;
        if (results.has(row.id)) results.get(row.id).matched = row.matched;
        else results.set(row.id, row);
      }
    }
  }
  const rows = [...results.values()];
  return {
    results: rows.slice(0, SEARCH_LIMIT),
    total: Math.max(total, rows.length),
    limited: limited || rows.length > SEARCH_LIMIT,
  };
}
export async function searchPathways(
  options,
  { fetcher = fetch, signal, timeout = 25000 } = {},
) {
  const query = String(options.query || "").trim();
  if (query.length < 2 || query.length > 160)
    throw new Error("Zoek met 2 tot 160 tekens.");
  if (!/[\p{L}\p{N}]/u.test(query))
    throw new Error("Gebruik letters of cijfers in de zoekterm.");
  if (options.mode === "id" && !pathwayId(query) && !commonsId(query))
    throw new Error(
      "Gebruik een Reactome-ID, WikiPathways-ID of Pathway Commons-URI.",
    );
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) abort();
  const timer = setTimeout(
    () => controller.abort(new DOMException("Timeout", "TimeoutError")),
    timeout,
  );
  const providers = ["Reactome", "WikiPathways", "Pathway Commons"];
  const sources = providers.includes(options.source)
    ? [options.source]
    : pathwayId(query)?.startsWith("WP")
      ? ["WikiPathways"]
      : commonsId(query)
        ? ["Pathway Commons"]
        : pathwayId(query)
          ? ["Reactome", "Pathway Commons"]
          : providers;
  try {
    const responses = await Promise.allSettled(
      sources.map(async (source) => {
        const id = pathwayId(query);
        if (
          (commonsId(query) && source !== "Pathway Commons") ||
          (id &&
            ((id.startsWith("WP") && source !== "WikiPathways") ||
              (id.startsWith("R-") && source === "WikiPathways")))
        )
          return { results: [], total: 0 };
        if (source === "Pathway Commons")
          return searchCommons(
            { ...options, query },
            fetcher,
            controller.signal,
          );
        if (source === "Reactome")
          return searchReactome(
            { ...options, query },
            fetcher,
            controller.signal,
          );
        if (
          !wikiCache ||
          Date.now() - wikiCache.time > 3600000 ||
          fetcher !== fetch
        ) {
          const index = await json(WIKI_INDEX, fetcher, controller.signal);
          if (!Array.isArray(index.pathwayInfo))
            throw new Error("Invalid WikiPathways index");
          if (fetcher === fetch) wikiCache = { index, time: Date.now() };
          return searchWikiIndex(index, { ...options, query });
        }
        return searchWikiIndex(wikiCache.index, { ...options, query });
      }),
    );
    if (signal?.aborted)
      throw signal.reason || new DOMException("Aborted", "AbortError");
    return {
      results: responses.flatMap((r) =>
        r.status === "fulfilled" ? r.value.results : [],
      ),
      sources: responses.map((r, i) =>
        r.status === "fulfilled"
          ? {
              source: sources[i],
              total: r.value.total,
              limited: !!r.value.limited,
            }
          : {
              source: sources[i],
              error: controller.signal.aborted ? "timeout" : "unavailable",
            },
      ),
    };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
