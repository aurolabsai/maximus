/// Var MAXIMUS hör hemma på nätet. Ett ställe.
///
/// Adresserna stod inbakade på sex ställen i fem filer, och de var inte ens
/// överens: uppdateringarna söktes på `aurolabs.ai/maximus` medan
/// webbhämtaren presenterade sig som `+https://maximus.se`.
///
/// Flera domäner för en produkt. Den dagen en av dem byter ägare eller går ut
/// är det inte en ändring på ett ställe utan en jakt.
///
/// Licensservern är borta (öppen källkod, 2026-10-09). Det enda appen själv
/// frågar efter är en ny version, och bara om du slagit på det.
///
/// ── Allt går att peka om ─────────────────────────────────────────────────
///
/// Varje adress läses ur miljön först. Det är inte bara för provkörning: en
/// organisation som kör Maximus bakom sin egen brandvägg ska kunna peka
/// uppdateringskanalen på något de själva håller, utan att bygga om appen.

const ur = (namn, forval) => (process.env[namn] || forval).replace(/\/+$/, '');

/// Huvuddomänen. Allt annat härleds ur den om inget annat sägs.
export const HEM = ur('MAXIMUS_HEM', 'https://aurolabs.ai/maximus');

/// Var uppdateringsmanifestet ligger.
export const UPPDATERING = ur('MAXIMUS_UPPDATERINGAR', `${HEM}/uppdatering.json`);

/// Var de byggda filerna ligger.
export const SLAPP = ur('MAXIMUS_SLAPP_BAS', `${HEM}/slapp`);

/// Hur MAXIMUS presenterar sig när den hämtar en sida.
///
/// Versionen står här och inte inbakad i strängen: den stod som `MAXIMUS/4.0`
/// medan appen var 4.0.0, och en User-Agent som ljuger om versionen är en
/// rad i någon annans logg som pekar fel.
export const besokare = version => `MAXIMUS/${version} (+${HEM})`;

/// Allt på en gång, för den som ska granska vad appen pratar med.
export const adresser = () => ({ hem: HEM, uppdatering: UPPDATERING, slapp: SLAPP });
