/**
 * Generates public/img/location-map.svg.
 *
 * Slippy-map tiles are not reachable from this build environment, and an
 * embedded third-party map frame would breach the site's own CSP. So the map
 * is hand-authored: a schematic of the real street layout around Wharf Road,
 * drawn to the same palette as the rest of the site, with the caption on the
 * page saying plainly that it is not to scale. Text is outlined rather than
 * set as <text>, because there are no system fonts to fall back on.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { drawText } from './lib/text-to-path.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = path.join(root, 'public/img');

const INK = '#1a1a17';
const MUTED = '#55554f';
const PAPER = '#f2f6f4';
const ROAD = '#ffffff';
const ROAD_EDGE = '#d6ded9';
const WATER = '#93c1b1';
const GREEN = '#dfe9e3';
const MARK = '#b9761f';
const PINE = '#24483d';

async function build() {
  const W = 520;
  const H = 380;

  const label = (text, x, y, { size = 11, face = 'sans-400', fill = MUTED, anchor = 'start', rotate = 0 } = {}) =>
    drawText(text, { x: rotate ? 0 : x, y: rotate ? 0 : y, size, face, fill, anchor }).then((svg) =>
      rotate ? `<g transform="translate(${x} ${y}) rotate(${rotate})">${svg}</g>` : svg,
    );

  const parts = [
    `<rect width="${W}" height="${H}" fill="${PAPER}"/>`,

    // Blocks of built-up land, so the roads read as roads.
    `<g fill="${GREEN}">
       <rect x="24" y="40" width="150" height="120" rx="3"/>
       <rect x="24" y="196" width="150" height="140" rx="3"/>
       <rect x="228" y="40" width="120" height="120" rx="3"/>
       <rect x="228" y="196" width="120" height="90" rx="3"/>
       <rect x="392" y="212" width="104" height="124" rx="3"/>
     </g>`,

    // Regent's Canal, running across the south.
    `<path d="M24 352 C 140 340, 250 366, 360 346 S 470 330, 496 340" fill="none" stroke="${WATER}" stroke-width="14" stroke-linecap="round"/>`,

    // City Road: the main diagonal across the north east.
    `<path d="M330 24 L 496 190" fill="none" stroke="${ROAD_EDGE}" stroke-width="26" stroke-linecap="round"/>`,
    `<path d="M330 24 L 496 190" fill="none" stroke="${ROAD}" stroke-width="20" stroke-linecap="round"/>`,

    // Wharf Road: runs north from City Road, past the studio.
    `<path d="M199 336 L 199 96 L 372 96" fill="none" stroke="${ROAD_EDGE}" stroke-width="22" stroke-linejoin="round"/>`,
    `<path d="M199 336 L 199 96 L 372 96" fill="none" stroke="${ROAD}" stroke-width="16" stroke-linejoin="round"/>`,

    // Two connecting side streets.
    `<path d="M24 178 L 199 178" fill="none" stroke="${ROAD_EDGE}" stroke-width="18"/>`,
    `<path d="M24 178 L 199 178" fill="none" stroke="${ROAD}" stroke-width="12"/>`,
    `<path d="M199 296 L 380 296" fill="none" stroke="${ROAD_EDGE}" stroke-width="18"/>`,
    `<path d="M199 296 L 380 296" fill="none" stroke="${ROAD}" stroke-width="12"/>`,

    // The studio: a marker on the west side of Wharf Road.
    `<circle cx="186" cy="228" r="11" fill="${MARK}"/>`,
    `<circle cx="186" cy="228" r="4.5" fill="${PAPER}"/>`,

    // Old Street station, to the south west, as an interchange roundel.
    `<circle cx="70" cy="316" r="9" fill="none" stroke="${PINE}" stroke-width="3.5"/>`,
    `<rect x="56" y="314" width="28" height="4" fill="${PINE}"/>`,
  ];

  parts.push(
    await label("Regent's Canal", 300, 372, { size: 10, fill: '#3f6f60' }),
    await label('City Road', 404, 104, { size: 11, rotate: 45 }),
    await label('Wharf Road', 208, 150, { size: 11 }),
    await label('Shepherdess Walk', 34, 170, { size: 10 }),
    await label('Micawber Street', 214, 288, { size: 10 }),
    await label('Wenlock Studios', 172, 224, { size: 12, face: 'sans-600', fill: INK, anchor: 'end' }),
    await label('50-52 Wharf Road, N1 7EU', 172, 239, { size: 10, fill: MUTED, anchor: 'end' }),
    await label('Old Street', 70, 340, { size: 10, fill: PINE, anchor: 'middle' }),
    await label('Not to scale', 300, 26, { size: 10, fill: MUTED, anchor: 'middle' }),
  );

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Schematic map of the streets around Wharf Road, London N1">
${parts.join('\n')}
</svg>
`;

  await mkdir(out, { recursive: true });
  await writeFile(path.join(out, 'location-map.svg'), svg);
  console.log(`location map: ${W}x${H}, ${svg.length} bytes`);
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
