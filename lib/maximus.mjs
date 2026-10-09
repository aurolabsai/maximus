// Maximus: lås, upplåsning, och läsning och skrivning av krypterade filer.
//
// Allt som rör användarens innehåll går genom den här filen. Resten av
// kodbasen ska aldrig behöva veta om något är krypterat — den ber om en
// session och får en session.
//
// Tillståndet är avsiktligt enkelt: antingen är Maximus upplåst och
// huvudnyckeln finns i minnet, eller så är det låst och ingenting läses. Det
// finns ingen halvöppen väg, eftersom en halvöppen väg är den som läcker.

import { readFile, writeFile, mkdir, readdir, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import {
  forsegla, oppna, arForseglad, nyttSalt, nyckelUrLosenord,
  sessionsnyckel, kontrollvarde, stammerKontroll, oppnaRa } from './krypto.mjs';
import { tx } from './sprakstod.mjs';

const kor = promisify(execFile);

/// "Maximus är låst." på språket som gäller, med en kod som inte beror på
/// språket: `e.kod === 'last'`.
const last = () => Object.assign(new Error(tx('maximus.last')), { kod: 'last' });

/// Sant när felet är en förseglad session som saknar sin kod. Servern
/// läste förut feltexten (/kräver sin kod/); texten följer nu språket, så
/// koden avgör — och texten på båda språken, för fel som korsat en gräns.
export const arForsegladUtanKod = e => e?.kod === 'forseglad' || /kräver sin kod|requires its code/.test(String(e?.message || ''));

/// Nyckelringsposten binds till datakatalogen.
///
/// Med ett fast tjänstnamn skrev varje enhetsprov sin slumpnyckel till samma
/// post som den riktiga installationen, och "kom ihåg" slutade fungera utan
/// att något syntes. Sett skarpt 2026-09-20 — proven kör i en temp-katalog
/// och ska aldrig kunna röra det som ligger i hemkatalogen.
const tjanst = dataDir =>
  `ai.aurolabs.maximus3.${createHash('sha256').update(String(dataDir)).digest('hex').slice(0, 12)}`;

/// Låsfilen. Den innehåller salt och kontrollvärde — aldrig lösenordet, och
/// aldrig nyckeln. Den som får tag på den kan pröva lösenord offline, men det
/// kan hen ändå mot vilken krypterad session som helst.
const LASFIL = 'las.json';

/// Vad som får ligga UTANFÖR en förseglings inre kuvert. Se skrivSession().
const UTANFOR_FORSEGLING = new Set([
  'id', 'las', 'agare', 'skapad', 'andrad',
  'arkiverad', 'fast', 'projekt', 'lage', 'webb', 'titel', 'dopt',
  // Destinationen och behandlingen visas i listan, precis som läget de
  // ersätter. Utan dem här kan listan inte säga vart en session skickar.
  'destination', 'behandling',
]);

export class Maximus {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.tjanst = tjanst(dataDir);
    this.huvudnyckel = null;
    this.las = null;
    this.skrivningar = new Map();
    // Låsets generation (2026-10-06). Varje låsning räknar upp den, och en
    // upplåsning som började före den senaste låsningen får inte öppna:
    // nyckeln tar ~300 ms att härleda, och en låsning under tiden blev annars
    // ogjord när upplåsningen blev klar (sett i test/vilan.mjs).
    this.generation = 0;
  }

  /// Sätter nyckeln bara om ingen låsning hunnit emellan.
  #oppna(nyckel, gen) {
    if (gen !== this.generation) { const e = new Error(tx('maximus.lastesUnderTiden')); e.lastesUnderTiden = true; throw e; }
    this.huvudnyckel = nyckel;
  }

  async ladda() {
    try { this.las = JSON.parse(await readFile(join(this.dataDir, LASFIL), 'utf8')); }
    catch { this.las = null; }
    return this.las;
  }

  get skyddat() { return Boolean(this.las?.kontroll); }
  get upplast() { return Boolean(this.huvudnyckel); }

  /// Sätter ett lösenord första gången.
  ///
  /// Lösenordet lagras inte. Det som sparas är saltet och ett kontrollvärde,
  /// så att en felskrivning kan avvisas utan att någon fil behöver öppnas.
  /// `kommIhag` är sant som förval, och det är ett produktbeslut.
  ///
  /// Med den av betyder ett glömt lösenord att allt är borta. Köparen är en
  /// handläggare som sätter ett lösenord i mars och öppnar appen i maj — för
  /// hen är dataförlust ett troligare och värre utfall än en riktad angripare.
  /// Den som vill ha det strängare stänger av växeln i inställningarna.
  async satLosenord(losenord, { kommIhag = true } = {}) {
    if (typeof losenord !== 'string' || losenord.length < 8) throw new Error(tx('maximus.losenordKort'));
    const salt = nyttSalt();
    const nyckel = await nyckelUrLosenord(losenord, salt);
    this.huvudnyckel = nyckel;
    this.las = { v: 1, salt: salt.toString('base64'), kontroll: kontrollvarde(nyckel).toString('base64'), skapad: new Date().toISOString() };
    await writeFile(join(this.dataDir, LASFIL), JSON.stringify(this.las, null, 1), { mode: 0o600 });
    if (kommIhag) await this.sparaINyckelring().catch(() => {});
    return true;
  }

  async lasUpp(losenord) {
    const gen = this.generation;
    if (!this.las) await this.ladda();
    if (!this.skyddat) return true;
    const nyckel = await nyckelUrLosenord(losenord, Buffer.from(this.las.salt, 'base64'));
    if (!stammerKontroll(nyckel, this.las.kontroll)) throw new Error(tx('maximus.felLosenord'));
    this.#oppna(nyckel, gen);
    return true;
  }

  /// Tar emot en huvudnyckel som någon annan väg öppnat — locket, till exempel.
  ///
  /// Kontrollvärdet prövas ändå. Den som räcker fram en nyckel får inte
  /// avgöra om den är rätt; det avgör Maximus, mot det som stod i låsfilen
  /// innan. Annars vore varje ny väg in också en väg att installera fel
  /// nyckel och få allt att se trasigt ut.
  async lasUppMedNyckel(nyckel) {
    const gen = this.generation;
    if (!this.las) await this.ladda();
    if (!Buffer.isBuffer(nyckel) || nyckel.length !== 32) throw new Error(tx('maximus.ogiltigNyckel'));
    if (this.skyddat && !stammerKontroll(nyckel, this.las.kontroll)) throw new Error(tx('maximus.nyckelFel'));
    this.#oppna(nyckel, gen);
    return true;
  }

  las_() { this.huvudnyckel = null; this.generation++; }

  /// Nyckelringen, som bekvämlighet och inget annat.
  ///
  /// Provat 2026-09-20: en osignerad nodprocess läser och skriver
  /// login-nyckelringen utan prompt — och så gör vilken annan process som
  /// helst som kör som samma användare. Den skyddar alltså mot en kopierad
  /// datamapp och en läckt backup, inte mot något som kör här.
  ///
  /// Den är ändå på som förval — se `satLosenord` för varför — och
  /// gränssnittet säger vad den gör och vad den inte gör.
  async sparaINyckelring() {
    if (!this.huvudnyckel) throw last();
    // Genom stdin till `security -i`, inte som argument (2026-10-09,
    // granskningen): argv syns i `ps` för varje användare på datorn, och
    // huvudnyckeln i base64 stod där varje gång någon låste upp med "kom
    // ihåg". Samma väg som molnnyckeln i lib/moln.mjs. Base64 och tjänst-
    // namnet innehåller inga tecken som `security -i` delar på, men det
    // prövas ändå, så att ingen rad kan bli två kommandon.
    const b64 = this.huvudnyckel.toString('base64');
    if (!/^[A-Za-z0-9+/=]+$/.test(b64) || !/^[\w.-]+$/.test(this.tjanst)) throw new Error(tx('maximus.nyckelring'));
    await new Promise((klar, fel) => {
      const p = spawn('/usr/bin/security', ['-i'], { stdio: ['pipe', 'ignore', 'pipe'] });
      let err = '';
      p.stderr.on('data', d => { err += d; });
      p.on('error', fel);
      p.on('close', kod => (kod === 0 && !/error/i.test(err) ? klar() : fel(new Error(tx('maximus.nyckelring')))));
      p.stdin.end(`add-generic-password -U -a huvudnyckel -s ${this.tjanst} -w ${b64}\n`);
    });
    return true;
  }

  async lasUppUrNyckelring() {
    const gen = this.generation;
    if (!this.las) await this.ladda();
    if (!this.skyddat) return false;
    try {
      const { stdout } = await kor('/usr/bin/security', ['find-generic-password', '-a', 'huvudnyckel', '-s', this.tjanst, '-w']);
      const nyckel = Buffer.from(stdout.trim(), 'base64');
      if (nyckel.length !== 32 || !stammerKontroll(nyckel, this.las.kontroll)) return false;
      if (gen !== this.generation) return false;
      this.huvudnyckel = nyckel;
      return true;
    } catch { return false; }
  }

  async glomINyckelring() {
    await kor('/usr/bin/security', ['delete-generic-password', '-a', 'huvudnyckel', '-s', this.tjanst]).catch(() => {});
  }

  async minnsINyckelring() {
    try { await kor('/usr/bin/security', ['find-generic-password', '-a', 'huvudnyckel', '-s', this.tjanst]); return true; }
    catch { return false; }
  }

  // ── Filer ───────────────────────────────────────────────────────────────

  /// Läser en fil, krypterad eller inte.
  ///
  /// Att acceptera båda är inte slarv utan migrering: en användare som slår på
  /// lösenord ska inte förlora det hen redan skrivit. Oskyddade filer skrivs
  /// om krypterade nästa gång de sparas.
  async lasFil(vag) {
    const ra = await readFile(vag);
    if (!arForseglad(ra)) return ra.toString('utf8');
    if (!this.huvudnyckel) throw last();
    return oppna(ra, this.huvudnyckel);
  }

  /// Binärt innehåll, krypterat som allt annat.
  ///
  /// `lasFil` svarar med utf8 och duger för json och text. En docx är bytes,
  /// och vägen genom en sträng förstör dem — se oppnaRa i lib/krypto.mjs.
  async lasRa(vag) {
    const ra = await readFile(vag);
    if (!arForseglad(ra)) return ra;
    if (!this.huvudnyckel) throw last();
    return oppnaRa(ra, this.huvudnyckel);
  }

  async skrivFil(vag, text, { nyckel } = {}) {
    const k = nyckel || this.huvudnyckel;
    if (this.skyddat && !k) throw last();
    const data = k ? forsegla(text, k) : Buffer.from(text, 'utf8');
    const skriv = (this.skrivningar.get(vag) || Promise.resolve()).catch(() => {}).then(async () => {
      const tmp = `${vag}.${randomUUID()}.tmp`;
      try { await writeFile(tmp, data, { mode: 0o600 }); await rename(tmp, vag); }
      finally { await unlink(tmp).catch(() => {}); }
    });
    this.skrivningar.set(vag, skriv);
    try { await skriv; }
    finally { if (this.skrivningar.get(vag) === skriv) this.skrivningar.delete(vag); }
  }

  /// Läs, ändra och skriv — som EN odelbar sak.
  ///
  /// `skrivFil` serialiserar skrivningar per fil, men läsningen låg utanför
  /// kedjan. Alla som ville lägga till en rad läste alltså samma fil, la till
  /// var sin rad i var sin kopia, och skrev över varandra. Sist vann.
  ///
  /// Revisionen mätte det 2026-09-28 på liggaren: tolv samtidiga anrop mot en
  /// tom dagsfil gav EN bestående rad, inte tolv. Elva utgående sändningar
  /// fanns inte i boken över utgående sändningar.
  ///
  /// `andra` får det som står i filen och ger tillbaka det som ska stå där.
  /// Hela varvet ligger i samma kedja som skrivningen, så nästa anropare
  /// läser det föregående faktiskt skrev.
  async andraFil(vag, andra, { forval = null } = {}) {
    const led = (this.skrivningar.get(vag) || Promise.resolve()).catch(() => {}).then(async () => {
      let nu = forval;
      // ── Saknad fil och skadad fil är inte samma sak ──────────────────
      //
      // Här stod `catch { /* finns inte än */ }`. Varje läsfel — en trasig
      // JSON, ett kuvert som inte gick att öppna, en halvskriven fil — såg
      // därför ut som en fil som ännu inte fanns, och nästa skrivning la en
      // ny giltig fil ovanpå. Skadan läkte sig själv, och beviset på att
      // något hänt försvann.
      //
      // Revisionen 2026-09-29 (M4) såg precis det: en oläsbar dagsfil
      // rapporterades som lucka, och efter en skrivning var luckan borta.
      // För en liggare är det den värsta sortens fel: den som ska kunna
      // säga "de här dagarna går inte att läsa" sa i stället ingenting.
      //
      // ENOENT betyder att filen inte finns. Allt annat betyder att den
      // finns och är skadad — och då läggs den undan med sitt datum i
      // namnet innan en ny börjar. Loggningen kan fortsätta, och beviset
      // står kvar bredvid.
      try {
        nu = JSON.parse(await this.lasFil(vag));
      } catch (e) {
        if (e?.code !== 'ENOENT') {
          // Tid plus ett slumpat suffix: två skador i samma millisekund skrev
          // annars över varandra (test/skadad.test.mjs, flaxigt 2026-10-06).
          const undan = `${vag}.skadad-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 6)}`;
          try {
            await rename(vag, undan);
            console.error(`skadad fil lades undan: ${undan} (${e.message})`);
          } catch (r) {
            // Gick inte ens det ska vi inte skriva över. Hellre ett fel som
            // syns än en tyst överskrivning av något vi inte kunde läsa.
            if (r?.code !== 'ENOENT') throw e;
          }
        }
        nu = forval;
      }
      const nytt = await andra(nu);
      if (nytt === undefined) return;

      // Skrivningen görs här inne och inte via skrivFil — den hade ställt sig
      // i samma kö bakom oss själva och låst.
      const k = this.huvudnyckel;
      if (this.skyddat && !k) throw last();
      const text = JSON.stringify(nytt);
      const data = k ? forsegla(text, k) : Buffer.from(text, 'utf8');
      const tmp = `${vag}.${randomUUID()}.tmp`;
      try { await writeFile(tmp, data, { mode: 0o600 }); await rename(tmp, vag); }
      finally { await unlink(tmp).catch(() => {}); }
    });
    this.skrivningar.set(vag, led);
    try { return await led; }
    finally { if (this.skrivningar.get(vag) === led) this.skrivningar.delete(vag); }
  }

  /// Sessionsnyckel för en förseglad session.
  ///
  /// `Låst` använder huvudnyckeln — koden är en grind i gränssnittet och en
  /// glömd kod kostar ingenting. `Förseglad` härleder nyckeln ur huvudnyckel
  /// och kod, och då finns ingen väg in utan koden.
  async nyckelFor(session, kod) {
    if (!this.huvudnyckel) throw last();
    if (session?.las?.styrka !== 'forseglad') return this.huvudnyckel;
    if (!kod) throw Object.assign(new Error(tx('maximus.forseglad')), { kod: 'forseglad' });
    return sessionsnyckel(this.huvudnyckel, kod, Buffer.from(session.las.salt, 'base64'));
  }

  /// Kontrollvärde för en sessionskod.
  ///
  /// Härleds ur huvudnyckeln och koden tillsammans, precis som sessionsnyckeln.
  /// Den som har filen men inte huvudnyckeln kan alltså inte pröva koder mot
  /// kontrollvärdet heller — annars hade en låst session varit knäckt på en
  /// sekund av den som kopierade mappen.
  async kodkontroll(kod, salt) {
    const n = await sessionsnyckel(this.huvudnyckel, kod, salt);
    return kontrollvarde(n).toString('base64');
  }

  async stammerKod(las, kod) {
    if (!las?.kontroll) return true;
    try { return (await this.kodkontroll(kod, Buffer.from(las.salt, 'base64'))) === las.kontroll; }
    catch { return false; }
  }

  /// Läser en session. Rubriken kommer alltid; innehållet bara med rätt kod.
  ///
  /// Rubriken ligger i ett kuvert som huvudnyckeln öppnar, innehållet i ett
  /// eget kuvert inuti. Annars hade "Om min sjukskrivning" stått i klartext
  /// bredvid en förseglad session, och titeln är också innehåll.
  async lasSession(vag, kod = null) {
    const yttre = JSON.parse(await this.lasFil(vag));
    if (!yttre.kropp) return yttre;
    const nyckel = await this.nyckelFor(yttre, kod);
    const inre = JSON.parse(oppna(Buffer.from(yttre.kropp, 'base64'), nyckel));
    const { kropp, ...huvud } = yttre;
    return { ...huvud, ...inre };
  }

