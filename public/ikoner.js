
const RAM = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"'
  + ' stroke-linecap="square" stroke-linejoin="miter"';

const M = 'fill="currentColor" stroke="none"';

const FORMER = {
  ny:        '<path d="M12 4.6v14.8M4.6 12h14.8" stroke-width="2.2"/>',
  mikrofon:  `<rect ${M} x="8.4" y="2.6" width="7.2" height="11.6" rx="3.6"/>`
             + '<path d="M5.2 11.2a6.8 6.8 0 0 0 13.6 0" stroke-width="1.9"/><path d="M12 18v3.4" stroke-width="2.2"/>',
  skicka:    `<path ${M} d="M12 3.2l7.2 7.6h-14.4z"/><path d="M12 10.4v10.4" stroke-width="2.6"/>`,
  ner:       `<path ${M} d="M12 20.8l-7.2-7.6h14.4z"/><path d="M12 13.6V3.2" stroke-width="2.6"/>`,
  importera: `<path ${M} d="M12 14.2l-4.8-5.2h9.6z"/><path d="M12 9V2.8" stroke-width="2.6"/>`
             + '<path d="M3.6 14.4v6.2h16.8v-6.2" stroke-width="2"/>',
  hjalp:     `<circle cx="12" cy="12" r="9" stroke-width="2.1"/>`
             + '<path d="M9.3 9.4a2.8 2.8 0 1 1 3.2 3.1v1.6" stroke-width="1.5"/>'
             + `<path ${M} d="M11.2 16.4h1.7v1.7h-1.7z"/>`,
  djup:      '<circle cx="10.4" cy="10.4" r="6.3" stroke-width="2.1"/>'
             + '<path d="M15.1 15.1L20.8 20.8" stroke-width="2.8"/>'
             + '<path d="M7.4 10.4h6M10.4 7.4v6" stroke-width="1.4"/>',
  dela:      `<path ${M} d="M16.4 2.6h4.8v4.8h-4.8zM2.6 9.6h4.8v4.8H2.6zM16.4 16.6h4.8v4.8h-4.8z"/>`
             + '<path d="M7.8 11.1l8.6-3.8M7.8 12.9l8.6 3.8" stroke-width="1.4"/>',
  sido:      '<rect x="3" y="4" width="18" height="16" rx="1" stroke-width="2.1"/>'
             + `<path ${M} d="M4.1 5.1h4.9v13.8H4.1z"/>`,
  liggare:   '<rect x="4.4" y="2.8" width="15.2" height="18.4" rx="1" stroke-width="2.1"/>'
             + `<path ${M} d="M4.4 2.8h3.4v18.4H4.4z"/>`
             + '<path d="M10.2 7.6h6.4M10.2 12h6.4M10.2 16.4h3.6" stroke-width="1.4"/>',
  papperskorg: '<path d="M3.4 6.4h17.2" stroke-width="2.6"/>'
             + `<path ${M} d="M9.2 3h5.6v2.4H9.2z"/>`
             + '<path d="M5.8 6.6l1.1 14.2h10.2l1.1-14.2" stroke-width="2"/>'
             + '<path d="M10 10.4v6.6M14 10.4v6.6" stroke-width="1.3"/>',
  arkiv:     `<path ${M} d="M2.8 3.6h18.4v4.6H2.8z"/>`
             + '<path d="M4.6 8.8v10.6a1 1 0 0 0 1 1h12.8a1 1 0 0 0 1-1V8.8" stroke-width="2"/>'
             + '<path d="M9.6 13h4.8" stroke-width="1.6"/>',
  kugghjul:  '<path d="M19.07 9.81 L21.46 10.38 L21.46 13.62 L19.07 14.19 L18.55 15.45 L19.84 17.54 L17.54 19.84 L15.45 18.55 L14.19 19.07 L13.62 21.46 L10.38 21.46 L9.81 19.07 L8.55 18.55 L6.46 19.84 L4.16 17.54 L5.45 15.45 L4.93 14.19 L2.54 13.62 L2.54 10.38 L4.93 9.81 L5.45 8.55 L4.16 6.46 L6.46 4.16 L8.55 5.45 L9.81 4.93 L10.38 2.54 L13.62 2.54 L14.19 4.93 L15.45 5.45 L17.54 4.16 L19.84 6.46 L18.55 8.55Z" stroke-width="2" stroke-linejoin="round"/>'
             + '<circle cx="12" cy="12" r="3.4" stroke-width="1.6"/>'
             + `<circle ${M} cx="12" cy="12" r="1.3"/>`,
  hem:       '<path d="M3.6 10.6L12 3.6l8.4 7v9.8H3.6z" stroke-width="2"/>'
             + `<path ${M} d="M9.8 20.4v-5.6h4.4v5.6z"/>`,
  agent:     '<path d="M12 2.8v8.6" stroke-width="2.4"/>'
             + '<path d="M6.4 6.2a8.2 8.2 0 1 0 11.2 0" stroke-width="2"/>',
  uppdrag:   '<circle cx="12" cy="12" r="8.6" stroke-width="2"/>'
             + '<circle cx="12" cy="12" r="4.4" stroke-width="1.5"/>'
             + `<circle ${M} cx="12" cy="12" r="1.6"/>`,
  samtal:    '<path d="M3.4 5.2a1 1 0 0 1 1-1h15.2a1 1 0 0 1 1 1v10.4a1 1 0 0 1-1 1H9.4l-4.6 3.6v-3.6H4.4a1 1 0 0 1-1-1z" stroke-width="2"/>'
             + '<path d="M7.6 9.2h8.8M7.6 12.4h5.6" stroke-width="1.4"/>',
  mapp:      '<path d="M3 20.4V6.6a1 1 0 0 1 1-1h6.2l2.1 2.8H21v12z" stroke-width="2"/>'
             + `<path ${M} d="M12 17.2l-3.4-3.8h6.8z"/>`
             + '<path d="M12 13.8v-3.4" stroke-width="2.2"/>',
  inkorg:    '<path d="M2.6 13.4L5 4.4h14l2.4 9v6H2.6z" stroke-width="2"/>'
             + `<path ${M} d="M2.6 13.4h5.4l1.4 2.8h5.4l1.4-2.8h5.4v6H2.6z"/>`,
  las:       `<path ${M} d="M4.4 10.2h15.2v10.6H4.4z"/>`
             + '<path d="M7.8 10.2V7.4a4.2 4.2 0 0 1 8.4 0v2.8" stroke-width="2.3"/>',
  laset_upp: `<path ${M} d="M4.4 10.2h15.2v10.6H4.4z"/>`
             + '<path d="M7.8 10.2V7.4a4.2 4.2 0 0 1 8.1-1.5" stroke-width="2.3"/>',
  kopiera:   '<path d="M15.6 3.4H4.4v11.8" stroke-width="1.7"/>'
             + `<path ${M} d="M8.2 7.2h11.8v13.4H8.2z"/>`,
  installningar: '<path d="M2.8 6.6h18.4M2.8 12h18.4M2.8 17.4h18.4" stroke-width="1.4"/>'
             + `<path ${M} d="M6 4.2h2.8v4.8H6zM13.8 9.6h2.8v4.8h-2.8zM9 15h2.8v4.8H9z"/>`,
  stopp:     `<path ${M} d="M6.4 6.4h11.2v11.2H6.4z"/>`,
  klar:      '<path d="M4.2 12.2l5.2 5.2L20 6.6" stroke-width="2.8"/>',
  fastnal:   `<path ${M} d="M14.6 2.8l6.6 6.6-2.8 2.8-1.6 5.8-8.4-8.4 5.8-1.6z"/>`
             + '<path d="M9 15L3.4 20.6" stroke-width="2.2"/>',
  bokmarke:  `<path ${M} d="M5.8 3h12.4v18.2L12 16.4l-6.2 4.8z"/>`,
  plus:      '<path d="M12 5.2v13.6M5.2 12h13.6" stroke-width="2.2"/>',
  citat:     `<path ${M} d="M4.2 8.8h4.6v4.6H4.2zM13.2 8.8h4.6v4.6h-4.6z"/>`
             + '<path d="M8.8 13.4c0 2.8-1.5 4.5-4.6 5.2M17.8 13.4c0 2.8-1.5 4.5-4.6 5.2" stroke-width="1.4"/>',
  mask:      '<path d="M3.6 6.6h16.8" stroke-width="1.5"/>'
             + `<path ${M} d="M3.6 10.4h10.4v3.2H3.6z"/>`
             + '<path d="M16.4 12h4" stroke-width="1.5"/>'
             + '<path d="M3.6 17.4h12.6" stroke-width="1.5"/>',
  lage:      `<path ${M} d="M12 3l8.6 4.3-8.6 4.3-8.6-4.3z"/>`
             + '<path d="M3.4 12l8.6 4.3 8.6-4.3M3.4 16.4l8.6 4.3 8.6-4.3" stroke-width="1.6"/>',
  kalender:  '<path d="M7.4 2.6v3.8M16.6 2.6v3.8" stroke-width="2.2"/>'
             + '<rect x="3.4" y="4.8" width="17.2" height="15.8" rx="1" stroke-width="2"/>'
             + `<path ${M} d="M3.4 4.8h17.2v4.2H3.4z"/>`
             + '<path d="M7.4 13h3.2M13.4 13h3.2M7.4 16.8h3.2" stroke-width="1.4"/>',
  frist:     '<circle cx="12" cy="12.4" r="8.4" stroke-width="2.1"/>'
             + '<path d="M12 7.2v5.2l3.8 2.3" stroke-width="2.2"/>',
  pil_upp:   '<path d="M5.8 14.8L12 8.6l6.2 6.2" stroke-width="2.2"/>',
  strom:     '<path d="M12 2.8v7.6" stroke-width="2.8"/>'
             + '<path d="M17.6 6.4a7.8 7.8 0 1 1-11.2 0" stroke-width="2.1"/>',
  paus:      `<path ${M} d="M7.2 4.6h3.4v14.8H7.2zM13.4 4.6h3.4v14.8h-3.4z"/>`,
  spela:     `<path ${M} d="M7.4 4.2L19.4 12 7.4 19.8z"/>`,
  glob:      '<circle cx="12" cy="12" r="8.6" stroke-width="2.1"/>'
             + '<path d="M3.4 12h17.2" stroke-width="1.5"/>'
             + '<ellipse cx="12" cy="12" rx="3.9" ry="8.6" stroke-width="1.5"/>',
  omkor:     '<path d="M20.6 12a8.6 8.6 0 1 1-2.6-6.2" stroke-width="2.1"/>'
             + `<path ${M} d="M21.4 2.4v6.6h-6.6z"/>`,
  penna:     `<path ${M} d="M16.2 2.8l5 5-2.8 2.8-5-5z"/>`
             + '<path d="M13.4 5.6L3.6 15.4v5h5l9.8-9.8" stroke-width="1.9"/>',
  punkter:   `<path ${M} d="M3.2 10.4h3.2v3.2H3.2zM10.4 10.4h3.2v3.2h-3.2zM17.6 10.4h3.2v3.2h-3.2z"/>`,
  mapp_ny:   '<path d="M3 20.4V6.6a1 1 0 0 1 1-1h6.2l2.1 2.8H21v12z" stroke-width="2"/>'
             + '<path d="M12 11v5.4M9.3 13.7h5.4" stroke-width="2.2"/>',
  underlag:  '<path d="M13.6 3.2H5.8a1 1 0 0 0-1 1v15.6a1 1 0 0 0 1 1h12.4a1 1 0 0 0 1-1V8.8z" stroke-width="2"/>'
             + `<path ${M} d="M13.6 3.2L19.2 8.8h-5.6z"/>`
             + '<path d="M8.2 13h7.6M8.2 16.6h4.6" stroke-width="1.4"/>',
};

export function ikon(namn, storlek = 18) {
  const d = document.createElement('div');
  d.innerHTML = `<svg ${RAM} width="${storlek}" height="${storlek}">${FORMER[namn] || ''}</svg>`;
  const svg = d.firstChild;
  svg.style.width = svg.style.height = `${storlek / 16}rem`;
  return svg;
}

export const IKONER = Object.keys(FORMER);
