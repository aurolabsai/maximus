/// Apple Mail, läst och aldrig skrivet.
///
/// Det här är det tyngsta MAXIMUS gör mot löftet. Ett mejl bär mer persondata än
/// allt annat i appen: avsändare, mottagare, personnummer i bifogade underlag,
/// hela trådar med människor som aldrig bett om att hamna i en AI.
///
/// Därför tre regler, och de är inte förhandlingsbara:
///
///   1. LÄSER. Aldrig skickar, aldrig raderar, aldrig ändrar, aldrig
///      markerar som läst. AppleScript kan allt det; MAXIMUS använder ingenting
///      av det. Den som granskar filen ska kunna se att verben inte finns här.
///   2. Ingenting lämnar datorn vid hämtning. Listan byggs lokalt och stannar
///      lokalt. Ett mejl går vidare först när någon valt det, och då genom
///      samma grind som allt annat.
///   3. Brödtexten hämtas först när någon öppnar brevet. En inkorg som läser
///      in tusen brödtexter har läst tusen brev ingen bett om.
///
/// ── Varför AppleScript och inte IMAP ──────────────────────────────────────
///
/// För att kontot redan är inloggat i Mail. Ett IMAP-bygge hade krävt
/// lösenord eller OAuth, alltså en hemlighet till på datorn och en inloggning
/// till att förvalta — och MAXIMUS:s hela hållning är att inte be om nycklar.
/// Mail har uppgifterna; MAXIMUS frågar Mail.
///
/// macOS frågar om tillstånd första gången. Säger användaren nej finns ingen
/// inkorg, och det är ett fullgott svar.

import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { AR_MAC } from './plattform.mjs';
import { tx } from './sprakstod.mjs';

/// Skiljetecken, nya för varje läsning (granskningen 2026-10-09).
///
/// Här stod de fasta tecknen U+001F och U+001E. Ett ämne, ett
/// avsändarnamn eller en text som bar dem kunde lägga till fält och hela
/// rader: en påhittad avsändare, ett påhittat brev bland de riktiga.
/// lib/flode.mjs fick samma rättelse 2026-10-06. Ett slumpat värde per anrop
/// kan ingen som skriver texten känna till, och en rad med fel antal fält
/// kastas hellre än gissas.
const skiljare = () => {
  const h = randomBytes(8).toString('hex');
  return { F: `~F${h}~`, R: `~R${h}~` };
};

const kor = (skript, { timeout = 30000 } = {}) => new Promise((klar, fel) => {
  execFile('/usr/bin/osascript', ['-'], { timeout, maxBuffer: 64e6 }, (e, ut, felut) => {
    if (e) {
      const t = String(felut || e.message);
      // -1743 är macOS tillståndsdialog som fått nej.
      if (/-1743|not authorized|inte auktoriserad/i.test(t)) {
        return fel(Object.assign(new Error(tx('pars.post.ingetLov')), { tillstand: true }));
      }
      if (/-600|inte igång|isn.t running/i.test(t)) {
        return fel(new Error(tx('pars.post.inteIgang')));
      }
      // Dödad av tidsgränsen: inget på stderr, och e.message är bara
      // kommandoraden ("Command failed: /usr/bin/osascript -"), som inte
      // säger någon något. Oftast väntar Mail på en tillståndsfråga eller
      // är upptagen med en stor inkorg.
      if (e.killed || e.signal) return fel(new Error(tx('pars.post.tidsgrans', { s: Math.round(timeout / 1000) })));
      const rad = t.split('\n').map(x => x.trim()).find(x => x && !/^Command failed:/.test(x));
      return fel(new Error(rad?.slice(0, 200) || tx('pars.post.svaradeInte')));
    }
    klar(String(ut));
  }).stdin.end(skript);
});

export const finns = () => AR_MAC;

/// Kontona i Mail, med sina lådor.
export async function konton() {
  if (!AR_MAC) return [];
  const { F, R } = skiljare();
  const ut = await kor(`
tell application "Mail"
	set out to ""
	repeat with a in accounts
		set ladar to ""
		repeat with mb in mailboxes of a
			set ladar to ladar & (name of mb) & "${F}"
		end repeat
		set out to out & (name of a) & "${F}" & (user name of a) & "${F}" & ladar & "${R}"
	end repeat
	return out
end tell`);
  return ut.split(R).map(r => r.trim()).filter(Boolean).map(r => {
    const d = r.split(F).map(x => x.trim()).filter(Boolean);
    return { namn: d[0], adress: d[1] || null, lador: d.slice(2) };
  });
}

