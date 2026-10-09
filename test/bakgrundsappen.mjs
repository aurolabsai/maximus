/// Fas 26 i appen: en bakgrundsserver under launchd (egen katalog och port),
/// appen startad dold ansluter till den utan fönster, ett "klick i Dock"
/// visar fönstret, och när appen avslutas lever servern kvar.
import * as B from '../lib/bakgrund.mjs';
import { spawn, execFileSync } from 'node:child_process';
import { rm, mkdir, writeFile } from 'node:fs/promises';
const data = '/tmp/maximus-bakgrundsapp', port = 3497;
const repo = process.cwd();
let rott = 0;
const ok = (v, t) => { console.log(`${v ? 'GRÖNT' : 'RÖTT '} · ${t}`); if (!v) rott++; };
const vanta = async (f, s = 60) => { for (let i = 0; i < s * 2; i++) { if (await f()) return true; await new Promise(r => setTimeout(r, 500)); } return false; };
const fonster = pid => Number(execFileSync('/usr/bin/swift', ['test/fonster.swift', 'fonster', String(pid)]).toString().trim());
const skicka = (vad, pid) => execFileSync('/usr/bin/swift', ['test/fonster.swift', vad, String(pid)]).toString().trim();
const pidLaunchd = () => Number((/pid = (\d+)/.exec(execFileSync('/bin/launchctl', ['print', `gui/${process.getuid()}/${B.etikett(data, 'bakgrund')}`]).toString()) || [])[1] || 0);
await rm(data, { recursive: true, force: true }); await mkdir(data, { recursive: true });
let app = null;
try {
  await B.slaPa('bakgrund', { data, node: process.execPath, server: repo, port, stig: process.env.PATH });
  await writeFile(`${data}/bakgrund`, '1');
  ok(await vanta(() => B.portUpptagen(port)), 'bakgrundsservern kör under launchd');
  const server = pidLaunchd();
  app = spawn(`${repo}/src-tauri/target/debug/maximus`, ['--dold'], { env: { ...process.env, MAXIMUS_DATA: data, MAXIMUS_PORT: String(port) }, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 6000));
  ok(app.exitCode === null, `appen startade dold (pid ${app.pid})`);
  ok(fonster(app.pid) === 0, 'inget fönster syns');
  skicka('ateroppna', app.pid);
  ok(await vanta(() => fonster(app.pid) >= 1, 15), 'klick i Dock (återöppna): fönstret syns');
  skicka('avsluta', app.pid);
  ok(await vanta(() => app.exitCode !== null, 20), 'appen avslutades');
  await new Promise(r => setTimeout(r, 3000));
  ok(await B.portUpptagen(port) && pidLaunchd() === server, 'bakgrundsservern lever kvar, samma process');
} finally {
  try { app?.kill(); } catch {}
  await B.slaAv('bakgrund', { data });
  await rm(data, { recursive: true, force: true });
}
process.exit(rott ? 1 : 0);
