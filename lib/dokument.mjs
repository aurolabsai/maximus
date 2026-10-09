// Dokument in. Text ut. Allt på den här datorn.
//
// Ingenting här laddar upp något. `pdftotext` läser PDF:er, `textutil` tar
// Word och RTF, och Vision läser av sidor som bara är bilder. Det är tre
// verktyg som redan finns på maskinen, och det är hela poängen: ett
// dokument som ska maskeras får inte först skickas någonstans för att bli
// läsbart.
//
// Filen sparas aldrig. Texten sparas, krypterad, bunden till sessionen.

import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, unlink, stat, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, extname, basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import { arFodelsedag } from './maskering.mjs';
import { hitta, tillWav, AR_MAC } from './plattform.mjs';
import { hamtaVerifierad, stammerFil } from './modeller.mjs';
import { tx, aktuellt } from './sprakstod.mjs';

const kor = promisify(execFile);
const HAR = new URL('../verktyg/', import.meta.url).pathname;
/// Två öron, och valet är verkligt.
///
/// KB-Whisper är Kungliga bibliotekets svenska Whisper: tränad på 50 000
/// timmar svenska — undertextad tv ur KB:s samlingar, riksdagsdebatter och
/// dialektinspelningar från Isof — och gör 47 procent färre ordfel än
/// OpenAI:s large-v3 på svenska. Den stavar rätt på svenska ortnamn och
/// personnamn, vilket är precis det som går fel i ett ärende.
///
/// Whisper large-v3-turbo är snabbare och kan sjuttio språk. Den som skriver
/// av engelska möten behöver den; den som skriver av svenska behöver den
/// inte.
///
/// Båda finns färdiga i ggml-format för whisper.cpp — KBLab publicerar sina
/// egna checkpoints. Ingenting behöver byggas om.
///
/// `kalla` pekar på en fast commit och `sha256`/`byte` är filens exakta
/// summa och storlek (granskningen 2026-10-09). Förut hämtades örat från
/// `resolve/main` utan någon kontroll alls, och whisper-cli tolkar filen i
/// C++ varje gång något skrivs av. Summorna är lästa ur Hugging Faces
/// LFS-register (api/models/<repo>/tree/<rev>) 2026-10-09 och stämmer med
/// filerna som redan låg i ~/models/whisper på utvecklingsdatorn.
export const ORON = {
  svensk: {
    id: 'svensk',
    namn: 'KB-Whisper large',
    hus: 'Kungliga biblioteket',
    fil: 'ggml-kb-whisper-large-q5_0.bin',
    kalla: 'https://huggingface.co/KBLab/kb-whisper-large/resolve/d5d5984b4d8f7c4847a8ea203f1976285fb28300/ggml-model-q5_0.bin',
    sha256: '6d2863812d7410322bb7d8647a5c7260761300fa946714c9ed66d22bb30bcb19',
    byte: 1081140203,
    // Texterna läses när de visas, på det språk som gäller då.
    get storlek() { return tx('lib.dokument.ora.svensk.storlek'); },
    get om() { return tx('lib.dokument.ora.svensk.om'); },
    get sprak() { return tx('lib.dokument.ora.svensk.sprak'); },
  },
  snabb: {
    id: 'snabb',
    namn: 'Whisper large-v3-turbo',
    hus: 'OpenAI',
    fil: 'ggml-large-v3-turbo-q5_0.bin',
    kalla: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-large-v3-turbo-q5_0.bin',
    sha256: '394221709cd5ad1f40c46e6031ca61bce88931e6e088c188294c6d5a55ffa7e2',
    byte: 574041195,
    storlek: '530 MB',
    get om() { return tx('lib.dokument.ora.snabb.om'); },
    get sprak() { return tx('lib.dokument.ora.snabb.sprak'); },
  },
};

/// Vilket öra som är valt. Svenska som förval — appen är svensk, och den som
/// skriver av svenska möten ska inte behöva veta att valet fanns.
let VALT = ORON.svensk;
export function satOra(id) { if (ORON[id]) VALT = ORON[id]; }
export const valtOra = () => VALT;

/// En egen fil (2026-10-06). Går före listan när den finns; Maximus föreslår
/// fortfarande de två den vet fungerar bäst, men valet är ditt.
let EGET = null;
export function satEgetOra(vag) { EGET = vag || null; }
export const egetOra = () => EGET;
const egetNamn = v => String(v).split('/').pop();

