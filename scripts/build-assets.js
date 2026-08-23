/**
 * Asset build.
 *
 * Copies the latin subsets of the two self-hosted typefaces out of
 * node_modules, and rasterises the brand mark into the icon and social-card
 * sizes browsers actually ask for. Runs before `npm start`; the outputs are
 * committed so the running server never needs a build step or a CDN.
 */
import { mkdir, copyFile, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';
import { drawText, textWidth } from './lib/text-to-path.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const fontsOut = path.join(root, 'public/fonts');
const imgOut = path.join(root, 'public/img');

const FONTS = [
  ['@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2', 'ibm-plex-sans-400.woff2'],
  ['@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-500-normal.woff2', 'ibm-plex-sans-500.woff2'],
  ['@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff2', 'ibm-plex-sans-600.woff2'],
  ['@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-700-normal.woff2', 'ibm-plex-sans-700.woff2'],
  ['@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2', 'ibm-plex-mono-400.woff2'],
];

async function copyFonts() {
  await mkdir(fontsOut, { recursive: true });
  for (const [from, to] of FONTS) {
    await copyFile(path.join(root, 'node_modules', from), path.join(fontsOut, to));
  }
  console.log(`fonts: ${FONTS.length} files`);
}

/** Square icon artwork: the mark on a solid tile so it survives dark tabs. */
function iconSvg(size, { tile = true } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">
    ${tile ? '<rect width="32" height="32" rx="6" fill="#f2f6f4"/>' : ''}
    <path d="M16 3.2 5.4 6.8v8.9c0 6.2 4.3 10.7 10.6 13.1 6.3-2.4 10.6-6.9 10.6-13.1V6.8Z" fill="#24483d"/>
    <circle cx="16" cy="15" r="5.7" fill="none" stroke="#f2f6f4" stroke-width="2.2"/>
    <path d="M12.2 18.8 19.8 11.2" stroke="#e0bb8b" stroke-width="2.6" stroke-linecap="round"/>
  </svg>`;
}

async function buildIcons() {
  await mkdir(imgOut, { recursive: true });

  const png = (size) =>
    sharp(Buffer.from(iconSvg(size)), { density: 384 }).resize(size, size).png({ compressionLevel: 9 });

  await png(180).toFile(path.join(imgOut, 'apple-touch-icon.png'));
  await png(192).toFile(path.join(imgOut, 'icon-192.png'));
  await png(512).toFile(path.join(imgOut, 'icon-512.png'));

  // favicon.ico: a real multi-size ICO container (16/32/48), hand-assembled
  // because sharp does not write ICO.
  const sizes = [16, 32, 48];
  const images = await Promise.all(
    sizes.map((s) => sharp(Buffer.from(iconSvg(s)), { density: 384 }).resize(s, s).png({ compressionLevel: 9 }).toBuffer()),
  );
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  let offset = 6 + 16 * sizes.length;
  const entries = [];
  for (let i = 0; i < sizes.length; i++) {
    const e = Buffer.alloc(16);
    e.writeUInt8(sizes[i] === 256 ? 0 : sizes[i], 0);
    e.writeUInt8(sizes[i] === 256 ? 0 : sizes[i], 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(images[i].length, 8);
    e.writeUInt32LE(offset, 12);
    offset += images[i].length;
    entries.push(e);
  }
  await writeFile(path.join(root, 'public/favicon.ico'), Buffer.concat([header, ...entries, ...images]));
  console.log('icons: favicon.ico, apple-touch-icon, 192, 512');
}

/**
 * Social share card. Drawn as vector text so there is no photography and
 * nothing generated — it is the same mark, wordmark and one honest line.
 */
async function buildSocialCard() {
  const W = 1200;
  const H = 630;
  const M = 96;             // page margin
  const ink = '#1a1a17';
  const muted = '#55554f';

  // Headline is wrapped to the available width using real glyph metrics,
  // so it can never run off the canvas.
  const headline = 'DNS filtering that blocks gambling sites at the network level.';
  const headlineOpts = { face: 'sans-700', size: 62, letterSpacing: -1.6 };
  const lines = await wrap(headline, W - M * 2, headlineOpts);

  const sub = 'Self-hosted resolver. Published blocklist sources. No account needed to test it.';
  const subOpts = { face: 'sans-400', size: 27 };

  const parts = [];
  parts.push(`<rect width="${W}" height="${H}" fill="#ffffff"/>`);
  parts.push(`<rect x="0" y="0" width="${W}" height="12" fill="#24483d"/>`);

  // mark + wordmark
  parts.push(`<g transform="translate(${M} 118) scale(2.5)">
    <path d="M16 3.2 5.4 6.8v8.9c0 6.2 4.3 10.7 10.6 13.1 6.3-2.4 10.6-6.9 10.6-13.1V6.8Z" fill="#24483d"/>
    <circle cx="16" cy="15" r="5.7" fill="none" stroke="#ffffff" stroke-width="2.2"/>
    <path d="M12.2 18.8 19.8 11.2" stroke="#b9761f" stroke-width="2.6" stroke-linecap="round"/>
  </g>`);
  parts.push(await drawText('NetGuard', { x: M + 96, y: 168, fill: ink, face: 'sans-600', size: 44, letterSpacing: -0.8 }));

  let y = 300;
  for (const line of lines) {
    parts.push(await drawText(line, { x: M, y, fill: ink, ...headlineOpts }));
    y += 74;
  }

  y += 6;
  parts.push(await drawText(sub, { x: M, y, fill: muted, ...subOpts }));

  parts.push(`<rect x="${M}" y="${H - 106}" width="220" height="6" fill="#b9761f"/>`);
  parts.push(await drawText('netguard.example', { x: M, y: H - 52, fill: muted, face: 'mono-400', size: 24 }));

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join('')}</svg>`;

  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(path.join(imgOut, 'social-card.png'));
  console.log(`social card: ${W}x${H}, ${lines.length} headline lines`);
}

/** Greedy word wrap measured with the real font metrics. */
async function wrap(text, maxWidth, opts) {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && (await textWidth(candidate, opts)) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * The one photographic-style asset on the site is a diagram, not a photo:
 * a schematic of where NetGuard sits in a home network. Vector in, vector
 * out — nothing is generated or stock.
 */
async function buildDiagram() {
  const src = await readFile(path.join(imgOut, 'network-diagram.svg'), 'utf8');
  await sharp(Buffer.from(src), { density: 200 })
    .resize(1024)
    .png({ compressionLevel: 9 })
    .toFile(path.join(imgOut, 'network-diagram.png'));
  console.log('diagram: network-diagram.png');
}

await copyFonts();
await buildIcons();
await buildSocialCard();
await buildDiagram();
console.log('assets built');
