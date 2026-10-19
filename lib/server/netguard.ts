/**
 * SSRF guard for the few server-side fetches the app makes (playlist resolution only).
 * - http/https only, no credentials in URL, ports 80/443/8000-8999 only
 * - DNS resolved once; every address must be public; the socket is pinned to that address
 *   (defeats DNS rebinding between check and connect)
 * - redirects followed manually (max 3), each hop re-validated
 * - hard timeout and byte cap
 */
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import http from "node:http";
import https from "node:https";

export class BlockedError extends Error {}

export function isPrivateAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number) as [number, number, number, number];
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || // CGNAT
      (a === 169 && b === 254) || // link-local / cloud metadata
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  if (v === 6) {
    const x = ip.toLowerCase();
    if (x === "::" || x === "::1") return true;
    if (x.startsWith("::ffff:")) return isPrivateAddress(x.slice(7));
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(x) || x.startsWith("64:ff9b:") || x.startsWith("2001:db8");
  }
  return true;
}

const ALLOWED_PORTS = (p: number) => p === 80 || p === 443 || (p >= 8000 && p <= 8999);

export function validateUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new BlockedError("invalid-url");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new BlockedError("protocol");
  if (u.username || u.password) throw new BlockedError("credentials");
  const port = u.port ? Number(u.port) : u.protocol === "https:" ? 443 : 80;
  if (!ALLOWED_PORTS(port)) throw new BlockedError("port");
  if (u.hostname === "localhost" || u.hostname.endsWith(".local") || u.hostname.endsWith(".internal")) throw new BlockedError("host");
  return u;
}

async function resolvePublic(host: string): Promise<{ address: string; family: number }> {
  const bare = host.replace(/^\[|\]$/g, "");
  if (isIP(bare)) {
    if (isPrivateAddress(bare)) throw new BlockedError("private-ip");
    return { address: bare, family: isIP(bare) };
  }
  const all = await lookup(bare, { all: true, verbatim: true });
  if (!all.length) throw new BlockedError("dns");
  for (const a of all) if (isPrivateAddress(a.address)) throw new BlockedError("private-ip");
  return all[0]!;
}

export interface GuardedResponse {
  finalUrl: string;
  status: number;
  contentType: string;
  body: string;
}

export async function guardedGetText(raw: string, opts: { timeoutMs?: number; maxBytes?: number; maxRedirects?: number } = {}): Promise<GuardedResponse> {
  const timeoutMs = opts.timeoutMs ?? 6000;
  const maxBytes = opts.maxBytes ?? 64 * 1024;
  let url = validateUrl(raw);
  for (let hop = 0; hop <= (opts.maxRedirects ?? 3); hop++) {
    const pinned = await resolvePublic(url.hostname);
    const res = await requestOnce(url, pinned, timeoutMs, maxBytes);
    if (res.status >= 300 && res.status < 400 && res.location) {
      url = validateUrl(new URL(res.location, url).toString());
      continue;
    }
    return { finalUrl: url.toString(), status: res.status, contentType: res.contentType, body: res.body };
  }
  throw new BlockedError("too-many-redirects");
}

function requestOnce(
  url: URL,
  pinned: { address: string; family: number },
  timeoutMs: number,
  maxBytes: number,
): Promise<{ status: number; contentType: string; location?: string; body: string }> {
  return new Promise((resolve, reject) => {
    const mod = url.protocol === "https:" ? https : http;
    const req = mod.request(
      url,
      {
        method: "GET",
        headers: { "User-Agent": "ProfAliKotbSmartRadio/1.0 (playlist resolver)", Accept: "audio/x-scpls, audio/x-mpegurl, application/vnd.apple.mpegurl, text/plain, */*" },
        lookup: (_h, _o, cb) => cb(null, pinned.address, pinned.family),
        timeout: timeoutMs,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const contentType = String(res.headers["content-type"] ?? "");
        if (status >= 300 && status < 400) {
          res.resume();
          return resolve({ status, contentType, location: String(res.headers.location ?? ""), body: "" });
        }
        if (/^audio\/(mpeg|aac|aacp|ogg|opus)/i.test(contentType)) {
          // It's the stream itself, not a playlist. Never buffer audio on the server.
          req.destroy();
          return resolve({ status, contentType, body: "" });
        }
        let size = 0;
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => {
          size += c.length;
          if (size > maxBytes) {
            req.destroy();
            return resolve({ status, contentType, body: Buffer.concat(chunks).toString("utf8") });
          }
          chunks.push(c);
        });
        res.on("end", () => resolve({ status, contentType, body: Buffer.concat(chunks).toString("utf8") }));
        res.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end();
  });
}

/** Parses .pls / .m3u / .m3u8 text into candidate stream URLs. HLS manifests are returned as-is. */
export function parsePlaylist(body: string, baseUrl: string): { hls: boolean; urls: string[] } {
  if (/#EXT-X-(TARGETDURATION|STREAM-INF|MEDIA-SEQUENCE)/.test(body)) return { hls: true, urls: [baseUrl] };
  const urls: string[] = [];
  for (const line of body.split(/\r?\n/)) {
    const t = line.trim();
    const pls = /^File\d+\s*=\s*(.+)$/i.exec(t);
    const cand = pls ? pls[1]!.trim() : t && !t.startsWith("#") && !t.startsWith("[") && !/^\w+\d*\s*=/.test(t) ? t : "";
    if (!cand) continue;
    try {
      const u = new URL(cand, baseUrl);
      if ((u.protocol === "http:" || u.protocol === "https:") && !urls.includes(u.toString())) urls.push(u.toString());
    } catch {
      /* ignore junk lines */
    }
    if (urls.length >= 5) break;
  }
  return { hls: false, urls };
}
