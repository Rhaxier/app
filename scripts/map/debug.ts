// `npm run map:debug` - writes map-debug/index.html, a single self-contained page
// with a floor switcher, for comparing the traced map against the layout PDF by eye.
// Open the file in any browser; no server is needed.

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { summariseMap, validateMap } from '../../src/features/map/nav/validate.ts';
import { loadMapData } from './load.ts';

const { geometry, connectors, assignments } = loadMapData();
const { graph } = validateMap(geometry, connectors);
const nameOf = new Map(assignments.map((assignment) => [assignment.roomId, assignment.name]));
const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ring = (polygon: [number, number][]) => `M${polygon.map(([x, y]) => `${x} ${y}`).join('L')}Z`;

const { minX, minY, maxX, maxY } = geometry.bounds;
const pad = 60;
const viewBox = `${minX - pad} ${minY - pad} ${maxX - minX + 2 * pad} ${maxY - minY + 2 * pad}`;

function floorSvg(floorId: string): string {
  const parts: string[] = [];
  const regions = geometry.regions.filter((region) => region.floor === floorId);
  for (const region of regions) {
    const shape = [region.polygon, ...(region.holes ?? [])].map(ring).join('');
    const label = nameOf.get(region.id) ?? region.sourceLabel ?? '';
    parts.push(
      `<path class="region ${region.kind}" fill-rule="evenodd" d="${shape}"><title>${region.id} ${escape(label)} (${region.kind})</title></path>`,
    );
  }
  parts.push('<g class="graph">');
  for (const edge of graph.edges) {
    const a = graph.nodes.get(edge.a);
    const b = graph.nodes.get(edge.b);
    if (a && b && a.floor === floorId && b.floor === floorId) {
      const extra = `${edge.door ? ' through-door' : ''}${edge.connector ? ' to-connector' : ''}`;
      parts.push(`<line class="edge${extra}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`);
    }
  }
  for (const node of graph.nodes.values()) {
    if (node.floor === floorId && node.kind !== 'door' && node.kind !== 'connector') {
      parts.push(
        `<circle class="node ${node.kind}" cx="${node.x}" cy="${node.y}" r="${node.kind === 'room' ? 4 : 2.5}"><title>${node.id}</title></circle>`,
      );
    }
  }
  parts.push('</g><g class="doors">');
  for (const door of geometry.doors) {
    if (door.floor === floorId) {
      const exit = door.b === 'outside' ? ' exit' : '';
      parts.push(
        `<rect class="door ${door.kind}${exit}" x="${door.x - 6}" y="${door.y - 6}" width="12" height="12"><title>${door.id} ${door.kind}: ${door.a} / ${door.b}</title></rect>`,
      );
    }
  }
  parts.push('</g><g class="labels">');
  for (const region of regions) {
    if (region.kind === 'void') {
      continue;
    }
    const [x, y] = region.labelAt;
    const label = nameOf.get(region.id) ?? region.sourceLabel;
    if (label) {
      parts.push(`<text class="name" x="${x}" y="${y - 3}">${escape(label)}</text>`);
    }
    parts.push(
      `<text class="id" x="${x}" y="${y + 11}">${region.id.split('-')[1]}${region.kind === 'stairwell' ? ' stairs?' : ''}</text>`,
    );
  }
  for (const place of geometry.places) {
    if (place.floor === floorId) {
      const label = nameOf.get(place.id) ?? place.sourceLabel ?? '';
      parts.push(
        `<circle class="place" cx="${place.x}" cy="${place.y}" r="7"><title>${place.id}</title></circle>`,
      );
      parts.push(`<text class="name" x="${place.x}" y="${place.y - 11}">${escape(label)}</text>`);
    }
  }
  parts.push('</g><g class="connectors">');
  for (const stop of graph.link.stops) {
    if (stop.floor === floorId) {
      const connector = graph.connectors.get(stop.connector);
      const { x, y } = stop.position;
      parts.push(
        `<circle class="connector ${connector?.type}" cx="${x}" cy="${y}" r="14"><title>${escape(connector?.name ?? '')}</title></circle>`,
      );
      parts.push(
        `<text class="name" x="${x}" y="${y - 18}">${escape(connector?.name ?? '')}</text>`,
      );
    }
  }
  parts.push('</g>');
  return `<svg id="floor-${floorId}" class="floor" viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">${parts.join('')}</svg>`;
}

