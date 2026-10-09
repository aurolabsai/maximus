/// Tillstånden: vad Maximus får läsa, frågat ett i taget, i chatten.
///
/// I VALV stod de som sju växlar på en inställningsflik — där ingen letar
/// förrän något inte fungerar. Här frågar assistenten när det behövs, och
/// varje svar är ett BESLUT med sitt skäl utskrivet: vad ja betyder, vad
/// Maximus aldrig gör. Samma text i frågan, i svaret och i loggen, ur en
/// källa — en andra lista i klienten vore en andra lista att hålla i takt
///.
///
/// Läs, aldrig skriv står i varje rad, inte i en fotnot.

import { tx } from './sprakstod.mjs';

// Texterna slås upp när de läses (getters), på det språk som gäller.
export const TILLSTAND = [
  {
    id: 'epost',
    get namn() { return tx('lib.tillstand.epost.namn'); },
    get vad() { return tx('lib.tillstand.epost.vad'); },
    // Sedan Fas 31 läser agenten texten i de brev en fråga eller ett uppdrag
    // behöver. "Läser aldrig brödtexten" stod kvar och var inte sant längre
    // (sett i genomgången med Auro 2026-10-05).
    get fraga() { return tx('lib.tillstand.epost.fraga'); },
    behover: 'konto',
    ja: d => tx('lib.tillstand.epost.ja', { lada: d.lada === 'INBOX' ? tx('lib.tillstand.epost.inkorgen') : d.lada, konto: d.konto }),
    get nej() { return tx('lib.tillstand.epost.nej'); },
  },
  {
    id: 'kalender',
    get namn() { return tx('lib.tillstand.kalender.namn'); },
    get vad() { return tx('lib.tillstand.kalender.vad'); },
    get fraga() { return tx('lib.tillstand.kalender.fraga'); },
    behover: null,
    ja: () => tx('lib.tillstand.kalender.ja'),
    get nej() { return tx('lib.tillstand.kalender.nej'); },
  },
  {
    id: 'anteckningar',
    get namn() { return tx('lib.tillstand.anteckningar.namn'); },
    get vad() { return tx('lib.tillstand.anteckningar.vad'); },
    get fraga() { return tx('lib.tillstand.anteckningar.fraga'); },
    behover: 'mapp',
    ja: d => tx('lib.tillstand.anteckningar.ja', { mapp: `${d.mapp}${d.konto ? ` (${d.konto})` : ''}` }),
    get nej() { return tx('lib.tillstand.anteckningar.nej'); },
  },
  // Meddelanden, samtalslistan och mappar (2026-10-04). De två första
  // ligger bakom macOS "Full skivåtkomst" — `behover: 'fda'` får appen att
  // pröva läsningen och, om den nekas, öppna rätt ruta i Systeminställningar.
  {
    id: 'meddelanden',
    // Frågas i första sessionen sedan 2026-10-06 (Auro: "kan vi nyttja
    // imessage som är kopplat till datorn?"), och får en helig session i
    // Grunden som de andra apparna.
    get namn() { return tx('lib.tillstand.meddelanden.namn'); },
    get vad() { return tx('lib.tillstand.meddelanden.vad'); },
    get fraga() { return tx('lib.tillstand.meddelanden.fraga'); },
    behover: 'fda',
    ja: () => tx('lib.tillstand.meddelanden.ja'),
    get nej() { return tx('lib.tillstand.meddelanden.nej'); },
  },
  // Påminnelser (2026-10-05). macOS frågar själv första gången den läses;
  // sägs nej där öppnar appen rätt ruta (`behover: 'lov'`).
  {
    id: 'paminnelser',
    // Frågas i första sessionen (2026-10-05): en av agentens kärnkällor.
    get namn() { return tx('lib.tillstand.paminnelser.namn'); },
    get vad() { return tx('lib.tillstand.paminnelser.vad'); },
    get fraga() { return tx('lib.tillstand.paminnelser.fraga'); },
    behover: 'lov',
    ja: () => tx('lib.tillstand.paminnelser.ja'),
    get nej() { return tx('lib.tillstand.paminnelser.nej'); },
  },
  {
    id: 'samtal',
    // Frågas inte i första sessionen — bara när någon väljer källan.
    forsta: false,
    get namn() { return tx('lib.tillstand.samtal.namn'); },
    get vad() { return tx('lib.tillstand.samtal.vad'); },
    get fraga() { return tx('lib.tillstand.samtal.fraga'); },
    behover: 'fda',
    ja: () => tx('lib.tillstand.samtal.ja'),
    get nej() { return tx('lib.tillstand.samtal.nej'); },
  },
  {
    id: 'mapp',
    // Frågas inte i första sessionen — bara när någon väljer källan.
    forsta: false,
    get namn() { return tx('lib.tillstand.mapp.namn'); },
    get vad() { return tx('lib.tillstand.mapp.vad'); },
    get fraga() { return tx('lib.tillstand.mapp.fraga'); },
    behover: 'sokvag',
    ja: d => tx('lib.tillstand.mapp.ja', { mapp: d.namn || d.sokvag }),
    get nej() { return tx('lib.tillstand.mapp.nej'); },
  },
  {
    id: 'telefon',
    get namn() { return tx('lib.tillstand.telefon.namn'); },
    get vad() { return tx('lib.tillstand.telefon.vad'); },
    // Utan eget konto för Maximus (2026-10-06): en påminnelse i listan
    // "Maximus" med larm, som iCloud för till telefonen. iMessage från ditt
    // eget konto går att välja under Agenten. Se lib/telefon.mjs.
    // Sagt så att det går att förstå (Auro 2026-10-06: "hur säger maximus
    // till 'på telefonen' förstår jag inte?").
    get fraga() { return tx('lib.tillstand.telefon.fraga'); },
    behover: 'telefon',
    ja: () => tx('lib.tillstand.telefon.ja'),
    get nej() { return tx('lib.tillstand.telefon.nej'); },
  },
];

