/// Agentens tillgång, provad i webbläsaren.
///
/// Det enda stället i MAXIMUS där man ger något läsrätt till sin post. Provet
/// håller: att källorna är av från början, att en växel som slås på faktiskt
/// sparas och går att slå av, att Tempot är det enda valet för hur ofta
/// agenten tittar (2026-10-09), och att delarna står i sidopanelen.
///
///   sh scripts/provserver.sh start
///   node test/agentinst.mjs <nyckel>
import { oppna, forbiStarten } from './hjalpare.mjs';
const { p, ok, api, slut } = await oppna(process.argv[2]);
await forbiStarten(p, api);

await p.evaluate(() => document.querySelector('#oppna-installningar').click());
await p.waitForTimeout(700);
ok(await p.locator('#vy-installningar').isVisible(), 'inställningarna öppnas');
ok(await p.locator('#instnav [data-flik="avancerat"]').count() === 0, 'Avancerat finns inte längre');
ok(await p.locator('#instnav .sess').count() === 7, 'sju flikar i panelen');
await p.locator('#instnav [data-flik="agent"] .sess-oppna').click();
await p.waitForTimeout(700);
ok(await p.locator('.flik[data-flik="agent"]').isVisible(), 'Agenten visas');
ok((await p.locator('#instnav .instdel').allTextContents()).join(',') === 'Källor,Arbete,Handlingar,Säger till', 'Agentens delar står indragna i panelen');
ok(await p.locator('#ag-bev-rad').isHidden(), 'lagbevakningen döljs när ingen lag använts');
ok(await p.locator('#ag-takt').count() === 0, '"Hur ofta agenten tittar" är borta — Tempot bestämmer');
ok(await p.locator('#ag-tempo-rad').isVisible(), 'Tempot syns alltid');

const lage = async () => ({ sid: await p.locator('#ag-sid-pa').isChecked(), post: await p.locator('#ag-post-pa').isChecked(), ant: await p.locator('#ag-ant-pa').isChecked() });
ok(JSON.stringify(await lage()) === JSON.stringify({ sid: false, post: false, ant: false }), 'källorna är av från början');

await p.locator('#ag-sid-pa').click({ force: true });
await p.waitForTimeout(600);
await p.locator('#ag-tempo').selectOption('lugn');
await p.waitForTimeout(600);
ok((await api('/api/agent')).lage?.kallor?.takt === 15 || (await api('/api/installningar')).agent?.takt === 15, 'Lugn: agenten tittar var femtonde minut');

// Lämna fliken och kom tillbaka: valen ska stå kvar.
await p.locator('#instnav [data-flik="du"] .sess-oppna').click();
await p.waitForTimeout(300);
await p.locator('#instnav [data-flik="agent"] .sess-oppna').click();
await p.waitForTimeout(700);
ok((await lage()).sid && await p.locator('#ag-tempo').inputValue() === 'lugn', 'valen står kvar');

// Hoppet till en del. Den sista delen når inte överst — men ska stå i bild.
await p.locator('#instnav .instdel', { hasText: 'Säger till' }).click();
await p.waitForTimeout(700);
const syns = await p.evaluate(() => { const r = document.querySelector('.del[data-del="sager"]').getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight - 120; });
ok(syns, 'Säger till i panelen hoppar till sin rubrik');

await p.locator('#ag-sid-pa').click({ force: true });
await p.waitForTimeout(600);
ok(!(await lage()).sid, 'och av igen');
await slut();