const vagen = o => join(process.env.HOME, 'models', 'whisper', o.fil);
const MODELL_FALLBACK = join(process.env.HOME, 'models', 'whisper', 'ggml-large-v3-turbo-q5_0.bin');

/// Modellfilen som faktiskt ska användas.
///
/// Det valda örat om det finns, annars det andra om DET finns. En hämtad
/// modell på disken ska användas även om valet pekar på en som inte hämtats
/// — alternativet är att transkriberingen tyst slutar fungera för den som
/// bytte val utan att hämta.
async function modellfilen() {
  if (EGET) { try { if ((await stat(EGET)).size > 30e6) return EGET; } catch { /* borta: listan */ } }
  for (const o of [VALT, ...Object.values(ORON)]) {
    try { if ((await stat(vagen(o))).size > 4e8) return vagen(o); } catch { /* nästa */ }
  }
  try { if ((await stat(MODELL_FALLBACK)).size > 4e8) return MODELL_FALLBACK; } catch { /* ingen */ }
  return vagen(VALT);
}

/// Finns lyssnarmodellen på disk?
export async function orat() {
  if (EGET) {
    try { const f = await stat(EGET); if (f.size > 30e6) return { finns: true, id: 'egen', namn: egetNamn(EGET), storlek: `${Math.round(f.size / 1e6)} MB`, om: 'Din egen fil.' }; } catch { /* listan */ }
  }
  const o = VALT;
  try {
    const f = await stat(vagen(o));
    return { finns: f.size > 4e8, id: o.id, namn: o.namn, storlek: o.storlek, om: o.om };
  } catch { return { finns: false, id: o.id, namn: o.namn, storlek: o.storlek, om: o.om }; }
}

/// Vilka öron som finns att välja på, och vilka som redan ligger på disk.
export async function oronlage() {
  const ut = [];
  for (const o of Object.values(ORON)) {
    let finns = false;
    try { finns = (await stat(vagen(o))).size > 4e8; } catch { /* inte hämtad */ }
    ut.push({ ...o, kalla: undefined, fil: undefined, sha256: undefined, finns, valt: o.id === VALT.id });
  }
  return ut;
}

/// Hämtar den. Enda gången MAXIMUS laddar ned något, och det sker på begäran.
///
/// Den ligger i guiden och inte första gången någon råkar bifoga en ljudfil.
/// En nedladdning på en halv gigabyte mitt i ett ärende är inte ett svar, det
/// är en överraskning.
export async function hamtaOrat({ onSteg = () => {}, onFramsteg = () => {}, id = null, liggare } = {}) {
  // `id` hämtar ett bestämt öra utan att byta det valda. Starten hämtar det
  // örat den föreslagit och väljer det först när det ligger på disk — ett
  // val som pekar på en fil som inte finns är ett val som tyst inte fungerar.
  const o = (id && ORON[id]) || VALT;
  const MODELL = vagen(o);
  // Storleken räckte förut (`> 4e8`). Nu räknas summan på det som redan
  // ligger där (granskningen 2026-10-09): en fil som inte stämmer hämtas om
  // och skrivs över, den körs inte.
  if (await stammerFil(MODELL, o)) return { redan: true };
  onSteg({ steg: 'laddar', text: tx('lib.dokument.hamtar', { namn: o.namn, storlek: o.storlek }) });
  await mkdir(join(process.env.HOME, 'models', 'whisper'), { recursive: true });
  // Framsteget räknas på vägen. Utan det stod starten med en mätare som
  // inte rörde sig i en minut, och en mätare som står still ljuger lika
  // mycket som en som springer före.
  //
  // Samma hämtning som modellen och projektorn (granskningen 2026-10-09):
  // fast commit, exakt storlek, sha256. Stämmer summan inte tas filen bort
  // och felet säger det.
  await hamtaVerifierad(o.kalla, MODELL, { byte: o.byte, sha256: o.sha256, vad: `lyssnarmodellen ${o.namn}`,
    onFramsteg, liggare });
  onFramsteg({ gjort: o.byte, av: o.byte, andel: 1, klar: true });
  return { redan: false };
}

