/**
 * Converts strings into SVG path data using the real IBM Plex outlines that
 * ship with the site.
 *
 * The rasteriser in the build has no system fonts installed, so any <text>
 * element would silently fall back to a different face and a different
 * width. Outlining the glyphs ourselves keeps the generated social card
 * identical to the typography the site actually serves, and lets us measure
 * text so nothing overflows the canvas.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as wawoff from 'wawoff2';
import { create } from 'fontkit';

const root = fileURLToPath(new URL('../..', import.meta.url));

const FILES = {
  'sans-400': '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2',
  'sans-600': '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff2',
  'sans-700': '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-700-normal.woff2',
  'mono-400': '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2',
};

const cache = new Map();

async function load(face) {
  if (cache.has(face)) return cache.get(face);
  const rel = FILES[face];
  if (!rel) throw new Error(`unknown face: ${face}`);
  const woff2 = await readFile(path.join(root, 'node_modules', rel));
  const font = create(Buffer.from(await wawoff.decompress(woff2)));
  cache.set(face, font);
  return font;
}

/**
 * @returns {{d: string, width: number}} path data positioned with its
 * baseline at y=0 and its start at x=0, plus the advance width in px.
 */
export async function textPath(text, { face = 'sans-400', size = 16, letterSpacing = 0 } = {}) {
  const font = await load(face);
  const scale = size / font.unitsPerEm;
  const run = font.layout(text);

  let x = 0;
  const parts = [];
  for (const glyph of run.glyphs) {
    const d = glyph.path.toSVG();
    if (d) parts.push(`<g transform="translate(${round(x)} 0) scale(${round(scale, 6)} ${round(-scale, 6)})"><path d="${d}"/></g>`);
    x += glyph.advanceWidth * scale + letterSpacing;
  }
  return { svg: parts.join(''), width: x - letterSpacing };
}

/** Measures without emitting geometry. */
export async function textWidth(text, opts = {}) {
  return (await textPath(text, opts)).width;
}

/**
 * Emits a filled, positioned line of text as outlines.
 * `anchor` accepts 'start', 'middle' or 'end', matching text-anchor.
 */
export async function drawText(text, { x = 0, y = 0, fill = '#000', anchor = 'start', ...opts } = {}) {
  const { svg, width } = await textPath(text, opts);
  const dx = anchor === 'middle' ? x - width / 2 : anchor === 'end' ? x - width : x;
  return `<g transform="translate(${round(dx)} ${round(y)})" fill="${fill}">${svg}</g>`;
}

function round(n, p = 3) {
  return Number(n.toFixed(p));
}