/// Rubrikerna i en låda. Aldrig brödtexten.
///
/// `antal` är ett tak, inte ett mål. En inkorg med tiotusen brev ska inte
/// läsas in för att någon öppnade ett rum.
export async function brev(konto, { lada = 'INBOX', antal = 40, utskick = false } = {}) {
  if (!AR_MAC) return [];
  const n = Math.max(1, Math.min(200, Number(antal) || 40));
  const { F, R } = skiljare();
  const ut = await kor(`
tell application "Mail"
	set acc to first account whose name is ${cit(konto)}
	set mb to first mailbox of acc whose name is ${cit(lada)}
	set tot to (count of messages of mb)
	set lim to ${n}
	if tot < lim then set lim to tot
	set out to ""
	repeat with i from 1 to lim
		set m to message i of mb
		try
			set adr to (sender of m)
		on error
			set adr to ""
		end try
		set ut to ""${utskick ? `
		try
			if (count of (headers of m whose name is "List-Unsubscribe")) > 0 then set ut to "1"
		end try` : ''}
		set out to out & (message id of m) & "${F}" & (subject of m) & "${F}" & adr & "${F}" & ((date received of m) as «class isot» as string) & "${F}" & (read status of m) & "${F}" & ut & "${R}"
	end repeat
	return out
end tell`, { timeout: 60000 });

  return ut.split(R).map(r => r.trim()).filter(Boolean).map(r => r.split(F)).filter(d => d.length === 6).map(d => {
    const [id, amne, fran, datum, last, ut] = d;
    return {
      id, amne: (amne || tx('pars.post.utanAmne')).trim(),
      fran: (fran || '').trim(),
      namn: namnUr(fran), adress: adressUr(fran),
      tid: datum ? datum.trim() : null,
      last: String(last).trim() === 'true',
      // Ett utskick (2026-10-09): brevet har List-Unsubscribe, som varje
      // nyhetsbrev och massutskick bär. Läses bara när någon frågar.
      utskick: String(ut || '').trim() === '1',
    };
  });
}

/// Brödtexten i ett brev. Hämtas först när någon öppnat det.
export async function text(konto, id, { lada = 'INBOX' } = {}) {
  if (!AR_MAC) return null;
  const { F, R } = skiljare();
  const ut = await kor(`
tell application "Mail"
	set acc to first account whose name is ${cit(konto)}
	set mb to first mailbox of acc whose name is ${cit(lada)}
	set m to first message of mb whose message id is ${cit(id)}
	set bil to ""
	repeat with a in mail attachments of m
		set bil to bil & (name of a) & "${F}"
	end repeat
	return (subject of m) & "${R}" & (sender of m) & "${R}" & ((date received of m) as «class isot» as string) & "${R}" & bil & "${R}" & (content of m)
end tell`, { timeout: 45000 });

  const delar = ut.split(R);
  if (delar.length < 5) throw new Error(tx('pars.post.olasbart'));
  const [amne, fran, datum, bilagor, ...rest] = delar;
  return {
    id,
    amne: (amne || '').trim(),
    fran: (fran || '').trim(),
    namn: namnUr(fran), adress: adressUr(fran),
    tid: (datum || '').trim() || null,
    bilagor: (bilagor || '').split(F).map(x => x.trim()).filter(Boolean),
    text: stada(rest.join(R)),
  };
}

/// Citerar en sträng åt AppleScript. Ett ämne med citattecken i ska inte
/// kunna bryta sig ut ur skriptet.
const cit = s => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

const namnUr = f => (/^\s*"?([^"<]+?)"?\s*</.exec(String(f || ''))?.[1] || '').trim() || null;
const adressUr = f => (/<([^>]+)>/.exec(String(f || ''))?.[1] || String(f || '')).trim() || null;

/// Städar brödtexten.
///
/// Mejl bär citerade trådar, signaturer och osynliga tecken. Det som ska bli
/// underlag för en fråga är det någon faktiskt skrev, inte fem lager av
/// "Den 12 september skrev X:".
export function stada(t) {
  return String(t || '')
    .replace(/\r\n/g, '\n')
    // Osynlig utfyllnad. Marknadsföringsmejl fyller förhandsvisningen med
    // combining grapheme joiner och nollbreddstecken; ett brev på 1 600
    // tecken kan vara 400 tecken text och 1 200 tecken ingenting.
    .replace(/[\u034f\u00ad\u200b-\u200f\u2028\u2029\u2060\ufeff]/g, '')
    .replace(/^[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/// Den citerade delen av ett mejl, avskild.
///
/// Svaret ligger överst och tråden under. Båda är användbara, men de är inte
/// samma sak: det nya är frågan, det gamla är sammanhanget.
export function delaTrad(t) {
  const rader = String(t || '').split('\n');
  const mönster = [
    /^\s*>/,
    /^\s*(Den|På)\s+.{4,40}\s+skrev\s+.+:/i,
    /^\s*On\s+.{4,60}\s+wrote:/i,
    /^\s*-{2,}\s*(Ursprungligt meddelande|Original Message|Vidarebefordrat|Forwarded message|Begin forwarded message)/i,
    /^\s*Begin forwarded message:/i,
    /^\s*(Från|From):\s*.+/i,
  ];
  const i = rader.findIndex(r => mönster.some(m => m.test(r)));
  if (i < 0) return { nytt: stada(t), citerat: '' };
  return { nytt: stada(rader.slice(0, i).join('\n')), citerat: stada(rader.slice(i).join('\n')) };
}
