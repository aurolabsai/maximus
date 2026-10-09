// MAXIMUS på skrivbordet: ett fönster och servern under det.
//
// Appen startar MAXIMUS:s egen server som barnprocess och visar den. Svarar
// porten redan — en utvecklingsserver, eller en app som redan är igång —
// startas ingen andra: två servrar skulle betyda två modeller i minnet och
// två liggare över samma arbete.
//
// Fönstret släpper bara igenom sin egen server. Allt annat som försöker
// navigera öppnas i systemets webbläsare, där användaren ser var hen hamnar.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use std::{fs, io::{Read, Write}, net::{SocketAddr, TcpStream}, path::PathBuf, process::{Command, Stdio}, time::{Duration, Instant}};
use sha2::{Digest, Sha256};
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

/// Vad avslutet behöver veta, lagt undan när vi vet det.
///
/// `stang_servern()` körs efter att allt annat rivits och kan inte nå
/// setup-funktionens variabler. Miljövariabler vore en väg, men de sätts på
/// BARNET och inte på oss — och nyckeln är dessutom en annan när vi
/// återanvänt en server som redan svarade: då kommer den ur nyckelfilen.
/// En statisk som skrivs en gång är det ärliga: ett värde, satt där det är
/// känt, läst där det behövs.
static AVSLUT: std::sync::OnceLock<(String, String)> = std::sync::OnceLock::new();

/// Datakatalogen, och om servern är vår egen (startad av oss) eller en vi
/// anslöt till. En server som kör i bakgrunden (Fas 26, filen `bakgrund` i
/// katalogen) och som vi bara anslöt till ska få leva vidare när fönstret
/// stängs — det är hela poängen med läget.
static SERVERN: std::sync::OnceLock<(PathBuf, bool)> = std::sync::OnceLock::new();

