/// Bevakning: det enda MAXIMUS kan som ingen annan kan.
///
/// Maskeringen är kopierbar. Chatten är en råvara. Men MAXIMUS vet vad varje
/// svar VILADE PÅ — vilken paragraf, vilken sida, vilken dag den hämtades —
/// och den kopplingen finns bara här. Alltså kan bara MAXIMUS säga:
///
///   "Paragrafen du byggde svaret på i mars har ändrats."
///   "Tre nya avgöranden hänvisar till 24 kap. 5 § sedan du frågade."
///
/// Det går inte att exportera till en konkurrent, och det blir bättre ju
/// längre appen använts. Det är definitionen av svår att vara utan.
///
/// ── Bevakningarna sätts inte upp, de härleds ──────────────────────────────
///
/// Ingen orkar konfigurera bevakningar. Men varje svar som vilade på ett
/// lagrum ÄR en bevakning som skriver sig själv — MAXIMUS vet redan uri:n, för
/// den citerade den. Egna fritextbevakningar finns också, för den som vill
/// följa något appen inte kan gissa.
///
/// ── Vad som lämnar datorn ─────────────────────────────────────────────────
///
/// Bara lagrummet eller sökorden. Aldrig frågan, aldrig ärendet, aldrig
/// sessionens innehåll. En bevakning på 6 kap. 7 § arbetsmiljölagen avslöjar
/// inte att någon klämt handen. Varje kontroll hamnar under Skickat.

import { createHash } from 'node:crypto';
import { tx } from './sprakstod.mjs';

const hash = t => createHash('sha256').update(String(t || '')).digest('hex').slice(0, 16);

/// Hur ofta en bevakning får fråga. Rättskällan ändras inte på en timme.
export const TATHET = { lagrum: 12 * 3600e3, fritext: 6 * 3600e3 };

/// Lagrummen ett svar vilade på.
///
/// Läses ur turens källor. En källa från lagen.nu bär sin uri i titeln eller
/// i adressen; det är den som ska bevakas, inte sökorden som ledde dit.
export function lagrumIEnTur(tur) {
  const ut = [];
  for (const k of tur?.kallor || []) {
    const text = `${k.titel || ''} ${k.url || ''} ${k.utdrag?.slice(0, 400) || ''}`;
    // En uri hos lagen.nu, med eller utan lagrum.
    for (const m of text.matchAll(/https:\/\/lagen\.nu\/(\d{4}:\d+)/g))
      ut.push({ uri: `https://lagen.nu/${m[1]}`, sfs: m[1] });
    // Eller ett lagrum som stod i argumenten: "1977:1160, K6P7".
    //
    // Formen skrivs ut, inte gissas. Första versionen hade [KP]\d+[A-Z]? och
    // det giriga [A-Z]? åt upp P:et i K6P7 — bevakningen blev "K6P", ett
    // kapitel utan paragraf.
    const lag = /(\d{4}:\d+)(?:[,\s]+(K\d+(?:P\d+[A-Za-z]?)?|P\d+[A-Za-z]?))?/.exec(k.titel || '');
    if (lag) ut.push({ uri: `https://lagen.nu/${lag[1]}`, sfs: lag[1], lagrum: lag[2] || null });
  }
  // Samma paragraf en gång. Och lagrummet vinner över hela lagen: den som
  // frågade om 6 kap. 7 § vill veta när DEN ändras, inte när någon annan
  // paragraf i samma lag gör det. Annars larmar arbetsmiljölagen varje gång
  // vilken paragraf som helst i den rörs.
  const karta = new Map();
  for (const l of ut) {
    const nyckel = `${l.sfs}#${l.lagrum || ''}`;
    if (!karta.has(nyckel)) karta.set(nyckel, l);
  }
  const medLagrum = new Set([...karta.values()].filter(l => l.lagrum).map(l => l.sfs));
  return [...karta.values()].filter(l => l.lagrum || !medLagrum.has(l.sfs));
}

/// Bevakningar som härleds ur en session.
export function harledUr(session) {
  const ut = [];
  for (const tur of session?.turer || []) {
    for (const l of lagrumIEnTur(tur)) {
      ut.push({
        sort: 'lagrum',
        uri: l.uri,
        lagrum: l.lagrum || null,
        etikett: l.lagrum ? tx('bevakning.etikett', { lagrum: lasbart(l.lagrum), sfs: l.sfs }) : l.sfs,
        session: session.id,
        sessionstitel: session.titel || null,
        fraga: String(tur.fraga || '').slice(0, 160),
        tid: tur.tid || session.andrad,
      });
    }
  }
  return ut;
}

/// K6P7 blir "6 kap. 7 §". Den som läser en bevakning ska känna igen sitt
/// eget lagrum, inte lagen.nu:s ankare.
/// Bokstaven skrivs gemen hos lagen.nu: ankaret för 3 kap. 3 a § är "K3P3a",
/// inte "K3P3A". Mönstret krävde versal och föll igenom — etiketten blev
/// "K3P3a Arbetsmiljölag", vilket ingen känner igen som sin egen paragraf.
export function lasbart(lagrum) {
  const m = /^K(\d+)(?:P(\d+)([A-Za-z])?)?$/.exec(String(lagrum || ''));
  if (m) return m[2] ? tx('bevakning.kapParagraf', { kap: m[1], p: `${m[2]}${m[3] ? ` ${m[3].toLowerCase()}` : ''}` }) : tx('bevakning.kap', { kap: m[1] });
  const p = /^P(\d+)([A-Za-z])?$/.exec(String(lagrum || ''));
  return p ? tx('bevakning.paragraf', { p: `${p[1]}${p[2] ? ` ${p[2].toLowerCase()}` : ''}` }) : String(lagrum || '');
}