export const tillstand = id => TILLSTAND.find(t => t.id === id) || null;

/// Agentens inställning efter ett beslut. Hela objektet ut — `agentUr` på
/// servern ersätter, den slår inte ihop, och ett halvt objekt hade tyst
/// stängt av allt annat.
export function agentEfter(agent, id, svar, d = {}) {
  const a = { ...(agent || {}) };
  if (id === 'epost') {
    if (svar === 'ja') a.epost = { konto: d.konto, lada: d.lada || 'INBOX' };
    else delete a.epost;
  }
  if (id === 'kalender') {
    if (svar === 'ja') a.kalender = { kalendrar: [] };
    else delete a.kalender;
  }
  if (id === 'anteckningar') {
    if (svar === 'ja') a.anteckningar = { konto: d.konto || '', mapp: d.mapp, skriv: false };
    else delete a.anteckningar;
  }
  if (id === 'meddelanden') { if (svar === 'ja') a.meddelanden = true; else delete a.meddelanden; }
  if (id === 'paminnelser') { if (svar === 'ja') a.paminnelser = true; else delete a.paminnelser; }
  if (id === 'samtal') { if (svar === 'ja') a.samtal = true; else delete a.samtal; }
  if (id === 'telefon') { if (svar === 'ja') a.telefon = { kanal: 'paminnelse', till: a.telefon?.till || null }; else delete a.telefon; }
  // Flera mappar (Fas 35): varje ja lägger till en; den första är förvalet.
  if (id === 'mapp') {
    if (svar === 'ja') {
      a.mappar = [...(a.mappar || (a.mapp ? [a.mapp] : [])).filter(m => m.sokvag !== d.sokvag), { sokvag: d.sokvag, namn: d.namn || null }];
      a.mapp = a.mapp || { sokvag: d.sokvag };
    } else if (d.sokvag) {
      a.mappar = (a.mappar || []).filter(m => m.sokvag !== d.sokvag);
      if (a.mapp?.sokvag === d.sokvag) { if (a.mappar[0]) a.mapp = { sokvag: a.mappar[0].sokvag }; else delete a.mapp; }
    } else { delete a.mapp; delete a.mappar; }
  }
  return a;
}

/// Prövar ett beslut och skriver dess skäl. `{ ok, skal }` eller `{ ok:false, fel }`.
export function beslut(id, svar, d = {}) {
  const t = tillstand(id);
  if (!t) return { ok: false, fel: tx('lib.tillstand.fel.okant') };
  if (t.finns === false) return { ok: false, fel: t.inte };
  if (svar !== 'ja' && svar !== 'nej') return { ok: false, fel: tx('lib.tillstand.fel.jaNej') };
  if (svar === 'nej') return { ok: true, skal: t.nej };
  if (t.behover === 'konto' && !String(d.konto || '').trim()) return { ok: false, fel: tx('lib.tillstand.fel.konto') };
  if (t.behover === 'mapp' && !String(d.mapp || '').trim()) return { ok: false, fel: tx('lib.tillstand.fel.mapp') };
  if (t.behover === 'sokvag' && !String(d.sokvag || '').trim().startsWith('/')) return { ok: false, fel: tx('lib.tillstand.fel.mapp') };
  return { ok: true, skal: t.ja({ ...d, lada: d.lada || 'INBOX' }) };
}

/// Läget per tillstånd ur agentens inställning — det som faktiskt gäller,
/// inte det som senast loggades.
export function lage(agent = {}) {
  return TILLSTAND.map(t => ({
    id: t.id, namn: t.namn, vad: t.vad, fraga: t.fraga || null, behover: t.behover || null, forsta: t.forsta !== false,
    finns: t.finns !== false, inte: t.inte || null,
    pa: t.id === 'epost' ? Boolean(agent.epost?.konto)
      : t.id === 'kalender' ? Boolean(agent.kalender)
      : t.id === 'anteckningar' ? Boolean(agent.anteckningar?.mapp)
      : t.id === 'meddelanden' ? Boolean(agent.meddelanden)
      : t.id === 'paminnelser' ? Boolean(agent.paminnelser)
      : t.id === 'samtal' ? Boolean(agent.samtal)
      : t.id === 'telefon' ? Boolean(agent.telefon?.kanal)
      : t.id === 'mapp' ? Boolean(agent.mapp?.sokvag) : false,
  }));
}
