// Flaggorna servern startar med, och vad den vägrar starta med.
//
// Bröts ut ur server.mjs 2026-10-09, så att flaggorna och vägran går att
// pröva utan att starta servern.

import { readFile } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';

/// Läser flaggor och miljö. Flaggan vinner över miljön, miljön över förvalet.
export function las(argv = process.argv.slice(2), miljo = process.env) {
  const flagga = n => {
    const i = argv.indexOf(`--${n}`);
    if (i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--')) return argv[i + 1];
    const lik = argv.find(a => a.startsWith(`--${n}=`));
    return lik ? lik.slice(n.length + 3) : null;
  };
  const finns = n => argv.includes(`--${n}`);

  return {
    bind: flagga('bind') || miljo.MAXIMUS_BIND || '127.0.0.1',
    port: Number(flagga('port') || miljo.MAXIMUS_PORT || 3261),
    cert: flagga('cert') || miljo.MAXIMUS_CERT || null,
    nyckel: flagga('nyckel') || miljo.MAXIMUS_KEY || null,
    modell: flagga('modell') || miljo.MAXIMUS_MODELL || null,
    modellfil: flagga('modellfil') || miljo.MAXIMUS_MODELLFIL || null,
    kontext: Number(flagga('kontext') || miljo.MAXIMUS_KONTEXT || 0) || null,
    data: flagga('data') || miljo.MAXIMUS_DATA || null,
    tyst: finns('tyst'),
    hjalp: finns('hjalp') || finns('help') || argv.includes('-h'),
  };
}

/// Vägrar starta på ett sätt som lurar den som installerar.
///
/// Att lyssna brett utan certifikat är inte en inställning man råkar göra
/// fel — det är ett läckage som ser ut som att det fungerar, och det är
/// värre än ett startfel.
export async function granskaUppstart(k) {
  const brett = k.bind !== '127.0.0.1' && k.bind !== 'localhost' && k.bind !== '::1';
  if (brett && !(k.cert && k.nyckel)) {
    throw new Error([
      `MAXIMUS vägrar lyssna på ${k.bind} utan certifikat.`,
      '',
      'Allt som går över ett nät utan TLS går i klartext, och det första som',
      'skickas är ett lösenord. Starta om med:',
      '',
      `  maximus --bind ${k.bind} --cert cert.pem --nyckel nyckel.pem`,
      '',
      'Har du inget certifikat, och ska bara prova:',
      '',
      '  openssl req -x509 -newkey rsa:2048 -nodes -days 365 \\',
      '    -keyout nyckel.pem -out cert.pem -subj "/CN=maximus"',
    ].join('\n'));
  }
  if (k.cert && k.nyckel) {
    const [c, n] = await Promise.all([readFile(k.cert).catch(() => null), readFile(k.nyckel).catch(() => null)]);
    if (!c) throw new Error(`Certifikatet går inte att läsa: ${k.cert}`);
    if (!n) throw new Error(`Nyckeln går inte att läsa: ${k.nyckel}`);
    return { cert: c, key: n };
  }
  return null;
}

/// Adresserna servern faktiskt går att nå på. Den som startar bredare än
/// loopback behöver veta vilken av maskinens adresser som gäller.
export function adresser(k) {
  const skydd = k.cert ? 'https' : 'http';
  if (k.bind !== '0.0.0.0' && k.bind !== '::') return [`${skydd}://${k.bind}:${k.port}`];
  const ut = [];
  for (const [namn, lista] of Object.entries(networkInterfaces())) {
    for (const n of lista || []) {
      if (n.family !== 'IPv4' || n.internal) continue;
      ut.push(`${skydd}://${n.address}:${k.port}   (${namn})`);
    }
  }
  return ut.length ? ut : [`${skydd}://localhost:${k.port}`];
}

export const HJALP = `MAXIMUS — grinden mellan din verksamhet och AI

  maximus                          Skrivbord: lyssnar på 127.0.0.1 och öppnar appen

Flaggor
  --bind ADRESS         Gränssnitt att lyssna på (förval 127.0.0.1)
  --port NUMMER         Port (förval 3261)
  --cert FIL            TLS-certifikat. Krävs för allt utom loopback
  --nyckel FIL          TLS-nyckel
  --modell URL          OpenAI-kompatibel endpoint för den lokala modellen
  --modellfil FIL       GGUF-filen MAXIMUS själv startar (förval: Gemma 4 12B)
  --kontext N           modellens minne i tokens: 16384, 32768, 65536 eller 131072
  --data KATALOG        Var sessioner och liggare sparas
  --tyst                Öppna inte webbläsaren
  --hjalp               Det här

Miljövariabler
  MAXIMUS_BIND MAXIMUS_PORT MAXIMUS_CERT MAXIMUS_KEY MAXIMUS_MODELL MAXIMUS_DATA
`;
