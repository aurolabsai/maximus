
import { t } from './sprakstod.js';

export const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const arUtkast = sprak => !sprak
  || /^(utkast|mejl|mail|brev|text|anteckning|svar|sammanfattning|underlag|beslutsunderlag|draft|email|letter|note|reply|answer|summary|brief|memo)$/
    .test(String(sprak).toLowerCase());

const RUTOR = {
  slutsats: 'slutsats', conclusion: 'slutsats', note: 'slutsats', tip: 'slutsats',
  varning: 'varning', warning: 'varning', caution: 'varning', important: 'varning',
  lucka: 'lucka', gap: 'lucka',
};

export function lankAdress(url) {
  const m = /^https?:\/\/([^/?#]+)([^?#]*)([?#].*)?$/.exec(url);
  if (!m) return url;
  return m[3] ? url : m[1].replace(/^www\./, '');
}

function inline(rå) {
  let t = esc(rå);
  const kod = [];
  t = t.replace(/`([^`]+)`/g, (_, k) => `\u0000K${kod.push(k) - 1}\u0000`);
  const lankar = [];
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, text, url) => {
    const html = text === url ? `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
      : `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a> <span class="lank-adress">(${lankAdress(url)})</span>`;
    return `\u0000L${lankar.push(html) - 1}\u0000`;
  });
  t = t.replace(/(^|[\s(])(https?:\/\/[^\s<)\u0000]+)/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>');
  t = t.replace(/\u0000L(\d+)\u0000/g, (_, i) => lankar[i]);
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(^|\W)\*([^*\n]+)\*/g, '$1<em>$2</em>');
  t = t.replace(/\u0000K(\d+)\u0000/g, (_, i) => `<code>${kod[i]}</code>`);
  return t;
}

const celler = rad => rad.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());

function tabellHar(rader, n) {
  const skilje = rader[n + 1];
  return rader[n]?.includes('|') && skilje && skilje.includes('-')
    && /^\s*\|?[\s:|-]+\|?\s*$/.test(skilje) && skilje.includes('|');
}

const KRYSS = /^\[([ xX])\]\s+(.*)$/;

