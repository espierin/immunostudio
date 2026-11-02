export function parsePDB(text) {
  const atoms = [];
  let model = false;
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith("MODEL")) {
      if (model) break;
      model = true;
    }
    if (line.startsWith("ENDMDL")) break;
    if (!/^(ATOM  |HETATM)/.test(line) || line.length < 54) continue;
    const alt = line[16];
    if (alt && alt !== " " && alt !== "A") continue;
    const a = {
      x: +line.slice(30, 38) / 10,
      y: +line.slice(38, 46) / 10,
      z: +line.slice(46, 54) / 10,
      chain: line.slice(21, 22).trim() || "A",
      residue: line.slice(22, 27).trim(),
      name: line.slice(12, 16).trim(),
      element: line.slice(76, 78).trim() || line.slice(12, 16).trim()[0],
    };
    if ([a.x, a.y, a.z].every(Number.isFinite)) atoms.push(a);
  }
  return finish(atoms);
}
function tokens(text) {
  return (
    text
      .match(/^;[\s\S]*?^;[^\r\n]*|'[^'\r\n]*'|"[^"\r\n]*"|[^\s]+/gm)
      ?.filter((t) => !t.startsWith("#"))
      .map((t) => (/^['"]/.test(t) ? t.slice(1, -1) : t)) || []
  );
}
export function parseCIF(text) {
  const ts = tokens(text.replace(/^#[^\r\n]*$/gm, ""));
  const atoms = [];
  for (let i = 0; i < ts.length; i++) {
    if (ts[i] !== "loop_") continue;
    let j = i + 1;
    const cols = [];
    while (ts[j]?.startsWith("_")) cols.push(ts[j++]);
    if (!cols.some((c) => c.startsWith("_atom_site."))) continue;
    if (
      !["Cartn_x", "Cartn_y", "Cartn_z"].every((k) =>
        cols.includes("_atom_site." + k),
      )
    )
      throw Error("mmCIF mist atoomcoördinaten.");
    const idx = (k) => cols.indexOf("_atom_site." + k),
      pick = (row, ...keys) => {
        for (const k of keys) {
          const v = row[idx(k)];
          if (v !== undefined && v !== "." && v !== "?") return v;
        }
        return "";
      };
    for (; j + cols.length <= ts.length; j += cols.length) {
      if (
        ts[j] === "loop_" ||
        ts[j].startsWith("_") ||
        ts[j].startsWith("data_") ||
        ts[j] === "stop_"
      )
        break;
      const row = ts.slice(j, j + cols.length);
      if (
        pick(row, "pdbx_PDB_model_num") &&
        pick(row, "pdbx_PDB_model_num") !== "1"
      )
        continue;
      const alt = pick(row, "label_alt_id");
      if (alt && alt !== "A") continue;
      const a = {
        x: +pick(row, "Cartn_x") / 10,
        y: +pick(row, "Cartn_y") / 10,
        z: +pick(row, "Cartn_z") / 10,
        chain: pick(row, "auth_asym_id", "label_asym_id"),
        residue: pick(row, "auth_seq_id", "label_seq_id"),
        name: pick(row, "auth_atom_id", "label_atom_id"),
        element: pick(row, "type_symbol"),
      };
      if ([a.x, a.y, a.z].every(Number.isFinite)) atoms.push(a);
    }
    break;
  }
  return finish(atoms);
}
function finish(atoms) {
  if (!atoms.length) throw Error("Geen atoomcoördinaten gevonden.");
  if (atoms.length > 80000)
    throw Error(
      "Deze structuur is te groot voor deze editor (max. 80.000 atomen). Kies een kleiner fragment.",
    );
  return { atoms, chains: [...new Set(atoms.map((a) => a.chain))] };
}
export function centeredAtoms(atoms, chains) {
  const out = atoms.filter((a) => chains.includes(a.chain));
  if (!out.length) throw Error("Selecteer ten minste één keten.");
  const center = ["x", "y", "z"].map(
    (k) => out.reduce((s, a) => s + a[k], 0) / out.length,
  );
  return out.map((a) => ({
    ...a,
    x: a.x - center[0],
    y: a.y - center[1],
    z: a.z - center[2],
  }));
}
export async function searchStructures(query) {
  const body = {
    query: {
      type: "terminal",
      service: "full_text",
      parameters: { value: query },
    },
    return_type: "entry",
    request_options: { paginate: { start: 0, rows: 8 } },
  };
  const response = await fetch("https://search.rcsb.org/rcsbsearch/v2/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (response.status === 204) return [];
  if (!response.ok) throw Error(`PDB zoeken mislukt (${response.status})`);
  const data = await response.json();
  return Promise.all(
    (data.result_set || []).map(async (r) => {
      try {
        const res = await fetch(
          `https://data.rcsb.org/rest/v1/core/entry/${r.identifier}`,
        );
        if (!res.ok) throw Error();
        const d = await res.json();
        return {
          id: r.identifier,
          title: d.struct?.title || r.identifier,
          method: d.exptl?.[0]?.method || "",
          resolution: d.rcsb_entry_info?.resolution_combined?.[0],
        };
      } catch {
        return { id: r.identifier, title: r.identifier };
      }
    }),
  );
}