// .webm är vad en Chromium-webbläsare spelar in i (Maximus i Safari och i
// appen spelar in .m4a). ffmpeg läser den; afconvert gör det inte.
/// Känner igen "inget tal" i ett fel på båda språken: servern visar det
/// inte som ett fel (server.mjs jämförde med /Inget tal/).
export const INGET_TAL = /Inget tal|No speech/;

export const LJUD = ['.m4a', '.mp3', '.wav', '.aiff', '.aif', '.aac', '.caf', '.mp4', '.mov', '.flac', '.ogg', '.opus', '.webm'];

export const SORTER = {
  '.pdf': 'pdf', '.doc': 'word', '.docx': 'word', '.rtf': 'word', '.odt': 'word',
  '.txt': 'text', '.md': 'text', '.json': 'text',
  // Kalkylblad läses som tabeller, inte som text. En csv som rå text är
  // femhundra rader semikolon och en modell som räknar ungefär.
  '.csv': 'kalkyl', '.tsv': 'kalkyl', '.xlsx': 'kalkyl', '.xlsm': 'kalkyl', '.ods': 'kalkyl',
  '.png': 'bild', '.jpg': 'bild', '.jpeg': 'bild', '.heic': 'bild', '.tiff': 'bild',
};

const TAK = 40 * 1024 * 1024;

/// Läser ett dokument till text.
///
/// PDF:er kommer i två sorter och det syns inte utanpå: en textPDF har
/// tecken i sig, en skannad har bara en bild av tecken. `pdftotext` ger tom
/// text för den andra, och då — och bara då — går den till Vision. Att
/// alltid köra OCR hade varit långsammare och sämre.
export async function lasDokument(namn, data) {
  if (data.length > TAK) throw new Error(tx('lib.dokument.forStor'));
  const slut = extname(namn).toLowerCase();
  const sort = SORTER[slut];
  if (!sort) throw new Error(tx('lib.dokument.lasesInte', { slut: slut || tx('lib.dokument.utanAndelse') }));

  const tmp = join(tmpdir(), `maximus-${randomUUID()}${slut}`);
  await writeFile(tmp, data, { mode: 0o600 });
  try {
    let text = '', hur = sort;
    if (sort === 'text') text = data.toString('utf8');
    else if (sort === 'kalkyl') {
      const { lasKalkyl, lasCsv, tillText } = await import('./kalkyl.mjs');
      // Summorna räknas ut här och följer med tabellen. En modell som får
      // tvåhundra rader och ombeds summera en kolumn summerar ungefär.
      const blad = /\.(csv|tsv)$/i.test(slut) ? lasCsv(data.toString('utf8')) : lasKalkyl(data);
      text = tillText(blad);
      hur = 'kalkyl';
    }
    else if (sort === 'pdf') {
      // Felet från pdftotext innehåller hela kommandoraden med sökvägen till
      // temporärfilen. Det säger ingenting åt den som läser och allt åt den
      // som inte borde läsa.
      //
      // På Mac läser systemets egen PDFKit (maximus-pdf, Fas 22) — poppler
      // finns inte på en Mac utan Homebrew. pdftotext är reserven, och vägen
      // på Windows.
      const pdfkit = AR_MAC ? await hitta('maximus-pdf') : null;
      const pdftotext = pdfkit ? null : await hitta('pdftotext');
      if (!pdfkit && !pdftotext) throw new Error(tx('lib.dokument.pdfLasareSaknas'));
      try {
        text = pdfkit
          ? (await kor(pdfkit, [tmp], { maxBuffer: 64e6 })).stdout
          : (await kor(pdftotext, ['-layout', '-enc', 'UTF-8', tmp, '-'], { maxBuffer: 64e6 })).stdout;
      } catch (e) {
        throw new Error(/lösenordsskyddad/i.test(e.stderr || '') ? tx('lib.dokument.pdfLosenord')
          : /empty|damaged|Couldn't open|skadad/i.test(e.stderr || '')
          ? tx('lib.dokument.pdfSkadad')
          : tx('lib.dokument.pdfKundeInte'));
      }
      if (text.replace(/\s/g, '').length < 40) {
        text = await ocr(tmp);
        hur = tx('lib.dokument.hur.pdfBild');
      }
    } else if (sort === 'word') {
      try {
        text = (await kor('/usr/bin/textutil', ['-convert', 'txt', '-stdout', tmp],
          { maxBuffer: 64e6 })).stdout;
      } catch { throw new Error(tx('lib.dokument.wordLasesInte')); }
    } else {
      text = await ocr(tmp);
      hur = tx('lib.dokument.hur.bild');
    }

    text = stada(text);
    if (!text.trim()) throw new Error(tx('lib.dokument.ingenText'));
    return { namn: basename(namn), sort: hur, tecken: text.length, text };
  } finally {
    await unlink(tmp).catch(() => {});
  }
}