fn main() {
    tauri::Builder::default()
        // Delningsmenyn. Fönstret anropar den bara för filer servern lagt
        // i sin delningsmapp — se /api/sessioner/:id/dela i server.mjs.
        .plugin(tauri_plugin_sharekit::init())
        // Uppdateringar. Inget installeras utan användarens ja, och bara en
        // version vars signatur stämmer mot den publika nyckeln i
        // konfigurationen — se lib/uppdatering.mjs och scripts/slapp.mjs.
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        // Notiser i Maximus eget namn (2026-10-06). Servern visade dem med
        // osascript, och då stod de som Skriptredigerare och ett klick öppnade
        // den. Se capabilities/notis.json.
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let port = std::env::var("MAXIMUS_PORT").unwrap_or_else(|_| "3261".into());
            let portnummer: u16 = port.parse()?;
            let adress: SocketAddr = format!("127.0.0.1:{port}").parse()?;
            let ursprung = format!("http://127.0.0.1:{port}");

            // Nyckeln som skiljer MAXIMUS:s fönster från allt annat på datorn.
            //
            // Servern lyssnar på loopback, och en port på loopback är öppen
            // för varje process användaren kör. Skalet slumpar en nyckel,
            // ger den till servern i miljön, och öppnar fönstret med den i
            // adressen — servern byter den mot en kaka och städar bort den
            // ur adressen direkt.
            // Datakatalogen behövs innan servern startas, för nyckelfilen
            // ligger där.
            let hem_tidigt = std::env::var("HOME")
                .or_else(|_| std::env::var("USERPROFILE"))
                .unwrap_or_default();
            let datakatalog = std::env::var("MAXIMUS_DATA").map(PathBuf::from).unwrap_or_else(|_| {
                if cfg!(target_os = "windows") {
                    std::env::var("APPDATA").map(PathBuf::from)
                        .unwrap_or_else(|_| PathBuf::from(&hem_tidigt).join("AppData/Roaming"))
                        .join("Maximus")
                } else {
                    PathBuf::from(&hem_tidigt).join("Library/Application Support/Maximus")
                }
            });

            // Nyckeln slumpas av operativsystemet, och går det inte startar
            // appen inte (granskningen 2026-10-09). /dev/urandom fanns inte på
            // Windows, och reserven — nanosekunder sedan 1970 — gav runt 2^23
            // möjliga nycklar: minuter att gissa över loopback.
            let nyckel: String = match slumpa_hex(32) {
                Ok(n) => n,
                Err(e) => stoppa_med_fel("Maximus kunde inte starta",
                    &format!("Operativsystemet gav ingen slumpkälla för nyckeln ({e}).")),
            };

            // Svarar någon redan på porten är det en MAXIMUS som redan kör — en
            // andra app-ikon, eller en server startad från terminalen. Då ska
            // skalet inte starta en till OCH inte hitta på en egen nyckel: den
            // servern har sin, och den ligger i nyckelfilen.
            //
            // Utan det här mötte appen sin egen användare med {"error":"Fel
            // nyckel."} vid start, vilket är både obegripligt och fult.
            let redan_uppe = TcpStream::connect_timeout(&adress, Duration::from_millis(300)).is_ok();
            let nyckel = if redan_uppe {
                fs::read_to_string(datakatalog.join("nyckel"))
                    .map(|s| s.trim().to_string())
                    .unwrap_or(nyckel)
            } else { nyckel };
            // Svarar porten redan måste den som svarar bevisa att den är
            // Maximus INNAN den får nyckeln (granskningen 2026-10-09). Porten
            // på loopback är öppen för alla användare på datorn: den som band
            // den först fick förut nyckeln i adressen och det betrodda
            // fönstret.
            if redan_uppe {
                if let Err(e) = vanta_pa_identitet(&adress, &port, &nyckel, Duration::from_secs(5)) {
                    stoppa_med_fel(&format!("Port {port} är upptagen av något annat"), &e);
                }
            }
            // Porten och nyckeln som avslutet ska använda. Satt här, för här
            // är de kända — också när servern återanvändes.
            let _ = AVSLUT.set((port.clone(), nyckel.clone()));
            let _ = SERVERN.set((datakatalog.clone(), !redan_uppe));
            // Startad vid inloggning med fönstret dolt (Fas 26): agenten kör,
            // och fönstret visas när du klickar på ikonen i Dock.
            let dold = std::env::args().any(|a| a == "--dold");

            if !redan_uppe {
                let resurser = app.path().resource_dir()?;
                let hem = hem_tidigt.clone();
                let data = datakatalog.clone();
                fs::create_dir_all(&data)?;
                let logg = fs::OpenOptions::new().create(true).append(true).open(data.join("server.log"))?;

                // llama-server följer med i appen, men whisper, schemaläggaren och
                // frontier-klienterna ligger där de ligger. En app startad
                // från Finder eller Utforskaren ärver inte skalets PATH, och
                // utan den hittar MAXIMUS ingenting.
                let stig = if cfg!(target_os = "windows") {
                    std::env::var("PATH").unwrap_or_default()
                } else {
                    format!("{hem}/.local/bin:{hem}/.cargo/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin")
                };
                let node = resurser.join(if cfg!(target_os = "windows") {
                    "resources/node.exe"
                } else {
                    "resources/node"
                });
                let server = resurser.join("resources/backend");
                let barn = Command::new(node)
                    .arg(server.join("server.mjs"))
                    .arg("--tyst")
                    .current_dir(&server)
                    .env("PATH", stig)
                    // Appens egna binärer — llama-server och dess bibliotek.
                    // Utan den här letar servern i /opt/homebrew/bin och
                    // hittar ingenting på en dator utan Homebrew.
                    .env("MAXIMUS_RESURSER", resurser.join("resources"))
                    .env("MAXIMUS_NYCKEL", &nyckel)
                    // Vem servern ska vakta. Dör appen utan att hinna säga
                    // till — Tvinga avsluta, krasch — går servern ner ändå.
                    .env("MAXIMUS_FORALDER", std::process::id().to_string())
                    .env("MAXIMUS_PORT", &port)
                    .env("MAXIMUS_DATA", &data)
                    // Var appen ligger, för läget "öppna Maximus när datorn
                    // startar" — servern skriver inloggningsjobbet.
                    .env("MAXIMUS_APP", std::env::current_exe().map(|p| p.display().to_string()).unwrap_or_default())
                    .stdin(Stdio::null())
                    .stdout(logg.try_clone()?)
                    .stderr(logg)
                    .spawn()?;
                // Pid-filen skrivs av servern själv, inte här.
                //
                // Den skrevs en gång vid starten och rördes aldrig igen, så
                // den uppdaterades inte när servern byttes — av omstart.sh,
                // eller av en app som återanvände en server som redan
                // svarade. Mätt 2026-10-01: filen sa 40394, den som faktiskt
                // lyssnade var 48982, och 40394 fanns inte längre. Ett
                // pid-nummer återanvänds; en städrutin som litat på filen
                // hade dödat fel process.
                drop(barn);

                // En kall start läser in modellen; fönstret får vänta tills
                // servern svarar, hellre än att visa ett fel som inte är ett.
                //
                // Och den som svarar ska vara VÅR server (granskningen
                // 2026-10-09): hann något annat binda porten mellan vår
                // kontroll och serverns start får det inte nyckeln.
                if let Err(e) = vanta_pa_identitet(&adress, &port, &nyckel, Duration::from_secs(60)) {
                    stoppa_med_fel("Maximus kunde inte starta", &format!(
                        "{e} Loggen ligger i {}.", data.join("server.log").display()));
                }
            }

            let start = format!("{ursprung}/?n={nyckel}");
            // Fönstret stannar på loopback; allt annat öppnas i webbläsaren.
            WebviewWindowBuilder::new(app, "main", WebviewUrl::External(start.parse()?))
                .title("Maximus")
                .inner_size(1280., 900.)
                .visible(!dold)
                .min_inner_size(760., 600.)
                .on_navigation(move |url| {
                    let egen = url.scheme() == "http"
                        && url.host_str() == Some("127.0.0.1")
                        && url.port() == Some(portnummer);
                    // mailto lämnas till systemet, som öppnar e-postprogrammet
                    // med ett utkast. Den stoppades tyst förut: "Mejla Henrik"
                    // och "Öppna som utkast i Mail" gjorde ingenting i appen
                    // (2026-10-04). Maximus skickar fortfarande ingenting —
                    // utkastet står i Mail tills du trycker skicka.
                    if !egen && ["https", "http", "mailto"].contains(&url.scheme()) {
                        oppna_utanfor(url.as_str());
                    }
                    egen
                })
                .on_new_window(|url, _| {
                    if ["https", "http"].contains(&url.scheme()) {
                        oppna_utanfor(url.as_str());
                    }
                    tauri::webview::NewWindowResponse::Deny
                })
                .on_download(move |_, handelse| {
                    match handelse {
                        tauri::webview::DownloadEvent::Requested { url, destination } => {
                            if url.host_str() != Some("127.0.0.1") || url.port() != Some(portnummer) { return false; }
                            // Liggarens export är det enda som laddas ned.
                            let ext = match url.path().rsplit('.').next() {
                                Some("csv") => "csv", Some("json") => "json", Some("txt") => "txt",
                                Some("pdf") => "pdf",
                                _ => return false,
                            };
                            let hem = PathBuf::from(std::env::var("HOME").unwrap_or_default());
                            let ned = hem.join("Downloads");
                            if fs::create_dir_all(&ned).is_err() { return false; }
                            let stampel = std::time::SystemTime::now()
                                .duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis();
                            *destination = ned.join(format!("maximus-liggare-{stampel}.{ext}"));
                        }
                        tauri::webview::DownloadEvent::Finished { path, success, .. } => {
                            if success {
                                if let Some(path) = path {
                                    #[cfg(target_os = "macos")]
                                    { let _ = Command::new("/usr/bin/open").arg("-R").arg(path).spawn(); }
                                    #[cfg(not(target_os = "macos"))]
                                    { let _ = path; }
                                }
                            }
                        }
                        _ => {}
                    }
                    true
                })
                .build()?;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("Maximus kunde inte starta")
        .run(|app, handelse| match handelse {
            // Fönstret stängs = MAXIMUS stängs.
            //
            // På macOS stannar en app kvar utan fönster. Det är rimligt för
            // en textredigerare och fel för ett maximus: "verkar vara på men
            // inte öppet" är precis det tillstånd som inte ska finnas.
            tauri::RunEvent::WindowEvent { event: tauri::WindowEvent::Destroyed, .. } => {
                app.exit(0);
            }
            tauri::RunEvent::Exit => stang_servern(),
            // Klick på ikonen i Dock när fönstret är dolt: visa det.
            #[cfg(target_os = "macos")]
            tauri::RunEvent::Reopen { .. } => {
                if let Some(f) = app.get_webview_window("main") {
                    let _ = f.show();
                    let _ = f.set_focus();
                }
            }
            _ => {}
        });
}

