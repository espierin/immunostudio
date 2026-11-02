/** Exact source tokens are documented in docs/KLEURSTIJLEN.md. */
export const sourceStyles = {
  umcu: {
    name: "UMC Utrecht",
    background: "#FFFFFF",
    head: "#AFCBE0",
    tail: "#0077B6",
    receptor: "#0077B6",
    hla: "#F15B4A",
    antibody: "#F15B4A",
    channel: "#002B49",
    outline: "#002B49",
    label: "#002B49",
    core: "#EAF6FF",
    ui: {
      background: "#F4F9FC",
      surface: "#FFFFFF",
      text: "#002B49",
      muted: "#577184",
      border: "#D8E3EA",
      primary: "#0077B6",
    },
  },
  efi: {
    name: "EFI",
    background: "#FFFFFF",
    head: "#DCE6EF",
    tail: "#064A89",
    receptor: "#064A89",
    hla: "#DE5757",
    antibody: "#DE5757",
    channel: "#5E6568",
    outline: "#064A89",
    label: "#232424",
    core: "#F4F6F9",
    ui: {
      background: "#F4F6F9",
      surface: "#FFFFFF",
      text: "#232424",
      muted: "#5E6568",
      border: "#DFE4E8",
      primary: "#064A89",
    },
  },
  nordicLight: {
    name: "Nordic Light",
    background: "#ECEFF4",
    head: "#D8DEE9",
    tail: "#81A1C1",
    receptor: "#8FBCBB",
    hla: "#BF616A",
    antibody: "#EBCB8B",
    channel: "#B48EAD",
    outline: "#2E3440",
    label: "#2E3440",
    core: "#E5E9F0",
    ui: {
      background: "#ECEFF4",
      surface: "#E5E9F0",
      text: "#2E3440",
      muted: "#4C566A",
      border: "#778293",
      primary: "#5E81AC",
    },
  },
  nordicDark: {
    name: "Nordic Dark",
    background: "#2E3440",
    head: "#81A1C1",
    tail: "#5E81AC",
    receptor: "#A3BE8C",
    hla: "#BF616A",
    antibody: "#EBCB8B",
    channel: "#B48EAD",
    outline: "#D8DEE9",
    label: "#ECEFF4",
    core: "#434C5E",
    ui: {
      background: "#2E3440",
      surface: "#3B4252",
      text: "#ECEFF4",
      muted: "#D8DEE9",
      border: "#94A1B5",
      primary: "#88C0D0",
    },
  },
};
export function applyUITheme(style) {
  const ui = sourceStyles.umcu.ui;
  for (const [key, value] of Object.entries(ui))
    document.documentElement.style.setProperty("--ui-" + key, value);
  document.documentElement.dataset.theme = "source";
  document.documentElement.dataset.ui = "umcu";
}
export function recolorSourceColor(hex, style) {
  if (!style?.ui || !/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const r = parseInt(hex.slice(1, 3), 16) / 255,
    g = parseInt(hex.slice(3, 5), 16) / 255,
    b = parseInt(hex.slice(5, 7), 16) / 255;
  if (Math.min(r, g, b) > 0.92) return hex;
  if (Math.max(r, g, b) < 0.25) return style.outline;
  if (b > r * 1.15 && b > g * 0.98)
    return Math.min(r, g, b) > 0.45
      ? style.head
      : Math.max(r, g, b) < 0.48
        ? style.outline
        : style.tail;
  if (r > g * 1.3 && r > b * 1.15) return style.hla;
  if (g > r * 1.12 && g > b * 1.12) return style.receptor;
  if (r > 0.6 && g > 0.45 && b < 0.6) return style.antibody;
  return hex;
}
