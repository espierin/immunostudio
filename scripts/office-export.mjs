import {
  access,
  mkdtemp,
  writeFile,
  readFile,
  rm,
  stat,
} from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
export const inkscape =
  process.env.IMMUNOSTUDIO_INKSCAPE ||
  (process.platform === "win32"
    ? "C:/Program Files/Inkscape/bin/inkscape.com"
    : "inkscape");
export async function hasOfficeExporter() {
  try {
    if (path.isAbsolute(inkscape)) {
      await access(inkscape);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(inkscape, args, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let log = "";
    const timeout = setTimeout(() => {
      child.kill();
      reject(Error("Office-export duurde te lang."));
    }, 90000);
    child.stderr.on("data", (b) => (log = (log + b).slice(-3000)));
    child.once("error", (e) => {
      clearTimeout(timeout);
      reject(e);
    });
    child.once("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve(log);
      else reject(Error("Inkscape-export mislukt: " + log.slice(-800)));
    });
  });
}
export async function officeExport(svg, format, { outlineText = true } = {}) {
  if (!["emf", "wmf"].includes(format)) throw Error("Kies EMF of WMF.");
  if (
    typeof svg !== "string" ||
    !/<svg\b/.test(svg) ||
    svg.length > 35 * 1024 * 1024
  )
    throw Error("Ongeldige of te grote SVG.");
  if (
    /<(?:script|foreignObject|iframe)\b|(?:href|src)\s*=\s*['"](?:https?:|file:|javascript:)|url\(\s*['"]?(?:https?:|file:|javascript:)/i.test(
      svg,
    )
  )
    throw Error("Exporteer een zelfstandige SVG zonder externe bestanden.");
  if (!(await hasOfficeExporter()))
    throw Error("De lokale Inkscape-exporter is niet beschikbaar.");
  const dir = await mkdtemp(path.join(os.tmpdir(), "immunostudio-office-")),
    input = path.join(dir, "input.svg"),
    prepared = path.join(dir, "outlined.svg"),
    output = path.join(dir, "figure." + format);
  try {
    await writeFile(input, svg);
    let source = input;
    if (outlineText) {
      await run([
        input,
        "--batch-process",
        "--export-text-to-path",
        "--export-plain-svg",
        "--export-type=svg",
        "--export-filename=" + prepared,
      ]);
      const outlined = await readFile(prepared, "utf8");
      if (/<(?:\w+:)?text(?:\s|>)/i.test(outlined))
        throw Error("Niet alle tekst kon naar vectorcontouren worden omgezet.");
      source = prepared;
    }
    await run([
      source,
      "--batch-process",
      "--export-area-page",
      "--export-type=" + format,
      "--export-filename=" + output,
    ]);
    if ((await stat(output)).size < 100)
      throw Error("Het metabestand is leeg.");
    return await readFile(output);
  } finally {
    const resolved = path.resolve(dir),
      safePrefix =
        path.resolve(os.tmpdir()) + path.sep + "immunostudio-office-";
    if (resolved.startsWith(safePrefix))
      await rm(resolved, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 100,
      });
  }
}
