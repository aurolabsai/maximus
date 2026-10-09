// Markdownrenderaren. Egen fil för att den ska gå att prova utan webbläsare
// och utan modell — det är den enda delen av ytan där ett fel tyst ger fel
// innehåll i stället för ett trasigt utseende.

import { t } from './sprakstod.js';

export const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ── Markdown ─────────────────────────────────────────────────────────────
   En riktig blockrenderare, inte fem reguljära uttryck.

   Den gamla escapade hela texten först och letade markup efteråt. Då har `>`
   redan blivit `&gt;`, och ett citatblock går inte att se. Samma sak med
   tabellernas rör efter att en cell innehållit ett `&`. Därför parsas
   strukturen på rå text, och escapningen sker när innehåll skrivs ut — aldrig
   före. Ingen läst webbsida kan bli HTML i ett svar.

   Stödet är valt efter vad ett svar till en handläggare faktiskt behöver:
   rubriker, tabeller, numrerade steg, citat ur en lagtext, och rutor för det
   som ska brytas ut. Rutorna följer GitHubs `> [!NOTE]`-konvention i stället
   för en egen — den finns, den är känd, och den skrivs av modeller utan att
   vi behöver lära dem något nytt. */

/// Är ```<ord> en kopierbar text eller riktig kod?
///
/// Exporterad för att den frågan ställs på två ställen. fragor.js hoppar
/// över kodblock när den letar efter frågor modellen ställt — och 2026-10-01
/// lade modellen sina frågor i en ```utkast-ruta, som inte är kod alls.
/// Panelen hittade noll frågor i ett svar som bestod av sju.
///
/// En andra kopia av listan hade gett samma fel nästa gång den växer.
///
/// Engelska märken sedan 2026-10-09: en engelsk prompt ger ```draft och
/// ```email. De svenska står kvar — gamla samtal har dem.
export const arUtkast = sprak => !sprak
  || /^(utkast|mejl|mail|brev|text|anteckning|svar|sammanfattning|underlag|beslutsunderlag|draft|email|letter|note|reply|answer|summary|brief|memo)$/
    .test(String(sprak).toLowerCase());

const RUTOR = {
  slutsats: 'slutsats', conclusion: 'slutsats', note: 'slutsats', tip: 'slutsats',
  varning: 'varning', warning: 'varning', caution: 'varning', important: 'varning',
  lucka: 'lucka', gap: 'lucka',
};

function inline(rå) {
  let t = esc(rå);
  // Kodspannen plockas undan först, annars tolkas markup inuti dem.
  const kod = [];
  t = t.replace(/`([^`]+)`/g, (_, k) => `\u0000K${kod.push(k) - 1}\u0000`);
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  t = t.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>');
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(^|\W)\*([^*\n]+)\*/g, '$1<em>$2</em>');
  t = t.replace(/\u0000K(\d+)\u0000/g, (_, i) => `<code>${kod[i]}</code>`);
  return t;
}

const celler = rad => rad.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());

/// Är rad n en tabellrubrik? Kräver rör på raden och en skiljerad under.
function tabellHar(rader, n) {
  const skilje = rader[n + 1];
  return rader[n]?.includes('|') && skilje && skilje.includes('-')
    && /^\s*\|?[\s:|-]+\|?\s*$/.test(skilje) && skilje.includes('|');
}

/* ── Checklistor ──────────────────────────────────────────────────────────
   `- [ ] ring kommunen` ska bli en ruta man kan bocka i, inte tre tecken
   som ser ut som en. Sagt rakt ut 2026-10-01: "då ska en riktig checklista
   faktiskt framgå. Inte bara en punktformslista."

   ── Nyckeln är texten, inte platsen ────────────────────────────────────

   Vad som är ikryssat sparas per session under en nyckel, och nyckeln är
   punktens egen text — normaliserad, inte var den står.

   Alternativet vore att numrera: svar tre, punkt fyra. Det går sönder på
   det man faktiskt gör med en checklista. Man ber om en uppdaterad lista,
   modellen skriver om den, och varje bock man satt är borta — numren pekar
   på en lista som inte finns längre.

   Med texten som nyckel följer bocken punkten. Skrivs punkten om är det en
   ny punkt, och den är obockad — vilket också är rätt: en omformulerad
   uppgift är en ändrad uppgift, och den som bockade av den gamla har inte
   sagt något om den nya. */
const KRYSS = /^\[([ xX])\]\s+(.*)$/;

/// Punktens identitet. Samma uppgift ska kännas igen oavsett om modellen
/// satte fetstil på den den här gången.
export const kryssnyckel = t => String(t ?? '')
  .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  .replace(/[*_`~]/g, '')
  .replace(/\s+/g, ' ')
  .trim().toLowerCase().slice(0, 200);