/// Servern ner, och allt den höll med sig.
///
/// Rusts `Command::spawn()` ger en `Child` som INTE dödar sitt barn när den
/// slängs — till skillnad från de flesta andra språk. Utan den här
/// funktionen adopterades servern av init och levde vidare med huvudnyckeln
/// i minnet och tiotals gigabyte modell under ett lease.
///
/// Först ett snällt ord: `/api/stang` låser Maximus, stänger modellen och
/// avslutar sig själv. Nyckeln ska ur minnet FÖRE processen dör, inte som en
/// bieffekt av att den gör det.
///
/// Sedan en kontroll att porten faktiskt är tyst. Svarar den fortfarande får
/// vakten i servern ta över — den ser att vi är borta inom ett par sekunder.
fn stang_servern() {
    // En bakgrundsserver vi bara anslöt till lämnas igång.
    if let Some((data, egen)) = SERVERN.get() {
        if !egen && data.join("bakgrund").exists() { return; }
    }
    let (port, nyckel) = match AVSLUT.get() {
        Some(v) => v.clone(),
        // Ingen server att stänga: starten kom aldrig så långt.
        None => return,
    };
    let adress: SocketAddr = match format!("127.0.0.1:{port}").parse() {
        Ok(a) => a,
        Err(_) => return,
    };

    // Nyckeln skickas bara till den som bevisat att den redan har den
    // (granskningen 2026-10-09). Har porten bytt ägare sedan start får ingen
    // främling nyckeln i ett avskedshuvud; vår egen server ser ändå att vi
    // är borta, genom MAXIMUS_FORALDER.
    if vanta_pa_identitet(&adress, &port, &nyckel, Duration::from_secs(2)).is_err() { return; }

    // En rå HTTP-förfrågan. Att dra in en klientkrets för fjorton rader som
    // körs en gång, vid avslut, vore att betala i starttid för en bekvämlighet.
    // Host bär porten: servern svarar bara på sitt eget namn (granskningen).
    if let Ok(mut s) = TcpStream::connect_timeout(&adress, Duration::from_millis(500)) {
        let _ = s.set_write_timeout(Some(Duration::from_millis(500)));
        let _ = write!(
            s,
            "POST /api/stang HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nX-Maximus-Local: 1\r\n\
             X-Maximus-Nyckel: {nyckel}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
        );
        let _ = s.flush();
    }

    // Tyst port = servern är nere. Tre sekunder räcker: låsningen är minne,
    // inte disk.
    for _ in 0..30 {
        if TcpStream::connect_timeout(&adress, Duration::from_millis(100)).is_err() { return; }
        std::thread::sleep(Duration::from_millis(100));
    }
}

