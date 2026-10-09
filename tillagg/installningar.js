/// Inställningarna: parningen och hyresgästspärren.
///
/// Insvept i en funktion och inte skrivet rakt ut: `await` på översta nivån
/// kräver en modul, och en options-sida som laddas som vanligt skript hade
/// fallit tyst med ett syntaxfel — sidan visas, ingenting fungerar.
const $ = s => document.querySelector(s);
const FALT = ['workspace', 'orgIds', 'tenants'];

(async () => {
const i = await chrome.runtime.sendMessage({ typ: 'lage' });
for (const f of FALT) $(`#${f}`).value = i[f] || '';
if (i.parad) { $('#parkod').placeholder = 'Ihopparad'; $('#parsvar').textContent = 'Ihopparad med MAXIMUS.'; }

$('#para').onclick = async () => {
  const kod = $('#parkod').value.trim();
  const svar = $('#parsvar');
  if (!kod) { svar.textContent = 'Klistra in koden ur MAXIMUS först.'; svar.className = 'fel'; return; }
  svar.textContent = 'Provar…';
  svar.className = '';
  const r = await chrome.runtime.sendMessage({ typ: 'para', kod });
  if (r?.ok) { svar.textContent = 'Ihopparad.'; $('#parkod').value = ''; $('#parkod').placeholder = 'Ihopparad'; return; }
  // Två fel, två olika åtgärder. "Gick inte" hade lämnat användaren att gissa.
  svar.className = 'fel';
  svar.textContent = r?.fel === 'parning'
    ? 'MAXIMUS kände inte igen koden. Hämta en ny i Inställningar → Kopplingar.'
    : 'Ingen kontakt med MAXIMUS på den här datorn. Är appen igång?';
};

$('#spara').onclick = async () => {
  const varden = Object.fromEntries(FALT.map(f => [f, $(`#${f}`).value.trim()]));
  const r = await chrome.runtime.sendMessage({ typ: 'spara', varden });
  const svar = $('#sparsvar');
  svar.className = '';
  svar.textContent = r?.regler
    ? `Sparat. ${r.regler} ${r.regler === 1 ? 'regel' : 'regler'} aktiva.`
    : 'Sparat. Slå på spärren i panelen för att aktivera reglerna.';
};
})();
