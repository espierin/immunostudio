export function searchText(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(
      /[αβγδκ]/g,
      (c) =>
        " " +
        { α: "alpha", β: "beta", γ: "gamma", δ: "delta", κ: "kappa" }[c] +
        " ",
    )
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
export function matchesLibrary(entry, query) {
  const text = searchText(
    [entry.name, entry.title, entry.key, entry.keywords, entry.category].join(
      " ",
    ),
  );
  return searchText(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) =>
      word.length === 1
        ? text.split(/\s+/).includes(word)
        : text.includes(word),
    );
}