export const kryssnyckel = t => String(t ?? '')
  .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  .replace(/[*_`~]/g, '')
  .replace(/\s+/g, ' ')
  .trim().toLowerCase().slice(0, 200);

function lista(rader) {
  const ut = [];
  let öppen = null, inre = false;
  for (const rad of rader) {
    const m = /^(\s*)(?:([-*+])|(\d+)[.)])\s+(.*)$/.exec(rad);
    if (!m) {
      if (ut.length) {
        const sista = ut[ut.length - 1];
        ut[ut.length - 1] = sista.endsWith('</li>') ? `${sista.slice(0, -5)}<br>${inline(rad.trim())}</li>` : `${sista}<br>${inline(rad.trim())}`;
      }
      continue;
    }
    const [, indrag, punkt, , text] = m;
    const sort = punkt ? 'ul' : 'ol';
    const nästlad = indrag.length >= 2;
    if (!öppen) { ut.push(`<${sort}>`); öppen = sort; }
    if (nästlad && !inre) { ut.push(`<${sort}>`); inre = true; }
    else if (!nästlad && inre) { ut.push(`</${sort}>`); inre = false; }
    const k = KRYSS.exec(text);
    if (k) {
      ut.push(`<li class="kryss"${k[1] === ' ' ? '' : ' data-markerad="ja"'} `
        + `data-kryss="${esc(kryssnyckel(k[2]))}">`
        + '<button type="button" class="kryssruta" role="checkbox" aria-checked="false"></button>'
        + `<span class="kryss-text">${inline(k[2])}</span>`
        + '<span class="kryss-tid"></span></li>');
      continue;
    }
    ut.push(`<li>${inline(text)}</li>`);
  }
  if (inre) ut.push('</ul>');
  if (öppen) ut.push(`</${öppen}>`);
  return ut.join('');
}

export function md(text) {
  const rader = String(text ?? '').replace(/\r/g, '').split('\n');
  const ut = [];
  let i = 0;

  while (i < rader.length) {
    const rad = rader[i];

    if (!rad.trim()) { i++; continue; }

    if (/^\s*```/.test(rad)) {
      const sprak = (rad.trim().slice(3).trim() || '').toLowerCase();
      const kropp = [];
      i++;
      while (i < rader.length && !/^\s*```/.test(rader[i])) kropp.push(rader[i++]);
      i++;
      const text = esc(kropp.join('\n'));
      const RUBRIKER = { mejl: 'md.boxEmail', mail: 'md.boxEmail', email: 'md.boxEmail',
        brev: 'md.boxLetter', letter: 'md.boxLetter',
        anteckning: 'md.boxNote', note: 'md.boxNote',
        sammanfattning: 'md.boxSummary', summary: 'md.boxSummary',
        underlag: 'md.boxBrief', beslutsunderlag: 'md.boxBrief', brief: 'md.boxBrief', memo: 'md.boxBrief' };
      const utkast = arUtkast(sprak);
      const rubrik = utkast ? t(RUBRIKER[sprak] || 'md.boxDraft') : sprak;
      ut.push(`<div class="utkast${utkast ? '' : ' kod'}">`
        + `<div class="utkast-topp"><b>${esc(rubrik)}</b>`
        + `<button type="button" class="utkast-kopiera" title="${esc(t('md.copyThisTitle'))}" aria-label="${esc(t('md.copyDraftAria'))}"></button></div>`
        + `<div class="utkast-text${utkast ? ' prosa' : ''}"`
        + (utkast ? ` data-ra="${esc(kropp.join('\n'))}"` : '')
        + `>${utkast ? md(kropp.join('\n')) : text}</div></div>`);
      continue;
    }

    const h = /^(#{1,4})\s+(.*)$/.exec(rad);
    if (h) { ut.push(`<h${h[1].length <= 2 ? 2 : 3}>${inline(h[2])}</h${h[1].length <= 2 ? 2 : 3}>`); i++; continue; }

    if (/^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/.test(rad)) { ut.push('<hr>'); i++; continue; }

    if (tabellHar(rader, i)) {
      const rubrik = celler(rader[i]);
      const ställ = celler(rader[i + 1]).map(c =>
        /^:-+:$/.test(c) ? 'center' : /-+:$/.test(c) ? 'right' : 'left');
      i += 2;
      const kropp = [];
      while (i < rader.length && rader[i].includes('|') && rader[i].trim()) kropp.push(celler(rader[i++]));
      const td = (c, n, tag) => `<${tag}${ställ[n] && ställ[n] !== 'left' ? ` data-st="${ställ[n]}"` : ''}>${inline(c ?? '')}</${tag}>`;
      ut.push(`<div class="tabellsvep"><table><thead><tr>${rubrik.map((c, n) => td(c, n, 'th')).join('')}</tr></thead>`
        + `<tbody>${kropp.map(r => `<tr>${rubrik.map((_, n) => td(r[n], n, 'td')).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }

    if (/^\s*>/.test(rad)) {
      const kropp = [];
      while (i < rader.length && /^\s*>/.test(rader[i])) kropp.push(rader[i++].replace(/^\s*>\s?/, ''));
      const märke = /^\s*\[!(\p{L}+)\]\s*(.*)$/u.exec(kropp[0] || '');
      if (märke && RUTOR[märke[1].toLowerCase()]) {
        const sort = RUTOR[märke[1].toLowerCase()];
        const rest = [märke[2], ...kropp.slice(1)].filter(x => x.trim());
        ut.push(`<div class="ruta ruta-${sort}">${rest.map(r => `<p>${inline(r)}</p>`).join('')}</div>`);
      } else {
        ut.push(`<blockquote>${kropp.filter(r => r.trim()).map(r => `<p>${inline(r)}</p>`).join('')}</blockquote>`);
      }
      continue;
    }

    if (/^\s*(?:[-*+]|\d+[.)])\s+/.test(rad)) {
      const kropp = [];
      while (i < rader.length && rader[i].trim() && !/^\s*```/.test(rader[i])) {
        if (!/^\s*(?:[-*+]|\d+[.)])\s+/.test(rader[i]) && !/^\s{2,}\S/.test(rader[i])) break;
        kropp.push(rader[i++]);
      }
      ut.push(lista(kropp));
      continue;
    }

    const kropp = [];
    while (i < rader.length && rader[i].trim()
      && !/^\s*(?:```|#{1,4}\s|>|[-*+]\s|\d+[.)]\s)/.test(rader[i])
      && !tabellHar(rader, i)) kropp.push(rader[i++]);
    if (kropp.length) ut.push(`<p>${kropp.map(inline).join('<br>')}</p>`);
    else i++;
  }
  return ut.join('');
}

