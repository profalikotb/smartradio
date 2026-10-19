// Generates PWA / iOS icons from an inline SVG (no external assets). Run: npm run icons
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";

const art = (pad) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#12295a"/><stop offset="1" stop-color="#060f22"/></linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4d68c"/><stop offset="1" stop-color="#b8892e"/></linearGradient>
    <radialGradient id="knob" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="#f7dea0"/><stop offset=".7" stop-color="#c99a3c"/><stop offset="1" stop-color="#8f6a22"/></radialGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <g transform="translate(256 256) scale(${(512 - pad * 2) / 512}) translate(-256 -256)">
    <rect x="72" y="150" width="368" height="250" rx="44" fill="none" stroke="url(#gold)" stroke-width="14"/>
    <path d="M150 150 L330 84" stroke="url(#gold)" stroke-width="14" stroke-linecap="round"/>
    <circle cx="330" cy="84" r="12" fill="#f4d68c"/>
    <g stroke="#f4d68c" stroke-opacity=".55" stroke-width="5" stroke-linecap="round">
      ${Array.from({ length: 11 }, (_, i) => `<line x1="${112 + i * 14}" y1="${i % 5 === 0 ? 196 : 206}" x2="${112 + i * 14}" y2="222"/>`).join("")}
    </g>
    <line x1="168" y1="186" x2="168" y2="232" stroke="#2fbf8f" stroke-width="6" stroke-linecap="round"/>
    <g fill="#f4d68c" fill-opacity=".8">
      ${[0, 1, 2].map((r) => [0, 1, 2, 3].map((c) => `<circle cx="${122 + c * 30}" cy="${268 + r * 30}" r="7"/>`).join("")).join("")}
    </g>
    <circle cx="346" cy="300" r="62" fill="url(#knob)"/>
    <circle cx="346" cy="300" r="62" fill="none" stroke="#060f22" stroke-opacity=".35" stroke-width="4"/>
    <path d="M330 270 L330 330 L376 300 Z" fill="#0b1a33"/>
    <circle cx="404" cy="196" r="10" fill="#2fbf8f"/>
  </g>
</svg>`;

mkdirSync("public/icons", { recursive: true });
const out = [
  ["icon-192.png", 192, 24],
  ["icon-512.png", 512, 24],
  ["maskable-512.png", 512, 72],
  ["apple-touch-icon.png", 180, 36],
];
for (const [name, size, pad] of out) {
  await sharp(Buffer.from(art(pad))).resize(size, size).png({ compressionLevel: 9 }).toFile(`public/icons/${name}`);
}
await sharp(Buffer.from(art(24))).resize(48, 48).png().toFile("public/favicon.png");
writeFileSync("public/icons/icon.svg", art(24).trim());
console.log("icons written");