/// Vad som får ligga UTANFÖR en förseglings inre kuvert.
///
/// En tillåtenlista och inte en undantagslista, och det är hela poängen.
///
/// Här stod `const { turer, sammandrag, ...huvud } = session` — allt utom två
/// fält hamnade utanför. Det betyder att varje fält som någonsin lagts till en
/// session automatiskt blivit oskyddat, utan att någon behövt bestämma det.
/// Så hamnade `karta` där: kopplingen från [NAMN A] tillbaka till den
/// verkliga personen, alltså det enskilt känsligaste MAXIMUS håller, läsbar för
/// den som har huvudnyckeln men inte sessionens kod. Med den upphävs
/// maskeringen för allt som någonsin skickats i sessionen.
///
/// Bilagornas originaltext och bilder låg där av samma skäl, och `ursprung`
/// med avsändarens adress.
///
/// Nu måste ett fält pekas ut för att slippa skyddet. Ett nytt fält är skyddat
/// tills någon aktivt beslutar annat — det är skillnaden mellan att glömma
/// och att bestämma.
///
/// Titeln står kvar utanför med avsikt: listan måste kunna visa något innan
/// koden är given, och filen som helhet är redan krypterad med huvudnyckeln.
/// Det är ett medvetet val, inte ett glömt fält.
  /// Skriver en session. Förseglade får ALLT innehåll i ett eget kuvert.
  async skrivSession(vag, session, kod = null) {
    if (session?.las?.styrka !== 'forseglad') return this.skrivFil(vag, JSON.stringify(session));
    const nyckel = await this.nyckelFor(session, kod);
    const huvud = {};
    const inre = {};
    for (const [k, v] of Object.entries(session)) {
      if (UTANFOR_FORSEGLING.has(k)) huvud[k] = v; else inre[k] = v;
    }
    const kropp = forsegla(JSON.stringify(inre), nyckel).toString('base64');
    return this.skrivFil(vag, JSON.stringify({ ...huvud, kropp }));
  }

  /// Ett kuvert, för det som ska ligga i sin egen försegling inne i en fil
  /// som redan är krypterad. Liggarens rader använder det: raden syns, men
  /// innehållet kräver sessionens kod.
  forsegla(text, nyckel) { return forsegla(String(text), nyckel).toString('base64'); }

  /// Öppnar ett sådant kuvert. Fel nyckel kastar — det är meningen.
  oppnaKuvert(b64, nyckel) { return oppna(Buffer.from(String(b64), 'base64'), nyckel); }

  /// Krypterar om allt som ligger oskyddat. Körs en gång, vid första
  /// upplåsningen efter att ett lösenord satts.
  /// Krypterar det som låg i klartext innan lösenordet sattes.
  ///
  /// Gick förut genom fyra utpekade kataloger plus installningar.json. En
  /// lista över vad som ska skyddas blir omodern i samma stund någon lägger
  /// till en fil, och det hade hunnit hända fem gånger: projekt.json,
  /// bevakning.json, frister.json, register.json och hjalpfragor.json låg
  /// kvar som läsbar JSON efter en körd migrering. Liggarens dagsfiler också,
  /// och sessionskataloger på andra ställen än den vanliga.
  ///
  /// Nu går den genom ALLT och hoppar över det som uttryckligen ska stå i
  /// klartext. Samma vändning som förseglingens tillåtenlista: en ny fil är
  /// skyddad tills någon aktivt beslutar annat.
  ///
  /// Samma form som felet i sessionsraderingen och i städningen av tomma
  /// sessioner — en lista byggd för hand vid sidan av den riktiga strukturen.
  async migrera() {
    if (!this.huvudnyckel) throw last();
    let gjorda = 0;

    const gaIgenom = async bas => {
      for (const post of await readdir(bas, { withFileTypes: true }).catch(() => [])) {
        // Låsfilen krypteras aldrig. Den bär saltet och kontrollvärdet man
        // BEHÖVER för att härleda nyckeln — att kryptera den med nyckeln vore
        // att låsa in nyckeln i sitt eget skåp.
        if (post.name === LASFIL || KRYPTERAS_INTE.includes(post.name)) continue;
        const vag = join(bas, post.name);
        if (post.isDirectory()) { await gaIgenom(vag); continue; }
        if (!post.isFile() || !post.name.endsWith('.json')) continue;
        const ra = await readFile(vag).catch(() => null);
        if (!ra || arForseglad(ra)) continue;
        await this.skrivFil(vag, ra.toString('utf8'));
        gjorda++;
      }
    };

    await gaIgenom(this.dataDir);
    return gjorda;
  }
}

/// Lagtexterna krypteras inte, och det är ett beslut.
///
/// Det är offentlig författning från riksdagen, identisk på varje maskin som
/// hämtat den. Att kryptera den kostar arbete vid varje uppslag utan att dölja
/// något — den som läser filen får veta vad som står i svensk lag.
export const KRYPTERAS_INTE = ['lagar', 'models', 'searxng', 'tmp'];
