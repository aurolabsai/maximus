
export const KALLOR = {
  epost: a => Boolean(a.epost?.konto || (Array.isArray(a.epost?.konton) && a.epost.konton.some(k => String(k?.konto || '').trim()))),
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

export const VAR = { profil: 'du:profil', kalla: 'agent:kallor' };
