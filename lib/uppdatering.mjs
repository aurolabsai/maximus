
import { natfel } from './natfel.mjs';
import { tx } from './sprakstod.mjs';

export function jamfor(a, b) {
  const dela = v => {
    const [tal, fore = ''] = String(v || '').replace(/^v/i, '').split('-');
    return { tal: tal.split('.').map(n => Number(n) || 0), fore };
  };
  const x = dela(a), y = dela(b);
  for (let i = 0; i < 3; i++) {
    const d = (x.tal[i] || 0) - (y.tal[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  if (x.fore === y.fore) return 0;
  if (!x.fore) return 1;
  if (!y.fore) return -1;
  return x.fore > y.fore ? 1 : -1;
}

export function plattform(process_ = process) {
  const os = { darwin: 'darwin', win32: 'windows', linux: 'linux' }[process_.platform] || process_.platform;
  const arch = { arm64: 'aarch64', x64: 'x86_64' }[process_.arch] || process_.arch;
  return `${os}-${arch}`;
}

export const nyttolast = (version, plats) =>
  tx('uppdatering.nyttolast', { version, plats });

export async function kolla(adress, { version, plats = plattform(), hamtaJson, signal } = {}) {
  if (!adress) return { av: true };
  const t0 = Date.now();
  const hamta = hamtaJson || (async url => {
    const r = await fetch(url, { signal, headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(tx('uppdatering.svarade', { status: r.status }));
    return r.json();
  });

  let m;
  try {
    m = await hamta(adress);
  } catch (e) {
    return { fel: natfel(e, tx('uppdatering.servern')), ms: Date.now() - t0, skickat: nyttolast(version, plats) };
  }

  const senaste = String(m?.version || '');
  const nyare = Boolean(senaste) && jamfor(senaste, version) > 0;
  return {
    ms: Date.now() - t0,
    skickat: nyttolast(version, plats),
    senaste: senaste || null,
    nyare,
    om: String(m?.notes || '').slice(0, 8000) || null,
    tid: m?.pub_date || null,
    url: m?.platforms?.[plats]?.url || null,
    signerad: Boolean(m?.platforms?.[plats]?.signature),
  };
}
