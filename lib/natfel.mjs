/// Nätverksfel i ord någon kan göra något med.
///
/// `fetch failed` säger ingenting åt den som läser. Det namnger funktionen
/// som gav upp, inte vad som är fel — och den som ser det kan inte avgöra om
/// datorn är offline, om adressen är felstavad eller om servern är nere.
///
/// lib/lokal.mjs klagade redan på samma sak om "terminated". Den här filen
/// finns för att inte varje utgående väg ska behöva uppfinna sin egen
/// översättning: uppdateringskanalen hade en, SSO fick en till, och två
/// översättningar av samma fel blir två som glider isär.
///
/// `vad` är vad man försökte nå, med liten bokstav: "uppdateringsservern",
/// "katalogen". Det står i varje mening, för ett felmeddelande utan subjekt
/// tvingar läsaren att gissa vad som misslyckades.
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
