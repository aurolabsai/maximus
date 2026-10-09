// När agenten kör (Fas 26, 2026-10-05).
//
// Auro: "Default: när appen är öppen, men erbjud möjligheten att köra när
// datorn startar (eller öppna appen i samband med det ...)". Tre lägen:
//
//   oppen       Bara medan appen är öppen. Förvalet, som förut.
//   inloggning  Maximus öppnas när du loggar in, med fönstret synligt
//               eller dolt. Agenten kör för att appen kör.
//   bakgrund    Servern körs av launchd utan fönster, startas vid
//               inloggning och startas om om den faller. Fönstret ansluter
//               till den när du öppnar appen, och lämnar den igång när du
//               stänger.
//
// Båda de nya lägena är en LaunchAgent i ~/Library/LaunchAgents, alltså
// macOS eget sätt att starta saker vid inloggning. Inga hjälpprogram, ingen
// root. Etiketten bär datakatalogens hash, så att ett prov med egen katalog
// aldrig rör användarens jobb.
//
// Bara Mac. På andra system svarar `finns()` nej och valet visas inte.

import { writeFile, unlink, mkdir, access } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { createConnection } from 'node:net';
import { join, dirname } from 'node:path';
import { homedir, userInfo } from 'node:os';
import { AR_MAC } from './plattform.mjs';
import { tx } from './sprakstod.mjs';

const kor = promisify(execFile);
export const LAGEN = ['oppen', 'inloggning', 'bakgrund'];
export const finns = () => AR_MAC;

/// Etiketten: en per datakatalog.
export const etikett = (data, sort) =>
  `ai.aurolabs.maximus.${sort}.${createHash('sha256').update(String(data)).digest('hex').slice(0, 10)}`;
export const plistVag = (data, sort, hem = homedir()) => join(hem, 'Library', 'LaunchAgents', `${etikett(data, sort)}.plist`);

const xml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const strang = s => `<string>${xml(s)}</string>`;

/// Plist-filen. Ren funktion, så att den går att pröva utan launchd.
///
/// `bakgrund`: node kör server.mjs med samma miljö som appen ger den, och
/// MAXIMUS_LAUNCHD=1 — servern väntar då på porten innan den startar, så
/// att den aldrig kör bredvid appens egen server (se vantaPaPorten).
/// KeepAlive bara vid fel: en server som stängs med flit ska få vara stängd.
///
/// `inloggning`: appen öppnas, med --dold om fönstret ska vänta.
export function plist({ sort, data, node, server, resurser = '', port, stig, app = '', dold = false }) {
  const namn = etikett(data, sort);
  let program, env = {}, keep = '<false/>';
  if (sort === 'bakgrund') {
    program = [node, join(server, 'server.mjs'), '--tyst'];
    env = { MAXIMUS_PORT: String(port), MAXIMUS_DATA: data, MAXIMUS_LAUNCHD: '1', PATH: stig,
      ...(resurser ? { MAXIMUS_RESURSER: resurser } : {}), ...(app ? { MAXIMUS_APP: app } : {}) };
    keep = '<dict><key>SuccessfulExit</key><false/></dict>';
  } else {
    // En .app öppnas med open, så att macOS ser den som appen och inte som
    // en lös binär. Ur repot (ingen .app) körs binären direkt.
    const paket = /\.app\//.test(app) ? app.slice(0, app.indexOf('.app/') + 4) : '';
    program = paket ? ['/usr/bin/open', '-a', paket, ...(dold ? ['--args', '--dold'] : [])]
      : [app, ...(dold ? ['--dold'] : [])];
    if (!paket) env = { MAXIMUS_PORT: String(port), MAXIMUS_DATA: data };
  }
  const envXml = Object.keys(env).length
    ? `  <key>EnvironmentVariables</key>\n  <dict>\n${Object.entries(env).map(([k, v]) => `    <key>${xml(k)}</key>${strang(v)}`).join('\n')}\n  </dict>\n` : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>${strang(namn)}
  <key>ProgramArguments</key>
  <array>
${program.map(a => `    ${strang(a)}`).join('\n')}
  </array>
${envXml}  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key>${keep}
  <key>ProcessType</key><string>Background</string>
${sort === 'bakgrund' ? `  <key>StandardOutPath</key>${strang(join(data, 'server.log'))}\n  <key>StandardErrorPath</key>${strang(join(data, 'server.log'))}\n` : ''}</dict>
</plist>
`;
}

const doman = () => `gui/${userInfo().uid}`;

/// Slår på ett läge: skriver plist-filen och laddar jobbet.
///
/// `starta: false` för bakgrunden när appens server redan kör: jobbet laddas
/// ändå (RunAtLoad), men servern det startar väntar på porten och tar över
/// först när appen stängs.
export async function slaPa(sort, o) {
  if (!AR_MAC) throw new Error(tx('bakgrund.baraMac'));
  const fil = plistVag(o.data, sort, o.hem);
  await mkdir(dirname(fil), { recursive: true });
  await writeFile(fil, plist({ sort, ...o }), { mode: 0o644 });
  // Ett gammalt jobb med samma etikett ut först; bootstrap vägrar annars.
  await kor('/bin/launchctl', ['bootout', `${doman()}/${etikett(o.data, sort)}`]).catch(() => {});
  if (o.ladda !== false) await kor('/bin/launchctl', ['bootstrap', doman(), fil]);
  return fil;
}

/// Slår av ett läge: jobbet ur launchd och filen bort.
export async function slaAv(sort, { data, hem } = {}) {
  if (!AR_MAC) return;
  await kor('/bin/launchctl', ['bootout', `${doman()}/${etikett(data, sort)}`]).catch(() => {});
  await unlink(plistVag(data, sort, hem)).catch(() => {});
}

/// Vilket läge som faktiskt gäller, ur filerna — inte ur inställningen.
export async function lage({ data, hem } = {}) {
  if (!AR_MAC) return 'oppen';
  for (const sort of ['bakgrund', 'inloggning']) {
    try { await access(plistVag(data, sort, hem)); return sort; } catch { /* nästa */ }
  }
  return 'oppen';
}

/// Svarar någon på porten?
export const portUpptagen = (port, vard = '127.0.0.1') => new Promise(los => {
  const s = createConnection({ port, host: vard });
  s.once('connect', () => { s.destroy(); los(true); });
  s.once('error', () => los(false));
  s.setTimeout(800, () => { s.destroy(); los(false); });
});

/// Servern som launchd startar väntar tills porten är ledig, och startar
/// först då. Utan det hade två servrar kört samma uppdrag på samma data:
/// appens egen, och den som launchd startade när läget slogs på.
export async function vantaPaPorten(port, { varje = 5000, logg = () => {} } = {}) {
  let sagt = false;
  while (await portUpptagen(port)) {
    if (!sagt) { logg(`  porten ${port} är upptagen av en annan Maximus — väntar och tar över när den stängs`); sagt = true; }
    await new Promise(r => setTimeout(r, varje));
  }
}
