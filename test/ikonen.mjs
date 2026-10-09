/// Ritar appikonens PNG ur src-tauri/ikonkalla/maximus.svg.
///
///   node test/ikonen.mjs && npx tauri icon src-tauri/ikonkalla/maximus.png -o src-tauri/icons
///
/// Med Playwrights Chromium: samma motor som ritar appen ritar ikonen, och
/// inget nytt beroende behövs.
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
const svg = await readFile(new URL('../src-tauri/ikonkalla/maximus.svg', import.meta.url), 'utf8');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1024, height: 1024 } });
await p.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', '<svg width="1024" height="1024" ')}</body></html>`);
await p.screenshot({ path: new URL('../src-tauri/ikonkalla/maximus.png', import.meta.url).pathname, omitBackground: true });
await b.close();
console.log('src-tauri/ikonkalla/maximus.png');
