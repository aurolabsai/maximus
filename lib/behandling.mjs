/// Vad som händer med texten. En fråga, inte två.
///
/// ── Varför destinationen är borta ────────────────────────────────────────
///
/// Det fanns en destination: Stannar här eller ChatGPT. MAXIMUS hade en egen
/// väg ut, med maskering före och återställning efter.
///
/// Den vägen är borttagen. Beslutet, 2026-09-29: MAXIMUS är grinden, inte röret.
///
/// Skälen står på rad. En utgång betyder en inloggning att hålla vid liv, en
/// leverantörs villkor att lita på, ett konto som kan gå ut mitt i ett
/// ärende, och en hel yta att försvara i varje revision — sex av de åtta höga
/// fynden 2026-09-29 rörde den vägen eller något som hängde på den. Och den
/// låste in användaren i den modell MAXIMUS råkat koppla in, i en tid då nya
/// modeller kommer snabbare än vi hinner koppla dem.
///
/// Det MAXIMUS gör bra är något annat: att ta text som rör människor och göra
/// den trygg att visa någon annan. Den masken är produkten. Vilken modell
/// man sedan klistrar in den i är användarens sak — och hennes val gäller
/// den dag en bättre kommer.
///
/// Kvar blir ett löfte utan undantag: ingenting lämnar datorn. Webbsök är
/// det enda som går ut, det är ett eget val, och varje sökfråga maskeras och
/// bokförs.
///
/// ── Ändrat 2026-10-06: molnmodellen (Fas 51) ─────────────────────────────
///
/// Auro, tillfrågad om vägen ut skulle öppnas igen: fritt val för alla. Den
/// är byggd som grinden, inte som röret — se lib/moln.mjs: allt maskeras
/// strängt före, återställs här efter, nyckeln i nyckelringen, varje anrop i
/// liggaren, och kvittot säger vart frågan gick. Löftet är nu: ingenting
/// OMASKERAT lämnar datorn, och med molnmodellen avstängd ingenting alls.
///
/// ── Behandlingen ─────────────────────────────────────────────────────────
///
/// Den svarar på vad texten ska bli. Den lokala modellen ser alltid
/// originalet — den kör här, och det är hela poängen med att den gör det.
/// Behandlingen styr vad MAXIMUS ger dig att TA MED DIG.

import { tx } from './sprakstod.mjs';
export const BEHANDLINGAR = {
  original: {
    get namn() { return tx('behandling.original.namn'); },
    get om() { return tx('behandling.original.om'); },
  },
  maskerad: {
    get namn() { return tx('behandling.maskerad.namn'); },
    get om() { return tx('behandling.maskerad.om'); },
  },
  anonym: {
    get namn() { return tx('behandling.anonym.namn'); },
    get om() { return tx('behandling.anonym.om'); },
  },
};

export const BEH_FORVAL = 'maskerad';

export const arBehandling = b => Object.hasOwn(BEHANDLINGAR, String(b));

/// En giltig behandling, vad som än kommer in.
export const stall = behandling => (arBehandling(behandling) ? String(behandling) : BEH_FORVAL);

/// Vad som faktiskt ska göras med texten.
///
/// Ett ställe som översätter valet till handling, så att resten av koden
/// slipper jämföra strängar.
export function vad(behandling) {
  const b = stall(behandling);
  return {
    behandling: b,
    // Kvar som `true` överallt: ingenting lämnar datorn längre.
    lokalt: true,
    maskera: b !== 'original',
    // Skrivs om av den lokala modellen efter maskeringen.
    anonymisera: b === 'anonym',
    // Modellen hjälper till att hitta det reglerna missar. Alltid när något
    // ska maskeras.
    tolka: b !== 'original',
  };
}

/// De gamla valen, översatta.
///
/// Sessioner sparade före den här ändringen bär `lage` eller `destination`.
/// De ska fortsätta fungera, och de ska landa på vad de betydde.
///
/// En session som stod på ChatGPT blir Maskerat: det var vad som skickades,
/// och nu är det vad du får att kopiera.
export function franGammalt({ lage, destination, behandling, utanMask = false } = {}) {
  if (arBehandling(behandling)) return behandling;
  if (destination === 'chatgpt') return 'maskerad';
  if (destination === 'har') return utanMask ? 'original' : 'maskerad';
  if (lage === 'lokalt') return utanMask ? 'original' : 'maskerad';
  if (lage === 'snabb' || lage === 'noggrann') return 'maskerad';
  return BEH_FORVAL;
}

/// Listan till gränssnittet.
export const listor = () => ({
  behandlingar: Object.entries(BEHANDLINGAR).map(([id, b]) => ({ id, namn: b.namn, om: b.om })),
});
