/// En låtsasleverantör för provet av molnmodellen (Fas 51): ett OpenAI-
/// kompatibelt /v1/chat/completions på datorn. Den sparar allt den får och
/// svarar med platshållarna den fick — så att provet ser både vad som gick
/// ut och att svaret återställs.
///
///   node test/molnlatsas.mjs 3311 /tmp/maximus-moln-mottaget.json
import http from 'node:http';
import { writeFileSync } from 'node:fs';
const [port, fil] = [Number(process.argv[2] || 3311), process.argv[3] || '/tmp/maximus-moln-mottaget.json'];
const mottaget = [];
http.createServer((q, s) => {
  let b = ''; q.on('data', d => { b += d; });
  q.on('end', () => {
    let k = {}; try { k = JSON.parse(b); } catch { /* tomt */ }
    mottaget.push({ auth: q.headers.authorization || null, kropp: k });
    writeFileSync(fil, JSON.stringify(mottaget, null, 1));
    const sista = String([...(k.messages || [])].reverse().find(m => m.role === 'user')?.content || '');
    const p = (sista.match(/\[NAMN [A-Z]{1,3}\]/g) || []).slice(0, 2).join(' och ');
    const svar = p ? `Jag ser ${p} i frågan.` : 'OK';
    if (!k.stream) { s.writeHead(200, { 'Content-Type': 'application/json' }); return s.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: svar } }] })); }
    s.writeHead(200, { 'Content-Type': 'text/event-stream' });
    // Svaret i små bitar, så att platshållarna delas mellan dem.
    for (let i = 0; i < svar.length; i += 3) s.write(`data: ${JSON.stringify({ choices: [{ delta: { content: svar.slice(i, i + 3) } }] })}\n\n`);
    s.end('data: [DONE]\n\n');
  });
}).listen(port, '127.0.0.1', () => console.log(`molnlåtsas på ${port}`));
