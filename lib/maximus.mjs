
import { readFile, writeFile, mkdir, readdir, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import {
  forsegla, oppna, arForseglad, nyttSalt, nyckelUrLosenord,
  sessionsnyckel, kontrollvarde, stammerKontroll, oppnaRa } from './krypto.mjs';
import { tx } from './sprakstod.mjs';

const kor = promisify(execFile);

const last = () => Object.assign(new Error(tx('maximus.last')), { kod: 'last' });

export const arForsegladUtanKod = e => e?.kod === 'forseglad' || /kräver sin kod|requires its code/.test(String(e?.message || ''));

const tjanst = dataDir =>
  `ai.aurolabs.maximus3.${createHash('sha256').update(String(dataDir)).digest('hex').slice(0, 12)}`;

const LASFIL = 'las.json';

const UTANFOR_FORSEGLING = new Set([
  'id', 'las', 'agare', 'skapad', 'andrad',
  'arkiverad', 'fast', 'projekt', 'lage', 'webb', 'titel', 'dopt',
  'destination', 'behandling',
]);

export class Maximus {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.tjanst = tjanst(dataDir);
    this.huvudnyckel = null;
    this.las = null;
    this.skrivningar = new Map();
    this.generation = 0;
  }

  #oppna(nyckel, gen) {
    if (gen !== this.generation) { const e = new Error(tx('maximus.lastesUnderTiden')); e.lastesUnderTiden = true; throw e; }
    this.huvudnyckel = nyckel;
  }

  async ladda() {
    try { this.las = JSON.parse(await readFile(join(this.dataDir, LASFIL), 'utf8')); }
    catch { this.las = null; }
    return this.las;
  }

  get skyddat() { return Boolean(this.las?.kontroll); }
  get upplast() { return Boolean(this.huvudnyckel); }

  async satLosenord(losenord, { kommIhag = true } = {}) {
    if (typeof losenord !== 'string' || losenord.length < 8) throw new Error(tx('maximus.losenordKort'));
    const salt = nyttSalt();
    const nyckel = await nyckelUrLosenord(losenord, salt);
    this.huvudnyckel = nyckel;
    this.las = { v: 1, salt: salt.toString('base64'), kontroll: kontrollvarde(nyckel).toString('base64'), skapad: new Date().toISOString() };
    await writeFile(join(this.dataDir, LASFIL), JSON.stringify(this.las, null, 1), { mode: 0o600 });
    if (kommIhag) await this.sparaINyckelring().catch(() => {});
    return true;
  }

  async lasUpp(losenord) {
    const gen = this.generation;
    if (!this.las) await this.ladda();
    if (!this.skyddat) return true;
    const nyckel = await nyckelUrLosenord(losenord, Buffer.from(this.las.salt, 'base64'));
    if (!stammerKontroll(nyckel, this.las.kontroll)) throw new Error(tx('maximus.felLosenord'));
    this.#oppna(nyckel, gen);
    return true;
  }

  async lasUppMedNyckel(nyckel) {
    const gen = this.generation;
    if (!this.las) await this.ladda();
    if (!Buffer.isBuffer(nyckel) || nyckel.length !== 32) throw new Error(tx('maximus.ogiltigNyckel'));
    if (this.skyddat && !stammerKontroll(nyckel, this.las.kontroll)) throw new Error(tx('maximus.nyckelFel'));
    this.#oppna(nyckel, gen);
    return true;
  }

  las_() { this.huvudnyckel = null; this.generation++; }

  async sparaINyckelring() {
    if (!this.huvudnyckel) throw last();
    const b64 = this.huvudnyckel.toString('base64');
    if (!/^[A-Za-z0-9+/=]+$/.test(b64) || !/^[\w.-]+$/.test(this.tjanst)) throw new Error(tx('maximus.nyckelring'));
    await new Promise((klar, fel) => {
      const p = spawn('/usr/bin/security', ['-i'], { stdio: ['pipe', 'ignore', 'pipe'] });
      let err = '';
      p.stderr.on('data', d => { err += d; });
      p.on('error', fel);
      p.on('close', kod => (kod === 0 && !/error/i.test(err) ? klar() : fel(new Error(tx('maximus.nyckelring')))));
      p.stdin.end(`add-generic-password -U -a huvudnyckel -s ${this.tjanst} -w ${b64}\n`);
    });
    return true;
  }

  async lasUppUrNyckelring() {
    const gen = this.generation;
    if (!this.las) await this.ladda();
    if (!this.skyddat) return false;
    try {
      const { stdout } = await kor('/usr/bin/security', ['find-generic-password', '-a', 'huvudnyckel', '-s', this.tjanst, '-w']);
      const nyckel = Buffer.from(stdout.trim(), 'base64');
      if (nyckel.length !== 32 || !stammerKontroll(nyckel, this.las.kontroll)) return false;
      if (gen !== this.generation) return false;
      this.huvudnyckel = nyckel;
      return true;
    } catch { return false; }
  }

  async glomINyckelring() {
    await kor('/usr/bin/security', ['delete-generic-password', '-a', 'huvudnyckel', '-s', this.tjanst]).catch(() => {});
  }

  async minnsINyckelring() {
    try { await kor('/usr/bin/security', ['find-generic-password', '-a', 'huvudnyckel', '-s', this.tjanst]); return true; }
    catch { return false; }
  }

  async lasFil(vag) {
    const ra = await readFile(vag);
    if (!arForseglad(ra)) return ra.toString('utf8');
    if (!this.huvudnyckel) throw last();
    return oppna(ra, this.huvudnyckel);
  }

  async lasRa(vag) {
    const ra = await readFile(vag);
    if (!arForseglad(ra)) return ra;
    if (!this.huvudnyckel) throw last();
    return oppnaRa(ra, this.huvudnyckel);
  }

  async skrivFil(vag, text, { nyckel } = {}) {
    const k = nyckel || this.huvudnyckel;
    if (this.skyddat && !k) throw last();
    const data = k ? forsegla(text, k) : Buffer.from(text, 'utf8');
    const skriv = (this.skrivningar.get(vag) || Promise.resolve()).catch(() => {}).then(async () => {
      const tmp = `${vag}.${randomUUID()}.tmp`;
      try { await writeFile(tmp, data, { mode: 0o600 }); await rename(tmp, vag); }
      finally { await unlink(tmp).catch(() => {}); }
    });
    this.skrivningar.set(vag, skriv);
    try { await skriv; }
    finally { if (this.skrivningar.get(vag) === skriv) this.skrivningar.delete(vag); }
  }

  async andraFil(vag, andra, { forval = null } = {}) {
    const led = (this.skrivningar.get(vag) || Promise.resolve()).catch(() => {}).then(async () => {
      let nu = forval;
      try {
        nu = JSON.parse(await this.lasFil(vag));
      } catch (e) {
        if (e?.code !== 'ENOENT') {
          const undan = `${vag}.skadad-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 6)}`;
          try {
            await rename(vag, undan);
            console.error(`skadad fil lades undan: ${undan} (${e.message})`);
          } catch (r) {
            if (r?.code !== 'ENOENT') throw e;
          }
        }
        nu = forval;
      }
      const nytt = await andra(nu);
      if (nytt === undefined) return;

      const k = this.huvudnyckel;
      if (this.skyddat && !k) throw last();
      const text = JSON.stringify(nytt);
      const data = k ? forsegla(text, k) : Buffer.from(text, 'utf8');
      const tmp = `${vag}.${randomUUID()}.tmp`;
      try { await writeFile(tmp, data, { mode: 0o600 }); await rename(tmp, vag); }
      finally { await unlink(tmp).catch(() => {}); }
    });
    this.skrivningar.set(vag, led);
    try { return await led; }
    finally { if (this.skrivningar.get(vag) === led) this.skrivningar.delete(vag); }
  }

  async nyckelFor(session, kod) {
    if (!this.huvudnyckel) throw last();
    if (session?.las?.styrka !== 'forseglad') return this.huvudnyckel;
    if (!kod) throw Object.assign(new Error(tx('maximus.forseglad')), { kod: 'forseglad' });
    return sessionsnyckel(this.huvudnyckel, kod, Buffer.from(session.las.salt, 'base64'));
  }

  async kodkontroll(kod, salt) {
    const n = await sessionsnyckel(this.huvudnyckel, kod, salt);
    return kontrollvarde(n).toString('base64');
  }

  async stammerKod(las, kod) {
    if (!las?.kontroll) return true;
    try { return (await this.kodkontroll(kod, Buffer.from(las.salt, 'base64'))) === las.kontroll; }
    catch { return false; }
  }

  async lasSession(vag, kod = null) {
    const yttre = JSON.parse(await this.lasFil(vag));
    if (!yttre.kropp) return yttre;
    const nyckel = await this.nyckelFor(yttre, kod);
    const inre = JSON.parse(oppna(Buffer.from(yttre.kropp, 'base64'), nyckel));
    const { kropp, ...huvud } = yttre;
    return { ...huvud, ...inre };
  }

  async skrivSession(vag, session, kod = null) {
    if (session?.las?.styrka !== 'forseglad') return this.skrivFil(vag, JSON.stringify(session));
    const nyckel = await this.nyckelFor(session, kod);
    const huvud = {};
    const inre = {};
    for (const [k, v] of Object.entries(session)) {
      if (UTANFOR_FORSEGLING.has(k)) huvud[k] = v; else inre[k] = v;
    }
    const kropp = forsegla(JSON.stringify(inre), nyckel).toString('base64');
    return this.skrivFil(vag, JSON.stringify({ ...huvud, kropp }));
  }

  forsegla(text, nyckel) { return forsegla(String(text), nyckel).toString('base64'); }

  oppnaKuvert(b64, nyckel) { return oppna(Buffer.from(String(b64), 'base64'), nyckel); }

  async migrera() {
    if (!this.huvudnyckel) throw last();
    let gjorda = 0;

    const gaIgenom = async bas => {
      for (const post of await readdir(bas, { withFileTypes: true }).catch(() => [])) {
        if (post.name === LASFIL || KRYPTERAS_INTE.includes(post.name)) continue;
        const vag = join(bas, post.name);
        if (post.isDirectory()) { await gaIgenom(vag); continue; }
        if (!post.isFile() || !post.name.endsWith('.json')) continue;
        const ra = await readFile(vag).catch(() => null);
        if (!ra || arForseglad(ra)) continue;
        await this.skrivFil(vag, ra.toString('utf8'));
        gjorda++;
      }
    };

    await gaIgenom(this.dataDir);
    return gjorda;
  }
}

export const KRYPTERAS_INTE = ['lagar', 'models', 'searxng', 'tmp'];
