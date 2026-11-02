import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { zlibSync } from "fflate";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url),
  ffmpeg = require.resolve("@ffmpeg-installer/win32-x64/ffmpeg.exe");
const base = "http://127.0.0.1:5182",
  server = spawn(process.execPath, ["scripts/server.mjs"], {
    env: { ...process.env, PORT: "5182" },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
await new Promise((resolve, reject) => {
  server.stdout.once("data", resolve);
  server.once("error", reject);
});
function crc(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) {
    c ^= b;
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, bytes) {
  const data = Buffer.concat([Buffer.from(type), Buffer.from(bytes)]),
    out = Buffer.alloc(data.length + 8);
  out.writeUInt32BE(bytes.length);
  data.copy(out, 4);
  out.writeUInt32BE(crc(data), data.length + 4);
  return out;
}
function png(n) {
  const h = Buffer.alloc(13);
  h.writeUInt32BE(32, 0);
  h.writeUInt32BE(32, 4);
  h[8] = 8;
  h[9] = 2;
  const pixels = Buffer.alloc(32 * 97);
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) {
      const p = y * 97 + 1 + x * 3;
      pixels[p] = (x * 8 + n * 3) % 255;
      pixels[p + 1] = y * 8;
      pixels[p + 2] = 150;
    }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", h),
    chunk("IDAT", zlibSync(pixels)),
    chunk("IEND", []),
  ]);
}
try {
  const status = await fetch(base + "/api/status").then((r) => r.json());
  assert.ok(status.encoder);
  const headers = {
    "X-ImmunoStudio": status.token,
    "Content-Type": "application/json",
  };
  const post = async (p, data) => {
    const res = await fetch(base + "/api/export/" + p, {
      method: "POST",
      headers,
      body: Buffer.isBuffer(data) ? data : JSON.stringify(data || {}),
    });
    const d = await res.json();
    assert.ok(res.ok, JSON.stringify(d));
    return d;
  };
  await mkdir(".local/validation", { recursive: true });
  for (const format of ["mp4", "avi", "gif"]) {
    const fps = format === "gif" ? 12 : format === "mp4" ? 25 : 30,
      count = fps * 6,
      job = await post("start", { format, fps, count });
    for (let i = 0; i < count; i++) await post(job.id + "/frame", png(i));
    await post(job.id + "/finish");
    let state;
    do {
      await new Promise((r) => setTimeout(r, 100));
      state = await fetch(base + "/api/export/" + job.id + "/status").then(
        (r) => r.json(),
      );
      assert.notEqual(state.state, "error", state.error);
    } while (state.state !== "done");
    const bytes = new Uint8Array(
      await (
        await fetch(base + "/api/export/" + job.id + "/download")
      ).arrayBuffer(),
    );
    const file = `.local/validation/encoder-test.${format}`;
    await writeFile(file, bytes);
    const result = await new Promise((resolve) => {
      let log = "";
      const p = spawn(ffmpeg, ["-i", file, "-f", "null", "-"], {
        windowsHide: true,
      });
      p.stderr.on("data", (b) => (log += b));
      p.on("close", (code) => resolve({ code, log }));
    });
    assert.equal(result.code, 0, result.log);
    assert.match(result.log, /Duration: 00:00:06\.0/);
    const frame = [...result.log.matchAll(/frame=\s*(\d+)/g)].at(-1);
    assert.equal(+frame[1], count);
    console.log(
      `${format.toUpperCase()}: 6 seconden, ${count} frames, ${bytes.length} bytes; succesvol gedecodeerd.`,
    );
  }
} finally {
  server.kill();
}