async function ocr(vag) {
  try {
    // Det kompilerade programmet först (Fas 22); skriptet kräver Xcodes verktyg.
    const bin = await hitta('maximus-ocr');
    const { stdout } = bin
      ? await kor(bin, [vag], { maxBuffer: 64e6, timeout: 180000 })
      : await kor('/usr/bin/swift', [join(HAR, 'ocr.swift'), vag], { maxBuffer: 64e6, timeout: 180000 });
    return stdout;
  } catch (e) {
    throw new Error(tx('lib.dokument.ocrFel'));
  }
}

/// Städar bort det som gör maskeringen sämre utan att bära betydelse.
///
/// pdftotext lämnar sidnummer, avstavningar och rader som brutits mitt i en
/// mening. Namnvakten läser mening för mening, och "Ella\nNordin" är
/// två rader men ett namn.
/// Fogar ihop adresser som radbrytningen delat.
///
/// Sett skarpt 2026-09-24 i ett kommunalt beslutsunderlag: pdftotext bröt
/// raden mitt i "sofia.berggren@sodrakommunen.example", städningen la in ett
/// mellanslag i skarven, och mönstret för e-post hittade ingen e-post.
/// Adressen gick rakt igenom grinden.
///
/// Bara mellanslag INUTI något som redan ser ut som en adress tas bort. Ett
/// mellanslag mellan två ord är fortfarande ett mellanslag.
const fogaAdresser = t => t
  .replace(/[\w.+-]+(?:[ \n][\w.+-]+)?@[\w-]+(?:[ \n][\w.-]+)?\.\p{L}{2,}/gu, m => m.replace(/\s+/g, ''))
  .replace(/https?:\/\/[^\s]+[ \n][^\s]*\.[a-z]{2,}(?:\/[^\s]*)?/gi, m => m.replace(/\s+/g, ''));

export function stada(text) {
  return fogaAdresser(String(text)
    .replace(/\r\n?/g, '\n')
    .replace(/\f/g, '\n\n')
    .replace(/(\p{Ll})-\n(\p{Ll})/gu, '$1$2')      // avstavning
    .replace(/(\p{L},?)\n(\p{Lu}?\p{Ll})/gu, '$1 $2') // bruten mening
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim());
}

/// Talade siffergrupper blir ett nummer igen.
///
/// Den som läser upp sitt personnummer säger "nittonåttioåtta noll sex
/// fjorton trettiotre sjuttiotvå". Whisper skriver det som "1988 06 14 33 72"
/// eller "1988-06-14-33-72" beroende på dagsform, och mönstren letar efter
/// tolv siffror i följd. Numret gick rakt igenom grinden i första provet.
///
/// Regeln fogar bara ihop det som blir ett personnummer: tio eller tolv
/// siffror som börjar med en födelsedag. Första försöket krävde bara rätt
/// antal siffror, och gjorde då "070 174 06 90" till ett personnummer och
/// "2019 2020 2021" till ett annat.
export function fogaSiffror(text) {
  return String(text).replace(/\b\d{2,4}(?:[ .\-]\d{2,4}){2,5}\b/g, traff => {
    const rena = traff.replace(/[ .\-]/g, '');
    if (rena.length !== 10 && rena.length !== 12) return traff;
    if (!arFodelsedag(rena.slice(-10))) return traff;
    return rena.length === 12 ? `${rena.slice(0, 8)}-${rena.slice(8)}` : `${rena.slice(0, 6)}-${rena.slice(6)}`;
  });
}

