/// Fas 32 på riktigt, med Auros ja (2026-10-05): skrivhjälparen skapar en
/// påminnelse och ett möte i de riktiga apparna, läser tillbaka dem, och tar
/// bort dem direkt. Allt bär "MAXIMUS PROV — radera" i rubriken.
import { execFileSync } from 'node:child_process';
import { paminnelser } from '../lib/paminnelser.mjs';
import { handelser } from '../lib/kalender.mjs';
const swift = (fil, ...a) => JSON.parse(execFileSync('/usr/bin/swift', [`verktyg/${fil}`, ...a], { timeout: 120000 }).toString().trim().split('\n').at(-1));
let rott = 0;
const ok = (v, t) => { console.log(`${v ? 'GRÖNT' : 'RÖTT '} · ${t}`); if (!v) rott++; };
const imorgon = new Date(); imorgon.setDate(imorgon.getDate() + 1); imorgon.setHours(9, 0, 0, 0);
const RUBRIK = `MAXIMUS PROV — radera ${Date.now()}`;

const p = swift('skriv.swift', 'paminnelse', JSON.stringify({ titel: RUBRIK, forfaller: imorgon.toISOString() }));
ok(p.id, `påminnelsen skapades (${p.id || p.fel})`);
const finns = (await paminnelser({ dagar: 1 })).find(x => x.titel === RUBRIK);
ok(finns && finns.forfaller, `den syns i Påminnelser, förfaller ${finns?.forfaller}`);
const bort = swift('skriv.swift', 'ta-bort', p.id);
ok(bort.borttagen === p.id, 'ångra: borttagen');
ok(!(await paminnelser({ dagar: 1 })).some(x => x.titel === RUBRIK), 'och den syns inte längre');

const slut = new Date(imorgon.getTime() + 30 * 60000);
const m = swift('skriv.swift', 'mote', JSON.stringify({ titel: RUBRIK, start: imorgon.toISOString(), slut: slut.toISOString(), plats: 'Prov' }));
ok(m.id, `mötet skapades (${m.id || m.fel})`);
const a = new Date(imorgon); a.setHours(0, 0, 0, 0); const b = new Date(a); b.setDate(b.getDate() + 1);
const moten = await handelser({ fran: a, till: b });
ok(moten.some(x => x.rubrik === RUBRIK), 'det syns i kalendern i morgon');
const mb = swift('skriv.swift', 'ta-bort', m.id);
ok(mb.borttagen === m.id, 'ångra: borttaget');
ok(!(await handelser({ fran: a, till: b })).some(x => x.rubrik === RUBRIK), 'och det syns inte längre');
process.exit(rott ? 1 : 0);
