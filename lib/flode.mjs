
import { tx } from './sprakstod.mjs';
export const ADRESSER = [/^\/feed(\/|$)/i, /^\/in\/[^/]+\/recent-activity(\/|$)/i];
export const arLinkedin = host => /^(www\.)?linkedin\.com$/i.test(String(host || ''));
export function arFlode(url) {
  let u; try { u = new URL(String(url || '')); } catch { return false; }
  return u.protocol === 'https:' && arLinkedin(u.hostname) && ADRESSER.some(r => r.test(u.pathname));
}

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
  const jag = (document.querySelector('img.global-nav__me-photo, .global-nav__me img, .feed-identity-module img')?.getAttribute('alt') || '').trim().slice(0, 80);
  return JSON.stringify({ url: location.href, titel: document.title, jag, poster: ut.slice(0, 40),
    text: ut.length ? '' : (document.body.innerText || '').slice(0, 12000) });
})()`;

export function applescript(skiljare) {
  if (!/^[a-f0-9]{16,}$/.test(String(skiljare || ''))) throw new Error(tx('flode.skiljaren'));
  const js = SIDSKRIPT.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ');
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
    const [adress, ...rest] = del.trim().split('\n');
    let d;
    try { d = JSON.parse(rest.join('\n').trim()); } catch { continue; }
    if (!d || typeof d !== 'object' || !arFlode(adress)) continue;
    d.url = adress.trim();
    const egen = /recent-activity/i.test(d.url);
    const kalla = egen ? (/reactions/i.test(d.url) ? tx('flode.reagerat') : /comments/i.test(d.url) ? tx('flode.kommenterat') : tx('flode.aktivitet')) : tx('flode.flode');
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
  return alla.filter((p, i) => alla.findIndex(x => x.id === p.id) === i);
}

const hash = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.codePointAt(0)) | 0; return (h >>> 0).toString(36); };

export const EXPORTDAGAR = 30;
export function paminnaOmExport(du, { senast = null, nu = new Date() } = {}) {
  if (!du?.inlast) return false;
  const dag = 864e5;
  const t = new Date(nu).getTime();
  if (t - Date.parse(du.inlast) < EXPORTDAGAR * dag) return false;
  if (senast && t - Date.parse(senast) < EXPORTDAGAR * dag) return false;
  return true;
}