/// Slår ihop härledda bevakningar med dem som redan finns.
///
/// Samma lagrum från fem sessioner är EN bevakning som rör fem ärenden.
/// Annars får den som frågat mycket om arbetsmiljölagen femton likadana rader.
export function sla(befintliga, harledda) {
  const karta = new Map(befintliga.map(b => [nyckelnFor(b), b]));
  for (const h of harledda) {
    const n = nyckelnFor(h);
    const b = karta.get(n);
    if (!b) {
      karta.set(n, { ...h, id: n, skapad: new Date().toISOString(), rör: [refAv(h)], traffar: [] });
      continue;
    }
    // Känd bevakning: lägg till ärendet den rör, om det är nytt.
    b.rör ||= [];
    if (!b.rör.some(r => r.session === h.session && r.fraga === h.fraga)) b.rör.push(refAv(h));
  }
  return [...karta.values()];
}

const nyckelnFor = b => (b.sort === 'lagrum'
  ? `lagrum:${b.uri}#${b.lagrum || ''}`
  : `fritext:${String(b.text || '').toLowerCase().trim()}`);

const refAv = h => ({ session: h.session, titel: h.sessionstitel, fraga: h.fraga, tid: h.tid });

/// Kontrollerar en bevakning på ett lagrum.
///
/// Två frågor: står det något annat i paragrafen nu, och har något nytt
/// hänvisat till den? Första gången sparas bara utgångsläget — en bevakning
/// kan inte slå till innan den vet vad den jämför med.
///
/// `anropa` skickas in så att den här filen inte drar in kopplingslagret i
/// varje test som råkar läsa den.
export async function kollaLagrum(b, { anropa, nu = () => Date.now() } = {}) {
  const argument = b.lagrum ? { uri: b.uri, lagrum: b.lagrum } : { uri: b.uri };
  const text = String(await anropa('lagen', 'lagen_hamta', argument));
  const nyHash = hash(text.replace(/\s+/g, ' ').trim());

  // Lagens namn står på första raden i det vi ändå hämtat. "1977:1160" säger
  // ingenting; "6 kap. 7 § arbetsmiljölagen" säger allt. Läses en gång och
  // sparas — namnet ändras inte.
  //
  // Hela titelraden, inte bara det före parentesen. "Lag (1994:260) om
  // offentlig anställning" klipptes till "Lag" av ett mönster som stannade
  // vid SFS-numret — och en lista med sex rader som heter Lag är ingen lista.
  const namn = (/^([^\n]+)/.exec(text)?.[1] || '')
    .split(' · ')[0]
    .replace(/\s*\(\d{4}:\d+\)\s*/, ' ')
    .replace(/\s+/g, ' ')
    .trim() || null;

  let antal = null;
  try {
    const h = String(await anropa('lagen', 'lagen_hanvisningar', { uri: b.uri }));
    antal = Number(/^(\d+)\s+hänvisningar/m.exec(h)?.[1] ?? NaN);
    if (!Number.isFinite(antal)) antal = null;
  } catch { /* hänvisningarna är en bonus, inte ett krav */ }

  const forr = b.senast;
  const senast = { tid: new Date(nu()).toISOString(), hash: nyHash, antal };

  if (!forr) return { senast, namn, traff: null, forst: true };

  const traffar = [];
  if (forr.hash !== nyHash) {
    traffar.push({ vad: 'andrad',
      text: tx('bevakning.andrad', { etikett: b.etikett }) });
  }
  // Räknaren gäller bara en paragraf, aldrig en hel lag.
  //
  // "312 nya avgöranden hänvisar till Jordabalk" är inte en nyhet — det är
  // bakgrundsstrålning. Jordabalken har fyrtiotusen hänvisningar och några
  // hundra till säger ingenting om ärendet. Samma siffra på 6 kap. 7 § i
  // arbetsmiljölagen säger något: någon har prövat just den regeln.
  //
  // Hela lagar bevakas fortfarande, men bara på att texten ändras. Det är
  // det enda som kan gälla ett ärende som vilar på lagen som helhet.
  if (b.lagrum && forr.antal != null && antal != null && antal > forr.antal) {
    const n = antal - forr.antal;
    traffar.push({ vad: 'hanvisning',
      text: tx('bevakning.hanvisning', { n, etikett: b.etikett }) });
  }
  return { senast, namn, traff: traffar.length ? { tid: senast.tid, rader: traffar } : null };
}

/// Vilka bevakningar som är mogna att kollas.
export function mogna(bevakningar, { nu = () => Date.now() } = {}) {
  return bevakningar.filter(b => {
    if (b.av) return false;
    const t = TATHET[b.sort] ?? TATHET.lagrum;
    const senast = Date.parse(b.senast?.tid || 0) || 0;
    return nu() - senast >= t;
  });
}

/// Morgonraden. En mening om läget, eller ingen alls.
///
/// En app som säger "inga nyheter" varje morgon lär användaren att inte
/// titta. Tystnad är också ett besked.
export function morgonrad(bevakningar) {
  const nya = bevakningar.flatMap(b => (b.traffar || []).filter(t => !t.last));
  if (!nya.length) return null;
  const arenden = new Set(bevakningar
    .filter(b => (b.traffar || []).some(t => !t.last))
    .flatMap(b => (b.rör || []).map(r => r.session)));
  const n = nya.reduce((a, t) => a + t.rader.length, 0);
  const ord = a => (a === 1 ? tx('bevakning.ett') : a === 2 ? tx('bevakning.tva') : String(a));
  return tx('bevakning.morgon', { n, antal: ord(n) })
    + (arenden.size ? tx('bevakning.morgonArenden', { antal: ord(arenden.size) }) : '.');
}
