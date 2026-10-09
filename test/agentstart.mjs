/// Fas 26 i inställningarna: "När agenten kör" visar läget, förvalet är bara
/// medan appen är öppen, och batteri och notiser går att välja. Läget slås
/// inte på här — det skulle skriva ett launchd-jobb; test/bakgrunden.mjs
/// prövar det mot en egen datakatalog.
import { oppna, forbiStarten } from './hjalpare.mjs';
const { p, ok, api, slut } = await oppna(process.argv[2]);
await forbiStarten(p, api);
await p.reload({ waitUntil: 'networkidle' });
const a = await api('/api/agent');
ok(a.korLage === 'oppen', `förvalet: bara medan appen är öppen (${a.korLage})`);
await p.evaluate(() => document.querySelector('#oppna-installningar').click());
await p.waitForSelector('#instnav [data-flik="agent"] .sess-oppna', { timeout: 10000 });
await p.locator('#instnav [data-flik="agent"] .sess-oppna').click();
await p.waitForTimeout(800);
ok(await p.locator('#ag-start').isVisible() && await p.inputValue('#ag-start') === 'oppen', 'valet syns och står på förvalet');
ok(/Stänger du appen slutar agenten/.test(await p.locator('#ag-start-om').innerText()), 'raden säger vad det betyder');
ok(await p.inputValue('#ag-batteri') === 'glesare' && await p.isChecked('#ag-notiser'), 'batteri glesare och notiser på som förval');
await p.selectOption('#ag-batteri', 'samma');
await p.waitForTimeout(500);
ok((await api('/api/uppstart')).installningar?.agentBatteri === 'samma', 'batterivalet sparas');
await slut();