// ── Granskningen 2026-10-09: skalet litar inte på porten ──────────────────

/// `n` byte ur operativsystemets slumpkälla, som hex. Fel är fel: ingen
/// reserv ur klockan.
fn slumpa_hex(n: usize) -> Result<String, String> {
    let mut r = vec![0u8; n];
    getrandom::fill(&mut r).map_err(|e| e.to_string())?;
    Ok(hex(&r))
}

fn hex(b: &[u8]) -> String { b.iter().map(|x| format!("{x:02x}")).collect() }

fn fran_hex(s: &str) -> Option<Vec<u8>> {
    if s.len() % 2 != 0 { return None; }
    (0..s.len()).step_by(2).map(|i| u8::from_str_radix(s.get(i..i + 2)?, 16).ok()).collect()
}

/// HMAC-SHA256 (RFC 2104) ovanpå sha2, som redan fanns i låsfilen. Tjugo
/// rader här i stället för en ny krets som inte gick att hämta utan nät.
fn hmac_sha256(nyckel: &[u8], data: &[u8]) -> [u8; 32] {
    let mut k = [0u8; 64];
    if nyckel.len() > 64 {
        k[..32].copy_from_slice(&Sha256::digest(nyckel));
    } else {
        k[..nyckel.len()].copy_from_slice(nyckel);
    }
    let mut inre = Sha256::new();
    inre.update(k.map(|b| b ^ 0x36));
    inre.update(data);
    let inre = inre.finalize();
    let mut yttre = Sha256::new();
    yttre.update(k.map(|b| b ^ 0x5c));
    yttre.update(inre);
    yttre.finalize().into()
}

