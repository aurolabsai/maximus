
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

export const etikett = (data, sort) =>
  `ai.aurolabs.maximus.${sort}.${createHash('sha256').update(String(data)).digest('hex').slice(0, 10)}`;
export const plistVag = (data, sort, hem = homedir()) => join(hem, 'Library', 'LaunchAgents', `${etikett(data, sort)}.plist`);

const xml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const strang = s => `<string>${xml(s)}</string>`;

export function plist({ sort, data, node, server, resurser = '', port, stig, app = '', dold = false }) {
  const namn = etikett(data, sort);
  let program, env = {}, keep = '<false/>';
  if (sort === 'bakgrund') {
    program = [node, join(server, 'server.mjs'), '--tyst'];
    env = { MAXIMUS_PORT: String(port), MAXIMUS_DATA: data, MAXIMUS_LAUNCHD: '1', PATH: stig,
      ...(resurser ? { MAXIMUS_RESURSER: resurser } : {}), ...(app ? { MAXIMUS_APP: app } : {}) };
    keep = '<dict><key>SuccessfulExit</key><false/></dict>';
  } else {
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

export async function slaPa(sort, o) {
  if (!AR_MAC) throw new Error(tx('bakgrund.baraMac'));
  const fil = plistVag(o.data, sort, o.hem);
  await mkdir(dirname(fil), { recursive: true });
  await writeFile(fil, plist({ sort, ...o }), { mode: 0o644 });
  await kor('/bin/launchctl', ['bootout', `${doman()}/${etikett(o.data, sort)}`]).catch(() => {});
  if (o.ladda !== false) await kor('/bin/launchctl', ['bootstrap', doman(), fil]);
  return fil;
}

export async function slaAv(sort, { data, hem } = {}) {
  if (!AR_MAC) return;
  await kor('/bin/launchctl', ['bootout', `${doman()}/${etikett(data, sort)}`]).catch(() => {});
  await unlink(plistVag(data, sort, hem)).catch(() => {});
}

export async function lage({ data, hem } = {}) {
  if (!AR_MAC) return 'oppen';
  for (const sort of ['bakgrund', 'inloggning']) {
    try { await access(plistVag(data, sort, hem)); return sort; } catch {  }
  }
  return 'oppen';
}

export const portUpptagen = (port, vard = '127.0.0.1') => new Promise(los => {
  const s = createConnection({ port, host: vard });
  s.once('connect', () => { s.destroy(); los(true); });
  s.once('error', () => los(false));
  s.setTimeout(800, () => { s.destroy(); los(false); });
});

export async function vantaPaPorten(port, { varje = 5000, logg = () => {} } = {}) {
  let sagt = false;
  while (await portUpptagen(port)) {
    if (!sagt) { logg(`  porten ${port} är upptagen av en annan Maximus — väntar och tar över när den stängs`); sagt = true; }
    await new Promise(r => setTimeout(r, varje));
  }
}
