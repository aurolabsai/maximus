// Ditt LinkedIn-flöde, från ditt perspektiv (Fas 47 del 2).
//
// Auro 2026-10-05: "vem är du, vart jobbar du, vad gör du, vad intresserar
// dig, vad riktas till dig och vad av det är relevant - 24/7."
//
// LinkedIn har inget öppet flödes-API för en privatperson, och en egen
// inloggning vore en till plats där ditt lösenord ligger. Safari har redan
// din inloggning: står LinkedIn öppet i en flik läser Maximus den fliken —
// flödet, eller det du gillat och kommenterat — som du själv ser det.
//
// Bara läsa. Inget klick, ingen rullning, inget skrivs. Fliken läses som den
// står; den som vill att mer följer med rullar själv. Maximus gillar,
// kommenterar och skickar aldrig något: läs, aldrig skriv — och aldrig
// sköta utskick åt dig.

/// Sidorna som läses: flödet och din egen aktivitet (reaktioner, kommentarer).
/// Adressen tolkas, den matchas inte som text: värden ska VARA linkedin.com
/// (eller www.), och sökvägen börja med /feed eller /in/…/recent-activity.
/// "https://annan.se/?linkedin.com/feed" är inte LinkedIn.
import { tx } from './sprakstod.mjs';
export const ADRESSER = [/^\/feed(\/|$)/i, /^\/in\/[^/]+\/recent-activity(\/|$)/i];
export const arLinkedin = host => /^(www\.)?linkedin\.com$/i.test(String(host || ''));
export function arFlode(url) {
  let u; try { u = new URL(String(url || '')); } catch { return false; }
  return u.protocol === 'https:' && arLinkedin(u.hostname) && ADRESSER.some(r => r.test(u.pathname));
}

/// Skriptet som körs i fliken. Varje inlägg har ett aktivitets-id i
/// LinkedIns sida (urn:li:activity:…); det blir postens id, så att samma
/// inlägg bara räknas en gång. Klasserna byter LinkedIn ibland, och då
/// faller läsningen tillbaka på sidans text i block.
export const SIDSKRIPT = `(() => {
  if (location.protocol !== 'https:' || !/^(www\\.)?linkedin\\.com$/i.test(location.hostname)) return '';
  const ut = [];
  const noder = document.querySelectorAll('[data-urn^="urn:li:activity"], [data-id^="urn:li:activity"]');
  for (const n of noder) {
    const id = n.getAttribute('data-urn') || n.getAttribute('data-id');
    const q = s => (n.querySelector(s)?.innerText || '').trim();
    const av = q('.update-components-actor__title, .update-components-actor__name, .feed-shared-actor__name');
    const om = q('.update-components-actor__description, .feed-shared-actor__description');
    const text = q('.update-components-text, .feed-shared-update-v2__description, .feed-shared-text') || (n.innerText || '').trim();
    const varfor = q('.update-components-header__text-view, .feed-shared-header__text');
    if (text) ut.push({ id, av, om, text: text.slice(0, 1500), varfor });
  }
  // Vem som är inloggad: LinkedIns egen meny bär namnet i profilbildens
  // alt-text. Så vet Maximus vilka inlägg som är dina (2026-10-06: Auros eget
  // inlägg lästes som "Henrik Lindgren har publicerat …").
  const jag = (document.querySelector('img.global-nav__me-photo, .global-nav__me img, .feed-identity-module img')?.getAttribute('alt') || '').trim().slice(0, 80);
  return JSON.stringify({ url: location.href, titel: document.title, jag, poster: ut.slice(0, 40),
    text: ut.length ? '' : (document.body.innerText || '').slice(0, 12000) });
})()`;

/// AppleScript som går igenom Safaris fönster och läser varje LinkedIn-flik
/// som är flödet eller din aktivitet. Flikar läses där de står; ingen tas fram.
///
/// `skiljare` är ett slumpat värde per läsning som sidan aldrig ser. Utan
/// det kunde en sida svara med en egen avgränsare och en påhittad
/// "LinkedIn-flik" efter den (säkerhetsgranskningen 2026-10-06).
export function applescript(skiljare) {
  if (!/^[a-f0-9]{16,}$/.test(String(skiljare || ''))) throw new Error(tx('flode.skiljaren'));
  const js = SIDSKRIPT.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ');
  // Är Safari inte igång startas den inte: då finns inget flöde att läsa.
  return `set ut to ""
if application "Safari" is not running then return ""
tell application "Safari"
  repeat with w in windows
    repeat with t in tabs of w
      set u to URL of t
      if u is not missing value and (u starts with "https://www.linkedin.com/" or u starts with "https://linkedin.com/") and (u contains "/feed" or u contains "/recent-activity") then
        set ut to ut & "${skiljare}" & linefeed & u & linefeed & (do JavaScript "${js}" in t) & linefeed
      end if
    end repeat
  end repeat
end tell
return ut`;
}

