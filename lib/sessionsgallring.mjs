/// Gallring av sessioner.
///
/// Liggaren kunde gallras; sessionerna kunde inte. De låg kvar för evigt, och
/// "för evigt" är inget beslut — det är frånvaron av ett.
///
/// ── Varför det inte är samma sak som liggarens gallring ──────────────────
///
/// Liggaren är en bokföring över vad som lämnat datorn. Sessionerna är
/// ARBETET: frågorna, svaren, dokumenten, allt någon skrivit. Att radera dem
/// är att radera det användaren gjort, och det går inte att ångra.
///
/// Därför tre saker som liggarens gallring inte har:
///
///   1. Förhandsgranskningen är obligatorisk i gränssnittet, inte frivillig.
///   2. Fästa sessioner undantas. Att fästa något betyder "behåll det", och
///      en regel som raderar det man uttryckligen sparat är en regel man
///      aldrig slår på.
///   3. Ett protokoll skrivs. En session som försvann utan spår ser ut som en
///      session som aldrig fanns.
///
/// ── Vad som INTE undantas, och varför ────────────────────────────────────
///
/// Låsta och förseglade sessioner gallras som alla andra. Det kan kännas
/// bakvänt — de är ju det mest skyddade — men gallringen är ett beslut om hur
/// länge material ska finnas, och ett beslut som inte gäller det känsligaste
/// materialet är ett hål i beslutet. En förseglad session vars kod är borta
/// hade dessutom legat kvar för alltid utan att någon kunde läsa den.
///
/// Gallringen behöver inte läsa något för att räkna åldern: datumet står i
/// registret, inte i det krypterade innehållet.
///
/// ── Protokollet bär inga titlar ──────────────────────────────────────────
///
/// En sessionstitel är innehåll — "Uppsägning av [namn]" säger vad ärendet
/// gällde. Protokollet bär därför id, datum och antal frågor, ingenting mer.
///
/// Den som behöver en fullständig förteckning över vad som förstördes ska
/// exportera innan hon gallrar. Det står i gränssnittet.

import { unlink } from 'node:fs/promises';
import { join } from 'node:path';

/// När rördes sessionen sist?
const rord = s => String(s.andrad || s.skapad || '');

/// Vilka sessioner en gallring på `dagar` skulle träffa.
///
/// `sessioner` är värdena ur serverns karta. `katalog` säger var filen ligger
/// för en given session — en session med en ägare bor i ägarens katalog.
export function traffade(sessioner, { dagar = 0, nu = Date.now() } = {}) {
  if (!dagar || dagar < 1) return [];
  const grans = new Date(nu - dagar * 86400000).toISOString();
  return [...sessioner].filter(s => {
    if (s.fast) return false;            // fäst betyder behåll
    const t = rord(s);
    return t && t < grans;
  });
}

/// Vad en gallring skulle göra, utan att göra det.
export function forhandsgranska(sessioner, { dagar = 0, nu = Date.now() } = {}) {
  const alla = [...sessioner];
  const traff = traffade(alla, { dagar, nu });
  const fasta = alla.filter(s => s.fast).length;
  const tider = traff.map(rord).filter(Boolean).sort();
  return {
    dagar,
    grans: dagar ? new Date(nu - dagar * 86400000).toISOString().slice(0, 10) : null,
    antal: traff.length,
    fragor: traff.reduce((n, s) => n + (s.turer?.length || 0), 0),
    // Fästa undantas, och det ska stå. En regel med ett undantag som ingen
    // nämner är en regel man tror gäller allt.
    undantagna: fasta,
    aldst: tider[0]?.slice(0, 10) || null,
    nyast: tider.at(-1)?.slice(0, 10) || null,
    // Kvar efteråt. "37 raderas" säger ingenting utan "12 blir kvar".
    kvar: alla.length - traff.length,
  };
}

/// Verkställer. Returnerar protokollet.
///
/// Filen först, kartan sedan — och kartan bara om filen försvann. En rad som
/// försvinner ur gränssnittet men ligger kvar på disken kommer tillbaka vid
/// nästa start, och då är gallringen en lögn. Samma fälla som städningen av
/// tomma sessioner gick i.
export async function gallra(sessioner, { dagar = 0, nu = Date.now(), katalog, glom } = {}) {
  const traff = traffade([...sessioner.values()], { dagar, nu });
  const bort = [];
  const misslyckade = [];

  for (const s of traff) {
    try {
      await unlink(join(katalog(s.agare), `${s.id}.json`));
    } catch (e) {
      if (e.code !== 'ENOENT') { misslyckade.push({ id: s.id, varfor: e.message.slice(0, 120) }); continue; }
    }
    sessioner.delete(s.id);
    glom?.(s.id);
    bort.push({ id: s.id, rord: rord(s).slice(0, 10), fragor: s.turer?.length || 0 });
  }

  return {
    tid: new Date(nu).toISOString(),
    dagar,
    grans: dagar ? new Date(nu - dagar * 86400000).toISOString().slice(0, 10) : null,
    antal: bort.length,
    fragor: bort.reduce((n, b) => n + b.fragor, 0),
    // Utan titlar, med avsikt. En titel är innehåll.
    sessioner: bort,
    misslyckade,
  };
}