/// Lika i konstant tid: varje byte jämförs, oavsett var första skillnaden är.
fn lika_konstant(a: &[u8], b: &[u8]) -> bool {
    a.len() == b.len() && a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

enum Identitet { Ratt, Fel(String), Tyst }

/// Frågar den som svarar på porten om den har nyckeln, utan att skicka den.
///
/// En ny utmaning varje gång; svaret måste vara HMAC-SHA256(nyckel,
/// utmaning), räknat av servern i `/api/identitet` (lib/skydd.mjs). HTTP/1.0
/// så att svaret inte kommer i bitar (chunked).
fn fraga_identitet(adress: &SocketAddr, port: &str, nyckel: &str) -> Identitet {
    let utmaning = match slumpa_hex(32) {
        Ok(u) => u,
        Err(e) => return Identitet::Fel(format!("Ingen slumpkälla: {e}.")),
    };
    let mut s = match TcpStream::connect_timeout(adress, Duration::from_millis(500)) {
        Ok(s) => s,
        Err(_) => return Identitet::Tyst,
    };
    let _ = s.set_write_timeout(Some(Duration::from_secs(3)));
    let _ = s.set_read_timeout(Some(Duration::from_secs(5)));
    if write!(s, "GET /api/identitet?utmaning={utmaning} HTTP/1.0\r\nHost: 127.0.0.1:{port}\r\nConnection: close\r\n\r\n").is_err() {
        return Identitet::Tyst;
    }
    let mut svar = Vec::new();
    if s.take(65536).read_to_end(&mut svar).is_err() || svar.is_empty() {
        return Identitet::Fel("Den som svarar på porten gav inget svar på Maximus fråga.".into());
    }
    let svar = String::from_utf8_lossy(&svar);
    let (huvud, kropp) = svar.split_once("\r\n\r\n").unwrap_or((&svar, ""));
    let status_ok = huvud.lines().next()
        .map(|r| r.split_whitespace().nth(1) == Some("200")).unwrap_or(false);
    let bevis = serde_json::from_str::<serde_json::Value>(kropp.trim()).ok()
        .and_then(|v| v.get("svar").and_then(|x| x.as_str()).map(str::to_string))
        .and_then(|h| fran_hex(&h));
    let vantat = hmac_sha256(nyckel.as_bytes(), utmaning.as_bytes());
    match bevis {
        Some(b) if status_ok && lika_konstant(&b, &vantat) => Identitet::Ratt,
        _ => Identitet::Fel("Den som svarar på porten kunde inte visa att den är Maximus, så nyckeln \
             skickades inte dit. Avsluta programmet som använder porten — eller en äldre Maximus som \
             kör i bakgrunden — och öppna Maximus igen.".into()),
    }
}

/// Väntar tills porten svarar och den som svarar är vår server. Fel svar
/// avbryter direkt; tystnad väntas ut till tidsgränsen.
fn vanta_pa_identitet(adress: &SocketAddr, port: &str, nyckel: &str, tid: Duration) -> Result<(), String> {
    let slut = Instant::now() + tid;
    loop {
        match fraga_identitet(adress, port, nyckel) {
            Identitet::Ratt => return Ok(()),
            Identitet::Fel(e) => return Err(e),
            Identitet::Tyst if Instant::now() >= slut =>
                return Err(format!("Servern svarade inte på port {port}.")),
            Identitet::Tyst => std::thread::sleep(Duration::from_millis(200)),
        }
    }
}

/// Visar felet och avslutar. Ett fönster mot en server vi inte litar på är
/// värre än inget fönster. Texten går som argv, aldrig som skriptkälla, och
/// `--` hindrar att en text som börjar med `-` läses som flagga.
fn stoppa_med_fel(rubrik: &str, text: &str) -> ! {
    eprintln!("MAXIMUS: {rubrik}. {text}");
    #[cfg(target_os = "macos")]
    {
        let _ = Command::new("/usr/bin/osascript")
            .args(["-e", "on run argv\ndisplay alert (item 1 of argv) message (item 2 of argv) as critical\nend run",
                   "--", rubrik, text])
            .status();
    }
    std::process::exit(1);
}

/// Öppnar en länk i systemets webbläsare eller e-postprogram.
///
/// Bara macOS i 1.0 (granskningen 2026-10-09). Windows-vägen gick genom
/// `cmd /c start`, och cmd läser `&`, `|` och `^` i en adress som nya
/// kommandon: ett klick på `https://x.y/?a&calc` startade calc. Den vägen
/// är borttagen tills den görs med ShellExecute och provas på Windows.
fn oppna_utanfor(adress: &str) {
    #[cfg(target_os = "macos")]
    { let _ = Command::new("/usr/bin/open").arg(adress).spawn(); }
    #[cfg(not(target_os = "macos"))]
    { eprintln!("MAXIMUS: att öppna länkar utanför fönstret stöds bara på macOS i version 1.0 ({adress})."); }
}

#[cfg(test)]
mod prov {
    use super::*;

    /// Samma värde som test/skydd.test.mjs prövar mot serverns sida, räknat
    /// med openssl. Skalet och servern måste räkna lika, annars startar
    /// ingenting.
    #[test]
    fn hmac_stammer() {
        assert_eq!(hex(&hmac_sha256(b"nyckel-i-provet", b"00112233445566778899aabbccddeeff")),
            "f602aaab612dc0ed22f96fa321113497c7e529711acabc6d093baaddd0258923");
        // RFC 4231, fall 2.
        assert_eq!(hex(&hmac_sha256(b"Jefe", b"what do ya want for nothing?")),
            "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843");
        // RFC 4231, fall 6: nyckel längre än blocket.
        assert_eq!(hex(&hmac_sha256(&[0xaa; 131], b"Test Using Larger Than Block-Size Key - Hash Key First")),
            "60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54");
    }

    #[test]
    fn jamforelse_och_hex() {
        assert!(lika_konstant(b"abc", b"abc"));
        assert!(!lika_konstant(b"abc", b"abd"));
        assert!(!lika_konstant(b"abc", b"abcd"));
        assert_eq!(fran_hex("00ff10"), Some(vec![0, 255, 16]));
        assert_eq!(fran_hex("0"), None);
        assert_eq!(fran_hex("zz"), None);
        assert_eq!(slumpa_hex(32).unwrap().len(), 64);
    }
}
