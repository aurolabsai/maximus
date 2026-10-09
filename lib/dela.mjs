/// En session som går att skicka någon annanstans.
///
/// Ett maximus kan inte läsa ett annat Maximus filer: huvudnyckeln sitter i den här
/// datorns nyckelring och härleds ur den här användarens lösenord. Det är
/// avsikten. Men två som arbetar med samma ärende måste kunna dela det, och
/// då duger varken en skärmdump eller ett mejl med hela samtalet i klartext.
///
/// En delningsfil bär därför sin egen nyckel, härledd ur en kod och ingenting
/// annat. Ingen huvudnyckel, inget konto, ingen server. Den som har filen och
/// koden kommer in; den som har bara filen kommer inte in.
///
/// Det ställer ett krav som inte gäller inne i Maximus: filen lämnar datorn och
/// kan gissas på i lugn och ro, hur länge som helst. En fyrsiffrig kod som
/// duger som grind i gränssnittet duger inte här. Därför föreslår MAXIMUS en kod
/// som är värd namnet, och vägrar de allra kortaste.

import { randomBytes, timingSafeEqual, randomUUID } from 'node:crypto';
import {
  forsegla, oppna, nyttSalt, nyckelUrLosenord, kontrollvarde,
} from './krypto.mjs';
import { tx } from './sprakstod.mjs';

/// Filformatet. Versionen står först så att en framtida MAXIMUS kan säga
/// "den här filen är nyare än jag" i stället för att krascha.
export const FORMAT = 1;
export const ANDELSE = '.maximus';

/// Alfabetet i föreslagna koder.
///
/// Utan 0, O, 1, I och l. En kod läses ofta upp i telefon eller skrivs av från
/// en skärm, och en nolla som blir ett O är en kod som inte fungerar utan att
/// någon förstår varför.
const TECKEN = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/// Fyra grupper om fyra. 16 tecken ur 31 möjliga är omkring 79 bitar — långt
/// bortom vad någon gissar sig till, och fortfarande möjligt att läsa upp.
export function foreslaKod() {
  const b = randomBytes(16);
  const t = [...b].map(v => TECKEN[v % TECKEN.length]).join('');
  return t.match(/.{4}/g).join('-');
}

/// Kortaste kod MAXIMUS accepterar på en fil som lämnar datorn.
///
/// Tolv tecken är inte en vetenskaplig gräns, det är en gräns. Den som vill ha
/// en egen kod får ha det, men inte "1234" på något som ligger i ett mejl.
export const MINSTA_KOD = 12;

export function granskaKod(kod) {
  const k = String(kod || '').trim();
  if (k.length < MINSTA_KOD)
    return { ok: false, varfor: tx('dela.kodKort', { minsta: MINSTA_KOD }) };
  return { ok: true };
}

/// Bevakningar att skicka någon annanstans.
///
/// En delad bevakning bär REGELN, aldrig ärendet. En bevakning på 6 kap. 7 §
/// arbetsmiljölagen säger vad någon följer; `rör` säger vilka ärenden den
/// hör till, och det är en uppgift om arbetet — den följer aldrig med.
///
/// Det är också vad som gör delningen användbar i en organisation: en person
/// sätter upp bevakningarna för ett område, resten får dem, och ingen får
/// veta vad de andra arbetar med.
export async function paketeraBevakningar(bevakningar, kod, { fran = null } = {}) {
  const rena = (bevakningar || []).map(b => ({
    sort: b.sort, uri: b.uri, lagrum: b.lagrum || null,
    etikett: b.etikett, namn: b.namn || null,
  }));
  return kuvertera({ sort: 'bevakning', kropp: { bevakningar: rena }, kod, fran });
}

