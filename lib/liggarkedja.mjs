/// Hashkedjan i liggaren. A23.
///
/// ── Vad som saknades ─────────────────────────────────────────────────────
///
/// Liggaren rapporterar LUCKOR: dagar som inte gick att läsa står som luckor
/// i exporten, och en skadad fil läggs undan med sitt datum i stället för att
/// skrivas över (M4). Det räcker mot slarv och mot en halvskriven fil.
///
/// Det räcker inte mot en GILTIG ersättning. Den som har den upplåsta
/// huvudnyckeln kan skriva en ny, välformad dagsfil med färre rader i, och
/// ingenting i liggaren märker något: filen går att läsa, JSON:en stämmer,
/// raderna ser riktiga ut. Dagen som fanns är borta utan spår.
///
/// ── Vad kedjan gör ───────────────────────────────────────────────────────
///
/// Varje dagsfil bär föregående dags hash. Byts en dag ut stämmer inte längre
/// nästa dags `forra`, och `granska()` säger vilken dag som bröts.
///
/// Hashen tas när dagen är SLUT, inte medan den pågår. En dag som fortfarande
/// tar emot rader har ingen stabil hash — den ändras för varje sändning. När
/// första raden på en ny dag skrivs låses gårdagen: dess hash räknas då och
/// skrivs in i den nya dagens `forra`. Gårdagen är låst av imorgon.
///
/// Det betyder att den PÅGÅENDE dagen alltid är olåst. Det är inte en brist
/// utan en följd: en rad som skrivs nu kan inte ha förankrats i går.
///
/// ── Vad kedjan INTE gör, sagt rakt ut ────────────────────────────────────
///
/// Den som har huvudnyckeln kan räkna om hela kedjan. Byter hon ut en dag och
/// skriver nya `forra` i varje dag efter den stämmer allt igen. En lokalt
/// omskrivbar kedja kan inte hindra den som kan skriva lokalt.
///
/// Revisionen 2026-09-29 sa det: "För stark revisionshistorik behövs extern
/// förankring, inte bara en lokalt omskrivbar hashkedja."
///
/// Kedjan höjer ribban från "byt en fil" till "räkna om varje dag efter den",
/// och den fångar allt som INTE är ett medvetet angrepp: en återställd
/// säkerhetskopia av en enskild dag, en synkad mapp som skrev över en fil, en
/// halvkörd gallring.
///
/// Den riktiga förankringen är `huvud()` — kedjans sista hash. Den följer med
/// varje export och varje attest (lib/attest.mjs). Skrivs den ned utanför
/// datorn — i ett protokoll, i ett mejl till en revisor, på ett papper — är
/// den förankrad, och DÅ kan ingen räkna om kedjan utan att det syns.
///
/// ── Formatet ─────────────────────────────────────────────────────────────
///
/// Dagsfilen var en lista. Nu är den ett objekt:
///
///     { k: 1, forra: "<hash>", forraDag: "2026-09-29", rader: [...] }
///
/// Filer skrivna före kedjan är fortfarande listor, och de läses. De
/// rapporteras som `okedjade` — inte som brott. En fil från innan kedjan
/// fanns är inte manipulerad, den är bara äldre.

import { createHash } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tx } from './sprakstod.mjs';

export const KEDJEVERSION = 1;

/// Hashen av en dagsfil.
///
/// Tas på KLARTEXTEN som den står på disken, inte på ett omserialiserat
/// objekt. Krypteringen ger olika chiffertext varje gång samma text skrivs —
/// en hash på chiffertexten hade brutits av en omkryptering som inte ändrat
/// något. Klartexten är det som faktiskt är innehållet.
export const hasha = text => createHash('sha256').update(String(text), 'utf8').digest('hex');

/// Filnamnen i liggarkatalogen, i datumordning.
export async function dagfiler(dataDir) {
  return (await readdir(join(dataDir, 'liggare')).catch(() => []))
    .filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort();
}

/// Innehållet i en dagsfil, oavsett format.
///
/// Returnerar `{ rader, forra, forraDag, kedjad, text }`. `text` är
/// klartexten, för den som ska hasha den.
export async function lasDag(maximus, dataDir, fil) {
  const text = await maximus.lasFil(join(dataDir, 'liggare', fil));
  const d = JSON.parse(text);
  if (Array.isArray(d)) return { rader: d, forra: null, forraDag: null, kedjad: false, text };
  if (!Array.isArray(d?.rader)) throw new Error(tx('lib.liggare.fel.tomDag'));
  return { rader: d.rader, forra: d.forra ?? null, forraDag: d.forraDag ?? null, kedjad: true, text };
}

/// Raderna ur vad som helst. Används av las() i lib/liggare.mjs.
export const raderUr = d => (Array.isArray(d) ? d : Array.isArray(d?.rader) ? d.rader : null);

/// Är det här redan en kedjad dagsfil?
export const arKedjad = d => !Array.isArray(d) && Array.isArray(d?.rader);

