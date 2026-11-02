import { english, translateDynamic } from "./translations.js";
const storageKey =
  "immunostudio-language" +
  (new URLSearchParams(location.search).has("qa") ? "-qa" : "");
let language = "en";
try {
  language = localStorage.getItem(storageKey) === "nl" ? "nl" : "en";
} catch {}
const originals = new WeakMap();
export function translate(text, lang = language) {
  if (lang === "nl" || !text?.trim()) return text;
  const value = text.trim(),
    translated = english[value] || translateDynamic(value);
  return text.replace(value, () => translated);
}
function updateText(node) {
  const parent = node.parentElement;
  if (
    !parent ||
    parent.closest(
      "svg,script,style,textarea,[data-no-translate],.selected-card strong,#scene-tree button[data-select],#scene-tree button[data-sheet-select]",
    )
  )
    return;
  let state = originals.get(node);
  if (!state || node.nodeValue !== state.output)
    state = { source: node.nodeValue };
  const output = translate(state.source);
  state.output = output;
  originals.set(node, state);
  if (node.nodeValue !== output) node.nodeValue = output;
}
function updateElement(el) {
  if (el.closest("svg,script,style,[data-no-translate]")) return;
  // A translated category caption must not change the category's internal value.
  if (el.tagName === "OPTION" && !el.hasAttribute("value"))
    el.setAttribute("value", el.value);
  let state = originals.get(el) || {};
  for (const attr of [
    "title",
    "placeholder",
    "aria-label",
    "aria-description",
  ]) {
    if (!el.hasAttribute(attr)) continue;
    const value = el.getAttribute(attr);
    let entry = state[attr];
    if (!entry || value !== entry.output) entry = { source: value };
    entry.output = translate(entry.source);
    state[attr] = entry;
    if (value !== entry.output) el.setAttribute(attr, entry.output);
  }
  originals.set(el, state);
}
function apply(root) {
  if (root.nodeType === Node.TEXT_NODE) {
    updateText(root);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  if (root.matches("svg,script,style,textarea,[data-no-translate]")) return;
  updateElement(root);
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) =>
        node.nodeType === Node.ELEMENT_NODE &&
        node.matches("svg,script,style,textarea,[data-no-translate]")
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT,
    },
  );
  let node;
  while ((node = walker.nextNode())) {
    if (node.nodeType === Node.TEXT_NODE) updateText(node);
    else updateElement(node);
  }
}
export function setLanguage(next) {
  language = next === "en" ? "en" : "nl";
  try {
    localStorage.setItem(storageKey, language);
  } catch {}
  document.documentElement.lang = language;
  apply(document.body);
  const select = document.querySelector("#interface-language");
  if (select) select.value = language;
}
export function installI18n() {
  const select = document.querySelector("#interface-language");
  select?.addEventListener("change", (e) => setLanguage(e.target.value));
  setLanguage(language);
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "childList")
        for (const node of record.addedNodes) apply(node);
      else if (record.type === "characterData") updateText(record.target);
      else updateElement(record.target);
    }
  });
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["title", "placeholder", "aria-label", "aria-description"],
  });
}
