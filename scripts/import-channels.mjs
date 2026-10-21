#!/usr/bin/env node
/**
 * Converts data/radio-channels.xlsx (first sheet) → lib/channels.json.
 * Runs automatically before `npm run build` (Vercel), so editing the Excel file and uploading it to
 * GitHub is enough to change the station list. No dependencies: reads the .xlsx zip with node:zlib.
 *
 * Columns are found by their header text (row containing "Stream URL"), so you can reorder them:
 *   Channel / الإذاعة · Stream URL · Format · Last check result · Checked on · Favourite · Source page · Notes
 * Optional extra columns the app understands: "English name", "Frequency", "Category", "Core".
 *
 * Fail-safe: if the Excel file is missing or unreadable, the existing lib/channels.json is kept and the
 * build continues.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "data", "radio-channels.xlsx");
const OUT = join(root, "lib", "channels.json");

function unzip(buf) {
  // Find End Of Central Directory, then walk the central directory.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("not a zip/xlsx file");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = {};
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("bad central directory");
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    const lNameLen = buf.readUInt16LE(local + 26);
    const lExtraLen = buf.readUInt16LE(local + 28);
    const start = local + 30 + lNameLen + lExtraLen;
    const data = buf.subarray(start, start + csize);
    files[name] = method === 0 ? data : method === 8 ? inflateRawSync(data) : null;
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

const xmlText = (s) =>
  s.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "").replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&amp;/g, "&");

function readSheet(files) {
  const shared = files["xl/sharedStrings.xml"] ? [...files["xl/sharedStrings.xml"].toString("utf8").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => xmlText(m[1])) : [];
  const sheetName = Object.keys(files).filter((f) => /^xl\/worksheets\/sheet\d+\.xml$/.test(f)).sort()[0];
  if (!sheetName) throw new Error("no worksheet");
  const xml = files[sheetName].toString("utf8");
  const rows = [];
  for (const rm of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = [];
    for (const cm of rm[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1];
      const ref = /r="([A-Z]+)\d+"/.exec(attrs)?.[1];
      if (!ref) continue;
      const col = [...ref].reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1;
      const type = /t="(\w+)"/.exec(attrs)?.[1];
      const body = cm[2] ?? "";
      let v = null;
      if (type === "s") v = shared[+(/<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? -1)] ?? null;
      else if (type === "inlineStr") v = xmlText(/<is>([\s\S]*?)<\/is>/.exec(body)?.[1] ?? "");
      else {
        const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
        v = raw == null ? null : type === "str" || type === "e" ? xmlText(raw) : type === "b" ? raw === "1" : Number(raw);
      }
      row[col] = typeof v === "string" ? v.trim() : v;
    }
    rows.push(row);
  }
  return rows;
}

const serialToDate = (n) => {
  const d = new Date(Date.UTC(1899, 11, 30) + Math.round(n * 86400000));
  const p = (x) => String(x).padStart(2, "0");
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
};

function convert(rows) {
  const hi = rows.findIndex((r) => r?.some((c) => typeof c === "string" && /^stream url/i.test(c)));
  if (hi < 0) throw new Error('header row with "Stream URL" not found');
  const header = rows[hi].map((h) => (typeof h === "string" ? h.toLowerCase() : ""));
  const col = (re) => header.findIndex((h) => re.test(h));
  const C = {
    no: col(/^no\.?$|^#$|رقم/),
    name: col(/channel|الإذاعة|الاذاعة|name ar|^name$/),
    nameEn: col(/english/),
    url: col(/stream url/),
    format: col(/^format/),
    result: col(/check result|result/),
    checkedOn: col(/checked on|date/),
    favourite: col(/favou?rite|مفضل/),
    core: col(/^core|أساسي|اساسي/),
    source: col(/source/),
    notes: col(/notes|ملاحظ/),
    frequency: col(/freq/),
    category: col(/categ|تصنيف/),
  };
  if (C.name < 0 || C.url < 0) throw new Error("Channel or Stream URL column missing");
  const get = (r, i) => (i >= 0 ? r[i] ?? null : null);
  const yes = (v) => typeof v === "string" ? /^(yes|y|true|نعم|1)$/i.test(v) : v === true || v === 1;
  const out = [];
  const warnings = [];
  for (const r of rows.slice(hi + 1)) {
    const name = get(r, C.name);
    if (!name || typeof name !== "string") continue;
    // Column C may hold several links (one per line): the first is played, the others are fallbacks.
    const cell = get(r, C.url);
    const urls = [];
    for (const part of typeof cell === "string" ? cell.split(/\s+/) : []) {
      if (!part) continue;
      try {
        const u = new URL(part);
        if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error();
        urls.push(part);
      } catch {
        warnings.push(`row "${name}": invalid URL ignored (${part.slice(0, 60)})`);
      }
    }
    const url = urls[0] ?? null;
    const checked = get(r, C.checkedOn);
    out.push({
      no: typeof get(r, C.no) === "number" ? get(r, C.no) : null,
      name: name.trim(),
      nameEn: get(r, C.nameEn) || null,
      url,
      urls,
      format: get(r, C.format) || null,
      result: get(r, C.result) || null,
      checkedOn: typeof checked === "number" ? serialToDate(checked) : checked || null,
      favourite: yes(get(r, C.favourite)),
      core: C.core >= 0 ? yes(get(r, C.core)) : null,
      source: get(r, C.source) || null,
      notes: get(r, C.notes) || null,
      frequency: get(r, C.frequency) ? String(get(r, C.frequency)) : null,
      category: get(r, C.category) || null,
    });
  }
  return { out, warnings };
}

try {
  if (!existsSync(SRC)) {
    console.log(`[channels] ${SRC} not found — keeping existing lib/channels.json`);
    process.exit(0);
  }
  const { out, warnings } = convert(readSheet(unzip(readFileSync(SRC))));
  if (!out.length) throw new Error("no stations found in the sheet");
  writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
  for (const w of warnings) console.warn(`[channels] warning: ${w}`);
  console.log(`[channels] ${out.length} stations → lib/channels.json`);
} catch (e) {
  console.error(`[channels] could not read Excel (${e.message}) — keeping existing lib/channels.json`);
  if (!existsSync(OUT)) process.exit(1);
}
