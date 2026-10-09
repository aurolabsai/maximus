/// Fångar texten innan den går iväg, och lämnar tillbaka den maskerad.
///
/// ── Varför den inte skickar åt dig ───────────────────────────────────────
///
/// Det frestande vore att maskera och trycka skicka automatiskt. Det gör den
/// inte, av två skäl.
///
/// Det ena är hantverk: varje sida har sin egen tillståndsmaskin för när
/// skicka-knappen får vara aktiv, och den ändras utan förvarning. Ett
/// tillägg som slåss mot den går sönder tyst.
///
/// Det andra är viktigare. Masken är ett påstående om vad som lämnar datorn,
/// och ett påstående ingen läst är ingen trygghet. Tillägget byter ut texten
/// i rutan och STANNAR. Du ser vad som står innan du skickar det.
///
/// ── Att den fallerar stängt ──────────────────────────────────────────────
///
/// Svarar inte MAXIMUS blockeras sändningen. Det är motsatsen till vad ett
/// bekvämt tillägg gör — och det enda försvarbara: ett tillägg som släpper
/// igenom texten omaskerad när det inte når MAXIMUS är ett tillägg som gör
/// precis det den finns för att förhindra, i just det ögonblick den behövs.

const MARKE = 'maximus-maskerad';

/// Var texten står på de sidor vi kan.
///
/// Listan är en fallback-kedja och inte ett urval: sidorna byter markering
/// utan förvarning, och en väljare som slutar träffa ska falla tillbaka på
/// nästa i stället för att göra tillägget verkningslöst.
const FALT = [
  'div[contenteditable="true"]',
  'textarea',
  '[role="textbox"]',
];

const synlig = n => n && n.offsetParent !== null && n.getBoundingClientRect().height > 0;

function skrivfaltet(fran) {
  const inre = fran?.closest?.('form') || document;
  for (const v of FALT) {
    const traffar = [...inre.querySelectorAll(v)].filter(synlig);
    if (traffar.length) return traffar.at(-1);
  }
  for (const v of FALT) {
    const traffar = [...document.querySelectorAll(v)].filter(synlig);
    if (traffar.length) return traffar.at(-1);
  }
  return null;
}

const texten = n => (n.tagName === 'TEXTAREA' ? n.value : n.innerText || '').trim();

/// Skriver tillbaka texten så att sidans egen tillståndsmaskin märker det.
///
/// `innerText = …` ensamt räcker inte: React lyssnar på input-händelser, och
/// en ruta som ser full ut med en avstängd skicka-knapp är värre än ingen
/// ändring alls.
function satText(n, text) {
  if (n.tagName === 'TEXTAREA') {
    const satt = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    satt.call(n, text);
  } else {
    n.focus();
    const val = document.createRange();
    val.selectNodeContents(n);
    const s = window.getSelection();
    s.removeAllRanges();
    s.addRange(val);
    document.execCommand('insertText', false, text);
    return;
  }
  n.dispatchEvent(new Event('input', { bubbles: true }));
  n.dispatchEvent(new Event('change', { bubbles: true }));
}

// ── Beskedet ──────────────────────────────────────────────────────────────

let rutan = null;
function sag(text, sort = '') {
  rutan?.remove();
  rutan = document.createElement('div');
  rutan.className = `maximus-ruta ${sort}`;
  const m = document.createElement('span');
  m.className = 'maximus-marke';
  m.textContent = 'MAXIMUS';
  const t = document.createElement('span');
  t.textContent = text;
  rutan.append(m, t);
  document.body.append(rutan);
  const min = rutan;
  setTimeout(() => { if (rutan === min) { min.remove(); rutan = null; } }, sort === 'fel' ? 9000 : 5000);
}

// ── Grinden ───────────────────────────────────────────────────────────────

/// Texter som redan maskerats. En andra Enter ska skicka, inte maskera igen.
const klara = new WeakMap();

async function grinda(handelse, falt) {
  const text = texten(falt);
  if (!text || text.length < 3) return true;
  if (klara.get(falt) === text) return true;      // du har sett den här

  handelse.preventDefault();
  handelse.stopImmediatePropagation();

  let svar;
  try {
    svar = await chrome.runtime.sendMessage({ typ: 'maskera', text });
  } catch {
    svar = { fel: 'nere' };
  }

  if (svar?.av) { klara.set(falt, text); return true; }

  if (svar?.fel === 'parning') {
    sag('Tillägget är inte ihopparat med MAXIMUS. Öppna tilläggets inställningar.', 'fel');
    return false;
  }
  if (svar?.fel) {
    // Fallerar stängt. Ett tillägg som släpper igenom omaskerad text när det
    // inte når MAXIMUS gör precis det den finns för att förhindra.
    sag('MAXIMUS svarar inte — ingenting skickades. Starta MAXIMUS, eller stäng av masken i tillägget.', 'fel');
    return false;
  }

  const ny = svar.maskerad || text;
  if (ny === text) {
    klara.set(falt, text);
    sag('Inget att dölja. Tryck igen för att skicka.');
    return false;
  }

  satText(falt, ny);
  klara.set(falt, ny);
  sag(`${svar.antal} ${svar.antal === 1 ? 'uppgift' : 'uppgifter'} utbytta. Läs igenom och skicka.`);
  return false;
}

/// Enter, och knappen.
///
/// Fångas i infångningsfasen: sidans egna lyssnare sitter längre in, och en
/// lyssnare som kommer efter dem kommer efter sändningen.
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
  const falt = e.target.closest?.(FALT.join(',')) || skrivfaltet(e.target);
  if (!falt) return;
  grinda(e, falt);
}, true);

document.addEventListener('click', e => {
  const knapp = e.target.closest?.('button');
  if (!knapp) return;
  const etikett = `${knapp.getAttribute('aria-label') || ''} ${knapp.dataset.testid || ''} ${knapp.title || ''}`.toLowerCase();
  if (!/send|skicka|submit/.test(etikett)) return;
  const falt = skrivfaltet(knapp);
  if (!falt) return;
  grinda(e, falt);
}, true);

// Märket i hörnet säger att tillägget lever. Ett skydd man inte ser är ett
// skydd man inte vet om man har.
chrome.runtime.sendMessage({ typ: 'lage' }).then(i => {
  if (!i?.maskera) return;
  document.documentElement.setAttribute(`data-${MARKE}`, i.parad ? 'pa' : 'oparad');
}).catch(() => {});