/// Punkt- och nummerlistor, med en nivå nästling.
///
/// Djupare än så blir oläsbart i en svarsbubbla, och en modell som nästlar
/// tre nivåer har oftast missförstått frågan snarare än svarat på den.
function lista(rader) {
  const ut = [];
  let öppen = null, inre = false;
  for (const rad of rader) {
    const m = /^(\s*)(?:([-*+])|(\d+)[.)])\s+(.*)$/.exec(rad);
    if (!m) { if (ut.length) ut[ut.length - 1] += '<br>' + inline(rad.trim()); continue; }
    const [, indrag, punkt, , text] = m;
    const sort = punkt ? 'ul' : 'ol';
    const nästlad = indrag.length >= 2;
    if (!öppen) { ut.push(`<${sort}>`); öppen = sort; }
    if (nästlad && !inre) { ut.push(`<${sort}>`); inre = true; }
    else if (!nästlad && inre) { ut.push(`</${sort}>`); inre = false; }
    // Rutan är en knapp, inte en <input type=checkbox>. Den ska gå att
    // trycka på med tumme, bära en tidsstämpel bredvid sig, och se ut som
    // resten av huset — tre saker webbläsarens egen ruta inte gör.
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

    // Kodstycke, eller ett utkast att kopiera rakt av.
    //
    // Prosarutan renderas som prosa. Den visade råa tecken: "### Vad
    // inspelningen handlar om" och "**fetstil**" stod kvar som de skrevs,
    // mitt i ett svar där allt annat var satt. Sett 2026-10-01 på en
    // SAMMANFATTNING. Koden lämnas förstås orörd — där ÄR tecknen texten.
    //
    // Källan sparas i data-ra, för kopieringsknappen ska ge markdown.
    //
    // Ett mejl till en rektor är inte kod, men det delar kodens behov: det
    // ska kunna lyftas ut helt, utan rubriker och resonemang runt omkring.
    // Därför en egen ruta med egen kopieringsknapp — prosa i prosans typsnitt,
    // kod i kodens.
    if (/^\s*```/.test(rad)) {
      const sprak = (rad.trim().slice(3).trim() || '').toLowerCase();
      const kropp = [];
      i++;
      while (i < rader.length && !/^\s*```/.test(rader[i])) kropp.push(rader[i++]);
      i++;
      const text = esc(kropp.join('\n'));
      // Rutan heter vad den innehåller.
      //
      // Allt hette "Utkast". Ett beslutsunderlag är inget utkast — det är
      // färdigt material någon ska fatta beslut på, och ordet utkast säger
      // åt läsaren att det ännu inte gäller.
      // Märket är modellens, rubriken appens språk (2026-10-09).
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

    // Rubrik. # blir h2 också — en h1 i en svarsbubbla skriker.
    const h = /^(#{1,4})\s+(.*)$/.exec(rad);
    if (h) { ut.push(`<h${h[1].length <= 2 ? 2 : 3}>${inline(h[2])}</h${h[1].length <= 2 ? 2 : 3}>`); i++; continue; }

    // Avdelare.
    if (/^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/.test(rad)) { ut.push('<hr>'); i++; continue; }

    // Tabell.
    if (tabellHar(rader, i)) {
      const rubrik = celler(rader[i]);
      const ställ = celler(rader[i + 1]).map(c =>
        /^:-+:$/.test(c) ? 'center' : /-+:$/.test(c) ? 'right' : 'left');
      i += 2;
      const kropp = [];
      while (i < rader.length && rader[i].includes('|') && rader[i].trim()) kropp.push(celler(rader[i++]));
      // Ställningen bärs av ett attribut, inte av en inline-stil. Appens CSP
      // har style-src 'self' — en style="" blockeras och kolumnen hamnade
      // kvar till vänster. Att lucka upp CSP:n för en textställning vore att
      // byta ett skydd mot en detalj.
      const td = (c, n, tag) => `<${tag}${ställ[n] && ställ[n] !== 'left' ? ` data-st="${ställ[n]}"` : ''}>${inline(c ?? '')}</${tag}>`;
      // Svepet ligger i en behållare, inte på tabellen. display: block på ett
      // table-element gör att det krymper till innehållet i stället för att
      // fylla bredden — tabellen blev halv på en bred skärm.
      ut.push(`<div class="tabellsvep"><table><thead><tr>${rubrik.map((c, n) => td(c, n, 'th')).join('')}</tr></thead>`
        + `<tbody>${kropp.map(r => `<tr>${rubrik.map((_, n) => td(r[n], n, 'td')).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }

    // Citat och rutor.
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

    // Lista.
    if (/^\s*(?:[-*+]|\d+[.)])\s+/.test(rad)) {
      const kropp = [];
      while (i < rader.length && rader[i].trim() && !/^\s*```/.test(rader[i])) {
        if (!/^\s*(?:[-*+]|\d+[.)])\s+/.test(rader[i]) && !/^\s{2,}\S/.test(rader[i])) break;
        kropp.push(rader[i++]);
      }
      ut.push(lista(kropp));
      continue;
    }

    // Stycke: samla till tom rad eller till något som börjar ett nytt block.
    const kropp = [];
    while (i < rader.length && rader[i].trim()
      && !/^\s*(?:```|#{1,4}\s|>|[-*+]\s|\d+[.)]\s)/.test(rader[i])
      && !tabellHar(rader, i)) kropp.push(rader[i++]);
    if (kropp.length) ut.push(`<p>${kropp.map(inline).join('<br>')}</p>`);
    else i++;
  }
  return ut.join('');
}