/// Länken till gårdagen, räknad när en ny dag börjar.
///
/// Letar bakåt efter den senaste dagsfilen FÖRE `dag`. Är det glest — ingen
/// sändning på tre dagar — pekar länken på den dag som faktiskt finns, och
/// `forraDag` säger vilken. En lucka i kalendern är inte en lucka i kedjan.
export async function lankaTill(maximus, dataDir, dag) {
  const filer = (await dagfiler(dataDir)).filter(f => f.slice(0, 10) < dag);
  const forra = filer.at(-1);
  if (!forra) return { forra: null, forraDag: null };
  try {
    const { text } = await lasDag(maximus, dataDir, forra);
    return { forra: hasha(text), forraDag: forra.slice(0, 10) };
  } catch {
    // Går gårdagen inte att läsa kan den inte hashas. Kedjan får en uttrycklig
    // lucka i stället för en påhittad länk — `granska()` rapporterar den.
    return { forra: null, forraDag: forra.slice(0, 10), trasig: true };
  }
}

/// Går kedjan ihop?
///
/// Svarar med vad som faktiskt står, inte med ett ja eller nej. En granskare
/// ska kunna läsa VILKEN dag som bröts och varför, inte få veta att "något är
/// fel".
export async function granska(maximus, dataDir, { gallrade = [] } = {}) {
  const filer = await dagfiler(dataDir);

  // De undanlagda. En dagsfil som inte gick att läsa döps om till
  // `<dag>.json.skadad-<tid>` av maximus.andraFil innan en ny börjar (M4).
  //
  // Efter omdöpningen heter den inte längre `2026-09-29.json`, och alltså ser
  // varken las() eller kedjan den. Dagen försvann ur båda — vilket är precis
  // den tystnad M4 handlade om, flyttad ett steg.
  //
  // De listas här. Beviset finns kvar på disken och ska stå i granskningen.
  const undanlagda = (await readdir(join(dataDir, 'liggare')).catch(() => []))
    .filter(f => /^\d{4}-\d{2}-\d{2}\.json\.skadad-/.test(f))
    .map(f => ({ dag: f.slice(0, 10), fil: f }))
    .sort((a, b) => a.fil.localeCompare(b.fil));
  const gallradeDagar = new Set(gallrade.map(g => String(g).slice(0, 10)));
  const dagar = [];
  const brott = [];
  const okedjade = [];
  const olasliga = [];

  // Hasharna räknas en gång och återanvänds — en dag med tiotusen rader ska
  // inte läsas två gånger för att nästa dag pekar på den.
  const hash = new Map();
  for (const f of filer) {
    try {
      const d = await lasDag(maximus, dataDir, f);
      hash.set(f.slice(0, 10), hasha(d.text));
      dagar.push({ dag: f.slice(0, 10), ...d, rader: d.rader.length });
    } catch (e) {
      olasliga.push({ dag: f.slice(0, 10), varfor: e.message.slice(0, 120) });
    }
  }

  for (const [i, d] of dagar.entries()) {
    if (!d.kedjad) { okedjade.push(d.dag); continue; }
    // Den äldsta kedjade dagen får sakna länk. Kedjan börjar någonstans.
    const foregaende = dagar.slice(0, i).at(-1);
    if (!d.forraDag) {
      if (foregaende && foregaende.kedjad) {
        brott.push({ dag: d.dag, sort: 'saknad-lank',
          varfor: tx('lib.liggarkedja.saknadLank', { dag: foregaende.dag }) });
      }
      continue;
    }
    const vantad = hash.get(d.forraDag);
    if (vantad === undefined) {
      // Filen den pekar på finns inte. Gallring är ett lagligt beslut och inte
      // ett brott — men den som inte gallrats saknas.
      if (!gallradeDagar.has(d.forraDag)) {
        brott.push({ dag: d.dag, sort: 'borta',
          varfor: tx('lib.liggarkedja.borta', { dag: d.forraDag }) });
      }
      continue;
    }
    if (vantad !== d.forra) {
      brott.push({ dag: d.dag, sort: 'andrad', pekarPa: d.forraDag,
        varfor: tx('lib.liggarkedja.andrad', { forra: d.forraDag, dag: d.dag }) });
    }
  }

  const sista = dagar.at(-1);
  return {
    dagar: dagar.map(d => ({ dag: d.dag, rader: d.rader, kedjad: d.kedjad })),
    brott, okedjade, olasliga, undanlagda,
    huvud: sista ? hash.get(sista.dag) : null,
    huvudDag: sista?.dag || null,
    // "Hel" betyder att ingenting oförklarat hittades. En undanlagd fil är
    // förklarad — den ligger kvar och syns — men den är inte läsbar, och en
    // liggare med en oläsbar dag i ska inte kallas hel.
    hel: brott.length === 0 && olasliga.length === 0 && undanlagda.length === 0,
  };
}

/// Kedjans sista hash — det som ska skrivas ned utanför datorn.
export async function huvud(maximus, dataDir) {
  const filer = await dagfiler(dataDir);
  const sista = filer.at(-1);
  if (!sista) return null;
  try { return hasha((await lasDag(maximus, dataDir, sista)).text); }
  catch { return null; }
}
