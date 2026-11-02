import test from "node:test";
import assert from "node:assert/strict";
import {
  plainText,
  pathwayId,
  pathwayURL,
  nameQuery,
  searchWikiIndex,
  searchReactome,
  searchPathways,
} from "../src/pathway-search.js";
const index = {
  pathwayInfo: [
    {
      id: "WP127",
      name: "IL5 signaling",
      species: "Homo sapiens",
      datanodes: "AKT1, IL5, STAT5A",
      description: "Interleukin biology",
    },
    {
      id: "WP2",
      name: "AKT1 signaling",
      species: "Mus musculus",
      datanodes: "Akt1",
    },
    {
      id: "WP3",
      name: "AKT1 expression study",
      species: "Homo sapiens",
      datanodes: "IL6",
      description: "AKT1 mention without membership",
    },
  ],
};
const response = (data, status = 200) => ({
  ok: status === 200,
  status,
  json: async () => data,
});
test("pathway IDs and canonical URLs reject untrusted source links", () => {
  assert.equal(pathwayId(" r-hsa-168256.2 "), "R-HSA-168256.2");
  assert.equal(pathwayId("wp127"), "WP127");
  assert.equal(pathwayId("WP127<script>"), null);
  assert.equal(pathwayURL("Reactome", "javascript:alert(1)"), "");
  assert.equal(
    pathwayURL("WikiPathways", "WP127"),
    "https://www.wikipathways.org/pathways/WP127",
  );
  assert.equal(
    plainText('<span class="highlight">AKT1</span> &amp; IL5'),
    "AKT1 & IL5",
  );
  assert.equal(nameQuery("T cell"), "name:*T* AND name:*cell*");
  assert.doesNotMatch(nameQuery('AKT1" OR *:*'), / OR \*:/);
});
test("WikiPathways distinguishes name search from molecule membership and species", () => {
  assert.deepEqual(
    searchWikiIndex(index, { query: "akt1", mode: "molecule" }).results.map(
      (r) => r.id,
    ),
    ["WP127"],
  );
  assert.deepEqual(
    searchWikiIndex(index, { query: "akt1", mode: "name" }).results.map(
      (r) => r.id,
    ),
    ["WP3"],
  );
  assert.equal(
    searchWikiIndex(index, { query: "akt1", mode: "molecule", species: "" })
      .total,
    2,
  );
  assert.equal(
    searchWikiIndex(index, { query: "interleukin", mode: "auto" }).results[0]
      .id,
    "WP127",
  );
  assert.equal(
    searchWikiIndex(index, { query: "interleukin", mode: "name" }).total,
    0,
  );
  assert.equal(
    searchWikiIndex(index, { query: "wp127", mode: "id" }).results[0].id,
    "WP127",
  );
  assert.equal(searchWikiIndex(index, { query: "WP12", mode: "id" }).total, 0);
});
test("broad WikiPathways queries are bounded and expose their total", () => {
  const data = {
    pathwayInfo: Array.from({ length: 75 }, (_, i) => ({
      ...index.pathwayInfo[0],
      id: `WP${i}`,
    })),
  };
  const result = searchWikiIndex(data, { query: "AKT1", mode: "molecule" });
  assert.equal(result.results.length, 50);
  assert.equal(result.total, 75);
  assert.equal(result.limited, true);
});
test("Reactome ID lookup verifies event class and organism", async () => {
  const fetcher = async (url) => {
    assert.match(url, /data\/query\/R-HSA-168256$/);
    return response({
      stId: "R-HSA-168256",
      displayName: "Immune System",
      schemaClass: "TopLevelPathway",
      speciesName: "Homo sapiens",
    });
  };
  assert.equal(
    (await searchReactome({ query: "R-HSA-168256.2" }, fetcher)).results[0]
      .name,
    "Immune System",
  );
  assert.equal(
    (
      await searchReactome(
        { query: "R-HSA-168256", species: "Mus musculus" },
        fetcher,
      )
    ).results.length,
    0,
  );
  assert.equal(
    (
      await searchReactome({ query: "R-HSA-168256" }, async () =>
        response({}, 404),
      )
    ).results.length,
    0,
  );
});
test("Reactome molecule searches use entity membership, deduplicate and filter species", async () => {
  const calls = [];
  const fetcher = async (url) => {
    calls.push(url);
    if (url.includes("search/query"))
      return response({
        numberOfMatches: 2,
        results: [
          {
            entries: [
              { dbId: "58252", name: "<b>AKT1</b>" },
              { dbId: "58253", name: "AKT1 complex" },
            ],
          },
        ],
      });
    return response([
      {
        stId: "R-HSA-389357",
        displayName: "CD28 signaling",
        speciesName: "Homo sapiens",
      },
      { stId: "R-MMU-123", displayName: "Mouse", speciesName: "Mus musculus" },
    ]);
  };
  const r = await searchReactome({ query: "AKT1", mode: "molecule" }, fetcher);
  assert.equal(r.results.length, 1);
  assert.deepEqual(r.results[0].matched, ["AKT1", "AKT1 complex"]);
  assert.equal(
    calls.filter((u) => u.includes("pathways/low/entity/")).length,
    2,
  );
  assert.equal(
    new URL(calls[0]).searchParams.get("types"),
    "Protein,SmallMolecule,Complex,DNA,RNA",
  );
});
test("Reactome name search scopes to names and does not issue molecule requests", async () => {
  let calls = 0;
  const r = await searchReactome(
    { query: "interleuk", mode: "name" },
    async (url) => {
      calls++;
      const u = new URL(url);
      assert.equal(u.searchParams.get("query"), "name:*interleuk*");
      return response({
        numberOfMatches: 90,
        results: [
          {
            entries: [
              {
                stId: "R-HSA-123",
                name: "<b>Interleukin</b> signaling",
                species: ["Homo sapiens"],
              },
            ],
          },
        ],
      });
    },
  );
  assert.equal(calls, 1);
  assert.equal(r.limited, true);
  assert.equal(r.results[0].name, "Interleukin signaling");
});
test("one unavailable database preserves results from the other", async () => {
  const r = await searchPathways(
    { query: "AKT1", mode: "molecule" },
    {
      fetcher: async (url) => {
        if (url.includes("reactome.org")) throw Error("offline");
        return response(index);
      },
    },
  );
  assert.equal(r.results[0].id, "WP127");
  assert.equal(r.sources[0].error, "unavailable");
  assert.equal(r.sources[1].total, 1);
});
test("ID auto detection only queries the relevant source", async () => {
  let calls = 0;
  const r = await searchPathways(
    { query: "WP127" },
    {
      fetcher: async (url) => {
        calls++;
        assert.match(url, /wikipathways.org/);
        return response(index);
      },
    },
  );
  assert.equal(calls, 1);
  assert.equal(r.results.length, 1);
});
test("invalid searches are rejected before network requests", async () => {
  for (const options of [
    { query: "a" },
    { query: "***" },
    { query: "AKT1", mode: "id" },
  ])
    await assert.rejects(
      searchPathways(options, {
        fetcher: () => {
          throw Error("must not fetch");
        },
      }),
      /tekens|letters|Reactome-ID/,
    );
});
test("timeout returns actionable provider errors; cancellation rejects stale work", async () => {
  const fetcher = async (url, { signal }) =>
    new Promise((resolve, reject) => {
      if (signal.aborted) reject(signal.reason);
      else
        signal.addEventListener("abort", () => reject(signal.reason), {
          once: true,
        });
    });
  const r = await searchPathways({ query: "AKT1" }, { fetcher, timeout: 10 });
  assert.ok(r.sources.every((s) => s.error === "timeout"));
  const controller = new AbortController();
  const pending = searchPathways(
    { query: "AKT1" },
    { fetcher, signal: controller.signal },
  );
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
});
