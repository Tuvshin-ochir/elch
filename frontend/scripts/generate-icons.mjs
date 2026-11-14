/**
 * Generates every brand icon from one SVG mark (the Cyrillic "Э" drawn as a chat bubble).
 *
 *   node scripts/generate-icons.mjs
 *
 * Outputs
 *   src/app/icon.svg            — browser tab (modern browsers)
 *   src/app/favicon.ico         — 16/32/48 px fallback
 *   src/app/apple-icon.png      — iOS home screen (180 px, full-bleed)
 *   public/icons/icon-192.png, icon-512.png, icon-maskable-512.png — PWA manifest
 *   src/app/opengraph-image.png — link preview on Facebook / Messenger / Instagram (1200×630)
 *
 * Keep MARK in sync with src/components/Logo.tsx.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const p = (...x) => path.join(root, ...x);

// 64×64 design grid
const MARK = `<path d="M19.6 22.2A15.5 15.5 0 1 1 27 46.5L15 49l3.2-8" fill="none" stroke="#fff" stroke-width="5.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 32h16" stroke="#fff" stroke-width="5.6" stroke-linecap="round"/>`;
const GRADIENT = `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0e6a4b"/><stop offset=".55" stop-color="#22a06b"/><stop offset="1" stop-color="#a3e635"/></linearGradient>`;

/** Rounded tile (tab icon, PWA "any") */
const tile = (rx = 15) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs>${GRADIENT}</defs><rect width="64" height="64" rx="${rx}" fill="url(#g)"/>${MARK}</svg>`;

/** Full-bleed square; the OS applies its own mask. `scale` keeps the mark inside the safe zone. */
const bleed = (scale = 1) => {
  const t = 32 - 32 * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs>${GRADIENT}</defs><rect width="64" height="64" fill="url(#g)"/><g transform="translate(${t} ${t}) scale(${scale})">${MARK}</g></svg>`;
};

const png = (svg, size) => sharp(Buffer.from(svg), { density: Math.ceil((72 * size) / 64) * 2 }).resize(size, size).png().toBuffer();

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** Minimal .ico writer: PNG-compressed entries (supported by every current browser) */
function ico(images) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, e);
    header.writeUInt8(size >= 256 ? 0 : size, e + 1);
    header.writeUInt8(0, e + 2);
    header.writeUInt8(0, e + 3);
    header.writeUInt16LE(1, e + 4);
    header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(data.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map((x) => x.data)]);
}

const FONT = `font-family="'Helvetica Neue', Helvetica, Arial, sans-serif"`;

/** Rendered width of a line of text (so chat bubbles hug their text) */
async function textWidth(text, size, weight = 500) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="${size * 2}"><text x="0" y="${size * 1.4}" ${FONT} font-size="${size}" font-weight="${weight}" fill="#000">${esc(text)}</text></svg>`;
  const { info } = await sharp(Buffer.from(svg)).trim({ threshold: 1 }).toBuffer({ resolveWithObject: true });
  return info.width;
}

/** Facebook / Messenger link preview */
async function ogSvg() {
  const RIGHT = 1120;
  const chat = [
    { from: "user", text: "Пепперони хэд вэ?" },
    { from: "bot", text: "32,000₮. Хүргэж өгөх үү?" },
    { from: "user", text: "Тийм, 2-ыг авъя" },
    { from: "bot", text: "Захиалга бүртгэгдлээ" },
  ];
  const bubbles = [];
  for (const [i, m] of chat.entries()) {
    const w = (await textWidth(m.text, 27)) + 60;
    const h = 72;
    const y = 132 + i * 104;
    const bot = m.from === "bot";
    const x = bot ? RIGHT - w : RIGHT - 60 - w;
    const fill = bot ? "#12805a" : "#ffffff";
    const tail = bot ? `<path d="M${x + w - 30} ${y + h - 4} l26 14 l-4 -26 z" fill="${fill}"/>` : `<path d="M${x + 30} ${y + h - 4} l-26 14 l4 -26 z" fill="${fill}"/>`;
    bubbles.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="24" fill="${fill}"/>${tail}<text x="${x + 30}" y="${y + 46}" ${FONT} font-size="27" font-weight="500" fill="${bot ? "#ffffff" : "#0f1f1a"}">${esc(m.text)}</text>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    ${GRADIENT}
    <radialGradient id="glow" cx="0.85" cy="0" r="0.8"><stop offset="0" stop-color="#22a06b" stop-opacity=".22"/><stop offset="1" stop-color="#22a06b" stop-opacity="0"/></radialGradient>
    <filter id="sh" x="-10%" y="-10%" width="120%" height="140%"><feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#0f1f1a" flood-opacity=".10"/></filter>
  </defs>
  <rect width="1200" height="630" fill="#faf6ee"/>
  <rect width="1200" height="630" fill="url(#glow)"/>

  <g transform="translate(80 92)">
    <svg width="96" height="96" viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="url(#g)"/>${MARK}</svg>
    <text x="120" y="68" ${FONT} font-size="64" font-weight="800" fill="#0f1f1a">Элч</text>
  </g>

  <text x="80" y="300" ${FONT} font-size="56" font-weight="800" fill="#0f1f1a">Хэрэглэгч бүрт</text>
  <text x="80" y="372" ${FONT} font-size="56" font-weight="800" fill="#12805a">шууд, найрсаг хариу.</text>
  <text x="80" y="440" ${FONT} font-size="25" fill="#6b6559">Messenger · Instagram · Вэбсайт</text>
  <text x="80" y="476" ${FONT} font-size="25" fill="#6b6559">24/7 хариулдаг AI туслах</text>
  <text x="80" y="548" ${FONT} font-size="24" font-weight="700" fill="#0e6a4b">Таны бизнесийн элч</text>

  <g filter="url(#sh)">${bubbles.join("")}</g>
</svg>`;
}

await mkdir(p("public/icons"), { recursive: true });

await writeFile(p("src/app/icon.svg"), tile());
await writeFile(p("src/app/favicon.ico"), ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await png(tile(size <= 16 ? 13 : 15), size) })))));
await writeFile(p("src/app/apple-icon.png"), await png(bleed(0.86), 180));
await writeFile(p("public/icons/icon-192.png"), await png(tile(), 192));
await writeFile(p("public/icons/icon-512.png"), await png(tile(), 512));
// maskable: keep the mark inside the 80% safe circle
await writeFile(p("public/icons/icon-maskable-512.png"), await png(bleed(0.72), 512));
await writeFile(p("src/app/opengraph-image.png"), await sharp(Buffer.from(await ogSvg()), { density: 144 }).resize(1200, 630).png().toBuffer());
await writeFile(p("src/app/opengraph-image.alt.txt"), "Элч — Хэрэглэгч бүрт шууд, найрсаг хариу. Messenger, Instagram, вэбсайтад 24/7 хариулдаг AI туслах.");

console.log("✓ icons generated");