/// Utdata från skriptet → poster för agenten. En post per inlägg; en flik
/// utan igenkända inlägg blir block ur sidans text (högst tolv).
/// Är inlägget ditt? Namnet jämförs utan skiftläge och accenter, och med
/// för- och efternamn i rätt ordning (LinkedIn skriver "Henrik Lindgren",
/// ibland med en titel efter).
const norm = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
export const arMitt = (av, namn = []) => {
  const a = norm(av);
  return Boolean(a) && namn.map(norm).filter(n => n.split(' ').length >= 2).some(n => a === n || a.startsWith(`${n} `) || a.startsWith(`${n},`));
};

export function poster(ut, { nu = new Date(), skiljare, jag = [] } = {}) {
  if (!skiljare) return [];
  const tid = new Date(nu).toISOString();
  const alla = [];
  for (const del of String(ut || '').split(skiljare).slice(1)) {
    // Första raden är adressen som SAFARI uppger för fliken; resten är vad
    // sidan svarade. Sidans eget svar är främmande data — den kan skriva om
    // JSON och RegExp och påstå vilken adress som helst — så adressen tas
    // aldrig ur det.
    const [adress, ...rest] = del.trim().split('\n');
    let d;
    try { d = JSON.parse(rest.join('\n').trim()); } catch { continue; }
    if (!d || typeof d !== 'object' || !arFlode(adress)) continue;
    d.url = adress.trim();
    const egen = /recent-activity/i.test(d.url);
    const kalla = egen ? (/reactions/i.test(d.url) ? tx('flode.reagerat') : /comments/i.test(d.url) ? tx('flode.kommenterat') : tx('flode.aktivitet')) : tx('flode.flode');
    // Dina egna inlägg är inga fynd om dig: flödet ska visa det som når DIG.
    // Namnet ur sidan (LinkedIns meny) och ur profilen.
    const namn = [...jag, ...(typeof d.jag === 'string' ? [d.jag] : [])];
    for (const p of (Array.isArray(d.poster) ? d.poster : []).filter(x => x && typeof x.text === 'string' && !arMitt(x.av, namn)).slice(0, 40)) {
      const forst = String(p.text).split('\n').find(r => r.trim()) || '';
      alla.push({ id: `linkedin:${p.id}`, titel: `${p.av ? `${p.av}: ` : ''}${forst}`.slice(0, 120), fran: [p.av, p.om].filter(Boolean).join(' — ') || 'LinkedIn',
        tid, url: d.url, text: [tx('flode.rad', { kalla }), p.varfor, String(p.text)].filter(Boolean).join('\n').slice(0, 1800) });
    }
    if (!(Array.isArray(d.poster) && d.poster.length) && typeof d.text === 'string' && d.text) {
      const block = String(d.text).split(/\n{2,}/).map(b => b.trim()).filter(b => b.length > 80).slice(0, 12);
      block.forEach((b, i) => alla.push({ id: `linkedin:${d.url}#${hash(b)}`, titel: b.split('\n')[0].slice(0, 120), fran: 'LinkedIn', tid, url: d.url,
        text: `${tx('flode.block', { kalla, n: i + 1 })}\n${b}`.slice(0, 1800) }));
    }
  }
  // Samma inlägg i två flikar räknas en gång.
  return alla.filter((p, i) => alla.findIndex(x => x.id === p.id) === i);
}

const hash = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.codePointAt(0)) | 0; return (h >>> 0).toString(36); };

/// Påminnelsen om exporten: en gång i månaden, så att inläggen och
/// reaktionerna följer med. `du` är du.json; `senast` när det påmindes.
export const EXPORTDAGAR = 30;
export function paminnaOmExport(du, { senast = null, nu = new Date() } = {}) {
  if (!du?.inlast) return false;
  const dag = 864e5;
  const t = new Date(nu).getTime();
  if (t - Date.parse(du.inlast) < EXPORTDAGAR * dag) return false;
  if (senast && t - Date.parse(senast) < EXPORTDAGAR * dag) return false;
  return true;
}
