// Vad agenten minst behöver för att göra nytta (Auro 2026-10-10).
//
// Guiden går att hoppa över, steg för steg eller helt. Men en agent utan
// profil vet inte vad som angår dig, och en agent utan källa har ingenting
// att läsa: varje varv blir "Källan var avstängd" eller en gissning på det
// som LÅTER viktigt. Då arbetar den inte alls, och säger varför.
//
// En funktion, två platser som läser den: servern (grinden före varje
// varv, uppdrag och obevakad körning) och gränssnittet (tack-steget,
// Hem-kortet, Agenten och /agent). En andra kopia av regeln vore en andra
// regel att hålla i takt för hand.

/// Källorna agenten kan få läsa, som de står i `installningar.agent`.
/// Samma prov som lasKalla() i server.mjs gör innan den läser.
export const KALLOR = {
  epost: a => Boolean(a.epost?.konto),
  kalender: a => Boolean(a.kalender),
  paminnelser: a => Boolean(a.paminnelser),
  anteckningar: a => Boolean(a.anteckningar?.mapp),
  meddelanden: a => Boolean(a.meddelanden),
  samtal: a => Boolean(a.samtal),
  mapp: a => Boolean(a.mapp?.sokvag || a.mappar?.length),
  lopande: a => Boolean(a.lopande),
  nyheter: a => Boolean(a.nyheter),
  sidor: a => Boolean(a.sidor),
  bevakning: a => Boolean(a.bevakning),
};

const FALT = ['vem', 'arbetar', 'vill', 'intressen'];
const fyllt = x => Boolean(String(x || '').trim());

/// Vad agenten saknar. `saknar` är i den ordning det ska ordnas: först vem
/// du är, sedan något att läsa. `oanalyserad`: din egen text är sparad men
/// inte läst av modellen än — den räcker, men fälten är tomma.
export function agentBehover(installningar = {}) {
  const p = installningar?.profil || {};
  const a = installningar?.agent || {};
  const falt = FALT.some(k => fyllt(p[k]));
  const egen = fyllt(p.egen);
  const kallor = Object.keys(KALLOR).filter(k => KALLOR[k](a));
  const saknar = [];
  if (!falt && !egen) saknar.push('profil');
  if (!kallor.length) saknar.push('kalla');
  return { klar: saknar.length === 0, saknar, kallor, oanalyserad: egen && !falt };
}

/// Var varje sak ordnas: inställningsfliken och delen i den.
export const VAR = { profil: 'du:profil', kalla: 'agent:kallor' };