/// Packa en session till en fil.
///
/// `fran` är valfritt och står i klartext: den som får en fil ska kunna se
/// varifrån den kommer innan hon skriver in en kod. Titeln ligger däremot
/// inuti kuvertet — en rubrik är också innehåll.
export async function paketera(session, kod, { fran = null } = {}) {
  const gransk = granskaKod(kod);
  if (!gransk.ok) throw new Error(gransk.varfor);

  const salt = nyttSalt();
  const nyckel = await nyckelUrLosenord(String(kod).trim(), salt);

  // Bara det som är samtalet. Lås, ägare och sessionens id hör till det maximus
  // den kom från, och ska inte följa med in i ett annat.
  const { las, agare, id, forseglad, ...rent } = session;
  const kropp = {
    ...rent,
    // Ett nytt id i mottagarens maximus. Samma id i två maximus gör en delning till
    // en krock första gången någon delar tillbaka.
    ursprung: id || null,
  };

  return kuvertera({ sort: 'session', kropp, kod, fran, salt, nyckel });
}

/// Kuvertet. Samma för allt som delas, oavsett vad som ligger i det.
async function kuvertera({ sort, kropp, kod, fran, salt = null, nyckel = null }) {
  if (!salt) {
    const g = granskaKod(kod);
    if (!g.ok) throw new Error(g.varfor);
    salt = nyttSalt();
    nyckel = await nyckelUrLosenord(String(kod).trim(), salt);
  }
  const skapad = new Date().toISOString();

  // Avsändaren och datumet står utanför OCH inuti.
  //
  // Utanför, för att den som fått en fil ska kunna se varifrån den kommer
  // innan hon skriver in en kod — det är en avsiktlig öppenhet.
  //
  // Men utanför betyder också oskyddat. Revisionen 2026-09-28 ändrade
  // avsändaren till "Förfalskad avsändare" och datumet till 1900-01-01, och
  // filen öppnades utan invändning med rätt kod. En uppgift som mottagaren
  // ska kunna lita på måste ligga under krypteringens äkthetsskydd.
  //
  // Kopian inuti är originalet. Skiljer de sig har någon varit i filen, och
  // då ska det sägas rakt ut i stället för att den öppnas som om inget hänt.
  const kropp_ = { ...kropp, _fran: fran ?? null, _skapad: skapad };

  return Buffer.from(JSON.stringify({
    maximus: FORMAT,
    sort,
    skapad,
    fran,
    salt: salt.toString('base64'),
    // Kontrollvärdet gör att fel kod kan sägas vara fel kod. Utan det är
    // skillnaden mellan fel kod och trasig fil bara ett obegripligt fel.
    kontroll: kontrollvarde(nyckel).toString('base64'),
    kuvert: forsegla(JSON.stringify(kropp_), nyckel).toString('base64'),
  }, null, 2), 'utf8');
}

/// Vad sorterna heter för den som läser.
export const SORTNAMN = {
  get session() { return tx('dela.sort.session'); },
  get bevakning() { return tx('dela.sort.bevakning'); },
};

/// Läs av en fil utan att öppna den.
///
/// Den som fått en fil ska kunna se vad det är och varifrån den kommer innan
/// hon skriver en kod. Ingenting av innehållet kommer ut här.
export function titta(buffert) {
  let h;
  try { h = JSON.parse(String(buffert)); }
  catch { throw new Error(tx('dela.ingenDelning')); }
  if (h.maximus !== FORMAT || !SORTNAMN[h.sort] || !h.kuvert || !h.salt)
    throw new Error(h.maximus > FORMAT
      ? tx('dela.nyareVersion')
      : tx('dela.ingenDelning'));
  return { format: h.maximus, sort: h.sort, skapad: h.skapad || null, fran: h.fran || null };
}

