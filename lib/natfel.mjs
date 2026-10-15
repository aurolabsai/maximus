import { tx } from './sprakstod.mjs';
export function natfel(e, vad = tx('natfel.servern')) {
  const m = String(e?.message || e);
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(m))
    return tx('natfel.hittadeInte', { vad });
  if (/ECONNREFUSED/i.test(m)) return tx('natfel.vagrade', { vad });
  if (/fetch failed|network|ECONNRESET|EPIPE/i.test(m))
    return tx('natfel.ingenKontakt', { vad });
  if (/abort|timeout|ETIMEDOUT/i.test(m)) return tx('natfel.inteITid', { vad });
  if (/certificate|SSL|TLS|DEPTH_ZERO|self.signed/i.test(m))
    return tx('natfel.certifikat', { vad });
  if (/JSON|Unexpected token|not valid/i.test(m))
    return tx('natfel.olasbart', { vad });
  return m.slice(0, 160);
}
