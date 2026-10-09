/// Tillägget: MAXIMUS:s räckvidd, inte MAXIMUS:s motor.
///
/// Masken görs aldrig här. Den görs av MAXIMUS på datorn, av samma regler och
/// samma lokala modell som allt annat — tillägget skickar texten dit och
/// lägger tillbaka svaret.
///
/// Det är inte en genväg utan hela poängen. En maskering som är kopierad in
/// i ett webbläsartillägg är en andra maskering att hålla i takt med den
/// riktiga, och den dagen de glider isär är det tillägget som släpper
/// igenom ett personnummer.
///
/// ── Två funktioner, och bara den ena behöver MAXIMUS ────────────────────────
///
/// 1. HYRESGÄSTSPÄRREN. Sätter de huvuden leverantörerna själva stöder:
///    ChatGPT-Allowed-Workspace-Id, anthropic-allowed-org-ids,
///    Restrict-Access-To-Tenants. Stänger ute privatkonton överallt, utan
///    TLS-inspektion och utan att läsa ett enda tecken av innehållet.
///    Kräver ingen MAXIMUS-installation alls.
///
/// 2. MASKEN. Kräver att MAXIMUS kör på datorn och att tillägget parats ihop
///    med den.
///
/// Att den första fungerar utan den andra är med avsikt: en IT-avdelning som
/// bara vill stänga privatkonton ska kunna rulla ut tillägget ensamt.

const MAXIMUS = 'http://127.0.0.1:3261';

/// Vad tillägget kommer ihåg.
const forval = {
  parkod: '',            // engångskoden ur MAXIMUS:s inställningar
  maskera: true,         // masken på eller av
  hyresgast: false,      // hyresgästspärren på eller av
  workspace: '',         // ChatGPT-Allowed-Workspace-Id
  orgIds: '',            // anthropic-allowed-org-ids
  tenants: '',           // Restrict-Access-To-Tenants
};

const las = async () => ({ ...forval, ...(await chrome.storage.local.get(Object.keys(forval))) });

// ── Hyresgästspärren ──────────────────────────────────────────────────────
//
// declarativeNetRequest och inte webRequest: huvudena sätts av webbläsaren
// utan att tillägget någonsin ser trafiken. Ett tillägg som kan LÄSA det som
// går till chatgpt.com är ett tillägg en säkerhetsavdelning måste granska;
// ett som bara sätter ett huvud är det inte.

async function stallHyresgast() {
  const i = await las();
  const regler = [];
  if (i.hyresgast && i.workspace) {
    regler.push({ id: 1, priority: 1,
      action: { type: 'modifyHeaders', requestHeaders: [
        { header: 'ChatGPT-Allowed-Workspace-Id', operation: 'set', value: i.workspace }] },
      condition: { urlFilter: '||chatgpt.com', resourceTypes: ['main_frame', 'sub_frame', 'xmlhttprequest'] } });
  }
  if (i.hyresgast && i.orgIds) {
    regler.push({ id: 2, priority: 1,
      action: { type: 'modifyHeaders', requestHeaders: [
        { header: 'anthropic-allowed-org-ids', operation: 'set', value: i.orgIds }] },
      condition: { urlFilter: '||claude.ai', resourceTypes: ['main_frame', 'sub_frame', 'xmlhttprequest'] } });
  }
  if (i.hyresgast && i.tenants) {
    regler.push({ id: 3, priority: 1,
      action: { type: 'modifyHeaders', requestHeaders: [
        { header: 'Restrict-Access-To-Tenants', operation: 'set', value: i.tenants },
        { header: 'Restrict-Access-Context', operation: 'set', value: i.tenants.split(',')[0].trim() }] },
      condition: { urlFilter: '||microsoft.com', resourceTypes: ['main_frame', 'sub_frame', 'xmlhttprequest'] } });
  }
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [1, 2, 3],
    addRules: regler,
  });
  return regler.length;
}

// ── Masken ────────────────────────────────────────────────────────────────

/// Frågar MAXIMUS. Kastar när den inte svarar — anroparen ska stoppa, inte
/// gissa. Se `fallerarStangt` i innehall.js.
async function fragaMaximus(vag, kropp, parkod) {
  const r = await fetch(`${MAXIMUS}${vag}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Maximus-Tillagg': parkod },
    body: JSON.stringify(kropp),
  });
  if (r.status === 401 || r.status === 403) throw new Error('parning');
  if (!r.ok) throw new Error(`maximus svarade ${r.status}`);
  return r.json();
}

chrome.runtime.onMessage.addListener((m, _avs, svara) => {
  (async () => {
    const i = await las();
    if (m.typ === 'lage') return svara({ ...i, parad: Boolean(i.parkod) });

    if (m.typ === 'maskera') {
      if (!i.maskera) return svara({ av: true });
      if (!i.parkod) return svara({ fel: 'parning' });
      try {
        const d = await fragaMaximus('/api/tillagg/maskera', { text: m.text }, i.parkod);
        return svara({ maskerad: d.maskerad, funna: d.funna || [], antal: (d.funna || []).length });
      } catch (e) {
        return svara({ fel: e.message === 'parning' ? 'parning' : 'nere' });
      }
    }

    if (m.typ === 'para') {
      try {
        await fragaMaximus('/api/tillagg/para', {}, m.kod);
        await chrome.storage.local.set({ parkod: m.kod });
        return svara({ ok: true });
      } catch (e) { return svara({ fel: e.message }); }
    }

    if (m.typ === 'spara') {
      await chrome.storage.local.set(m.varden);
      const n = await stallHyresgast();
      return svara({ ok: true, regler: n });
    }
    return svara({ fel: 'okänt meddelande' });
  })();
  return true;   // svaret kommer senare
});

chrome.runtime.onInstalled.addListener(stallHyresgast);
chrome.runtime.onStartup.addListener(stallHyresgast);