/// Öppna filen med koden.
export async function packaUpp(buffert, kod) {
  const h = JSON.parse(String(buffert));
  titta(buffert);
  const nyckel = await nyckelUrLosenord(String(kod || '').trim(), Buffer.from(h.salt, 'base64'));

  if (h.kontroll) {
    const vantat = Buffer.from(h.kontroll, 'base64');
    const fick = kontrollvarde(nyckel);
    if (vantat.length !== fick.length || !timingSafeEqual(vantat, fick))
      throw new Error(tx('dela.felKod'));
  }

  let inre;
  try { inre = JSON.parse(oppna(Buffer.from(h.kuvert, 'base64'), nyckel)); }
  catch { throw new Error(tx('dela.felKodSkadad')); }

  // Stämmer utsidan med insidan?
  //
  // Den som fått filen såg avsändaren och datumet innan hon skrev koden. Nu
  // när kuvertet är öppet går det att kontrollera att det hon såg var sant.
  // Skiljer de sig har någon varit i filen efter att den packades.
  const { _fran, _skapad, ...kropp } = inre;
  const fran = _fran ?? null;
  const skapad = _skapad ?? null;
  const utsidan = h.fran ?? null;
  if (_skapad !== undefined && (utsidan !== fran || (h.skapad || null) !== skapad)) {
    const e = new Error(tx('dela.andrad'));
    e.forfalskad = { visade: { fran: utsidan, skapad: h.skapad || null }, verkligt: { fran, skapad } };
    throw e;
  }

  // `session` står kvar för den som redan kallar på den. `innehall` och
  // `sort` är det nya: kuvertet bär inte bara samtal längre.
  //
  // Avsändaren och datumet kommer INIFRÅN nu — det är de som är äkta.
  return { sort: h.sort, innehall: kropp, session: kropp, fran, skapad };
}

/// Det som får följa med in när en delad session öppnas (2026-10-09,
/// granskningen, MSK-6).
///
/// Förut spreds avsändarens JSON rakt in i sessionen: `projekt` la samtalet
/// i mottagarens projekt (och dess text i varje syskonsessions underlag),
/// `minne` tog det med i "Dina tidigare samtal", `helig` kunde göra det till
/// mottagarens Du- eller nyhetssession, `behandling: 'original'` stängde av
/// maskeringen och `filer[].omaskerad` lät en bilaga gå ut utan mask.
/// Avsändaren skriver filen; den är främmande indata, inte tillstånd.
///
/// Därför en tillåtenlista: rubrik, turernas text och bilagornas text. Allt
/// annat får mottagarens förval: inget projekt, ingen helig sort, inget
/// minne, ingen djupdykning, ingen nyhet, inga agentsamtal och ingen egen
/// behandling. Kartan följer inte med: servern bygger en ny ur texten med
/// mottagarens egna regler, så att avsändaren inte bestämmer vad en
/// platshållare betyder här.
const TAK = 200_000;
const strang = (v, tak = TAK) => (typeof v === 'string' ? v.slice(0, tak) : '');
const tidpunkt = v => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null);

export function importerbar(inre) {
  const i = inre && typeof inre === 'object' ? inre : {};
  const nu = new Date().toISOString();
  const turer = (Array.isArray(i.turer) ? i.turer : []).slice(0, 2000)
    .filter(t => t && typeof t === 'object')
    .map(t => ({
      id: randomUUID(),
      tid: tidpunkt(t.tid) || nu,
      fraga: strang(t.fraga),
      svar: strang(t.svar),
      status: 'klar',
      // Maximus egna repliker ritas annorlunda; någon annan talare tas inte in.
      ...(t.av === 'maximus' ? { av: 'maximus', sager: strang(t.sager, 2000) } : {}),
      kallor: (Array.isArray(t.kallor) ? t.kallor : []).slice(0, 40)
        .filter(k => k && typeof k === 'object' && /^https?:\/\//.test(String(k.url || '')))
        .map(k => ({ titel: strang(k.titel, 300), url: strang(k.url, 2000) })),
      kvitto: [], anmarkningar: [],
    }));
  const filer = (Array.isArray(i.filer) ? i.filer : []).slice(0, 200)
    .filter(f => f && typeof f === 'object' && typeof f.original === 'string')
    .map(f => ({
      id: randomUUID(),
      namn: strang(f.namn, 300) || 'bilaga',
      sort: strang(f.sort, 40),
      tecken: Math.min(f.original.length, TAK),
      tid: tidpunkt(f.tid) || nu,
      original: strang(f.original),
    }));
  return {
    titel: strang(i.titel, 200) || 'Delat samtal',
    turer, filer,
    andrad: tidpunkt(i.andrad) || nu,
    karta: [], raknare: {},
  };
}
