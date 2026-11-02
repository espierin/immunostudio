import http from "node:http";
import { readFile, writeFile, stat, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomUUID, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { officeExport, hasOfficeExporter } from "./office-export.mjs";
const officeAvailable = await hasOfficeExporter();
const require = createRequire(import.meta.url),
  root = path.resolve("dist"),
  port = Number(process.env.PORT || 5180),
  token = randomBytes(24).toString("hex"),
  jobs = new Map();
let ffmpeg = process.env.IMMUNOSTUDIO_FFMPEG;
if (!ffmpeg) {
  try {
    ffmpeg = require.resolve("@ffmpeg-installer/win32-x64/ffmpeg.exe");
  } catch {
    ffmpeg = "ffmpeg";
  }
}
let encoder = false;
try {
  encoder = await new Promise((resolve) => {
    const p = spawn(ffmpeg, ["-version"], {
      windowsHide: true,
      stdio: "ignore",
    });
    p.on("error", () => resolve(false));
    p.on("exit", (code) => resolve(code === 0));
  });
} catch {}
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".png": "image/png",
  ".glb": "model/gltf-binary",
};
function json(res, data, status = 200) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
}
async function body(req, limit = 20000) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Error("Verzoek te groot");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
async function clean(job) {
  job.cancelled = true;
  if (job.process && job.process.exitCode === null) {
    job.process.kill();
    await new Promise((resolve) => {
      job.process.once("close", resolve);
      setTimeout(resolve, 2000);
    });
  }
  if (
    job.dir &&
    path
      .resolve(job.dir)
      .startsWith(path.resolve(os.tmpdir()) + path.sep + "immunostudio-")
  )
    await rm(job.dir, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    });
  jobs.delete(job.id);
}
const server = http.createServer(async (req, res) => {
  try {
    const name = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    if (name === "/api/status" && req.method === "GET") {
      json(res, {
        encoder,
        token,
        formats: encoder ? ["mp4", "avi", "gif"] : [],
        office: officeAvailable,
      });
      return;
    }
    if (name === "/api/office/export" && req.method === "POST") {
      const origin = req.headers.origin;
      if (
        req.headers["x-immunostudio"] !== token ||
        (origin &&
          origin !== `http://127.0.0.1:${port}` &&
          origin !== `http://localhost:${port}`)
      ) {
        json(res, { error: "Ongeldige exportsessie" }, 403);
        return;
      }
      const payload = JSON.parse(await body(req, 36 * 1024 * 1024)),
        bytes = await officeExport(payload.svg, payload.format, {
          outlineText: payload.outlineText !== false,
        });
      res.writeHead(200, {
        "Content-Type": payload.format === "emf" ? "image/emf" : "image/wmf",
        "Content-Disposition": `attachment; filename="ImmunoStudio.${payload.format}"`,
      });
      res.end(bytes);
      return;
    }
    if (name.startsWith("/api/export/")) {
      const origin = req.headers.origin;
      if (
        origin &&
        origin !== `http://127.0.0.1:${port}` &&
        origin !== `http://localhost:${port}`
      ) {
        json(res, { error: "Ongeldige oorsprong" }, 403);
        return;
      }
      const parts = name.split("/"),
        id = parts[3],
        command = parts[4];
      if (req.method === "POST" && req.headers["x-immunostudio"] !== token) {
        json(res, { error: "Ongeldige sessie" }, 403);
        return;
      }
      if (id === "start" && req.method === "POST") {
        if (!encoder) throw Error("FFmpeg niet beschikbaar");
        if (jobs.size >= 3)
          throw Error("Te veel exports. Rond de huidige export af.");
        const config = JSON.parse(await body(req));
        if (
          !["mp4", "avi", "gif"].includes(config.format) ||
          ![12, 24, 25, 30, 50, 60].includes(config.fps) ||
          !Number.isInteger(config.count) ||
          config.count < 1 ||
          config.count > 1801
        )
          throw Error("Ongeldige exportinstellingen");
        const job = {
          id: randomUUID(),
          dir: await mkdtemp(path.join(os.tmpdir(), "immunostudio-")),
          state: "frames",
          received: 0,
          progress: 0,
          format: config.format,
          fps: config.fps,
          count: config.count,
          loop: Math.max(0, Math.min(100, Number(config.loop) || 0)),
        };
        jobs.set(job.id, job);
        json(res, { id: job.id });
        return;
      }
      const job = jobs.get(id);
      if (!job) {
        json(res, { error: "Export niet gevonden" }, 404);
        return;
      }
      if (command === "frame" && req.method === "POST") {
        if (job.state !== "frames" || job.received >= job.count)
          throw Error("Export ontvangt geen frames");
        const bytes = await body(req, 24 * 1024 * 1024);
        if (
          bytes.length < 8 ||
          !bytes
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        )
          throw Error("Ongeldig PNG-frame");
        await writeFile(
          path.join(
            job.dir,
            `frame-${String(job.received).padStart(5, "0")}.png`,
          ),
          bytes,
        );
        job.received++;
        json(res, { received: job.received });
        return;
      }
      if (command === "finish" && req.method === "POST") {
        if (job.received !== job.count || job.state !== "frames")
          throw Error("Niet alle frames zijn ontvangen");
        job.state = "encoding";
        const output = path.join(job.dir, "animation." + job.format);
        job.output = output;
        const input = [
          "-y",
          "-framerate",
          String(job.fps),
          "-i",
          path.join(job.dir, "frame-%05d.png"),
        ];
        const codecs =
          job.format === "mp4"
            ? [
                "-c:v",
                "libx264",
                "-pix_fmt",
                "yuv420p",
                "-vf",
                "pad=ceil(iw/2)*2:ceil(ih/2)*2",
                "-movflags",
                "+faststart",
              ]
            : job.format === "avi"
              ? ["-c:v", "mjpeg", "-q:v", "3", "-pix_fmt", "yuvj420p"]
              : [
                  "-filter_complex",
                  "[0:v]split[a][b];[a]palettegen=stats_mode=full[p];[b][p]paletteuse=dither=sierra2_4a",
                  "-loop",
                  String(job.loop),
                ];
        const p = spawn(ffmpeg, [...input, ...codecs, output], {
          windowsHide: true,
          stdio: ["ignore", "ignore", "pipe"],
        });
        job.process = p;
        let log = "";
        p.stderr.on("data", (chunk) => {
          const str = chunk.toString();
          log = (log + str).slice(-4000);
          const match = [...str.matchAll(/frame=\s*(\d+)/g)].at(-1);
          if (match) job.progress = Math.min(1, +match[1] / job.count);
        });
        p.on("error", (err) => {
          job.state = "error";
          job.error = err.message;
        });
        p.on("exit", (code) => {
          if (job.cancelled) return;
          job.state = code === 0 ? "done" : "error";
          job.progress = 1;
          if (code !== 0)
            job.error =
              "FFmpeg kon dit formaat niet coderen. " + log.slice(-700);
        });
        json(res, { state: "encoding" });
        return;
      }
      if (command === "status" && req.method === "GET") {
        json(res, {
          state: job.state,
          progress: job.progress,
          error: job.error,
        });
        return;
      }
      if (command === "cancel" && req.method === "POST") {
        await clean(job);
        json(res, { cancelled: true });
        return;
      }
      if (command === "download" && req.method === "GET") {
        if (job.state !== "done") throw Error("Export nog niet gereed");
        const bytes = await readFile(job.output);
        res.writeHead(200, {
          "Content-Type":
            job.format === "gif"
              ? "image/gif"
              : job.format === "mp4"
                ? "video/mp4"
                : "video/x-msvideo",
          "Content-Disposition": `attachment; filename="ImmunoStudio-animation.${job.format}"`,
        });
        res.end(bytes);
        await clean(job);
        return;
      }
      json(res, { error: "Onbekende exportactie" }, 404);
      return;
    }
    let file = path.resolve(root, "." + name);
    if (!file.startsWith(root + path.sep) && file !== root) {
      res.writeHead(403).end();
      return;
    }
    if ((await stat(file)).isDirectory()) file = path.join(file, "index.html");
    const bytes = await readFile(file);
    res.writeHead(200, {
      "Content-Type": types[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    res.end(bytes);
  } catch (err) {
    if (req.url.startsWith("/api/")) json(res, { error: err.message }, 400);
    else res.writeHead(404).end("Niet gevonden");
  }
});
server.listen(port, "127.0.0.1", () =>
  console.log(
    `ImmunoStudio: http://127.0.0.1:${port} · MP4/AVI/GIF ${encoder ? "beschikbaar" : "vereisen FFmpeg"}`,
  ),
);
process.on("SIGINT", async () => {
  for (const job of jobs.values()) await clean(job);
  server.close();
  process.exit(0);
});
