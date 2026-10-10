// Provservrarnas port och avslut (2026-10-10).
//
// Fyra prov valde port med Math.random i samma spann och väntade sedan in
// serverns 'exit' utan gräns. Under hela sviten drog två prov samma port; den
// andra servern dog direkt (porten upptagen), och avslutet väntade på ett
// 'exit' som redan hänt. Sviten stod still i tio minuter, och servrar och
// påhittade modeller blev kvar och drog processorn.
import net from 'node:net';

/// En port som systemet just gav som ledig.
export function ledigPort() {
  return new Promise((klar, fel) => {
    const s = net.createServer();
    s.once('error', fel);
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => klar(port)); });
  });
}

/// Stänger en barnprocess: SIGTERM, högst tio sekunder, sedan SIGKILL. En
/// process som redan avslutats väntas inte in.
export async function avsluta(p, ms = 10000) {
  if (!p || p.exitCode !== null || p.signalCode !== null) return;
  const ute = new Promise(r => p.once('exit', r));
  p.kill('SIGTERM');
  const t = setTimeout(() => { try { p.kill('SIGKILL'); } catch { /* redan borta */ } }, ms);
  await ute;
  clearTimeout(t);
}

/// En påhittad modell för provservrar som inte frågar modellen något
/// viktigt. Utan MAXIMUS_MODELL laddar servern en riktig Gemma, och den
/// blev kvar efter prov (2026-10-10). `svar` är vad chatten svarar.
export async function fejkmodell(svar = '{}') {
  const http = await import('node:http');
  const s = http.createServer(async (q, r) => {
    for await (const _ of q) { /* läs klart */ }
    r.writeHead(200, { 'content-type': 'application/json' });
    if (q.url.includes('/v1/models')) return r.end('{"data":[{"id":"fejk"}]}');
    if (!q.url.includes('chat/completions')) return r.end('{"default_generation_settings":{"n_ctx":8192}}');
    r.end(JSON.stringify({ choices: [{ message: { content: svar } }] }));
  });
  await new Promise(k => s.listen(0, '127.0.0.1', k));
  return { url: `http://127.0.0.1:${s.address().port}`, stang: () => new Promise(k => { s.closeAllConnections?.(); s.close(k); }) };
}