/// Ljudfil till text.
///
/// Whisper, inte macOS Speech. Apples lokala igenkänning talar svenska och
/// kan tvingas stanna på enheten, men den svarade "Siri and Dictation are
/// disabled" — den kräver att diktering är påslagen i systeminställningarna.
/// En produkt som ska till en kommun kan inte hänga på en systemväxel som
/// IT-avdelningen kanske stängt av. Whisper bär sin egen modell och bryr sig
/// inte om vad macOS tycker.
/// Whisper, rad för rad medan den arbetar.
///
/// `execFile` väntar på att processen ska dö och lämnar över hela utdata på
/// en gång. whisper-cli skriver varje segment så fort det är klart — vi
/// slängde alltså bort ett förlopp som redan fanns, och den som lämnat in en
/// timmes inspelning fick se ordet "lyssnar" i tjugo minuter utan att veta
/// om något hände.
///
/// Raderna kommer som `[00:00:00.000 --> 00:00:05.000]  text`. Varje
/// färdig rad går vidare direkt; `stdout` sparas ändå, för reservvägen när
/// ingen rad matchar formen.
function lyssna(whisper, argument, { signal, pa }) {
  return new Promise((los, fel) => {
    const b = spawn(whisper, argument, { signal });
    let ut = '';
    let svans = '';
    let felut = '';
    b.stdout.setEncoding('utf8');
    b.stdout.on('data', bit => {
      ut += bit;
      svans += bit;
      // Bara hela rader. En halv rad är en halv mening, och den som läser
      // ska inte se texten rycka tillbaka när resten kommer.
      const rader = svans.split('\n');
      svans = rader.pop() ?? '';
      for (const rad of rader) {
        const m = TIDRAD.exec(rad.trim());
        if (m?.[4].trim()) pa?.(stampla(m));
      }
    });
    b.stderr.setEncoding('utf8');
    b.stderr.on('data', bit => { felut = (felut + bit).slice(-4000); });
    b.on('error', fel);
    b.on('close', kod => {
      const m = TIDRAD.exec(svans.trim());
      if (m?.[4].trim()) pa?.(stampla(m));
      if (kod === 0) los({ stdout: ut });
      else fel(new Error(felut.trim().split('\n').pop() || `whisper slutade med ${kod}`));
    });
  });
}

const TIDRAD = /^\[(\d\d):(\d\d):(\d\d)[.\d]*\s*-->[^\]]*\]\s*(.*)$/;
const stampla = m => `[${Number(m[1]) ? `${m[1]}:` : ''}${m[2]}:${m[3]}] ${m[4].trim()}`;

// Språket är appens (slutgenomgången 2026-10-09): här stod 'sv' fast, och
// whisper skrev av ett engelskt möte som om det vore svenska.
export async function transkribera(namn, data, { sprak = aktuellt(), signal, pa } = {}) {
  const slut = extname(namn).toLowerCase();
  if (!LJUD.includes(slut)) throw new Error(tx('lib.dokument.transkriberarInte', { slut: slut || tx('lib.dokument.utanAndelse') }));
  if (!(await orat()).finns) throw new Error(tx('lib.dokument.oratSaknas'));
  if (data.length > 500 * 1024 * 1024) throw new Error(tx('lib.dokument.ljudForStort'));

  const ra = join(tmpdir(), `maximus-${randomUUID()}${slut}`);
  const wav = join(tmpdir(), `maximus-${randomUUID()}.wav`);
  await writeFile(ra, data, { mode: 0o600 });
  try {
    // Whisper vill ha 16 kHz mono. ffmpeg överallt, afconvert på Mac som reserv.
    const konv = await tillWav(ra, wav);
    await kor(konv.fil, konv.argument, { timeout: 300000 })
      .catch(() => { throw new Error(tx('lib.dokument.ljudLasesInte')); });

    const whisper = await hitta('whisper-cli');
    if (!whisper) throw new Error(tx('lib.dokument.whisperSaknas'));
    const rader = [];
    // Det öra som faktiskt ligger på disken — se modellfilen(). En hämtad
    // modell ska användas även om valet pekar på en som inte hämtats.
    const oratsFil = await modellfilen();
    const { stdout } = await lyssna(whisper, ['-m', oratsFil, '-l', sprak, '-f', wav, '-np'],
      { signal, pa: rad => { rader.push(rad); pa?.(rad, rader.length); } });

    const text = fogaSiffror(rader.join('\n') || stdout.trim());
    if (!text.trim()) throw Object.assign(new Error(tx('lib.dokument.ingetTal')), { kod: 'inget-tal' });
    return { namn: basename(namn), sort: tx('lib.dokument.hur.ljud'), tecken: text.length, text };
  } finally {
    await unlink(ra).catch(() => {});
    await unlink(wav).catch(() => {});
  }
}
