// Search metadata is generated separately from the untouched source SVGs.
const prose = (value) =>
  String(value || "")
    .replace(/[\u2012-\u2015\u2212]/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
export function libraryEntry(component) {
  const words = (value) =>
    Array.isArray(value) ? value : value ? [value] : [];
  const aliases = /flow.?cyto|cytometr|facs|cytof/i.test(
    [component.key, component.title, component.category].join(" "),
  )
    ? [
        "flow cytometer",
        "flowcytometer",
        "flow cytometry",
        "flowcytometrie",
        "cytometer",
        "cytometrie",
        "FACS",
        "celsortering",
        "cell sorting",
      ]
    : [];
  return {
    file: component.file,
    key: component.key,
    title: prose(component.title || component.key),
    category: prose(
      component.category || component.categoryFolder || "Overige",
    ),
    keywords: prose(
      [
        component.key,
        component.title,
        component.category,
        component.note,
        ...words(component.searchKeywords),
        ...words(component.keywords),
        ...aliases,
      ]
        .filter(Boolean)
        .join(" "),
    ),
    role: component.assetRole || "Bouwsteen",
  };
}