const css = `
body{margin:0;font:14px system-ui,sans-serif;background:#f4f4f2;color:#222}
header{position:sticky;top:0;background:#fff;border-bottom:1px solid #ccc;padding:8px 12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;z-index:2}
button{font:inherit;padding:6px 14px;border:1px solid #999;border-radius:6px;background:#fff;cursor:pointer}
button.on{background:#0b5cad;color:#fff;border-color:#0b5cad}
label{margin-left:8px}
.floor{display:none;width:100%;height:auto;background:#fff}
.floor.on{display:block}
.region{stroke:#222;stroke-width:2}
.region.room{fill:#fde9c8}.region.corridor{fill:#dcebfb}.region.stairwell{fill:#f7c6d9}.region.void{fill:#eee;stroke:#bbb;stroke-dasharray:6 6}
.edge{stroke:#0b5cad;stroke-width:1.6}.edge.through-door{stroke:#1a8a3a}.edge.to-connector{stroke:#c0168a;stroke-width:3}
.place{fill:#e08a00;stroke:#fff;stroke-width:2}
.node.place{fill:none}
.node.corridor{fill:#0b5cad}.node.room{fill:#b35c00}.node.snap{fill:#c0168a}
.door.door{fill:#18a558}.door.opening{fill:#d22}.door.inferred{fill:#fff;stroke:#18a558;stroke-width:2.5}.door.exit{stroke:#000;stroke-width:2.5}
.connector{fill:#c0168a;stroke:#fff;stroke-width:3}.connector.lift{fill:#6a2bd9}
text{text-anchor:middle;pointer-events:none}
text.name{font:600 15px system-ui,sans-serif;fill:#111}
text.id{font:10px system-ui,sans-serif;fill:#555}
body.hide-graph .graph{display:none}body.hide-labels .labels{display:none}body.hide-doors .doors{display:none}
pre{margin:12px;padding:12px;background:#fff;border:1px solid #ccc;overflow:auto}
.legend span{display:inline-block;margin-right:14px}
.legend i{display:inline-block;width:12px;height:12px;margin-right:4px;vertical-align:-1px;border:1px solid #333}
`;
const swatch = (style: string, text: string) => `<span><i style="${style}"></i>${text}</span>`;
const legend = `<div class="legend">${[
  swatch('background:#fde9c8', 'room'),
  swatch('background:#dcebfb', 'corridor / open area'),
  swatch('background:#f7c6d9', 'stair symbol in PDF (suggestion only)'),
  swatch('background:#eee', 'not walkable'),
  swatch('background:#18a558', 'door drawn in PDF'),
  swatch('background:#fff;border:2px solid #18a558', 'inferred door'),
  swatch('background:#d22', 'red line in PDF'),
  swatch('background:#18a558;border:2px solid #000', 'door to outside'),
  swatch('background:#0b5cad', 'walkable graph'),
  swatch('background:#e08a00;border-radius:50%', 'named place without walls'),
  swatch('background:#c0168a', 'connector'),
].join('')}</div>`;
const buttons = geometry.floors
  .map((floor) => `<button data-floor="${floor.id}">${escape(floor.name)}</button>`)
  .join('');
const toggles = ['graph', 'labels', 'doors']
  .map((layer) => `<label><input type="checkbox" checked data-layer="${layer}"> ${layer}</label>`)
  .join('');
const script = `
const show=(id)=>{document.querySelectorAll('.floor').forEach(s=>s.classList.toggle('on',s.id==='floor-'+id));document.querySelectorAll('button[data-floor]').forEach(b=>b.classList.toggle('on',b.dataset.floor===id))};
document.querySelectorAll('button[data-floor]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.floor)));
document.querySelectorAll('input[data-layer]').forEach(c=>c.addEventListener('change',()=>document.body.classList.toggle('hide-'+c.dataset.layer,!c.checked)));
show(${JSON.stringify(geometry.floors[0].id)});`;
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Map debug view</title><style>${css}</style></head>
<body><header>${buttons}${toggles}</header><div style="padding:8px 12px">${legend}<p>Hover a shape for its id. Zoom with the browser (Ctrl +). All floors are drawn in the same coordinate system.</p></div>
${geometry.floors.map((floor) => floorSvg(floor.id)).join('\n')}
<pre>${escape(summariseMap(geometry, connectors, assignments))}</pre><script>${script}</script></body></html>`;

const outDir = fileURLToPath(new URL('../../map-debug/', import.meta.url));
mkdirSync(outDir, { recursive: true });
writeFileSync(`${outDir}index.html`, html);
console.log(
  `Wrote ${outDir}index.html (${Math.round(html.length / 1024)} KB). Open it in a browser.`,
);
