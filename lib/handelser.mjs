
export const MINSTA = { epost: 120, meddelanden: 600, samtal: 600, mapp: 300, kalender: 300,
  paminnelser: 300, anteckningar: 300, sida: 1800, amne: 1800, sok: 3600 };
export const SIGNALKALLOR = new Set(['meddelanden', 'samtal', 'mapp']);
export const GOLV = 30;

const nyckel = (u, k) => `${u.id}:${k.typ}`;
const signalNyckel = k => (k.typ === 'mapp' && k.sokvag ? `mapp:${k.sokvag}` : k.typ);

export function attKolla(uppdrag, { nu = Date.now(), senast = {}, signaler = {} } = {}) {
  const ut = [];
  for (const u of uppdrag || []) {
    if (!u?.handelse || u.tillstand === 'pausad' || u.tillstand === 'klar') continue;
    const dags = (u.kallor || []).some(k => {
      const sist = senast[nyckel(u, k)] || 0;
      const sedan = (nu - sist) / 1000;
      if (sedan < GOLV) return false;
      const sig = signaler[signalNyckel(k)];
      if (SIGNALKALLOR.has(k.typ) && sig && sig > sist) return true;
      return sedan >= (MINSTA[k.typ] ?? 600);
    });
    if (dags) ut.push(u.id);
  }
  return ut;
}

export function stampla(senast, u, nu = Date.now()) {
  const ny = { ...senast };
  for (const k of u.kallor || []) ny[nyckel(u, k)] = nu;
  return ny;
}
