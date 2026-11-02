import { writeFile } from "node:fs/promises";
import { membraneMarkup } from "../src/membrane2d.js";
const heads = Array.from({ length: 86 }, (_, i) => {
  const a = (i / 86) * Math.PI * 2;
  return [126, 140]
    .map(
      (r) =>
        `<circle cx="${296 + Math.cos(a) * r}" cy="${213 + Math.sin(a) * r}" r="4.9" fill="${r === 140 ? "#ACD7E6" : "#6CB5D1"}" stroke="#327C9E" stroke-width=".7"/>`,
    )
    .join("");
}).join("");
const receptors = [-135, -95, -40, 15, 65, 140]
  .map((deg) => {
    const a = (deg * Math.PI) / 180,
      x = 296 + Math.cos(a) * 132,
      y = 213 + Math.sin(a) * 132;
    return `<g transform="translate(${x} ${y}) rotate(${deg + 90})"><path d="M0 9V-16M0-13L-12-26M0-13L12-26" fill="none" stroke="#7ACABF" stroke-width="6" stroke-linecap="round"/><circle cx="-12" cy="-28" r="5" fill="#B4E6D9"/><circle cx="12" cy="-28" r="5" fill="#B4E6D9"/></g>`;
  })
  .join("");
const membrane = membraneMarkup(
  {
    w: 430,
    h: 85,
    curve: [
      [0, 0.65],
      [0.32, 0],
      [0.62, 1],
      [1, 0.45],
    ],
    bilayerThickness: 24,
  },
  { head: "#A8D1E7", tail: "#489DBA", core: "#173F58" },
);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="500" viewBox="0 0 640 500"><defs><radialGradient id="cyto"><stop stop-color="#305F7B"/><stop offset="1" stop-color="#173F5A"/></radialGradient><radialGradient id="nuc"><stop stop-color="#7EC6DC"/><stop offset="1" stop-color="#287DA4"/></radialGradient><pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".65" fill="#A8D1E7" opacity=".15"/></pattern><filter id="shadow"><feGaussianBlur stdDeviation="15"/></filter></defs><rect x="12" y="12" width="616" height="476" rx="34" fill="#072F49"/><rect x="12" y="12" width="616" height="476" rx="34" fill="url(#grid)"/><ellipse cx="308" cy="376" rx="155" ry="18" fill="#001E32" filter="url(#shadow)"/><path d="M62 280C32 156 78 48 240 45M486 86C595 144 595 265 544 300" fill="none" stroke="#57B8B5" stroke-width="1" stroke-dasharray="4 8" opacity=".5"/><circle cx="296" cy="213" r="134" fill="url(#cyto)"/>${heads}<ellipse cx="282" cy="217" rx="60" ry="67" transform="rotate(-20 282 217)" fill="url(#nuc)" stroke="#9FD6E6" stroke-width="2"/><path d="M248 209C268 182 279 233 299 203S321 227 305 244M250 237C269 224 281 251 294 236" fill="none" stroke="#BCE6EF" stroke-width="2.5" opacity=".7"/>${Array.from({ length: 12 }, (_, i) => `<circle cx="${351 + Math.sin(i * 2.4) * 22}" cy="${207 + i * 5.2}" r="${4 + (i % 3)}" fill="${i % 2 ? "#F8BA97" : "#F0856E"}"/>`).join("")}${receptors}<g transform="translate(126 372) rotate(-6)">${membrane}</g><g fill="#C8E5EC" font-family="Segoe UI,Arial,sans-serif" font-size="11" letter-spacing="2"><text x="50" y="58">DRAW · SHAPE · EXPLORE</text><text x="50" y="454">IMMUNE CELL / MEMBRANE STUDY</text></g><g transform="translate(478 48)"><rect width="108" height="34" rx="17" fill="#155069" stroke="#318099"/><text x="54" y="22" fill="#BCE6EF" text-anchor="middle" font-family="Segoe UI,Arial,sans-serif" font-size="12">2D ↔ 3D</text></g><g transform="translate(73 118) rotate(-15)"><path d="M0 20V0M0 0L-17-17M0 0L17-17" fill="none" stroke="#F5A18A" stroke-width="9" stroke-linecap="round"/></g><circle cx="500" cy="300" r="8" fill="#F5A18A"/><circle cx="536" cy="325" r="4" fill="#B4E6D9"/></svg>`;
await writeFile("public/immunostudio-opening.svg", svg);
